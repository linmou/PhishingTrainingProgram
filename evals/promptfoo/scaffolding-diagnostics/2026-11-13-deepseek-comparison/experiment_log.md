# Intent

Preserve the controlled model comparison, calibration, execution, and evidence needed to interpret focused tutoring differences without changing the prompt or curriculum.

# Experiment: DeepSeek versus Qwen focused tutoring comparison

## Metadata

- Log status: completed diagnostic; model superiority and behavior acceptance unestablished; semantic results provisional
- Created: 2026-11-13T09:02:42Z
- Updated: 2026-11-13T09:16:47Z
- Author or agent: root/Codex; log maintained by focused_log using experiment-log-writer 1.1
- Repository: PhishingTrainingProgram
- Initial source commit: `0b9f5d90c7f5315da2739843fb8625b471b7f826`
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Results address: `evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/raw/` (frozen preparation and durable execution records; model-result interpretation pending)
- Placement: caller-selected existing evaluation hierarchy, `evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/`.

## Research Questions

### RQ1: With the same final component-scaffolding prompt and real learning targets, how does configured deepseek-flash compare with qwen3.8-flash on recognition-before-action, component disclosure, factual accuracy and responsive progression?

- Origin: Derived from [the component-scaffolding experiment log](../2026-11-13-component-scaffolding/experiment_log.md).
- Prior result motivating this question: the final Qwen full-cleanup arm received historical automated counts of 98/105 recognition-before-action, 72/105 component disclosure, 105/105 factual accuracy, and 91/105 responsive progression. Those estimates remain provisional. Independent disclosure adjudication found 79 pass, 19 clear fail, and 7 ambiguous, leaving the user-approved 80% threshold unvalidated rather than conclusively failed.
- Answer criterion: report exact same-judge pass counts and deltas, applicable partitions, errors, and calibration results per metric. Ordinary behavior uses 80%; factual accuracy retains 100%. This is a focused diagnostic, not overall acceptance.

## Hypotheses

### H1 (addresses RQ1): Changing the target provider/model changes four-rubric tutoring conformance.

- Expected observation: at least one nonzero paired delta under the common judge, with preserved comparable inputs and explicit trajectory limitations.
- Rejection observation: no differences are observed on the scored outputs.
- Status: preregistered

## Experiment Design

- Independent factor changed: target provider/model, historical qwen3.8-flash through DashScope versus newly generated configured deepseek-flash.
- Factors held constant: frozen final `cleanup_full` prompt, complete real template learning-point inventories, case definitions, three repetitions, target temperature 0.3, 600-token maximum, and disabled thinking. No prompt optimization is planned.
- Data or inputs: 27 fixed cases plus two four-turn trajectories, three repetitions, totaling 105 responses per model. Qwen uses the 105 preserved final-cleanup replies from the prior experiment. DeepSeek generates 105 new replies. Actual prior tutor replies are carried through each model's own trajectory, so later trajectory histories can diverge and are reported separately from fixed histories.
- Evaluation method: primary-only existing amended semantic rubrics for recognition-before-action, component disclosure, factual accuracy, and responsive progression. Calibrate the DeepSeek judge, then regrade all 105 saved Qwen replies and 105 new DeepSeek replies with identical model-blind judge evidence and settings: temperature 0, maximum 2,600 tokens. Exact snapshot hashes, calibration result, and allowed-input implementation are Unknown pending harness preparation and independent review.
- Stopping rule: a fresh maximum of 30 minutes of active model execution, at most eight workers, no prompt optimization; preserve provider errors, invalid results and partial evidence.
- Known confounders: historical Qwen generation time; provider-specific parameter handling; a DeepSeek judge assessing DeepSeek replies may introduce own-model bias despite blinded identity; repetitions are not independent learner cases; controlled trajectories diverge through actual prior tutor replies; known semantic-rubric ambiguities persist.
- Provider configuration: root verified the sanitized endpoint/model configuration in the main checkout's `tutor-system/.env`; credentials are never written to this log. Exact endpoint string is Unknown to this writer until supplied by the executor, and will be recorded with request metadata.
- Provider parameter difference declared before calls: DeepSeek's documented disabled-thinking format is `thinking: {type: 'disabled'}`, while Qwen used `enable_thinking: false`. Source: [DeepSeek thinking-mode documentation](https://api-docs.deepseek.com/guides/thinking_mode). This is a provider-adapter difference, not an undeclared reasoning-mode treatment.
- Ownership: harness agent owns experiment code; root owns README/evaluation plan; independent auditor reviews preparation and measurement. This log records supplied facts and does not approve those artifacts.

