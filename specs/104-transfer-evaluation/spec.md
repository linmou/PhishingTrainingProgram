# Feature Specification: Transfer Assessment Evaluation

<!-- Intent: define the evidence needed to judge transfer-assessment behavior, answer sequences, and learner-safe explanations. -->

**Feature Branch**: `104-transfer-evaluation`  
**Created**: 2026-09-11  
**Updated**: 2026-09-22  
**Status**: Draft  
**Input**: Upgrade transfer assessment evaluation for server-authoritative two-attempt sequences and learner-safe explanation correctness/safety.

## Scope and Authority

This specification is the source of truth for what the transfer evaluation must measure and what evidence is required before a candidate can pass its quality gate. The approved lifecycle is authoritative across reloads and tabs: the first valid incorrect answer remains open, a correct answer on either of two valid attempts passes, and a second valid incorrect answer fails. Invalid, stale, unauthorized, duplicate, and post-terminal submissions do not consume an attempt or create another progress transition.

The evaluation judges transfer behavior, learner-safe explanation quality, production/evaluation parity, and evidence completeness. It does not implement production generation, persistence or authorization, room presentation, or release-browser acceptance. Supporting plans and contracts define the exact cases, measures, generation references, evidence records, and gate settings. Evaluation evidence cannot satisfy database, authorization, room, or browser release gates.

## Clarifications

### Session 2026-09-22

- Q: Must the two-attempt lifecycle persist across reloads and tabs? -> A: Yes. Attempts are backend-authoritative and persistent across reloads and tabs.

No further material evaluation ambiguity remains. Shared interface names and values are consumed from the promoted domain and service contracts and are not redefined here.

## User Scenarios & Testing

### User Story 1 - Make Transfer Evaluations Comparable (Priority: P1)

As an evaluation owner, I need a fixed set of scenarios and expected outcomes so that candidate changes are compared against the same observable transfer behavior.

**Why this priority**: Without a frozen contract, baseline and candidate results are not comparable and prompt work can silently change the target behavior.

**Independent Test**: Evaluate the same scenarios against the same expected outcomes and partitions without consulting the candidate prompt for its own labels. Confirm that the measures and applicability remain stable across runs.

**Acceptance Scenarios**:

1. **Given** a transfer scenario with learner history, current message, prior state, target context, and expected outcomes, **when** it is evaluated, **then** its role, source, requirement mapping, inputs, assertions, partition, pair/sequence information, and holdout eligibility are identifiable without exposing expected labels to the target.
2. **Given** a generated response, **when** its behavior is evaluated, **then** the existing transfer measures, the separate learner-safe explanation measure, and deterministic checks use that same response rather than separate target generations. Their exact names and evidence rules are defined in the [rubric registry](contracts/rubric-registry.md).
3. **Given** a candidate is compared with the approved source baseline, **when** its evidence is recorded, **then** the comparison uses the preserved baseline identity. Its exact source reference is pinned in the [run manifest](contracts/run-manifest.md).
4. **Given** one frozen transfer scenario, **when** product and evaluation generation are compared, **then** they use the same approved production behavior and output budget, with no evaluator-only information in either target input. Exact references and settings are defined in the [backend provider contract](../102-transfer-backend/contracts/provider-contract.md) and [run manifest](contracts/run-manifest.md).

### User Story 2 - Prove Deterministic Transfer Lifecycle Behavior (Priority: P1)

As an evaluator and reviewer, I need deterministic supporting checks for the transfer contract and lifecycle so that exact state, selection, and sequencing failures cannot be hidden by semantic scores.

**Why this priority**: Exact contract and lifecycle violations are blocking validity failures. They must remain visible even when a response sounds persuasive.

**Independent Test**: Compare expected and observed outcomes across positive, negative, boundary, recovery, regression, and malformed scenarios, including each required transition and both members of every semantic pair. Missing or unresolved results must remain visible.

**Acceptance Scenarios**:

