import { z } from "zod";

const trimmed = z.string().trim();

const requiredString = trimmed.min(1);

const optionalString = trimmed
	.nullish()
	.transform((value) => value || undefined);

const today = () => new Date().toISOString().slice(0, 10);

export const claimIdentitySchema = z.object({
	application_reference: requiredString,
	session_id: requiredString.nullable().catch(null),
});

export const ingestedFormSchema = z.object({
	session_id: trimmed.pipe(z.uuid()),
	application_reference: requiredString,
	name: requiredString.refine((name) => name.split(/\s+/).length >= 2, "name must include a first and last name"),
	email: trimmed.pipe(z.email()),
	gender: trimmed.pipe(z.enum(["male", "female", "other"])),
	date_of_birth: trimmed.pipe(z.iso.date()).refine((date) => date <= today(), "date_of_birth must not be in the future"),
	phone_number: optionalString,
	mobile_number: requiredString,
	address: z.object({
		address_line_1: requiredString,
		address_line_2: requiredString,
		address_line_3: optionalString,
		postcode: requiredString,
		country: requiredString,
	}),
});

export type IngestedFormSchema = z.infer<typeof ingestedFormSchema>;
