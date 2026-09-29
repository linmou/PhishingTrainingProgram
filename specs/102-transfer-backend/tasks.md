# Tasks: Server-Authoritative Transfer Assessment Backend

<!-- Intent: provide an executable, dependency-ordered component backlog with separate external gates. -->

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)
**Verification scope**: Component 102 uses focused Jest, checked Deno, and disposable PostgreSQL 17 restored-copy evidence. Hosted Supabase, generated types, integrated build, and release gates remain separate.
**Upstream gate**: Merge the exact promoted component-101 integration SHA before implementation.

## TransferLearning Refactor Tasks (2026-09-29)

- [ ] R201 Author one forward migration from the current hosted schema for transfer capability, explicit-item initialization, semantic evidence authority, eligibility, and reviewed-send revalidation.
- [ ] R202 Replace template-based transfer initialization with approved items and make `analyze_message` apply idempotent learner evidence.
- [ ] R203 Narrow `prepare_turn` to mandatory assessment-only generation, focus-message catch-up, and explicit no-assessment/error outcomes.
- [ ] R204 Prove scope, Guard, feedback/repair, replay, privacy, and provider-failure behavior in the existing Edge, SQL, and service suites.

## Phase 1: Setup

**Purpose**: Capture immutable prerequisites and expose required configuration without enabling behavior.

- [x] T001 Record baseline SHA, promoted component-101 SHA, local restore identity and migration provenance, source preflight limits, existing assessment row counts where observed, and exact evidence locations in `specs/102-transfer-backend/implementation-evidence.md` (FR-021, FR-023, SC-010).
- [x] T002 Add documented server-only `OAI_API_KEY`, `OAI_BASE_URL`, required `OAI_MODEL=qwen3.5-flash`, and `TRANSFER_ASSESSMENT_ENABLED=false` entries to `tutor-system/.env.example`; retain no model fallback (FR-003, FR-019, FR-022).
- [x] T003 Review current archived migrations 025-046 and record the forward-only hosted reconciliation assumptions in `specs/102-transfer-backend/implementation-evidence.md`; do not reactivate archived files (FR-021, SC-010).

---

## Phase 2: Foundational Contract Tests

**Purpose**: Verify public/private, storage, request-parity, and transport contracts around the trusted boundary.

- [x] T004 Update `tutor-system/src/services/__tests__/transferAssessmentApiContract.test.ts` with a beginning purpose comment and failing assertions that `PublicAssessmentDTO` is exactly `{id, student_id, selection_type, stem, options}`, `ProcessedMessageDTO` remains canonical, terminal-failure feedback is unchanged, six operations remain, and private fields plus `rendered_text` are forbidden (FR-001, FR-007, FR-014).
- [x] T005 [P] Update `tutor-system/src/services/__tests__/transferTutorRequestV3.test.ts` with a beginning purpose comment and failing parity assertions for required `learner_safe_explanation` and canonical production/104 request serialization (FR-005, FR-019, FR-020).
- [x] T006 [P] Update `tutor-system/src/services/__tests__/transferAssessmentMigration.test.ts` with a beginning purpose comment and failing static assertions for the new private tables, immutable public `assessment_student_id`, public-key removal, versioned RPCs, grants, constraints, indexes, and stem-only delivery (FR-006-FR-009, FR-021).
- [x] T007 Update `tutor-system/src/services/__tests__/transferAssessmentLocalService.test.ts` with a beginning purpose comment and failing assertions that the browser facade invokes the trusted six-operation transport and contains no Supabase-table grading, private key reads, provider call, local attempt counter, or fallback model (FR-001-FR-003, FR-009-FR-010, FR-019).
- [x] T008 Restore `tutor-system/supabase/functions/assessment-api/index.test.ts` with a Deno shebang and beginning purpose comment; add failing handler tests for injected verifier, missing configuration, request envelopes, scope checks, exact public target projection, target mismatch failure, and private-field/`rendered_text` exclusion (FR-002-FR-007).
- [x] T009 [P] Extend `tutor-system/supabase/tests/transfer_assessment_backend.sql` and `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` with beginning purpose comments and local restored-copy cases for private assessment/attempt storage, untrusted denial, delivery, two attempts, rollback, and legacy reconciliation; use separate scripts for two-session races (FR-006-FR-018, FR-021).

