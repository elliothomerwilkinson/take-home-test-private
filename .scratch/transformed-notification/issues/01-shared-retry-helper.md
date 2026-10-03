# 01: Extract a shared `retryWithBackoff` helper

Status: ready-for-agent
Blocked by: none
Spec: `.scratch/transformed-notification/spec.md` (section "Code structure")

## What

Move the retry loop out of `src/forms/geocode.ts` into a generic helper, so that geocoding and email delivery literally use the same mechanism.

## Tasks

- Add `src/retry.ts` exporting `retryWithBackoff`. It takes an attempt function that returns `{ ok: true, ... } | { ok: false, message }`, a `maxAttempts` and a `retryDelayMs`. It waits `retryDelayMs × 2^(n-1)` between attempts, and returns the last result plus the number of attempts made.
- Rewrite `geocodePostcode` to use it. `MAX_ATTEMPTS = 3` stays in geocode. `attemptGeocode` (which turns a non-200 or a thrown error into a failure) stays where it is.

## Acceptance (write the tests first)

- [ ] Unit tests for `retryWithBackoff`: success on the first call makes 1 attempt, failing twice then succeeding makes 3 attempts, and always failing makes exactly `maxAttempts` attempts and returns the last failure.
- [ ] The existing geocode and `/ingest` tests pass without changes.
