# 01: Database setup and `createApp` factory

Status: ready-for-agent
Blocked by: none
Spec: `.scratch/form-ingestion/spec.md` (sections "Database" and "Code structure")

## What

Prepare the ground work: an in-memory PGlite database with the agreed schema, and an app that receives its dependencies as arguments so tests can supply their own.

## Tasks

- `npm install zod @electric-sql/pglite`
- Write `src/db/schema.sql` containing both tables exactly as the spec defines them: `ingested_forms` and `transformed_forms`, with the `CHECK`, `UNIQUE` and foreign-key constraints.
- Add `src/db/index.ts` exporting `createDb(): Promise<PGlite>`. It creates an in-memory instance and applies the schema.
- Change `src/app.ts` so it exports `createApp({ db, geocode })`. `geocode` has the same signature as `lookupPostcode`. Keep the `/ingest` stub for now.
- Update `src/index.ts` to call `createDb()` and `createApp({ db, geocode: lookupPostcode })`.
- Update `tests/app.test.ts` to use `createApp`.

## Notes and risks

- `tsc` does not copy `.sql` files into `dist/`. Resolve this in one of two ways: read the file relative to the project root, or add a copy step to `build`. Make sure `npm run build && npm start` works.
- PGlite loads WASM. Confirm that it runs under the current `ts-jest` setup, which compiles to CommonJS. If it doesn't, fix the jest config and record the change here under `## Comments`.

## Acceptance

- [ ] A test proves `createDb()` applies the schema: insert into both tables, then check that a duplicate `application_reference` and an invalid `status` value are each rejected.
- [ ] The existing `/ingest` test passes through `createApp`.
- [ ] `npm run build` and `npm test` both pass.

## Comments

- Both risks happened and are resolved. `npm test` now runs Jest with `NODE_OPTIONS=--experimental-vm-modules`, because PGlite needs dynamic `import()`. `npm run build` copies `schema.sql` into `dist/src/db/`, and `start`/`main` now point to `dist/src/index.js`. Jest's `roots` is limited to `tests/` so it doesn't pick up compiled tests in `dist/`.
- As agreed, there is no separate schema-constraint test. The constraints are covered through `POST /ingest`.
