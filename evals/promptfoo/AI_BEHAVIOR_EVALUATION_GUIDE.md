# AI Behavior Evaluation Guide

Intent: define the canonical, reusable workflow for adding an observable AI behavior metric and proving that the behavior survives the production and browser paths.

Updated: 2026-09-01

Source baseline commit: `ac77389`

Use this guide for every new AI behavior evaluation. The behavior is not complete when a Promptfoo case passes. It is complete only when its claim, cases, assertions, blocking gate, production-path test, browser-consumption test, and preserved evidence agree.

## Required evaluation chain

```text
Behavioral claim
    ↓
AI action contract and generated wording
    ↓
Decision cases, paired cases, and transition sequences
    ↓
Deterministic assertions and LLM rubrics
    ↓
Ecological suite and independently authored holdouts
    ↓
Blocking quality gate, including existing metrics
    ↓
Live production-path test
    ↓
Browser downstream-consumption test
    ↓
Preserved inputs, outputs, settings, scores, and failures
```

Do not skip a layer because another layer passed. Each catches a different class of defect.

## 1. Define an observable behavioral claim

Write one claim before writing cases or changing a prompt. Use this form:

> Given **observable input and prior state**, when **the production AI path runs**, the system chooses **an observable action**, avoids **a prohibited action**, and the downstream product **consumes the action in an observable way**.

Record:

- Behavior name and stable metric ID, using `snake_case`.
- Triggering input and relevant prior state.
- Required action and prohibited action.
- Required state transition, if any.
- User-visible effect.
- Explicit non-goals.
- Safety or product impact if the behavior fails.

Bad claims describe an internal quality: “the AI understands context” or “the response is helpful.” Good claims describe evidence: “after an incorrect answer to a prior tutor question, the AI chooses direct correction rather than another question and gives one safe action.”

Keep one metric tied to one behavioral claim. Split claims that can fail independently.

## 2. Separate the AI decision from its wording

Treat these as different outputs:

1. **Decision:** what the system chose to do.
2. **Wording:** how generated text expresses that decision.

For new structured behaviors, define an action contract before authoring prose rubrics. A minimal contract should contain only fields the product uses, for example:

```json
{
  "action": "<allowed enum value>",
  "reason_code": "<stable enum value>",
  "message": "<generated user-facing text>"
}
```

Specify required fields, enum values, nullability, invalid-output handling, and which product component consumes each field. Do not add fields only to make the evaluation easier.

If the production path returns text only, still score the chosen semantic action separately from writing quality. Use one narrowly scoped decision rubric and separate wording rubrics. Do not use a keyword match as a substitute for the missing action contract.

### Guard Mode contract

Guard Mode uses the product action contract below on every generated turn:

```json
{
  "mode": "tutoring | guard",
  "mode_reason": "brief evidence from the conversation",
  "suggested_response": "the tutor wording to review"
}
```

`mode` is semantic and independent from `suggested_response`. `guard` requires deliberate continuation after correction, system-playing, knowingly ignoring a required safe action, evasion, or refusal to learn. Genuine confusion, improving mistakes, clarification seeking, engaged frustration, and partial progress remain `tutoring`. Four violations is an equal-count evaluation contrast, never a production threshold. Guard persists after a dodge or superficial acknowledgement and exits only after meaningful semantic correction or a correct safe action. The production parser rejects malformed JSON, missing fields, empty fields, and invalid modes; it never silently defaults to tutoring.

The decision must be evaluated before the wording. Invalid structure or a wrong action cannot pass because the prose sounds good.

## 3. Build the behavior case matrix

The frozen Guard Mode matrix is `cases/guard-mode.yaml`. It includes deliberate activation, genuine-learning false positives, Guard persistence, Guard exit, and the equal-count contrast pair. Its required metrics are `structured_output`, `mode_selection`, `mode_reason_grounding`, `guard_response_quality`, and `guard_tone_safety`.

Every behavior suite must contain all five case roles below.

| Case role | Purpose | Required evidence |
| --- | --- | --- |
| Positive | The behavior should activate. | Expected action and visible result. |
| Negative | Similar input must not activate it. | Allowed alternative action and prohibited false positive. |
| Boundary | Exercise ambiguity, empty values, limits, and threshold-adjacent inputs. | Exact expected action at the boundary. |
| Recovery | Begin from an error, bad model output, or earlier wrong state. | Recovery action and valid next state. |
| Regression | Reproduce a previously observed failure. | Failure provenance and assertion that would have caught it. |

For stateful behavior, add transition sequences. A sequence must preserve every turn and assert both the chosen action and the resulting state after each step. Do not flatten a multi-turn decision into unrelated single-turn cases.

Each case needs:

- Stable `case_id`.
- `source_type`: `product_template` or `synthetic_holdout`.
- Case role.
- Full input and prior state.
- Expected action or allowed action set.
- Prohibited action.
- Expected transition and downstream effect, when applicable.
- Applicable metric IDs.
- Short rationale explaining what defect the case detects.

Do not encode the answer in metadata sent to the target model.

