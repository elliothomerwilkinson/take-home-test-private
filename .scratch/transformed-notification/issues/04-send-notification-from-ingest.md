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
