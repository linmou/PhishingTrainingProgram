# Tasks: Server-Authoritative Transfer Attempts

**Input**: Design documents from `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/specs/101-transfer-domain/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`
**Tests**: Required by the specification and repository constitution. Cover the changed contract and keep prior lifecycle regression tests.

## TransferLearning Refactor Tasks (2026-09-30)

- [x] R101 Use `TransferAssessmentDraft` and assessment-only validation; remove the unused v3 tutor-decision type, parser, and reviewed-send adapter.
- [ ] R102 Verify the unchanged reducer, exact-set grading, privacy, and two-attempt rules against the new draft contract.

## Phase 1: Setup

**Purpose**: Freeze the upgrade contract before executable changes.

- [x] T001 Review `specs/101-transfer-domain/spec.md`, `data-model.md`, `contracts/transfer-assessment-draft.md`, and `contracts/transfer-domain-determinism.md` and record the approved server-authoritative attempt policy in `specs/101-transfer-domain/implementation-handoff.md`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared state and result discriminants before lifecycle implementation.

- [x] T002 Add compile/runtime contract tests for valid and invalid `TransferAttemptSnapshot` states and result discriminants in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`.
- [x] T003 Add tests proving `TransferRetryResult` has no terminal feedback, `TransferPassedResult` has `learner_feedback_authorized: false`, and `TransferFailedResult` has `learner_feedback_authorized: true` in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`.
- [x] T004 Define `TransferAttemptSnapshot`, `TransferTerminalFeedback`, `TransferRetryResult`, `TransferPassedResult`, `TransferFailedResult`, non-consuming variants, and their union in `tutor-system/src/types/assessment.ts` without defaults or transport fields.
- [x] T005 Export all shared attempt/result types through `tutor-system/src/types/index.ts` and keep private fields absent from `PublicAssessment`.

## Phase 3: User Story 1 - Resolve at Most Two Valid Attempts (Priority: P1)

**Goal**: Produce retry, pass, and fail outcomes from a server-owned attempt snapshot without a third effect.

**Independent Test**: Run correct-first, incorrect-correct, incorrect-incorrect, duplicate, stale, malformed, Guard, and third-submission sequences with no storage, provider, React, or browser dependency.

### Tests for User Story 1

- [x] T006 [US1] Add Red tests for correct-first, incorrect-correct, and incorrect-incorrect snapshots/results in `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`.
- [x] T007 [US1] Add Red tests for duplicate identities at attempts one/two, persisted reload/tab-equivalent snapshots, terminal third submissions, stale snapshots, malformed input, assistance, and Guard deferral in `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`.
- [x] T008 [US1] Add versioned attempt-sequence input/output fixtures asserting pass feedback remains private and only second-incorrect failure authorizes learner disclosure in `tutor-system/src/services/transferAssessmentGoldenFixtures.ts` and `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`.

### Implementation for User Story 1

- [x] T009 [US1] Validate snapshot invariants and return immutable next snapshots from `tutor-system/src/services/transferAssessmentOrchestrator.ts`.
- [x] T010 [US1] Implement first-incorrect `retryable` behavior with one remaining attempt, unchanged progress, no reducer event, and no terminal feedback in `tutor-system/src/services/transferAssessmentOrchestrator.ts`.
- [x] T011 [US1] Implement terminal `passed` on a correct first/second attempt and terminal `failed` only on a second incorrect attempt in `tutor-system/src/services/transferAssessmentOrchestrator.ts`.
- [x] T012 [US1] Suppress attempt consumption and transitions for duplicate, terminal, third, stale, undelivered, malformed, ambiguous, assistance, and Guard-deferred inputs in `tutor-system/src/services/transferAssessmentOrchestrator.ts`.

**Checkpoint**: US1 is complete when every canonical two-attempt sequence has the expected snapshot/result and no input can create a third consumed attempt or second terminal transition.

## Phase 4: User Story 2 - Author One Learner-Safe Explanation (Priority: P1)

**Goal**: Require the private explanation and authorize learner disclosure only after second-incorrect terminal failure.

