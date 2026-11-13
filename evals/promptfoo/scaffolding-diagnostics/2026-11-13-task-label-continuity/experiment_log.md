# Intent

Record the controlled comparison, evidence and limitations needed to assess whether task labels and explicit sequencing keep the tutor on an unfinished learning point.

# Experiment: Retained-heading task labels and current-point completion

## Metadata

- Log status: running; candidate generation completed with retained failures; corrected-reference calibration reconciled; V11 candidate grading pending
- Created: 2026-11-13T09:55:06Z
- Updated: 2026-11-13T11:03:55Z
- Author or agent: `/root/task_label_execution`; log maintained by `/root/task_label_execution/experiment_log` using experiment-log-writer 1.1
- Repository: PhishingTrainingProgram
- Initial source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50`
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Results address: `evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/raw/` (target/execution evidence and calibration summaries; final compact index pending)

## Research Questions

### RQ1: Do Observation task/Behavior task labels reduce progression past unfinished learning points, and does explicit per-point sequencing add benefit?

- Origin: Derived from [the prior target-continuity experiment](../2026-11-13-deepseek-target-continuity/experiment_log.md).
- Prior result motivating this question: the room replay found no clear abandonment in 12 calls but one overlapping-target drift and premature action disclosure. The prior broader output audit found movie target switches that the semantic judge falsely passed.
- Answer criterion: evaluate `recognition_before_action`, `responsive_progression` and `component_disclosure` separately with calibrated semantic rubrics. Ordinary metrics require at least 80% in applicable declared partitions and non-regression; all declared completion-pair members and required validity/coverage checks must pass. This is focused development evidence, not broad release acceptance.

### RQ2: Do generic covered/progress rules conflict with the explicit task sequence?

- Origin: Derived from this log's reference and development observations, especially Result 5's premature point transitions; [this experiment log](experiment_log.md).
- Prior result motivating this question: explicit component instructions coexist with generic clauses that progress after a correct contribution and avoid revisiting an answered point. The candidate recipe hypothesizes that this distinction between task completion and point completion is underspecified.
- Answer criterion: compare the completion-cleanup candidate with the preserved sequence arm on the same focused cases and rubric protocol; report switching, ordering, disclosure, regressions and invalid/missing evidence separately.

## Hypotheses

### H3 (addresses RQ2): Distinguishing task completion from point completion reduces premature switching and repairs inherited premature transitions.

- Expected observation: the cleanup candidate improves progression relative to sequence, while retaining ordering/disclosure performance and correctly repairing the original room's unsupported observation completion.
- Rejection observation: no improvement, new regressions, or continued uncorrected early transitions; incomplete grading leaves the claim inconclusive.
- Status: development hypothesis, frozen in `candidate-completion-cleanup.json` and V12 before its generation; added to this log after generation. It responds to observed development failures and is not an independent holdout hypothesis.

### H1 (addresses RQ1): Task labels alone improve current-point progression relative to the frozen current branch prompt.

- Expected observation: a higher `responsive_progression` pass count with no decrease in ordering or disclosure on matched fixed cases and complete calibrated judgments.
- Rejection observation: no progression improvement, material regression or an unevaluable comparison. Unevaluable evidence leaves the hypothesis inconclusive rather than demonstrating its falsity.
- Status: preregistered

### H2 (addresses RQ1): Explicit per-point completion instruction adds benefit over task labels alone.

- Expected observation: higher progression and completion-pair success with no ordering or disclosure regression.
- Rejection observation: no incremental improvement, regressions or an unevaluable comparison. Unevaluable evidence leaves the hypothesis inconclusive rather than demonstrating its falsity.
- Status: preregistered

## Experiment Design

- Independent factor changed: current branch baseline versus task labels only versus labels plus explicit sequence. Original headings and task payloads are retained. The historical unchanged production prompt is a separate reference covering 22 inherited fixed cases.
- Factors held constant: Qwen3.8-flash for target and judge at the configured DashScope endpoint; target temperature 0.3 and 600-token limit; judge temperature 0 and 2,600-token limit; `enable_thinking:false`; three unseeded target repetitions; identical fixed-case inputs and one single-metric judge protocol. The room system matches reconstruction from its saved configuration and statuses.
- Data or inputs: `raw/frozen.json`, fingerprint `46d71c2b40b09f51ef793f24f635406250e8ea2287c0f7e861dfd150b7884e23`. The manifest contains 25 fixed cases: 22 inherited, the room replay and a controlled unfinished/completed pair. Two four-turn trajectories bring each main arm to 99 planned target generations. The production reference adds 66, for 363 total targets. There are 36 calibration checks. All 27 prior fixed cases are audited; five protection/contextual-protection cases are excluded from this focused run.
- Evaluation method: one rubric per judge call; exclude the private tutor reason and retain the full history and response. Use prior annotated calibration plus movie-switching and completion boundaries. Complete independent preparation and exact-candidate refinement review before execution.
- Stopping rule: 30 minutes of active API execution and at most eight concurrent calls. Resume only identical saved inputs. Allow two transport/format attempts for invalid or error replies; never resample valid behavioral failures.
- Known confounders: exposed development cases; no unseen holdouts; controlled trajectory histories diverge after generated tutor replies; frozen analyzer checklist; one real-room scenario; four pre-existing dirty prompt files in the current baseline; production reference limited to inherited fixed cases; AI-authored calibration annotations pending independent audit.
- Environment: Node.js with repository dependencies; endpoint and credentials from `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env`. The model is explicitly authorized as Qwen3.8-flash. Credentials are excluded from artifacts. Runtime version is Unknown until execution metadata records it.
- Observability: print calibration agreement, completed/expected target and judgment counts, per-arm rubric counts and representative failures while the experiment runs.

## Execution Commands

### Command 1: Calibrate single-metric Qwen judge

- Status: Planned
- Timestamp: Not executed
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and the main-checkout `tutor-system/.env` described above
- Exit status: Not executed
- Output or log: Not executed; planned raw evidence under this experiment's `raw/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/runner.cjs calibrate --num-workers 8
```

### Command 2: Generate and grade unchanged references

- Status: Planned
- Timestamp: Not executed
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and the main-checkout `tutor-system/.env` described above
- Exit status: Not executed
- Output or log: Not executed; planned raw evidence under this experiment's `raw/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/runner.cjs run references --num-workers 8
```

### Command 3: Generate and grade the two candidates

- Status: Planned
- Timestamp: Not executed
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and the main-checkout `tutor-system/.env` described above
- Exit status: Not executed
- Output or log: Not executed; planned raw evidence under this experiment's `raw/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/runner.cjs run candidates --num-workers 8
```

## Results

### Result 1: Initial single-metric judge calibration

- Informs: RQ1, H1 and H2 measurement readiness; the target hypotheses remain untested.
- Run status: calibration completed and failed its agreement gate; zero API/parser errors.
- Input: `raw/frozen-v2.json`, fingerprint `df4e7dfc6e037a90f24f79b59a554a58b674bea5cd8eebd7e5520a6885735a6f`.
- Configuration: 32 single-metric checks, eight workers, Qwen3.8-flash at DashScope, judge temperature 0, 2,600-token limit and `enable_thinking:false`.
- Output: `raw/calibration-summary-1794563823157.json`; full calibration request/output pairs in `raw/calibration/`.
- Metric definition and value: exact agreement of the semantic judge's Boolean verdict with independently reviewed reference labels: **28/32 overall**; ordering **9/10**, disclosure **10/12**, progression **9/10**; **0 errors**.
- Observation: the judge allowed action disclosure after recognition-only confusion, treated recognition disclosure as an ordering failure, forgot an earlier action attempt, and passed a movie destination-to-timing switch. Failed checks: `disclosure_action_leak__component_disclosure`, `supplied_conclusion_question__recognition_before_action`, `earlier_action_attempt_retained__component_disclosure`, and `movie_switch_to_time`.
- Interpretation: isolating each metric into its own call was insufficient. Explicit history and point/component attribution need investigation before the comparison can support a target-behavior conclusion.
- Representative pair: `raw/calibration/movie_switch_to_time.json` preserves the full input and judge output; expected `false`, actual `true`.
- Evidence path: [calibration summary](raw/calibration-summary-1794563823157.json), [execution metadata](raw/execution/1794563806384/completed.json), and the calibration records above. These raw artifacts remain locally retained beneath the experiment directory; external archival durability is not established.

### Result 2: V3 judge evidence serialization mismatch

- Informs: RQ1, H1 and H2 measurement readiness; no target calls occurred.
- Run status: 32 calibration checks completed; 31 schema errors, one usable agreement and zero transport errors.
- Input: `raw/frozen-v3.json`, fingerprint `84f81f56545c148239f8b8dfc4732f7e6876b2f4a7db583319159120e7291ed7`.
- Configuration: Node.js 22.12.0, main-checkout `tutor-system/.env`, Qwen3.8-flash judge at temperature 0, 2,600-token cap, thinking disabled, eight workers; the 32 reference labels remain unchanged.
- Output: `raw/calibration-summary-1794564061882.json` and full retained records under `raw/calibration-v3/`.
- Metric definition and value: valid exact agreement with frozen labels: **1/32 usable agreement**, **31/32 errors**. This is not a semantic accuracy estimate.
- Observation: across 63 attempts, `current_point` and `learner_evidence` were strings; `reply_components` appeared as 61 arrays, one string and one object. The parser rejected 31 checks because it required this ancillary evidence field to be a string.
- Interpretation: invalid aggregation cannot establish semantic conformance. Root authorized a parser-only V4 correction across all 32 checks, selecting the first usable saved attempt without additional model calls. Its result remains pending at this entry.
- Representative pair: `raw/calibration-v3/disclosure_action_confusion__component_disclosure.json` preserves the full input and judge output.
- Evidence path: [V3 summary](raw/calibration-summary-1794564061882.json), [execution metadata](raw/execution/1794564013727/completed.json) and the retained calibration records. The prior results address remains [the initial summary](raw/calibration-summary-1794563823157.json).

### Result 3: V4 zero-call reparse

- Informs: RQ1, H1 and H2 measurement readiness; no target calls occurred.
- Run status: completed local reparse with zero additional model calls; all 32 checks used their first saved attempt; zero errors.
- Input: `raw/frozen-v4.json`, fingerprint `a317e127b9f5282311568637a29d12ef5e686049a101a0d241e09aa608f53766`; unchanged V3 judge requests and saved responses.
- Configuration: the V4 parser accepts nonempty string, object or list representations of ancillary evidence while retaining their original representation. It takes the first usable attempt regardless of verdict.
- Output: `raw/calibration-summary-1794564164942.json` and `raw/calibration-v4/`.
- Metric definition and value: exact agreement with unchanged calibration labels: **29/32**, with ordering **7/10**, disclosure **12/12** and progression **10/10**; **0 errors**.
- Observation: two recognition-only questions falsely failed ordering, and a trailing unattempted action falsely passed ordering.
- Interpretation: the evidence-ledger protocol passed disclosure and progression calibration after the schema correction, but ordering judgment remains unreliable. Calibration does not establish target performance.
- Representative pair: `raw/calibration-v4/unattempted_action_after_recognition_failure__recognition_before_action.json`.
- Evidence path: [V4 summary](raw/calibration-summary-1794564164942.json). Earlier summaries remain at [V3](raw/calibration-summary-1794564061882.json) and [V2](raw/calibration-summary-1794563823157.json).

### Result 4: V5 thinking-judge calibration

- Informs: RQ1, H1 and H2 measurement readiness; target hypotheses remain untested.
- Run status: all 32 calibration checks completed; zero errors.
- Input: `raw/frozen-v5.json`, fingerprint `5229076c8249ad055f71e430657059cbb9fb0c2eba9b02066f238bb42e56964f`.
- Configuration: Qwen3.8-flash judge, temperature 0, 8,000-token cap and `enable_thinking:true`; unchanged calibration labels and target candidates.
- Output: `raw/calibration-summary-1794564485235.json` and full request/response records in `raw/calibration-v5/`.
- Metric definition and value: exact reference-label agreement **32/32**: ordering **10/10**, disclosure **12/12**, progression **10/10**; **0 errors**.
- Observation: all previously observed ordering mismatches are resolved on these calibration examples.
- Interpretation: the thinking judge passes this calibration. That result does not prove reliability on unseen grades or establish any target improvement.
- Representative pair: `raw/calibration-v5/unattempted_action_after_recognition_failure__recognition_before_action.json`.
- Evidence path: [V5 summary](raw/calibration-summary-1794564485235.json), [execution metadata](raw/execution/1794564283501/completed.json). The previous canonical results address remains [V4 summary](raw/calibration-summary-1794564164942.json).

### Result 5: V8 reference stage and measurement defects

- Informs: RQ1 and baseline readiness for H1/H2. Candidate targets have not been compared at this point.
- Run status: reference process completed with exit 0, but **87/87 targets saved, 84 valid and three target-format failures**. Process completion does not establish validity or behavioral acceptance.
- Input: `raw/frozen-v8.json`, fingerprint `2890376a62dd2b465b672fc234055cd9eaddad53057af202f966d0c91e5ac4c5`.
- Configuration: 27 historical production-reference targets and 60 current-branch targets; Qwen3.8-flash tutor, temperature 0.3, 600-token cap, thinking disabled; V8 per-metric judge settings; eight workers.
- Output: `raw/analysis-1794565587115.json`, preserved target records under `raw/targets/`, and mixed-protocol judgments under `raw/judgments/`.
- Metric definition and value: target-generation validity **84/87**. The three invalid records are `component_5_action_attempt__current__r1`, `__r2` and `__r3`; they remain retained without target resampling. Two ordering judgments exhausted 90-second retries: `component_5_later_contradiction__current__r1` and `journey_3__current__r3__t3`.
- Observation: independent review confirmed progression false passes for movie/address responses that switch away from an observation-complete point before its behavior task, over-crediting of the original room's “Yes”/“not safe” evidence, and a disclosure false failure for an open behavior question.
- Interpretation: retain all V8 mixed-protocol scores as superseded measurement evidence, not final comparison scores. A calibration pass did not prevent these case-specific grader defects. Invalid target outputs and unresolved judge errors remain visible independently of semantic scores.
- Representative input/output evidence: `raw/targets/component_5_action_attempt__current__r1.json` preserves an invalid target attempt; the target and judgment records referenced by `raw/analysis-1794565587115.json` preserve the semantic review cases.
- Evidence path: [reference analysis](raw/analysis-1794565587115.json), [execution metadata](raw/execution/1794564762126/completed.json). The prior canonical address remains [V8 calibration readiness](raw/calibration-summary-1794564762074.json).

### Result 6: V9 observed-boundary calibration

- Informs: RQ1 and H1/H2 measurement readiness.
- Run status: seven boundary checks completed, **6/7 agreement and zero errors** under the original labels.
- Input: `raw/frozen-v9.json`, fingerprint `37ba6038c6ebefb8cecb61eae7522429169c940b245b945358d34fedb377a8fe`.
- Configuration: all three judge metrics use Qwen3.8-flash with thinking enabled, 8,000-token cap and 180-second timeout; 16 workers.
- Output: `raw/boundary-summary-1794565899045.json` and `raw/calibration-v9/`.
- Metric definition and value: original-label agreement **6/7**. The sole disagreement is `observed_behavior_question_not_answer_disclosure`, expected `true`, observed `false`.
- Observation: the disputed response asks, “How could you tell your friends where and when to meet without strangers seeing it?” The inventory's behavior answer explicitly includes keeping exact plans private; the original annotation treated a named communication channel as the only central answer.
- Interpretation: independent adjudication later corrected that single reference label to `false`; the original 6/7 result remains unchanged. The case does not establish a general rule that any action question is disclosure. See the dated correction below.
- Representative pair: `raw/calibration-v9/observed_behavior_question_not_answer_disclosure.json`.
- Evidence path: [original boundary summary](raw/boundary-summary-1794565899045.json), [adjudication](disclosure-boundary-adjudication.json), [versioned labels](new-boundary-calibration-labels-v2.json).

### Result 7: V10 candidate generation without grading wait

- Informs: H1 and H2 generation coverage; behavioral scores remain pending.
- Run status: process completed; **119/120 target records saved, 118 valid responses**. The sequence arm has **60/60 valid**; labels has **58/60 valid**, one provider failure and one blocked downstream turn.
- Input: `raw/frozen-v10.json`, fingerprint `1952e7f9bd291390852808e355cca15d4d873ebb855cba9a67fde6e511c9568d`; candidate case inputs and target request settings are byte-equal to V9.
- Configuration: generation-only Qwen3.8-flash, thinking disabled, 600-token cap, 16 workers. The user requested generation without waiting for judging; the later 32-worker steering arrived after this command started.
- Output: candidate records in `raw/targets/` and `raw/execution/1794566024936/`.
- Metric definition and value: generation validity **118/120**, saved-record coverage **119/120**. `journey_3__labels__r2__t3` returned HTTP 400 `data_inspection_failed`; turn 4 is `blocked_by` that failed predecessor and was not generated.
- Observation: candidate generation is available for scoring, with the provider failure and dependent gap preserved rather than resampled or removed from coverage.
- Interpretation: generation completion does not establish behavioral improvement. The blocked dependent turn remains in the expected denominator.
- Representative evidence: `raw/targets/journey_3__labels__r2__t3.json` and the actual preceding trajectory inputs/outputs; [execution metadata](raw/execution/1794566024936/completed.json).

### Result 8: V11 calibration reference reconciliation

- Informs: RQ1 and H1/H2 measurement readiness.
- Run status: completed local provenance/reconciliation check; zero new model calls.
- Input: `raw/frozen-v11.json`, fingerprint `077b2d5b6920a0c5704db8e184946623ca653b857ce65ccb208ebb3907bd78fd`; all 32 V5 thinking checks plus all seven V9 thinking boundary checks.
- Configuration: same retained judge requests and settings, with exactly one independently adjudicated expected label changed by `new-boundary-calibration-labels-v2.json`. V11 also raises the worker limit to 32 without changing target/judge request content.
- Output: `raw/calibration-summary-1794566110565.json`.
- Metric definition and value: agreement under corrected reference version **39/39**, **0 errors**, **0 new calls**. The original boundary run remains 6/7 under its original labels.
- Observation: full-set reuse and exact provenance were verified; no favorable individual result selection was used.
- Interpretation: measurement is ready under this versioned reference, subject to output audit. This reconciliation is not a newly executed 39-check calibration and does not erase the initial mismatch.
- Evidence path: [V11 reconciliation](raw/calibration-summary-1794566110565.json) and the adjudication/label-version artifacts in Result 6.

### Result 9: V12 completion-cleanup candidate generation

- Informs: RQ2 and H3; grading is pending.
- Run status: **60/60 valid target generations**, command exit 0.
- Input: `raw/frozen-v12.json`, fingerprint `8900d7eb5dba07a2ff6950263c017582ad49fc46420d305b7f042e8785225e53`; cleanup shell hash `48db842fbb1ee8fe77f1ab33807e8cd333263e93d975792c84165215ae5a1fe8`.
- Configuration: same tutor model/settings, cases, task headings/content and sequence instruction; four generic completion/progression clauses replaced and one learner-evidence repair clause added. Recipe SHA-256: `1ade0c98f9ba143a24b84c47664bf0ff4c1996855e4ea95f19c2121b33f75d93`.
- Output: completion-cleanup records under `raw/targets/`, with full inputs and outputs, and `raw/execution/1794566492601/`.
- Metric definition and value: target validity **60/60**. Semantic scores are not yet available.
- Observation: the executor's preliminary reading found movie recognition-complete cases continuing to the same-point behavior in 3/3 repetitions, but original-room cases still beginning behavior before demonstrated observation meaning in 3/3. One address-trajectory turn 2 supplied the action answer directly. These are preliminary qualitative observations, not calibrated pass counts.
- Interpretation: the changes may help continuity while leaving inherited observation gaps and disclosure problems unresolved. Final assessment requires the completed common-judge comparison and independent review.
- Representative evidence: the corresponding movie recognition, `room_unanswered_original` and `journey_3` completion-cleanup records under `raw/targets/` retain each complete input/output pair.
- Evidence path: [candidate recipe](candidate-completion-cleanup.json), V12 snapshot and generation execution metadata.

## Iterations

### Iteration 1: 2026-11-13T09:57:03.180Z

- Hypothesis: H1; measurement readiness also affects H2.
- Source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50` with the four pre-existing runtime prompt edits documented in the preparation snapshot.
- Files or configs changed: `runner.cjs` introduces the single-metric judge protocol, 32 calibration checks and frozen comparison harness; `raw/frozen-v2.json` pins audited preparation. No target generations were produced in this iteration.
- Commands: Command 7 executed the revised planned Command 4.
- Results: Result 1.
- Decision: **revise**. Calibration agreement of 28/32 demonstrates unresolved grader defects. Revise evidence tracking in the judge protocol, preserving target prompts and reference labels. H1 and H2 remain untested.
- Revision note: measurement revision pending; no changed result is inferred.