## Execution Commands

Not supplied. Exact calibration, generation and common-judge commands will be recorded before execution. No command is claimed executed by this plan entry.

## Results

Not produced. Judge calibration and the model comparison are pending.

## Iterations

Not produced. This is a preregistered plan entry.

## Corrections And Deviations

None.

## Analysis Notes

- 2026-11-13T09:02:42Z: historical Qwen scores cannot be compared directly with a new DeepSeek judge's scores. Rejudging the preserved Qwen replies under the identical new judge is required for a common-measurement comparison. Calibration defects remain explicit rather than silently replaced by keyword checks or assumed agreement.

## Next Research Directions

Not supplied. Directions will follow observed matched-case differences, provider failures, or unresolved measurement evidence rather than a presumed model advantage.

## Preparation Update: 2026-11-13T09:05:45Z

- H1 remains preregistered and unchanged.
- Worker-verified calibration size: **24 constructed examples, 42 primary metric labels**. Exact calibration evidence and frozen hashes will be produced by preparation.
- Root is awaiting independent review of the exact source before calls. None of the commands below has executed at this log entry.
- No second-model substitution or label tuning is planned. A failed calibration metric will remain visible. Root may authorize an explicitly marked diagnostic continuation under the existing user-requested diagnostic scope; that would not establish calibration or acceptance.

### Planned commands

All commands use `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding` as working directory and the inspected main-checkout `tutor-system/.env` for provider configuration. Their status is **Planned**; execution timestamp, exit status, and actual output are **Not executed**.

#### Command 1: Prepare and freeze the comparison

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/runner.cjs prepare
```

#### Command 2: Calibrate the common DeepSeek judge

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/runner.cjs calibrate 8
```

#### Command 3: Generate DeepSeek replies and apply the common judge

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/runner.cjs run 8
```

If any calibration metric fails and root authorizes diagnostic continuation, the declared alternative is:

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/runner.cjs run 8 diagnostic-approved
```

This alternative is not yet executed or selected. If used, its authorization, calibration limitation, actual command and outcome will be recorded separately, retaining this initial plan.

## Execution-Recording Correction and Preparation Review: 2026-11-13T09:09:31Z

- Target: planned direct calls to `runner.cjs`.
- Correction: the durable execution wrapper `execute.cjs` now records the exact child-command argument list, working directory, environment-file reference, start/completion timestamps, stdout, stderr, and exit status under `raw/execution/`. It runs the same reviewed runner; this is an operational provenance change, not a model/rubric treatment.
- Revised commands:

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/execute.cjs prepare
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/execute.cjs calibrate 8
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/execute.cjs run 8
```

If root authorizes diagnostic continuation after a failed calibration metric, the equivalent marked wrapper command is `rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/execute.cjs run 8 diagnostic-approved`. That alternative remains distinct from a calibrated acceptance run.

### Observed preparation execution

- Status: modified from the initial direct-runner command to the wrapper for durable evidence.
- Working directory: Metadata working directory.
- Environment reference: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env`; secret values excluded.
- Actual child argument list: `rtk proxy node /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding/evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/runner.cjs prepare`.
- Started: `2026-11-13T09:08:38.868Z`; completed: `2026-11-13T09:08:39.076Z`; exit **0**, no signal.
- Evidence: `raw/execution/1794560918869/{started.json,completed.json,stdout.log,stderr.log}`.
- Calibration wrapper lifecycle is also now present at `raw/execution/1794560957385/`: started `2026-11-13T09:09:17.384Z`, completed `2026-11-13T09:09:23.163Z`, exit **1**. The cause and metric results have not been supplied or interpreted by this entry; this is not a claim of behavioral calibration failure or provider failure.

### Exact-source review and preflight history

- `independent-preparation-review.json` clears execution after two operational repairs. Active snapshot: `raw/snapshot-v2.json`, fingerprint `f309a132a1ac900562b6f8678650f58639e3d37679a94f245a2c8698a43f48b7`; runner SHA-256 `93891c7a6968e20bd81977f400ffadafda2cbaf870b1b71e3914c6d2ebd4dc8c`. The original preflight `raw/snapshot.json` remains preserved.
- Resolved before model calls: a budget exception could otherwise discard earlier failed attempts; HTTP transport failures could incorrectly trigger a target-format repair. The active version preserves earlier attempt evidence and stops format repair after a transport error.
- Structural tests: **5/5 passed**, as verified in the independent review. Exact preflight shell timestamps were not supplied.
- Earlier preparation history: a preliminary direct test failed with a SyntaxError and was repaired before freeze; a tool working-directory typo prevented another process from starting. No timestamps or raw logs were supplied for those preflight events, and none are invented here.
- Review scope: identical-input comparison applies to 81 fixed replies. The remaining 24 trajectory replies use each model's own generated history; prior Guard state is controlled false, so these are not autonomous full-state production rollouts. Readiness review does not establish semantic calibration or model acceptance.

