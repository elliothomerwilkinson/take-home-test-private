# 02: `transformed_notifications` table, created in the transform transaction

Status: ready-for-agent
Blocked by: none
Spec: `.scratch/transformed-notification/spec.md` (sections "Database" and "Flow", step 2)

## What

Record that a Transformed Notification is owed in the same transaction as the Transformed Form, so the two can never get out of step.

## Tasks

- Add `transformed_notifications` to `src/db/schema.sql` exactly as the spec defines it, including the `UNIQUE` foreign key and the `CHECK` on status.
- Inside `saveTransformedForm`'s transaction, insert a `pending` notification row. Return `{ transformedFormId, notificationId }` and update the caller in `src/app.ts`, which still returns `{ id: transformedFormId }`.
- Add repository functions:
  - `findTransformedNotification(db, id)`, which includes the Application Reference and the form's `created_at` that the email needs
  - `findTransformedNotificationByFormId(db, transformedFormId)`, for tests
  - `markTransformedNotificationSent(db, id, attempts)`
  - `markTransformedNotificationFailed(db, id, attempts, error)`

## Acceptance (write the tests first)

- [ ] A 201 ingest leaves exactly one `pending` notification row for the new Transformed Form. This is temporary: ticket 04 changes the expected status to `sent`.
- [ ] Invalid, geocode-failed and duplicate ingests leave no notification row.
- [ ] A resend after `invalid`/`failed` that then transforms creates exactly one notification.
