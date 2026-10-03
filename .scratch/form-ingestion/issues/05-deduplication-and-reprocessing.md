# 05: Deduplication and reprocessing on `application_reference`

Status: ready-for-agent
Blocked by: 04
Spec: `.scratch/form-ingestion/spec.md` (section "Request flow", step 3), ADR-0003

## What

Handle repeat deliveries of the same `application_reference`.

## Tasks

- Before inserting, look up the existing row by `application_reference`.
  - If its status is `transformed` or `received`, return 409, even if the content differs.
  - If its status is `invalid` or `failed`, reuse the row: overwrite `raw_body`, set status `received`, increment `attempts`, refresh `updated_at`, then continue the normal flow.
- Treat a unique-constraint violation on insert, which means a concurrent delivery got there first, as a 409.

## Acceptance (write the tests first)

- [ ] Sending the same example twice gives 201 then 409, with exactly one row in each table.
- [ ] Changing the content but keeping the same reference after it was transformed gives a 409.
- [ ] An invalid delivery followed by a corrected one with the same reference gives 400 then 201, with one `ingested_forms` row, `attempts = 2` and status `transformed`.
- [ ] A delivery whose geocoding fails, followed by a resend once the geocoder succeeds, gives 503 then 201, with `attempts = 2`.
- [ ] A delivery whose row is still `received` gives a 409. Set this up by inserting the row directly through the repository.
- [ ] Two concurrent deliveries of the same reference give one 201 and one 409.
