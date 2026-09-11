# Tasks: Server-Authoritative Transfer Assessment Backend

**Input**: Design documents from `/specs/102-transfer-backend/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

**Scope**: W3 storage/RLS/RPCs, W4 trusted authorization, W5 evidence application/lifecycle, and W6 production v3 provider boundary. React room UI, Promptfoo cases/rubrics, and browser release evidence are downstream exclusions.

**Test rule**: New backend tests begin with a short file-purpose comment and cover negative, race, stale, rollback, privacy, and legacy cases. Hosted database tests are required for database claims; static migration checks and client mocks are diagnostic only.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the implementation and evidence boundaries without changing production behavior.

- [ ] T001 Record the starting commit, clean/dirty status, and preserved source-plan SHA in `specs/102-transfer-backend/quickstart.md` evidence notes.
- [ ] T002 [P] Reconcile the current migration order, hosted migration status, enum values, function overloads, grants, RLS policies, private schema exposure, and realtime publication using `tutor-system/supabase/migrations/025_transfer_assessment_storage.sql` and `tutor-system/supabase/migrations/026_fix_simplified_auth_compatibility.sql` as authored inputs.
- [ ] T003 [P] Freeze the operation/envelope/DTO and RPC/provider contracts in `specs/102-transfer-backend/contracts/assessment-api.md`, `specs/102-transfer-backend/contracts/rpc-contract.md`, and `specs/102-transfer-backend/contracts/provider-contract.md` before production code changes.
- [ ] T004 [P] Confirm the existing server-only provider configuration names in `tutor-system/.env.example` and record missing hosted verifier/provider prerequisites without adding secrets or fallback identity behavior.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make the shared schema, type, and contract test seams ready before user-story implementation.

**Checkpoint**: No story implementation is accepted until the supported hosted schema and generated types are reconciled.

- [ ] T005 [P] Add `tutor-system/src/services/__tests__/transferAssessmentApiContract.test.ts` with a shebang and beginning purpose comment; test the `{ok,data}`/`{ok,error}` envelope, operation allowlist, stable error codes, and public DTO denylist.
- [ ] T006 [P] Add `tutor-system/supabase/functions/assessment-api/index.test.ts` with a shebang and beginning purpose comment; test operation dispatch, bearer verification, public projection, and safe error responses.
- [ ] T007 Regenerate `tutor-system/src/types/database.ts` from the supported hosted schema, including all transfer tables, enums, function arguments, and function results; document every generator or deployment difference in `specs/102-transfer-backend/quickstart.md`.
- [ ] T008 Update the shared TypeScript contract usage in `tutor-system/src/services/transferAssessmentService.ts` to match the regenerated database/API contracts without adding private-row fallback reads.
- [ ] T009 Add `tutor-system/supabase/tests/transfer_assessment_backend.sql` with a beginning purpose comment for disposable W3/W4/W5 schema and RLS checks.

## Phase 3: User Story 1 - Deliver A Reviewed Assessment Safely (Priority: P1)

**Goal**: Produce one explicitly reviewed public assessment while keeping draft/key/basis material private and preserving the tutoring room state.

**Independent Test**: An authorized teacher can prepare, review, send, retry, and inspect one assessment; unsent/stale drafts cannot be graded and no learner DTO contains private fields.

### Tests for User Story 1

- [ ] T010 [P] [US1] Add `tutor-system/src/services/__tests__/transferAssessmentPersistence.integration.test.ts` with a shebang and beginning purpose comment; test prepare/review/send success, draft revision conflict, dirty reconfirmation, one-unresolved-question conflict, and atomic delivery rollback.
- [ ] T011 [P] [US1] Add service cases with a beginning purpose comment for public assessment projection, envelope failures, request IDs, and rejection of private key/transfer-basis fields in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts`.

### Implementation for User Story 1

