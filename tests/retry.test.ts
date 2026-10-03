import { retryWithBackoff } from "../src/retry";

type Result = { ok: true; value: string } | { ok: false; message: string };

const failure = (n: number): Result => ({ ok: false, message: `failure ${n}` });

describe("retryWithBackoff", () => {
	it("returns a first-time success after one attempt", async () => {
		const attempt = jest.fn(async (): Promise<Result> => ({ ok: true, value: "done" }));

		expect(await retryWithBackoff(attempt, 3, 0)).toEqual({ result: { ok: true, value: "done" }, attempts: 1 });
		expect(attempt).toHaveBeenCalledTimes(1);
	});

	it("retries failures until an attempt succeeds", async () => {
		const attempt = jest
			.fn<Promise<Result>, []>()
			.mockResolvedValueOnce(failure(1))
			.mockResolvedValueOnce(failure(2))
			.mockResolvedValueOnce({ ok: true, value: "done" });

		expect(await retryWithBackoff(attempt, 3, 0)).toEqual({ result: { ok: true, value: "done" }, attempts: 3 });
	});

	it("gives up after maxAttempts and returns the last failure", async () => {
		let calls = 0;
		const attempt = jest.fn(async (): Promise<Result> => failure(++calls));

		expect(await retryWithBackoff(attempt, 3, 0)).toEqual({ result: { ok: false, message: "failure 3" }, attempts: 3 });
		expect(attempt).toHaveBeenCalledTimes(3);
	});
});
