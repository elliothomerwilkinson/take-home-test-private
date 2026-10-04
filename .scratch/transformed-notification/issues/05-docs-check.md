# 05: Check documentation and finish

Status: ready-for-agent
Blocked by: 04

## What

Make sure the documentation matches what was built.

## Tasks

- Check the **Transformed Notification** entry and the known limitations in `CONTEXT.md`, and `docs/adr/0004-transformed-notification-outbox.md`, against the implementation. Update them wherever the build moved away from the spec.
- Update the README's "Design" section: mention ADR-0004, and say that a 201 means a Transformed Notification has been recorded and is being sent.
- Run `npm run build` and `npm test`, and confirm both pass.

## Acceptance

- [x] Every acceptance criterion in `spec.md` is met.

## Comments

- `CONTEXT.md` and ADR-0004 already matched the implementation, so they are unchanged. The README's "Design" section now covers the notification and ADR-0004. The spec was updated so the email builder is internal and its content is tested through `deliverTransformedNotification`, as agreed in ticket 03.
