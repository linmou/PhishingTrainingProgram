# DeepSeek versus Qwen: focused tutoring results

Intent: answer whether changing the configured target model improves the four requested tutoring behaviors under the same final experimental prompt and real learning targets.

Updated: 2026-11-13. Execution source baseline: `0b9f5d9`; the new runner was uncommitted during execution. Preparation/calibration commit: `3b1c48f`.

**This comparison does not establish a clear DeepSeek improvement or a fix for premature answer disclosure.** The run completed: 105 new DeepSeek responses and 210 common-judge evaluations. Automated scores are diagnostic estimates. Disclosure failed judge calibration, and independent inspection found additional grading errors on actual outputs. A model ranking or acceptance decision cannot be justified by these small score differences alone.

## Four requested rubrics

Both columns below use the same `deepseek-flash` judge, identical amended rubrics and field extraction. The Qwen column regrades saved outputs; it does not regenerate Qwen answers. Each denominator includes all 105 expected responses, including three repetitions of each fixed history or trajectory. Final errors/missing: zero for every cell.

| Rubric (LLM judgment) | Qwen3.8-flash | DeepSeek-flash | DeepSeek minus Qwen | DeepSeek judge calibration |
| --- | ---: | ---: | ---: | ---: |
| Recognition before action | 104/105 (99.0%) | 100/105 (95.2%) | −3.8 percentage points | 13/13 |
| Disclosure | 97/105 (92.4%) | 97/105 (92.4%) | 0.0 points | 12/14; failed |
| Factual accuracy | 104/105 (99.0%) | 104/105 (99.0%) | 0.0 points | 10/10 |
| Responsive progression | 90/105 (85.7%) | 92/105 (87.6%) | +1.9 points | 5/5 |

All three ordinary rubric aggregates numerically exceed the user-selected 80% threshold. Both automated factual-accuracy estimates fall short of the existing 100% hard-constraint criterion, but the independent audit could not confirm either factual failure. These are not acceptance verdicts: calibration/measurement concerns, required partitions, non-regression and focused-only coverage remain separate. Passing a small calibration set does not prove error-free grading on generated outputs. All four semantic aggregates remain provisional for decision-making.

The earlier Qwen-judge scores on these same Qwen outputs were 98/105 ordering, 72/105 disclosure, 105/105 facts and 91/105 progression. Their change to 104, 97, 104 and 90 under DeepSeek is **a grader effect on unchanged responses**, not an improvement in Qwen tutoring. Original scores and the earlier independent disclosure audit (79 passes, 19 failures, 7 ambiguous) remain preserved.

## Matched inputs and trajectories

All six phishing/privacy template inventories and the final full-cleanup prompt were preserved. The 81 fixed requests are exact matches across target models. The 24 trajectory turns use the same learner script and frozen prompt shell but retain each model's own previous replies; later inputs therefore differ. The four cyberbullying templates and broader behavior suite were not tested here.

| Rubric | Fixed Qwen /81 | Fixed DeepSeek /81 | Trajectory Qwen /24 | Trajectory DeepSeek /24 |
| --- | ---: | ---: | ---: | ---: |
| Recognition before action | 80 | 76 | 24 | 24 |
| Disclosure | 74 | 73 | 23 | 24 |
| Factual accuracy | 80 | 80 | 24 | 24 |
| Responsive progression | 68 | 68 | 22 | 24 |

DeepSeek's two-response progression advantage comes entirely from the trajectory partition. The fixed comparison is tied. Fixed-case Qwen-pass/DeepSeek-fail versus Qwen-fail/DeepSeek-pass counts are 4/0 for ordering, 6/5 for disclosure, 1/1 for factual accuracy and 5/5 for progression. Detailed reference-component partitions and every changed verdict are in [analysis-summary.json](analysis-summary.json).

Joint success on all four automated metrics was Qwen 84/105 and DeepSeek 88/105; on fixed inputs, 62/81 and 64/81. This is a diagnostic joined on actual output IDs, not an added gate or a score that offsets a failed requirement. Repeated cases and scripted trajectories do not support population-level or human-learning claims.

## What the dialogues and grading show

DeepSeek still supplies an action answer after confusion about recognition alone. In `component_0_recognition_confusion__cleanup_full__r3`, the student says, “I do not understand why the scary warning words could be a problem.” DeepSeek replies:

