# DeepSeek versus Qwen tutoring comparison

Intent: compare the configured DeepSeek model with saved Qwen responses on the four requested tutoring behaviors using the same final experimental prompt and real learning targets.

Updated: 2026-11-13. Source baseline: `0b9f5d9`.

## Scope and controls

This continues [the component-scaffolding diagnostic](../2026-11-13-component-scaffolding/report.md). The user requested a new model comparison after updating `OAI_MODEL`, `OAI_BASE_URL` and credentials in the main checkout's `tutor-system/.env`. Sanitized preflight identified `deepseek-flash` at `https://api.deepseek.com`. Credentials remain outside artifacts.

Use the saved **full-cleanup final candidate** prompt, complete unchanged template inventories, 27 fixed histories and two four-turn controlled trajectories, each repeated three times. Generate 105 DeepSeek responses and retain the existing 105 Qwen3.8-flash responses as the comparison arm. The 81 fixed requests must match exactly apart from provider/model packaging. The 24 trajectory turns use the same scripted learner interventions but retain each model's actual previous tutor replies; later trajectory inputs therefore differ intentionally. They measure controlled journey behavior, not identical-input response differences or human learning.

Target settings remain temperature 0.3, maximum 600 tokens, thinking disabled, three unseeded repetitions. DeepSeek requires `thinking: {"type":"disabled"}`; Qwen used `enable_thinking:false`. This provider-specific mapping preserves the intended non-thinking mode. DeepSeek defaults to thinking enabled and does not honor temperature in that mode, per [the provider documentation](https://api-docs.deepseek.com/guides/thinking_mode), checked 2026-11-13. Record the actual returned model and finish reason.

Pre-existing uncommitted runtime prompt edits and the earlier manual-room continuity note are outside this experiment's edits. The runner consumes frozen prior evidence rather than rebuilding prompts from those files.

## Measurement and stopping rule

Use the existing amended four primary rubrics without wording changes: `recognition_before_action`, `component_disclosure`, `factual_accuracy`, and `responsive_progression`. Calibrate the DeepSeek judge against the existing relevant annotated examples before scoring. Grade both target arms with the same blinded DeepSeek judge, temperature 0, maximum 2,600 tokens, thinking disabled. Exclude private tutor reason as in the existing primary judge. Preserve original Qwen-judge results separately; comparing those directly against new DeepSeek-judge scores would mix target and evaluator changes.

Ordinary rubric thresholds are at least 80%; factual accuracy retains its existing 100% hard-constraint criterion. Show each rubric's counts, denominator, calibration, missing/error records, partitions and paired changes. Ambiguity and invalid records cannot disappear from denominators. Failed calibration makes that rubric's model comparison provisional; it cannot establish acceptance. Keep joint success across the four metrics visible as a diagnostic, not an added gate. Independent review checks experimental integrity and representative scored responses.

The authorized endpoint is a focused comparison. Use a fresh 30-minute active execution cap and at most eight concurrent calls. Preserve all calls, including failed requests and bounded retries. Do not tune prompts or rubrics against this comparison. Repetitions are not independent scenarios; common-model judging may favor its own outputs, and historical Qwen calls introduce a temporal confound.

## Artifacts

The [completed report](report.md) records the four-metric comparison and its measurement limits. [analysis-summary.json](analysis-summary.json) contains exact counts, partitions and paired transitions; [evidence-summary.json](evidence-summary.json) and [verification.json](verification.json) record raw evidence and input integrity. The run produced all 105 DeepSeek responses and 210 common-judge evaluations, with no unresolved execution errors. Independent review found grader errors, so the comparison does not establish model superiority or behavior acceptance.

Raw requests, responses, snapshots, progress and logs remain under ignored `raw/`, with a hash inventory and commands recorded in [experiment_log.md](experiment_log.md). Run `node execute.cjs prepare`, then `node execute.cjs calibrate 8`, then `node execute.cjs run 8 diagnostic-approved` from this directory only in a fresh experiment copy; the existing frozen snapshot cannot be overwritten. The diagnostic flag records the explicit decision to continue with failed disclosure calibration. `node summarize.cjs` rebuilds compact summaries from the latest saved analysis without model calls.