### Command 7: Execute initial Qwen judge calibration

- Status: Executed
- Started: 2026-11-13T09:56:46.384Z
- Completed: 2026-11-13T09:57:03.180Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js 22.12.0; main checkout `tutor-system/.env`; Qwen3.8-flash judge, temperature 0, 2,600 tokens, thinking disabled
- Exit status: 1
- Output or log: `raw/execution/1794563806384/`, including `completed.json` and console streams

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs calibrate --num-workers 8
```

### Iteration 2: 2026-11-13T10:01:01.905Z

- Hypothesis: H1; measurement readiness also affects H2.
- Source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50` with the pre-existing dirty runtime files identified in preparation.
- Files or configs changed: `runner.cjs` versions the judge protocol with a current-point/evidence/component ledger; target prompts and all 32 reference labels are unchanged. `harness.test.cjs` adds schema validation checks.
- Commands: Command 8.
- Results: Result 2.
- Decision: **revise**. V3 supplied structured clause lists while the parser required strings. Preserve all attempts and correct the ancillary evidence schema before drawing semantic conclusions.
- Revision note: parser-only V4 reparse authorized; target hypotheses remain untested.

### Command 8: Recalibrate evidence-ledger judge

- Status: Executed
- Started: 2026-11-13T10:00:13.728Z
- Completed: 2026-11-13T10:01:01.905Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js 22.12.0; main checkout `tutor-system/.env`; Qwen3.8-flash judge, temperature 0, 2,600 tokens, thinking disabled
- Exit status: 1
- Output or log: `raw/execution/1794564013727/`, including `completed.json` and console streams

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs calibrate --num-workers 8
```

### Iteration 3: 2026-11-13T10:02:44.942Z

- Hypothesis: H1; measurement readiness also affects H2.
- Source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50`.
- Files or configs changed: `runner.cjs` accepts nonempty strings, objects or lists for auxiliary evidence without altering their representation. `reparse-calibration.cjs` reparses all 32 unchanged V3 judge requests and takes the first usable saved attempt regardless of verdict.
- Commands: Command 9.
- Results: Result 3.
- Decision: **revise**. The schema correction produced 29/32 agreement, with three ordering defects remaining. No target outputs exist at this stage.
- Revision note: V5 judge-setting revision planned below; target settings and candidates remain unchanged.