1. **Given** valid and invalid transfer decisions and progress changes, **when** their outcomes are assessed, **then** valid behavior passes and invalid mode, instruction, content, identity, answer-count, rendering, or progress outcomes fail with reviewable evidence.
2. **Given** a delivered assessment and learner messages, **when** follow-up checks run, **then** delivery precedes grading, a first incorrect valid answer remains open with one attempt left, correct on either attempt passes, a second incorrect valid answer fails, format clarification remains open, assistance cancels without failure, and feedback precedes a later assessment.
3. **Given** reloads, duplicate tabs, concurrent submissions, retries, or idempotent replay, **when** attempt evidence is joined, **then** every view converges on one persisted attempt count, at most two consumed valid attempts, and exactly one terminal progress transition.
4. **Given** a semantic pair or ordered behavior sequence, **when** one member, transition, or required result is missing or wrong, **then** the gate fails it rather than averaging the problem into an overall score.

### User Story 3 - Measure Frozen Transfer Semantics (Priority: P1)

As a prompt author and behavior reviewer, I need calibrated semantic measures and comparable evaluation runs so that a candidate can be evaluated for meaningful transfer without changing production behavior in this feature.

**Why this priority**: Transfer quality concerns meaning, evidence, and instructional validity; deterministic structure alone cannot establish it.

**Independent Test**: Calibrate semantic judgments on annotated positive, negative, boundary, and contradictory examples; evaluate baseline and candidate on the same frozen development and regression scenarios; inspect per-scenario judgments and partitioned changes.

**Acceptance Scenarios**:

1. **Given** a learner evidence history and current target, **when** eligibility is evaluated, **then** target selection follows learner-owned evidence without strong prior proof, selects at most one relevant current target, and preserves multi-target evidence updates.
2. **Given** an assessment or spontaneous-transfer scenario, **when** transfer quality is evaluated, **then** the changed situation tests the same concept and changes a meaning-bearing fact rather than only a brand or name.
3. **Given** a candidate question, **when** its validity and source evidence are evaluated, **then** it is accurate, self-contained, relevant, non-invented, and grounded in observable source evidence and distinct original and changed contexts.
4. **Given** a resolved assessment sequence, **when** follow-up behavior is evaluated, **then** result-specific feedback precedes another assessment, a wrong answer alone does not activate Guard, and failed transfer is not immediately reused in the same context.
5. **Given** a generated or teacher-reviewed learner-safe explanation, **when** its quality is evaluated, **then** it accurately connects the correct answer to the tested concept and changed context, agrees with the key, and exposes no private transfer basis, model rationale, raw output, or unrelated learner data.
6. **Given** delivery, first-incorrect, pass, and second-incorrect projections, **when** disclosure checks run, **then** correct-option IDs and explanation appear only in the authorized learner's second-incorrect terminal projection.

### User Story 4 - Preserve Complete, Blocking Evidence (Priority: P2)

As a release reviewer, I need immutable raw evidence and a blocking quality gate so that missing coverage, execution errors, regressions, and pair failures cannot be reported as success.

**Why this priority**: A score without provenance or complete denominators cannot support a defensible integration decision.

**Independent Test**: Evaluate reports with missing results, judge errors, zero coverage, baseline regression, and a failed semantic pair. Confirm that only complete, immutable evidence can produce a pass verdict.

**Acceptance Scenarios**:

1. **Given** calibration, baseline, candidate, and eligible independent holdout partitions, **when** a run is recorded, **then** each case preserves raw inputs, raw/parsed/displayed outputs, judgments, expected/actual values, evaluator settings, metadata, and immutable contract/prompt/case/rubric/manifest references.
2. **Given** a report with an omitted case, assertion, metric, partition, or judge result, **when** the gate evaluates it, **then** the missing result remains in the denominator and blocks acceptance.
3. **Given** candidate metrics that meet the nominal threshold but decline against the unchanged baseline, or a semantic pair with one failing member, **when** the gate evaluates them, **then** the candidate fails with the affected case/assertion and comparison evidence.
4. **Given** a passing evaluation, **when** release readiness is assessed, **then** the result is labeled evaluation evidence only and does not claim database, authorization, or browser-release acceptance.

