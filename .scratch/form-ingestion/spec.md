# Spec: Form ingestion via `/ingest`

Status: ready-for-agent

## Problem

An unreliable third party sends us registration forms. They may change the schema without notice, deliver the same form more than once, or send malformed data. `POST /ingest` is currently a stub. It needs to validate each **Ingested Form**, geocode its postcode, transform it into a **Transformed Form**, and store both in a database. A form must never become a Transformed Form twice.

See `CONTEXT.md` for terminology and `docs/adr/` for the decisions behind this design.

## Scope

In scope:

- Validating the request body with zod against `src/forms/schemas/ingested_schema.ts`
- Geocoding the postcode through `lookupPostcode` (`src/providers/idealpostcodes.ts`)
- Transforming the body into `src/forms/schemas/transformed_schema.ts`
- Storing the raw body and the transformed record in an in-memory PGlite database
- Deduplicating on `application_reference`

Out of scope, but the schema must allow adding them without restructuring:

- The guaranteed email to happyforms@bots.com
- A `/retry` endpoint that reprocesses `invalid` or `failed` rows
- Handling amended resubmissions of an already-transformed form

## Request flow: `POST /ingest`

1. **Parse.** If the body is not valid JSON, return **400** and store nothing.
2. **Reference check.** Read `application_reference` from the raw body *before* zod validation. If it is missing or not a non-empty string after trimming, return **400** and store nothing (see ADR-0003).
3. **Deduplicate.** Look up the `ingested_forms` row for this reference.
   - If its status is `transformed` or `received`, return **409**. A `received` row is still being processed.
   - If its status is `invalid` or `failed`, reuse the row: overwrite `raw_body`, set status `received`, and increment `attempts`.
   - If there is no row, insert one with status `received`. The `UNIQUE` constraint settles races; on a unique violation, return **409**.
4. **Validate** with zod. On failure, set the row to `invalid`, store the zod issues in `error`, and return **400** with the flattened issues.
5. **Geocode.** Make up to 3 attempts with a short backoff. If all three fail, set the row to `failed`, store the error, and return **503**.
6. **Transform.** This is a pure function of (validated payload, coordinates) → `TransformedFormSchema`. See the rules below.
7. **Persist.** In a single transaction, insert into `transformed_forms` and set the `ingested_forms` row to `transformed`. Return **201** with the transformed form's `id`.

## Validation rules (zod)

| Field | Rule |
|---|---|
| `session_id` | UUID |
| `application_reference` | Non-empty string. The format is not checked. |
| `name` | Non-empty string with at least two words once trimmed. Single-word names are rejected. |
| `email` | Valid email format |
| `gender` | `male` \| `female` \| `other` |
| `date_of_birth` | Strict `YYYY-MM-DD`. Must be a real calendar date and not in the future. |
| `phone_number` | Optional. Format is not checked. |
| `mobile_number` | Non-empty string. Format is not checked. |
| `address.address_line_1`, `address_line_2`, `postcode`, `country` | Non-empty strings |
| `address.address_line_3` | Optional |

The same rules apply to every field:

- Trim all strings. No other normalisation: postcode and email case are left unchanged.
- An optional field that is missing, `null` or `""` becomes `undefined`.
- An empty string in a required field is invalid.
- Unknown keys are stripped (zod's default). The original body is still kept in `raw_body`.

## Transform rules

- `name` becomes `firstName` (every word except the last) and `lastName` (the last word). For example, `"Andy James Smith-Jones"` becomes `"Andy James"` / `"Smith-Jones"`.
- `gender: other` becomes `prefer-not-to-say`. This mapping loses information; it is recorded in `CONTEXT.md`.
- `date_of_birth` becomes a `Date` at **UTC midnight**.
- `address.*` fields are flattened to `addressLine1`, `addressLine2`, `addressLine3`, `postcode` and `country`.
- `longitude` and `latitude` come from geocoding.
- All other fields are renamed from snake_case to camelCase.

## Database (PGlite, in-memory, raw SQL)

The schema lives in a single `schema.sql`, which is applied at startup.

### `ingested_forms`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `application_reference` | `text NOT NULL UNIQUE` | Deduplication key |
| `session_id` | `text NULL` | Not indexed. One session may hold several applications. |
| `raw_body` | `jsonb NOT NULL` | The body exactly as received, before stripping |
| `status` | `text NOT NULL` | `CHECK (status IN ('received','invalid','failed','transformed'))` |
| `error` | `jsonb NULL` | Zod issues or the geocoding error |
| `attempts` | `int NOT NULL DEFAULT 1` | |
| `created_at`, `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

### `transformed_forms`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `ingested_form_id` | `uuid NOT NULL UNIQUE` FK → `ingested_forms.id` | |
| `session_id` | `text NOT NULL` | |
| `application_reference` | `text NOT NULL UNIQUE` | Backstop against the same form being sent to FORM-BOT twice |
| `first_name`, `last_name`, `email`, `mobile_number` | `text NOT NULL` | |
| `phone_number` | `text NULL` | |
| `gender` | `text NOT NULL` | `CHECK (gender IN ('male','female','prefer-not-to-say'))` |
| `date_of_birth` | `date NOT NULL` | |
| `address_line_1`, `address_line_2`, `postcode`, `country` | `text NOT NULL` | |
| `address_line_3` | `text NULL` | |
| `longitude`, `latitude` | `double precision NOT NULL` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

## Code structure

- `src/app.ts` exports `createApp({ db, geocode })`, so tests can pass in a fresh database and a geocoder that behaves predictably.
- `src/index.ts` wires the app to a real in-memory PGlite instance and `lookupPostcode`.
- The zod schema and the transform each live in their own pure module.
- A small repository module holds all SQL.
- Dependencies: `zod` and `@electric-sql/pglite`, installed with **npm**.

## Testing (written test-first)

- **Unit tests:** the zod schema, covering each rule above, and the transform, covering name splitting, gender mapping, the UTC date and flattening.
- **Integration tests** (supertest, fresh in-memory PGlite, stub geocoder):
  - Each of the three example payloads gives a 201 and correct rows in both tables
  - Invalid JSON gives a 400 and stores nothing
  - A missing `application_reference` gives a 400 and stores nothing
  - An invalid field gives a 400 and a row with status `invalid`
  - Extra unknown fields give a 201, and the extra fields are kept in `raw_body`
  - A single-word name gives a 400
  - A duplicate of a `transformed` form gives a 409
  - A resend after `invalid`/`failed` is reprocessed and gives a 201 with `attempts` incremented
  - A geocoder that fails 3 times gives a 503 and a row with status `failed`

## Acceptance criteria

- [ ] Every scenario in the testing section passes under `npm test`
- [ ] `npm run build` type-checks cleanly
- [ ] `CONTEXT.md` and ADRs 0001–0003 exist and match this spec