**Checkpoint**: Contract results identify component-102 behavior against the promoted component-101 contract.

---

## Phase 3: User Story 1 - Deliver a Reviewed Assessment Privately (Priority: P1)

**Goal**: Prepare and atomically deliver a teacher-reviewed assessment while keeping grading material private and storing stem-only public content.

**Independent Test**: Use an injected teacher verifier and valid component-101 candidate to prepare/edit/send; assert one public message, one private record, stem-only content, exact public projection, retry idempotency, and no unsent/invalid partial state.

### Tests for User Story 1

- [x] T010 [US1] Extend the failing delivery/projection cases in `tutor-system/supabase/functions/assessment-api/index.test.ts` for teacher edits, explanation validation, stale scope, duplicate request, one-open-per-learner, and rollback (FR-004-FR-008).
- [x] T011 [P] [US1] Verify local restored-copy delivery cases and two-session delivery race for room lock, private/public atomicity, immutable/matching `assessment_student_id`, immutable key/explanation, stem-only content, exact-once options, and delivery retry (FR-006-FR-008, FR-015-FR-016).
- [x] T012 [P] [US1] Extend `tutor-system/src/services/__tests__/transferAssessmentService.test.ts` with a beginning purpose comment and failing facade DTO tests for prepare/send success, required target `student_id`, missing/mismatched target failure, safe errors, exact field set, and no private learner projection or `rendered_text` (FR-001, FR-004-FR-007).

### Implementation for User Story 1

- [x] T013 [US1] Create `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql` beginning with a commented psql shebang and purpose comment; add immutable public `assessment_student_id`, private assessment/provider-audit storage, target/checklist consistency, constraints/indexes, legacy-incomplete reconciliation, public key removal, `send_reviewed_tutor_response_v4`, and `record_transfer_provider_attempt_v1` with service-role-only grants (FR-006-FR-008, FR-015-FR-016, FR-019, FR-021).
- [x] T014 [US1] Restore `tutor-system/supabase/functions/assessment-api/index.ts` with a Deno shebang and purpose comment; implement injected verifier plumbing, safe envelopes, `prepare_turn`, reviewed candidate revalidation, and `send_reviewed` projection without browser/provider fallback (FR-001-FR-008).
- [x] T015 [US1] Replace browser-table delivery logic in `tutor-system/src/services/transferAssessmentService.ts` with the typed trusted-API facade for `prepareTurn`/`sendReviewed`, export exact `{id, student_id, selection_type, stem, options}` public assessment and unchanged canonical `ProcessedMessageDTO`, and fail closed on target mismatch (FR-001, FR-004-FR-007).
- [x] T016 [US1] Update checked-in `tutor-system/src/types/database.ts` for the public `send_reviewed_tutor_response_v4` call signature; keep generated private-schema parity as a separate integration gap (FR-021).
- [x] T017 [US1] Record T010-T012 and local restored-copy delivery results, assertion counts, migration/script blobs, and tested code SHA in `specs/102-transfer-backend/implementation-evidence.md` (SC-005-SC-007, SC-010).

**Checkpoint**: Delivery is usable through the trusted test boundary, but learner grading remains closed until US2.

---

## Phase 4: User Story 2 - Grade Two Persisted Attempts (Priority: P1)

**Goal**: Persist and grade at most two exact-set selections across reloads, retries, races, and tabs with terminal-only failure feedback.

**Independent Test**: Seed a delivered private assessment and execute the full first-wrong, pass-first, wrong-then-pass, two-wrong, duplicate, race, malformed, wrong-scope, and third-submission matrix.

### Tests for User Story 2

