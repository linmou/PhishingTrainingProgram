# Data Model: Two-Attempt Transfer Evaluation Evidence

**Intent**: define the evaluator records and relationships needed to preserve comparable W9-W10 evidence without adding product state.

## TransferCase

One versioned input/expected-outcome record for one T09 scenario.

Required fields:

- `case_id`: stable unique identifier.
- `case_version`: immutable content version.
- `source_type`: `product_template` or `synthetic_holdout`, following the repository's established Promptfoo source convention. Development/regression status is carried by `partition` and exposure metadata, not a third source type.
- `case_role`: positive, negative, boundary, recovery, regression, multi_target, guard, clarification, assistance, contradiction, spontaneous_transfer, or semantic_pair_member.
- `source_provenance`: source record/template ID, revision or export time, author, changed-field rationale, and exposure history.
- `input`: target-visible scenario, ordered conversation/history, latest learner contribution, configured inventory/targets, prior participation/progress/question state, and stable referenced message/item IDs.
- `evaluator`: expected decisions, prohibited outcomes, applicable checks, expected state transitions, label rationale, and human review metadata. This projection is never sent to the target model.
- `partition`: calibration, development, regression, baseline, candidate, or holdout membership, with the required source/role partitions derived from it.
- `pair`: nullable pair ID, member role, changed semantic factor, and expected contrast.
- `transition`: nullable ordered state/turn assertions for stateful sequences.
- `attempt_sequence`: nullable ordered authoritative before/after attempt snapshots, processing disposition, terminal outcome, transition identity, reload/tab/concurrency context, and role-safe projection assertions.
- `explanation`: nullable generated/reviewed values, edit provenance, correct-answer reference, tested concept/context, disclosure stage, and applicable quality/disclosure checks.
- `holdout_eligibility`: author independence, prompt exposure, development exposure, creation version, exposed flag, replacement link, and eligibility verdict.

Validation rules:

- `case_id` plus `case_version` is unique within a manifest.
- Target input contains no expected labels, rubric annotations, pair membership, holdout eligibility, or gate thresholds.
- A stateful sequence preserves all turns and asserts the result after each relevant step.
- A semantic pair has exactly two members, a single changed meaning-bearing factor, and different expected outcomes where the behavior requires a contrast.
- A holdout marked eligible has no target-prompt or development-dialogue exposure; exposed holdouts are regression-only.
- Missing or malformed expected metadata is a manifest error, not `not_applicable`.
- A first valid incorrect step remains open with exactly one remaining attempt and no terminal feedback or progress transition.
- A correct accepted step on attempt one or two passes once; a second valid incorrect step fails once; no sequence consumes a third attempt or applies two terminal transitions.
- Duplicate, stale, malformed, unauthorized, assistance, Guard, replay, and post-terminal steps are non-consuming according to the promoted upstream disposition.

## AttemptSequence

One ordered evaluator record consuming the promoted component 101/102 lifecycle contract.

Fields:

- `assessment_id`, `sequence_id`, and ordered `steps`.
- `before` and `after`: promoted `TransferAttemptSnapshot` projections containing `accepted_attempt_count`, `resolution`, and processed message identities.
- `submission`: message/request identity, selected option IDs, client context (`same_page`, `reload`, `separate_tab`, or `concurrent`), and expected processing disposition.
- `result`: `processing_state`, `answer_outcome`, accepted attempt number, attempts used/remaining, terminal flag, transition identity, feedback-required flag, result code, replay identity, and terminal feedback presence.
- `expected`: consuming/non-consuming verdict, expected resolution, expected transition count, and allowed role-safe fields.

The evaluator compares actual producer output with these frozen expectations. It does not calculate correctness, mutate counters, or infer authorization.

## ExplanationEvidence

One record joining model generation, teacher review, terminal disclosure, and semantic judgment.

Fields:

- `generated_value` and `reviewed_value`, each with source artifact/version.
- `edit_provenance`: editor role, changed/not-changed flag, review identity, and confirmation identity without personal data.
- `correct_option_ids`, `concept_rule`, `source_context`, and `changed_context` as evaluator-only references.
- `learner_projection_stage`: `delivery`, `first_incorrect`, `passed`, or `second_incorrect_terminal`.
- `quality_result`: `learner_explanation_quality` judgment over the reviewed value.
- `disclosure_result`: `learner_explanation_disclosure` expected/actual allowed and prohibited fields plus upstream provenance.

Generated and reviewed values remain distinct. Only the reviewed value is scored as the terminal learner-facing explanation.

## MetricContract

One stable check definition shared by target generation, judging, reporting, and gating.

Fields:

