# Tasks: W2 Deterministic Transfer Behavior and Golden Fixtures

**Input**: Design documents from `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/specs/101-transfer-domain/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`
**Tests**: Required by the specification and repository constitution. Write tests before implementation changes and execute the repository's `fast-multi-agent-tdd` workflow when implementing code.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Freeze the component evidence vocabulary and fixture layout before implementation.

- [ ] T001 Review `spec.md`, `plan.md`, `data-model.md`, `contracts/tutor-decision-v3.md`, and `contracts/transfer-domain-determinism.md` against the normative transfer runtime package and record the source SHA in the implementation handoff.
- [ ] T002 [P] Define typed golden-fixture records and stable suite/scenario identifiers in `tutor-system/src/services/__tests__/fixtures/transferAssessmentGoldenFixtures.ts`, including contract version, policy version, expected disposition, progress pair, and evidence reference fields.
- [ ] T003 [P] Add a fixture manifest index in `tutor-system/src/services/__tests__/fixtures/transferAssessmentGoldenFixtures.ts` for parser boundaries, grader subsets, rendering boundaries, reducer cells, and named lifecycle sequences; include the required beginning-purpose comment.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared type and privacy boundaries required by every user story.

- [ ] T004 [P] Add contract tests for the learner public projection and private-field exclusion in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts` before changing the projection or service implementation.
- [ ] T005 [P] Add v3 mode/instruction/target/payload matrix tests in `tutor-system/src/services/__tests__/tutorDecisionContract.transfer.test.ts` for tutoring, Guard, assessment, unknown IDs, invalid keys, and invalid transfer evidence before changing validation code.
- [ ] T006 Reconcile exports and type invariants in `tutor-system/src/types/assessment.ts`, `tutor-system/src/types/learningProgress.ts`, and `tutor-system/src/types/index.ts` so `TutorDecisionV3`, `TransferTurnContext`, public/private assessment data, and valid progress pairs have one owner each.
- [ ] T007 [P] Add a deterministic fixture schema validation test in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`, beginning with the required file-purpose comment, proving every fixture has a unique ID, supported contract/policy version, and an expected observable result.

## Phase 3: User Story 1 - Resolve a Delivered Assessment Answer Once (Priority: P1)

**Goal**: Parse and grade explicit learner selections with correct delivery, first-valid, clarification, assistance, duplicate, and stale boundaries.

**Independent Test**: Run the parser, grader, and answer-resolution tests with no provider, database, React, or browser dependency; verify one stable result per delivered question.

### Tests for User Story 1

- [ ] T008 [P] [US1] Extend parser boundary tests in `tutor-system/src/services/__tests__/assessmentAnswerParser.test.ts` for exact option text, case/Unicode/full-width normalization, trailing question marks, prefix forms, malformed combinations, ambiguous alternatives, content questions, and semantic near-misses.
- [ ] T009 [P] [US1] Extend exhaustive grader tests in `tutor-system/src/services/__tests__/assessmentGrading.test.ts` to evaluate all 16 A-D subsets, duplicate/order normalization, representative single/multiple keys, empty selections, incomplete selections, and over-inclusive selections.
- [ ] T010 [US1] Add first-valid answer-resolution and lifecycle sequence tests in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts` for undelivered, correct-with-reason, clarification, assistance, duplicate, stale, and no-chain outcomes.

### Implementation for User Story 1

- [ ] T011 [US1] Implement the parser behavior specified in `contracts/transfer-domain-determinism.md` in `tutor-system/src/services/assessmentAnswerParser.ts`, preserving explicit-label-only selection and stable clarification/not-selection categories.
- [ ] T012 [US1] Implement exact-set grading and input normalization constraints in `tutor-system/src/services/assessmentGrading.ts`, keeping explanation text outside the grading decision.
- [ ] T013 [US1] Extend the pure resolver boundary in `tutor-system/src/services/transferAssessmentOrchestrator.ts` to return stable undelivered, unresolved, passed, failed, assisted, duplicate, and stale dispositions without persistence writes.

**Checkpoint**: US1 is complete when all explicit parser boundaries and all A-D subsets pass, undelivered/first-valid/clarification/assistance behavior is stable, and later answers cannot create a second effect.

## Phase 4: User Story 2 - Apply Transfer Progress Transitions Consistently (Priority: P1)

**Goal**: Make the four valid progress pairs and seven event kinds a complete single reducer authority.

**Independent Test**: Run the 28-cell reducer matrix and stateful repair, contradiction, spontaneous-transfer, no-repair, and multi-target fixtures without transport or persistence.

### Tests for User Story 2

- [ ] T014 [P] [US2] Add the complete 28-cell state/event matrix to `tutor-system/src/services/__tests__/learningProgressTransitions.test.ts`, including invalid progress pairs and rejected pass/fail transitions.
- [ ] T015 [P] [US2] Add stateful progress sequence fixtures and assertions in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts` for fail/recover, no repair, contradiction reopening, spontaneous transfer, and multi-target preservation.