- [x] T018 [US2] Add failing two-attempt facade/DTO cases to `tutor-system/src/services/__tests__/transferAssessmentService.test.ts`, including authoritative counts, duplicate projection, first-wrong privacy, pass privacy, second-wrong feedback, and third-submission terminal state (FR-009-FR-017).
- [x] T019 [P] [US2] Add failing Edge handler cases to `tutor-system/supabase/functions/assessment-api/index.test.ts` for structured selected IDs, target learner/scope validation, duplicate request/message, reload-equivalent reread, and role-safe terminal feedback (FR-009-FR-017).
- [x] T020 [P] [US2] Verify the component-101 answer/lifecycle matrix in local restored-copy RPC tests and three native two-session races, including wrong/wrong and both correct/wrong commit orders (FR-009-FR-018, SC-001-SC-004).

### Implementation for User Story 2

- [x] T021 [US2] Extend `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql` with `private.transfer_assessment_attempts`, exact constraints/indexes, `post_assessment_message_v2`, and row-locked `process_assessment_message_v2` implementing the approved two-attempt contract (FR-009-FR-018, FR-021).
- [x] T022 [US2] Implement structured assessment-answer `post_message` and role-safe `process_message` mapping in `tutor-system/supabase/functions/assessment-api/index.ts`; return private feedback only after committed terminal second failure (FR-009-FR-017).
- [x] T023 [US2] Implement `postMessage`/`processMessage` trusted facade calls and exact `ProcessedMessageDTO` exports in `tutor-system/src/services/transferAssessmentService.ts`; remove browser parsing/grading/progress writes and local answer authority (FR-009-FR-017).
- [x] T024 [US2] Update checked-in `tutor-system/src/types/database.ts` for public v2 answer RPC signatures and verify no browser-consumable type exposes private rows; generated private-schema parity remains external (FR-007-FR-009, FR-021).
- [x] T025 [US2] Record T018-T020 and local race outcomes with attempt/event/evidence/history counts, command form, exit codes, migration blob, and tested code SHA in `specs/102-transfer-backend/implementation-evidence.md` (SC-001-SC-004, SC-007, SC-010).

**Checkpoint**: Server state alone determines remaining attempts, terminal result, and disclosure across every browser lifecycle.

---

## Phase 5: User Story 3 - Enforce Trusted Identity and Role-Safe Projection (Priority: P1)

**Goal**: Fail closed without a trusted verifier and deny cross-scope/direct access to private grading or progress authority.

**Independent Test**: Execute absent/invalid proof, forged body identity, target learner, other learner, teacher, observer, cross-room, direct RPC/table, and old-operation cases with field-level leakage scans.

### Tests for User Story 3

- [x] T026 [US3] Add failing verifier/authorization attack cases to `tutor-system/supabase/functions/assessment-api/index.test.ts`, including absent production adapter, forged body IDs, cross-room/learner access, teacher-only review, and learner-only terminal feedback (FR-002-FR-003, FR-017).
- [x] T027 [P] [US3] Run local restored-copy grant/RLS checks and direct-role private-read, v2/legacy-RPC, inbox-write, and public-progress-write denials; assert zero attempts, events, evidence, or history mutations (FR-002-FR-003, FR-007-FR-008, FR-021).
- [x] T028 [P] [US3] Add failing public-projection and source/build import scans to `tutor-system/src/services/__tests__/transferAssessmentApiContract.test.ts` for exact target routing, private values, `rendered_text`, transfer basis, rationale, raw provider output, credentials, and the browser production-prompt copy; permit `student_id` only as routing metadata and explanation field names/types only in teacher candidate and terminal-failure contracts (FR-007-FR-008, SC-005-SC-006).

### Implementation for User Story 3

- [x] T029 [US3] Complete `AssessmentPrincipalVerifier` dependency wiring, room/role/learner authorization, fail-closed capability, and safe error mapping in `tutor-system/supabase/functions/assessment-api/index.ts` without prescribing `auth.uid()` or a new sign-in product (FR-002-FR-003).
- [x] T030 [US3] Harden grants, private schema access, direct transfer writes, obsolete RPC signatures, and public projections in `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql` (FR-002-FR-003, FR-007-FR-008, FR-021).
- [x] T031 [US3] Remove the browser-owned production prompt contents from `tutor-system/src/services/prompts/transferV3Prompt.ts` and remove all browser imports/calls/private fields from `tutor-system/src/services/transferAssessmentService.ts`; retain no compatibility grader (FR-007-FR-010, FR-019).
- [x] T032 [US3] Record T026-T028, local direct-role attack counts, and component source privacy scan with exit codes and tested code SHA; record pending browser build-asset and deployed authentication lanes separately (SC-005, SC-008, SC-010).

