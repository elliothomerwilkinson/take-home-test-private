# Context: Form ingestion

## Glossary

- **Ingested Form**: A registration form as delivered by the third-party provider to `POST /ingest`, shaped like `IngestedFormSchema`. Stored as-is in `ingested_forms.raw_body`.
- **Transformed Form**: An Ingested Form after it has been validated, geocoded and reshaped into `TransformedFormSchema`. Stored in `transformed_forms`. This is what FORM-BOT consumes.
- **Application Reference**: `application_reference`, for example `GRU-123089-2026`. This is the identity of a form and the deduplication key. A form without one has no value and is rejected without being stored.
- **Session ID**: `session_id`. Identifies the user's session with the provider. It is **not** an identity for a form, because one session may produce several applications.
- **Status**: The lifecycle state of an Ingested Form:
  - `received`: stored and currently being processed
  - `invalid`: failed schema validation. It can be reprocessed by a resend or by a future `/retry`.
  - `failed`: valid, but a downstream step such as geocoding failed. It can be reprocessed.
  - `transformed`: a Transformed Form exists. This status is final.

## Rules

- A form is never transformed twice. Deliveries for a reference that is `transformed` or `received` are rejected with a 409, even if the content differs.
- Unknown fields from the provider are stripped before the transform but kept in `raw_body`.
- All strings are trimmed. No other normalisation is applied.

## Known lossy mappings

- **Gender:** `other` maps to `prefer-not-to-say`. These mean different things, but `prefer-not-to-say` is the only target value available. This should be raised with the FORM-BOT owners.
- **Name:** `name` is split into `firstName` (every word except the last) and `lastName` (the last word). Single-word names are rejected instead of being given an empty `lastName`.

## Known limitations

- Amended resubmissions of an already-transformed form are rejected, not applied.
- The database is in memory, so all data is lost when the process restarts.
