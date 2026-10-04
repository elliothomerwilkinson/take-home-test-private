import { Db } from ".";
import { TransformedFormSchema } from "../forms/schemas/transformed_schema";

export type IngestedFormStatus = "received" | "invalid" | "failed" | "transformed";

export type IngestedForm = {
	id: string;
	applicationReference: string;
	sessionId: string | null;
	rawBody: unknown;
	status: IngestedFormStatus;
	error: unknown;
	attempts: number;
};

type IngestedFormRow = {
	id: string;
	application_reference: string;
	session_id: string | null;
	raw_body: unknown;
	status: IngestedFormStatus;
	error: unknown;
	attempts: number;
};

export type TransformedNotificationStatus = "pending" | "sent" | "failed";

export type TransformedNotification = {
	id: string;
	transformedFormId: string;
	status: TransformedNotificationStatus;
	attempts: number;
	error: unknown;
	sentAt: Date | null;
};

type TransformedNotificationRow = {
	id: string;
	transformed_form_id: string;
	status: TransformedNotificationStatus;
	attempts: number;
	error: unknown;
	sent_at: Date | null;
};

type TransformedFormRow = {
	session_id: string;
	application_reference: string;
	first_name: string;
	last_name: string;
	email: string;
	gender: TransformedFormSchema["gender"];
	date_of_birth: Date;
	phone_number: string | null;
	mobile_number: string;
	address_line_1: string;
	address_line_2: string;
	address_line_3: string | null;
	postcode: string;
	country: string;
	longitude: number;
	latitude: number;
};

/**
 * Claims an application reference for processing. A new reference is inserted; an invalid or failed one is
 * reset with the new body for reprocessing. Returns undefined when the reference is received or transformed,
 * so concurrent and duplicate deliveries are settled by the database.
 */
export const claimIngestedForm = async (
	db: Db,
	form: { applicationReference: string; sessionId: string | null; rawBody: unknown },
): Promise<string | undefined> => {
	const { rows } = await db.query<{ id: string }>(
		`INSERT INTO ingested_forms (application_reference, session_id, raw_body, status)
		 VALUES ($1, $2, $3, 'received')
		 ON CONFLICT (application_reference) DO UPDATE SET
			session_id = EXCLUDED.session_id,
			raw_body = EXCLUDED.raw_body,
			status = 'received',
			error = NULL,
			attempts = ingested_forms.attempts + 1,
			updated_at = now()
		 WHERE ingested_forms.status IN ('invalid', 'failed')
		 RETURNING id`,
		[form.applicationReference, form.sessionId, JSON.stringify(form.rawBody)],
	);
	return rows[0]?.id;
};

/**
 * Saves the Transformed Form, records its pending Transformed Notification and marks the Ingested Form transformed,
 * in one transaction, so a transformed form always has exactly one notification owed.
 */
export const saveTransformedForm = async (
	db: Db,
	ingestedFormId: string,
	form: TransformedFormSchema,
): Promise<{ transformedFormId: string; notificationId: string }> =>
	db.transaction(async (tx) => {
		const { rows } = await tx.query<{ id: string }>(
			`INSERT INTO transformed_forms (
				ingested_form_id, session_id, application_reference, first_name, last_name, email, gender,
				date_of_birth, phone_number, mobile_number, address_line_1, address_line_2, address_line_3,
				postcode, country, longitude, latitude
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
			RETURNING id`,
			[
				ingestedFormId,
				form.sessionId,
				form.applicationReference,
				form.firstName,
				form.lastName,
				form.email,
				form.gender,
				form.dateOfBirth.toISOString().slice(0, 10),
				form.phoneNumber ?? null,
				form.mobileNumber,
				form.addressLine1,
				form.addressLine2,
				form.addressLine3 ?? null,
				form.postcode,
				form.country,
				form.longitude,
				form.latitude,
			],
		);
		const transformedFormId = rows[0].id;
		const notification = await tx.query<{ id: string }>(
			`INSERT INTO transformed_notifications (transformed_form_id) VALUES ($1) RETURNING id`,
			[transformedFormId],
		);
		await tx.query(`UPDATE ingested_forms SET status = 'transformed', error = NULL, updated_at = now() WHERE id = $1`, [
			ingestedFormId,
		]);
		return { transformedFormId, notificationId: notification.rows[0].id };
	});