**Independent Test**: Validate present/missing/blank/non-string explanations and prove unresolved/retryable/pass withhold learner feedback while second-incorrect failure authorizes it.

### Tests for User Story 2

- [x] T013 [P] [US2] Add Red private-assessment tests for present, missing, blank, and non-string `learner_safe_explanation` in `tutor-system/src/services/__tests__/tutorDecisionContract.transfer.test.ts`.
- [x] T014 [P] [US2] Add Red privacy tests proving unresolved/retryable shapes exclude key/explanation, passed feedback remains private with authorization false, and only failed feedback is learner-authorized in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`.

### Implementation for User Story 2

- [x] T015 [US2] Add required `learner_safe_explanation` to `PrivateAssessment` in `tutor-system/src/types/assessment.ts` without adding it to `PublicAssessment`.
- [x] T016 [US2] Validate the explanation as a trimmed non-empty string with a stable error category in `tutor-system/src/services/assessmentValidation.ts` and `tutor-system/src/services/tutorDecisionContract.ts`.
- [x] T017 [US2] Populate private `TransferTerminalFeedback` on terminal variants and set literal `learner_feedback_authorized: false` for pass and `true` only for second-incorrect failure in `tutor-system/src/services/transferAssessmentOrchestrator.ts`.

**Checkpoint**: US2 is complete when every assessment requires an explanation, no unresolved/retryable output contains it, passed feedback cannot be learner-projected, and only failed feedback is learner-authorized.

## Phase 5: User Story 3 - Preserve One Progress Authority (Priority: P1)

**Goal**: Gate the unchanged progress reducer so first incorrect applies no event and only terminal pass/fail transitions once.

**Independent Test**: Run the existing 28-cell reducer suite plus attempt-to-transition fixtures without changing the matrix.

### Tests for User Story 3

- [x] T018 [P] [US3] Add attempt-to-reducer tests for first-incorrect/no-event, correct-first/pass, incorrect-correct/pass, and incorrect-incorrect/fail in `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`.
- [x] T019 [P] [US3] Re-run the unchanged 28-cell expectations and repair/contradiction/spontaneous fixtures in `tutor-system/src/services/__tests__/learningProgressTransitions.test.ts` and `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`.

### Implementation for User Story 3

- [x] T020 [US3] Gate `applyLearningEvent` calls in `tutor-system/src/services/transferAssessmentOrchestrator.ts` so retryable/non-consuming results use no transition and terminal results call the reducer exactly once.

**Checkpoint**: US3 is complete when the reducer matrix is unchanged and all attempt sequences emit zero or one correctly timed transition.

## Phase 6: User Story 4 - Keep the Deterministic Boundary Inspectable (Priority: P1)

**Goal**: Give downstream owners one exported contract and stable fixture vocabulary.

**Independent Test**: Import all promoted types from the barrel and validate every fixture ID, state, disposition, progress effect, and disclosure expectation.

### Tests for User Story 4

- [x] T021 [US4] Add barrel-import contract coverage for attempt/result/feedback types in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`.
- [x] T022 [US4] Validate fixture uniqueness, supported versions, snapshot invariants, expected transitions, and disclosure fields in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`.

### Implementation for User Story 4

- [x] T023 [US4] Align fixture records and result constructors with the promoted contracts in `tutor-system/src/services/transferAssessmentGoldenFixtures.ts` and `tutor-system/src/services/transferAssessmentOrchestrator.ts`.

**Checkpoint**: US4 is complete when downstream consumers can import one canonical contract and fixture validation proves every required scenario is represented.

## Phase 7: User Story 5 - Sequence Feedback and Later Transfer Without Chains (Priority: P2)

**Goal**: Preserve feedback-first, repair, contradiction, spontaneous-transfer, Guard, and no-chain behavior around the new retry state.

**Independent Test**: Replay named end-to-end domain sequences through the pure orchestrator and inspect every next action.

### Tests for User Story 5

- [x] T024 [P] [US5] Add sequence tests for terminal pass -> feedback -> no retest and terminal fail -> repair -> new signal -> different context in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`.
- [x] T025 [P] [US5] Add no-repair, clarification, assistance, contradiction, spontaneous-transfer, multi-target, Guard, stale, and no-chain regression tests in `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`.