- [ ] T012 Update `tutor-system/supabase/migrations/025_transfer_assessment_storage.sql` to make `send_reviewed_tutor_response_v3` validate actor/room/checklist/item scope, expected revision/hash, content confirmation, current snapshot, and the unique unresolved-question constraint in one transaction.
- [ ] T013 Update `tutor-system/supabase/functions/assessment-api/index.ts` to return an authorized teacher draft result only to the verified reviewer and to route `review_draft`/`send_reviewed` through the versioned RPCs with stable envelope errors.
- [ ] T014 Update `tutor-system/src/services/transferAssessmentService.ts` to expose typed capabilities, draft, review, send, and public-question results while projecting no `correct_option_ids`, transfer basis, raw model output, or private rationale.
- [ ] T015 Verify `tutor-system/src/types/database.ts` contains the exact `send_reviewed_tutor_response_v3` inputs/results and the public/private table types used by `tutor-system/src/services/transferAssessmentService.ts`.

**Checkpoint**: Delivery is atomic, teacher-reviewed, public-safe, and remains `tutoring` at room participation level.

## Phase 4: User Story 2 - Resolve A Learner Answer Exactly Once (Priority: P1)

**Goal**: Grade only a stored answer to a delivered question and apply one deterministic progress outcome.

**Independent Test**: Hosted execution proves pre-delivery, exact single/multiple selection, clarification, assistance, duplicate, stale, cross-question, and first-answer-wins behavior.

### Tests for User Story 2

- [ ] T016 [P] [US2] Add lifecycle cases with a beginning purpose comment for pre-delivery no-op, correct-with-reason, exact-set multiple answers, ambiguous alternatives, format clarification, assisted cancellation, stale question, and closed-question handling in `tutor-system/src/services/__tests__/transferAssessmentPersistence.integration.test.ts`.
- [ ] T017 [P] [US2] Extend the answer facade cases with a beginning purpose comment for public result DTOs, stable retry outcomes, and no client-side grading of unsent questions in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts`.

### Implementation for User Story 2

- [ ] T018 Update `tutor-system/supabase/migrations/025_transfer_assessment_storage.sql` so `process_assessment_message_v1` loads the stored authored learner message, verifies its question link and scope, uses the immutable key exactly once, and records clarification/assisted outcomes without inventing a grade.
- [ ] T019 Update `tutor-system/supabase/functions/assessment-api/index.ts` and `tutor-system/src/services/transferAssessmentService.ts` to keep answer processing server-authoritative and return only safe question/result/transition data.
- [ ] T020 Verify the transfer answer path in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts` does not inspect or grade a private key in browser code and that exact grading remains deterministic in the trusted path.

**Checkpoint**: Every question resolves at most once; learner explanation/confidence is not required; answer errors never mutate progress.

## Phase 5: User Story 3 - Enforce Trusted Identity And Privacy (Priority: P1)

**Goal**: Enforce verified principal, room authorization, owner scope, private schema access, and legacy-RPC separation.

**Independent Test**: Hosted authorization execution rejects every attack matrix case and leaves no mutation or private data exposure.

### Tests for User Story 3

- [ ] T021 [P] [US3] Add `tutor-system/src/services/__tests__/assessmentAuthorization.integration.test.ts` with a shebang and beginning purpose comment; test missing/invalid bearer, forged body IDs, cross-room/cross-learner access, learner-versus-teacher operations, private-column reads, and safe error envelopes.
- [ ] T022 [P] [US3] Extend `tutor-system/supabase/tests/transfer_assessment_backend.sql` with direct table writes, transfer-policy RLS reads, private schema access, old public `SECURITY DEFINER` RPC bypasses, and legacy-policy compatibility assertions.
- [ ] T023 [P] [US3] Add a source/privacy scan with a beginning purpose comment for public DTOs, Edge Function responses, browser bundle inputs, logs, exports, and error text in `tutor-system/src/services/__tests__/assessmentAuthorization.integration.test.ts`.

### Implementation for User Story 3

- [ ] T024 Update `tutor-system/supabase/functions/assessment-api/index.ts` so `verifyAssessmentPrincipal` derives application identity from a trusted bearer verifier, resolves room/session authorization server-side, and returns `AUTHORIZATION_NOT_CONFIGURED` when required verifier configuration is absent.
- [ ] T025 Update `tutor-system/supabase/migrations/025_transfer_assessment_storage.sql` and `tutor-system/supabase/migrations/026_fix_simplified_auth_compatibility.sql` so legacy compatibility does not grant direct transfer-policy writes, key reads, or transfer RPC execution.
- [ ] T026 Verify `tutor-system/src/services/transferAssessmentService.ts` and `tutor-system/supabase/functions/assessment-api/index.ts` never accept a caller-supplied principal, role, student ID, room authorization, provider credential, or private DTO as authoritative.

