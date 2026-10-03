# 03: Transform from Ingested Form to Transformed Form

Status: ready-for-agent
Blocked by: 02
Spec: `.scratch/form-ingestion/spec.md` (section "Transform rules")

## What

A pure function, `transformForm(form: IngestedForm, coords: { longitude, latitude }): TransformedForm`, in its own module. Export the `TransformedFormSchema` type so other modules can use it.

## Rules

- `name` → `firstName` (every word except the last) and `lastName` (the last word). Example: `"Andy James Smith-Jones"` → `"Andy James"` / `"Smith-Jones"`.
- `gender: other` → `prefer-not-to-say`. `male` and `female` pass through unchanged.
- `date_of_birth` → a `Date` at UTC midnight. For example, `"1990-01-01"` → `new Date("1990-01-01T00:00:00.000Z")`.
- Flatten `address.*` into `addressLine1`, `addressLine2`, `addressLine3`, `postcode` and `country`.
- Rename all other fields from snake_case to camelCase. Coordinates come from the `coords` argument.

## Acceptance (write the tests first)

- [ ] Each of the three example payloads, parsed through the schema from 02, transforms to the expected object.
- [ ] There are tests for multi-word name splitting, every gender value, the UTC date conversion, and `address_line_3` being absent.
