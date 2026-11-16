# Intent

Record the task-completion hypothesis, controlled prompt comparison and evidence needed to distinguish unnecessary repetition from appropriate work on unfinished tasks.

# Experiment: Contextual completion and redundant tutoring

## Metadata

- Log status: bounded execution and independent numerical review complete with 81 valid targets and 243 judgments; no candidate accepted because completion boundaries and non-regression checks fail; semantic grading disagreements remain explicit
- Created: 2026-11-13T11:19:11Z
- Updated: 2026-11-13T20:04:44Z
- Author or agent: `/root/task_label_execution`, resumed by `/root/contextual_execution`; log maintained by experiment-log-writer 1.1, currently `/root/contextual_execution/experiment_log`
- Repository: PhishingTrainingProgram
- Initial source commit: `9bcae2d3d8c1afd41e3a4c663e2d127f01ae8fe5`; current working changes will be hashed at freeze
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Experiment directory: `evals/promptfoo/scaffolding-diagnostics/2026-11-13-contextual-completion`, a new caller-prepared child explicitly selected by Root for this request
- Results address: `evals/promptfoo/scaffolding-diagnostics/2026-11-13-contextual-completion/final-summary.json`; detailed hashed record `raw/final-summary-1794600108202.json`. Earlier canonical address `raw/summary-1794569284040.json` remains the initial failed-calibration result.

## Research Questions

### RQ1: Can contextual task-completion instructions prevent invented requirements and repeated tutoring of concise answers while preserving unfinished-task prerequisites?

- Origin: Derived from [the closed task-label/continuity experiment](../2026-11-13-task-label-continuity/experiment_log.md) and the subsequently investigated gift-card room documented in [plan.md](plan.md).
- Prior result motivating this question: the previous focused comparison accepted no candidate; completion-boundary review found repeated semantically demonstrated material under other headings. The new room evidence shows a learner-specific tracker marking the plausibility point covered after “Not possible”, followed by ordinary tutoring requests for reasons about the same reward. The Mars message was an assessment, not another ordinary tutoring repetition. The old raw package remains closed and unchanged.
- Answer criterion: compare baseline and candidate on independently authored contextual-completion boundaries, preserving task-specific sufficiency and earlier learner evidence. Score contextual progression, unfinished prerequisites and component disclosure separately. Each metric requires at least 80% overall with no baseline pass becoming a candidate fail; all declared completed/unfinished boundaries must pass in all repetitions. Independent preparation/refinement and output reviews remain required.

## Hypotheses

### H1 (addresses RQ1): A task-specific completion instruction reduces redundant tutoring without inventing additional completion requirements.

- Expected observation: the candidate advances after sufficient concise or earlier learner evidence more often than the baseline, without requiring a longer explanation, paraphrase or additional example unless the configured task requires it.
- Rejection observation: unchanged or worse contextual progression, new pass-to-fail cases, or repeated completed meaning under different headings. Unevaluable results remain inconclusive.
- Status: preregistered in this plan before model calls

### H2 (addresses RQ1): The same clarification preserves the distinction between sufficient contextual evidence and a genuinely unfinished prerequisite or action.

- Expected observation: the candidate continues the current unfinished task when a required observation meaning or behavior is still absent, and preserves the component-specific attempt/confusion gate before answer disclosure.
- Rejection observation: advancement based only on agreement, tutor-supplied meaning or a risk verdict that omits the required action; new prerequisite or disclosure failures. Unevaluable results remain inconclusive.
- Status: preregistered in this plan before model calls

## Experiment Design