### Implementation for User Story 2

- [ ] T016 [US2] Align the valid progress pair types and guards in `tutor-system/src/types/learningProgress.ts` with the four-row model in `data-model.md` without adding a mastery field or default dataclass-like values.
- [ ] T017 [US2] Complete the transition table in `tutor-system/src/services/learningProgressTransitions.ts`, including repair gating, spontaneous transfer, contradiction reopening, no-change preservation, and deterministic invalid-transition errors.
- [ ] T018 [US2] Wire reducer outcomes into the pure answer-resolution/orchestrator result model in `tutor-system/src/services/transferAssessmentOrchestrator.ts` without allowing React effects, prompts, or the model to become a second progression authority.

**Checkpoint**: US2 is complete when every matrix cell and named progress sequence has an explicit fixture result and the implementation never produces an invalid status/understanding pair.

## Phase 5: User Story 3 - Validate and Render One Inspectable V3 Decision (Priority: P1)

**Goal**: Enforce the structured v3 contract, bounded learner rendering, and public/private assessment boundary.

**Independent Test**: Validate golden valid/invalid v3 decisions and public projections, then exercise the 80/81 segment and two/three sentence rendering boundaries.

### Tests for User Story 3

- [ ] T019 [P] [US3] Extend v3 contract tests in `tutor-system/src/services/__tests__/tutorDecisionContract.transfer.test.ts` for reason-first serialization, valid/invalid mode pairs, known IDs, option text uniqueness, key cardinality, source evidence, and private-field handling.
- [ ] T020 [P] [US3] Extend rendering tests in `tutor-system/src/services/__tests__/assessmentRendering.test.ts` for canonical A-D order, single/multiple instructions, exactly four options, 80/81 word-like segments, and two/three stem sentences.
- [ ] T021 [P] [US3] Add assessment validation tests in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts` for unknown message IDs, malformed public/private payloads, stale snapshot data, and every invalid rendering boundary.

### Implementation for User Story 3

- [ ] T022 [US3] Align `TutorDecisionV3`, `TransferTurnContext`, and public/private assessment types in `tutor-system/src/types/assessment.ts` with `contracts/tutor-decision-v3.md`, ensuring public projections cannot expose answer keys or transfer basis.
- [ ] T023 [US3] Complete structural v3 and assessment-draft validation in `tutor-system/src/services/tutorDecisionContract.ts` and `tutor-system/src/services/assessmentValidation.ts`, preserving known target/message checks and stable invalid-category errors.
- [ ] T024 [US3] Complete canonical rendering and boundary validation in `tutor-system/src/services/assessmentRendering.ts`, including inclusive/exclusive segment and sentence limits and exact option count.
- [ ] T025 [US3] Implement and test public projection stripping in `tutor-system/src/services/transferAssessmentService.ts`, retaining only the learner-visible DTO fields.

**Checkpoint**: US3 is complete when valid v3 decisions normalize predictably, invalid contract cases reject, rendering boundaries are deterministic, and learner projections contain no private assessment material.

## Phase 6: User Story 4 - Sequence Feedback and Later Transfer Without Chains (Priority: P2)

**Goal**: Replay the complete answer-resolution/orchestrator lifecycle with feedback-first, repair, contradiction, spontaneous, duplicate, stale, and no-chain behavior.

**Independent Test**: Run the named sequence fixtures through the pure orchestrator with injected deterministic inputs and inspect the returned next-action boundary after every step.

### Tests for User Story 4

- [ ] T026 [P] [US4] Add golden sequence tests in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts` for pass -> tutoring feedback -> no retest, fail -> repair -> new signal -> different context, no repair, clarification, assistance, correct-with-reason, contradiction, spontaneous transfer, and multi-target behavior.
- [ ] T027 [P] [US4] Add duplicate/stale/no-chain tests in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts` for repeated sends, repeated answers, stale drafts, stale progress snapshots, and feedback-before-assessment enforcement.
- [ ] T028 [P] [US4] Add the Guard/protective-priority boundary tests in `tutor-system/src/services/__tests__/transferAssessmentService.test.ts`, proving a wrong answer alone does not enter Guard and an independently required Guard/protective response can defer transfer processing.

### Implementation for User Story 4

- [ ] T029 [US4] Implement the pure transfer assessment orchestrator in `tutor-system/src/services/transferAssessmentOrchestrator.ts`, beginning with the required shebang and file-purpose comment, with explicit delivery, resolution, feedback-required, repair, stale, duplicate, and no-chain state transitions.
- [ ] T030 [US4] Integrate `TransferTurnContext`, parser, grader, renderer/validator, and reducer outputs from `tutor-system/src/services/transferAssessmentOrchestrator.ts` into `tutor-system/src/services/transferAssessmentService.ts` while keeping API transport injectable and private key data outside public results.
- [ ] T031 [US4] Add deterministic public exports and consumer-facing result types in `tutor-system/src/types/index.ts` for downstream backend/UI/evaluation consumers without importing private answer material.

**Checkpoint**: US4 is complete when every required lifecycle sequence produces one stable result and no sequence creates an automatic second assessment before feedback and new evidence.

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Verify the component package and prepare an evidence-complete handoff without claiming downstream gates.

- [ ] T032 [P] Run the exact focused W2 suite from `specs/101-transfer-domain/quickstart.md` and record exit status, test counts, and fixture manifest version.
- [ ] T033 [P] Run `npx tsc --noEmit` from `tutor-system/` and record type-check results for all modified public contracts.
- [ ] T034 Run `CI=true npm run test:regression -- --runInBand` and `npm run build` from `tutor-system/`; preserve failures and distinguish unrelated baseline failures from W2 failures.
- [ ] T035 Review `tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md` after implementation changes, update it only if the implemented public contract changes, and record the change in `tutor-system/claude_docs/doc_update_record/documentation_update_record_v20260911_transfer_domain.md`.
- [ ] T036 Produce `specs/101-transfer-domain/implementation-handoff.md` with changed public contracts, fixture/test counts, exact commands, unrun downstream gates, disabled feature flag status, and integration risks for 102 backend and 104 evaluation.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; freezes fixture vocabulary.
- **Foundational (Phase 2)**: Depends on fixture vocabulary and blocks story implementation.
- **US1 (Phase 3)**: Depends on foundational contract/fixture types.
- **US2 (Phase 4)**: Can develop reducer tests in parallel with US1 after foundational types; orchestrator wiring waits for US1 outputs.
- **US3 (Phase 5)**: Contract/rendering tests can proceed after foundational types; public projection changes must be consumed by US1/US4 service tests.
- **US4 (Phase 6)**: Depends on parser, grader, reducer, v3 validation, rendering, and fixture outputs from US1-US3.
- **Polish (Phase 7)**: Depends on all required story checkpoints.

### Parallel Opportunities

- T002/T003, T004/T005/T007 can run in parallel because they touch separate fixture/test concerns.
- T008/T009 and T014/T015 can run in parallel after shared fixture types exist.
- T019/T020/T021 can run in parallel because contract, rendering, and validation coverage are separate test boundaries.
- T026/T027/T028 can run in parallel before the orchestrator implementation.
- T032/T033 can run in parallel after implementation; T034 follows to establish regression/build evidence.

### Implementation Strategy

1. Freeze fixture and contract expectations.
2. Write failing deterministic tests for each boundary.
3. Implement the smallest existing-module changes to make each story pass, using the repository-required TDD workflow.
4. Run each checkpoint before wiring the next boundary.
5. Finish with type, regression, build, and evidence reporting; do not enable the feature or claim downstream gates.

## Task Format Validation

All 36 tasks use the required `- [ ] T###` format. Story-phase tasks use `[US1]` through `[US4]`; parallel tasks use `[P]` only where file/dependency boundaries permit. Every task names an exact repository or specification path.
