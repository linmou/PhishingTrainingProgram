# Evaluation contract

Intent: define the measurement and evidence rules shared by evaluation preparation, prompt refinement, and saved-run review.

## Checks and calibration

Choose the evaluator from the evidence needed, not the metric's name or an inherited rubric boundary:

| Method | Appropriate use | Validation before baseline |
| --- | --- | --- |
| Deterministic | Compare a parsed decision with a frozen expected label or allowed set; compute counts, bounds, or specified transitions. | Exercise passing, failing, boundary, and malformed inputs. For semantic decisions, record label provenance, policy rationale, and human review; ambiguous labels remain unresolved until reviewed. |
| LLM rubric | Assess meaning, grounding, relevance, tone, or response quality where exact comparison is insufficient. | Declare allowed input fields and one property per rubric, including absent/contradictory/irrelevant output. Calibrate against annotated positive, negative, and boundary responses; record judge settings and version demonstrated grader fixes. |

A semantic behavior can have a deterministic measurement: comparing `mode` to an expected label tests decision correctness without asking another model to decide the case again. That label is part of the evaluation contract, not independent proof that the policy interpretation is right. Use a separate LLM rubric for the explanation or intervention when those are required outcomes. Do not duplicate the same check under two metric names or average checks together to hide disagreement. If both methods intentionally assess the same property, declare their separate roles and adjudication rule before running.

Scope the behavior scorecard to the requested outcomes. Stable schema/parser checks can remain supporting validity checks rather than named behavior metrics; do not require a `structured_output` metric by default. Keep their failures visible as validity/execution issues and link existing validation evidence. Do not add hardening work unless requested or needed for trustworthy measurement. Explicit retirement or reclassification of an existing metric must be versioned, preserving historical results and any retained regression check.

## Shared measurement and reporting contract

Use one contract and case manifest for both methods. For each metric record requirement IDs, method (`deterministic` or `llm_rubric`), checked field/consumer, script or rubric version, allowed inputs, expected label/set or judgment criteria, applicability, and threshold. Pin judge configuration only where used. Supporting checks have IDs and failure handling but need not occupy behavior-metric rows.

Evaluate both methods against the same preserved target generation and declared field extraction; do not generate a different response for each evaluator. Keep expected labels and grader annotations out of target inputs. A wrong decision must remain a failure even if its explanation is persuasive. A missing judge leaves its metrics unrun; deterministic diagnostics may proceed, but cannot establish full acceptance or replace semantic judgment with keyword matching.

Preserve per-check case/version, metric/check ID, method, status (`pass`, `fail`, `error`, or `missing`), raw score when supplied, evidence/reason, and expected versus actual values for deterministic comparisons. Retain judge output and settings for rubric results. Invalid target output and evaluator errors are distinct from an ordinary behavior failure; downstream unevaluable checks remain visible rather than disappearing.

In reports and viewers, label each metric's method and show passed/expected, errors/missing, threshold, and verdict by suite/partition, alongside comparable baseline/candidate deltas. Derive expected counts from frozen applicability and repetitions, not returned components. Only predeclared `not_applicable` checks leave the denominator. Keep raw/mean scores separate from pass rates: graded scores need a declared per-case pass rule, and a score sum is not a pass count. Show supporting validity/execution issues separately; neither a high score nor a missing component can erase them.

Preserve the target generation ID and repetition/turn identity with each check so jointly applicable metrics can be joined on the same output. Final reports use [the final analysis reference](final-analysis.md) to investigate joint outcomes and requirement conflicts. Missing join evidence is an analysis gap; aggregate metric rates cannot reconstruct joint counts. Joint acceptance rules require predeclared applicability and thresholds under the same freeze/version rules as other checks.

## Case coverage and provenance

Positive cases require the behavior; negative cases distinguish similar inputs where it is inappropriate; boundary cases exercise ambiguity and limits; recovery cases begin with an error or earlier wrong state; regression cases preserve existing checks and identify historical failure provenance when available.

Trace checks through spec requirements to applicable constitutional principles. Include cases exercising conditional priorities and permitted exceptions where the spec relies on them; a broad constitutional-sounding rubric is not a substitute for observable requirements.

