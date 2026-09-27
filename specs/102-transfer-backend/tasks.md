# Tasks: Server-Authoritative Transfer Assessment Backend

<!-- Intent: provide an executable, dependency-ordered test-first backlog for component 102. -->

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)
**Required workflow**: `fast-multi-agent-tdd`; tests must fail for the intended reason before implementation.
**Upstream gate**: Merge the exact promoted component-101 integration SHA before TDD begins.

## Phase 1: Setup

**Purpose**: Capture immutable prerequisites and expose required configuration without enabling behavior.

- [ ] T001 Record baseline SHA, promoted component-101 SHA, hosted scope identifier, pre-migration schema/function/grant inventory, existing assessment row counts, and exact evidence paths in `specs/102-transfer-backend/implementation-evidence.md` (FR-021, FR-023, SC-010).
- [x] T002 Add documented server-only `OAI_API_KEY`, `OAI_BASE_URL`, required `OAI_MODEL=qwen3.5-flash`, and `TRANSFER_ASSESSMENT_ENABLED=false` entries to `tutor-system/.env.example`; retain no model fallback (FR-003, FR-019, FR-022).
- [x] T003 Review current archived migrations 025-046 and record the forward-only hosted reconciliation assumptions in `specs/102-transfer-backend/implementation-evidence.md`; do not reactivate archived files (FR-021, SC-010).

---

## Phase 2: Foundational Contract Tests

**Purpose**: Establish failing public/private, storage, request-parity, and transport tests before restoring the trusted boundary.

**CRITICAL**: Do not implement production behavior until T004-T009 fail for the expected missing-contract reasons and those failures are recorded.

- [x] T004 Update `tutor-system/src/services/__tests__/transferAssessmentApiContract.test.ts` with a beginning purpose comment and failing assertions that `PublicAssessmentDTO` is exactly `{id, student_id, selection_type, stem, options}`, `ProcessedMessageDTO` remains canonical, terminal-failure feedback is unchanged, six operations remain, and private fields plus `rendered_text` are forbidden (FR-001, FR-007, FR-014).
- [x] T005 [P] Update `tutor-system/src/services/__tests__/transferTutorRequestV3.test.ts` with a beginning purpose comment and failing parity assertions for required `learner_safe_explanation` and canonical production/104 request serialization (FR-005, FR-019, FR-020).
- [x] T006 [P] Update `tutor-system/src/services/__tests__/transferAssessmentMigration.test.ts` with a beginning purpose comment and failing static assertions for the new private tables, immutable public `assessment_student_id`, public-key removal, versioned RPCs, grants, constraints, indexes, and stem-only delivery (FR-006-FR-009, FR-021).
- [x] T007 Update `tutor-system/src/services/__tests__/transferAssessmentLocalService.test.ts` with a beginning purpose comment and failing assertions that the browser facade invokes the trusted six-operation transport and contains no Supabase-table grading, private key reads, provider call, local attempt counter, or fallback model (FR-001-FR-003, FR-009-FR-010, FR-019).
- [x] T008 Restore `tutor-system/supabase/functions/assessment-api/index.test.ts` with a Deno shebang and beginning purpose comment; add failing handler tests for injected verifier, missing configuration, request envelopes, scope checks, exact public target projection, target mismatch failure, and private-field/`rendered_text` exclusion (FR-002-FR-007).
- [x] T009 [P] Extend `tutor-system/supabase/tests/transfer_assessment_backend.sql` and `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` with beginning purpose comments and failing hosted cases for private assessment/attempt storage, untrusted denial, delivery, two attempts, races, rollback, and legacy reconciliation (FR-006-FR-018, FR-021).

**Checkpoint**: Contract failures identify only missing component-102 behavior, not an unmerged component-101 contract or unavailable test dependency.

---

## Phase 3: User Story 1 - Deliver a Reviewed Assessment Privately (Priority: P1)

**Goal**: Prepare and atomically deliver a teacher-reviewed assessment while keeping grading material private and storing stem-only public content.

**Independent Test**: Use an injected teacher verifier and valid component-101 candidate to prepare/edit/send; assert one public message, one private record, stem-only content, exact public projection, retry idempotency, and no unsent/invalid partial state.

