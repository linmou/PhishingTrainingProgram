# Tasks: W2 Deterministic Transfer Behavior and Golden Fixtures

**Input**: Design documents from `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain/specs/101-transfer-domain/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`
**Tests**: Required by the specification and repository constitution. Write tests before implementation changes and execute the repository's `fast-multi-agent-tdd` workflow when implementing code.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Freeze the component evidence vocabulary and fixture layout before implementation.

- [X] T001 Review `spec.md`, `plan.md`, `data-model.md`, `contracts/tutor-decision-v3.md`, and `contracts/transfer-domain-determinism.md` against the normative transfer runtime package and record the source SHA in the implementation handoff.
- [X] T002 [P] Define typed golden-fixture records and stable suite/scenario identifiers in `tutor-system/src/services/__tests__/fixtures/transferAssessmentGoldenFixtures.ts`, including contract version, policy version, expected disposition, progress pair, and evidence reference fields.
- [X] T003 Add a fixture manifest index in `tutor-system/src/services/__tests__/fixtures/transferAssessmentGoldenFixtures.ts` for parser boundaries, grader subsets, rendering boundaries, reducer cells, and named lifecycle sequences; include the required beginning-purpose comment.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared type and privacy boundaries required by every user story.

- [X] T004 [P] Add contract-fixture tests for component 101's pure public assessment/result shapes and private-field exclusion in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`, leaving API projection tests to component 102.
- [X] T005 [P] Add v3 mode/instruction/target/payload matrix tests in `tutor-system/src/services/__tests__/tutorDecisionContract.transfer.test.ts` for tutoring with each real teaching instruction, Guard with `guard`, Guard with each real teaching instruction, assessment with `transfer_assess`, and invalid combinations including Guard with `transfer_assess` or non-null target/assessment before changing validation code.
- [X] T006 Reconcile exports and type invariants in `tutor-system/src/types/assessment.ts`, `tutor-system/src/types/learningProgress.ts`, and `tutor-system/src/types/index.ts` so `TutorDecisionV3`, `TransferTurnContext`, public/private assessment data, and valid progress pairs have one owner each.
- [X] T007 Add a deterministic fixture schema validation test in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`, beginning with the required file-purpose comment, proving every fixture has a unique ID, supported contract/policy version, and an expected observable result.

## Phase 3: User Story 1 - Resolve a Delivered Assessment Answer Once (Priority: P1)

**Goal**: Parse and grade explicit learner selections with correct delivery, first-valid, clarification, assistance, duplicate, and stale boundaries.

**Independent Test**: Run the parser, grader, and answer-resolution tests with no provider, database, React, or browser dependency; verify one stable result per delivered question.

### Tests for User Story 1

- [X] T008 [P] [US1] Extend parser boundary tests in `tutor-system/src/services/__tests__/assessmentAnswerParser.test.ts` for exact option text, case/Unicode/full-width normalization, trailing question marks, prefix forms, malformed combinations, ambiguous alternatives, content questions, and semantic near-misses.
- [X] T009 [P] [US1] Extend exhaustive grader tests in `tutor-system/src/services/__tests__/assessmentGrading.test.ts` to evaluate all 16 A-D subsets, duplicate/order normalization, representative single/multiple keys, empty selections, incomplete selections, and over-inclusive selections.
- [X] T010 [US1] Add first-valid answer-resolution and lifecycle sequence tests in `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`, beginning with the required file-purpose comment, for undelivered, correct-with-reason, clarification, assistance, duplicate, stale, and no-chain outcomes.

### Implementation for User Story 1

- [X] T011 [US1] Implement the parser behavior specified in `contracts/transfer-domain-determinism.md` in `tutor-system/src/services/assessmentAnswerParser.ts`, preserving explicit-label-only selection and stable clarification/not-selection categories.
- [X] T012 [US1] Implement exact-set grading and input normalization constraints in `tutor-system/src/services/assessmentGrading.ts`, keeping explanation text outside the grading decision.
- [X] T013 [US1] Extend the pure resolver boundary in `tutor-system/src/services/transferAssessmentOrchestrator.ts` to return stable undelivered, unresolved, passed, failed, assisted, duplicate, and stale dispositions without persistence writes.

**Checkpoint**: US1 is complete when all explicit parser boundaries and all A-D subsets pass, undelivered/first-valid/clarification/assistance behavior is stable, and later answers cannot create a second effect.

## Phase 4: User Story 2 - Apply Transfer Progress Transitions Consistently (Priority: P1)

**Goal**: Make the four valid progress pairs and seven event kinds a complete single reducer authority.

**Independent Test**: Run the 28-cell reducer matrix and stateful repair, contradiction, spontaneous-transfer, no-repair, and multi-target fixtures without transport or persistence.

### Tests for User Story 2

- [X] T014 [P] [US2] Add the complete 28-cell state/event matrix to `tutor-system/src/services/__tests__/learningProgressTransitions.test.ts`, including invalid progress pairs and rejected pass/fail transitions.
- [X] T015 [P] [US2] Add stateful progress sequence fixtures and assertions in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts` for fail/recover, no repair, contradiction reopening, spontaneous transfer, and multi-target preservation.

