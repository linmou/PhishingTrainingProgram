---
description: "Dependency-ordered two-attempt transfer evaluation and explanation evidence tasks"
---

# Tasks: Two-Attempt Transfer Behavior Evaluation

**Input**: Design documents from `/specs/104-transfer-evaluation/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, and `contracts/`
**Scope**: T001-T044 document the already-implemented baseline harness and are retained as historical context. The upgrade implementation starts at T045. Component 101 owns lifecycle semantics; component 102 owns attempt persistence, role-safe DTOs, production request/prompt/provider behavior; component 104 owns evaluation consumption, explanation judgment, parity tests, immutable evidence, and gates. Production implementation, database/auth, React UI, and release browser work remain excluded.

## TransferLearning Refactor Tasks (2026-09-29)

- [ ] R401 Update active cases for semantic evidence, two distinct room target sets, mandatory assessment routing, and each blocker; preserve shared-tutor tutoring/Guard regression cases.
- [ ] R402 Assert production/evaluation assessment-only request parity and zero shared-tutor calls for eligible and provider-failure paths.
- [ ] R403 Run the revised quality checks without changing immutable historical results.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the versioned evaluation workspace and source-of-truth boundaries before authoring transfer cases.

- [x] T001 Record the canonical source-plan path and SHA-256, T09/response-contract/evaluation-plan references, and component ownership in `specs/104-transfer-evaluation/research.md`.
- [x] T002 [P] Document the existing v1 runner/evaluator/gate entry points, legacy regression boundary, and immutable result-directory convention in `specs/104-transfer-evaluation/plan.md`.
- [x] T003 [P] Create the transfer artifact index and ownership map in `specs/104-transfer-evaluation/integration-edge.md`, declaring component 102 ownership of the shared `ecologicalTutorCall.ts` v3 builder, production prompt reference/hash, provider-secret path, and product token setting; declare component 104 ownership of evaluation consumption/tests and the separate 101/105 release gates.
- [x] T004 Validate the planning package paths, template completion, source hash, and absence of unresolved placeholders using `specs/104-transfer-evaluation/checklists/requirements.md` and `specs/104-transfer-evaluation/quickstart.md`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Freeze shared data, metric, manifest, and gate contracts before any prompt candidate is evaluated.

**Checkpoint**: No case authoring, calibration, baseline, candidate, or holdout execution may begin until these contracts and their validation fixtures are complete.

- [x] T005 [P] Define the machine-readable transfer case schema and target/evaluator projection rules in `evals/promptfoo/v1/transfer/case-schema.json`, preserving evaluator-label isolation.
- [x] T006 [P] Define the baseline versioned metric registry for the five original public T09 rubric IDs and `t09_contract_and_progress` in `evals/promptfoo/v1/transfer/metric-registry.json`.
- [x] T007 [P] Define the immutable run manifest shape, partition registry, shared-builder/prompt/adapter hash list, product/evaluation effective-token settings, parity record, and per-case evidence envelope in `evals/promptfoo/v1/transfer/manifest-schema.json`.
- [x] T008 [P] Define the transfer-specific gate thresholds, hard partitions, pair rule, non-regression rule, missing/error verdicts, and pre-scoring shared-contract/hash/1,200-token/parity blockers in `evals/promptfoo/v1/transfer/gate-policy.json`.
- [x] T009 Write schema and manifest validation tests first in `evals/promptfoo/v1/transfer/case-schema.test.js`; begin the test with the file-purpose comment required by `AGENTS.md` and cover missing fields, target-label leakage, pair cardinality, holdout exposure, version drift, missing shared contract/prompt hashes, non-1,200 budgets, and forbidden secret metadata.
- [x] T010 Implement the schema/manifest validators in `evals/promptfoo/v1/transfer/case-schema.js`; begin the executable file with a shebang and concise purpose comment, and keep it independent of model/provider calls.

## Phase 3: User Story 1 - Freeze the Transfer Evaluation Contract (Priority: P1)

**Goal**: Produce versioned transfer cases, rubric declarations, and comparable partitions that preserve the T09 contract before prompt edits.

**Independent Test**: Validate the complete transfer manifest and assert that all required fields, rubric IDs, case roles, T09 mappings, partitions, pair/transition metadata, and holdout eligibility are present without evaluator labels in target inputs.

### Tests for User Story 1

- [x] T011 [P] [US1] Write manifest completeness, metric-registration, and shared-request parity tests first in `evals/promptfoo/v1/transfer/manifest.test.js` and `shared-request-contract.test.js`, with required file-purpose comments and failures for missing rubric IDs/partitions, duplicate case versions, incomplete T09 mappings, changed shared-builder or production-prompt hashes, unequal normalized product/evaluation messages, non-1,200 effective budgets, evaluator-label leakage, copied prompt text, and provider-secret leakage.
- [x] T012 [P] [US1] Write case role and partition coverage tests first in `evals/promptfoo/v1/transfer/coverage.test.js`, with the required file-purpose comment and assertions for positive, negative, boundary, recovery, regression, multi-target, Guard, clarification, assistance, contradiction, spontaneous-transfer, and semantic-pair roles.

### Implementation and Fixtures for User Story 1

- [x] T013 [US1] Author versioned transfer case inputs, evaluator-only expected labels, applicability, source provenance, pair/transition metadata, and holdout eligibility in `evals/promptfoo/v1/transfer/cases.json`.
- [x] T014 [US1] Register case versions, required partitions, metric mappings, repetitions, seed policy, thresholds, shared v3 builder and backend prompt references/hashes, both effective 1,200-token settings, adapter hash, and parity fixture/result hashes in `evals/promptfoo/v1/transfer/manifest.json`.
- [x] T015 [P] [US1] Author the baseline instruction files for the original four semantic rubrics in `evals/promptfoo/rubrics/v1/transfer_trigger_target.md`, `medium_transfer_quality.md`, `assessment_item_validity.md`, and `verification_evidence.md`; author baseline deterministic `assessment_followup` separately in `evals/promptfoo/rubrics/v1/assessment_followup.md`.
- [x] T016 [P] [US1] Register transfer rubric versions, methods, thresholds, hard partitions, and applicability in `evals/promptfoo/rubrics/v1/manifest.json` without altering historical v0/v1 meanings.
- [x] T017 [US1] Implement `evals/promptfoo/v1/transfer/adapter.js` and its shared-contract consumer `evals/promptfoo/v1/transfer/shared-request-contract.js` (the TypeScript boundary hook, production-source hashing, transfer call-site setting extraction, and frozen transfer target settings, consumed by both T017 and T028) as a thin evaluation projection/invocation shim that consumes the component-102-owned versioned v3 builder and contract identity exported through `tutor-system/src/services/ecologicalTutorCall.ts`; begin the new executable file with a shebang and purpose comment, pass only target-visible case fields, preserve the shared backend prompt reference/hash and 1,200-token budget, and do not construct messages, copy prompt text, or resolve provider endpoints/secrets.

## Phase 4: User Story 2 - Prove Deterministic Transfer Lifecycle Behavior (Priority: P1)

**Goal**: Make exact v3 contract, selection, progress, rendering, and follow-up failures visible independently of semantic judgment.

**Independent Test**: Run deterministic fixtures across every declared valid/invalid contract outcome and stateful lifecycle sequence; require exact expected/actual evidence and zero unresolved errors.

### Tests for User Story 2

- [x] T018 [P] [US2] Write deterministic contract and progress tests first in `evals/promptfoo/v1/transfer/contract-checks.test.js`, with the required file-purpose comment and coverage for known IDs, reason-first serialization, mode/instruction combinations, four A-D options, key cardinality, rendering limits, exact-set grading, valid progress pairs, and room-mode separation.
- [x] T019 [P] [US2] Write the historical baseline follow-up tests in `evals/promptfoo/v1/transfer/followup.test.js`, preserving their original first-resolution contract for versioned regression comparison.
- [x] T020 [P] [US2] Write semantic-pair and stateful-join tests first in `evals/promptfoo/v1/transfer/pair-transition.test.js`, with the required file-purpose comment and failure cases for missing members, wrong member outcomes, missing steps, and mismatched target-generation identities.

### Implementation for User Story 2

- [x] T021 [US2] Implement `t09_contract_and_progress` and its exact expected/actual evidence shape in `evals/promptfoo/v1/transfer/contract-checks.js`; begin the executable file with a shebang and purpose comment.
- [x] T022 [US2] Implement deterministic lifecycle and ordered-turn checks in `evals/promptfoo/v1/transfer/followup-checks.js`; begin the executable file with a shebang and purpose comment, and preserve `missing`/`error` separately from behavior `fail`.
- [x] T023 [US2] Register transfer deterministic checks with the shared v1 evaluator in `evals/promptfoo/v1/evaluator.js` through a versioned adapter path, without replacing legacy checks or generating a second target response.
- [x] T024 [US2] Add deterministic fixture inputs and expected transitions for positive, negative, boundary, recovery, regression, Guard, clarification, assistance, contradiction, spontaneous-transfer, and multi-target sequences in `evals/promptfoo/v1/transfer/fixtures/`.

## Phase 5: User Story 3 - Measure Frozen Transfer Semantics (Priority: P1)

**Goal**: Preserve baseline calibration for the original semantic rubrics and comparable historical evidence before the upgrade.

**Independent Test**: Execute calibration and unchanged baseline/candidate comparisons on the same frozen development/regression manifest, then run baseline and candidate on eligible sealed holdouts after candidate freeze; preserve all raw and typed evidence.

### Tests and Calibration for User Story 3

- [x] T025 [P] [US3] Write baseline calibration contract tests in `evals/promptfoo/v1/transfer/calibration.test.js` for the original semantic rubric IDs; keep deterministic `assessment_followup` outside judge calibration.
- [x] T026 [P] [US3] Write baseline/candidate comparability tests first in `evals/promptfoo/v1/transfer/comparison.test.js`, with the required file-purpose comment and failures for changed case versions, metric versions, settings, repetitions, target identities, partition membership, shared-builder hash, production-prompt reference/hash, effective 1,200-token budget, or normalized product/evaluation request identity.

### Implementation and Evidence for User Story 3

- [x] T027 [US3] Implement transfer judge calibration and immutable calibration records in `evals/promptfoo/v1/transfer/calibrate.js`; begin the executable file with a shebang and purpose comment, and preserve raw judge requests/responses and adjudication metadata.
- [x] T028 [US3] Register transfer cases, rubric IDs, shared v3 contract version/hash, backend production prompt reference/hash, and the T017 thin consumer with the existing v1 runner in `evals/promptfoo/v1/runner.js` through `evals/promptfoo/v1/transfer/runner-config.js`; begin any new executable file with a shebang and purpose comment, obtain the 1,200-token setting from the component-102-owned shared contract, and reject any local prompt/request/provider-secret override.
- [x] T029 [US3] Record the historical baseline stage as partial/unrun with declared changed-factor metadata in `specs/104-transfer-evaluation/verification-record.md`, without claiming a completed verdict.
- [x] T030 [US3] Record the historical candidate stage as unrun and preserve the required builder/prompt/adapter freeze conditions in `specs/104-transfer-evaluation/verification-record.md`.
- [x] T031 [US3] Reserve `evals/promptfoo/holdouts/transfer-sealed/` and document that independent holdouts remain blocked until candidate freeze.
- [x] T032 [US3] Define the write-once raw target/judgment/deterministic evidence contract for future `evals/promptfoo/results/<model>/<run-id>/` records.

## Phase 6: User Story 4 - Preserve Complete, Blocking Evidence (Priority: P2)

**Goal**: Enforce the transfer quality gate and produce an evidence report that cannot hide missing coverage, errors, regression, or pair failure.

**Independent Test**: Run the gate fixture matrix with pass, missing, error, zero-coverage, below-threshold, above-threshold regression, incomparable-baseline, conditional-inapplicability, and one-member pair failures; verify every blocking fixture returns a non-pass verdict.

### Tests for User Story 4

- [x] T033 [P] [US4] Write the blocking gate tests first in `evals/promptfoo/v1/transfer/quality-gate.test.js`, with the required file-purpose comment and explicit missing, error, zero-coverage, regression, pair, incomplete-manifest, exact-denominator, shared-builder/prompt hash mismatch, product/evaluation request mismatch, and non-1,200 budget assertions.
- [x] T034 [P] [US4] Write raw-evidence completeness and immutability tests first in `evals/promptfoo/v1/transfer/evidence-record.test.js`, with the required file-purpose comment and checks for input/output/judgment/metadata preservation, write-once runs, evaluator-only metadata separation, prompt-reference-without-prompt-copying, credential/secret redaction, and partial-run blocking.
- [x] T035 [P] [US4] Write non-substitution report tests first in `evals/promptfoo/v1/transfer/release-boundary.test.js`, with the required file-purpose comment and assertions that Promptfoo evidence cannot claim database/auth/browser/activation/rollback acceptance.

### Implementation for User Story 4

- [x] T036 [US4] Implement the transfer-aware blocking gate and exact partition/metric/pair/regression diagnostics in `evals/promptfoo/v1/transfer/quality-gate.js`; begin the executable file with a shebang and purpose comment.
- [x] T037 [US4] Register the transfer gate with the existing v1 gate entry point in `evals/promptfoo/v1/gate.js`, preserving legacy metrics and making transfer rows fail closed on missing/error/zero coverage.
- [x] T038 [US4] Implement immutable run snapshot and evidence-record writing in `evals/promptfoo/v1/transfer/evidence-record.js`; begin the executable file with a shebang and purpose comment and never overwrite an existing run ID.
- [x] T039 [US4] Produce a transfer evaluation report with final verdict, exact fractions, applicability, raw-evidence links, regression/pair failures, calibration status, and non-substitution statement in `evals/promptfoo/v1/transfer/report.js`; begin the executable file with a shebang and purpose comment.
- [x] T040 [US4] Document unresolved component 102 dependencies in `specs/104-transfer-evaluation/integration-edge.md`: shared `ecologicalTutorCall.ts` v3 builder/identity, backend prompt reference/hash, production 1,200-token setting, and provider-path integration; keep component 104 limited to adapter consumption/tests and do not modify or duplicate production prompt/provider files.

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Reconcile planning artifacts, documentation, and handoff evidence before integration.

- [x] T041 [P] Run the complete deterministic/gate test command from `specs/104-transfer-evaluation/quickstart.md` and preserve its exit status and counts in `specs/104-transfer-evaluation/verification-record.md`.
- [x] T042 [P] Review the nearest evaluation documentation and record any required doc update in `tutor-system/claude_docs/doc_update_record/` only when an implementation change alters canonical behavior; do not edit canonical docs from this component without an approved integration change.
- [x] T043 Re-run the read-only cross-artifact analysis against `specs/104-transfer-evaluation/spec.md`, `plan.md`, and `tasks.md`, resolve every CRITICAL/HIGH finding before handoff, and include the final report in the integration handoff.
- [x] T044 Confirm the feature flag remains disabled and that no database/auth/UI/browser/release claim is made in `specs/104-transfer-evaluation/verification-record.md`.

## Phase 8: Upgrade Gate (Blocking Prerequisites)

**Purpose**: Bind the upgrade to real promoted producer contracts before any executable change.

- [ ] T045 Record promoted component 101 contract commit/hash, component 102 planning commit `a8c8b31a91bcc1970071117ac0dbbd2dffce85ef` plus its final reconciled commit/hash, integration promotion SHA, canonical T09 reconciliation reference, and ownership boundaries in `specs/104-transfer-evaluation/integration-edge.md`.
- [ ] T046 [P] Record the authorized `qwen3.5-flash` target/judge and DashScope-compatible provider decision from integration commit `df40f32`, required environment variable names, and no-fallback rule in `specs/104-transfer-evaluation/quickstart.md` and `evals/promptfoo/v1/transfer/manifest.json`.
- [ ] T047 Activate the repository `fast-multi-agent-tdd` workflow for the executable upgrade and record its request map/scope before changing tests or harness code under `audits/transfer_eval_two_attempt_*`.

## Phase 9: User Story 1 - Freeze the Upgraded Contract (Priority: P1)

**Goal**: Version the existing harness for promoted lifecycle, explanation, request-parity, and evidence contracts.

**Independent Test**: The schema/manifest suite rejects missing promoted hashes, first-incorrect terminal fixtures, incomplete attempt sequences, missing explanation provenance, and target/judge configuration drift.

- [ ] T048 [P] [US1] Write failing upgraded schema and manifest tests in `evals/promptfoo/v1/transfer/case-schema.test.js` and `manifest.test.js` for `attempt_sequence`, explanation evidence, promoted 101/102 hashes, six rubric IDs, two supporting checks, and `qwen3.5-flash` provider settings.
- [ ] T049 [P] [US1] Write failing coverage tests in `evals/promptfoo/v1/transfer/coverage.test.js` for correct-first, wrong-then-correct, wrong-then-wrong, reload, separate-tab, concurrent, replay, stale, malformed, unauthorized, assistance, Guard, post-terminal, and explanation-quality roles.
- [ ] T050 [US1] Version the schema, metric registry, manifest schema, gate policy, and frozen manifest in `evals/promptfoo/v1/transfer/case-schema.json`, `metric-registry.json`, `manifest-schema.json`, `gate-policy.json`, and `manifest.json` without editing historical run artifacts.
- [ ] T051 [US1] Add upgraded development/regression cases and ordered expected states to `evals/promptfoo/v1/transfer/cases.json` and `evals/promptfoo/v1/transfer/fixtures/contract-fixtures.json`, consuming promoted outcome fields without reimplementing grading.

## Phase 10: User Story 2 - Prove Two-Attempt Lifecycle (Priority: P1)

**Goal**: Make every attempt, retry, terminal, replay, and progress transition observable with exact authoritative before/after evidence.

**Independent Test**: Deterministic fixtures enforce at most two consumed valid attempts, first-wrong retry, correct-on-either pass, second-wrong fail, and exactly one terminal transition across reload/tab/concurrency variants.

- [ ] T052 [P] [US2] Write failing lifecycle tests in `evals/promptfoo/v1/transfer/followup.test.js` for the full attempt matrix, non-consuming dispositions, concurrent second submissions, idempotent replay, and post-terminal/third submissions.
- [ ] T053 [P] [US2] Write failing producer-contract compatibility tests in `evals/promptfoo/v1/transfer/contract-checks.test.js` for promoted `TransferAttemptSnapshot`/`TransferResolvedAssessment`; exact `PublicAssessmentDTO {id, student_id, selection_type, stem, options}` with no `rendered_text`; and every canonical `ProcessedMessageDTO` field including `processing_state`, `answer_outcome`, and terminal-feedback cardinality.
- [ ] T054 [US2] Upgrade deterministic lifecycle evaluation in `evals/promptfoo/v1/transfer/followup-checks.js` to compare promoted authoritative snapshots and dispositions while preserving distinct `fail`, `missing`, and `error` evidence.
- [ ] T055 [US2] Upgrade contract/progress checks and evaluator registration in `evals/promptfoo/v1/transfer/contract-checks.js` and `evals/promptfoo/v1/evaluator.js` without calculating answer correctness or mutating attempt state.

## Phase 11: User Story 3 - Evaluate Explanation Quality and Disclosure (Priority: P1)

**Goal**: Judge the reviewed explanation semantically and prove role/stage disclosure deterministically.

**Independent Test**: Calibration distinguishes correct from incorrect/irrelevant/contradictory/privacy-unsafe explanations, and disclosure fixtures expose key plus explanation only for an authorized second-incorrect terminal failure.

- [ ] T056 [P] [US3] Write failing semantic calibration tests in `evals/promptfoo/v1/transfer/calibration.test.js` for positive, incorrect, irrelevant, contradictory, missing, privacy-unsafe, teacher-edited, judge-error, and disagreement examples.
- [ ] T057 [P] [US3] Write failing disclosure/provenance tests in `evals/promptfoo/v1/transfer/contract-checks.test.js` and `evidence-record.test.js` for the exact public-assessment allowlist, prohibited `rendered_text`, delivery, first incorrect, pass, second-incorrect terminal, partial feedback, wrong-role, and generated-versus-reviewed value cases.
- [ ] T058 [US3] Add the `learner_explanation_quality` rubric and registry entry in `evals/promptfoo/rubrics/v1/learner_explanation_quality.md`, `evals/promptfoo/rubrics/v1/manifest.json`, and `evals/promptfoo/v1/transfer/metric-registry.json` with one semantic property and frozen calibration rules.
- [ ] T059 [US3] Implement/register `learner_explanation_disclosure` in `evals/promptfoo/v1/transfer/contract-checks.js` and `evals/promptfoo/v1/evaluator.js` using explicit DTO allowlists, stage, identity, and provenance rather than keyword matching.
- [ ] T060 [US3] Preserve generated/reviewed explanation values, edit provenance, reviewed-value judgment, terminal learner projection, and full input-output pairs in `evals/promptfoo/v1/transfer/evidence-record.js`.

## Phase 12: User Story 4 - Preserve Comparable Blocking Evidence (Priority: P2)

**Goal**: Fail closed on request drift, missing attempt/explanation coverage, regression, or provider mismatch.

**Independent Test**: Gate fixtures produce no accepted verdict for any missing lifecycle/disclosure row, explanation failure, upstream hash drift, provider mismatch, request mismatch, or baseline regression.

- [ ] T061 [P] [US4] Write failing request-parity/comparison tests in `evals/promptfoo/v1/transfer/shared-request-contract.test.js` and `comparison.test.js` for promoted builder/prompt/context hashes, canonical public/result DTO field names, terminal explanation request shape, configured `REACT_APP_OAI_*` target/judge provider settings and exact model, and normalized request equality.
- [ ] T062 [P] [US4] Write failing quality-gate tests in `evals/promptfoo/v1/transfer/quality-gate.test.js` for lifecycle/disclosure hard checks, explanation thresholds, missing promoted hashes, zero coverage, semantic pairs, provider mismatch, and non-regression.
- [ ] T063 [US4] Upgrade shared-request consumption, runner registration, and comparison in `evals/promptfoo/v1/transfer/shared-request-contract.js`, `runner-config.js`, and `comparison.js` without copying the production prompt or provider-secret logic.
- [ ] T064 [US4] Upgrade the blocking gate, immutable report, and non-substitution diagnostics in `evals/promptfoo/v1/transfer/quality-gate.js` and `report.js`.
- [ ] T065 [US4] Run the complete offline transfer suite and manifest/gate commands from `specs/104-transfer-evaluation/quickstart.md`; record commands, exit codes, counts, tested SHA, and logs in `specs/104-transfer-evaluation/verification-record.md`.
- [ ] T066 [US4] Calibrate `learner_explanation_quality` and run comparable baseline/candidate development evidence with target and judge `qwen3.5-flash` through the existing DashScope-compatible provider; preserve full inputs/outputs/settings under new immutable `evals/promptfoo/results/qwen3.5-flash/<run-id>/` directories.
- [ ] T067 [US4] Freeze the candidate, execute independently authored sealed holdouts from `evals/promptfoo/holdouts/transfer-sealed/` into immutable `evals/promptfoo/results/qwen3.5-flash/<run-id>/` directories, and run `evals/promptfoo/v1/gate.js` without overwriting or exposing holdouts before freeze.
- [ ] T068 [US4] Record exact accepted/failed/incomplete verdicts, regressions, missing/error rows, changed experimental factors, and non-substitution boundaries in `specs/104-transfer-evaluation/verification-record.md`.

## Phase 13: Planning and Integration Closeout

- [ ] T069 Re-run read-only Spec Kit analysis over `specs/104-transfer-evaluation/spec.md`, `plan.md`, and `tasks.md`; resolve every CRITICAL/HIGH planning defect before implementation handoff.
- [ ] T070 Update `specs/104-transfer-evaluation/integration-edge.md` with actual promotion/test SHAs and exact 101->104 and 102->104 handoff commands, leaving database/UI/browser/release claims to integration.
- [ ] T071 Review `evals/promptfoo/README.md` and `evals/promptfoo/AI_BEHAVIOR_EVALUATION_GUIDE.md` before commit and update only documentation whose described evaluation behavior changed.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; establishes source and ownership boundaries.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story until schema, metric, manifest, and gate contracts validate.
- **User Story 1 (Phase 3)**: Depends on Foundational; freezes cases, rubric registration, partitions, and adapter projections.
- **User Story 2 (Phase 4)**: Depends on Foundational and consumes the US1 case/manifest contract; deterministic checks must be complete before semantic run acceptance.
- **User Story 3 (Phase 5)**: Depends on US1 and US2; calibration precedes baseline, baseline precedes candidate, and candidate freeze precedes holdouts.
- **User Story 4 (Phase 6)**: Depends on US1-US3; gate tests may use synthetic reports before live runs, but acceptance requires complete immutable evidence.
- **Polish (Phase 7)**: Depends on all required evidence and must precede integration handoff.
- **Upgrade Gate (Phase 8)**: Depends on promoted 101/102 contract SHAs and canonical T09 reconciliation; blocks all upgrade executable work.
- **Upgraded US1 (Phase 9)**: Depends on Phase 8 and freezes versioned schema/manifest contracts.
- **Upgraded US2 (Phase 10)**: Depends on Phase 9 and completes deterministic attempt evidence.
- **Upgraded US3 (Phase 11)**: Depends on Phase 9; semantic/disclosure work consumes the frozen explanation contract and may proceed alongside late US2 implementation where files do not overlap.
- **Upgraded US4 (Phase 12)**: Depends on US2/US3 and the shared request contract; live runs follow offline green, calibration, baseline, and candidate-freeze order.
- **Closeout (Phase 13)**: Depends on every required offline/live result and integration handoff.

### Parallel Opportunities

- T002-T003 can run in parallel after source inspection.
- T005-T008 can run in parallel because they are separate contract files.
- T011-T012 and T018-T020 can run in parallel within their story, followed by their implementations.
- T015-T016 and T025-T026 can run in parallel with case/runner work once the public IDs and manifest are frozen.
- T033-T035 can run in parallel because each tests a separate gate failure surface.
- T048-T049, T052-T053, T056-T057, and T061-T062 are paired Red tasks on separate files and may run in parallel only within the repository TDD controller's authorized phase/capacity.

## Requirement Traceability

| Requirement | Covered by tasks |
|---|---|
| FR-001 | T005, T009, T010, T013, T014 |
| FR-002 | T005, T009, T017 |
| FR-003 | T006, T015, T016, T028, T058 |
| FR-004 | T006, T015, T025, T027 |
| FR-005 | T006, T018, T021, T023, T057, T059 |
| FR-006 | T012, T024 |
| FR-007 | T019, T024, T052, T054, T055 |
| FR-008 | T014, T027, T029, T031 |
| FR-009 | T026, T029, T030 |
| FR-010 | T012, T031 |
| FR-011 | T007, T014, T032, T038 |
| FR-012 | T007, T032, T034 |
| FR-013 | T008, T033, T036, T037, T050, T060, T062 |
| FR-014 | T008, T036, T037 |
| FR-015 | T036, T039, T062, T064 |
| FR-016 | T003, T035, T039, T044 |
| FR-017 | T003, T028, T030, T040 |
| FR-018 | T001, T041, T044 |
| FR-019 | T003, T011, T017, T028, T040 |
| FR-020 | T007, T009, T011, T014, T026, T028, T030, T033 |
| FR-021 | T005, T009, T011, T017, T028, T034 |
| FR-022 | T007, T008, T011, T014, T026, T030, T033, T038 |
| FR-023 | T048, T050, T051, T052, T054, T060 |
| FR-024 | T051, T052, T054, T055 |
| FR-025 | T049, T051, T052, T054 |
| FR-026 | T049, T051, T052, T053 |
| FR-027 | T056, T058, T060, T066 |
| FR-028 | T057, T059, T060, T062 |
| FR-029 | T057, T060 |
| FR-030 | T056, T058, T062, T064 |
| FR-031 | T045, T048, T050, T061, T062 |
| FR-032 | T046, T061, T063, T066 |
| SC-001 | T011, T014, T016, T048, T050, T058 |
| SC-002 | T018, T021, T024, T052, T053, T054, T055 |
| SC-003 | T032, T034, T060, T065 |
| SC-004 | T025, T027, T056, T058, T066 |
| SC-005 | T026, T030, T036, T037, T062, T064, T066 |
| SC-006 | T033, T062 |
| SC-007 | T035, T039, T044 |
| SC-008 | T011, T017, T026, T028, T033, T034, T061, T063 |
| SC-009 | T051, T057, T059, T062, T065 |
| SC-010 | T056, T058, T066, T068 |

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 case/metric/manifest freeze.
3. Complete US2 deterministic checks and gate fixtures.
4. Stop and validate the offline contract/gate suite; no live model calls are required for this checkpoint.

### Incremental Delivery

1. Add calibrated semantic rubrics and comparable development baseline/candidate evidence.
2. Freeze the candidate and execute independent holdouts.
3. Complete immutable report and integration-edge handoff.
4. Leave database/authentication, production provider-path, browser, activation, and rollback gates to their owners.

## Notes

- Every new test file must begin with a comment naming the file and the behavior it covers.
- Every new executable script must begin with a shebang and a concise purpose comment.
- TDD execution belongs to the later implementation turn; this branch currently contains planning artifacts only.
- The root `AGENTS.md` and integration/orchestration records are not modified; context update remains deferred to integration.
- Component 104 must stop at a blocking integration dependency if component 102 has not exported the shared v3 builder/identity, backend prompt reference/hash, and effective 1,200-token contract; no evaluation-local fallback is permitted.
- Upgrade execution must also stop until component 101/102 lifecycle/DTO contracts are promoted and canonical T09 is reconciled. Target/judge execution must use `qwen3.5-flash` through the existing DashScope-compatible provider with no fallback.