- Independent factor changed: replace only `LEARNER_COMPLETION_EVIDENCE_POLICY` in the current completion-cleanup baseline with [candidate.txt](candidate.txt). The candidate makes sufficiency contextual and task-specific, retains earlier demonstrated evidence across acknowledgments, permits one answer to satisfy overlapping task meanings, and requires a concrete missing meaning or contradiction to reopen a task.
- Factors held constant: original headings and task content, response format, corrected learner-progress input supplied identically to both arms, source histories, target/judge models and sampling settings. The separate learner-checklist routing repair in `aiService` is Root-owned and is not counted as prompt-improvement evidence.
- Data or inputs: planned eight cases, including exposed room evidence and independently authored boundaries across other topics, with three repetitions per case and two arms: **48 target generations**. Planned six independently annotated calibration examples. Case content, exact applicability, source hashes and final counts are pending independent authoring and freeze; no missing details are inferred.
- Evaluation method: [rubrics.json](rubrics.json) defines `contextual_progression` and `unfinished_prerequisite`. Retain the exact prior component-disclosure rubric text/hash in the execution freeze, interpreted with the clarified task-specific evidence rule. Evaluate the same saved target output across all applicable checks. Judge evidence proceeds from configured required meanings to the relevant question/learner answer, prior evidence/contradictions, remaining task and actual tutor response. Report denominators, errors, paired pass-to-fail changes and same-output joint success.
- Calibration and ordering: freeze cases, prompts, rubrics, sources and settings before generation. Generation may run in parallel with calibration as requested; grading begins only after calibration passes. Preserve failed calls, repairs and independent disagreements. Independent examples and frozen preparation are pending at log creation.
- Model settings: explicit `qwen3.8-flash` for target and judge at the current DashScope endpoint. Tutor: `enable_thinking:false`, temperature 0.3, 600-token cap. Judge: `enable_thinking:true`, temperature 0, 8,000-token cap. Three unseeded target repetitions per case/arm.
- Stopping rule: a new **15-minute active wall-clock interval-union allowance**, separate from the closed earlier experiment; at most **32 shared concurrent calls** across active phases. Exact transport/format retry policy is Unknown until the harness freeze records it; do not infer a changed policy from the earlier run.
- Known confounders: all cases are exposed/development evidence, with no eligible unseen holdout; the room request is a reconstruction, not a captured original provider request; both arms receive corrected learner progress, so prompt effects cannot explain the historical contribution of missing progress; the specification/rubrics are prospective clarifications, so earlier frozen results retain their original interpretation; task overlap can make apparent point changes semantically redundant.
- Environment: Node.js and repository dependencies; endpoint/credentials from `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env`. Credentials remain outside artifacts. Runtime version and exact endpoint snapshot are Unknown until preparation records them.
- Prior package boundary: commits `fb5ca91c090aa92a8f7487cf86d5c19ffbcde291` and `9bcae2d3d8c1afd41e3a4c663e2d127f01ae8fe5` identify the prior preparation and closeout context. The prior log and raw package are not edited by this writer.
- Observability: print calibration agreement, target-generation progress, per-arm metrics and representative failures as execution proceeds.

## Execution Commands

### Command 1: Run frozen comparison with concurrent generation and calibration

- Status: running; start observed, completion and exit status pending
- Started: 2026-11-13T11:27:01.461Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node executable `/opt/homebrew/Cellar/node/25.9.0_2/bin/node`; endpoint/credentials from the main-checkout `tutor-system/.env`; frozen Qwen settings
- Exit status: Pending
- Output or log: `raw/execution-start-1794569221461.json`; live per-call records under `raw/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-contextual-completion/runner.cjs run
```

### Command 2: Execute resumed V3 comparison

- Status: running; launch observed, outcome and exit status pending
- Started: 2026-11-13T16:49:11.620Z
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node executable `/Users/admin/.nvm/versions/node/v22.12.0/bin/node`; endpoint/credentials from the main-checkout `tutor-system/.env`; frozen Qwen settings
- Input: `raw/frozen-v3.json`, fingerprint `8c5f19e0fb1ecc4fd32daa8d30a3b42aa1ef60cd2055345eb228789bf74f2a43`
- Exit status: Pending
- Output or log: `raw/execution-start-1794588551620.json`; per-call records under `raw/`

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-contextual-completion/runner.cjs run
```

The runtime executable changed between the interrupted first run and this resume (Node 25.9.0 to 22.12.0); the frozen API payloads and settings are checked for exact reuse. This runtime difference is recorded rather than represented as identical environment. The 54 prior target records are reused, including semantically unfavorable replies. The additional 27 targets use sixteen generation workers alongside four new prerequisite calibration calls; the other twelve calibration results require exact request/settings equality before reuse. Thus at most twenty API calls are initially active. After calibration passes, the planned flat pool grades all 243 target/metric pairs with at most 32 active calls. The five-hour idle interval is outside the unchanged fifteen-minute active-execution allowance.

### Command 3: Reconcile final saved evidence without model calls

- Status: Executed.
- Timestamp: summary records creation at 2026-11-13T20:01:48.198Z; exact shell start/end timestamps were not separately retained.
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding/evals/promptfoo/scaffolding-diagnostics/2026-11-13-contextual-completion`.
- Environment: local Node `/Users/admin/.nvm/versions/node/v22.12.0/bin/node`; saved evidence only, no credentials or model calls required.
- Exit status: 0, reported by Root's executed tool call.
- Output: `final-summary.json` and `raw/final-summary-1794600108202.json`.

