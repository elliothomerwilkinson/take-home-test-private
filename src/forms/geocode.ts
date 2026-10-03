import { Coordinates } from "./transform";
import { lookupPostcode } from "../providers/idealpostcodes";

export type Geocode = typeof lookupPostcode;

export type GeocodeResult = { ok: true; coords: Coordinates } | { ok: false; message: string };

const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const attemptGeocode = async (geocode: Geocode, postcode: string): Promise<GeocodeResult> => {
	try {
		const response = await geocode(postcode);
		if (response.statusCode === 200 && response.body) {
			return { ok: true, coords: response.body };
		}
		return { ok: false, message: `Geocoding returned status ${response.statusCode}` };
	} catch (error) {
		return { ok: false, message: `Geocoding threw: ${error instanceof Error ? error.message : String(error)}` };
	}
};

/** Geocodes a postcode, retrying with exponential backoff (retryDelayMs, then 2x, ...) up to MAX_ATTEMPTS. */
export const geocodePostcode = async (geocode: Geocode, postcode: string, retryDelayMs: number): Promise<GeocodeResult> => {
	let result = await attemptGeocode(geocode, postcode);
	for (let attempt = 1; !result.ok && attempt < MAX_ATTEMPTS; attempt++) {
		await sleep(retryDelayMs * 2 ** (attempt - 1));
		result = await attemptGeocode(geocode, postcode);
	}
	return result;
};
