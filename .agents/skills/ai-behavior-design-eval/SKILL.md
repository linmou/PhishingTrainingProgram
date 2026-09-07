---
name: ai-behavior-design-eval
description: "Design AI behavior constitutions and grounded specs, prepare evaluations, refine prompts, or review candidates against a baseline."
---

# AI Behavior Design and Evaluation

Intent: ground observable behavior specs in shared principles and priorities before measuring them, then accept prompt changes only on comparable evidence.

## Choose the endpoint

- **Constitution design or revision:** complete step 0 only; do not silently redesign downstream specs.
- **Design:** complete steps 0–1.
- **Preparation:** complete steps 0–4; record unrun calibration and missing inputs as pending.
- **Evaluation or prompt refinement:** complete steps 0–7, reusing verified artifacts from completed stages.
- **Saved-run review:** load the pinned constitution and grounding review alongside the saved spec, evaluation contract, manifest, and reports; complete steps 6–7. Missing evidence produces an incomplete verdict, not an automatic rerun or retroactive approval.
- **Release verification:** include the product checks in step 6.

Discussion stays in conversation. Perform writes and live actions only within the requested endpoint. This workflow does not invoke a TDD skill.

Keep one shared `constitution.md`. Use separate artifacts with one responsibility: a behavior design from [the design template](assets/behavior-design.md), a response/consumer contract when needed, an evaluation plan from [the plan template](assets/evaluation-plan.md), immutable harness cases/rubrics, and one executed-run report from [the run-record template](assets/behavior-record.md). The project index links them. Reuse the existing specification path; design and specification name the same artifact responsibility, so do not create a second active requirement source or retain a duplicate composite file as an archive. A retained old filename can contain only a pointer. Keep raw runs in immutable directories. For a Promptfoo project, read [the integration reference](references/promptfoo.md) before choosing project paths or changing the harness.

## 0. Establish constitutional grounding

Read [the constitution reference](references/constitution.md) when designing or revising principles/specs, or reviewing their grounding. The constitution owns overall principles and their priorities; each spec interprets them for a particular behavior. Reuse the applicable version rather than rewriting it for every spec.

This stage is human-in-the-loop: draft principles, priorities, exceptions, and changes for human review; only an explicit decision by the responsible human can adopt or revise them. Reuse recorded human decisions for unchanged versions, not agent-inferred approval. Constitutional changes require an impact inventory of affected specs and evaluations. Present the proposal and unresolved choices, then pause adoption and dependent acceptance work for human feedback.

**Complete when:** the constitution has a stable identity/version, explicit principles and conflict rules, and a recorded human-review/adoption status; revisions identify downstream work. A requested draft can be delivered complete, but adoption remains pending until the human decision is recorded.

## 1. Persist the spec

Write numbered requirements defining the user or learning outcome, triggering input/history/state, required and prohibited results, permitted alternatives, downstream effect, and non-goals. Give the behavior and each requirement stable IDs. Draft edits remain unversioned; freeze content hashes for execution and register a spec version only with its completed experiment package. Examples should resolve ambiguity without prescribing exact model wording.

Pin the constitution reference and annotate each requirement with its applicable principle IDs, contextual interpretation, and any priority/exception used. The downstream requirement owns this mapping. Do not create a separate constitutional-grounding section, duplicated mapping table, or reverse mapping in the upstream constitution. Record the grounding-review status in the design metadata. A spec cannot silently override the constitution. Resolve or flag inconsistent existing requirements rather than removing their regression checks.

Use [the response-contract template](assets/response-contract.md) for new structured contracts. `reason` and `response` are default non-empty string fields and need no separate definitions; serialize `reason` first and use observable evidence, not hidden chain-of-thought. Add a nested `decision` object when explicit decisions are needed. Define each decision field and its categories with upstream requirement references and the grounding logic beside the definition. Record decision order and dependencies: decide upstream fields before dependent fields, for example mode before instructional method, then compose the response. Specify each decision's type, enums, nullability, consumer, and how upstream values constrain downstream choices. Preserve the template's existing tutor categories; adapt categories for another product through explicit behavior design. Retry invalid output by default within the configured retry limit, then surface failure; do not infer missing decisions from prose. Preserve deployed contracts and record conflicts with project guidance; schema migration is a separate declared change.

**Complete when:** the design file exists and every requirement has an observable trigger, outcome, and constitutional-grounding annotation; behavior-changing ambiguities are resolved or explicitly pending. A design edit has no experimental version until an executed run pins it with its prompt, rubrics, cases, and results. Persist it before authoring rubrics or changing prompts.

## 2. Derive the checks

Read [the evaluation contract reference](references/evaluation-contract.md) before authoring rubrics/cases or assessing saved results. It owns calibration, provenance, holdout eligibility, gate rules, and run evidence.

Map each behavior requirement to stable metrics, choosing deterministic checks for computable outcomes and LLM rubrics for meaning-based judgments. One spec may use both; independent checks do not automatically require separate specs. Keep supporting contract/operational checks outside the behavior scorecard when they are not evaluation objectives.

Use a separate evaluation-plan artifact to declare method, checked output, applicability, expected evidence, snapshots, and thresholds. Validate deterministic check logic and expected labels; calibrate LLM judges before baseline evaluation. Do not substitute either method silently when the other is unavailable.

