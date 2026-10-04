import { z } from "zod";
import express, { NextFunction, Request, Response } from "express";
import { Db } from "./db";
import { claimIngestedForm, markIngestedForm, saveTransformedForm } from "./db/forms_repository";
import { ingestedFormSchema } from "./forms/schemas/ingested_schema";
import { transformForm } from "./forms/transform";
import { Geocode, geocodePostcode } from "./forms/geocode";
import { deliverTransformedNotification, SendEmail } from "./notifications/transformed_notification";

export type { Geocode, SendEmail };

export type AppDeps = {
	db: Db;
	geocode: Geocode;
	geocodeRetryDelayMs?: number;
	sendEmail: SendEmail;
	emailRetryDelayMs?: number;
};

const readString = (body: unknown, key: string): string | undefined => {
	const value = typeof body === "object" && body !== null ? (body as Record<string, unknown>)[key] : undefined;
	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

export const createApp = ({ db, geocode, geocodeRetryDelayMs = 200, sendEmail, emailRetryDelayMs = 200 }: AppDeps) => {
	const app = express();

	app.use(express.json());

	app.post("/ingest", async (req: Request, res: Response, next: NextFunction) => {
		try {
			const body: unknown = req.body;
			const applicationReference = readString(body, "application_reference");
			if (!applicationReference) {
				res.status(400).json({ error: "application_reference is required" });
				return;
			}

			const ingestedFormId = await claimIngestedForm(db, {
				applicationReference,
				sessionId: readString(body, "session_id") ?? null,
				rawBody: body,
			});
			if (!ingestedFormId) {
				res.status(409).json({ error: `Form ${applicationReference} has already been received` });
				return;
			}

			const parsed = ingestedFormSchema.safeParse(body);
			if (!parsed.success) {
				const issues = z.flattenError(parsed.error);
				await markIngestedForm(db, ingestedFormId, "invalid", issues);
				res.status(400).json({ error: "Form failed validation", issues });
				return;
			}
			const form = parsed.data;
			const geocoded = await geocodePostcode(geocode, form.address.postcode, geocodeRetryDelayMs);
			if (!geocoded.ok) {
				await markIngestedForm(db, ingestedFormId, "failed", { message: geocoded.message });
				res.status(503).json({ error: "Geocoding failed, please retry" });
				return;
			}

			const { transformedFormId, notificationId } = await saveTransformedForm(
				db,
				ingestedFormId,
				transformForm(form, geocoded.coords),
			);

			res.status(201).json({ id: transformedFormId });

			// Fire-and-forget: the email never changes the ingest outcome, and its result is recorded on the notification.
			deliverTransformedNotification(db, sendEmail, notificationId, emailRetryDelayMs).catch((error) =>
				console.error(`Delivering transformed notification ${notificationId} failed`, error),
			);
		} catch (error) {
			next(error);
		}
	});

	app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
		if (error instanceof SyntaxError && "body" in error) {
			res.status(400).json({ error: "Request body is not valid JSON" });
			return;
		}
		next(error);
	});

	return app;
};