### Tests for User Story 1

- [x] T010 [US1] Extend the failing delivery/projection cases in `tutor-system/supabase/functions/assessment-api/index.test.ts` for teacher edits, explanation validation, stale scope, duplicate request, one-open-per-learner, and rollback (FR-004-FR-008).
- [x] T011 [P] [US1] Extend failing hosted delivery cases in `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` for room lock, private/public atomicity, immutable/matching `assessment_student_id`, immutable key/explanation, stem-only content, exact-once options, and delivery retry (FR-006-FR-008, FR-015-FR-016).
- [x] T012 [P] [US1] Extend `tutor-system/src/services/__tests__/transferAssessmentService.test.ts` with a beginning purpose comment and failing facade DTO tests for prepare/send success, required target `student_id`, missing/mismatched target failure, safe errors, exact field set, and no private learner projection or `rendered_text` (FR-001, FR-004-FR-007).

### Implementation for User Story 1

- [x] T013 [US1] Create `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql` beginning with a commented psql shebang and purpose comment; add immutable public `assessment_student_id`, private assessment/provider-audit storage, target/checklist consistency, constraints/indexes, legacy-incomplete reconciliation, public key removal, `send_reviewed_tutor_response_v4`, and `record_transfer_provider_attempt_v1` with service-role-only grants (FR-006-FR-008, FR-015-FR-016, FR-019, FR-021).
- [x] T014 [US1] Restore `tutor-system/supabase/functions/assessment-api/index.ts` with a Deno shebang and purpose comment; implement injected verifier plumbing, safe envelopes, `prepare_turn`, reviewed candidate revalidation, and `send_reviewed` projection without browser/provider fallback (FR-001-FR-008).
- [x] T015 [US1] Replace browser-table delivery logic in `tutor-system/src/services/transferAssessmentService.ts` with the typed trusted-API facade for `prepareTurn`/`sendReviewed`, export exact `{id, student_id, selection_type, stem, options}` public assessment and unchanged canonical `ProcessedMessageDTO`, and fail closed on target mismatch (FR-001, FR-004-FR-007).
- [x] T016 [US1] Update `tutor-system/src/types/database.ts` to match the hosted private assessment and `send_reviewed_tutor_response_v4` signatures generated from the disposable supported schema (FR-021).
- [ ] T017 [US1] Run T010-T012 and the US1 hosted lane; record failing-before/passing-after commands, counts, outputs, hosted schema revision, and tested commit SHA in `specs/102-transfer-backend/implementation-evidence.md` (SC-005-SC-007, SC-010).

**Checkpoint**: Delivery is usable through the trusted test boundary, but learner grading remains closed until US2.

---

## Phase 4: User Story 2 - Grade Two Persisted Attempts (Priority: P1)

**Goal**: Persist and grade at most two exact-set selections across reloads, retries, races, and tabs with terminal-only failure feedback.

**Independent Test**: Seed a delivered private assessment and execute the full first-wrong, pass-first, wrong-then-pass, two-wrong, duplicate, race, malformed, wrong-scope, and third-submission matrix.

### Tests for User Story 2

- [x] T018 [US2] Add failing two-attempt facade/DTO cases to `tutor-system/src/services/__tests__/transferAssessmentService.test.ts`, including authoritative counts, duplicate projection, first-wrong privacy, pass privacy, second-wrong feedback, and third-submission terminal state (FR-009-FR-017).
- [x] T019 [P] [US2] Add failing Edge handler cases to `tutor-system/supabase/functions/assessment-api/index.test.ts` for structured selected IDs, target learner/scope validation, duplicate request/message, reload-equivalent reread, and role-safe terminal feedback (FR-009-FR-017).
- [x] T020 [P] [US2] Add the component-101 golden answer/lifecycle matrix as failing hosted expectations in `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql`, including two distinct wrong answers racing and correct/wrong races (FR-009-FR-018, SC-001-SC-004).

### Implementation for User Story 2