```bash
rtk proxy node summarize-final.cjs
```

## Results

### Result 1: Valid target generation with a failed evaluator boundary

- Informs: RQ1 and the measurement needed to assess H1/H2.
- Run status: target generation completed; semantic grading was not started because calibration failed.
- Input: `raw/frozen.json`, fingerprint `e3c526e5e407c7b53eedd29af6ad56831e2bb543cd8560add6cb943fb429d2a6`; nine cases, two arms, three repetitions.
- Configuration: non-thinking Qwen3.8-flash target at temperature 0.3/600 tokens; thinking judge at temperature 0/8,000 tokens; generation and calibration shared the 32-call ceiling.
- Output: **54/54 saved targets were valid**; **15/16 calibration checks agreed**, with no calibration transport/format errors. No semantic target score is available from this run.
- Metric definition: valid target means the product response contract parsed successfully; calibration agreement compares the semantic judge's boolean verdict with the independent reference label.
- Observation: `contradiction_ignored_fail__unfinished_prerequisite` returned false against expected true. The judge treated a question about what scam texts might request as a question about the learner's safe behavior. Independent review identifies this as recognition content; choosing the wrong recognition point belongs to contextual progression.
- Interpretation: measurement repair is required before judging the targets. This is not evidence that a target candidate passed or failed the overall gate.
- Evidence: [summary](raw/summary-1794569284040.json), [calibration](raw/calibration-summary-1794569221461.json), [execution end](raw/execution-end-1794569221461.json), and [independent measurement review](independent-measurement-review-v2.json). Full input/output pairs remain under `raw/targets/`; representative pair: `raw/targets/gift_card_contextual_judgment_real__candidate__r3.json`.

## Iterations

### Iteration 1: Contextual completion replacement and measurement repair

- Informs: H1/H2 and RQ1.
- Execution: Command 1 generated 54 valid targets and produced Result 1's 15/16 calibration result. No semantic target grading ran before the failed prerequisite boundary was corrected.
- Changed files/factors: `candidate.txt` replaces only the completion-evidence policy; `rubrics.json` defines contextual progression and prerequisite boundaries; independently authored cases and calibration establish the nine-case development comparison.
- Decision: revise measurement, preserving all targets and the initial calibration error. The generic actor/action classification correction in V2 changes only the prerequisite judge procedure, not expected labels, rubric text or target requests.
- Source: initial frozen package and the exact sources embedded in `raw/frozen.json`; the initial execution-end metadata records completion at 2026-11-13T11:28:03.985Z. Numeric process exit status remains Unknown in the saved metadata.

### Iteration 2: Remove competing generic action mandates

- Informs: H1/H2 and RQ1; this additional refinement was selected after observing the first 54 outputs, not preregistered before them.
- Execution: Command 2, started 2026-11-13T16:49:11.620Z and completed 2026-11-13T16:55:09.714Z with recorded status `grading_finished`. Numeric process exit status is Unknown in the durable execution-end metadata; this is distinct from the observed complete artifact coverage.
- Changed files/factors: `candidate-task-meaning.json` replaces two mandatory safe-action clauses and adds concise demonstrated/missing-meaning selection. `runner.cjs` adds that arm and the independently reviewed prerequisite judge procedure. The nine cases, model payload settings and existing 54 target requests remain equal; 27 new target outputs are added. Twelve calibration judgments are reused only after exact request/settings checks and four affected checks receive new calls.
- Source commit: `5b5b86ec2d805b7e07ff03f5a08da5168f8b517a` with working files captured in `raw/frozen-v3.json`; fingerprint `8c5f19e0fb1ecc4fd32daa8d30a3b42aa1ef60cd2055345eb228789bf74f2a43`.
- Decision: reject acceptance of both candidates. Machine aggregates show some gains, but paired regressions, the sufficient-judgment/agreement boundary and independently observed repeated overlapping meaning remain. Result 2 preserves the exact quantitative evidence and limits.