**Checkpoint**: A browser can use only allowlisted operations and never becomes identity, grading, attempt, key, or progress authority.

---

## Phase 6: User Story 4 - Commit Terminal Evidence and Progress Atomically (Priority: P2)

**Goal**: Make terminal attempt, lifecycle, causal evidence, progress, history, and idempotency one transaction while first wrong remains nonterminal.

**Independent Test**: Force failures at each write stage and exercise pass, second fail, first wrong, invalid transition, duplicate, stale snapshot, Guard defer/replay, and concurrent processing.

### Tests for User Story 4

- [x] T033 [US4] Verify local restored-copy atomicity and actual-before/after cases for terminal pass/fail, eight injected write-stage failures, stale snapshot, invalid pair, duplicate, and Guard defer/replay (FR-018, SC-007).
- [x] T034 [P] [US4] Extend `tutor-system/src/services/__tests__/transferAssessmentMigration.test.ts` with failing static checks that first wrong cannot call the terminal event path and that pass/fail functions share one transaction boundary (FR-011-FR-013, FR-018).

### Implementation for User Story 4

- [x] T035 [US4] Complete `apply_learning_event_v1` integration inside `process_assessment_message_v2` in `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql`, preserving causal IDs, actual history, Guard state, and all-or-nothing terminal updates (FR-018).
- [x] T036 [US4] Project applied/deferred transition state without private event payloads in `tutor-system/supabase/functions/assessment-api/index.ts` and `tutor-system/src/services/transferAssessmentService.ts` (FR-014, FR-018).
- [x] T037 [US4] Record T033-T034 plus local restored-copy rollback/Guard/race results, per-case row counts, command form, exit codes, and tested migration/script blobs in `specs/102-transfer-backend/implementation-evidence.md` (SC-002, SC-007, SC-010).

**Checkpoint**: No response can claim a terminal result or disclose feedback unless the full causal transaction committed.

---

## Phase 7: User Story 5 - Generate the Production Contract Safely (Priority: P2)

**Goal**: Generate and validate learner-safe explanations through the configured server-only `qwen3.5-flash` provider with one bounded format repair.

**Independent Test**: Capture valid, repaired, truncated, invalid, missing-config, HTTP, and network provider paths and compare canonical production/104 serialization.

### Tests for User Story 5

- [x] T038 [US5] Add failing captured-request/provider-response cases to `tutor-system/supabase/functions/assessment-api/index.test.ts` for exact URL/model, `max_tokens=1200`, JSON mode, required explanation, one format repair, truncation, invalid output, HTTP/network error, and zero persistence (FR-019-FR-020).
- [x] T039 [P] [US5] Complete failing parity and forbidden-field cases in `tutor-system/src/services/__tests__/transferTutorRequestV3.test.ts` and `tutor-system/src/services/__tests__/ecologicalTutorCall.test.ts` for the shared production/104 request boundary (FR-020).

### Implementation for User Story 5

- [x] T040 [US5] Add the backend-owned production prompt, required server config reads, DashScope-compatible `qwen3.5-flash` request, finish/error inspection, `record_transfer_provider_attempt_v1` calls, and one format-only repair to `tutor-system/supabase/functions/assessment-api/index.ts` (FR-019).
- [x] T041 [US5] Update `tutor-system/src/services/ecologicalTutorCall.ts` only as needed to keep canonical versioned request/context builders aligned with the promoted component-101 explanation contract; export no prompt, credential, provider call, key, or grading result (FR-020).
- [x] T042 [US5] Record T038-T039, checked Deno fake-provider outcomes, and component source privacy scans with credential-free request/response metadata, commands, counts, exit codes, and tested SHA; keep live-provider acceptance external (SC-009-SC-010).

**Checkpoint**: Provider behavior is configured, bounded, inspectable, and incapable of grading or silently changing the experiment configuration.

---

## Phase 8: Polish and Component Verification