## 4. Add semantic discrimination pairs

Create paired cases that fail keyword, phrase, or counter-based implementations while remaining easy for a semantic judge.

Each pair should:

- Keep most wording, length, entities, and keyword counts the same.
- Change one meaning-bearing fact.
- Require different decisions because of that fact.
- Declare a shared `pair_id` and the changed semantic factor.
- Pass only when both members receive their correct decisions.

Useful pair patterns include:

- Same warning words, but one source is verified and the other is not.
- Same number of prior questions, but only one latest answer remains incorrect.
- Same safety terms, but one user proposes the safe action and the other rejects it.
- Negation or quoted speech that preserves keywords while reversing meaning.
- Same facts in a different order or paraphrase.

Add a pair-level deterministic assertion. Per-case pass rates alone can hide a model or implementation that always chooses the majority action.

## 5. Assign the right assertion type

Use deterministic assertions whenever the expected result can be computed without interpreting natural-language meaning.

Deterministic assertions should cover:

- Output parses and matches the action schema.
- Required fields exist and enums are valid.
- The expected action, state transition, or invariant is exact.
- Prohibited actions are absent.
- Length, count, ordering, and formatting limits.
- Both members of a semantic pair receive different, correct decisions.
- Missing results and evaluation errors fail closed.

Use an LLM rubric only for semantic properties that a fixed program cannot reliably judge, such as:

- Whether the selected action is supported by free-text context when no structured source of truth exists.
- Whether an explanation is factually grounded in the supplied input.
- Whether wording clearly communicates the selected action.
- Tone, reading level, relevance, or pedagogical quality.

Every LLM rubric must define:

- One metric only.
- Observable pass and fail conditions.
- Which input fields the judge may use.
- How to treat missing, contradictory, or irrelevant output.
- Positive, negative, and boundary examples.
- A strict machine-readable result format.
- The judge model and settings.

Do not let an LLM judge override a failed schema or exact-action assertion. Do not use regular expressions, keyword lists, or sentence counters to infer semantic correctness.

## 6. Add ecological product cases

Ecological cases must come from real product data or a version-controlled product fixture that the product actually consumes.

For each ecological case:

1. Identify the source record, template, or captured production-shaped fixture.
2. Preserve the fields that influence the AI call, including prior state and conversation history.
3. Record the source identifier and source revision or export time.
4. Redact secrets and personal information without changing the tested meaning.
5. Export through a deterministic script when the product source is generated; do not maintain a second hand-edited copy.
6. Label the case `source_type: product_template`.

A derived variant may change only the field named by the case rationale. Record the source case and the changed field. If several unrelated fields change, it is a synthetic case, not an ecological derivative.

Ecological data proves product relevance. It is not a holdout and must not be presented as evidence of generalization.

## 7. Independently author synthetic holdouts

Holdouts test transfer beyond the examples used to design the prompt and rubric.

- A person or agent that did not author the target prompt should write them.
- Freeze the behavioral claim and rubric before revealing holdouts to the prompt author.
- Use different names, entities, phrasing, ordering, and surface cues from ecological and prompt examples.
- Cover the same behavioral claim without copying an ecological dialogue.
- Include positive, negative, boundary, recovery, and semantic-pair coverage where relevant.
- Label every case `source_type: synthetic_holdout`.
- Keep holdout failures visible; do not silently move a failing holdout into the development set.

If a holdout is used to tune the prompt, it is no longer a holdout. Move it to the regression set and author a replacement independently.

## 8. Add the metric to the blocking quality gate

The current blocking gate is `tutor-system/scripts/check-promptfoo-quality-gate.js`. Adding rubric files or case assertions without updating this script does not create a release gate.

For every new metric:

1. Add its stable ID to the gate's metric list.
2. Aggregate it from Promptfoo component results.
3. Require at least one result; zero coverage must fail.
4. Gate `product_template` and `synthetic_holdout` independently.
5. Add any behavior-specific partitions, such as state, action, or case role, that must not be hidden by an aggregate.
6. Add gate tests for pass, below-threshold failure, missing metric, missing suite, evaluation error, and required partitions.
7. Keep the gate command blocking: a failed metric must return a nonzero exit code.

Do not average a weak metric into a stronger overall score. Do not allow one suite to compensate for another.

## 9. Add a live production-path test

The live test must exercise the production request path, not a copied prompt or a test-only API wrapper. The current tutor example is `tutor-system/src/__tests__/tutor_behavior_e2e.test.ts`.

The test must use:

- The production prompt or request builder.
- The production model client.
- The production action parser and validation path.
- Production model settings, except an explicitly documented test limit.
- At least one positive, negative, boundary, and recovery case appropriate to the behavior.

Assert the structured action first, then any deterministic wording requirements. Preserve the exact request, response, parsed action, model settings, and assertion results. A skipped live test is not release evidence.

## 10. Add a browser downstream-consumption test

The browser test proves that the application consumes the AI result correctly. It is not another API smoke test. The current tutor example is `tutor-system/scripts/browser-demo-tutor-behavior.js`.