### Command 9: Reparse all saved V3 checks with corrected ancillary schema

- Status: Executed
- Started: 2026-11-13T10:02:44.895Z
- Completed: 2026-11-13T10:02:44.942Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js 22.12.0; local saved artifacts only
- Exit status: 1
- Output or log: `raw/calibration-summary-1794564164942.json`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/reparse-calibration.cjs
```

### Iteration 4: 2026-11-13T10:08:05.249Z

- Hypothesis: H1; this iteration addresses measurement readiness for both H1 and H2.
- Source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50`.
- Files or configs changed: `runner.cjs` enables thinking with an 8,000-token cap for the V5 judge only; `provider-settings.md` records provider-source verification. Target settings and prompts remain unchanged.
- Commands: Command 10.
- Results: Result 4.
- Decision: **support — measurement only**. All 32 calibration labels agree; target H1/H2 remain untested.
- Revision note: observed evaluator latency motivates the pre-target V6 scope/settings plan below, not a change to the target hypotheses.

### Command 10: Execute V5 thinking-judge calibration

- Status: Executed
- Started: 2026-11-13T10:04:43.501Z
- Completed: 2026-11-13T10:08:05.249Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js 22.12.0; main checkout `tutor-system/.env`; Qwen3.8-flash judge, temperature 0, 8,000 tokens, thinking enabled
- Exit status: 0
- Output or log: `raw/execution/1794564283501/`, including `completed.json` and console streams

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs calibrate --num-workers 8
```

### Iteration 5: 2026-11-13T10:26:27.129Z

- Hypothesis: H1; shared reference evidence also supports the eventual H2 comparison.
- Source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50` with pre-existing runtime changes frozen in the snapshot.
- Files or configs changed: V8 execution writes immutable target/judge records and `raw/analysis-1794565587115.json`; no candidate prompt change is reported in this stage.
- Commands: Command 13.
- Results: Result 5.
- Decision: **revise — measurement**. Preserve the generated references and correct the evaluator before comparing candidates. Three target-format failures remain failures; valid unfavorable outputs are not resampled.
- Revision note: V9 readiness plan follows; no V9 execution outcome is claimed here.

