# ADR-0001: PGlite as an in-memory database

Status: accepted

## Context

We need a lightweight database that adds no infrastructure. The brief also asks for "an actual database" so that the schema design can be assessed.

## Decision

Use PGlite (`@electric-sql/pglite`), which runs Postgres in-process and in memory. Access it with raw SQL from a single `schema.sql` and a small repository module. Don't use an ORM or query builder.

## Consequences

- We get real Postgres features: `jsonb`, `timestamptz`, `uuid`, `CHECK` constraints, `UNIQUE` constraints and transactions.
- Tests can create a fresh database per test with no external services.
- Data does not survive a restart. That is acceptable for now. PGlite can save to a directory later if needed.
- PGlite loads its WASM through a dynamic `import()`. Jest's VM can only run that with `--experimental-vm-modules`, so `npm test` sets that flag in `NODE_OPTIONS`.
- `tsc` does not copy `src/db/schema.sql` into `dist/`, so `npm run build` copies it there afterwards.
- Alternatives considered: `better-sqlite3`, which is lighter but has weaker types, and a plain JS store, which has no schema to show.