Starting from the real user workflow, prove:

- The user action reaches the production AI path.
- The returned action is parsed and stored or dispatched correctly.
- The correct component consumes the action.
- The visible UI or application state changes as claimed.
- A prohibited downstream effect does not occur.
- Recovery behavior is visible after invalid output or a failed request, when applicable.

Capture the browser inputs, resulting UI state, screenshots for failures, console or network errors, and the linked AI run ID. A test that only checks that generated text appears does not prove decision consumption.

## 11. Preserve complete evaluation evidence

Store each run under an immutable run directory such as:

```text
evals/promptfoo/results/<model>/<run-id>/
```

The run must preserve:

- Complete target-model inputs, including system prompt, user input, history, and prior state.
- Raw target-model output before cleanup or parsing.
- Parsed action and final displayed wording.
- Model, provider endpoint, temperature, token limit, seed when supported, and provider-specific settings.
- Prompt filename, version or hash, and full prompt content or an immutable reference.
- Case and rubric versions or hashes.
- Judge model, judge settings, raw judge output, parsed score, and reason.
- Deterministic assertion results.
- Per-case and aggregate scores.
- Quality-gate threshold and verdict.
- Evaluation, API, parsing, and judge errors.
- Failure evidence, including browser screenshots and logs when applicable.
- Git revision, worktree status, commands, exit codes, start/end timestamps, and token usage.

Preserve failures with the same fidelity as passes. Do not overwrite the immutable run when updating `results/latest.json` or `results/latest.html`. Remove credentials and personal information, but do not normalize away inputs or outputs that affected the verdict.

## 12. Define merge and release thresholds

Write thresholds before running the holdouts. Unless the behavior requires stricter safety treatment, use these project defaults:

| Gate | Merge threshold | Release threshold |
| --- | --- | --- |
| Schema, enum, and exact transition assertions | 100% | 100% |
| Semantic discrimination pairs | 100% of pairs pass both members | 100% of pairs pass both members |
| New LLM-rubric metric | At least 80% overall and at least 80% in each source suite | Same, on a preserved release-candidate run |
| Safety-critical cases | 100%; no critical false negative or prohibited action | 100% |
| Evaluation, parsing, API, and judge errors | 0 | 0 |
| Live production-path cases | May be deferred only when the PR is not release-bound and the deferral is explicit | 100% of required cases pass |
| Browser downstream-consumption cases | May be deferred only when the PR is not release-bound and the deferral is explicit | 100% of required cases pass |
| Existing blocking AI metrics | All current gates pass | All current gates pass |

Raise thresholds when the cost of a wrong action is high. Do not lower a threshold after seeing results without documenting a changed requirement and reauthoring the evaluation contract.

The release verdict must name the exact preserved Promptfoo run, live run, and browser run used as evidence.

## 13. Require existing AI behavior metrics to pass

Run the complete blocking suite after adding the new metric. A new behavior cannot ship by trading away an existing behavior.

The gate must:

- Evaluate the active production prompt and configuration.
- Re-run every existing blocking metric.
- Apply existing suite and state partitions.
- Reject missing results as failures.
- Report old-metric regressions separately from failures of the new metric.
- Require explicit product approval for any intentional behavior-contract change; a prompt edit alone cannot redefine an existing metric.

When a legitimate requirement changes, update the behavioral claim, cases, rubric, threshold rationale, and version metadata together. Preserve the last comparable run.

## Required authoring order

Use this order so the implementation cannot define its own test after the fact:

1. Write and review the behavioral claim.
2. Define the action contract and downstream consumer.
3. Freeze merge and release thresholds.
4. Author the five case roles and transition sequences.
5. Add semantic discrimination pairs.
6. Assign deterministic assertions and LLM rubrics.
7. Export ecological product cases.
8. Independently author and quarantine synthetic holdouts.
9. Add the metric and failure modes to the blocking quality gate.
10. Implement or change the AI behavior.
11. Run the development suite, then reveal and run holdouts.
12. Run the complete blocking suite, live production-path test, and browser-consumption test.
13. Preserve and review all evidence before merge or release.

## Definition of done

A new AI behavior evaluation is complete only when all items are true:

- [ ] The behavioral claim is observable and has explicit non-goals.
- [ ] Decision correctness is separated from generated wording.
- [ ] Positive, negative, boundary, recovery, and regression cases exist.
- [ ] Semantic discrimination pairs defeat keyword and counter matching.
- [ ] Deterministic and LLM-judged assertions have clear ownership.
- [ ] Ecological cases have real product provenance.
- [ ] Synthetic holdouts were independently authored and remain labeled.
- [ ] The blocking quality gate includes the metric and fails on missing coverage.
- [ ] A live test exercises the production builder, client, and parser.
- [ ] A browser test proves downstream consumption.
- [ ] Complete inputs, raw outputs, settings, versions, scores, and failures are preserved.
- [ ] Merge and release thresholds were fixed before holdout results were known.
- [ ] Every existing blocking AI behavior metric still passes.