### Implementation for User Story 5

- [x] T026 [US5] Preserve feedback, repair, evidence, Guard, and no-chain next actions around retry/terminal results in `tutor-system/src/services/transferAssessmentOrchestrator.ts`.

**Checkpoint**: US5 is complete when retry does not begin repair or feedback and all terminal/existing sequences retain one stable next action.

## Phase 8: Polish and Cross-Cutting Verification

**Purpose**: Verify the component package and prepare an evidence-complete handoff without claiming downstream gates.

- [x] T027 [P] Run the exact focused command from `specs/101-transfer-domain/quickstart.md` and record exit status, counts, fixture version, and key input-output pairs in `specs/101-transfer-domain/implementation-handoff.md`.
- [x] T028 [P] Run `npx tsc --noEmit` from `tutor-system/` and record results for modified shared contracts in `specs/101-transfer-domain/implementation-handoff.md`.
- [x] T029 Run `CI=true npm run test:regression -- --runInBand` and `npm run build` from `tutor-system/`, preserving attributable and baseline failures in `specs/101-transfer-domain/implementation-handoff.md`.
- [x] T030 Review and update `tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md` and create `tutor-system/claude_docs/doc_update_record/documentation_update_record_v2026_09_22_transfer_attempts.md` with intent, date, and implemented contract evidence.
- [x] T031 Finalize `specs/101-transfer-domain/implementation-handoff.md` with public contracts, exact commands, evidence metadata, downstream risks, unrun integration gates, and disabled feature status.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Freezes the approved policy and contract names.
- **Foundational (Phase 2)**: Depends on setup and blocks lifecycle work.
- **US1 (Phase 3)**: Depends on attempt/result types from Phase 2.
- **US2 (Phase 4)**: Contract tests may start after Phase 2; terminal population depends on US1 result constructors.
- **US3 (Phase 5)**: Depends on US1 lifecycle branches and preserves the existing reducer.
- **US4 (Phase 6)**: Depends on US1-US3 stable exports and fixtures.
- **US5 (Phase 7)**: Depends on all attempt, feedback, and progress behavior.
- **Polish (Phase 8)**: Depends on every story checkpoint.

### Component Ownership Traceability

| Contract or artifact | Component 101 task ownership | Component 102 integration ownership |
|---|---|---|
| `PrivateAssessment`, `TransferAttemptSnapshot`, result union, terminal feedback | T002-T005, T013-T017, T021 | Persist atomically and project by role without redefining lifecycle/privacy rules. |
| Existing parser, grader, renderer, reducer | T018-T020 regression only | Invoke promoted pure outputs; do not copy their rules. |
| Pure two-attempt orchestrator | T006-T012, T017-T020, T024-T026 | Integrate the actual resolver into service transactions and DTOs. |
| Golden fixtures | T008, T014, T019, T022-T025 | Reuse for real handoff/integration tests and evaluation cases. |
| `transferAssessmentService.ts` and its test | No component 101 task; explicitly excluded | Sole owner of facade transport, API DTO projection, and facade tests. |

### Parallel Opportunities

- T002 and T003 are serial in one contract test file before T004-T005; T013 and T014 can run in parallel in separate test files.
- T006 and T007 are serial in the orchestrator test file.
- T018 and T019 can run in parallel because orchestrator and reducer regression files differ.
- T021 and T022 share one test file and run serially; T024 and T025 can run in parallel in separate test files.
- T027 and T028 can run in parallel after implementation; T029 follows.

### Implementation Strategy

1. Freeze fixture and contract expectations.
2. Write failing deterministic tests for each boundary.
3. Implement the smallest existing-module changes to make each story pass, using the repository-required TDD workflow.
4. Run each checkpoint before wiring the next boundary.
5. Finish with type, regression, build, and evidence reporting; do not enable the feature or claim downstream gates.

## Task Format Validation

All 31 tasks use the required `- [ ] T###` format. Story-phase tasks use `[US1]` through `[US5]`; `[P]` appears only where file/dependency boundaries permit. Every task names an exact repository or specification path.
