import { IngestedFormSchema } from "./schemas/ingested_schema";
import { TransformedFormSchema } from "./schemas/transformed_schema";

export type Coordinates = { longitude: number; latitude: number };

const GENDERS: Record<IngestedFormSchema["gender"], TransformedFormSchema["gender"]> = {
	male: "male",
	female: "female",
	other: "prefer-not-to-say",
};

// Validation guarantees at least two words, so the final match always exists.
const splitName = (name: string) => {
	const [, firstName, lastName] = name.match(/^(.*\S)\s+(\S+)$/)!;
	return { firstName, lastName };
};

export const transformForm = (form: IngestedFormSchema, { longitude, latitude }: Coordinates): TransformedFormSchema => ({
	sessionId: form.session_id,
	applicationReference: form.application_reference,
	...splitName(form.name),
	email: form.email,
	gender: GENDERS[form.gender],
	dateOfBirth: new Date(`${form.date_of_birth}T00:00:00.000Z`),
	phoneNumber: form.phone_number,
	mobileNumber: form.mobile_number,
	addressLine1: form.address.address_line_1,
	addressLine2: form.address.address_line_2,
	addressLine3: form.address.address_line_3,
	postcode: form.address.postcode,
	country: form.address.country,
	longitude,
	latitude,
});
