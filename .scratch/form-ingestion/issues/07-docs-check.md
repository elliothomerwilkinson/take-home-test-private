# 07: Check documentation and finish

Status: ready-for-agent
Blocked by: 05, 06

## What

Make sure the documentation matches what was built.

## Tasks

- Check `CONTEXT.md` and `docs/adr/0001`–`0003` against the implementation. Update them wherever the build moved away from the spec, for example the `.sql` packaging or jest config changes from ticket 01.
- Add a short "Running" and "Design" section to `README.md` that points to `CONTEXT.md` and the ADRs.
- Run `npm run build` and `npm test`, and confirm both pass.

## Acceptance

- [ ] Every acceptance criterion in `spec.md` is met.
