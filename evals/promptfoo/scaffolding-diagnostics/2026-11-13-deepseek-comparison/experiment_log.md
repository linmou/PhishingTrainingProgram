# Intent

Preserve the controlled model comparison, calibration, execution, and evidence needed to interpret focused tutoring differences without changing the prompt or curriculum.

# Experiment: DeepSeek versus Qwen focused tutoring comparison

## Metadata

- Log status: running diagnostic; disclosure calibration failed, other primary calibration checks agreed
- Created: 2026-11-13T09:02:42Z
- Updated: 2026-11-13T09:10:30Z
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