### Edge Cases

- A scenario may apply to one measure and not another; only a predeclared, evidenced not-applicable result may leave a denominator.
- A zero-applicable partition is zero coverage, not a 100% pass.
- Missing target output, malformed output, judge failure, and ordinary behavior failure remain distinct outcomes; missing, error, and fail are not interchangeable.
- An evaluator must not read expected labels, holdout eligibility, pair membership, or rubric annotations from target inputs.
- A semantic pair must hold wording, entities, length, and cue counts as constant as practical while changing one meaning-bearing fact, and both members must be evaluated jointly.
- A recovery case must preserve every prior turn and assert state after each step; a single final response cannot replace sequence evidence.
- A concurrent race for the second-attempt slot may produce one accepted terminal result and one duplicate or conflict result, but never a third consumed attempt or second transition.
- A teacher edit preserves generated and reviewed explanation values plus provenance; the learner-facing quality judgment evaluates the reviewed value.
- A first-incorrect or pass payload containing terminal failure feedback is a disclosure failure even if a consumer ignores the field.
- A second-incorrect terminal payload with only the answer or only the explanation is incomplete and blocks acceptance.
- Calibration cases and development cases exposed to the prompt author cannot count as eligible independent holdouts.
- A baseline applicability change cannot turn a baseline failure into a candidate pass; the change remains visible for disposition.
- Live model, judge, provider, or configuration errors cannot be silently retried away, converted to learner failures, or removed from the denominator.
- Missing shared-generation identity, production prompt reference, effective output budget, or product/evaluation parity evidence is incomplete and blocks the run.
- Evaluation must consume the approved production generation behavior rather than reconstructing its prompt, transfer context, provider request, credentials, endpoint, or secret access.
- Evaluation evidence cannot be used to claim transfer release while the feature flag is disabled or any database, authorization, or browser gate is pending.

## Requirements

### Functional Requirements

