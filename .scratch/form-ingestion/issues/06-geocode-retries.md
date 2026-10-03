# 06: Geocoding retries with backoff

Status: ready-for-agent
Blocked by: 04
Spec: `.scratch/form-ingestion/spec.md` (section "Request flow", step 5)

## What

The mock geocoder fails about 5% of the time. Retry up to **3 attempts** with a short backoff before marking the row `failed` and returning 503.

## Tasks

- Wrap `geocode` in a retry helper that makes at most 3 attempts with a short backoff between them. Retry when the result is a non-200 or when the call throws.
- Make the backoff delay configurable, for example through a `createApp` option, so tests run instantly.
- Store the last error in `ingested_forms.error`.

## Acceptance (write the tests first)

- [ ] A stub that fails twice and then succeeds gives a 201 after 3 calls.
- [ ] A stub that always fails gives a 503 after exactly 3 calls, and a row with status `failed` and the error stored.
- [ ] A stub that throws is handled the same way as one that returns a non-200.
