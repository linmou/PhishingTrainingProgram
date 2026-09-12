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
| Identity | Inject an `AssessmentPrincipalVerifier` into the API handler. A deployment adapter derives `VerifiedPrincipal` from any real trusted session/capability and stored room authorization; tests inject a deterministic verifier. With no adapter, capability is disabled and mutations return `AUTHORIZATION_NOT_CONFIGURED`. | Original plan section 10.1 defines a narrow verifier interface without prescribing Supabase Auth and explicitly requires fail-closed deployment behavior. | Supabase Auth/bearer/`auth.uid()` contract rejected; new sign-in product rejected; body/local-state identity rejected. |
| Shared v3 context | Version and export the transfer request/context types and pure builders from existing `tutor-system/src/services/ecologicalTutorCall.ts`; production and component 104 Promptfoo adapters consume that same contract. The Edge Function alone adds the production prompt and provider settings/call. | The existing module is already the shared website/Promptfoo packaging boundary, while the source plan requires provider credentials and private generation to stay server-only. | Separate production and evaluation context shapes rejected; moving the production prompt or provider call into browser/eval code rejected. |
| Policy split | Keep `legacy_v1` room-scoped behavior and add explicit owner-scoped `transfer_v1` behavior. | Historical rows have no reliable owner and must retain their meaning. | Date-based conversion and global room checklist conversion rejected. |
| Progress authority | Reuse `status` and `understanding_level` with four validated transfer pairs. | U04/D08 require no parallel mastery field and the existing columns are the established progress contract. | New verification/mastery column rejected. |
| Public/private boundary | Store the assessment on the tutor message: options, key, lifecycle, and result are columns on `public.messages`. `private.learning_event_inbox` keeps the progress-event ledger. Key confidentiality is an accepted tradeoff: the message row is participant-readable, so the key can be read with a crafted request, while the API responses still strip it. |
| Delivery | Use versioned `send_reviewed_tutor_response_v3` after review revision and content confirmation. | A question becomes real only in one atomic reviewed-send transaction. | Direct message insert, draft-as-delivered, and room-level assessment mode rejected. |
| Evidence | Apply events through `apply_learning_event_v1` after stored message/source validation and current snapshot checks. | Evidence, progress, history, and idempotency must have one causal authority. | Separate client writes and model-emitted pass/fail rejected. |
| Concurrency | Use scoped row locks, the unique unresolved-question index, and stable dedupe keys. | Transport retries and teacher tabs must not create extra questions or grades. | Client-only dedupe and timestamp ordering rejected. |
| Provider budget | v3 tutor generation uses `max_tokens=1200`; evidence classification follows the source plan's 4,096-token setting when implemented. | The existing 120-token legacy cap cannot safely carry v3 JSON; learner-visible 80-word rendering is a separate limit. | Reusing legacy cap and silently truncating output rejected. |
| Provider retry | At most one automatic format-only repair retry; provider/network errors and truncation are surfaced separately. | The response contract requires bounded repair and preserves invalid attempts; no semantic resampling is authorized. | Unbounded retry, auto-pass/fail, and dummy response rejected. |
| Database boundary | Hosted Supabase execution is authoritative; Docker/local Postgres is unavailable. | Static SQL and client mocks cannot prove RLS, grants, locks, transaction rollback, or deployed compatibility. | Claiming local-only acceptance rejected. |
| Rollback | Disable new generation and delivery while preserving evidence; already delivered work is reconciled according to the source plan. | Rollback must be non-destructive and must not erase evidence or drop tables. | Destructive reset/drop and legacy reinterpretation rejected. |

## Source observations to verify

1. Migration 025 uses `auth.uid()` in several policies while migration 026 restores simplified-auth access for legacy rows. Neither is the transfer application identity contract; transfer operations remain behind the configured verifier plus trusted Edge Function and service-role-only RPCs.
2. The current `database.ts` represents transfer tables/enums but does not prove complete generated RPC signatures. It must be regenerated from the actual supported schema.
3. The current Edge Function sends `max_tokens=1200` for tutor preparation and a lower evidence-classifier budget. The final implementation must match the approved per-path budget and record provider finish/error metadata.
4. Existing unit/static migration tests cover pre-delivery and text patterns only. They cannot close hosted RLS, race, rollback, authorization, provider request, or secret-leakage gates.

## Deferred external prerequisites

The following are deployment prerequisites, not product decisions: a supported hosted Supabase project with a non-production test scope, a configured production `AssessmentPrincipalVerifier` adapter, service-role access for server execution, and server-side provider configuration. When the verifier adapter is absent, capability reports disabled with reason `AUTHORIZATION_NOT_CONFIGURED`, mutations return that error, and tests may proceed only through an injected verifier; no silent substitute is allowed.
