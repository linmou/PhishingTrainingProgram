# Focused tutoring experiment status

Intent: report measured evidence separately from preparation and provider failures for the component-scaffolding experiment.

Updated: 2026-11-13. Source baseline: `2172ab600c042f454553e9369f057b2f65cb3c60`.

**The first 315-response comparison is complete, with provisional semantic results and three secondary-judge format errors.** Adding the component instruction and teacher-reference labels did not reliably prevent premature answers. All three arms disclosed an unattempted safe action after correcting the same failed recognition attempt. One generic prompt-conflict repair and one independently authored measurement clarification are in progress; no acceptance is claimed. The first calibration attempted the approved `qwen3.8-flash` model against the then-configured DeepSeek endpoint and was rejected. The user restored the Dashscope configuration and explicitly requested retry. A second calibration exposed a transport-contract defect: JSON mode requires the literal word JSON in the instruction. A generic JSON-format instruction fixed it without changing rubric criteria or labels.

Each failed calibration contained 31 HTTP requests covering 49 expected judgments, all unmeasured rather than rubric failures. Fresh `raw/calibration-v3` completed **49/49 agreement, zero errors**. The comparison at `raw/comparison-v1` freezes 315 target responses across three arms and three repetitions, fingerprint `e7278367336a5ada2a4b7c268a09f8bd020cf626928b88421b09bfaff452c60a`. It is not yet a completed behavior verdict.

| Rubric | Calibration checks | Current result |
| --- | ---: | --- |
| Recognition before action | 4 | 4/4 agree |
| Component-specific disclosure | 7 | 7/7 agree |
| Responsive progression | 5 | 5/5 agree |
| Factual accuracy | 4 | 4/4 agree |
| Contribution feedback | 5 | 5/5 agree |
| Reading accessibility | 4 | 4/4 agree |
| Learner dignity | 4 | 4/4 agree |
| Honest self-representation | 4 | 4/4 agree |
| Persona stability | 4 | 4/4 agree |
| Decision rationale | 4 | 4/4 agree |
| Instruction realization | 4 | 4/4 agree |

Raw evidence is retained at `raw/calibration-v1/`, including complete constructed cases, expected labels, actual judge requests, response bodies, settings and timestamps. Its initial runner exited 0 despite unresolved API errors; that is a harness defect, not a successful calibration. The runner now exits nonzero for unresolved calibration disagreement/error and rejects a configured model mismatch before making HTTP requests. The failed snapshot remains unchanged.

The 10 structural harness tests passed. The calibrated rubric examples include single-metric boundaries and mixed full-batch cases to check cross-rubric independence. Calibration agreement does not prove correctness on every generated response; independent selected-output review remains necessary.

Initial primary results (baseline / instruction / instruction plus labels; each 105 responses): recognition order 88 / 90 / 88; disclosure 78 / 78 / 77; progression 92 / 94 / 89; factual accuracy 105 / 104 / 105. These are provisional: independent review found false disclosure failures, missed absolute factual claims, and different verdicts for an identical judge request. Original outputs and grades remain preserved in `raw/comparison-v1`.

Next: calibrate the single measurement clarification, score all arms comparably, test removal of conflicting upstream action-answer directives, resolve only invalid judge responses through bounded identical-request retries, and report each rubric immediately. Do not infer prompt improvement, non-regression or release readiness from calibration alone.

See [README](README.md) for experimental factors, [experiment log](experiment_log.md) for exact execution records, and the [canonical plan](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-evaluation-plan.md) for thresholds and scope.