> Scary words and warning symbols are used to make you rush. A real company does not need to frighten you into clicking. Stay calm and slow down.

The last sentence gives the action before a separate action attempt/confusion. The common judge passed ordering and disclosure despite that trailing advice. The factual judge also flags the categorical statement about real companies; the independent review discusses that interpretation separately.

A successful stage sequence is visible in `journey_3__cleanup_full__r2`: after the learner identifies the public home address, DeepSeek asks what Jasmina should do; only after the learner explicitly says they do not know what to do does it explain deleting the public address and sharing privately. After the learner demonstrates that action, it moves to the photograph. This demonstrates that the sequence is possible under the prompt, not that it is reliable in all cases or improves human learning.

The disclosure judge has both false-fail and false-pass problems. During calibration, it emitted `pass:false` while its explanation said the action answer was permitted; it also ignored an earlier learner action attempt. On the saved Qwen outputs, it passed **14 of the 19 cases previously independently judged clear disclosure failures**. It failed two of the 79 previously reviewed passes. This disagreement is material and prevents treating 92.4% as validated disclosure performance. These are disagreements with an independent AI audit, not human-gold accuracy estimates. See [independent-calibration-review.json](independent-calibration-review.json) and [independent-output-review.json](independent-output-review.json).

The independent reviewer read all 105 DeepSeek response texts, all failed DeepSeek judgments, targeted histories and 22 purposively selected joint-pass outputs across both models. It confirmed three DeepSeek action leaks after recognition-only confusion that the judge missed. It also found a protection false-fail: the response explicitly addressed another participant's recorded intention to click. Some progression judgments overlook switching to a new point before the current action is developed; whether further consequence reasoning is useful deepening or delayed progression depends on the adopted pointwise rule and remains a boundary concern. Both factual failures are ambiguous: the responses say a real company **does not need** to frighten someone, whereas the judge treats that as **never uses** frightening language. The original grades were preserved without replacing them with the audit.

## Execution and evidence

Changed factors: target provider/model (DashScope Qwen to DeepSeek), provider-specific non-thinking parameter, and the common evaluation model. The latter was applied to both target arms. Prompt content, target meaning, case selection, primary rubrics, three repetitions, target temperature 0.3/600-token limit and judge temperature 0/2,600-token limit were held fixed. DeepSeek explicitly used `thinking:{"type":"disabled"}` rather than Qwen's `enable_thinking:false`.

The run used 346 HTTP requests, all HTTP 200, and 1,062,876 reported tokens. This includes 24 calibration calls, 105 target generations, 210 rubric batches, five target-format repairs and two judge-format repairs. Invalid structured outputs were retained and repaired within the predeclared limit; valid unfavorable verdicts were not resampled. Active execution was 90,870 ms (1.51 minutes), below the fresh 30-minute cap. All returned model identifiers were `deepseek-flash`; all finish reasons were `stop`.

Five structural tests passed. Integrated evidence verification confirmed all 105 Qwen source-file hashes unchanged, all 81 fixed prompts exact, and all 24 DeepSeek trajectory records consistent with their actual earlier replies (36 embedded prior-reply checks). Frozen runner/test hashes remained unchanged. See [verification.json](verification.json), [evidence-summary.json](evidence-summary.json), [independent-preparation-review.json](independent-preparation-review.json), and [experiment_log.md](experiment_log.md).

Raw evidence is retained locally under `raw/`: full frozen snapshots, inputs/outputs, calibration, judgments, errors/repairs, request settings, execution logs and budget records. The evidence manifest contains 356 files, 35,467,184 bytes, with inventory SHA-256 `d1c9cc033b8c7267336bb07600bacb43f6cdadea33f7300b6767e5817081c1c0`. The snapshot includes the old constitution/specification/contract provenance through its hashed prior frozen run; the current working plan applies the user's corrected 80% ordinary-rubric threshold.

The model comparison is complete. Prompt refinement, broader regression/holdout acceptance and deployment were outside this rerun. The evidence supports retaining the scaffolding issue as unresolved and resolving the evaluator's treatment of permitted disclosure, trailing action advice and progression boundaries before using these scores to choose a model.