- `metric_id`: public rubric or supporting-check ID.
- `method`: `llm_rubric` or `deterministic`.
- `requirements`: T09/T09.x mappings and constitutional grounding reference.
- `checked_field_or_consumer`: exact parsed field, displayed output, state, or lifecycle consumer.
- `allowed_inputs`: the case fields the evaluator may inspect.
- `applicability`: case-fixed or predeclared conditional rule and the resulting `not_applicable` requirements.
- `pass_rule`: one-case pass/fail rule, including expected labels/sets for deterministic checks.
- `threshold`: frozen default or stricter partition threshold.
- `hard_partitions`: partitions requiring 100%.
- `calibration`: required annotations, judge version/settings, and calibration verdict.
- `version`: immutable contract version.

The six public T09 metric IDs are defined in [rubric-registry.md](contracts/rubric-registry.md). Deterministic supporting checks are `t09_contract_and_progress` and `learner_explanation_disclosure`.

## RunManifest

An immutable declaration of one run's complete comparison surface.

Fields:

- `run_id`, `manifest_version`, and creation timestamp.
- Hashes/references for constitution, T09 specification, response contract, evaluation plan, case manifest, rubric registry, adapter/prompt, deterministic checker, and gate source.
- Promoted component 101/102 contract paths, commit SHAs, content hashes, and integration promotion SHA.
- `partition_plan`: calibration, baseline, contract-compatible baseline, candidate, development/regression, and eligible holdout IDs.
- `settings`: target/judge model identities, endpoints without credentials, temperatures, token limits, retry/repair limits, timeout, concurrency, repetitions, and seed policy.
- `comparison`: baseline/candidate pairing rules, case/check versions, target generation ID and repetition join keys, and permitted changed experimental factors.
- `thresholds`: metric and partition thresholds, hard constraints, pair rule, error/missing rule, and non-regression rule.
- `commands`, git revision, worktree status, start/end time, exit codes, and token usage when available.
- `immutability`: manifest hash and write-once run directory path.

## SharedRequestContractSnapshot

One immutable record of the component-102-owned product contract used for target generation.

Fields:

- shared v3 contract version and source hash for `tutor-system/src/services/ecologicalTutorCall.ts`;
- exported builder identity and normalized request/message hash;
- backend-owned production prompt reference and content hash, without copied prompt text;
- product and evaluation effective completion-token budgets, each exactly `1200`;
- parity fixture/version and normalized product/evaluation request comparison result;
- provider/transport configuration reference with credentials and secret values excluded;
- evaluation adapter source hash proving which thin consumer produced the request.

A missing identity, a hash mismatch, a budget other than `1200`, or unequal normalized product/evaluation messages makes the run `incomplete` before rubric scoring. Evaluator-only fields are not part of this snapshot or either target request.

The manifest is frozen before candidate prompt evaluation and is never overwritten. A contract, case, rubric, setting, or gate change creates a new manifest version and requires a new comparable baseline.

## CaseEvidence

One result record per `run_id`, `case_id`, `case_version`, `metric_id`, repetition, and turn/check identity.

Fields:

- Complete target input projection and source/partition/provenance references.
- Raw target request/response, parsed response, displayed response, and target-generation ID.
- Authoritative attempt before/after snapshots, processing disposition, terminal/progress identities, and exact role-safe DTO projection for each sequence step.
- Generated and reviewed explanation values plus edit provenance, with learner-facing judgment attached to the reviewed value.
- `expected` and `actual` values, or semantic judgment output and rationale.
- `method`, `status` (`pass`, `fail`, `not_applicable`, `missing`, or `error`), score when supplied, and applicability evidence.
- Raw and parsed judge output/settings for LLM rubrics.
- Deterministic expected/actual details for contract/state checks.
- Pair/transition IDs and member/step identity where applicable.
- Error, retry, timeout, and provider metadata without credentials.

Every expected record must exist. `missing` and `error` records remain in the denominator and block acceptance where the check is required.

## QualityGateVerdict

The gate output summarizes, without replacing, all case evidence.

Fields:

- `verdict`: `accepted`, `failed`, or `incomplete`.
- Per-metric, per-partition exact numerator/denominator and threshold.
- Coverage and applicability counts, including zero-coverage partitions.
- Missing/error lists and execution/judge status.
- Baseline/candidate comparable joins, pass-to-fail regressions, and applicability changes.
- Pair and stateful-transition results.
- Links/hashes to the immutable run and manifest.
- Non-substitution statement naming product/database/browser gates that remain separate.

## Relationship and denominator rules

```text
RunManifest 1 -- * TransferCase
RunManifest 1 -- * MetricContract
RunManifest 1 -- 1 SharedRequestContractSnapshot
RunManifest 1 -- * CaseEvidence
TransferCase 1 -- * CaseEvidence
MetricContract 1 -- * CaseEvidence
AttemptSequence 1 -- * ordered AttemptStepEvidence
ExplanationEvidence 1 -- 1 reviewed learner projection
SemanticPair 1 -- 2 TransferCase
StatefulSequence 1 -- * ordered transition assertions
CaseEvidence * -- 1 QualityGateVerdict (aggregation only)
```

Expected case/check/repetition records are derived from the frozen manifest, not from returned report rows. A missing returned row is itself evidence and cannot shrink the denominator.