**Checkpoint**: W4 passes only with a real trusted verifier or an explicit recorded deployment blocker; no new sign-in product is introduced.

## Phase 6: User Story 4 - Apply Evidence And Lifecycle Atomically (Priority: P2)

**Goal**: Preserve causal evidence, actual history, idempotency, Guard deferral, race behavior, stale rejection, and invalidation rollback.

**Independent Test**: Hosted SQL/RPC execution passes the complete transition and failure matrix with no partial writes.

### Tests for User Story 4

- [ ] T027 [P] [US4] Add hosted integration cases with a beginning purpose comment for all progress-pair/event cells, actual before/after history, source-message scope, missing evidence, invalid transitions, duplicate events, stale snapshots, and rollback in `tutor-system/src/services/__tests__/transferAssessmentPersistence.integration.test.ts`.
- [ ] T028 [P] [US4] Add hosted concurrency cases with a beginning purpose comment for two teacher sends, two learner answers, request retries, duplicate realtime ingestion, Guard deferral/replay, and first-answer-wins behavior in `tutor-system/src/services/__tests__/transferAssessmentPersistence.integration.test.ts`.
- [ ] T029 [P] [US4] Add invalidation cases with a beginning purpose comment for immutable-key invalidation, latest-grade compensation, later-independent verification, and no old-model reclassification in `tutor-system/src/services/__tests__/transferAssessmentPersistence.integration.test.ts`.

### Implementation for User Story 4

- [ ] T030 Update `tutor-system/supabase/migrations/025_transfer_assessment_storage.sql` so `apply_learning_event_v1` validates causal evidence, locks room/checklist/item/question in order, records deferred/rejected/error states, writes evidence/pair/history/idempotency atomically, and preserves actual old/new values.
- [ ] T031 Update `tutor-system/supabase/migrations/025_transfer_assessment_storage.sql` so cancellation, Guard recovery, stale snapshot rejection, and post-grade invalidation preserve the original key/result and use compensating or replayed history without destructive overwrite.
- [ ] T032 Verify `tutor-system/src/types/database.ts` and `tutor-system/src/services/transferAssessmentService.ts` expose only the safe event/transition outcomes needed by the application and do not create a second progress authority.

**Checkpoint**: W5 is closed only by supported hosted transaction/race evidence; reducer or static SQL tests alone are insufficient.

## Phase 7: User Story 5 - Use The Production v3 Provider Boundary (Priority: P2)

**Goal**: Make the trusted v3 provider request inspectable, bounded, secret-safe, and fail closed.

**Independent Test**: A controlled fake provider captures valid, repaired, truncated, invalid, unavailable, HTTP-failure, and network-failure paths with exact request assertions.

### Tests for User Story 5

- [ ] T033 [P] [US5] Add provider request tests to `tutor-system/src/services/__tests__/assessmentProviderBoundary.test.ts` with a shebang and beginning purpose comment; assert endpoint/model selection, `max_tokens=1200`, stable evidence IDs, absence of answer labels/keys, JSON mode, and effective settings.
- [ ] T034 [P] [US5] Add provider failure tests to `tutor-system/src/services/__tests__/assessmentProviderBoundary.test.ts` with a shebang and beginning purpose comment; cover one format-repair retry, second invalid output, truncation, HTTP/network failure, missing configuration, retryability, and zero progress mutation.
- [ ] T035 [P] [US5] Extend `tutor-system/supabase/functions/assessment-api/index.test.ts` with a beginning purpose comment for `TRANSFER_V3_SYSTEM_PROMPT`, evidence-classifier output restrictions, private attempt storage, and safe error projection.

### Implementation for User Story 5

