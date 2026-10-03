export type Attempted<R> = { result: R; attempts: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Calls attempt until it succeeds, waiting retryDelayMs, then 2x, ... between calls, up to maxAttempts. */
export const retryWithBackoff = async <R extends { ok: boolean }>(
	attempt: () => Promise<R>,
	maxAttempts: number,
	retryDelayMs: number,
): Promise<Attempted<R>> => {
	let result = await attempt();
	let attempts = 1;
	for (; !result.ok && attempts < maxAttempts; attempts++) {
		await sleep(retryDelayMs * 2 ** (attempts - 1));
		result = await attempt();
	}
	return { result, attempts };
};