## Iteration 1: 2026-11-13T09:10:30Z

- Hypothesis: H1, measurement-readiness stage only.
- Source commit: `0b9f5d90c7f5315da2739843fb8625b471b7f826` plus the exact reviewed snapshot-v2 preparation.
- Files or configs changed: new `runner.cjs`, structural test, and `execute.cjs` wrapper. Target/judge model is configured deepseek-flash, with disabled thinking using DeepSeek's documented request format. The four semantic rubrics and reference labels are frozen without tuning.
- Commands: calibration wrapper completed with exit 1; diagnostic continuation is authorized as the explicitly marked command below.
- Results: Result 1, 40/42 agreement with no API or format errors and two disclosure false failures.
- Decision: **inconclusive for disclosure measurement**. The other three rubric calibrations agree on their declared examples, but model-comparison outcomes remain unmeasured at this calibration point.
- Revision note: root authorized diagnostic continuation without changing rubric text or labels. A failed disclosure calibration stays visible; the diagnostic cannot be represented as validated disclosure acceptance.

### Calibration command execution

- Status: modified from the original direct-runner plan to the previously declared provenance wrapper, then executed.
- Wrapper command:

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/execute.cjs calibrate 8
```

- Exact child command is recorded as an argument array in `raw/execution/1794560957385/completed.json`: `rtk proxy node /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding/evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/runner.cjs calibrate 8`.
- Working directory: Metadata working directory.
- Environment: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env`; endpoint `https://api.deepseek.com`; model `deepseek-flash`; judge temperature 0, maximum 2,600 tokens, `thinking: {type: 'disabled'}`, JSON-object response format, eight workers.
- Started: `2026-11-13T09:09:17.384Z`; completed: `2026-11-13T09:09:23.163Z`; exit **1**, no signal.
- Output/log: `raw/execution/1794560957385/stdout.log`, `stderr.log`, lifecycle metadata, `raw/calibration/`, and `raw/calibration-summary-1794560963136.json`.

### Result 1: DeepSeek judge calibration

- Informs: RQ1/H1 measurement readiness, not the effect of changing the target model.
- Run status: completed calibration with unmet disclosure-agreement gate.
- Input: 24 frozen constructed examples / 42 primary expected judgments in snapshot-v2.
- Configuration: reviewed snapshot fingerprint `f309a132a1ac900562b6f8678650f58639e3d37679a94f245a2c8698a43f48b7`, frozen amended rubrics, calibration command settings above.
- Metric definition: exact agreement with expected applicability/pass labels.
- Metric value: **40/42 agreement**: recognition-before-action **13/13**, component disclosure **12/14**, responsive progression **5/5**, factual accuracy **10/10**. **Zero API errors, zero format errors, zero target calls at the calibration point.**
- Observation: `disclosure_action_confusion` sets `pass:false` even though its reason explicitly says the learner's action-specific confusion permits the explanation. `earlier_action_attempt_retained` ignores the relevant earlier action attempt. The independent reviewer confirmed both as false failures.
- Interpretation: the judge remains unreliable on important disclosure eligibility boundaries. Calibration agreement for other criteria supports a bounded diagnostic but does not guarantee error-free judgments on generated outputs.
- Evidence: `raw/calibration-summary-1794560963136.json`; complete representative constructed inputs, requests, responses and verdicts in `raw/calibration/disclosure_action_confusion.json` and `earlier_action_attempt_retained.json`.
- Results location: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding/evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/raw/`.
- Calibration evidence inventory, excluding snapshots and any ongoing comparison: 24 `calibration/` files, four `execution/1794560957385/` files and one calibration summary, totaling **29 files, 455,634 bytes**. SHA-256 `1dbb4a2b01d8909ea5577a97823ce309c3f90349313fbe227b5550b6e18e0668`, computed over lexically sorted relative paths followed by NUL, exact file bytes, then NUL. A final run inventory has not yet been produced.
- Generation command: calibration wrapper above.

### Authorized diagnostic comparison command

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/execute.cjs run 8 diagnostic-approved
```