### Command 13: Execute V8 reference generation and grading

- Status: Executed; runs planned Command 5
- Started: 2026-11-13T10:12:42.126Z
- Completed: 2026-11-13T10:26:27.129Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and main-checkout `tutor-system/.env`; Qwen target and V8 metric-specific judges
- Exit status: 0; result-level errors are recorded separately in Result 5
- Output or log: `raw/execution/1794564762126/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs run references --num-workers 8
```

### Iteration 6: 2026-11-13T10:31:39.061Z

- Hypothesis: H1; measurement readiness shared with H2.
- Source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50`.
- Files or configs changed: V9 uniform-thinking evaluator and seven observed-boundary examples; target candidates unchanged.
- Commands: Command 14.
- Results: Result 6.
- Decision: **revise — reference adjudication**. Preserve the 6/7 result and independently resolve the disputed privacy-goal disclosure annotation before acceptance scoring.
- Revision note: the single-label correction is separately recorded below.

### Command 14: Execute V9 boundary calibration

- Status: Executed
- Started: 2026-11-13T10:30:08.278Z
- Completed: 2026-11-13T10:31:39.061Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and main-checkout `tutor-system/.env`; uniform-thinking Qwen judge
- Exit status: 1
- Output or log: `raw/execution/1794565808278/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs calibrate-boundaries --num-workers 16
```

### Iteration 7: 2026-11-13T10:34:08.180Z

- Hypothesis: H1 and H2.
- Source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50`.
- Files or configs changed: V10 separates target generation from grading; target requests remain byte-equal to V9. Immutable candidate records were produced.
- Commands: Command 15.
- Results: Result 7.
- Decision: **inconclusive**. Generation produced 118 valid responses from 120 expected, with a provider failure and dependent gap; candidate behavioral judgment is pending.
- Revision note: no target resampling; preserve failures for final coverage.

