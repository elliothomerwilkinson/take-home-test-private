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

export const saveTransformedForm = async (db: Db, ingestedFormId: string, form: TransformedFormSchema): Promise<string> =>
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
		await tx.query(`UPDATE ingested_forms SET status = 'transformed', error = NULL, updated_at = now() WHERE id = $1`, [
			ingestedFormId,
		]);
		return rows[0].id;
	});

export const findIngestedForm = async (db: Db, applicationReference: string): Promise<IngestedForm | undefined> => {
	const { rows } = await db.query<IngestedFormRow>(`SELECT * FROM ingested_forms WHERE application_reference = $1`, [
		applicationReference,
	]);
	const row = rows[0];
	return (
		row && {
			id: row.id,
			applicationReference: row.application_reference,
			sessionId: row.session_id,
			rawBody: row.raw_body,
			status: row.status,
			error: row.error,
			attempts: row.attempts,
		}
	);
};

export const findTransformedForm = async (db: Db, id: string): Promise<TransformedFormSchema | undefined> => {
	const { rows } = await db.query<TransformedFormRow>(`SELECT * FROM transformed_forms WHERE id = $1`, [id]);
	const row = rows[0];
	return (
		row && {
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
		}
	);
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