- Status for this entry: planned/authorized continuation; its actual execution lifecycle and final outputs will be recorded from its own metadata.
- Reason for changing the original unmarked run command: disclosure calibration failed, and root explicitly authorized a diagnostic within the user's requested scope without changing measurement criteria. The marker records this limitation rather than bypassing it silently.
- Expected work: generate 105 DeepSeek target replies and judge both those replies and 105 saved Qwen replies under the same blinded DeepSeek judge. No partial comparison count is presented as a completed result here.

## Iteration 2: 2026-11-13T09:12:39Z

- Hypothesis: H1.
- Source baseline: `0b9f5d90c7f5315da2739843fb8625b471b7f826` and reviewed snapshot-v2. Preparation and calibration records were subsequently committed in verified commit `3b1c48ffd6a7a842ee79632e64a7d34e44f6797b`; that commit is dated provenance, not a replacement for each frozen source record.
- Files or configs changed: no prompt, learning target, semantic rubric, or expected-label changes. DeepSeek generated the new target condition; the same blinded DeepSeek judge evaluated both newly generated DeepSeek and preserved Qwen replies.
- Commands: the explicitly authorized diagnostic wrapper command completed successfully, as recorded below.
- Results: Result 2, all 105 new target replies and 210 common-judge records complete.
- Decision: **inconclusive for model superiority**. H1's descriptive nonzero-difference prediction is observed in two aggregate metrics, but mixed directions, trajectory-history differences, and grader errors prevent a stronger comparative claim.
- Revision note: no additional model calls or measurement tuning. Final evidence inventory and independent output review will be appended after they are complete.

### Comparison execution

- Status: executed using the previously authorized diagnostic continuation marker.
- Wrapper command:

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/execute.cjs run 8 diagnostic-approved
```

- Exact child command recorded in `raw/execution/1794561003680/completed.json`: `rtk proxy node /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding/evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/runner.cjs run 8 diagnostic-approved`.
- Working directory: Metadata working directory.
- Environment reference: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env`; `https://api.deepseek.com`; deepseek-flash target/judge; target temperature 0.3 and 600 tokens, judge temperature 0 and 2,600 tokens, thinking disabled, eight workers.
- Started: `2026-11-13T09:10:03.679Z`; completed: `2026-11-13T09:11:29.641Z`; exit **0**, no signal.
- Logs: `raw/execution/1794561003680/{started.json,completed.json,stdout.log,stderr.log}`. Initial analysis: `analysis-1794561089625.json`; post-wrapper analysis available at `analysis-1794561128064.json`. Both remain preserved.

### Result 2: Four-rubric common-judge comparison

- Informs: RQ1/H1.
- Run status: completed diagnostic.
- Input: 105 preserved Qwen replies and 105 new DeepSeek replies; 81 fixed histories and 24 trajectory turns per model.
- Configuration: active snapshot fingerprint `f309a132a1ac900562b6f8678650f58639e3d37679a94f245a2c8698a43f48b7`; same final component-scaffolding prompt and real inventories; same four semantic rubrics and blinded judge inputs.
- Output: **105 new target replies, 210 comparison judgments**, in addition to 24 earlier calibration calls. All final target and comparison judgment records are present and valid; **zero missing or invalid final results**.
- Metric definition: applicable semantic pass counts under the same DeepSeek judge; Qwen historical judge scores are not used in these deltas.

| Metric | Qwen all | DeepSeek all | Qwen fixed | DeepSeek fixed | Qwen trajectory | DeepSeek trajectory |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Recognition before action | 104/105 | 100/105 | 80/81 | 76/81 | 24/24 | 24/24 |
| Component disclosure | 97/105 | 97/105 | 74/81 | 73/81 | 23/24 | 24/24 |
| Responsive progression | 90/105 | 92/105 | 68/81 | 68/81 | 22/24 | 24/24 |
| Factual accuracy | 104/105 | 104/105 | 80/81 | 80/81 | 24/24 | 24/24 |

