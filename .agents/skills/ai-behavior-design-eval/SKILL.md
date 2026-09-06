---
name: ai-behavior-design-eval
description: "AI behavior specs: use when designing a behavior, preparing its evaluation, refining its prompt, or reviewing a candidate against a baseline."
---

# AI Behavior Design and Evaluation

Intent: specify AI behavior before measuring it, then accept prompt changes only on comparable evidence.

## Choose the endpoint

- **Design:** complete step 1.
- **Preparation:** complete steps 1–4; record unrun calibration and missing inputs as pending.
- **Evaluation or prompt refinement:** complete steps 1–7, reusing verified artifacts from completed stages.
- **Saved-run review:** load the saved spec, evaluation contract, manifest, and reports; complete steps 6–7. Missing evidence produces an incomplete verdict, not an automatic rerun.
- **Release verification:** include the product checks in step 6.

Discussion stays in conversation. Perform writes and live actions only within the requested endpoint. This workflow does not invoke a TDD skill.

Keep one canonical behavior document in the project's documentation tree; default to `docs/ai-behaviors/<behavior_id>.md` when there is no convention. Use [the record template](assets/behavior-record.md), filling only reached stages and linking it from the project index. Keep rubrics/cases in the harness and raw runs in immutable directories. For a Promptfoo project, read [the integration reference](references/promptfoo.md) before choosing project paths or changing the harness.

## 1. Persist the spec

Write numbered requirements defining the user or learning outcome, triggering input/history/state, required and prohibited results, permitted alternatives, downstream effect, and non-goals. Give the behavior a stable ID and version. Examples should resolve ambiguity without prescribing exact model wording.

Preserve the existing response contract and explicitly record conflicts with project guidance. For a newly designed structured contract, require non-empty `reason` first and non-empty `response`; the reason cites observable evidence, not hidden chain-of-thought. Add `decision` only for explicit decisions, naming independent actions separately. Specify field types, enums, nullability, invalid-output handling, and consumers. Schema migration is a separate declared change.

**Complete when:** the project file exists and every requirement has an observable trigger and outcome; behavior-changing ambiguities are resolved or explicitly pending. Persist it before authoring rubrics or changing prompts.

## 2. Derive the checks

Read [the evaluation contract reference](references/evaluation-contract.md) before authoring rubrics/cases or assessing saved results. It owns calibration, provenance, holdout eligibility, gate rules, and run evidence.

Map every requirement to stable metrics: one semantic property per rubric, with separate deterministic assertions for computable constraints. A behavior may require several metrics. Prepare annotated calibration responses; execute calibration before the baseline when evaluation is authorized.

**Complete when:** every requirement has a check, allowed judge inputs, pass/fail/boundary examples, and a defined result format; calibration evidence or an explicit unrun status is recorded.

## 3. Audit existing cases

Annotate every existing case as `reuse`, `refine`, or `not_applicable` to the new behavior. Record why, mapped requirements/metrics, and exact proposed changes. Inapplicability removes only the new metric. Preserve all old assertions, including the original case variant when refinement changes their meaning.

**Complete when:** the applicability table accounts for every existing case and assertion, and identifies gaps across positive, negative, boundary, recovery, and regression roles.

## 4. Fill coverage and freeze

Add ecological cases and independently authored synthetic holdouts using the reference's provenance and exposure rules. Add controlled semantic pairs and stateful sequences where relevant. Label inapplicable roles and unavailable coverage explicitly.

Build a manifest containing full inputs/prior state, case versions, source and role, requirement mappings, expected/prohibited results, expected assertions, pairs/transitions, holdout eligibility, and required partitions. Keep evaluator annotations outside target inputs. Freeze the spec, rubrics, settings, thresholds, and manifest before baseline comparison.

**Complete when:** every required coverage cell has traceable cases or a named gap, every original assertion remains represented, and the manifest is explicitly draft or frozen. Preparation may end with gaps; evaluation readiness requires resolved coverage and calibration.

## 5. Baseline, then refine

Inspect the production call, harness commands, and executable gate. Register every new metric and verify the gate's coverage/error/regression handling. Obtain missing target/judge settings from project configuration examples or the user; semantic evaluation requires a semantic judge.

Run the unchanged production prompt on the full frozen development/regression set before prompt edits. An already-passing baseline needs no manufactured failure. For each iteration record observed failures, explanation, prompt diff, other changed experimental factors, and results. Diagnose grader/provider/harness errors separately from behavior failures.

Focused runs support diagnosis; acceptance candidates require the complete existing and expanded suite. Freeze the candidate before independent holdout validation, comparing baseline and candidate on the same holdouts under the reference's exposure rules. Preserve production settings and raw responses except for explicitly declared experimental changes. Contract/check/case changes require new versions and a fresh comparable baseline.

**Complete when:** immutable baseline/candidate evidence exists for every required comparison, or an execution blocker is recorded. Continue evidence-backed iterations through step 6 within the authorized budget; unavailable configuration, exhausted budget, or no defensible next experiment leaves evaluation incomplete or failed.

## 6. Decide acceptance

Apply every gate in [the evaluation contract](references/evaluation-contract.md#acceptance-gates) to the frozen manifest and comparable runs. Assess new-metric failures and existing regressions separately. Record every pass-to-fail case and permitted residual failure. During authorized refinement, a failed candidate returns to step 5; a review-only request reports the verdict.

For release-bound changes, read and execute [product verification](references/product-verification.md). Keep benchmark acceptance and release readiness as separate verdicts.

**Complete when:** every required case/assertion/partition is reconciled, every gate has a verdict supported by run evidence, and missing data remains visibly blocking. Acceptance requires all gates to pass; stopping work does not confer acceptance.

## 7. Complete the record

Finalize the original project document with the spec version, requirement/check mapping, coverage decisions, modifications and rationale, baseline/candidate snapshot, failure dispositions, and immutable evidence links. Add product evidence and the documentation update record when required by project conventions.

**Complete when:** every claimed modification and evaluation result is traceable to preserved artifacts, all linked files exist, and the verdict distinguishes completed work, unrun checks, failures, and the exact remaining step. Design/preparation can be complete while evaluation remains unrun.