**Purpose**: Close local gates, documentation, disabled activation, and integration handoff evidence.

- [x] T043 Record focused Jest, checked Deno, and component-branch build commands, counts, exit codes, and tested SHA; identify the 103-owned fixture mismatch blocking this branch's bundle (SC-010).
- [x] T044 Compare the local migrated catalog's eight RPC identities and private columns with `specs/102-transfer-backend/contracts/rpc-contract.md` and `tutor-system/src/types/database.ts`; record the absent generated private schema as an external type-parity gap (FR-021, FR-023).
- [x] T045 Verify `TRANSFER_ASSESSMENT_ENABLED=false`, missing verifier/model fail closed, local rollback leaves no partial effects, and no browser grader/provider fallback remains; record the external activation blockers (FR-003, FR-019, FR-022-FR-023).
- [x] T046 Review and update `tutor-system/README.md`, `tutor-system/claude_docs/database-schema.md`, `tutor-system/claude_docs/supabase-service.md`, and `tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md`; add `tutor-system/claude_docs/doc_update_record/documentation_update_record_v2026_09_22_transfer_backend.md` with intent, date, commands, results, and commit reference (FR-023).
- [x] T047 Provide the integration owner with the clean component commit, exact verification commands/results/logs, changed public contracts, hosted/provider prerequisites, and 101->102 / 102->103 / 102->104 handoff risks; do not edit `specs/orchestration/**` (SC-010).

## Dependencies and Execution Order

### Phase Dependencies

- Setup precedes all tests.
- Foundational T004-T009 establish the component contracts before story verification.
- US1 establishes private delivery needed by US2.
- US2 establishes attempts needed by US4 and the DTO consumed by US3 privacy tests.
- US3 can design tests after Foundational but its final gate follows US2 projections.
- US4 depends on US2 terminal outcomes and component-101 progress contracts.
- US5 provider tests can be designed after Foundational; its final gate depends on US1 candidate validation.
- Polish depends on every selected user story.

### User Story Dependencies

```text
US1 delivery -> US2 attempts -> US4 atomic terminal progress
US2 attempts -> US3 complete projection/privacy matrix
US1 delivery -> US5 provider generation
```

### Parallel Opportunities

- T005, T006, and T009 touch independent test surfaces and may run in parallel after T004.
- Within US1, T011 and T012 may run in parallel after T010 establishes DTO names.
- Within US2, T019 and T020 may run in parallel after T018 freezes expected DTOs.
- Within US3, T027 and T028 may run in parallel after T026.
- T034 may run in parallel with T033; T039 may run in parallel with T038.
- Tasks that edit `index.ts`, the single forward migration, or `transferAssessmentService.ts` are serialized.

## Implementation Strategy

1. Freeze and verify the exact contracts.
2. Deliver one private assessment safely.
3. Add persisted two-attempt grading and terminal projection.
4. Close authorization/privacy and atomic progress evidence.
5. Restore configured provider generation.
6. Run local component gates, update nearest docs, and hand the immutable commit plus external gate inventory to integration.

## Task Summary

- Total tasks: 47
- Setup/foundational: 9
- US1: 8
- US2: 8
- US3: 7
- US4: 5
- US5: 5
- Polish/handoff: 5
- Suggested first independently demonstrable slice: US1 after the foundational contract gate

## Requirement Traceability

| Requirements | Primary tasks |
|---|---|
| FR-001-FR-003 | T004, T007-T008, T014-T015, T026-T031, T045 |
| FR-004-FR-008 | T004, T010-T016, T026-T032 |
| FR-009-FR-014 | T018-T024, T033-T036 |
| FR-015-FR-018 | T011, T013, T018-T025, T033-T037 |
| FR-019-FR-020 | T002, T005, T008, T013, T028, T031, T038-T042, T045 |
| FR-021-FR-023 | T001, T003, T006, T009, T013, T016, T021, T024, T027, T030, T043-T047 |
| SC-001-SC-004 | T018-T025, T033-T037 |
| SC-005-SC-008 | T004, T006-T017, T026-T032, T035-T037 |
| SC-009-SC-010 | T001-T003, T005-T009, T017, T025, T032, T037-T047 |
