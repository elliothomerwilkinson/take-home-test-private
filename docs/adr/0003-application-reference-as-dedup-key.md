# ADR-0003: `application_reference` is the deduplication key and is required

Status: accepted

## Context

The provider does not guarantee exactly-once delivery, and FORM-BOT must never receive the same form twice. `session_id` was considered as the key, but one session may produce several applications.

## Decision

- `application_reference` identifies a form. It is `NOT NULL UNIQUE` on `ingested_forms`, and `UNIQUE` on `transformed_forms` as a backstop.
- **Intentional decision:** `application_reference` is read from the raw body before schema validation. If it is missing or empty, the request is rejected with a 400 and **nothing is stored**. We treat the reference as a required key, and a form without one has no value to us, so it is not kept for retry. This is the only kind of malformed body that isn't stored as `invalid`.
- A delivery for a reference whose row is `transformed` or `received` gets a 409, even if its content differs. A delivery for a reference whose row is `invalid` or `failed` reprocesses that row.

## Consequences

- Deduplication is enforced by the database, so it holds even when deliveries arrive concurrently.
- Amended resubmissions under the same reference cannot be applied. This is accepted as a known limitation.
