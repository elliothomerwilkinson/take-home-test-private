# 04: Send the Transformed Notification fire-and-forget from `/ingest`

Status: ready-for-agent
Blocked by: 03
Spec: `.scratch/transformed-notification/spec.md` (sections "Flow", steps 3–4, and "Code structure")

## What

Connect delivery to `/ingest` so the team is emailed after each successful transform, without the email ever affecting the response.

## Tasks

- Add `sendEmail: SendEmail` and `emailRetryDelayMs?: number` (default 200) to `AppDeps`.
- After `saveTransformedForm` succeeds, send the 201, then call `deliverTransformedNotification(...)` **without awaiting it**. Attach a `.catch` that logs the error along with the notification id.
- Wire the real `sendEmail` into `src/index.ts`.
- Pass a succeeding `sendEmail` stub and `emailRetryDelayMs: 0` in the existing `/ingest` tests.
- Add a small `waitFor` test helper that polls a condition with a short timeout.

## Acceptance (write the tests first)

- [ ] A 201 ingest creates a notification that reaches `sent`, and `sendEmail` is called once with the expected subject.
- [ ] A `sendEmail` that always fails still gives a 201, and the notification reaches `failed`.
- [ ] A `sendEmail` that never resolves still gives a 201, which proves delivery isn't awaited.
- [ ] The test from ticket 02 now expects `sent` instead of `pending`.
- [ ] Invalid, geocode-failed and duplicate ingests never call `sendEmail`.

## Comments

- Implemented. As agreed before starting, the `ingest()` test helper defaults to a `sendEmail` that never resolves. Tests that don't care about email therefore leave delivery pending, and it never writes to the database after `afterEach` closes it. Notification tests pass their own stub and wait for the row to settle with a local `waitFor`. The `.catch` that logs is deliberately untested glue. The test "records one pending notification" from ticket 02 became "emails the team once and marks the notification sent". The resend test now asserts only that the row exists, because its status races with background delivery.
- The no-wait test was mutation-checked: making the route `await` delivery causes it to time out.
