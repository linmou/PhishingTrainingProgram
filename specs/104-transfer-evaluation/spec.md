# Feature Specification: Frozen Transfer Behavior Evaluation

**Feature Branch**: `104-transfer-evaluation`  
**Created**: 2026-09-11  
**Status**: Draft  
**Input**: User description: "Plan W9-W10 frozen transfer behavior evaluation and Promptfoo evidence for component 104-transfer-evaluation."

## Scope and Authority

This component defines the evaluator-facing contract for W9-W10 transfer assessment behavior. It freezes what must be measured and what evidence is required before a transfer prompt candidate can pass its quality gate. The canonical T09 behavior specification, response contract, evaluation plan, evaluation contract, and preserved original-plan SHA-256 are normative inputs.

This component does not implement production prompts, the provider path, database/auth behavior, React UI, or the release browser suite. It reports required prompt or adapter changes through the integration edge owned by component 102. Promptfoo evidence cannot satisfy database, authorization, or browser release gates.

## User Scenarios & Testing

### User Story 1 - Freeze the Transfer Evaluation Contract (Priority: P1)

As the transfer evaluation owner, I need one versioned case and assertion contract so that prompt changes are compared against the same observable T09 behavior.

**Why this priority**: Without a frozen contract, baseline and candidate results are not comparable and prompt work can silently change the target behavior.

**Independent Test**: Inspect the frozen case schema, rubric registry, deterministic supporting checks, manifest, and contract validation fixtures. The same fixture must produce the same expected applicability, partitions, and metric identifiers without consulting a production prompt.

**Acceptance Scenarios**:

