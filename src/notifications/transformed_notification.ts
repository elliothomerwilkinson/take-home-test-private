import { Db } from "../db";
import {
	findTransformedNotification,
	markTransformedNotificationFailed,
	markTransformedNotificationSent,
} from "../db/forms_repository";
import { sendEmail } from "../providers/sendgrid";
import { retryWithBackoff } from "../retry";

export type SendEmail = typeof sendEmail;

const MAX_ATTEMPTS = 3;
const TEAM_ADDRESS = "happyforms@bots.com";
const SENDER_ADDRESS = "formbot@healthtech1.com";
const DEFAULT_EMAIL_RETRY_DELAY_MS = 200;

type Notified = { applicationReference: string; transformedFormId: string; transformedAt: Date };

/** Identifiers only: the email must never carry personal data from the form. */
const buildEmail = ({ applicationReference, transformedFormId, transformedAt }: Notified) => ({
	to: TEAM_ADDRESS,
	from: SENDER_ADDRESS,
	subject: `Form transformed: ${applicationReference}`,
	body: [
		"A form was ingested and transformed, and is ready for FORM-BOT.",
		"",
		`Application reference: ${applicationReference}`,
		`Transformed form id: ${transformedFormId}`,
		`Transformed at: ${transformedAt.toISOString()}`,
	].join("\n"),
});

type SendResult = { ok: true } | { ok: false; message: string };

const attemptSend = async (sendEmail: SendEmail, email: ReturnType<typeof buildEmail>): Promise<SendResult> => {
	try {
		const response = await sendEmail(email);
		return response.statusCode === 200 ? { ok: true } : { ok: false, message: `Email returned status ${response.statusCode}` };
	} catch (error) {
		return { ok: false, message: `Email threw: ${error instanceof Error ? error.message : String(error)}` };
	}
};

/** Emails the team that a form was transformed, and records the outcome on the Transformed Notification. */
export const deliverTransformedNotification = async (
	db: Db,
	sendEmail: SendEmail,
	notificationId: string,
	retryDelayMs: number = DEFAULT_EMAIL_RETRY_DELAY_MS,
): Promise<void> => {
	const notification = await findTransformedNotification(db, notificationId);
	if (!notification) {
		throw new Error(`Transformed notification ${notificationId} not found`);
	}

	const email = buildEmail(notification);
	const { result, attempts } = await retryWithBackoff(() => attemptSend(sendEmail, email), MAX_ATTEMPTS, retryDelayMs);
	if (result.ok) {
		await markTransformedNotificationSent(db, notificationId, attempts);
	} else {
		await markTransformedNotificationFailed(db, notificationId, attempts, { message: result.message });
	}
};
