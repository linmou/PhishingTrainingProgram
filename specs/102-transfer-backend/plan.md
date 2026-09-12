# Implementation Plan: Server-Authoritative Transfer Assessment Backend

**Branch**: `102-transfer-backend` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/102-transfer-backend/spec.md`

## Summary

Complete the backend authority for transfer assessment across W3-W6: forward Supabase storage and RPCs, owner-scoped RLS, trusted principal and room authorization, causal evidence application, atomic/idempotent question lifecycle, and the production v3 provider boundary. Existing authored artifacts are the implementation baseline, not acceptance evidence. The plan therefore makes hosted schema execution, generated-type reconciliation, direct-write attacks, races, stale snapshots, immutable reviewed keys, causal history, provider request inspection, and secret scans explicit gates.

## Technical Context

**Language/Version**: TypeScript 4.9.5 for the React client facade; Deno TypeScript for the Supabase Edge Function; PostgreSQL SQL for migrations and RPCs  
**Primary Dependencies**: `@supabase/supabase-js` 2.39.x, Supabase Edge Functions, PostgreSQL `pgcrypto`, Jest/React Scripts for client-side backend-contract tests, supported hosted Supabase SQL execution  
**Storage**: Hosted Supabase PostgreSQL; `public` learner-safe tables, `private` server-only schema, RLS, SECURITY DEFINER RPCs restricted to the trusted service role  
**Testing**: Jest unit/contract tests; supported hosted Supabase integration/RLS/RPC tests; provider-boundary request inspection with a fake provider; TypeScript build/type checks; static secret scans  
**Target Platform**: Supabase Edge Function plus the existing browser client; transfer path is disabled unless a deployment-configured `AssessmentPrincipalVerifier` and server provider configuration are available  
**Project Type**: React web application with a Supabase backend boundary  
**Performance Goals**: One short database transaction for each delivery or state-changing event; transport retries must be idempotent; v3 tutor requests use `max_tokens=1200`; no open database transaction while waiting on the provider  
**Constraints**: No Docker/local Postgres acceptance; no new sign-in product; no `auth.uid()` as the application identity contract for simplified legacy behavior; no private key/rationale in public DTOs, realtime, logs, exports, or browser assets; no feature activation from this component  
**Scale/Scope**: One active transfer checklist per `(room_id, student_id)` and one unresolved delivered question per `(room_id, student_id)` in first release; legacy room-scoped checklists remain supported

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Before research | Design evidence | Result |
|---|---|---|---|
| Preserve requirements and evidence | Spec maps T09/FR-001..020 to backend artifacts and gates | `research.md`, `data-model.md`, `contracts/`, `tasks.md` preserve source SHA and evidence lanes | PASS |
| Keep authority server-side | Verified principal, private schema, allowlisted DTOs, server transitions, immutable key | Hosted RLS/RPC and authorization tests are required; browser identity remains untrusted | PASS |
| Test first and verify the real boundary | User explicitly requires backend tests and hosted Supabase evidence | Tasks put contract/integration/attack tests before implementation and prohibit Docker claims | PASS |
| Use stable explicit contracts | Versioned API envelope, DTOs, RPCs, state pairs, and provider request are documented | Contract files define inputs/results and error behavior | PASS |
| Prefer smallest coherent design | Reuses current migrations, RPC pattern, service facade, and existing progress fields | No new sign-in product, mastery field, room mode, or compatibility branch is introduced | PASS |
| Project constraints | Feature flag remains disabled; rollback preserves evidence | Integration-owner context update is deferred and no root AGENTS.md is edited | PASS |

## Existing Evidence And Ownership

The current branch already contains authored implementation artifacts from `ff21a7e` and a simplified-auth compatibility migration. They must be verified rather than treated as proof of deployment:

| Artifact | Current evidence | Planning consequence |
|---|---|---|
| `tutor-system/supabase/migrations/025_transfer_assessment_storage.sql` | Forward storage, private tables, RLS, immutable-key trigger, event/question RPCs, v3 send RPC authored | Reconcile against hosted schema and execute SQL/RLS/race/rollback checks |
| `tutor-system/supabase/migrations/026_fix_simplified_auth_compatibility.sql` | Legacy reviewed-send and legacy checklist access compatibility authored | Prove legacy preservation without weakening transfer-policy boundaries |
| `tutor-system/supabase/functions/assessment-api/index.ts` | API dispatch, a Supabase Auth-specific verifier, public allowlisting, provider requests, and v3 validation are currently authored | Replace the identity assumption with an injected verifier boundary; verify all operations, retry/error/truncation behavior, and provider request contents |
| `tutor-system/src/services/ecologicalTutorCall.ts` | Existing pure ecological packaging shared by product and Promptfoo | Extend it with the versioned transfer request/context contract consumed by production and component 104 without moving prompt or provider authority client-side |
| `tutor-system/src/services/transferAssessmentService.ts` | Browser facade and public assessment projection authored | Keep facade typed to public DTOs and stable envelopes; never add private fallback reads |
| `tutor-system/src/types/database.ts` | Transfer tables/enums and only part of the function surface represented | Regenerate from the supported hosted schema and document every difference |
| `tutor-system/src/services/__tests__/transferAssessmentMigration.test.ts` and `transferAssessmentService.test.ts` | Static migration checks and pre-delivery unit check exist | Add real hosted and API/provider evidence; static checks cannot close W3/W4/W6 |

The component does not edit React room UI, Promptfoo cases/rubrics, browser release artifacts, the integration worktree, `specs/orchestration`, or root `AGENTS.md`. Running `update-agent-context.sh` is deferred to the integration owner.

## Design

### Authority flow

```text
deployment-configured trusted session/capability
        |
        v