1. **Given** a transfer case with learner history, current message, prior state, target context, and expected judgments, **when** it is loaded, **then** its schema identifies a stable case/version, role, source, requirement mapping, inputs, expected assertions, partition, semantic-pair/transition metadata, and holdout eligibility without placing evaluator labels in target inputs.
2. **Given** a generated v3 response, **when** the contract checks inspect it, **then** the five public rubric IDs and the deterministic supporting check use the shared response and declared field extraction rather than separate target generations.
3. **Given** the preserved original implementation plan, **when** its source hash is checked, **then** SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` remains the comparison baseline.

### User Story 2 - Prove Deterministic Transfer Lifecycle Behavior (Priority: P1)

As an evaluator and reviewer, I need deterministic supporting checks for the transfer contract and lifecycle so that exact state, selection, and sequencing failures cannot be hidden by semantic scores.

**Why this priority**: Exact contract and lifecycle violations are blocking validity failures. They must remain visible even when a response sounds persuasive.

**Independent Test**: Run the deterministic fixture suite against positive, negative, boundary, recovery, regression, and malformed records, including every declared transition and semantic-pair member where applicable. Confirm exact expected/actual values and zero unresolved check errors.

**Acceptance Scenarios**:

1. **Given** valid and invalid v3 response objects and transfer state transitions, **when** the supporting checks run, **then** valid contract/state outcomes pass and invalid mode, instruction, payload, ID, cardinality, rendering, or progress-pair outcomes fail with typed evidence.
2. **Given** a delivered assessment and learner messages, **when** follow-up checks run, **then** delivery precedes grading, the first valid answer resolves once, format clarification remains open, assistance cancels without failure, and feedback precedes a later assessment.
3. **Given** a semantic pair or stateful transition sequence, **when** one member, transition, or required result is missing or wrong, **then** the pair/transition gate fails rather than being averaged into an overall score.

### User Story 3 - Measure Frozen Transfer Semantics (Priority: P1)

As a prompt author and behavior reviewer, I need calibrated semantic rubrics and comparable Promptfoo runs so that a candidate can be evaluated for meaningful transfer without changing the production contract in this component.

**Why this priority**: Transfer quality concerns meaning, evidence, and instructional validity; deterministic structure alone cannot establish it.

**Independent Test**: Calibrate the semantic judges on annotated positive, negative, boundary, and contradictory outputs, run the unchanged baseline and candidate on the same frozen development/regression cases, and inspect per-case judgments and partitioned deltas.

**Acceptance Scenarios**:

1. **Given** a learner evidence history with a current target, **when** `transfer_trigger_target` is judged, **then** eligibility follows learner-owned evidence without strong prior proof and selects at most one current relevant target while preserving multi-target evidence updates.
2. **Given** an assessment or spontaneous-transfer case and a semantic pair, **when** `medium_transfer_quality` is judged, **then** the changed situation tests the same concept and changes a meaning-bearing fact rather than only a brand or name.
3. **Given** a candidate assessment item, **when** `assessment_item_validity` and `verification_evidence` are judged, **then** the item is accurate, self-contained, relevant, non-invented, and its basis cites observable source evidence and distinct original/changed contexts.
4. **Given** a resolved assessment sequence, **when** `assessment_followup` and its deterministic checks run, **then** result-specific feedback is delivered before another assessment, a wrong answer alone does not activate Guard, and failed transfer is not immediately reused in the same context.

### User Story 4 - Preserve Complete, Blocking Evidence (Priority: P2)

As a release reviewer, I need immutable raw evidence and a blocking quality gate so that missing coverage, execution errors, regressions, and pair failures cannot be reported as success.

**Why this priority**: A score without provenance or complete denominators cannot support a defensible integration decision.

**Independent Test**: Exercise the quality gate with passing and failing synthetic reports for missing results, evaluator errors, zero coverage, above-threshold baseline regression, and semantic-pair failure. Verify that only complete immutable evidence can produce a pass verdict.

**Acceptance Scenarios**:

1. **Given** calibration, baseline, candidate, and eligible independent holdout partitions, **when** a run is recorded, **then** each case preserves raw inputs, raw/parsed/displayed outputs, judgments, expected/actual values, evaluator settings, metadata, and immutable contract/prompt/case/rubric/manifest references.
2. **Given** a report with an omitted case, assertion, metric, partition, or judge result, **when** the gate evaluates it, **then** the missing result remains in the denominator and blocks acceptance.
3. **Given** candidate metrics that meet the nominal threshold but decline against the unchanged baseline, or a semantic pair with one failing member, **when** the gate evaluates them, **then** the candidate fails with the affected case/assertion and comparison evidence.
4. **Given** a passing Promptfoo evaluation, **when** release readiness is assessed, **then** the result is labeled evaluation evidence only and does not claim database/authentication or browser-release acceptance.

### Edge Cases

- A case may be applicable to one metric and not applicable to another; only a predeclared, evidenced `not_applicable` result may leave a denominator.
- A zero-applicable partition is zero coverage, not a 100% pass.
- Missing target output, malformed output, judge failure, and ordinary behavior failure remain distinct statuses: `missing`, `error`, and `fail` are not interchangeable.
- An evaluator must not read expected labels, holdout eligibility, pair membership, or rubric annotations from target inputs.
- A semantic pair must hold wording, entities, length, and cue counts as constant as practical while changing one meaning-bearing fact, and both members must be evaluated jointly.
- A recovery case must preserve every prior turn and assert state after each step; a single final response cannot replace sequence evidence.
- Calibration cases and development cases exposed to the prompt author cannot count as eligible independent holdouts.
- A baseline applicability change cannot turn a baseline failure into a candidate pass; the change remains visible for disposition.
- Live model, judge, provider, or configuration errors cannot be silently retried away, converted to learner failures, or removed from the denominator.
- Evaluation evidence cannot be used to claim transfer release while the feature flag is disabled or any database, authorization, or browser gate is pending.

## Requirements

### Functional Requirements

- **FR-001**: The evaluation package MUST define a versioned transfer case schema with stable `case_id` and `case_version`, source and role metadata, complete target inputs including scenario/history/prior state, requirement and metric mappings, expected/prohibited outcomes, applicability, partition, pair/transition metadata, and holdout eligibility.
- **FR-002**: The case schema MUST keep evaluator-only expected labels, annotations, pair labels, holdout labels, and rubric metadata outside target inputs while preserving the full evaluator input needed to reproduce the generation.
- **FR-003**: The evaluation package MUST register exactly these T09 rubric IDs as public semantic contracts: `transfer_trigger_target`, `medium_transfer_quality`, `assessment_item_validity`, `assessment_followup`, and `verification_evidence`.
- **FR-004**: Each rubric MUST declare its method, checked field or consumer, requirement mapping, allowed evaluator inputs, applicability, per-case pass rule, threshold, calibration status, and error/missing handling. Semantic rubrics MUST use calibrated judgments; deterministic checks MUST use reviewed expected values or exact allowed sets.
- **FR-005**: The package MUST include `t09_contract_and_progress` as the deterministic supporting check for v3 structure, known IDs, option/key cardinality, exact-set grading, valid progress pairs, and the rule that assessment is a tutor turn rather than a room mode.
- **FR-006**: The evaluation MUST cover positive, negative, boundary, recovery, regression, multi-target, Guard, clarification, assistance, contradiction, spontaneous-transfer, and controlled semantic-pair roles, with any unavailable role recorded as a named coverage gap.
- **FR-007**: The evaluation MUST preserve the distinction between T09.1 eligibility, T09.2 item validity, T09.3 review/delivery/privacy, T09.4 answer resolution, T09.5 progress outcome, and T09.6 post-assessment sequencing without redefining their behavior.
- **FR-008**: The evaluation MUST include calibration, unchanged production baseline, contract-compatible baseline where required by the response-contract migration, candidate, and independent eligible holdout partitions with frozen case versions, settings, thresholds, and seed/repetition policy.
- **FR-009**: The baseline and candidate MUST be comparable on the same case/version, metric/assertion version, partition, target-generation identity, settings, and repetition policy; changed experimental factors MUST be recorded separately from prompt changes.
- **FR-010**: Independent holdouts MUST be authored without exposure to the candidate prompt or development dialogues, and their author, provenance, creation/exposure status, and eligibility MUST be recorded separately from target inputs.
- **FR-011**: Each run MUST write an immutable manifest and run record containing hashes/references for the constitution, T09 specification, response contract, evaluation plan, cases, rubrics, prompts/adapters, and settings, plus command, revision, timing, model/provider metadata without credentials, and worktree state.
- **FR-012**: Each case/check result MUST preserve raw input, raw output, parsed output, displayed output where applicable, expected and actual values, judgment/reason, method, status, score when supplied, target generation identity, repetition/turn identity, and evaluator metadata.
- **FR-013**: The blocking quality gate MUST fail on missing or errored required evidence, zero-coverage partitions, incomplete manifest coverage, unresolved judge/provider/harness errors, semantic-pair failure, required validity/transition failure, or candidate non-regression failure.
- **FR-014**: The quality gate MUST apply frozen thresholds independently by required partition, preserve exact fractions and denominators, require 100% for deterministic validity/exact transitions and declared pairs or hard constraints, and apply the approved 80% default to applicable semantic behavior metrics unless a stricter declared gate applies.
- **FR-015**: The quality gate MUST report every newly failing case/assertion and every candidate-to-baseline regression with enough identifiers to locate the raw evidence; it MUST NOT hide a decline behind additional easy cases or an aggregate score.
- **FR-016**: Evaluation reports MUST label the result as Promptfoo/evaluation evidence only and MUST explicitly state that database, authorization, provider-path, browser, feature-flag, and release gates remain separate.
- **FR-017**: The planning package MUST identify required integration-edge changes to component 102 when the frozen contract or gate cannot be satisfied by the current production prompt/adapter, without editing component 102 files or asserting that those changes are already implemented.
- **FR-018**: The evaluation package MUST preserve the original-plan SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` and MUST NOT modify canonical T09 behavior or production prompt artifacts as part of this component.