- Observation: DeepSeek has four fewer recognition-order passes, the same aggregate disclosure and factual counts, and two more progression passes. Its progression difference occurs in trajectories with different generated tutor histories; the matched fixed-history progression count is unchanged.
- Interpretation: there is no uniform model advantage. The common judge produces different judgments on identical historical Qwen replies than the prior judge; those shifts are measurement effects, not changes to Qwen's original behavior. Disclosure calibration retained two false failures, and independent review has also reported false passes in generated-output scoring. Disclosure values are therefore provisional and cannot establish 80% acceptance despite their high automated counts.
- Threshold interpretation: ordinary automated counts can be shown against 80%, but a failed disclosure calibration prevents validated disclosure acceptance. Both factual-accuracy counts are 104/105 against the retained 100% gate; the diagnostic is not overall acceptance.
- Evidence: `analysis-1794561128064.json` records aggregate/partition counts, fixed-input paired transitions and case-level reasons; `raw/targets/` and `raw/judgments/` preserve complete input/output and judging records. Exact output-review findings will be appended when the independent artifact is available.
- Results location: the Metadata raw evidence root. Final file-count, size, hash, usage and cumulative active-time inventory remain pending the executor's post-wrapper evidence record; no earlier incomplete inventory is labeled final here.

### Interim final-analysis boundary

The completed run answers the narrow empirical question with mixed observed scores. It does not establish that changing the model solves separate recognition/action opportunities, that the two models are equivalent, or that either is ready for release. No model calls remain planned; the remaining work is evidence reconciliation and independent interpretation.

## Final Evidence and Independent Analysis: 2026-11-13T09:16:47Z

### Final execution result

- The comparison is complete: **105 new DeepSeek targets and 210 common-judge comparison records**, with zero missing or invalid final results. The 105 Qwen outputs were reused unchanged, not regenerated. No additional model calls occurred after the recorded comparison and bounded repairs.
- Provider accounting: **346 HTTP requests, all HTTP 200; zero HTTP errors; 1,062,876 reported tokens**. All returned model identifiers are `deepseek-flash`, and all finish reasons are `stop`.
- The request count comprises 24 calibration calls, 105 target calls, 210 judgment batches, **five target-format repairs** for extra top-level fields, and **two judge-format repairs** for content after the JSON object. All repairs recovered; originals and retries remain preserved. Valid unfavorable behavior verdicts were not resampled.
- Active model execution: **90,870 ms (1.51 minutes)**, within the fresh 30-minute allowance. This includes the recorded calibration/comparison execution segments; it does not claim that the entire human review and preparation took 1.51 minutes.
- Canonical results location: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding/evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/raw/`.
- Final post-wrapper evidence inventory: **356 files, 35,467,184 bytes**. Inventory SHA-256 **`d1c9cc033b8c7267336bb07600bacb43f6cdadea33f7300b6767e5817081c1c0`**. `evidence-summary.json` points to `analysis-1794561128064.json#evidence.file_hashes`; source analysis SHA-256 is `2ed01d08b233c02598f5a951653a6d4b719ccccdcac76b948c1b191039050437`. This is the final inventory, distinct from the earlier calibration-only subset hash.
- Integrated verification: all **105 Qwen source-file hashes** unchanged; all **81 fixed prompts** exact across models; all **24 DeepSeek trajectory records** use their own actual earlier tutor replies, with **36 embedded prior-reply checks**. Frozen runner/test hashes remain unchanged; five structural tests passed. Evidence: `verification.json`, `evidence-summary.json`, and the exact-source preparation review.
- Root's final offline reconciliation passed: all **24 metric cells** satisfy expected = pass + fail + error; all **four paired fixed-history denominators** equal 81; README/report relative links resolve. No model calls or score changes were involved.
- Commands and source provenance: the earlier wrapper execution records retain exact command, environment, timestamps, stdout/stderr and exits. Preparation/calibration commit `3b1c48ffd6a7a842ee79632e64a7d34e44f6797b` remains the verified iteration provenance; final packaging commit will be reported after it exists.

### Independent output review