Identify requirements that can apply together, including across behavior specs sharing the same response or state. Record known dependencies, tensions, and adopted priority rules; unresolved contradictions remain design gaps. Declare any joint acceptance checks before freezing; later exploratory interaction analysis does not create a new gate.

**Complete when:** every requirement has a mapped metric or supporting check, allowed evaluator inputs, pass/fail/boundary examples, and a defined result format; check-validation and judge-calibration evidence or an explicit unrun status is recorded.

## 3. Audit existing cases

Annotate every existing case as `reuse`, `refine`, or `not_applicable` to the new behavior. Record why, mapped requirements/metrics, and exact proposed changes. Inapplicability removes only the new metric. Preserve all old assertions, including the original case variant when refinement changes their meaning.

**Complete when:** the applicability table accounts for every existing case and assertion, and identifies gaps across positive, negative, boundary, recovery, and regression roles.

## 4. Fill coverage and freeze

Add ecological cases and independently authored synthetic holdouts using the reference's provenance and exposure rules. Add controlled semantic pairs and stateful sequences where relevant. Label inapplicable roles and unavailable coverage explicitly.

Build a manifest containing full inputs/prior state, case versions, source and role, requirement mappings, expected/prohibited results, expected assertions, pairs/transitions, holdout eligibility, and required partitions. Keep evaluator annotations outside target inputs. Before freezing, require adopted constitutional authority and a resolved grounding review. Freeze the constitution reference, behavior-design snapshot, response-contract snapshot, rubrics, settings, thresholds, and manifest before baseline comparison.

**Complete when:** every required coverage cell has traceable cases or a named gap, every original assertion remains represented, and the manifest is explicitly draft or frozen. Preparation may end with gaps; evaluation readiness requires resolved coverage and calibration.

## 5. Baseline, then refine

Inspect the production call, harness commands, and executable gate. Register every new metric and verify the gate's coverage/error/regression handling. Obtain missing target/judge settings from project configuration examples or the user; semantic evaluation requires a semantic judge.

Run the unchanged production prompt on the full frozen development/regression set before prompt edits. An already-passing baseline needs no manufactured failure. For each iteration record observed failures, explanation, prompt diff, other changed experimental factors, and results. Diagnose grader/provider/harness errors separately from behavior failures.

Focused runs support diagnosis; acceptance candidates require the complete existing and expanded suite. Freeze the candidate before independent holdout validation, comparing baseline and candidate on the same holdouts under the reference's exposure rules. Preserve production settings and raw responses except for explicitly declared experimental changes. Contract/check/case changes require new versions and a fresh comparable baseline.

**Complete when:** immutable baseline/candidate evidence exists for every required comparison, or an execution blocker is recorded. Continue evidence-backed iterations through step 6 within the authorized budget; unavailable configuration, exhausted budget, or no defensible next experiment leaves evaluation incomplete or failed.

## 6. Decide acceptance

Apply every gate in [the evaluation contract](references/evaluation-contract.md#acceptance-gates) to the frozen manifest and comparable runs. Assess new-metric failures and existing regressions separately. Record every pass-to-fail case and permitted residual failure. During authorized refinement, a failed candidate returns to step 5; a review-only request reports the verdict.

Read [the final analysis reference](references/final-analysis.md) to investigate metric interactions and synthesize the report. Check joint outcomes where requirements apply together; distinguish empirical tradeoffs, evaluator defects, and incompatible requirements. Report material unresolved conflicts before acceptance without changing frozen gates or adopting new priorities. Established contradictions pause prompt-only refinement pending spec/grounding resolution.

Report constitutional grounding separately from model conformance. A passing benchmark cannot validate an unjustified spec interpretation or confer constitutional adoption.

For release-bound changes, read and execute [product verification](references/product-verification.md). Keep benchmark acceptance and release readiness as separate verdicts.

**Complete when:** every required case/assertion/partition is reconciled, every gate has a verdict supported by run evidence, and missing data remains visibly blocking. Acceptance requires all gates to pass; stopping work does not confer acceptance.

## 7. Complete the record

Create or finalize the executed-run record with immutable links to the design, contract, plan, prompt, rubrics, cases, baseline/candidate evidence, failure dispositions, and product evidence when required by project conventions. Do not place run results, planned cases, or prompt history in the behavior design.

For evaluation and saved-run review, complete the run record's final analysis and metric-interaction sections using [the reporting reference](references/final-analysis.md). Lead with the supported conclusion, explain gains and remaining weaknesses, distinguish observations from hypotheses, and give the next action. Earlier endpoints do not create an unrun run record or an unrun behavior-spec version.

**Complete when:** every claimed evaluation result is traceable to preserved artifacts, all linked files exist, and the run verdict distinguishes completed work, failures, and the exact remaining step. An experimental behavior version denotes a completed run of the full declared suite: its pinned specification, prompt, rubric/assertion set, case manifest, and per-case results must all exist. Failed behavior scores may still form a completed experiment; partial/interrupted runs keep their raw evidence and run IDs without becoming completed spec versions. Design/preparation can be complete without an experimental version.