### Result 2: Complete bounded comparison with residual repetition and disclosure failures

- Informs: H1/H2 and RQ1.
- Run status: all planned target and judgment records present; no target errors, missing judgments or judge errors in the final comparison. Calibration passed 16/16 after the declared repair; the original 15/16 result is unchanged.
- Input: nine exposed development cases, three arms and three repetitions, frozen V3 fingerprint above. Both arms' original histories remain identical and progress labels are uniformly omitted; the task-meaning arm uses the same histories as well.
- Configuration: Qwen3.8-flash target thinking false, temperature 0.3, 600 tokens; judge thinking true, temperature 0, 8,000 tokens. Additional generation overlapped four new calibration checks; subsequent judgments used a shared 32-worker pool. No saved target was resampled.
- Output: 81/81 saved and valid tutor responses; 243/243 judgments; zero judge errors. Per-response inputs, attempts, outputs and verdicts are retained under `raw/targets/` and `raw/judgments-v2/`.
- Metric definition: each count is machine rubric passage over the planned 27 outputs per arm. Joint passage requires all three metrics on the same output. Repetitions are not independent new scenarios.

| Arm | Contextual progression | Unfinished prerequisite | Component disclosure | All three |
| --- | --- | --- | --- | --- |
| Baseline | 21/27 (77.8%) | 25/27 (92.6%) | 26/27 (96.3%) | 18/27 |
| Contextual candidate | 23/27 (85.2%) | 24/27 (88.9%) | 24/27 (88.9%) | 18/27 |
| Task-meaning candidate | 22/27 (81.5%) | 27/27 (100%) | 26/27 (96.3%) | 21/27 |

- Paired changes against baseline: the contextual candidate has one progression, three prerequisite and three disclosure pass-to-fail records. The task-meaning candidate has one progression and one disclosure regression; no prerequisite regression. Exact IDs and all comparisons are in [final-summary.json](final-summary.json).
- Boundary pairs: judgment versus agreement passes 2/3 repetitions for baseline, 1/3 for contextual candidate and 1/3 for task-meaning candidate. Acknowledgment versus contradiction passes 2/3, 2/3 and 3/3 respectively. Thus neither candidate satisfies all pair repetitions.
- Independent observations: task-meaning cleanly advances in two of three gift-card and two of three synthetic library judgment outputs, demonstrating a gain beyond the motivating room. Its third gift-card response requires saying the plausibility question aloud; its third library response asks an extra generic action. All three task-meaning meeting-plan replies repeat future-risk observation rather than eliciting the distinct posting-time behavior. On agreement-only library repetition 2 it says “That seems too high,” disclosing the unattempted judgment. These are output observations; machine-grade disagreements require separate adjudication and are not silently corrected into the table.
- Representative pairs: `raw/targets/gift_card_contextual_judgment_real__task_meaning__r3.json` retains the input “Not possible” and output “Good. When you see a huge prize for tiny work, ask yourself: 'Would they really pay that much?' Try saying that question out loud.” The counterexample `raw/targets/gift_card_contextual_judgment_real__task_meaning__r1.json` moves to what “CRAZY DEAL!!” tries to make the learner feel. `raw/targets/library_agreement_only__task_meaning__r2.json` retains the disclosure failure after “Okay.”
- Interpretation: H1 has limited evidence of useful task-specific selection, but its reliability/acceptance condition is not met. H2 is not established for either candidate under the combined prerequisites/disclosure boundary. Aggregate ≥80% does not override paired regression or exact-boundary failure. The semantic specification generalizes the lesson from the room, but the tested prompts are not an accepted implementation.
- Evidence: [final summary](final-summary.json), [independent output review](independent-output-review.json), `raw/summary-1794588910004.json`, `raw/calibration-summary-1794588551620.json`, and `raw/execution-end-1794588551620.json`. Detailed final-summary SHA-256: `3f28d9584b082e8d4f9e0491a33674029e60d6a7591f5a771a729adaf4b1b0d1`.
- Active time: 7.0101667 minutes by the union of two non-overlapping execution segments, equal to their process sum; the 15-minute allowance was not exhausted. The hours of interruption between segments are excluded. Completion of this bounded comparison does not establish unseen-holdout reliability or human learning effects.

## Corrections And Deviations

### Independent final review completed — 2026-11-13T20:04:44Z