### Command 15: Generate candidate targets without waiting for judging

- Status: Executed
- Started: 2026-11-13T10:33:44.936Z
- Completed: 2026-11-13T10:34:08.180Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and main-checkout `tutor-system/.env`; non-thinking Qwen3.8-flash tutor
- Exit status: 0; result-level failure and dependent gap remain in Result 7
- Output or log: `raw/execution/1794566024936/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs generate candidates --num-workers 16
```

### Iteration 8: 2026-11-13T10:41:51.658Z

- Hypothesis: H3, addresses RQ2.
- Source commit: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50` with the existing frozen dirty runtime basis.
- Files or configs changed: `candidate-completion-cleanup.json` replaces four exact generic clauses and adds learner-evidence repair; V12 freezes the new candidate. Independent review cleared the recipe and 36 source hashes plus old-arm/settings parity before generation, as reported by the executor.
- Commands: Command 16.
- Results: Result 9.
- Decision: **inconclusive** pending grading. Generation is valid, but the preliminary original-room behavior still shows the earlier gap.
- Revision note: generation ran concurrently with prior grading under the bounded global worker limit; prior candidates/evidence remain preserved.

### Command 16: Generate completion-cleanup candidate

- Status: Executed
- Started: 2026-11-13T10:41:32.601Z
- Completed: 2026-11-13T10:41:51.658Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and main-checkout `tutor-system/.env`; non-thinking Qwen3.8-flash tutor
- Exit status: 0
- Output or log: `raw/execution/1794566492601/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs generate completion_cleanup --num-workers 16
```

## Corrections And Deviations

### Parallel budget accounting clarification — 2026-11-13T10:49:49Z

Root clarified that the 60-active-minute allowance counts the wall-clock **union of overlapping active execution intervals**, consistent with the user's parallel-execution request. It does not sum simultaneous process segments. This corrects the earlier conservative process-sum usage descriptions; it is not a budget extension, and existing guards are unchanged.

At 2026-11-13T10:49:32.969Z, the executor calculated **34.1923667 active minutes** by interval union and **25.8076333 minutes remaining**. The process-segment sum was 44.90405 minutes. Completed intervals use budget `started_at` plus `elapsed_ms`; three ongoing intervals were extended to the observation time by matching incomplete execution wrappers within two seconds. These are interim figures. Final completed/merged intervals and usage remain pending.

Reference grading now runs with 14 active workers alongside at most 12 original-candidate and six cleanup workers, retaining the global 32-call bound. None of these grade-stage outcomes is recorded as complete by this note.

### Parallel development refinement — 2026-11-13T10:42:46Z

Root/user authorized the parallel development refinement. During cleanup generation, 16 generation workers overlapped at most 12 remaining prior-grade workers, for at most 28 active calls. Cleanup grading has now started with `execute.cjs run completion_cleanup --num-workers 20` alongside at most 12 prior-grade workers, preserving the global limit of 32. Its outcome is pending, not completed. The executor recorded 23.85 minutes of the 60-minute active budget used at 10:39:40Z, before these phases; concurrent segments are counted conservatively.

### Disclosure reference correction and V11 execution steering — 2026-11-13T10:36:01Z

Independent auditor `/root/continuity_audit` reconsidered `observed_behavior_question_not_answer_disclosure` against the full target text, and Root approved its expected-label correction from `true` to `false`. The target includes “Keep your exact plans and times private”; the question's “without strangers seeing it” condition supplies that central behavior before a behavior attempt or confusion. Leaving the implementation channel open does not undo that disclosure under the current T01.1 rule. Generic safe-action questions remain distinct. The initial annotation, observed judgment, rationale and counterevidence are preserved in [disclosure-boundary-adjudication.json](disclosure-boundary-adjudication.json); the complete mapping in [new-boundary-calibration-labels-v2.json](new-boundary-calibration-labels-v2.json) changes exactly this label.

V11 applies that mapping and the requested 32-worker limit without target/judge request changes. The executor reports **8/8 harness tests passing**; exact test command/time were not supplied for this entry, so no executed command is invented. Candidate grading using `execute.cjs run candidates --num-workers 32` has started under V11; results remain pending.

### V9 evaluator repair preparation — 2026-11-13T10:30:12Z

Active prepared snapshot: `raw/frozen-v9.json`, fingerprint `37ba6038c6ebefb8cecb61eae7522429169c940b245b945358d34fedb377a8fe`. V9 uses thinking-enabled Qwen with an 8,000-token cap for all three judge metrics, raises only the judge timeout to 180 seconds, and keeps tutor settings, case inputs and candidate arms unchanged. The executor reports Root's revised resource plan of a 60-minute active cap and 16 workers, replacing the earlier agent-selected 30-minute/eight-worker plan after the user permitted judge thinking.

Readiness requires independent V9 review and seven new boundary calibration checks, plus exact-provenance reuse of the original 32 thinking-calibration checks. New judgments will be stored in `raw/judgments-v9/`. Regrade every progression/disclosure result; reuse all successful request-matching ordering judgments, both passes and failures. Repair only invalid/API judge results. Preserve all target generations, including format failures, without resampling.

This entry records preparation and intended evidence reuse, not completed V9 calls or a repaired verdict. V8 mixed scores remain available as historical measurement evidence.

### Clarified user runtime decision — 2026-11-13T10:12:38Z

The user clarified: “oh , judge can be in thinking mode”. This supersedes the preceding blanket non-thinking instruction. The tutor remains non-thinking. The selected evaluator returns to the calibrated per-metric scheme: ordering uses `enable_thinking:true`, an 8,000-token cap and V5 calibration; disclosure and progression use `enable_thinking:false`, a 2,600-token cap and V4 calibration. The target uses `enable_thinking:false` and a 600-token cap. The 207-target scope is unchanged.

The executor reports that the intervening V7 non-thinking-only proposal was frozen but **unrun**, with no model calls during either steering decision. Active preparation is `raw/frozen-v8.json`, fingerprint `2890376a62dd2b465b672fc234055cd9eaddad53057af202f966d0c91e5ac4c5`. V8 restores V6's effective protocol, routing, candidates and data; it does not retain the proposed shorter ordering prompt. Execution is pending independent V8 clearance and the calibration provenance-selection step. Prior plans and completed calibration evidence remain preserved.

### User runtime decision — 2026-11-13T10:10:34Z

The latest user instruction is: “do not use reasoning-enabled Qwen, latency is too high”. This explicitly supersedes the thinking and mixed-evaluator plans for the target-comparison stage. **All future target and judge calls use `enable_thinking:false`.** The completed V5 thinking calibration remains historical evidence; it is not the selected evaluator for future runs.

At this decision, the executor reports no active API process, no generated targets, V6 prepared only and Command 11 (`select-calibration.cjs`) unexecuted. Root is selecting a non-thinking-only correction for ordering measurement. The V6 mixed-evaluator plan below remains visible as superseded preparation, not an executed comparison. No effect on target performance is inferred from this runtime decision.

### V6 pre-target scope and evaluator revision — 2026-11-13T10:09:52Z

The executor measured 24–45-second thinking-judge calls and forecasts roughly 66 minutes for the original 1,089 grades, exceeding the 30-minute active cap. Before any target generation, V6 therefore selects **12 fixed cases and both four-turn trajectories**, with three repetitions: **60 targets per main arm**, plus **27 historical production-reference targets**, for **207 total**. All 25 prepared fixed cases remain in the manifest, with 13 explicitly `not_selected`. The original 363-target manifest remains preserved and unrun. Candidate hashes, semantic rubric text and thresholds are unchanged; the canonical plan records this scope decision.

V6 uses calibrated settings per metric: the 10 ordering checks use V5 thinking judgment, while the 12 disclosure and 10 progression checks use V4 non-thinking judgment. Calibration reuse requires exact retained-request parity and will be recorded by the local provenance-selection command below. The active snapshot is `raw/frozen-v6.json`, fingerprint `ecc7a6ebc1c4bd3f804c1d4d2dfec764faa2085f81574080c473c2636cdcd54c`. This is a pre-target resource/scope decision, not selection based on target scores.

### Command 11: Verify mixed calibration provenance

- Status: Planned
- Timestamp: Not executed
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and saved local calibration artifacts; no new model calls planned
- Exit status: Not executed
- Output or log: Not executed

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/select-calibration.cjs
```

