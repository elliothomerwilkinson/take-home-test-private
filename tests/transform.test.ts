import { ingestedFormSchema } from "../src/forms/schemas/ingested_schema";
import { transformForm } from "../src/forms/transform";
import personOne from "../src/forms/examples/person_one.json";
import personTwo from "../src/forms/examples/person_two.json";
import personThree from "../src/forms/examples/person_three.json";

const coords = { longitude: 50.05, latitude: -5.05 };

describe("transformForm", () => {
	it("transforms the person_one example", () => {
		expect(transformForm(ingestedFormSchema.parse(personOne), coords)).toEqual({
			sessionId: "c8267b77-d796-451e-9948-e82f56412b56",
			applicationReference: "GRU-123089-2026",
			firstName: "John",
			lastName: "Doe",
			email: "john.doe@example.com",
			gender: "male",
			dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
			phoneNumber: "07123456789",
			mobileNumber: "07123456789",
			addressLine1: "Stratford Village Surgery",
			addressLine2: "50C Romford Road",
			addressLine3: "London",
			postcode: "E15 4BZ",
			country: "United Kingdom",
			longitude: 50.05,
			latitude: -5.05,
		});
	});

	it("transforms the person_two example, keeping middle names in firstName and mapping other to prefer-not-to-say", () => {
		expect(transformForm(ingestedFormSchema.parse(personTwo), coords)).toEqual({
			sessionId: "c77fb77f-5a95-4935-9d5a-12953f29da89",
			applicationReference: "GRU-123090-2026",
			firstName: "Andy James",
			lastName: "Smith-Jones",
			email: "andy.smith.jones@example.com",
			gender: "prefer-not-to-say",
			dateOfBirth: new Date("1985-06-20T00:00:00.000Z"),
			phoneNumber: "0001",
			mobileNumber: "07777777777",
			addressLine1: "1 The Avenue",
			addressLine2: "Bristol",
			addressLine3: undefined,
			postcode: "BS1 1AA",
			country: "United Kingdom",
			longitude: 50.05,
			latitude: -5.05,
		});
	});

	it("transforms the person_three example, leaving absent optional fields undefined", () => {
		expect(transformForm(ingestedFormSchema.parse(personThree), coords)).toEqual({
			sessionId: "881fa3b2-84cd-4517-b909-84a073ca0110",
			applicationReference: "GRU-123092-2026",
			firstName: "Jane",
			lastName: "Doe",
			email: "jane.doe@example.com",
			gender: "female",
			dateOfBirth: new Date("1921-03-14T00:00:00.000Z"),
			phoneNumber: undefined,
			mobileNumber: "07123456789",
			addressLine1: "123 Main St",
			addressLine2: "Apt 1",
			addressLine3: undefined,
			postcode: "SW1A 1AA",
			country: "United Kingdom",
			longitude: 50.05,
			latitude: -5.05,
		});
	});

	it("splits on the last whitespace without normalising whitespace inside firstName", () => {
		const form = ingestedFormSchema.parse({ ...personOne, name: "Mary  Ann   Jones" });
		const result = transformForm(form, coords);
		expect(result.firstName).toBe("Mary  Ann");
		expect(result.lastName).toBe("Jones");
	});
});