For semantic pairs, hold wording, entities, length, and cue counts as constant as practical while changing one meaning-bearing fact. Record the pair ID, changed factor, and different expected results. Negation, quoted speech, safe-action acceptance/refusal, and confusion/deliberate repetition are useful contrasts. Evaluate both members jointly. For stateful sequences, preserve every turn and assert the decision and resulting state after each step.

Ecological cases require real product records or version-controlled fixtures consumed by the product. Preserve source ID, revision/export time, scenario, history, configuration, and changed-field rationale. A derivative changes only the behavior-relevant field named by that rationale; multiple unrelated edits make it synthetic. Use the product exporter for generated fixtures. Ecological provenance establishes product relevance, not unseen generalization.

## Holdout lifecycle

An independent person or authorized separate agent authors holdouts from the frozen spec/rubrics, without the target prompt or development dialogues. Require distinct scenarios, entities, wording, and semantic boundaries. Record author, version, creation/exposure status, and provenance separately from current holdout eligibility. Missing independence is a declared coverage gap.

Withhold content and detailed failures from the prompt author until the candidate is frozen. An independent validation round evaluates baseline and candidate on the same held-out set. If holdout feedback informs tuning, retain its provenance and failures, mark it exposed, keep it in development/regression coverage, and independently author replacements. Run both baseline and candidate on the replacement set. Previously viewed synthetic cases remain useful tests but cannot count toward eligible unseen-holdout coverage.

## Acceptance gates

Freeze thresholds, required partitions, repetitions, and seed policy before runs. Thresholds follow the requirement's consequence, not the evaluator: a deterministic behavioral accuracy metric need not require perfection, while an LLM-judged hard constraint may require 100%. Use these defaults unless a different user/project requirement was specified before evaluation; retain stricter established gates.

| Gate | Passing condition |
| --- | --- |
| Constitutional grounding | Pinned human-adopted constitution with explicit decision evidence and resolved spec-grounding review; evaluation scores do not establish either. |
| Each new and existing behavior metric, deterministic or LLM-judged | At least 80% overall and independently in ecological, eligible synthetic-holdout, and each required applicable partition, unless a stricter gate below applies. |
| Existing-metric non-regression | Rate does not decline against the unchanged-prompt baseline on the same cases, assertions, settings, and partitions. |
| Required validity checks, exact transitions, declared safety-critical, and applicable constitutional hard-constraint checks | 100%, whether represented as behavior metrics or supporting checks. |
| Semantic pairs | 100% of pairs; both members satisfy their expected assertions. |
| Manifest coverage | Every expected case/assertion/metric/suite/partition has a result. |
| Evaluation, API, parsing, and judge errors | Zero unresolved errors; missing/error results cannot be omitted from denominators. |

Compare exact fractions. Keep unchanged regression slices visible when adding cases; extra easy cases cannot conceal a decline. A 95% to 81% drop fails non-regression despite clearing 80%. Report every newly failing case/assertion for review; a universal 100% case gate applies only when specified.

Aggregate every predeclared repetition instead of selecting the luckiest run. A legitimate requirement or grader correction receives a new behavior-design snapshot or evaluation-plan revision and comparable baseline; observed failures alone cannot justify lowering the gate. Benchmark acceptance requires complete immutable evidence, not merely a passing summary or overwritten `latest` report.

## Run evidence

Preserve successes and failures as they occur. Each immutable run directory contains:

- Complete target inputs: prompt, scenario, history, and prior state; raw, parsed, and displayed outputs.
- Prompt content or immutable reference; constitution, behavior-design, response-contract, case, rubric, and manifest snapshots/hashes, plus grounding-review evidence.
- Target/judge models, endpoints without credentials, temperature, limits, seed/repetition policy, and provider options.
- Typed per-check results under the shared contract, deterministic expected/actual evidence, raw and parsed judge output where applicable, aggregates, supporting-check failures, missing results, errors, thresholds, and verdict.
- Commands, exit codes, start/end times, token usage when available, git revision, and worktree changes.

Redact credentials and personal identifiers without altering tested meaning. Mark unavailable metadata explicitly. The executed run record summarizes these runs and links to them; it does not replace full input-output pairs or intermediate evidence.