- **FR-001**: The evaluation MUST define versioned scenarios with stable identity, source and role, complete target inputs and expected outcomes, requirement and measure mappings, applicability, partition, pair or sequence information, and holdout eligibility. The concrete scenario fields are defined in the [case contract](contracts/transfer-case-schema.md).
- **FR-002**: Expected labels, annotations, pair membership, holdout labels, and measure metadata MUST remain separate from target inputs while preserving enough evaluation context to reproduce generation.
- **FR-003**: The evaluation MUST preserve the five existing transfer behavior measures and add a separate calibrated measure for learner-safe explanation quality. Follow-up checks remain deterministic; explanation quality MUST NOT offset question validity or lifecycle failures. Exact measure names are defined in the [rubric registry](contracts/rubric-registry.md).
- **FR-004**: Each measure MUST state what behavior it evaluates, what evidence it uses, its requirement mapping and applicability, how a case passes, its threshold and calibration status, and how missing or failed judgments are handled. Meaning-based judgments MUST be calibrated; deterministic checks MUST use reviewed expected outcomes or exact allowed results.
- **FR-005**: The evaluation MUST include the two deterministic checks for the transfer decision/progress contract and role/stage disclosure. Each requires 100% and remains separate from meaning-based scores; exact names and evidence are defined in the [rubric registry](contracts/rubric-registry.md).
- **FR-006**: Evaluation scenarios MUST cover positive, negative, boundary, recovery, regression, multi-target, Guard, clarification, assistance, contradiction, spontaneous transfer, and controlled semantic-pair behavior. Any unavailable scenario type MUST be recorded as a named coverage gap.
- **FR-007**: The evaluation MUST preserve the distinct requirements for target eligibility, question validity, review/delivery/privacy, two-attempt resolution, progress outcome, and post-assessment sequencing. It consumes the approved behavior rather than reimplementing it.
- **FR-008**: Evaluation MUST include calibration, the unchanged production baseline, a contract-compatible baseline when required by response-contract changes, candidate, and eligible independent holdout partitions, with frozen scenario versions, settings, thresholds, and seed/repetition policy.
- **FR-009**: Baseline and candidate MUST be comparable on the same scenario and version, measure/assertion version, partition, generation identity, settings, and repetition policy. Changed experimental factors MUST be recorded separately from prompt changes.
- **FR-010**: Independent holdouts MUST be authored without exposure to the candidate prompt or development dialogues; their author, provenance, creation/exposure status, and eligibility MUST be recorded separately from target inputs.
- **FR-011**: Every run MUST preserve an immutable manifest and run record that identifies the governing constitution, canonical T09 behavior specification, response contract, evaluation plan, scenarios, measures, prompts/adapters, settings, command, revision, timing, model/provider metadata without credentials, and worktree state. Exact manifest fields are defined in the [run-manifest contract](contracts/run-manifest.md).
- **FR-012**: Every scenario/check result MUST preserve its input, raw output, parsed output, and displayed output where applicable, expected and observed values, judgment and reason, evaluation method and status, supplied score, generation identity, repetition/turn identity, and evaluator metadata.
- **FR-013**: The quality gate MUST fail on missing or errored required evidence, zero-coverage partitions, incomplete manifest coverage, unresolved judge/provider/harness errors, semantic-pair failure, required validity/transition failure, or candidate non-regression failure.
- **FR-014**: The quality gate MUST apply frozen thresholds by required partition and preserve exact fractions and denominators. Deterministic validity, exact transitions, declared pairs, and hard constraints require 100%; applicable meaning-based measures use the approved 80% default unless a stricter declared gate applies. Exact rules are defined in the [quality-gate contract](contracts/quality-gate.md).
- **FR-015**: The quality gate MUST report every newly failing scenario/assertion and every candidate-to-baseline regression with enough identifying information to locate the evidence. It MUST NOT hide a decline behind additional easy cases or an aggregate score.
- **FR-016**: Evaluation reports MUST label their result as evaluation evidence only and MUST state that database, authorization, provider-path, browser, feature-flag, and release gates remain separate.
- **FR-017**: When approved expectations cannot be met by current production behavior, the planning record MUST identify the required upstream change as a dependency without changing upstream implementation or claiming the change is already complete.
- **FR-018**: Evaluation MUST use the preserved original-plan baseline and MUST NOT change canonical transfer behavior or production prompt content as part of this work. The exact baseline path and SHA-256 identity are recorded in the [implementation plan](plan.md).
- **FR-019**: Every target generation MUST use the approved shared production request and context behavior. Evaluation MUST consume that behavior rather than provide another source of truth; the exact shared boundary is defined in the [implementation plan](plan.md) and [provider contract](contracts/provider-contract.md).
- **FR-020**: Product and evaluation generation MUST use the same production prompt identity and effective output budget. Evaluation MUST NOT copy prompt text or define independent request, context, or budget authority; exact references and values are defined in the [backend provider contract](../102-transfer-backend/contracts/provider-contract.md) and [run manifest](contracts/run-manifest.md).
- **FR-021**: Target generation MUST use only target-visible scenario information, and evaluation MUST NOT duplicate production prompt handling, provider endpoint or credential access, secret lookup, or transport.
- **FR-022**: The immutable run manifest and quality gate MUST record and verify versioned production-generation identity and hashes, prompt reference and hash, effective output budget, and product/evaluation parity. Any missing value or mismatch MUST block scoring with an incomplete verdict.
- **FR-023**: Each ordered attempt step MUST represent its before/after state, attempt number, processing outcome, remaining chances, terminal result, progress-transition identity, reload/tab/concurrency context, and learner-visible result. The exact representation is defined in the [case contract](contracts/transfer-case-schema.md).
- **FR-024**: Lifecycle evaluation MUST require: first wrong remains retryable with one accepted attempt, no progress transition, and no terminal feedback; a correct answer on either attempt passes once; a second wrong answer fails once; and every terminal result has no remaining attempts.
- **FR-025**: Duplicate replay, stale or malformed input, assistance, Guard, unauthorized input, and every post-terminal or third submission MUST consume no attempt and cause no progress transition according to the approved transfer behavior.
- **FR-026**: Evaluation coverage MUST include correct-first, wrong-then-correct, wrong-then-wrong, reload, separate-tab, concurrent second submissions, duplicate replay, stale, malformed, unauthorized, assistance, Guard, and post-terminal behavior.
- **FR-027**: Learner-safe explanation quality MUST assess factual correctness, relevance to the tested concept and changed context, agreement with the correct answer, and learner-appropriate safety, using positive, incorrect, irrelevant, contradictory, privacy-unsafe, and boundary examples.
- **FR-028**: Disclosure evaluation MUST verify that the public question contains no private grading material or rendered duplicate content; delivery, first-incorrect, and pass results expose neither answer nor explanation; only the authorized learner's second-incorrect terminal result exposes both. Exact field allowlists are defined by the [assessment API contract](../102-transfer-backend/contracts/assessment-api.md).
- **FR-029**: Explanation evidence MUST preserve generated and teacher-reviewed values plus edit provenance, and quality judgment MUST evaluate the reviewed value used for terminal failure feedback.
- **FR-030**: Missing, blank, incorrect, contradictory, irrelevant, or privacy-unsafe explanations MUST remain visible as failed, missing, or errored evidence and block applicable acceptance. Keyword or pattern matching MUST NOT replace meaning-based judgment.
- **FR-031**: The run manifest MUST pin the approved domain and backend contract paths and hashes and reject historical first-valid-resolution evidence as proof of the current lifecycle.
- **FR-032**: Live target and judge calls MUST use the approved production generation configuration; missing or mismatched configuration MUST block execution without a runtime fallback. Exact target and judge settings are defined in the [research record](research.md) and [backend provider contract](../102-transfer-backend/contracts/provider-contract.md).