export const findIngestedForm = async (db: Db, applicationReference: string): Promise<IngestedForm | undefined> => {
	const { rows } = await db.query<IngestedFormRow>(`SELECT * FROM ingested_forms WHERE application_reference = $1`, [
		applicationReference,
	]);
	const row = rows[0];

	if (!row) {
		return undefined;
	}

	return {
		id: row.id,
		applicationReference: row.application_reference,
		sessionId: row.session_id,
		rawBody: row.raw_body,
		status: row.status,
		error: row.error,
		attempts: row.attempts,
	};
};

export const findTransformedForm = async (db: Db, id: string): Promise<TransformedFormSchema | undefined> => {
	const { rows } = await db.query<TransformedFormRow>(`SELECT * FROM transformed_forms WHERE id = $1`, [id]);
	const row = rows[0];

	if (!row) {
		return undefined;
	}

	return {
			sessionId: row.session_id,
			applicationReference: row.application_reference,
			firstName: row.first_name,
			lastName: row.last_name,
			email: row.email,
			gender: row.gender,
			dateOfBirth: row.date_of_birth,
			phoneNumber: row.phone_number ?? undefined,
			mobileNumber: row.mobile_number,
			addressLine1: row.address_line_1,
			addressLine2: row.address_line_2,
			addressLine3: row.address_line_3 ?? undefined,
			postcode: row.postcode,
			country: row.country,
			longitude: row.longitude,
			latitude: row.latitude,
	};
};

export const findTransformedNotificationByFormId = async (
	db: Db,
	transformedFormId: string,
): Promise<TransformedNotification | undefined> => {
	const { rows } = await db.query<TransformedNotificationRow>(
		`SELECT * FROM transformed_notifications WHERE transformed_form_id = $1`,
		[transformedFormId],
	);
	const row = rows[0];

	if (!row) {
		return undefined;
	}

	return {
		id: row.id,
		transformedFormId: row.transformed_form_id,
		status: row.status,
		attempts: row.attempts,
		error: row.error,
		sentAt: row.sent_at,
	};
};

export const countForms = async (db: Db): Promise<{ ingested: number; transformed: number }> => {
	const { rows } = await db.query<{ ingested: number; transformed: number }>(
		`SELECT (SELECT count(*)::int FROM ingested_forms) AS ingested, (SELECT count(*)::int FROM transformed_forms) AS transformed`,
	);
	return rows[0];
};

export const markIngestedForm = async (
	db: Db,
	id: string,
	status: Extract<IngestedFormStatus, "invalid" | "failed">,
	error: unknown,
): Promise<void> => {
	await db.query(`UPDATE ingested_forms SET status = $2, error = $3, updated_at = now() WHERE id = $1`, [
		id,
		status,
		JSON.stringify(error),
	]);
};

export const findTransformedNotification = async (
	db: Db,
	id: string,
): Promise<(TransformedNotification & { applicationReference: string; transformedAt: Date }) | undefined> => {
	const { rows } = await db.query<TransformedNotificationRow & { application_reference: string; transformed_at: Date }>(
		`SELECT n.*, f.application_reference, f.created_at AS transformed_at
		 FROM transformed_notifications n JOIN transformed_forms f ON f.id = n.transformed_form_id
		 WHERE n.id = $1`,
		[id],
	);
	const row = rows[0];

	if (!row) {
		return undefined;
	}

	return {
		id: row.id,
		transformedFormId: row.transformed_form_id,
		status: row.status,
		attempts: row.attempts,
		error: row.error,
		sentAt: row.sent_at,
		applicationReference: row.application_reference,
		transformedAt: row.transformed_at,
	};
};

export const markTransformedNotificationSent = async (db: Db, id: string, attempts: number): Promise<void> => {
	await db.query(
		`UPDATE transformed_notifications SET status = 'sent', attempts = $2, error = NULL, sent_at = now(), updated_at = now() WHERE id = $1`,
		[id, attempts],
	);
};

export const markTransformedNotificationFailed = async (
	db: Db,
	id: string,
	attempts: number,
	error: unknown,
): Promise<void> => {
	await db.query(
		`UPDATE transformed_notifications SET status = 'failed', attempts = $2, error = $3, updated_at = now() WHERE id = $1`,
		[id, attempts, JSON.stringify(error)],
	);
};

export const countTransformedNotifications = async (db: Db): Promise<number> => {
	const { rows } = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM transformed_notifications`);
	return rows[0].count;
};