- Source: `independent-output-review.json`, reviewer `/root/focused_audit`, against snapshot fingerprint `f309a132a1ac900562b6f8678650f58639e3d37679a94f245a2c8698a43f48b7`.
- Coverage: all 105 DeepSeek response texts, all failed DeepSeek judgments across the four metrics, targeted full histories for suspected errors, and **22 purposively selected joint-pass outputs** across both models. The 22-output sample is not random, and this is not a complete independent four-metric reannotation of 210 replies. All 105 new Qwen disclosure verdicts were cross-tabulated with the prior independent audit.
- Confirmed missed behavior: three DeepSeek replies give the safe action after **recognition-only confusion**, yet the judge passes both ordering and disclosure. Examples include “Stay calm and slow down” and “Use a general place like my neighborhood instead, and keep your street address private.” Those are the actual action answers in the configured inventory, not merely prerequisite explanations.
- Disclosure cross-tab: among the 19 Qwen replies previously independently judged clear failures, the common judge passes **14** and fails five; among the 79 prior passes, it passes **77** and fails two; among seven ambiguous records, it passes six and fails one. These are disagreements with an independent AI audit, not a human-gold confusion matrix.
- Additional confirmed errors: the judge misses explicit action advice in Qwen replies, sometimes marks an eligible recognition correction as premature disclosure, and incorrectly rejects a protective reply addressed to another participant whose unsafe click intention is present in the unchanged template. Some progression passes overlook switching from the current completed recognition to another point before offering the current action opportunity.
- Retained ambiguity: both automated factual failures transform a claim that a real company **does not need** frightening language into **never uses** such language. Independent review did not confirm either as a definite falsehood; broad necessity claims may still be misleading. The original failures remain preserved, with neither factual equivalence nor definite factual violation inferred from them.
- Progression boundary: after a student recognizes that a public phone number exposes them to outsiders, asking what strangers could do may deepen consequences. Under the frozen pointwise reference, the current action is next, while the inventory separately lists consequences as another point. This is a spec-conditioned concern rather than an inherently bad teaching question, and the ambiguity remains explicit.
- Successful counterexamples: the selected full address journey shows both models eliciting an action after recognition, explaining after explicit action confusion, and then moving to another point. This demonstrates local compatibility with the intended journey, not reliable aggregate conformance or human learning benefit.

### Final analysis and metric interactions

**No reliable model ranking follows from this run.** Under the same judge, DeepSeek has four fewer ordering passes, equal aggregate disclosure and factual counts, and two more progression passes. The fixed-history progression comparison is tied at 68/81; the apparent progression gain comes entirely from own-history trajectories. Those trajectory inputs intentionally differ after each model's earlier replies.

All ordinary rubric aggregates numerically exceed the user-selected 80% threshold, but **all four semantic aggregates remain provisional for decisions**. Disclosure calibration failed and the audit found both false passes and false failures; order/progression judgments also contain specific errors; the two factual failures remain ambiguous. The factual aggregate is 104/105 for each model against the retained 100% criterion, but that does not establish a confirmed factual violation. Neither passing aggregates nor a small successful calibration subset settles measurement validity, required partitions, non-regression or acceptance.

Joint all-four pass counts are Qwen **84/105** and DeepSeek **88/105**; fixed-only joint counts are **62/81** and **64/81**. These join the same preserved response IDs and remain diagnostic, not a new gate that offsets failures. Independent review found both true local joint successes and false joint passes, so the aggregate difference cannot support superiority.

The historical Qwen replies receive different scores under DeepSeek's judge than under the earlier Qwen judge. Because the replies are unchanged, this is a **measurement effect**, not improved Qwen tutoring. The common judge reduces an obvious comparison mismatch but retains possible own-model preference and demonstrated interpretation errors. Temporal differences between historical Qwen and new DeepSeek calls, three correlated repetitions, and constructed learner interventions also limit inference.

The experiment is complete as a focused model diagnostic. It does **not establish that either model meets the user-approved 80% disclosure criterion**, and observed clear leaks alone are not converted into a claim that the population rate is below 80%. Prompt optimization, the broader regression/holdout suite, production adoption and deployment remain outside this rerun. `report.md` and `analysis-summary.json` provide the user-facing interpretation and compact case-linked results; the raw scores and reviews remain unchanged.

### Evidence-grounded next directions

1. **Resolve disclosure measurement, high priority.** Motivating evidence: calibration contradiction and confirmed omission of trailing action advice in both model arms. Hold target replies fixed; test a reviewed annotation procedure that checks the entire response against separate recognition/action eligibility. Use independently annotated positive/negative boundaries and retain uncertainty instead of overwriting old grades.
2. **Clarify progression boundaries, high priority before ranking models on progression.** Motivating evidence: phone-consequence questions and new-point shifts after recognition. Hold the real learning-point content fixed; specify whether deepening consequences belongs to the current recognition stage or begins a new point, then version expected cases and rerun comparable judgments under that declared choice.
3. **Only then test model differences on fresh held-out cases, subsequent priority.** Motivating evidence: mixed small common-judge differences and historical-generation/own-model-judge confounds. Hold prompt, curriculum, decoding and validated scoring constant; generate both arms contemporaneously and report fixed inputs separately from responsive trajectories. This requires a separately authorized experiment rather than extending this completed run silently.
