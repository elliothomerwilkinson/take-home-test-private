# 02: Zod schema for Ingested Forms

Status: ready-for-agent
Blocked by: none
Spec: `.scratch/form-ingestion/spec.md` (section "Validation rules")

## What

A pure module, `src/forms/schemas/ingested_schema.ts`, holding a zod schema that replaces the hand-written `IngestedFormSchema` type. The type itself becomes `z.infer<typeof ingestedFormSchema>`. This module has no database or HTTP code.

## Rules (from the spec)

- `session_id`: UUID. `email`: valid email.
- `date_of_birth`: strict `YYYY-MM-DD`, a real calendar date (so `2023-02-30` fails), not in the future.
- `name`: at least two words once trimmed. Single-word names are rejected with a clear message.
- `gender`: `male` | `female` | `other`.
- Required strings must be non-empty after trimming. Phone numbers, mobile numbers and `application_reference` are not format-checked.
- Optional fields (`phone_number`, `address.address_line_3`) that are missing, `null` or `""` become `undefined`.
- Trim all strings and apply no other normalisation.
- Strip unknown keys (zod's default).

## Acceptance (write the tests first)

- [ ] All three files in `src/forms/examples/*.json` parse successfully.
- [ ] Each rule above has at least one test that fails when the rule is broken.
- [ ] A test with an extra unknown key shows that it parses and that the key is stripped.
- [ ] A test shows that a `null` optional field becomes `undefined`.