After provenance selection and independent review, the unchanged reference and candidate wrapper commands remain Commands 5 and 6. No target execution is claimed at this entry.

### V5 measurement plan — 2026-11-13T10:04:33Z

The next measurement version changes the **judge only** to `enable_thinking:true` with an 8,000-token cap. Target settings remain `enable_thinking:false` and 600 tokens. The active snapshot is `raw/frozen-v5.json`, fingerprint `5229076c8249ad055f71e430657059cbb9fb0c2eba9b02066f238bb42e56964f`. [provider-settings.md](provider-settings.md) records official provider support and the local token-cap precedent.

After independent audit, rerun all 32 calibration checks using Command 4's exact `execute.cjs calibrate --num-workers 8` command. This is a planned change to evaluator settings, not an executed result or target refinement. It supersedes the original judge thinking/token settings for V5 while preserving prior evidence and reference labels.

### Preparation correction — 2026-11-13T09:56:00Z

The executor reports an independent-auditor correction before model calls: the ambiguous completed-next calibration response now targets an unmet timing observation, and four Nintendo calibration checks with contextual protection were removed from this ordinary-teaching scope. The original v1 preparation remains preserved and unrun. The active input is `raw/frozen-v2.json`, fingerprint `df4e7dfc6e037a90f24f79b59a554a58b674bea5cd8eebd7e5520a6885735a6f`, with **32 calibration checks**. Candidate hashes, 25 fixed cases and 363 planned target generations are unchanged. This supersedes the initial input fingerprint and calibration count above without changing H1 or H2.

