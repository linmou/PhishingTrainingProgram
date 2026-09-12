# Documentation update record: transfer assessment review/send digest fix and hosted W3/W4 lane

Intent: record the 029 digest fix for the review-and-send path and the T009 hosted
verification lane, stating precisely what was executed and what still requires a
DDL-capable operator.

Date: 2026-09-12
Implementation commit ID: `__COMMIT__`

## Changed documents and artifacts

- `tutor-system/supabase/migrations/029_fix_review_send_digest_search_path.sql`:
  re-creates `review_assessment_draft_v1` and `send_reviewed_tutor_response_v3` with
  schema-qualified `extensions.digest(...)`. Both bodies are otherwise byte-identical
  to migration 025.
- `tutor-system/supabase/tests/transfer_assessment_backend.sql`: T009 lane. PART 1 is
  fifteen read-only catalog and source-hygiene checks that run under any role; PART 2
  documents the service_role-only behavioural RPC cases with their run recipe.

## Why the fix is needed

`pgcrypto` is installed in the `extensions` schema on the hosted project. Migrations
025 and 027 set `search_path = public, private` on their SECURITY DEFINER functions,
so an unqualified `digest(...)` call cannot resolve. Measured on the hosted project:
zero `digest` functions are visible under `search_path = public, private`, while
`extensions.digest(...)` resolves and returns a valid sha256. Migration 028 fixed the
draft trigger key; 029 fixes the two remaining callers, which sit on the tutor
review-and-send path rather than an edge case.

## Verification boundary

Executed and recorded: PART 1 of the T009 lane against the hosted project, thirteen of
fifteen checks passing, with the two failures naming exactly
`review_assessment_draft_v1` and `send_reviewed_tutor_response_v3` until 029 is
applied. Migration 029 could not be applied from this session because its connection
authenticates as `supabase_read_only_user`, which has no DDL rights and no EXECUTE on
the transfer RPCs.

Not executed, and therefore not claimed: PART 2's behavioural RPC cases, the Edge
Function deployment, and any end-to-end acceptance. Those require a service_role or
table-owner connection. The milestone ledger must not record W3/W4 as passed on the
strength of PART 1 alone.

## Follow-up owned by the operator

Apply migration 029, then re-run PART 1 (both digest checks must turn green) and run
PART 2 as service_role.