### Key Entities

- **Transfer scenario**: A versioned input and expected-outcome record with its source, role, prior learner state, current contribution, target context, requirement mappings, partition, and pair or sequence information.
- **Evaluation measure**: A stable definition of the behavior being judged, the evidence used, applicability, calibration, threshold, and failure handling.
- **Run manifest**: An immutable snapshot of the inputs, identities, settings, partitions, repetitions, and gate rules used for an evaluation run.
- **Scenario evidence**: The input, outputs, expected and observed results, judgment, and status for one scenario and measure.
- **Calibration set**: Annotated positive, negative, boundary, and contradictory examples used to validate meaning-based judgments before comparison.
- **Evaluation partition**: A declared calibration, baseline, candidate, development/regression, or eligible independent holdout group with provenance and denominator rules.
- **Semantic pair**: Two jointly evaluated scenarios that differ in one meaning-bearing factor and have different expected outcomes.
- **Behavior sequence**: An ordered scenario with prior turns and expected state and decision changes for recovery, assistance, clarification, contradiction, and follow-up.
- **Quality-gate verdict**: A blocking pass, fail, or incomplete result with evidence for measures, partitions, coverage, regression, pairs, and execution.
- **Production-generation reference**: The approved shared generation identity, prompt reference, and effective output budget used by both product and evaluation. Exact hashes and values are defined in the [backend provider contract](../102-transfer-backend/contracts/provider-contract.md) and [run manifest](contracts/run-manifest.md).
- **Attempt sequence**: Ordered before/after evidence for each answer, assessment, message/request, attempt, and progress transition.
- **Explanation evidence**: Generated and reviewed explanation values, edit provenance, answer reference, tested concept/context, and role-appropriate terminal projection.
- **Disclosure check**: A comparison of the allowed learner information and its source across delivery, retry, pass, and terminal failure.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Before candidate evaluation begins, the manifest maps all five existing behavior measures, the separate explanation measure, both deterministic checks, lifecycle responsibilities, attempt/explanation roles, partitions, and gate rules to versioned artifacts.
- **SC-002**: Evaluation covers all expected lifecycle, disclosure, contract, transition, identity, answer-count, rendering, and progress outcomes; no assessment consumes more than two attempts or produces more than one terminal transition.
- **SC-003**: Every completed calibration, baseline, candidate, or holdout run records evidence for all expected scenario/measure/repetition combinations, or includes missing/error outcomes in the denominator and returns an incomplete or blocking verdict.
- **SC-004**: Before baseline acceptance is evaluated, calibration records positive, negative, boundary, and contradictory examples plus judgment settings, version, decisions, disagreements, and unresolved errors.
- **SC-005**: Candidate acceptance requires at least 80% for each applicable meaning-based measure overall and in every required partition, no decline against the unchanged comparable baseline, 100% for semantic pairs and declared hard constraints, and zero unresolved missing/error results.
- **SC-006**: Missing results, evaluator errors, zero-coverage partitions, above-threshold regression, and a one-member semantic-pair failure all block a passing verdict.
- **SC-007**: Reports identify evaluation results as evidence only and explicitly distinguish them from database, authorization, provider-path, browser, activation, and rollback gates.
- **SC-008**: For every frozen parity scenario, product and evaluation use identical normalized generation messages, matching version/hash references for the shared builder and production prompt, equal output budgets, and no evaluator-only fields or provider secrets in target inputs or evidence.
- **SC-009**: Delivery, first-incorrect, and pass outcomes expose none of the answer or explanation; every terminal second-incorrect outcome exposes both to the authorized learner and no prohibited private fields.
- **SC-010**: Explanation calibration covers positive, incorrect, irrelevant, contradictory, missing, privacy-unsafe, and boundary examples, with every disagreement and execution error preserved.