- [x] T021 [US2] Extend `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql` with `private.transfer_assessment_attempts`, exact constraints/indexes, `post_assessment_message_v2`, and row-locked `process_assessment_message_v2` implementing the approved two-attempt contract (FR-009-FR-018, FR-021).
- [x] T022 [US2] Implement structured assessment-answer `post_message` and role-safe `process_message` mapping in `tutor-system/supabase/functions/assessment-api/index.ts`; return private feedback only after committed terminal second failure (FR-009-FR-017).
- [x] T023 [US2] Implement `postMessage`/`processMessage` trusted facade calls and exact `ProcessedMessageDTO` exports in `tutor-system/src/services/transferAssessmentService.ts`; remove browser parsing/grading/progress writes and local answer authority (FR-009-FR-017).
- [x] T024 [US2] Regenerate/update `tutor-system/src/types/database.ts` for private attempts and v2 answer RPC signatures, then verify no browser-consumable type exposes private rows (FR-007-FR-009, FR-021).
- [ ] T025 [US2] Run T018-T020 and the hosted race lane; record attempt rows, terminal effects, exact logs, exit codes, and tested commit SHA in `specs/102-transfer-backend/implementation-evidence.md` (SC-001-SC-004, SC-007, SC-010).

**Checkpoint**: Server state alone determines remaining attempts, terminal result, and disclosure across every browser lifecycle.

---

## Phase 5: User Story 3 - Enforce Trusted Identity and Role-Safe Projection (Priority: P1)

**Goal**: Fail closed without a trusted verifier and deny cross-scope/direct access to private grading or progress authority.

**Independent Test**: Execute absent/invalid proof, forged body identity, target learner, other learner, teacher, observer, cross-room, direct RPC/table, and old-operation cases with field-level leakage scans.

### Tests for User Story 3

- [x] T026 [US3] Add failing verifier/authorization attack cases to `tutor-system/supabase/functions/assessment-api/index.test.ts`, including absent production adapter, forged body IDs, cross-room/learner access, teacher-only review, and learner-only terminal feedback (FR-002-FR-003, FR-017).
- [x] T027 [P] [US3] Add failing grant/RLS/direct-write/legacy-RPC cases to `tutor-system/supabase/tests/transfer_assessment_backend.sql`, asserting zero private reads, attempts, progress effects, or leaked fields (FR-002-FR-003, FR-007-FR-008, FR-021).
- [x] T028 [P] [US3] Add failing public-projection and source/build import scans to `tutor-system/src/services/__tests__/transferAssessmentApiContract.test.ts` for exact target routing, private values, `rendered_text`, transfer basis, rationale, raw provider output, credentials, and the browser production-prompt copy; permit `student_id` only as routing metadata and explanation field names/types only in teacher candidate and terminal-failure contracts (FR-007-FR-008, SC-005-SC-006).

### Implementation for User Story 3

- [x] T029 [US3] Complete `AssessmentPrincipalVerifier` dependency wiring, room/role/learner authorization, fail-closed capability, and safe error mapping in `tutor-system/supabase/functions/assessment-api/index.ts` without prescribing `auth.uid()` or a new sign-in product (FR-002-FR-003).
- [x] T030 [US3] Harden grants, private schema access, direct transfer writes, obsolete RPC signatures, and public projections in `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql` (FR-002-FR-003, FR-007-FR-008, FR-021).
- [x] T031 [US3] Remove the browser-owned production prompt contents from `tutor-system/src/services/prompts/transferV3Prompt.ts` and remove all browser imports/calls/private fields from `tutor-system/src/services/transferAssessmentService.ts`; retain no compatibility grader (FR-007-FR-010, FR-019).
- [ ] T032 [US3] Run T026-T028 plus hosted attack and privacy scans; record exact matrices, zero-mutation counts, build-asset scan, logs, exit codes, and tested commit SHA in `specs/102-transfer-backend/implementation-evidence.md` (SC-005, SC-008, SC-010).

**Checkpoint**: A browser can use only allowlisted operations and never becomes identity, grading, attempt, key, or progress authority.

---

## Phase 6: User Story 4 - Commit Terminal Evidence and Progress Atomically (Priority: P2)

**Goal**: Make terminal attempt, lifecycle, causal evidence, progress, history, and idempotency one transaction while first wrong remains nonterminal.