AssessmentPrincipalVerifier -> VerifiedPrincipal -> room/learner authorization
        |
        +--> prepare/review provider draft -> private draft/key material
        |
        +--> send RPC v3 -> public tutor message + public question + immutable key
        |
        +--> process learner message -> deterministic grade -> apply_learning_event_v1
                                      |
                                      +--> evidence + pair + actual history + idempotency
```

The Edge Function is the only boundary that combines a verified principal with service-role access. Its handler receives an `AssessmentPrincipalVerifier`; deployment wiring supplies a real trusted adapter and tests supply an injected verifier. No adapter means disabled capability and `AUTHORIZATION_NOT_CONFIGURED`, not an inferred Supabase Auth/`auth.uid()` contract. RPCs accept versioned inputs and actor/request IDs, but direct public execution is revoked. Public question/message DTOs are explicit projections. Legacy operations remain separate and continue to use their existing simplified identity path.

### Phase 0: Research decisions

`research.md` records the source-backed decisions, alternatives, and unresolved deployment prerequisites. No external product behavior is invented. The normative source is the original implementation plan with SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`; the reorganized plan package and current branch evidence are supporting inputs.

### Phase 1: Data model and contracts

`data-model.md` defines legacy versus transfer policy, public/private tables, causal links, draft suppression/supersession, lifecycle states, locks, dedupe keys, and invariants. `contracts/assessment-api.md`, `contracts/rpc-contract.md`, and `contracts/provider-contract.md` freeze the public envelope/DTO, versioned RPC inputs/results, verifier boundary, and production v3 provider request before implementation changes.

### W3: Storage, RLS, RPCs, and generated types

1. Inspect the supported hosted schema, migration history, enum values, overloads, grants, enabled policies, private schema exposure, and realtime publication before making forward changes.
2. Reconcile migrations 025/026 with the actual schema without rewriting 015/023/024 or dropping all policies/functions as a shortcut.
3. Verify owner-scoped transfer reads, no direct transfer writes, valid progress pairs, one active checklist, one unresolved question, private key immutability, and public/private separation.
4. Verify `apply_learning_event_v1`, reviewed send, and message processing for atomicity, actual before/after history, stale handling, race locking, Guard deferral, and rollback.
5. Regenerate `tutor-system/src/types/database.ts` from the supported schema, including every table, enum, RPC signature, and result shape; retain legacy types and record any unsupported generator gap.

### W4: Verified principal and authorization

1. Define `AssessmentPrincipalVerifier.verify(request): Promise<VerifiedPrincipal>` and inject it into the API handler. The deployment adapter may use any real trusted session/capability that resolves application user and stored room/session scope; tests inject a deterministic verifier. The contract does not require Supabase Auth, a bearer token, or `auth.uid()`.
2. Require teacher authority for checklist initialization, preparation, review, send, cancellation, invalidation, and external confirmation; require own-learner scope for learner messages and answer processing.
3. Test missing/forged/cross-room/cross-learner principals, private-column access, realtime/export/log/error leakage, direct table writes, and legacy-RPC bypasses at the hosted boundary.
4. When no deployment adapter is configured, return capability `{ enabled: false, reason: 'AUTHORIZATION_NOT_CONFIGURED' }`, return the 503 error for transfer operations, perform no mutation, and do not add a sign-in product.

