# ADR-0002: Store raw Ingested Forms separately from Transformed Forms

Status: accepted

## Context

The provider changes its schema without warning. Downstream steps such as geocoding fail intermittently. When something fails, we want to keep the data, ship a fix, and reprocess it.

## Decision

Use two tables:

- `ingested_forms` holds the raw body exactly as received, along with a `status`, an `error` and an `attempts` count.
- `transformed_forms` holds the validated, reshaped record and has a unique foreign key to `ingested_forms`.

Bodies that fail validation are still stored, with status `invalid`.

## Consequences

- A future `/retry` endpoint can reprocess rows that are `invalid` or `failed` without needing the provider to resend them.
- If the provider resends a form whose row is `invalid` or `failed`, the existing row is reprocessed.
- Unknown fields stripped by zod are still kept in `raw_body`.
