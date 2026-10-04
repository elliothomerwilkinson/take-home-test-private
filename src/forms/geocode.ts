import { Coordinates } from "./transform";
import { lookupPostcode } from "../providers/idealpostcodes";
import { retryWithBackoff } from "../retry";

export type Geocode = typeof lookupPostcode;

export type GeocodeResult = { ok: true; coords: Coordinates } | { ok: false; message: string };

const MAX_ATTEMPTS = 3;
const DEFAULT_GEOCODE_RETRY_DELAY_MS = 200;

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
export const geocodePostcode = async (geocode: Geocode, postcode: string, retryDelayMs: number = DEFAULT_GEOCODE_RETRY_DELAY_MS): Promise<GeocodeResult> => {
	const { result } = await retryWithBackoff(() => attemptGeocode(geocode, postcode), MAX_ATTEMPTS, retryDelayMs);
	return result;
};
