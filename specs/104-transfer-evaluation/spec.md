# Feature Specification: Two-Attempt Transfer Behavior Evaluation

<!-- Intent: define the evaluation evidence required for the server-authoritative two-attempt lifecycle and learner-safe explanation upgrade. -->

**Feature Branch**: `104-transfer-evaluation`  
**Created**: 2026-09-11  
**Updated**: 2026-09-22  
**Status**: Draft  
**Input**: Upgrade transfer assessment evaluation for server-authoritative two-attempt sequences and learner-safe explanation correctness/safety.

## Scope and Authority

This component upgrades the existing evaluator-facing contract for transfer assessment behavior. It freezes what must be measured and what evidence is required before a transfer prompt candidate can pass its quality gate. The approved lifecycle is server-authoritative across reloads and tabs: the first valid incorrect answer remains open, a correct answer on either of two valid attempts passes, and a second valid incorrect answer fails. Invalid, stale, unauthorized, duplicate, and post-terminal submissions do not consume an attempt or create another progress transition.

This component does not implement production prompts, the provider path, database/auth behavior, React UI, or the release browser suite. Component 101 owns `TransferAttemptSnapshot`, `TransferResolvedAssessment`, grading and progress-transition invariants, and `PrivateAssessment.learner_safe_explanation`. Component 102 owns the shared v3 production request/context builders, persisted attempts, exact `PublicAssessmentDTO` and `ProcessedMessageDTO` projections, role-safe `terminal_failure_feedback`, prompt reference/hash, and provider-secret path. Component 104 owns only evaluation-side consumption, semantic explanation judgment, parity tests, immutable evidence, and gates. Promptfoo evidence cannot satisfy database, authorization, UI, or browser release gates.

## Clarifications

### Session 2026-09-22

- Q: Must the two-attempt lifecycle persist across reloads and tabs? -> A: Yes. Attempts are backend-authoritative and persistent across reloads and tabs.

No further material evaluation ambiguity remains. Exact upstream field and enum names are consumed from promoted 101/102 contracts and are not redefined here.

## User Scenarios & Testing

### User Story 1 - Freeze the Transfer Evaluation Contract (Priority: P1)

As the transfer evaluation owner, I need one versioned case and assertion contract so that prompt changes are compared against the same observable T09 behavior.

**Why this priority**: Without a frozen contract, baseline and candidate results are not comparable and prompt work can silently change the target behavior.

**Independent Test**: Inspect the frozen case schema, rubric registry, deterministic supporting checks, manifest, and contract validation fixtures. The same fixture must produce the same expected applicability, partitions, and metric identifiers without consulting a production prompt.

**Acceptance Scenarios**:

