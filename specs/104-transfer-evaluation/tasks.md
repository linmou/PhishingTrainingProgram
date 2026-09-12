---
description: "Dependency-ordered W9-W10 transfer evaluation and Promptfoo evidence tasks"
---

# Tasks: Frozen Transfer Behavior Evaluation

**Input**: Design documents from `/specs/104-transfer-evaluation/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, and `contracts/`
**Scope**: Planning package for component `104-transfer-evaluation`; component 102 owns the shared v3 request/context implementation in `tutor-system/src/services/ecologicalTutorCall.ts`, backend production prompt reference/hash, provider/secret path, and production 1,200-token setting. Component 104 owns evaluation consumption, parity tests, immutable evidence, and gates. Production implementation, database/auth, React UI, and release browser work remain excluded.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the versioned evaluation workspace and source-of-truth boundaries before authoring transfer cases.

- [ ] T001 Record the canonical source-plan path and SHA-256, T09/response-contract/evaluation-plan references, and component ownership in `specs/104-transfer-evaluation/research.md`.
- [ ] T002 [P] Document the existing v1 runner/evaluator/gate entry points, legacy regression boundary, and immutable result-directory convention in `specs/104-transfer-evaluation/plan.md`.
- [ ] T003 [P] Create the transfer artifact index and ownership map in `specs/104-transfer-evaluation/integration-edge.md`, declaring component 102 ownership of the shared `ecologicalTutorCall.ts` v3 builder, production prompt reference/hash, provider-secret path, and product token setting; declare component 104 ownership of evaluation consumption/tests and the separate 101/105 release gates.
- [ ] T004 Validate the planning package paths, template completion, source hash, and absence of unresolved placeholders using `specs/104-transfer-evaluation/checklists/requirements.md` and `specs/104-transfer-evaluation/quickstart.md`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Freeze shared data, metric, manifest, and gate contracts before any prompt candidate is evaluated.

**Checkpoint**: No case authoring, calibration, baseline, candidate, or holdout execution may begin until these contracts and their validation fixtures are complete.

- [ ] T005 [P] Define the machine-readable transfer case schema and target/evaluator projection rules in `evals/promptfoo/v1/transfer/case-schema.json`, preserving evaluator-label isolation.
- [ ] T006 [P] Define the versioned metric registry for the five public T09 rubric IDs and `t09_contract_and_progress` in `evals/promptfoo/v1/transfer/metric-registry.json`.
- [ ] T007 [P] Define the immutable run manifest shape, partition registry, shared-builder/prompt/adapter hash list, product/evaluation effective-token settings, parity record, and per-case evidence envelope in `evals/promptfoo/v1/transfer/manifest-schema.json`.
- [ ] T008 [P] Define the transfer-specific gate thresholds, hard partitions, pair rule, non-regression rule, missing/error verdicts, and pre-scoring shared-contract/hash/1,200-token/parity blockers in `evals/promptfoo/v1/transfer/gate-policy.json`.
- [ ] T009 Write schema and manifest validation tests first in `evals/promptfoo/v1/transfer/case-schema.test.js`; begin the test with the file-purpose comment required by `AGENTS.md` and cover missing fields, target-label leakage, pair cardinality, holdout exposure, version drift, missing shared contract/prompt hashes, non-1,200 budgets, and forbidden secret metadata.
- [ ] T010 Implement the schema/manifest validators in `evals/promptfoo/v1/transfer/case-schema.js`; begin the executable file with a shebang and concise purpose comment, and keep it independent of model/provider calls.

## Phase 3: User Story 1 - Freeze the Transfer Evaluation Contract (Priority: P1)

**Goal**: Produce versioned transfer cases, rubric declarations, and comparable partitions that preserve the T09 contract before prompt edits.

**Independent Test**: Validate the complete transfer manifest and assert that all required fields, rubric IDs, case roles, T09 mappings, partitions, pair/transition metadata, and holdout eligibility are present without evaluator labels in target inputs.

### Tests for User Story 1

- [ ] T011 [P] [US1] Write manifest completeness, metric-registration, and shared-request parity tests first in `evals/promptfoo/v1/transfer/manifest.test.js` and `shared-request-contract.test.js`, with required file-purpose comments and failures for missing rubric IDs/partitions, duplicate case versions, incomplete T09 mappings, changed shared-builder or production-prompt hashes, unequal normalized product/evaluation messages, non-1,200 effective budgets, evaluator-label leakage, copied prompt text, and provider-secret leakage.
- [ ] T012 [P] [US1] Write case role and partition coverage tests first in `evals/promptfoo/v1/transfer/coverage.test.js`, with the required file-purpose comment and assertions for positive, negative, boundary, recovery, regression, multi-target, Guard, clarification, assistance, contradiction, spontaneous-transfer, and semantic-pair roles.

### Implementation and Fixtures for User Story 1

- [ ] T013 [US1] Author versioned transfer case inputs, evaluator-only expected labels, applicability, source provenance, pair/transition metadata, and holdout eligibility in `evals/promptfoo/v1/transfer/cases.json`.
- [ ] T014 [US1] Register case versions, required partitions, metric mappings, repetitions, seed policy, thresholds, shared v3 builder and backend prompt references/hashes, both effective 1,200-token settings, adapter hash, and parity fixture/result hashes in `evals/promptfoo/v1/transfer/manifest.json`.
- [ ] T015 [P] [US1] Author calibrated instruction files for the four semantic rubrics with allowed input fields, positive/negative/boundary examples, strict result format, and missing/error behavior in `evals/promptfoo/rubrics/v1/transfer_trigger_target.md`, `medium_transfer_quality.md`, `assessment_item_validity.md`, and `verification_evidence.md`; author the deterministic `assessment_followup` declaration separately in `evals/promptfoo/rubrics/v1/assessment_followup.md`.
- [ ] T016 [P] [US1] Register transfer rubric versions, methods, thresholds, hard partitions, and applicability in `evals/promptfoo/rubrics/v1/manifest.json` without altering historical v0/v1 meanings.
- [ ] T017 [US1] Implement `evals/promptfoo/v1/transfer/adapter.js` as a thin evaluation projection/invocation shim that consumes the component-102-owned versioned v3 builder and contract identity exported through `tutor-system/src/services/ecologicalTutorCall.ts`; begin the new executable file with a shebang and purpose comment, pass only target-visible case fields, preserve the shared backend prompt reference/hash and 1,200-token budget, and do not construct messages, copy prompt text, or resolve provider endpoints/secrets.

## Phase 4: User Story 2 - Prove Deterministic Transfer Lifecycle Behavior (Priority: P1)

**Goal**: Make exact v3 contract, selection, progress, rendering, and follow-up failures visible independently of semantic judgment.

**Independent Test**: Run deterministic fixtures across every declared valid/invalid contract outcome and stateful lifecycle sequence; require exact expected/actual evidence and zero unresolved errors.

### Tests for User Story 2

- [ ] T018 [P] [US2] Write deterministic contract and progress tests first in `evals/promptfoo/v1/transfer/contract-checks.test.js`, with the required file-purpose comment and coverage for known IDs, reason-first serialization, mode/instruction combinations, four A-D options, key cardinality, rendering limits, exact-set grading, valid progress pairs, and room-mode separation.
- [ ] T019 [P] [US2] Write follow-up transition tests first in `evals/promptfoo/v1/transfer/followup.test.js`, with the required file-purpose comment and coverage for delivery-before-grading, first-answer resolution, clarification, assistance, feedback-first sequencing, no immediate chain, wrong-answer/no-Guard, and failed-context reuse rejection.
- [ ] T020 [P] [US2] Write semantic-pair and stateful-join tests first in `evals/promptfoo/v1/transfer/pair-transition.test.js`, with the required file-purpose comment and failure cases for missing members, wrong member outcomes, missing steps, and mismatched target-generation identities.

### Implementation for User Story 2

- [ ] T021 [US2] Implement `t09_contract_and_progress` and its exact expected/actual evidence shape in `evals/promptfoo/v1/transfer/contract-checks.js`; begin the executable file with a shebang and purpose comment.
- [ ] T022 [US2] Implement deterministic lifecycle and ordered-turn checks in `evals/promptfoo/v1/transfer/followup-checks.js`; begin the executable file with a shebang and purpose comment, and preserve `missing`/`error` separately from behavior `fail`.
- [ ] T023 [US2] Register transfer deterministic checks with the shared v1 evaluator in `evals/promptfoo/v1/evaluator.js` through a versioned adapter path, without replacing legacy checks or generating a second target response.
- [ ] T024 [US2] Add deterministic fixture inputs and expected transitions for positive, negative, boundary, recovery, regression, Guard, clarification, assistance, contradiction, spontaneous-transfer, and multi-target sequences in `evals/promptfoo/v1/transfer/fixtures/`.

## Phase 5: User Story 3 - Measure Frozen Transfer Semantics (Priority: P1)

**Goal**: Calibrate judges for the four semantic T09 rubrics, run all five rubric IDs against comparable baseline/candidate evidence, and validate independent holdouts.

**Independent Test**: Execute calibration and unchanged baseline/candidate comparisons on the same frozen development/regression manifest, then run baseline and candidate on eligible sealed holdouts after candidate freeze; preserve all raw and typed evidence.

### Tests and Calibration for User Story 3

- [ ] T025 [P] [US3] Write calibration contract tests first in `evals/promptfoo/v1/transfer/calibration.test.js`, with the required file-purpose comment and positive, negative, boundary, contradictory, disagreement, judge-error, and unresolved-calibration cases for the four semantic rubric IDs; assert that deterministic `assessment_followup` is excluded from judge calibration and covered by T019 lifecycle fixtures.
- [ ] T026 [P] [US3] Write baseline/candidate comparability tests first in `evals/promptfoo/v1/transfer/comparison.test.js`, with the required file-purpose comment and failures for changed case versions, metric versions, settings, repetitions, target identities, partition membership, shared-builder hash, production-prompt reference/hash, effective 1,200-token budget, or normalized product/evaluation request identity.

### Implementation and Evidence for User Story 3

- [ ] T027 [US3] Implement transfer judge calibration and immutable calibration records in `evals/promptfoo/v1/transfer/calibrate.js`; begin the executable file with a shebang and purpose comment, and preserve raw judge requests/responses and adjudication metadata.
- [ ] T028 [US3] Register transfer cases, rubric IDs, shared v3 contract version/hash, backend production prompt reference/hash, and the T017 thin consumer with the existing v1 runner in `evals/promptfoo/v1/runner.js` through `evals/promptfoo/v1/transfer/runner-config.js`; begin any new executable file with a shebang and purpose comment, obtain the 1,200-token setting from the component-102-owned shared contract, and reject any local prompt/request/provider-secret override.
- [ ] T029 [US3] Create the unchanged production and contract-compatible baseline run records with declared changed-factor metadata in `evals/promptfoo/results/<model>/<run-id>-baseline/` and `evals/promptfoo/results/<model>/<run-id>-aligned-baseline/`, without overwriting historical results.
- [ ] T030 [US3] Create the candidate run record and freeze the component-102-owned shared builder and backend prompt references/hashes plus the component-104 adapter hash before holdout exposure in `evals/promptfoo/results/<model>/<run-id>-candidate/`; include both effective 1,200-token values, parity evidence, unchanged regression metrics, and component 102 integration blockers without copying or changing its prompt/provider files.
- [ ] T031 [US3] Author independent transfer holdouts with distinct entities, wording, boundaries, authorship, and exposure records in `evals/promptfoo/holdouts/transfer-sealed/`; keep target prompt/development dialogues unavailable until candidate freeze.
- [ ] T032 [US3] Record raw target inputs, raw/parsed/displayed outputs, per-case judgments, deterministic expected/actual results, settings, versions, retries, errors, and metadata in `evals/promptfoo/results/<model>/<run-id>/` using write-once run directories.

## Phase 6: User Story 4 - Preserve Complete, Blocking Evidence (Priority: P2)

**Goal**: Enforce the transfer quality gate and produce an evidence report that cannot hide missing coverage, errors, regression, or pair failure.

**Independent Test**: Run the gate fixture matrix with pass, missing, error, zero-coverage, below-threshold, above-threshold regression, incomparable-baseline, conditional-inapplicability, and one-member pair failures; verify every blocking fixture returns a non-pass verdict.

### Tests for User Story 4

- [ ] T033 [P] [US4] Write the blocking gate tests first in `evals/promptfoo/v1/transfer/quality-gate.test.js`, with the required file-purpose comment and explicit missing, error, zero-coverage, regression, pair, incomplete-manifest, exact-denominator, shared-builder/prompt hash mismatch, product/evaluation request mismatch, and non-1,200 budget assertions.
- [ ] T034 [P] [US4] Write raw-evidence completeness and immutability tests first in `evals/promptfoo/v1/transfer/evidence-record.test.js`, with the required file-purpose comment and checks for input/output/judgment/metadata preservation, write-once runs, evaluator-only metadata separation, prompt-reference-without-prompt-copying, credential/secret redaction, and partial-run blocking.
- [ ] T035 [P] [US4] Write non-substitution report tests first in `evals/promptfoo/v1/transfer/release-boundary.test.js`, with the required file-purpose comment and assertions that Promptfoo evidence cannot claim database/auth/browser/activation/rollback acceptance.

### Implementation for User Story 4

- [ ] T036 [US4] Implement the transfer-aware blocking gate and exact partition/metric/pair/regression diagnostics in `evals/promptfoo/v1/transfer/quality-gate.js`; begin the executable file with a shebang and purpose comment.
- [ ] T037 [US4] Register the transfer gate with the existing v1 gate entry point in `evals/promptfoo/v1/gate.js`, preserving legacy metrics and making transfer rows fail closed on missing/error/zero coverage.
- [ ] T038 [US4] Implement immutable run snapshot and evidence-record writing in `evals/promptfoo/v1/transfer/evidence-record.js`; begin the executable file with a shebang and purpose comment and never overwrite an existing run ID.
- [ ] T039 [US4] Produce a transfer evaluation report with final verdict, exact fractions, applicability, raw-evidence links, regression/pair failures, calibration status, and non-substitution statement in `evals/promptfoo/v1/transfer/report.js`; begin the executable file with a shebang and purpose comment.
- [ ] T040 [US4] Document unresolved component 102 dependencies in `specs/104-transfer-evaluation/integration-edge.md`: shared `ecologicalTutorCall.ts` v3 builder/identity, backend prompt reference/hash, production 1,200-token setting, and provider-path integration; keep component 104 limited to adapter consumption/tests and do not modify or duplicate production prompt/provider files.

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Reconcile planning artifacts, documentation, and handoff evidence before integration.

- [ ] T041 [P] Run the complete deterministic/gate test command from `specs/104-transfer-evaluation/quickstart.md` and preserve its exit status and counts in `specs/104-transfer-evaluation/verification-record.md`.
- [ ] T042 [P] Review the nearest evaluation documentation and record any required doc update in `tutor-system/claude_docs/doc_update_record/` only when an implementation change alters canonical behavior; do not edit canonical docs from this component without an approved integration change.
- [ ] T043 Re-run the read-only cross-artifact analysis against `specs/104-transfer-evaluation/spec.md`, `plan.md`, and `tasks.md`, resolve every CRITICAL/HIGH finding before handoff, and include the final report in the integration handoff.
- [ ] T044 Confirm the feature flag remains disabled and that no database/auth/UI/browser/release claim is made in `specs/104-transfer-evaluation/verification-record.md`.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; establishes source and ownership boundaries.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story until schema, metric, manifest, and gate contracts validate.
- **User Story 1 (Phase 3)**: Depends on Foundational; freezes cases, rubric registration, partitions, and adapter projections.
- **User Story 2 (Phase 4)**: Depends on Foundational and consumes the US1 case/manifest contract; deterministic checks must be complete before semantic run acceptance.
- **User Story 3 (Phase 5)**: Depends on US1 and US2; calibration precedes baseline, baseline precedes candidate, and candidate freeze precedes holdouts.
- **User Story 4 (Phase 6)**: Depends on US1-US3; gate tests may use synthetic reports before live runs, but acceptance requires complete immutable evidence.
- **Polish (Phase 7)**: Depends on all required evidence and must precede integration handoff.

### Parallel Opportunities

- T002-T003 can run in parallel after source inspection.
- T005-T008 can run in parallel because they are separate contract files.
- T011-T012 and T018-T020 can run in parallel within their story, followed by their implementations.
- T015-T016 and T025-T026 can run in parallel with case/runner work once the public IDs and manifest are frozen.
- T033-T035 can run in parallel because each tests a separate gate failure surface.

## Requirement Traceability

| Requirement | Covered by tasks |
|---|---|
| FR-001 | T005, T009, T010, T013, T014 |
| FR-002 | T005, T009, T017 |
| FR-003 | T006, T015, T016, T028 |
| FR-004 | T006, T015, T025, T027 |
| FR-005 | T006, T018, T021, T023 |
| FR-006 | T012, T024 |
| FR-007 | T019, T024 |
| FR-008 | T014, T027, T029, T031 |
| FR-009 | T026, T029, T030 |
| FR-010 | T012, T031 |
| FR-011 | T007, T014, T032, T038 |
| FR-012 | T007, T032, T034 |
| FR-013 | T008, T033, T036, T037 |
| FR-014 | T008, T036, T037 |
| FR-015 | T036, T039 |
| FR-016 | T003, T035, T039, T044 |
| FR-017 | T003, T028, T030, T040 |
| FR-018 | T001, T041, T044 |
| FR-019 | T003, T011, T017, T028, T040 |
| FR-020 | T007, T009, T011, T014, T026, T028, T030, T033 |
| FR-021 | T005, T009, T011, T017, T028, T034 |
| FR-022 | T007, T008, T011, T014, T026, T030, T033, T038 |
| SC-001 | T011, T014, T016 |
| SC-002 | T018, T021, T024 |
| SC-003 | T032, T034 |
| SC-004 | T025, T027 |
| SC-005 | T026, T030, T036, T037 |
| SC-006 | T033 |
| SC-007 | T035, T039, T044 |
| SC-008 | T011, T017, T026, T028, T033, T034 |

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
