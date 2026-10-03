import { createDb, Db } from "../src/db";
import { claimIngestedForm, findTransformedNotificationByFormId, saveTransformedForm } from "../src/db/forms_repository";
import { ingestedFormSchema } from "../src/forms/schemas/ingested_schema";
import { transformForm } from "../src/forms/transform";
import { deliverTransformedNotification, SendEmail } from "../src/notifications/transformed_notification";
import personOne from "../src/forms/examples/person_one.json";

const sent: SendEmail = async () => ({ statusCode: 200 });

const rejected: SendEmail = async () => ({ statusCode: 500 });

const createPendingNotification = async (db: Db) => {
	const ingestedFormId = await claimIngestedForm(db, {
		applicationReference: personOne.application_reference,
		sessionId: personOne.session_id,
		rawBody: personOne,
	});
	const form = transformForm(ingestedFormSchema.parse(personOne), { longitude: 50.05, latitude: -5.05 });
	return saveTransformedForm(db, ingestedFormId!, form);
};

describe("deliverTransformedNotification", () => {
	let db: Db;

	beforeEach(async () => {
		db = await createDb();
	});

	afterEach(async () => {
		await db.close();
	});

	it("emails the team and marks the notification sent", async () => {
		const { transformedFormId, notificationId } = await createPendingNotification(db);
		const sendEmail = jest.fn(sent);

		await deliverTransformedNotification(db, sendEmail, notificationId, 0);

		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "happyforms@bots.com",
				from: "formbot@healthtech1.com",
				subject: "Form transformed: GRU-123089-2026",
			}),
		);
		expect(await findTransformedNotificationByFormId(db, transformedFormId)).toMatchObject({
			status: "sent",
			attempts: 1,
			error: null,
			sentAt: expect.any(Date),
		});
	});

	it("identifies the form in the body without including personal data", async () => {
		const before = new Date();
		const { transformedFormId, notificationId } = await createPendingNotification(db);
		const sendEmail = jest.fn(sent);

		await deliverTransformedNotification(db, sendEmail, notificationId, 0);

		const { body } = sendEmail.mock.calls[0][0];
		expect(body).toContain("GRU-123089-2026");
		expect(body).toContain(transformedFormId);
		const transformedAt = new Date(body.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/)![0]);
		expect(transformedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
		expect(transformedAt.getTime()).toBeLessThanOrEqual(Date.now());
		for (const personalData of [
			"John",
			"Doe",
			"john.doe@example.com",
			"1990-01-01",
			"07123456789",
			"Stratford Village Surgery",
			"50C Romford Road",
			"E15 4BZ",
		]) {
			expect(body).not.toContain(personalData);
		}
	});

	it("retries a failing send until it succeeds", async () => {
		const { transformedFormId, notificationId } = await createPendingNotification(db);
		const sendEmail = jest.fn(sent).mockImplementationOnce(rejected).mockImplementationOnce(rejected);

		await deliverTransformedNotification(db, sendEmail, notificationId, 0);

		expect(sendEmail).toHaveBeenCalledTimes(3);
		expect(await findTransformedNotificationByFormId(db, transformedFormId)).toMatchObject({
			status: "sent",
			attempts: 3,
		});
	});

	it("marks the notification failed after 3 rejected sends", async () => {
		const { transformedFormId, notificationId } = await createPendingNotification(db);
		const sendEmail = jest.fn(rejected);

		await deliverTransformedNotification(db, sendEmail, notificationId, 0);

		expect(sendEmail).toHaveBeenCalledTimes(3);
		expect(await findTransformedNotificationByFormId(db, transformedFormId)).toMatchObject({
			status: "failed",
			attempts: 3,
			error: { message: expect.stringContaining("500") },
			sentAt: null,
		});
	});

	it("treats a send that throws as a failed attempt", async () => {
		const { transformedFormId, notificationId } = await createPendingNotification(db);
		const sendEmail = jest.fn<ReturnType<SendEmail>, Parameters<SendEmail>>(async () => {
			throw new Error("connection reset");
		});

		await deliverTransformedNotification(db, sendEmail, notificationId, 0);

		expect(sendEmail).toHaveBeenCalledTimes(3);
		expect(await findTransformedNotificationByFormId(db, transformedFormId)).toMatchObject({
			status: "failed",
			attempts: 3,
			error: { message: expect.stringContaining("connection reset") },
		});
	});
});
