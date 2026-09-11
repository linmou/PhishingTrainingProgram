# Research: Server-Authoritative Transfer Assessment Backend

**Intent**: Record source-backed design decisions for W3-W6 before implementation tasks are executed. The original handoff remains normative.

## Baseline

- Original plan: `plan/transfer_assessment_implementation_plan.md`
- Preserved SHA-256: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`
- Current authored implementation commit: `ff21a7e` (the branch head also contains the Spec Kit initialization commit)
- Hosted acceptance status: pending; static migration checks are not database execution evidence.

## Decisions

| Topic | Decision | Rationale | Alternatives considered |
|---|---|---|---|
| Identity | Use a trusted bearer verifier to derive `VerifiedPrincipal`; map it to the existing application user and room/session authorization. | The source plan requires a real verified principal and explicitly rejects local names, roles, UUIDs, room passwords, and browser storage as authorization. | New sign-in product rejected; body-supplied IDs rejected; direct `auth.uid()` contract rejected for simplified legacy behavior. |
| Policy split | Keep `legacy_v1` room-scoped behavior and add explicit owner-scoped `transfer_v1` behavior. | Historical rows have no reliable owner and must retain their meaning. | Date-based conversion and global room checklist conversion rejected. |
| Progress authority | Reuse `status` and `understanding_level` with four validated transfer pairs. | U04/D08 require no parallel mastery field and the existing columns are the established progress contract. | New verification/mastery column rejected. |
| Public/private boundary | Store public questions in `public.assessment_questions`; store drafts, keys, transfer basis, raw output, and idempotency state in `private`. | Learner DTOs must exclude private material, and hidden UI fields do not protect data. | Public row with hidden columns rejected; client-side key hashing rejected for a four-option key space. |
| Delivery | Use versioned `send_reviewed_tutor_response_v3` after review revision/hash/content confirmation. | A question becomes real only in one atomic reviewed-send transaction. | Direct message insert, draft-as-delivered, and room-level assessment mode rejected. |
| Evidence | Apply events through `apply_learning_event_v1` after stored message/source validation and current snapshot checks. | Evidence, progress, history, and idempotency must have one causal authority. | Separate client writes and model-emitted pass/fail rejected. |
| Concurrency | Use scoped row locks, unique unresolved-question index, stable dedupe keys, and request-result records. | Transport retries and teacher tabs must not create extra questions or grades. | Client-only dedupe and timestamp ordering rejected. |
| Provider budget | v3 tutor generation uses `max_tokens=1200`; evidence classification follows the source plan's 4,096-token setting when implemented. | The existing 120-token legacy cap cannot safely carry v3 JSON; learner-visible 80-word rendering is a separate limit. | Reusing legacy cap and silently truncating output rejected. |
| Provider retry | At most one automatic format-only repair retry; provider/network errors and truncation are surfaced separately. | The response contract requires bounded repair and preserves invalid attempts; no semantic resampling is authorized. | Unbounded retry, auto-pass/fail, and dummy response rejected. |
| Database boundary | Hosted Supabase execution is authoritative; Docker/local Postgres is unavailable. | Static SQL and client mocks cannot prove RLS, grants, locks, transaction rollback, or deployed compatibility. | Claiming local-only acceptance rejected. |
| Rollback | Disable new generation/delivery while preserving evidence; safely resolve or cancel already delivered work according to the source plan. | Rollback must be non-destructive and must not erase evidence or drop tables. | Destructive reset/drop and legacy reinterpretation rejected. |

## Source observations to verify

1. Migration 025 uses `auth.uid()` in several policies while migration 026 restores simplified-auth access for legacy rows. The transfer path must remain behind the trusted Edge Function and service-role-only transfer RPCs.
2. The current `database.ts` represents transfer tables/enums but does not prove complete generated RPC signatures. It must be regenerated from the actual supported schema.
3. The current Edge Function sends `max_tokens=1200` for tutor preparation and a lower evidence-classifier budget. The final implementation must match the approved per-path budget and record provider finish/error metadata.
4. Existing unit/static migration tests cover pre-delivery and text patterns only. They cannot close hosted RLS, race, rollback, authorization, provider request, or secret-leakage gates.

## Deferred external prerequisites

The following are deployment prerequisites, not product decisions: a supported hosted Supabase project with a non-production test scope, a trusted verifier configuration, service-role access for server execution, and server-side provider configuration. When absent, the affected gate is blocked and the feature remains disabled; no silent substitute is allowed.
