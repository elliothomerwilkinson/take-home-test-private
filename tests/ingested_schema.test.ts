import { claimIdentitySchema, ingestedFormSchema } from "../src/forms/schemas/ingested_schema";
import personOne from "../src/forms/examples/person_one.json";
import personTwo from "../src/forms/examples/person_two.json";
import personThree from "../src/forms/examples/person_three.json";

describe("ingestedFormSchema", () => {
	it.each([
		["person_one", personOne],
		["person_two", personTwo],
		["person_three", personThree],
	])("accepts the %s example", (_, example) => {
		expect(ingestedFormSchema.safeParse(example).success).toBe(true);
	});

	const withOverrides = (overrides: Record<string, unknown>) => ({ ...personOne, ...overrides });

	it.each([
		["session_id is not a UUID", { session_id: "not-a-uuid" }],
		["email is malformed", { email: "john.doe" }],
		["date_of_birth is not YYYY-MM-DD", { date_of_birth: "01/01/1990" }],
		["date_of_birth is not a real calendar date", { date_of_birth: "2023-02-30" }],
		["date_of_birth is in the future", { date_of_birth: "2999-01-01" }],
		["name is a single word", { name: "Cher" }],
		["name is a single word padded with whitespace", { name: "  Cher  " }],
		["a required string is empty", { mobile_number: "" }],
		["a required string is only whitespace", { application_reference: "   " }],
		["a required address string is empty", { address: { ...personOne.address, postcode: "" } }],
	])("rejects a form where %s", (_, overrides) => {
		expect(ingestedFormSchema.safeParse(withOverrides(overrides)).success).toBe(false);
	});

	it.each([null, "", "   "])("treats an optional field sent as %p as absent", (value) => {
		const result = ingestedFormSchema.parse(
			withOverrides({ phone_number: value, address: { ...personOne.address, address_line_3: value } }),
		);
		expect(result.phone_number).toBeUndefined();
		expect(result.address.address_line_3).toBeUndefined();
	});

	it("trims whitespace from every string field", () => {
		const result = ingestedFormSchema.parse({
			session_id: "  c8267b77-d796-451e-9948-e82f56412b56 ",
			application_reference: " GRU-123089-2026 ",
			name: "  John   Doe ",
			email: " john.doe@example.com ",
			gender: " male ",
			date_of_birth: " 1990-01-01 ",
			phone_number: " 07123456789 ",
			mobile_number: " 07123456789 ",
			address: {
				address_line_1: " Stratford Village Surgery ",
				address_line_2: " 50C Romford Road ",
				address_line_3: " London ",
				postcode: " E15 4BZ ",
				country: " United Kingdom ",
			},
		});
		expect(result).toEqual({
			session_id: "c8267b77-d796-451e-9948-e82f56412b56",
			application_reference: "GRU-123089-2026",
			name: "John   Doe",
			email: "john.doe@example.com",
			gender: "male",
			date_of_birth: "1990-01-01",
			phone_number: "07123456789",
			mobile_number: "07123456789",
			address: {
				address_line_1: "Stratford Village Surgery",
				address_line_2: "50C Romford Road",
				address_line_3: "London",
				postcode: "E15 4BZ",
				country: "United Kingdom",
			},
		});
	});

	it("strips unknown keys at every level", () => {
		const result = ingestedFormSchema.parse({
			...personOne,
			nhs_number: "123",
			address: { ...personOne.address, county: "Greater London" },
		});
		expect(result).not.toHaveProperty("nhs_number");
		expect(result.address).not.toHaveProperty("county");
	});
});

describe("claimIdentitySchema", () => {
	it("returns the trimmed application reference and session id", () => {
		const result = claimIdentitySchema.parse({
			...personOne,
			application_reference: " GRU-123089-2026 ",
			session_id: " c8267b77-d796-451e-9948-e82f56412b56 ",
		});

		expect(result).toEqual({
			application_reference: "GRU-123089-2026",
			session_id: "c8267b77-d796-451e-9948-e82f56412b56",
		});
	});

	it.each([
		["missing", (({ application_reference, ...rest }) => rest)(personOne)],
		["blank", { ...personOne, application_reference: "   " }],
		["not a string", { ...personOne, application_reference: 123 }],
	])("rejects a body whose application_reference is %s", (_, body) => {
		expect(claimIdentitySchema.safeParse(body).success).toBe(false);
	});

	it.each([
		["missing", (({ session_id, ...rest }) => rest)(personOne)],
		["null", { ...personOne, session_id: null }],
		["blank", { ...personOne, session_id: "   " }],
		["not a string", { ...personOne, session_id: 123 }],
	])("treats a session_id that is %s as null", (_, body) => {
		expect(claimIdentitySchema.parse(body).session_id).toBeNull();
	});
});
