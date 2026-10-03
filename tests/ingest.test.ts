import request from "supertest";
import { createApp, Geocode } from "../src/app";
import { createDb, Db } from "../src/db";
import { claimIngestedForm, countForms, findIngestedForm, findTransformedForm } from "../src/db/forms_repository";
import personOne from "../src/forms/examples/person_one.json";
import personTwo from "../src/forms/examples/person_two.json";
import personThree from "../src/forms/examples/person_three.json";

const withoutReference = (({ application_reference, ...rest }) => rest)(personOne);

const succeedingGeocode: Geocode = async () => ({ statusCode: 200, body: { longitude: 50.05, latitude: -5.05 } });

const failingGeocode: Geocode = async () => ({ statusCode: 500 });

const geocodeFailingTimes = (failures: number) => {
	let calls = 0;
	return jest.fn<ReturnType<Geocode>, Parameters<Geocode>>(async (postcode) =>
		++calls <= failures ? { statusCode: 500 } : succeedingGeocode(postcode),
	);
};

describe("POST /ingest", () => {
	let db: Db;

	beforeEach(async () => {
		db = await createDb();
	});

	afterEach(async () => {
		await db.close();
	});

	const ingest = (body: unknown, geocode: Geocode = succeedingGeocode) =>
		request(createApp({ db, geocode, geocodeRetryDelayMs: 0 })).post("/ingest").send(body as object);

	it("stores a valid form as a transformed form and returns its id", async () => {
		const response = await ingest(personOne);

		expect(response.status).toBe(201);
		expect(await findTransformedForm(db, response.body.id)).toEqual({
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
		expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({
			status: "transformed",
			attempts: 1,
			rawBody: personOne,
			error: null,
		});
	});

	it("rejects a body that is not valid JSON without storing anything", async () => {
		const response = await request(createApp({ db, geocode: succeedingGeocode, geocodeRetryDelayMs: 0 }))
			.post("/ingest")
			.set("Content-Type", "application/json")
			.send('{"application_reference": "GRU-1"');

		expect(response.status).toBe(400);
		expect(response.body).toEqual({ error: "Request body is not valid JSON" });
		expect(await countForms(db)).toEqual({ ingested: 0, transformed: 0 });
	});

	it.each([
		["missing", withoutReference],
		["blank", { ...personOne, application_reference: "   " }],
		["not a string", { ...personOne, application_reference: 123 }],
	])("rejects a form whose application_reference is %s without storing anything", async (_, body) => {
		const response = await ingest(body);

		expect(response.status).toBe(400);
		expect(await countForms(db)).toEqual({ ingested: 0, transformed: 0 });
	});

	it("stores a form that fails validation as invalid, with the issues, and reports them", async () => {
		const body = { ...personOne, email: "john.doe" };

		const response = await ingest(body);

		expect(response.status).toBe(400);
		expect(response.body.issues.fieldErrors).toHaveProperty("email");
		expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({
			status: "invalid",
			rawBody: body,
			error: { fieldErrors: { email: expect.any(Array) } },
		});
		expect(await countForms(db)).toEqual({ ingested: 1, transformed: 0 });
	});

	it("rejects a single-word name as invalid", async () => {
		const response = await ingest({ ...personOne, name: "Cher" });

		expect(response.status).toBe(400);
		expect(response.body.issues.fieldErrors).toHaveProperty("name");
		expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({ status: "invalid" });
	});

	it.each([
		["person_two", personTwo],
		["person_three", personThree],
	])("stores the %s example as a transformed form", async (_, example) => {
		const response = await ingest(example);

		expect(response.status).toBe(201);
		expect(await findTransformedForm(db, response.body.id)).toMatchObject({
			applicationReference: example.application_reference,
		});
		expect(await findIngestedForm(db, example.application_reference)).toMatchObject({ status: "transformed" });
	});

	it("accepts a form with unknown fields and keeps them in the raw body", async () => {
		const body = { ...personOne, nhs_number: "943 476 5919" };

		const response = await ingest(body);

		expect(response.status).toBe(201);
		expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({ rawBody: body });
	});

	it("stores a form whose geocoding fails as failed and returns 503", async () => {
		const response = await ingest(personOne, failingGeocode);

		expect(response.status).toBe(503);
		expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({
			status: "failed",
			error: { message: expect.stringContaining("500") },
		});
		expect(await countForms(db)).toEqual({ ingested: 1, transformed: 0 });
	});

	it("treats a geocoder that throws as a failed geocode", async () => {
		const response = await ingest(personOne, async () => {
			throw new Error("connection reset");
		});

		expect(response.status).toBe(503);
		expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({
			status: "failed",
			error: { message: expect.stringContaining("connection reset") },
		});
	});

	describe("duplicate deliveries", () => {
		it("rejects a second delivery of a transformed form", async () => {
			expect((await ingest(personOne)).status).toBe(201);

			const response = await ingest(personOne);

			expect(response.status).toBe(409);
			expect(await countForms(db)).toEqual({ ingested: 1, transformed: 1 });
		});

		it("reprocesses a corrected resend of an invalid form", async () => {
			expect((await ingest({ ...personOne, email: "john.doe" })).status).toBe(400);

			const response = await ingest(personOne);

			expect(response.status).toBe(201);
			expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({
				status: "transformed",
				attempts: 2,
				rawBody: personOne,
				error: null,
			});
			expect(await countForms(db)).toEqual({ ingested: 1, transformed: 1 });
		});

		it("reprocesses a resend of a form whose geocoding failed", async () => {
			expect((await ingest(personOne, failingGeocode)).status).toBe(503);

			const response = await ingest(personOne);

			expect(response.status).toBe(201);
			expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({ status: "transformed", attempts: 2 });
		});

		it("rejects a resend with changed content once the form is transformed", async () => {
			expect((await ingest(personOne)).status).toBe(201);

			const response = await ingest({ ...personOne, mobile_number: "07000000000" });

			expect(response.status).toBe(409);
			expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({ rawBody: personOne, attempts: 1 });
		});

		it("rejects a delivery while the same form is still being processed", async () => {
			await claimIngestedForm(db, { applicationReference: "GRU-123089-2026", sessionId: null, rawBody: personOne });

			const response = await ingest(personOne);

			expect(response.status).toBe(409);
		});

		it("transforms only one of two concurrent deliveries", async () => {
			const app = createApp({ db, geocode: succeedingGeocode, geocodeRetryDelayMs: 0 });

			const statuses = await Promise.all([
				request(app).post("/ingest").send(personOne),
				request(app).post("/ingest").send(personOne),
			]).then((responses) => responses.map((response) => response.status).sort());

			expect(statuses).toEqual([201, 409]);
			expect(await countForms(db)).toEqual({ ingested: 1, transformed: 1 });
		});
	});

	describe("geocoding retries", () => {
		it("retries a failing geocode until it succeeds", async () => {
			const geocode = geocodeFailingTimes(2);

			const response = await ingest(personOne, geocode);

			expect(response.status).toBe(201);
			expect(geocode).toHaveBeenCalledTimes(3);
		});

		it.each([
			["returns an error", async () => ({ statusCode: 500 })],
			[
				"throws",
				async () => {
					throw new Error("connection reset");
				},
			],
		])("gives up after 3 attempts when the geocoder always %s", async (_, implementation) => {
			const geocode = jest.fn<ReturnType<Geocode>, Parameters<Geocode>>(implementation);

			const response = await ingest(personOne, geocode);

			expect(response.status).toBe(503);
			expect(geocode).toHaveBeenCalledTimes(3);
			expect(await findIngestedForm(db, "GRU-123089-2026")).toMatchObject({ status: "failed" });
		});
	});
});
