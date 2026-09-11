# Data Model: Transfer Evaluation Evidence

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
- `holdout_eligibility`: author independence, prompt exposure, development exposure, creation version, exposed flag, replacement link, and eligibility verdict.

Validation rules:

- `case_id` plus `case_version` is unique within a manifest.
- Target input contains no expected labels, rubric annotations, pair membership, holdout eligibility, or gate thresholds.
- A stateful sequence preserves all turns and asserts the result after each relevant step.
- A semantic pair has exactly two members, a single changed meaning-bearing factor, and different expected outcomes where the behavior requires a contrast.
- A holdout marked eligible has no target-prompt or development-dialogue exposure; exposed holdouts are regression-only.
- Missing or malformed expected metadata is a manifest error, not `not_applicable`.

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

The five public T09 metric IDs are the exact semantic rubric names from [rubric-registry.md](contracts/rubric-registry.md). The deterministic supporting check is `t09_contract_and_progress`.

## RunManifest

An immutable declaration of one run's complete comparison surface.

Fields:

- `run_id`, `manifest_version`, and creation timestamp.
- Hashes/references for constitution, T09 specification, response contract, evaluation plan, case manifest, rubric registry, adapter/prompt, deterministic checker, and gate source.
- `partition_plan`: calibration, baseline, contract-compatible baseline, candidate, development/regression, and eligible holdout IDs.
- `settings`: target/judge model identities, endpoints without credentials, temperatures, token limits, retry/repair limits, timeout, concurrency, repetitions, and seed policy.
- `comparison`: baseline/candidate pairing rules, case/check versions, target generation ID and repetition join keys, and permitted changed experimental factors.
- `thresholds`: metric and partition thresholds, hard constraints, pair rule, error/missing rule, and non-regression rule.
- `commands`, git revision, worktree status, start/end time, exit codes, and token usage when available.
- `immutability`: manifest hash and write-once run directory path.

The manifest is frozen before candidate prompt evaluation and is never overwritten. A contract, case, rubric, setting, or gate change creates a new manifest version and requires a new comparable baseline.

## CaseEvidence

One result record per `run_id`, `case_id`, `case_version`, `metric_id`, repetition, and turn/check identity.

Fields:

- Complete target input projection and source/partition/provenance references.
- Raw target request/response, parsed response, displayed response, and target-generation ID.
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
RunManifest 1 -- * CaseEvidence
TransferCase 1 -- * CaseEvidence
MetricContract 1 -- * CaseEvidence
SemanticPair 1 -- 2 TransferCase
StatefulSequence 1 -- * ordered transition assertions
CaseEvidence * -- 1 QualityGateVerdict (aggregation only)
```

Expected case/check/repetition records are derived from the frozen manifest, not from returned report rows. A missing returned row is itself evidence and cannot shrink the denominator.