1. **Given** a transfer case with learner history, current message, prior state, target context, and expected judgments, **when** it is loaded, **then** its schema identifies a stable case/version, role, source, requirement mapping, inputs, expected assertions, partition, semantic-pair/transition metadata, and holdout eligibility without placing evaluator labels in target inputs.
2. **Given** a generated v3 response, **when** the contract checks inspect it, **then** the existing five public rubric IDs, `learner_explanation_quality`, and the deterministic supporting checks use the same preserved response and declared field extraction rather than separate target generations.
3. **Given** the preserved original implementation plan, **when** its source hash is checked, **then** SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` remains the comparison baseline.
4. **Given** one frozen transfer case, **when** product and evaluation requests are projected, **then** both use the component-102-owned v3 builder, production prompt reference/hash, and 1,200-token budget, while evaluator-only metadata is absent from both target requests.

### User Story 2 - Prove Deterministic Transfer Lifecycle Behavior (Priority: P1)

As an evaluator and reviewer, I need deterministic supporting checks for the transfer contract and lifecycle so that exact state, selection, and sequencing failures cannot be hidden by semantic scores.

**Why this priority**: Exact contract and lifecycle violations are blocking validity failures. They must remain visible even when a response sounds persuasive.

**Independent Test**: Run the deterministic fixture suite against positive, negative, boundary, recovery, regression, and malformed records, including every declared transition and semantic-pair member where applicable. Confirm exact expected/actual values and zero unresolved check errors.

**Acceptance Scenarios**:

1. **Given** valid and invalid v3 response objects and transfer state transitions, **when** the supporting checks run, **then** valid contract/state outcomes pass and invalid mode, instruction, payload, ID, cardinality, rendering, or progress-pair outcomes fail with typed evidence.
2. **Given** a delivered assessment and learner messages, **when** follow-up checks run, **then** delivery precedes grading, a first incorrect valid answer remains open with one attempt left, correct on either attempt passes, a second incorrect valid answer fails, format clarification remains open, assistance cancels without failure, and feedback precedes a later assessment.
3. **Given** reloads, duplicate tabs, concurrent submissions, retries, or idempotent replay, **when** attempt evidence is joined, **then** every view converges on one persisted attempt count, at most two consumed valid attempts, and exactly one terminal progress transition.
4. **Given** a semantic pair or stateful transition sequence, **when** one member, transition, or required result is missing or wrong, **then** the pair/transition gate fails rather than being averaged into an overall score.

### User Story 3 - Measure Frozen Transfer Semantics (Priority: P1)

As a prompt author and behavior reviewer, I need calibrated semantic rubrics and comparable Promptfoo runs so that a candidate can be evaluated for meaningful transfer without changing the production contract in this component.

**Why this priority**: Transfer quality concerns meaning, evidence, and instructional validity; deterministic structure alone cannot establish it.

**Independent Test**: Calibrate the semantic judges on annotated positive, negative, boundary, and contradictory outputs, run the unchanged baseline and candidate on the same frozen development/regression cases, and inspect per-case judgments and partitioned deltas.

**Acceptance Scenarios**:

1. **Given** a learner evidence history with a current target, **when** `transfer_trigger_target` is judged, **then** eligibility follows learner-owned evidence without strong prior proof and selects at most one current relevant target while preserving multi-target evidence updates.
2. **Given** an assessment or spontaneous-transfer case and a semantic pair, **when** `medium_transfer_quality` is judged, **then** the changed situation tests the same concept and changes a meaning-bearing fact rather than only a brand or name.
3. **Given** a candidate assessment item, **when** `assessment_item_validity` and `verification_evidence` are judged, **then** the item is accurate, self-contained, relevant, non-invented, and its basis cites observable source evidence and distinct original/changed contexts.
4. **Given** a resolved assessment sequence, **when** `assessment_followup` and its deterministic checks run, **then** result-specific feedback is delivered before another assessment, a wrong answer alone does not activate Guard, and failed transfer is not immediately reused in the same context.
5. **Given** a generated or teacher-reviewed learner-safe explanation, **when** `learner_explanation_quality` is judged, **then** it accurately connects the correct option to the tested concept and changed context, remains consistent with the key, and does not expose private transfer basis, model rationale, raw output, or unrelated learner data.
6. **Given** delivery, first-incorrect, pass, and second-incorrect projections, **when** disclosure checks run, **then** correct-option IDs and explanation appear only in the authorized learner's second-incorrect terminal projection.

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
- A concurrent race for the second-attempt slot may produce one accepted terminal result and one duplicate/conflict result, but never a third consumed attempt or second transition.
- A teacher edit preserves generated and reviewed explanation values plus provenance; the learner-facing quality judgment evaluates the reviewed value.
- A first-incorrect or pass payload containing terminal failure feedback is a disclosure failure even if a consumer ignores the field.
- A second-incorrect terminal payload with only the answer or only the explanation is incomplete and blocks acceptance.
- Calibration cases and development cases exposed to the prompt author cannot count as eligible independent holdouts.
- A baseline applicability change cannot turn a baseline failure into a candidate pass; the change remains visible for disposition.
- Live model, judge, provider, or configuration errors cannot be silently retried away, converted to learner failures, or removed from the denominator.
- A missing shared v3 builder version/hash, production prompt reference/hash, effective 1,200-token budget, or product/evaluation request parity record is incomplete evidence and blocks the run.
- The evaluation adapter must not reconstruct the system prompt, transfer context, provider request, credentials, endpoint, or secret lookup owned by component 102.
- Evaluation evidence cannot be used to claim transfer release while the feature flag is disabled or any database, authorization, or browser gate is pending.

## Requirements

### Functional Requirements

- **FR-001**: The evaluation package MUST define a versioned transfer case schema with stable `case_id` and `case_version`, source and role metadata, complete target inputs including scenario/history/prior state, requirement and metric mappings, expected/prohibited outcomes, applicability, partition, pair/transition metadata, and holdout eligibility.
- **FR-002**: The case schema MUST keep evaluator-only expected labels, annotations, pair labels, holdout labels, and rubric metadata outside target inputs while preserving the full evaluator input needed to reproduce the generation.
- **FR-003**: The evaluation package MUST preserve the five existing public T09 rubric IDs and add `learner_explanation_quality` as a separate calibrated semantic metric. `assessment_followup` remains deterministic; explanation quality MUST NOT be averaged into assessment-item validity or lifecycle correctness.
- **FR-004**: Each rubric MUST declare its method, checked field or consumer, requirement mapping, allowed evaluator inputs, applicability, per-case pass rule, threshold, calibration status, and error/missing handling. Semantic rubrics MUST use calibrated judgments; deterministic checks MUST use reviewed expected values or exact allowed sets.
- **FR-005**: The package MUST include `t09_contract_and_progress` for v3 structure and grading/progress contracts, and `learner_explanation_disclosure` for exact role/stage disclosure. Both deterministic checks require 100% and remain separate from semantic scores.
- **FR-006**: The evaluation MUST cover positive, negative, boundary, recovery, regression, multi-target, Guard, clarification, assistance, contradiction, spontaneous-transfer, and controlled semantic-pair roles, with any unavailable role recorded as a named coverage gap.
- **FR-007**: The evaluation MUST preserve the distinction between T09.1 eligibility, T09.2 item validity, T09.3 review/delivery/privacy, upgraded T09.4 two-attempt resolution, T09.5 progress outcome, and T09.6 post-assessment sequencing. It consumes promoted 101/102 rules instead of reimplementing them.
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
- **FR-019**: Every transfer target generation MUST consume the versioned v3 request/context builder exported through `tutor-system/src/services/ecologicalTutorCall.ts`; component 102 owns that shared production contract and component 104 owns only its evaluation consumption and tests.
- **FR-020**: Product and evaluation target adapters MUST use the same backend-owned production prompt reference/hash and effective 1,200 completion-token v3 budget. The evaluation package MUST neither copy prompt text nor define an independent request/context or token-budget authority.
- **FR-021**: The evaluation adapter MUST remain a thin projection from target-visible case fields into the shared v3 builder and MUST NOT read evaluator-only metadata or duplicate provider endpoint, credential, secret lookup, transport, or production prompt handling.
- **FR-022**: The immutable manifest and blocking gate MUST record and verify shared builder contract version/hash, production prompt reference/hash, effective token budget, and product/evaluation request parity; any missing value or mismatch MUST produce a blocking `incomplete` verdict before semantic scoring.
- **FR-023**: The case schema MUST represent `TransferAttemptSnapshot` before/after state, accepted attempt number, processing disposition, remaining attempts, terminal outcome, progress-transition identity, reload/tab/concurrency context, and terminal learner projection for each ordered step.
- **FR-024**: Deterministic lifecycle checks MUST require: first wrong is retryable with `accepted_attempt_count=1`, no transition, and no terminal feedback; correct on attempt one or two passes once; second wrong fails once; and every terminal result has zero remaining attempts.
- **FR-025**: Duplicate message/request replay, stale or malformed input, assistance, Guard, unauthorized input, and every post-terminal or third submission MUST consume no attempt and emit no progress transition according to the promoted 101/102 result contract.
- **FR-026**: Attempt fixtures MUST cover correct-first, wrong-then-correct, wrong-then-wrong, reload, separate tab, concurrent second submissions, idempotent replay, stale, malformed, unauthorized, assistance, Guard, and post-terminal submission paths.
- **FR-027**: `learner_explanation_quality` MUST judge the reviewed learner-safe explanation for factual correctness, relevance to the tested concept and changed context, consistency with `correct_option_ids`, and learner-appropriate safety using annotated positive, incorrect, irrelevant, contradictory, privacy-unsafe, and boundary examples.
- **FR-028**: `learner_explanation_disclosure` MUST verify from explicit role-safe contracts and provenance that `PublicAssessmentDTO` is exactly `{id, student_id, selection_type, stem, options}` with no `rendered_text`, delivery/first-incorrect/pass projections expose neither key nor explanation, and only the authorized learner's terminal second-incorrect projection exposes both `correct_option_ids` and `learner_safe_explanation`.
- **FR-029**: Explanation evidence MUST preserve generated and teacher-reviewed values plus edit provenance, and semantic judgment MUST evaluate the reviewed value used by `terminal_failure_feedback`.
- **FR-030**: Missing, blank, incorrect, contradictory, irrelevant, or privacy-unsafe explanations MUST remain visible as `fail`, `missing`, or `error` and block applicable acceptance; text pattern matching MUST NOT replace required semantic judgment.
- **FR-031**: The upgraded manifest MUST pin the promoted 101 and 102 contract paths/hashes and reject historical first-valid-resolution evidence as proof of the new lifecycle.
- **FR-032**: Live target and judge calls MUST use `qwen3.5-flash` through the existing DashScope-compatible provider, as recorded by the integration owner at commit `df40f32`; missing or mismatched configuration MUST block execution with no runtime fallback.

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
- **Shared Request Contract Snapshot**: The immutable identity of the component-102-owned v3 builder, production prompt reference/hash, and effective 1,200-token setting consumed by both product and evaluation target adapters.
- **Attempt Sequence**: Ordered authoritative before/after `TransferAttemptSnapshot` evidence joined by assessment, message/request, attempt, and transition identities.
- **Explanation Evidence**: Generated and reviewed explanation values, edit provenance, correct-answer reference, tested concept/context, and exact role-safe terminal projection.
- **Disclosure Check**: A deterministic comparison of allowed fields and upstream provenance across delivery, retry, pass, and terminal-failure projections.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The frozen manifest maps 100% of the six required rubric IDs, two deterministic supporting checks, upgraded T09.1-T09.6 responsibilities, required attempt/explanation roles, partitions, and gate rules to versioned artifacts before candidate evaluation begins.
- **SC-002**: Deterministic fixtures achieve 100% expected coverage of lifecycle, disclosure, contract, transition, ID, cardinality, rendering, and progress-pair checks, with at most two consumed attempts and exactly one terminal transition per assessment.
- **SC-003**: Every completed calibration, baseline, candidate, or holdout run contains a per-case evidence record for 100% of expected case/check/repetition combinations, or records the missing/error result in the denominator and returns an incomplete/blocking verdict.
- **SC-004**: Semantic judge calibration documents annotated positive, negative, boundary, and contradictory examples and records judge settings, version, decisions, disagreements, and unresolved errors before baseline acceptance is evaluated.
- **SC-005**: Candidate acceptance requires at least 80% for each applicable semantic rubric in overall and every required partition, no decline against the unchanged comparable baseline, 100% for semantic pairs and declared hard constraints, and zero unresolved missing/error results.
- **SC-006**: Quality-gate tests demonstrate blocking behavior for missing results, evaluator errors, zero-coverage partitions, above-threshold regression, and one-member semantic-pair failure; none of those reports can produce a pass verdict.
- **SC-007**: The final planning/evaluation report distinguishes Promptfoo evidence from database/authentication, provider-path, browser, activation, and rollback gates with 100% of those non-substitution boundaries explicitly recorded.
- **SC-008**: Contract tests demonstrate byte-for-byte equivalent normalized product/evaluation v3 messages and equal effective 1,200-token budgets for every frozen parity fixture, with matching shared-builder and production-prompt hashes and zero evaluator-only fields or provider secrets in target requests/evidence.
- **SC-009**: 100% of delivery, first-incorrect, and pass fixtures expose zero key/explanation fields; 100% of terminal second-incorrect fixtures expose both required feedback fields and zero prohibited private fields.
- **SC-010**: Explanation calibration covers positive, incorrect, irrelevant, contradictory, missing, privacy-unsafe, and boundary examples, with every disagreement and execution error preserved.

## Assumptions

- The canonical T09 specification, response contract, evaluation plan, adopted behavior constitution, and original implementation plan remain the authority; this component does not invent a new behavior policy.
- The approved server-authoritative two-attempt decision supersedes the former page-local/first-valid behavior. The integration owner must reconcile the canonical T09 documentation before the upgraded evaluation contract is frozen.
- Component 101 proposes `PrivateAssessment.learner_safe_explanation`, `TransferAttemptSnapshot`, and the `TransferResolvedAssessment` union in `specs/101-transfer-domain/contracts/`; component 104 pins the promoted versions rather than copying their logic.
- Component 102 owns `PublicAssessmentDTO {id, student_id, selection_type, stem, options}` and `ProcessedMessageDTO` with `processing_state`, `answer_outcome`, and terminal-only `terminal_failure_feedback` in `specs/102-transfer-backend/contracts/`; component 104 pins the promoted versions and tests their evaluation boundary.
- The original-plan source is the parent-level `plan/transfer_assessment_implementation_plan.md` and its preserved SHA-256 is the supplied hash.
- The existing Promptfoo harness and project model configuration are inspected before implementation; no API key, base URL, judge model, or provider parameter is invented when it is absent from the checked-in examples.
- Live model evaluation, judge calibration against real outputs, independent holdout execution, and release acceptance are later execution stages; planning artifacts may record them as pending but may not claim them as passed.
- The candidate prompt, shared v3 request/context builder in `ecologicalTutorCall.ts`, 1,200-token production setting, and production provider/secret path remain owned by component 102; component 104 consumes their exported contract identity and reports missing or incompatible exports as integration blockers.
- Development fixtures and historical Promptfoo runs are not eligible independent holdouts unless their provenance and exposure rules satisfy the frozen evaluation contract.
- Raw run evidence is immutable by run ID; re-runs or contract changes create a new manifest/run version rather than overwriting prior evidence.
- Deterministic supporting checks may proceed when a semantic judge is unavailable, but missing semantic evidence blocks full T09 acceptance and cannot be replaced by keyword matching.
- Existing legacy behavior assertions remain regression evidence where applicable; T09-specific inapplicability is explicit and does not delete historical assertions.
- Database/authentication, production provider-path, browser, activation, and rollback gates remain downstream and are not represented as Promptfoo passes.
- The target and semantic judge both use `qwen3.5-flash` through the existing DashScope-compatible provider. This human decision is recorded by the integration owner at commit `df40f32`; runtime configuration must match it and missing values block execution without fallback.