The three planned API commands now use `execute.cjs` instead of `runner.cjs`, with identical arguments. The wrapper streams stdout and saves the command, timestamps, exit status and raw execution logs. Commands 1–3 remain the original unexecuted plan; Commands 4–6 below are their revised planned forms. No executed outcome is claimed.

### Command 4: Calibrate with retained execution evidence

- Status: Planned; replaces unexecuted Command 1
- Timestamp: Not executed
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and the main-checkout `tutor-system/.env` described above
- Exit status: Not executed
- Output or log: Not executed; planned wrapper evidence under this experiment's `raw/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs calibrate --num-workers 8
```

### Command 5: Generate and grade references with retained execution evidence

- Status: Planned; replaces unexecuted Command 2
- Timestamp: Not executed
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and the main-checkout `tutor-system/.env` described above
- Exit status: Not executed
- Output or log: Not executed; planned wrapper evidence under this experiment's `raw/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs run references --num-workers 8
```

### Command 6: Generate and grade candidates with retained execution evidence

- Status: Planned; replaces unexecuted Command 3
- Timestamp: Not executed
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and the main-checkout `tutor-system/.env` described above
- Exit status: Not executed
- Output or log: Not executed; planned wrapper evidence under this experiment's `raw/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/execute.cjs run candidates --num-workers 8
```

## Analysis Notes

### Execution and workspace checkpoint — 2026-11-13T11:03:14.804Z

The executor reports that original-candidate and cleanup grading processes closed with exit 0; final result-level reconciliation is still pending. Reference grading is at 77/87. A progression judgment for `journey_5__sequence__r1__t3` timed out after two 180-second transport attempts spanning 2026-11-13T10:49:17.372Z–10:55:19.380Z. Root authorized one bounded identical-request/settings repair round, preserving the original error and writing any repair as an overlay; the repair has not completed at this checkpoint. Exit 0 for the grade processes does not erase this judgment error.

At the checkpoint, active-interval union is **47.8896/60 minutes**, leaving **12.1104 minutes**; process-segment sum is 78.9886 minutes. These remain interim figures while reference grading continues.

Concurrent separate local-trial work changed runtime prompt code and an ecological test. Root's harness rerun then passed 7/8 because `roomCases` checked the live workspace against the frozen source. The executor changed the harness test to inspect the verified immutable V12 completion pair while retaining the preparation-time drift assertion. The subsequent tool result reports **8/8 passing**, duration 354.583458 ms; its exact execution timestamp/raw log was not supplied. `frozen-evidence.cjs` now verifies the frozen fingerprint and runner/provider hashes, and reports later workspace drift explicitly instead of claiming the current filesystem still matches execution.

`preparation-index.json` hashes all 12 preparation versions. Earlier versions remain locally retained and ignored; only V12 preparation is selected for Git tracking. This changes packaging, not the preserved historical inputs or results. Final grading, repair, comparison and evidence-manifest outcomes are pending.

### Durable harness re-verification — 2026-11-13T10:53:41Z

After the cleanup-code extension, the same structural harness command was rerun from 2026-11-13T10:53:27.201Z to 2026-11-13T10:53:27.559Z in the experiment worktree, returning **exit 0, eight passes, zero failures**. [raw/verification-1794567207559.json](raw/verification-1794567207559.json) retains the complete command, timestamps, stdout and stderr. This adds durable timed evidence; the earlier untimed test observation remains historical.

The checks cover exact heading/payload preservation, actual generated trajectory history, malformed/truncated judge results, private-rationale isolation, controlled completion-pair construction, separate tutor/judge thinking settings, the 32-worker boundary and exact request/settings reuse. They validate harness structure, not semantic tutor wording.

The executor also reports `node --check` passing for `summarize-final.cjs`; exact command prefix/time were not supplied, so no independent executed-command claim is added. That helper is outside frozen target inputs and computes final counts, paired changes and interactions without model calls. Grade-stage completion remains pending.

```bash
rtk proxy node --test evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/harness.test.cjs
```

### Harness verification evidence correction — 2026-11-13T10:37:43Z

The executor supplied the exact test command for the previously reported 8/8 result. It ran immediately before V11 preparation/provenance selection in the experiment worktree, returned exit 0, and reported eight tests, eight passes, zero failures, duration 282.270959 ms. The tool transcript is the retained execution evidence; no dedicated raw test log exists. Exact wall-clock execution time is Unknown because it was not recorded; this note's timestamp is not substituted for it. Final compact verification is planned to preserve the observed result.

```bash
rtk proxy node --test evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/harness.test.cjs
```

### V8 calibration provenance verified — 2026-11-13T10:13:19Z

The local provenance-selection check completed with **32/32 agreements and zero errors**, using all disclosure/progression checks from V4 and all ordering checks from V5. It verified parity of the complete retained requests, model, temperature, thinking option and token cap with the selected V8 per-metric evaluator. Active snapshot: `raw/frozen-v8.json`, fingerprint `2890376a62dd2b465b672fc234055cd9eaddad53057af202f966d0c91e5ac4c5`. No new model calls were made by this check.

This establishes calibration provenance readiness for the selected protocol, not target improvement or universal grader accuracy. The executor reports that reference generation is now running; its results remain pending. The prior canonical results address remains [the V5 calibration summary](raw/calibration-summary-1794564485235.json).

### Command 12: Execute mixed calibration provenance verification

- Status: Executed; runs planned Command 11
- Started: 2026-11-13T10:12:42.061Z
- Completed: 2026-11-13T10:12:42.074Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js 22.12.0; local saved evidence only; zero API calls
- Exit status: 0
- Output or log: `raw/calibration-summary-1794564762074.json`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-task-label-continuity/select-calibration.cjs
```

