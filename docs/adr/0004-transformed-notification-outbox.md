# ADR-0004: Record Transformed Notifications in the transform transaction and send them fire-and-forget

Status: accepted

## Context

The team must get a "guaranteed" email at happyforms@bots.com when a form is transformed. The email provider (`sendEmail`) takes about 1s and fails about 5% of the time. It accepts no idempotency key, so we cannot deliver the email exactly once. The transform is committed whatever happens to the email.

## Decision

- Add a `transformed_notifications` table with a `UNIQUE` foreign key to `transformed_forms`. A row is inserted with status `pending` inside the same transaction as the Transformed Form, so a transformed form always has exactly one recorded notification.
- After the commit, `/ingest` returns 201 straight away. Delivery runs fire-and-forget in the same process, with up to 3 attempts and exponential backoff. It uses the same retry helper as geocoding.
- The outcome is recorded on the row as `sent` or `failed`, along with `attempts` and the last `error`.
- There is no poller and no re-drive yet.

## Alternatives considered

- **Send inline before responding:** this adds about 1s to every ingest. It also lets an email failure affect a transform that has already been committed, and if the process dies the obligation is not recorded anywhere.
- **Outbox plus a poller (at-least-once):** this delivers automatically even after retries fail or a crash, but it needs claiming or leasing, unbounded retries and scheduling. We deferred it to keep things simple.

## Consequences

- Our guarantee is that a notification is never silently lost, not that it is always delivered. A `failed` row, or a `pending` row left behind by a crash, stays recorded until a future re-drive. With a 5% failure rate, all 3 attempts fail about 1 time in 8,000.
- A poller or a manual re-drive can be added later without changing the schema. It would select `pending` and `failed` rows. A poller would also need a lease so it does not pick up a row that is still being sent.
- The in-memory database (ADR-0001) loses unsent notifications when the process restarts.
- The email carries identifiers only, so there is no personal data in it.