The pending aggregate-review status above is now resolved by [independent-final-review.json](independent-final-review.json): all 81 target hashes and 243 judgment hashes, metric totals, case partitions, three arm comparisons, exact transition IDs, controlled pairs, same-output interaction matrices and active time reconcile. Verdict: **numerical reconciliation clear; no candidate accepted**.

The bounded semantic disagreement audit retains machine grades and separately identifies progression ambiguity around generic action questions, missed disclosure of privacy/non-clicking goals, and inconsistent grading of similar persuasive-language questions. It is not a replacement human-annotation dataset. Both candidate arms clear automatic marginal thresholds but fail non-regression and the judgment-versus-agreement all-repetition gate. All arms still fail overlapping meeting-plan progression in 3/3 repetitions. Calibration 16/16 therefore remains evidence of those calibration checks only, not perfect actual-output grading. No additional calls or retrospective selected-label edits were made.

### Resume checkpoint and prospective V3 scope — 2026-11-13T16:48:15Z

Command 1 ended at **2026-11-13T11:28:03.985Z** with recorded status `calibration_failed`; the earlier running/pending entry is preserved as its launch observation. The exact numeric process exit status is Unknown in the retained execution-end metadata; it can be recovered from the original tool transcript if needed. `raw/budget/1794569221462.json` records **62,523 ms (1.04205 minutes)** of active execution. The later interruption does not add active model-execution time.

The independently cleared V2 measurement change adds only a generic clause-classification procedure to `unfinished_prerequisite`: questions about another actor's actions or threat consequences are recognition unless they also request or supply the learner's safe behavior. Expected labels, rubric text, target requests and settings remain unchanged. V2 is prepared as fingerprint `5c3497ebd29191adb701a126636fe297e3e3c1a221bd6f839bc1e853952b9322`; the resumed executor reports no V2 model calls. The next execution will rerun all four prerequisite calibration checks and reuse the twelve other checks only after exact request/settings equality verification. All 54 saved target outputs remain preserved and will not be resampled.

Root also approved the independently reviewed [task-meaning recipe](candidate-task-meaning.json), SHA-256 `26d33ea9c1c728837738e67ff805fe08ecf5f47e78e123a9bb39d640f0c66229`. It layers two exact generic-policy replacements and a brief demonstrated/missing-meaning selection instruction onto the first candidate. The first 54 outputs motivated this development refinement: extra generic action requests and repeated overlapping task meanings remain visible. The proposed mechanism is competing generic action mandates, not an established cause.

The planned V3 freeze adds 27 `task_meaning` outputs for **81 total target slots**, holding the nine cases, sixteen calibration labels, model settings and rubrics fixed. It will generate the additional arm in parallel with recalibration, then judge all saved outputs only after calibration passes. V3 freeze identity, launch time and outcomes remain pending. The entire follow-up retains the original **15-minute active interval-union allowance** and shared maximum of **32 calls**. This change is prospective; it does not rewrite the first run's result.

### Frozen preparation and launch correction — 2026-11-13T11:27:38Z

The approved freeze is `e3c526e5e407c7b53eedd29af6ad56831e2bb543cd8560add6cb943fb429d2a6`. Final preparation contains **nine cases and 54 targets**, plus **16 calibration checks across eight annotated responses**. This supersedes the initial eight-case/48-target/six-example plan. Root added a ninth terminal case before freeze; the exact cases and annotation provenance are retained in preparation artifacts.

Both arms now receive **history-only input, uniformly omitting progress**. Root approved this controlled choice before generation. It supersedes the plan's earlier corrected-progress input design and keeps the separate learner-checklist routing repair outside the prompt-effect comparison. The run remains a reconstruction, not a captured original provider-request replay.

Generation uses 16 workers in parallel with 16 calibration workers, preserving the global maximum of 32. Grading uses a flat 32-worker pool only after calibration passes. The active allowance remains 15 minutes. The frozen retry policy permits at most two transport and two format attempts, with target timeout 90 seconds and judge timeout 180 seconds. Each attempt is further bounded by half of the remaining allowance minus the two-second retry delay. This explicit budget policy is fixed before calls; it is not a post-failure fallback.

Preparation initially detected a stale specification hash (`087c…` versus `2514…`). The independent auditor verified metadata-only drift and updated the source pin before freeze. The executor reports two structural harness tests passing: JSON validation and single-metric/private-rationale isolation. Freeze checks verified reverse-replacement equality of paired messages and preservation of headings. Exact test command/time were not supplied at this entry; no executed test metadata is invented.