**Independent Test**: Force failures at each write stage and exercise pass, second fail, first wrong, invalid transition, duplicate, stale snapshot, Guard defer/replay, and concurrent processing.

### Tests for User Story 4

- [x] T033 [US4] Add failing atomicity and actual-before/after cases to `tutor-system/supabase/tests/transfer_assessment_rpc_behaviour.sql` for every terminal event, forced rollback point, stale snapshot, invalid pair, duplicate, and Guard path (FR-018, SC-007).
- [x] T034 [P] [US4] Extend `tutor-system/src/services/__tests__/transferAssessmentMigration.test.ts` with failing static checks that first wrong cannot call the terminal event path and that pass/fail functions share one transaction boundary (FR-011-FR-013, FR-018).

### Implementation for User Story 4

- [x] T035 [US4] Complete `apply_learning_event_v1` integration inside `process_assessment_message_v2` in `tutor-system/supabase/migrations/20260922000000_transfer_assessment_server_authority.sql`, preserving causal IDs, actual history, Guard state, and all-or-nothing terminal updates (FR-018).
- [x] T036 [US4] Project applied/deferred transition state without private event payloads in `tutor-system/supabase/functions/assessment-api/index.ts` and `tutor-system/src/services/transferAssessmentService.ts` (FR-014, FR-018).
- [ ] T037 [US4] Run T033-T034 plus hosted rollback/Guard/race lanes; record per-case row counts, exact commands, exit codes, logs, and tested commit SHA in `specs/102-transfer-backend/implementation-evidence.md` (SC-002, SC-007, SC-010).

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
- [ ] T042 [US5] Run T038-T039 and provider privacy scans; record captured request/response metadata without secrets, exact commands, counts, exit codes, and tested commit SHA in `specs/102-transfer-backend/implementation-evidence.md` (SC-009-SC-010).

**Checkpoint**: Provider behavior is configured, bounded, inspectable, and incapable of grading or silently changing the experiment configuration.

---

## Phase 8: Polish and Component Verification

**Purpose**: Close local gates, documentation, disabled activation, and integration handoff evidence.

- [ ] T043 Run every focused Jest and Deno command from `specs/102-transfer-backend/quickstart.md`, then run `npm run build`; record exact exit codes, counts, logs, and tested commit SHA in `specs/102-transfer-backend/implementation-evidence.md` (SC-010).
- [ ] T044 Compare hosted generated `tutor-system/src/types/database.ts` with `specs/102-transfer-backend/contracts/rpc-contract.md`; record any mismatch as blocked rather than adapting silently (FR-021, FR-023).
- [ ] T045 Verify `TRANSFER_ASSESSMENT_ENABLED=false`, missing verifier/model fail closed, rollback preserves evidence, and no browser grader/provider fallback remains; record evidence in `specs/102-transfer-backend/implementation-evidence.md` (FR-003, FR-019, FR-022-FR-023).
- [x] T046 Review and update `tutor-system/README.md`, `tutor-system/claude_docs/database-schema.md`, `tutor-system/claude_docs/supabase-service.md`, and `tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md`; add `tutor-system/claude_docs/doc_update_record/documentation_update_record_v2026_09_22_transfer_backend.md` with intent, date, commands, results, and commit reference (FR-023).
- [x] T047 Provide the integration owner with the clean component commit, exact verification commands/results/logs, changed public contracts, hosted/provider prerequisites, and 101->102 / 102->103 / 102->104 handoff risks; do not edit `specs/orchestration/**` (SC-010).

## Dependencies and Execution Order

### Phase Dependencies

- Setup precedes all tests.
- Foundational T004-T009 must fail correctly before production implementation.
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

1. Freeze and fail the exact contracts.
2. Deliver one private assessment safely.
3. Add persisted two-attempt grading and terminal projection.
4. Close authorization/privacy and atomic progress evidence.
5. Restore configured provider generation.
6. Run full local/hosted gates, update nearest docs, and hand the immutable commit to integration.

## Task Summary

- Total tasks: 47
- Setup/foundational: 9
- US1: 8
- US2: 8
- US3: 7
- US4: 5
- US5: 5
- Polish/handoff: 5
- Suggested first independently demonstrable slice: US1 after the foundational failing-test gate

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