- [ ] T036 Update `tutor-system/supabase/functions/assessment-api/index.ts` to keep the production v3 prompt and provider credential access server-side, send the approved v3 budget, inspect finish/truncation metadata, and preserve request/error attempts privately.
- [ ] T037 Update `tutor-system/supabase/functions/assessment-api/index.ts` to implement at most one format-only repair retry and to distinguish provider/network errors from invalid output without auto-pass, auto-fail, dummy questions, or progress writes.
- [ ] T038 Update `tutor-system/src/services/transferAssessmentService.ts` and `tutor-system/src/types/database.ts` to expose only provider-safe retry/error envelopes and no credential/private generation fields.
- [ ] T039 Review `tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md` and `tutor-system/claude_docs/ai-behaviors/tutor-behavior-specification.md` against the frozen provider/API contracts; update only if the shared public contract has drifted, with a dated documentation record.

**Checkpoint**: W6 is evidenced by captured requests/responses and secret scans, not by reading the prompt source.

## Phase 8: Polish And Cross-Cutting Verification

**Purpose**: Reconcile evidence, preserve disabled activation, and hand off cleanly.

- [ ] T040 Run the exact focused backend Jest suites and TypeScript production build from `specs/102-transfer-backend/quickstart.md`, recording counts and exit statuses.
- [ ] T041 Compare `tutor-system/src/types/database.ts` with the hosted schema and `specs/102-transfer-backend/contracts/rpc-contract.md`; record any unresolved mismatch as a blocked gate rather than silently adapting it.
- [ ] T042 Verify `TRANSFER_ASSESSMENT_ENABLED` remains disabled by default in `tutor-system/supabase/functions/assessment-api/index.ts` and that rollback preserves tables, keys, evidence, and history.
- [ ] T043 Update `specs/102-transfer-backend/quickstart.md` with immutable evidence paths, migration status, verifier status, provider status, test results, and remaining blockers; do not record Promptfoo/browser release acceptance.
- [ ] T044 Review the nearest documentation before commit and defer root `AGENTS.md` context update and integration control changes to the integration owner.

## Dependencies And Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; establishes hosted scope and frozen contracts.
- **Foundational (Phase 2)**: Depends on Setup; blocks every story until schema/type/test seams are ready.
- **User Story 1 (Phase 3)**: Depends on the foundational schema/types and public/private contracts.
- **User Story 2 (Phase 4)**: Depends on US1 delivery/key lifecycle and the foundational progress types.
- **User Story 3 (Phase 5)**: Authorization tests can begin after Setup, but final acceptance depends on US1/US2 operation surfaces.
- **User Story 4 (Phase 6)**: Depends on US1 delivery and US2 answer/event surfaces; it closes the transaction authority.
- **User Story 5 (Phase 7)**: Provider tests can begin after Setup; final implementation depends on the frozen API/RPC and private draft boundary.
- **Polish (Phase 8)**: Depends on all desired component stories and all hosted/provider evidence.

### User Story Dependencies

- **US1 (P1)**: Foundational schema/contracts.
- **US2 (P1)**: US1 delivery/key contract.
- **US3 (P1)**: Foundational contracts; final matrix covers US1/US2 boundaries.
- **US4 (P2)**: US1 and US2 lifecycle plus US3 trusted execution.
- **US5 (P2)**: Foundational contracts; provider results feed US1 private draft handling.

### Parallel Opportunities

- T002-T004 can run in parallel because they inspect independent inputs.
- T005-T006 and T009 can run in parallel before story implementation.
- US1 contract/static tests (T010-T011), US3 authorization test design (T021-T023), and US5 provider request test design (T033-T035) can proceed in parallel after the shared contracts are frozen.
- US4 race/invalidation test design (T027-T029) can proceed in parallel with US1/US3 implementation, but hosted execution waits for the RPC surfaces.

## Implementation Strategy

1. Freeze contracts and capture hosted preflight without enabling the feature.
2. Make schema/types and hosted direct-write/RLS checks executable.
3. Close reviewed delivery and exact answer lifecycle, then close trusted authorization.
4. Close atomic evidence/history/race/invalidation behavior.
5. Close provider request/retry/error/privacy evidence.
6. Reconcile all evidence, keep `TRANSFER_ASSESSMENT_ENABLED=false`, and hand downstream gates to components 103-105.

## Notes

- Every task names an exact owned file or planning artifact.
- New test files must start with a purpose comment as required by the repository instructions.
- No task authorizes changing the application identity contract for legacy behavior, adding a sign-in product, or claiming release acceptance from component evidence.