## Assumptions

- The canonical T09 specification, response contract, evaluation plan, behavior constitution, and original implementation plan remain the authority; this feature does not invent a new behavior policy.
- The approved server-authoritative two-attempt decision supersedes the former page-local/first-valid behavior. The integration owner must reconcile the canonical T09 documentation before the upgraded evaluation contract is frozen.
- The shared transfer domain rules define the private learner-safe explanation, attempt state, and terminal outcomes; the trusted-service API defines public and processed-answer projections. Evaluation consumes those approved contracts without copying their behavior.
- The approved original-plan source and hash remain fixed comparison references; the exact identity is preserved in the [implementation plan](plan.md).
- Evaluation uses only approved project provider settings. Missing keys, endpoints, models, or other required settings block execution; absent values are not inferred or invented.
- Live model evaluation, judge calibration against real outputs, independent holdout execution, and release acceptance are later execution stages; planning artifacts may record them as pending but may not claim them as passed.
- The candidate prompt, shared request/context behavior, production output budget, and provider/secret path remain owned by the trusted generation capability; evaluation consumes their approved identity and reports missing or incompatible references as blockers. Exact values are maintained in the [backend provider contract](../102-transfer-backend/contracts/provider-contract.md).
- Development scenarios and historical evaluation runs are not eligible independent holdouts unless their provenance and exposure rules satisfy the frozen evaluation contract.
- Raw run evidence is immutable by run ID; re-runs or contract changes create a new manifest/run version rather than overwriting prior evidence.
- Deterministic supporting checks may proceed when a semantic judge is unavailable, but missing semantic evidence blocks full T09 acceptance and cannot be replaced by keyword matching.
- Existing legacy behavior assertions remain regression evidence where applicable; T09-specific inapplicability is explicit and does not delete historical assertions.
- Database/authorization, production provider-path, browser, activation, and rollback gates remain separate and are not represented as evaluation passes.
- The target and semantic judge use the same approved model and provider configuration, as recorded in the [research record](research.md) and [backend provider contract](../102-transfer-backend/contracts/provider-contract.md); missing or mismatched settings block execution without fallback.
