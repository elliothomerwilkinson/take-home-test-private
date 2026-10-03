# 03: Build and deliver the Transformed Notification email

Status: ready-for-agent
Blocked by: 01, 02
Spec: `.scratch/transformed-notification/spec.md` (sections "Email" and "Flow", steps 5–6)

## What

A module that builds the email, sends it with retries, and records the outcome. It is not called from `/ingest` yet.

## Tasks

- Add `src/notifications/transformed_notification.ts` containing:
  - `buildTransformedNotificationEmail({ applicationReference, transformedFormId, transformedAt })`, a pure function. `to` is `happyforms@bots.com`, `from` is `formbot@healthtech1.com`, the subject is `Form transformed: <ref>`, and the body has identifiers only.
  - `deliverTransformedNotification(db, sendEmail, notificationId, retryDelayMs)`. It loads the notification, calls `sendEmail` through `retryWithBackoff` with 3 attempts (a 200 is success; a non-200 or a thrown error is failure), then marks the row `sent` or `failed`.
- Export a `SendEmail` type, the same as `typeof sendEmail`.
- Add the repository functions moved here from ticket 02: `findTransformedNotification(db, id)` (including the Application Reference and the form's `created_at`), `markTransformedNotificationSent(db, id, attempts)` and `markTransformedNotificationFailed(db, id, attempts, error)`.

## Acceptance (write the tests first)

- [ ] Email builder: the recipient, sender and subject are correct, and the body contains the reference, the id and the ISO time. The body contains none of the name, email, DOB, phone or address values from `person_one.json`.
- [ ] Success → `sent`, `attempts = 1`, `sent_at` set.
- [ ] Failing twice then succeeding → `sent`, `attempts = 3`.
- [ ] Always returning 500 → `failed`, `attempts = 3`, error message stored.
- [ ] A throwing `sendEmail` is handled the same as a 500.