### Key Entities

- **Transfer Case**: A versioned evaluator input and expected-outcome record for one T09 scenario, including source/provenance, role, full prior state, learner history, current contribution, target context, requirement mappings, expected assertions, partition, and pair/transition metadata.
- **Metric Contract**: A stable rubric or deterministic supporting-check definition with method, field/consumer, applicability, threshold, and failure semantics.
- **Run Manifest**: An immutable snapshot of all inputs, versions, hashes, settings, partitions, repetitions, and gate rules used for one evaluation run.
- **Per-Case Evidence Record**: Raw and derived input/output/judgment data for one case/check/repetition, including expected-versus-actual evidence and status.
- **Calibration Set**: Annotated positive, negative, boundary, and contradictory examples used to validate semantic judge behavior before baseline comparison.
- **Evaluation Partition**: A declared calibration, baseline, candidate, development/regression, or eligible independent holdout slice with explicit provenance and denominator rules.
- **Semantic Pair**: Two jointly evaluated cases differing in one meaning-bearing factor with different expected outcomes, used for a 100% pair gate.
- **Stateful Sequence**: An ordered case with complete prior turns and asserted state/decision transitions, used to test recovery, assistance, clarification, contradiction, and follow-up behavior.
- **Quality-Gate Verdict**: A blocking pass/fail/incomplete result with metric, partition, coverage, regression, pair, and execution evidence.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The frozen manifest maps 100% of the five required rubric IDs, the deterministic supporting check, T09.1-T09.6 responsibilities, required case roles, partitions, and gate rules to versioned artifacts before prompt-candidate evaluation begins.
- **SC-002**: Deterministic supporting fixtures achieve 100% expected coverage of declared valid/invalid contract, lifecycle, transition, ID, cardinality, rendering, and progress-pair checks, with zero unresolved execution errors in the gate-test suite.
- **SC-003**: Every completed calibration, baseline, candidate, or holdout run contains a per-case evidence record for 100% of expected case/check/repetition combinations, or records the missing/error result in the denominator and returns an incomplete/blocking verdict.
- **SC-004**: Semantic judge calibration documents annotated positive, negative, boundary, and contradictory examples and records judge settings, version, decisions, disagreements, and unresolved errors before baseline acceptance is evaluated.
- **SC-005**: Candidate acceptance requires at least 80% for each applicable semantic rubric in overall and every required partition, no decline against the unchanged comparable baseline, 100% for semantic pairs and declared hard constraints, and zero unresolved missing/error results.
- **SC-006**: Quality-gate tests demonstrate blocking behavior for missing results, evaluator errors, zero-coverage partitions, above-threshold regression, and one-member semantic-pair failure; none of those reports can produce a pass verdict.
- **SC-007**: The final planning/evaluation report distinguishes Promptfoo evidence from database/authentication, provider-path, browser, activation, and rollback gates with 100% of those non-substitution boundaries explicitly recorded.