### Implementation for User Story 2

- [X] T016 [US2] Align the valid progress pair types and guards in `tutor-system/src/types/learningProgress.ts` with the four-row model in `data-model.md` without adding a mastery field or default dataclass-like values.
- [X] T017 [US2] Complete the transition table in `tutor-system/src/services/learningProgressTransitions.ts`, including repair gating, spontaneous transfer, contradiction reopening, no-change preservation, and deterministic invalid-transition errors.
- [X] T018 [US2] Wire reducer outcomes into the pure answer-resolution/orchestrator result model in `tutor-system/src/services/transferAssessmentOrchestrator.ts` without allowing React effects, prompts, or the model to become a second progression authority.

**Checkpoint**: US2 is complete when every matrix cell and named progress sequence has an explicit fixture result and the implementation never produces an invalid status/understanding pair.

## Phase 5: User Story 3 - Validate and Render One Inspectable V3 Decision (Priority: P1)

**Goal**: Enforce the structured v3 contract, bounded learner rendering, and public/private assessment boundary.

**Independent Test**: Validate golden valid/invalid v3 decisions and component 101 pure public output contracts, then exercise the 80/81 segment and two/three sentence rendering boundaries; component 102 separately verifies API projection.

### Tests for User Story 3

- [X] T019 [P] [US3] Extend v3 contract tests in `tutor-system/src/services/__tests__/tutorDecisionContract.transfer.test.ts` for reason-first serialization; tutoring with a real teaching instruction; Guard with `guard` or a real teaching instruction and null target/assessment; assessment with `transfer_assess`, known target, and payload; plus invalid IDs, option text uniqueness, key cardinality, source evidence, and private-field handling.
- [X] T020 [P] [US3] Extend rendering tests in `tutor-system/src/services/__tests__/assessmentRendering.test.ts` for canonical A-D order, single/multiple instructions, exactly four options, 80/81 word-like segments, and two/three stem sentences.
- [X] T021 [P] [US3] Add assessment validation tests in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts` for unknown message IDs, malformed public/private payloads, stale snapshot data, and every invalid rendering boundary.

### Implementation for User Story 3

- [X] T022 [US3] Align `TutorDecisionV3`, `TransferTurnContext`, and public/private assessment types in `tutor-system/src/types/assessment.ts` with `contracts/tutor-decision-v3.md`, ensuring component 101 public contracts contain no answer key, transfer basis, API operation, or transport field.
- [X] T023 [US3] Complete structural v3 and assessment-draft validation in `tutor-system/src/services/tutorDecisionContract.ts` and `tutor-system/src/services/assessmentValidation.ts`, accepting Guard with `guard` or a real teaching instruction only when target/assessment are null while preserving tutoring/assessment rules, known target/message checks, and stable invalid-category errors.
- [X] T024 [US3] Complete canonical rendering and boundary validation in `tutor-system/src/services/assessmentRendering.ts`, including inclusive/exclusive segment and sentence limits and exact option count.
- [X] T025 [US3] Define and test component 101's pure public assessment and lifecycle-result output types in `tutor-system/src/types/assessment.ts` and `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts` for component 102 consumption, without implementing API projection.

**Checkpoint**: US3 is complete when valid v3 decisions normalize predictably, invalid contract cases reject, rendering boundaries are deterministic, and 101's pure public output contracts contain no private assessment or transport material.

## Phase 6: User Story 4 - Sequence Feedback and Later Transfer Without Chains (Priority: P2)

**Goal**: Replay the complete answer-resolution/orchestrator lifecycle with feedback-first, repair, contradiction, spontaneous, duplicate, stale, and no-chain behavior.

**Independent Test**: Run the named sequence fixtures through the pure orchestrator with injected deterministic inputs and inspect the returned next-action boundary after every step.

### Tests for User Story 4

- [X] T026 [P] [US4] Add golden sequence tests in `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts` for pass -> tutoring feedback -> no retest, fail -> repair -> new signal -> different context, no repair, clarification, assistance, correct-with-reason, contradiction, spontaneous transfer, and multi-target behavior.
- [X] T027 [P] [US4] Add duplicate/stale/no-chain tests in `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts` for repeated delivery events, repeated answers, stale draft inputs, stale progress snapshots, and feedback-before-assessment enforcement.
- [X] T028 [US4] Add the Guard/protective-priority boundary tests in `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`, proving a wrong answer alone does not enter Guard and an independently required Guard/protective response can defer transfer processing.

### Implementation for User Story 4

- [X] T029 [US4] Implement the pure transfer assessment orchestrator in `tutor-system/src/services/transferAssessmentOrchestrator.ts`, beginning with the required shebang and file-purpose comment, with explicit delivery, resolution, feedback-required, repair, stale, duplicate, and no-chain state transitions.
- [X] T030 [US4] Compose `TransferTurnContext`, parser, grader, renderer/validator, and reducer outputs behind the pure entry point in `tutor-system/src/services/transferAssessmentOrchestrator.ts`, returning only the typed outputs component 102 needs for facade integration.
- [X] T031 [US4] Add deterministic public exports and consumer-facing result types in `tutor-system/src/types/index.ts` for downstream backend/UI/evaluation consumers without importing private answer material.

**Checkpoint**: US4 is complete when every required lifecycle sequence produces one stable result and no sequence creates an automatic second assessment before feedback and new evidence.

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Verify the component package and prepare an evidence-complete handoff without claiming downstream gates.

- [X] T032 [P] Run the exact focused W2 suite from `specs/101-transfer-domain/quickstart.md` and record exit status, test counts, and fixture manifest version.
- [X] T033 [P] Run `npx tsc --noEmit` from `tutor-system/` and record type-check results for all modified public contracts.
- [X] T034 Run `CI=true npm run test:regression -- --runInBand` and `npm run build` from `tutor-system/`; preserve failures and distinguish unrelated baseline failures from W2 failures.
- [X] T035 Review `tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md` after implementation changes, update it only if the implemented public contract changes, and record the change in `tutor-system/claude_docs/doc_update_record/documentation_update_record_v20260911_transfer_domain.md`.
- [X] T036 Produce `specs/101-transfer-domain/implementation-handoff.md` with changed public contracts, fixture/test counts, exact commands, unrun downstream gates, disabled feature flag status, and integration risks for 102 backend and 104 evaluation.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; freezes fixture vocabulary.
- **Foundational (Phase 2)**: Depends on fixture vocabulary and blocks story implementation.
- **US1 (Phase 3)**: Depends on foundational contract/fixture types.
- **US2 (Phase 4)**: Can develop reducer tests in parallel with US1 after foundational types; orchestrator wiring waits for US1 outputs.
- **US3 (Phase 5)**: Contract/rendering tests can proceed after foundational types; component 102 consumes the resulting pure public contracts in its separately owned facade/projection tests.
- **US4 (Phase 6)**: Depends on parser, grader, reducer, v3 validation, rendering, and fixture outputs from US1-US3.
- **Polish (Phase 7)**: Depends on all required story checkpoints.

### Component Ownership Traceability

| Contract or artifact | Component 101 task ownership | Component 102 integration ownership |
|---|---|---|
| `TutorDecisionV3`, `TransferTurnContext`, progress/public result types | T006, T022, T025, T031 | Consume types without redefining mode or privacy rules. |
| Parser, grader, renderer, validator, reducer | T008-T009, T011-T012, T014-T024 | Invoke pure outputs at the backend/facade boundary. |
| Pure answer-resolution/orchestrator | T010, T013, T018, T026-T030 | Integrate orchestrator result into API operations and persistence. |
| Golden fixtures | T002-T004, T007, T015, T021, T026 | Reuse fixtures for handoff/integration tests where the real boundary is available. |
| `transferAssessmentService.ts` and its test | No component 101 task; explicitly excluded | Sole owner of facade transport, API DTO projection, and facade tests. |

### Parallel Opportunities

- T002 can run in parallel with unrelated setup review, then T003 extends the same fixture file; T004 and T005 can run in parallel, then T007 extends T004's fixture test file.
- T008/T009 and T014/T015 can run in parallel after shared fixture types exist.
- T019/T020/T021 can run in parallel because contract, rendering, and validation coverage are separate test boundaries.
- T026 and T027 can run in parallel before orchestrator implementation; T028 follows T027 in the same orchestrator test file.
- T032/T033 can run in parallel after implementation; T034 follows to establish regression/build evidence.

### Implementation Strategy

1. Freeze fixture and contract expectations.
2. Write failing deterministic tests for each boundary.
3. Implement the smallest existing-module changes to make each story pass, using the repository-required TDD workflow.
4. Run each checkpoint before wiring the next boundary.
5. Finish with type, regression, build, and evidence reporting; do not enable the feature or claim downstream gates.

## Task Format Validation

All 36 tasks use the required `- [ ] T###` format. Story-phase tasks use `[US1]` through `[US4]`; parallel tasks use `[P]` only where file/dependency boundaries permit. Every task names an exact repository or specification path.