### Measurement correction — 2026-11-13T09:59:25Z

Target: judge protocol and active freeze after Iteration 1. The executor has prepared V3 with explicit `current_point`, `learner_evidence` and `reply_components` fields and separate metric-specific decision steps before the final verdict. The active snapshot is `raw/frozen-v3.json`, fingerprint `84f81f56545c148239f8b8dfc4732f7e6876b2f4a7db583319159120e7291ed7`.

All 32 calibration labels, target cases, target candidate hashes and rubric text remain unchanged. V2 evidence remains retained. The reason for revision is the four independently confirmed evaluator attribution/metric-boundary errors in Result 1; this repairs measurement before comparison and does not tune the target.

Planned next execution, after independent protocol review: rerun all 32 checks using Command 4's exact `execute.cjs calibrate --num-workers 8` command, with results saved under `raw/calibration-v3/`. This correction does not record that rerun as executed or claim a repaired calibration result.

## Next Research Directions

### Direction 1: Does explicit point/component evidence tracking correct the four calibration failures?

- Motivating evidence: Result 1's ordering, disclosure and progression disagreements despite single-metric calls.
- Factor to change: the judge protocol's attribution of learner evidence to point and component.
- Factors to hold constant: target prompts, calibration inputs and expected labels, Qwen model/settings and rubric ownership.
- Evaluation: rerun the complete calibration with a versioned protocol and independently review the four known failures and previously passing boundaries.
- Priority: high; trustworthy comparison depends on measurement readiness. This is a proposed follow-up, not an executed repair.
