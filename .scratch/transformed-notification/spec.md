# Spec: Transformed Notification email

Status: ready-for-agent

## Problem

The brief says: "If the transform is successful, we should send a guaranteed email to our team happyforms@bots.com that a form was ingested". Today, nothing is sent when a form becomes a **Transformed Form**. The email provider (`sendEmail` in `src/providers/sendgrid.ts`) takes about 1s and returns a 500 about 5% of the time.

See `CONTEXT.md` for **Transformed Notification** and its states, and `docs/adr/0004-transformed-notification-outbox.md` for the reasons behind this design.

## What "guaranteed" means here

A Transformed Notification is **never silently lost**. It is recorded in the same transaction as its Transformed Form, and its delivery state is always stored. Delivery is attempted straight away with up to 3 attempts. If every attempt fails, the notification stays `failed` until a future re-drive. With a 5% failure rate, that happens about 1 time in 8,000. Sending never changes the `/ingest` response.

## Scope

In scope:

- A `transformed_notifications` table, with a row inserted inside the `saveTransformedForm` transaction
- Fire-and-forget delivery after the transform commits, with 3 attempts and exponential backoff
- Moving the retry loop out of `geocode.ts` into a shared helper that geocoding and email both use
- Recording the outcome (`sent` or `failed`, `attempts`, `error`, `sent_at`)

Out of scope:

- A poller, automatic re-drive, or a manual re-drive endpoint for `failed` or stale `pending` rows
- Leasing or claiming rows. Each row has only one sender for now.
- A persistent database (ADR-0001 stays as it is)
- Digest emails

## Flow

1. `/ingest` validates and geocodes as it does today.
2. `saveTransformedForm` inserts the `transformed_forms` row and the `transformed_notifications` row (status `pending`), and sets `ingested_forms.status = 'transformed'`, all in **one transaction**.
3. `/ingest` responds **201** at once, without waiting for the email.
4. Without awaiting, the app calls `deliverTransformedNotification(...)` for the new notification. The call has a `.catch` that logs, so it can never become an unhandled rejection.
5. Delivery calls `sendEmail` through `retryWithBackoff`, with at most 3 attempts and delays of `emailRetryDelayMs`, then ×2. A send succeeds only on status 200. A non-200 or a thrown error counts as a failure.
6. When the retries settle, the row is updated:
   - Success: `status = 'sent'`, `sent_at = now()`, `attempts = n`
   - Failure: `status = 'failed'`, `attempts = 3`, `error = { message }`

Invalid, failed (geocoding), duplicate (409) and rejected (400) ingests never create a notification.

## Email

| Field | Value |
|---|---|
| `to` | `happyforms@bots.com` |
| `from` | `formbot@healthtech1.com`, a single constant |
| `subject` | `Form transformed: <application_reference>` |
| `body` | Application Reference, Transformed Form id and transformed-at time (`transformed_forms.created_at`, ISO 8601). **No personal data**: no name, email, DOB, phone or address. |

## Database

### `transformed_notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `transformed_form_id` | `uuid NOT NULL UNIQUE` FK → `transformed_forms.id` | Exactly one per Transformed Form |
| `status` | `text NOT NULL DEFAULT 'pending'` | `CHECK (status IN ('pending','sent','failed'))` |
| `attempts` | `int NOT NULL DEFAULT 0` | The number of `sendEmail` calls made |
| `error` | `jsonb NULL` | The last failure message |
| `sent_at` | `timestamptz NULL` | |
| `created_at`, `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

## Code structure

- `src/retry.ts`: a generic `retryWithBackoff<T>(attempt: () => Promise<Result<T>>, maxAttempts, retryDelayMs)`. It returns the last result and the number of attempts made. `geocodePostcode` is rewritten to use it, with no change in behaviour.
- `src/notifications/transformed_notification.ts`:
  - `buildTransformedNotificationEmail(...)`, a pure function
  - `deliverTransformedNotification(db, sendEmail, notificationId, retryDelayMs)`, which loads the notification and its form, sends the email with retries, and records the outcome
- `src/db/forms_repository.ts` (or a sibling `notifications_repository.ts`) holds all the SQL. `saveTransformedForm` returns both the transformed form id and the notification id.
- `createApp` gains `sendEmail: SendEmail` (the type of the provider's `sendEmail`) and `emailRetryDelayMs?: number`, which defaults to 200 and is separate from `geocodeRetryDelayMs`.
- `src/index.ts` passes in the real `sendEmail`.

## Testing (written test-first)

- **`retryWithBackoff` unit tests:**
  - Success on the first call makes 1 attempt.
  - Failing twice then succeeding makes 3 attempts.
  - Always failing makes exactly 3 attempts and returns the last failure.
  - The existing geocode tests must still pass without changes.
- **Email builder unit tests:** the recipient, sender and subject are correct, and the body contains the reference, the id and the time, but none of the PII fields from the example payloads.
- **`deliverTransformedNotification` unit tests** (stubbed `sendEmail`, delay 0, awaited):
  - Success → `sent`, `attempts = 1`, `sent_at` set
  - Failing twice then succeeding → `sent`, `attempts = 3`
  - Always returning 500 → `failed`, `attempts = 3`, error stored
  - A throwing stub is handled the same as a 500
- **Integration tests** (`/ingest`, with `sendEmail` injected):
  - A 201 creates exactly one notification row for that Transformed Form, and the row reaches `sent` (use a small `waitFor` helper that polls the database).
  - A `sendEmail` that always fails still gives a 201, and the row reaches `failed`.
  - A `sendEmail` that never resolves still gives a 201 right away, which proves delivery isn't awaited.
  - Invalid, geocode-failed and duplicate ingests create no notification row.
  - A resend after `invalid`/`failed` that then transforms creates exactly one notification.

## Acceptance criteria

- [ ] Every scenario in the testing section passes under `npm test`
- [ ] `npm run build` type-checks cleanly
- [ ] `CONTEXT.md`, ADR-0004 and the README match the implementation