## Assumptions

- The canonical T09 specification, response contract, evaluation plan, adopted behavior constitution, and original implementation plan remain the authority; this component does not invent a new behavior policy.
- The original-plan source is the parent-level `plan/transfer_assessment_implementation_plan.md` and its preserved SHA-256 is the supplied hash.
- The existing Promptfoo harness and project model configuration are inspected before implementation; no API key, base URL, judge model, or provider parameter is invented when it is absent from the checked-in examples.
- Live model evaluation, judge calibration against real outputs, independent holdout execution, and release acceptance are later execution stages; planning artifacts may record them as pending but may not claim them as passed.
- The candidate prompt and production provider path remain owned by component 102; this component may specify required adapter fields and report integration blockers through the handoff.
- Development fixtures and historical Promptfoo runs are not eligible independent holdouts unless their provenance and exposure rules satisfy the frozen evaluation contract.
- Raw run evidence is immutable by run ID; re-runs or contract changes create a new manifest/run version rather than overwriting prior evidence.
- Deterministic supporting checks may proceed when a semantic judge is unavailable, but missing semantic evidence blocks full T09 acceptance and cannot be replaced by keyword matching.
- Existing legacy behavior assertions remain regression evidence where applicable; T09-specific inapplicability is explicit and does not delete historical assertions.
- Database/authentication, production provider-path, browser, activation, and rollback gates remain downstream and are not represented as Promptfoo passes.