Command 1 has started. No calibration agreement, target score or behavioral result is claimed by this launch record.

## Analysis Notes

### Final evidence preservation — 2026-11-13T20:03:32Z

All model and summary writers are closed. [Evidence index](evidence-index.json) identifies the ignored local `evidence-manifest.json`, containing **371 raw files totaling 23,815,660 bytes** under `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding/evals/promptfoo/scaffolding-diagnostics/2026-11-13-contextual-completion`. Manifest SHA-256 is `0dc6d9812b4b7176ba12cb50d9693c97ce29560fce33ee1f4e7e39c1183d530c`. Commands 1–3 and V3 fingerprint `8c5f19e0fb1ecc4fd32daa8d30a3b42aa1ef60cd2055345eb228789bf74f2a43` identify generation and analysis; the manifest preserves individual file hashes. These artifacts remain local while compact code, provenance and conclusions are tracked.

Root reran the already recorded structural harness command with exit 0, **2/2 passing**, duration 285.47975 ms. Exact wall-clock time was not captured; no new raw test log was created. This verifies parser and evaluator-input structure, not semantic wording. No further API calls are planned. The independent aggregate review remains pending at this log closeout; the existing independent output findings and failed acceptance gates already preclude accepting a candidate.

### V3 generation and calibration checkpoint — 2026-11-13T16:50:36Z

The resumed executor reports **81/81 valid targets** and **16/16 calibrated checks**: all four affected prerequisite checks agree after new calls, while twelve unchanged checks were reused with exact request/settings verification. [V3 calibration summary](raw/calibration-summary-1794588551620.json) preserves the result. The initial 15/16 result remains in Result 1. Grading of all 243 target/metric pairs has started; its outcome and exit status are pending. The exact freeze was independently verified in [V3 review](independent-freeze-review-v3.json).

Root also reran the structural harness command below, reporting exit 0, two passes and duration 265.833 ms. Its exact wall-clock timestamp is Unknown because the supplied result did not record one; the tool transcript retains the observation. These checks concern parsing and evaluator input isolation, not semantic tutor wording.

```bash
rtk proxy node --test evals/promptfoo/scaffolding-diagnostics/2026-11-13-contextual-completion/harness.test.cjs
```

Working directory: the experiment worktree root above. Environment: local Node and repository dependencies. Output: Root's retained tool result; no separate test log was supplied.

The canonical behavior specification owns the meaning of completion. The application routing repair has a separate request-boundary integration test and should remain distinct from the prompt comparison. A small focused development result may support a local trial; it cannot establish general reliability or unseen-holdout acceptance.

## Next Research Directions

### Direction 1: Separate semantic completion from heading traversal

- Motivating evidence: every task-meaning meeting-plan reply retests meaning already demonstrated across overlapping headings, while the all-tasks-complete control consolidates correctly in all repetitions.
- Question: does explicitly representing demonstrated meanings and remaining task meanings prevent heading-based retesting without prematurely closing distinct behaviors?
- Factor to change: the representation of completed versus remaining semantic task requirements, rather than another generic demand to progress.
- Factors to hold constant: target inventory meanings, provider settings, evidence attribution, disclosure gate and complete boundary pairs.
- Evaluation: freeze a new candidate; compare on new cross-scenario overlapping/non-overlapping tasks and the preserved exposed boundaries, using calibrated semantic judgments and independent review. Do not infer success from the current machine progression rates alone.
- Priority: high, direct follow-up.

### Direction 2: Resolve remaining evaluator disagreements before broader acceptance

- Motivating evidence: independent output review identifies invented extra tasks and repeated overlapping observations despite some machine passes; the prior comparison also exposed grading false passes.
- Question: which task-completion distinctions remain systematically misjudged after the actor/action calibration repair?
- Factor to change: the evaluator's task-meaning attribution and boundary calibration, after independent adjudication of actual disagreements.
- Factors to hold constant: saved tutor outputs, target prompts/settings, and intended specification meaning. Preserve original judgments.
- Evaluation: independently annotate disputed responses, version any justified evaluator correction, calibrate affected checks, and regrade a comparable saved set. Report original and corrected verdicts separately.
- Priority: high, measurement follow-up; no new evaluator calls are claimed here.
