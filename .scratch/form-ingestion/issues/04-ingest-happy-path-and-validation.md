# 04: `/ingest` happy path and validation failures

Status: ready-for-agent
Blocked by: 01, 02, 03
Spec: `.scratch/form-ingestion/spec.md` (section "Request flow", steps 1, 2, 4, 6 and 7)

## What

Connect the full flow end to end for a **first delivery**, using a single geocode attempt. Deduplication is ticket 05 and geocoding retries are ticket 06.

## Tasks

- Add a repository module (`src/db/forms_repository.ts`) that holds all the SQL: insert an ingested form, update its status and error, and insert a transformed form while marking the ingested row `transformed` in **one transaction**.
- Return 400 for invalid JSON. `express.json()` throws a `SyntaxError`, so add an error handler that turns it into a 400. Store nothing.
- Return 400 when `application_reference` is missing or blank. Read it from the raw body before zod runs, and store nothing. See ADR-0003.
- Insert a row with status `received` and `raw_body` set to the untouched body.
- If zod validation fails, set the row to `invalid`, store the issues in `error`, and return 400 with the flattened issues.
- Geocode once. If the call returns a non-200, set the row to `failed` and return 503.
- Otherwise, transform and persist in one transaction, then return 201 with `{ id }`.

## Acceptance (supertest, fresh in-memory PGlite, stub geocoder)

- [ ] Each example payload gives a 201, the expected `transformed_forms` row, and an `ingested_forms` row with status `transformed`.
- [ ] Invalid JSON gives a 400 and both tables are empty.
- [ ] A missing `application_reference` gives a 400 and both tables are empty.
- [ ] An invalid email gives a 400, a row with status `invalid`, and the issues stored in `error`.
- [ ] A single-word name gives a 400.
- [ ] An extra unknown field gives a 201, and the field is still present in `raw_body`.
- [ ] A stub geocoder returning 500 gives a 503 and a row with status `failed`.