### W5: Evidence application and lifecycle

1. Make the stored message/question link, immutable key, event dedupe key, current snapshot, source-message scope, and transition pair preconditions explicit.
2. Apply one trusted event transaction that writes evidence, status and understanding together, history with actual old/new values, and attempts only for scored or spontaneous events.
3. Record Guard deferral, stale and error outcomes, first-answer-wins races, and feedback linkage without rerunning old model calls.
4. Keep one unresolved question per learner as the structural guard, and treat a draft that is never sent as simply never delivered. No generation-trigger suppression exists: the product has no requirement to stop a tutor receiving a draft again.

### W6: Provider boundary and production prompt

1. Add versioned `TransferTutorRequestV3`/`TransferTutorRequestContextV3` types and pure request/context/user-message builders to existing `tutor-system/src/services/ecologicalTutorCall.ts`; both the Edge Function production path and component 104 Promptfoo adapter consume them. Keep `TRANSFER_V3_SYSTEM_PROMPT`, the evidence-classifier prompt, provider credentials, and provider calls in the trusted Edge Function.
2. Send the v3 tutor request with configured provider/model settings and `max_tokens=1200`; use the source plan's 4,096-token classifier budget where that path is implemented, and keep the existing 80-word learner rendering bound separate from completion tokens.
3. Allow one format-only repair retry (two attempts total), preserve both attempts and finish/error metadata privately, and never turn provider failure, truncation, or invalid JSON into a learner grade or dummy assessment.
4. Inspect requests and run secret scans over public DTOs, bundled client code, logs, exports, and errors.

## Verification Gates

| Gate | Component completion evidence | Cannot be substituted by |
|---|---|---|
| W3 | Hosted schema/RLS/RPC execution, legacy preservation, generated-type comparison, direct-write/race/rollback results | Static migration regex checks or local mocks |
| W4 | Authorization integration matrix with configured production verifier, plus injected-verifier tests and explicit missing-adapter blocker; privacy scans | UI hiding, local role values, Supabase Auth/`auth.uid()` assumptions, or injected verifier alone |
| W5 | Atomic lifecycle and causal-history integration results across stale/race/idempotency/Guard/invalidation paths | Unit reducer tests alone |
| W6 | Provider request/response inspection, 1,200-token assertion, bounded retry/error evidence, secret scan | A prompt string review or Promptfoo result |

The feature flag remains disabled. Downstream evaluation and browser release gates remain pending and are not claimed by this component.

## Project Structure

### Documentation (this feature)

```text
specs/102-transfer-backend/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
specs/102-transfer-backend/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── assessment-api.md
│   ├── provider-contract.md
│   └── rpc-contract.md
└── tasks.md

tutor-system/
├── supabase/
│   ├── migrations/025_transfer_assessment_storage.sql
│   ├── migrations/026_fix_simplified_auth_compatibility.sql
│   └── functions/assessment-api/index.ts
├── src/services/transferAssessmentService.ts
├── src/services/ecologicalTutorCall.ts
├── src/types/database.ts
└── src/services/__tests__/
    ├── transferAssessmentMigration.test.ts
    ├── transferAssessmentService.test.ts
    ├── transferAssessmentPersistence.integration.test.ts
    ├── assessmentAuthorization.integration.test.ts
    └── assessmentProviderBoundary.test.ts
```

**Structure Decision**: Keep the existing Supabase/TypeScript layout. Planning artifacts are isolated under the exact branch directory. SQL owns storage and transaction invariants; the Edge Function owns verifier injection, authorization, the production prompt, and provider access; `ecologicalTutorCall.ts` owns pure versioned request/context packaging shared with Promptfoo; the browser service owns only typed invocation and DTO projection; tests are split between pure contracts and supported hosted integration evidence.

## Complexity Tracking

No constitution violations require justification. The private schema, RPCs, and Edge Function are existing project boundaries required by the approved server-authority and secret-protection requirements, not speculative abstractions. No new sign-in system, persistence abstraction, progress field, or room mode is planned.
