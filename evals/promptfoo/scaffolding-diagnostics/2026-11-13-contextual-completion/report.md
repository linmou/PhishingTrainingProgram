# Contextual completion evaluation

Intent: record what the revised completion requirements and cross-scenario tests establish about repeated tutoring and premature advancement.

Updated: 2026-11-13. Source checkpoint: `5b5b86ec2d805b7e07ff03f5a08da5168f8b517a` on `eval/tutor-stage-scaffolding-20261113`.

## Outcome

The general specification and rubrics now distinguish task-specific completion from answer length or mandatory extra explanation. The comparison completed with 81 valid targets and 243 judgments, without missing records or judge errors. Neither candidate is accepted: redundant tasks, paired regressions and boundary failures remain. The task-meaning refinement improves some contexts but does not solve overlapping-task completion.

## Requirements and experimental factors

The [canonical specification](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-specification.md) applies T02 semantic equivalence: assess answers in conversational context; allow one answer to satisfy overlapping tasks; preserve completed meaning through acknowledgments; reopen only for a concrete gap or contradiction; consolidate when no task remains. It retains observation-before-behavior and the separate component-attempt disclosure rule. The adopted constitution and its priorities are unchanged.

The [nine independently authored cases](independent-cases.json) cover the gift-card report, another reward judgment, bare agreement, an unanswered safe action, overlapping meeting-plan points, acknowledgment after completion, contradiction after completion, concise link recognition, and all tasks completed. Two controlled pairs distinguish sufficient judgment from agreement and acknowledgment from contradiction. The room is an exposed source case; the remaining cases are synthetic development evidence. None is an unseen holdout.

| Arm | Changed factor | Planned responses |
| --- | --- | --- |
| Baseline | Current completion-cleanup policy | 27 |
| Contextual completion | Replace the completion-evidence block with task-specific contextual sufficiency | 27 |
| Task meaning | Contextual candidate plus two replacements of mandatory safe-action instructions and a concise evidence-based target-selection instruction | 27 |

All original headings, task payloads, histories and provider settings are held constant. Both arms omit progress labels, avoiding later saved status in an earlier conversational prefix. The third arm was designed after inspecting the first 54 outputs; its gain cannot be attributed to the first replacement alone. Exact recipes are [candidate.txt](candidate.txt) and [candidate-task-meaning.json](candidate-task-meaning.json).

Target: Qwen3.8-flash, thinking disabled, temperature 0.3, 600 tokens. Judge: Qwen3.8-flash, thinking enabled, temperature 0, 8,000 tokens. Three unseeded repetitions per case. Concurrent phases share at most 32 calls. The separate 15-minute active allowance and retry limits are recorded in the frozen settings and log.

## Measurement

[Rubrics](rubrics.json) separately measure contextual progression, observation-before-behavior prerequisites, and component disclosure on the same response. The first two are revised for task-specific completion. Disclosure retains the earlier rubric under that evidence interpretation. Calibration uses eight constructed responses with 16 metric labels authored independently of the candidate.

Initial calibration matched 15/16 labels. The judge incorrectly treated a question about what scam texts request as a learner-safe-action question. A prospective prerequisite-only procedure distinguishes threat recognition from learner behavior, retaining the expected label, rubric and saved target outputs. All four affected calibration checks were rerun and agreed; the other 12 were reused after exact request/settings equality verification, yielding 16/16. The original error remains evidence. Calibration agreement does not establish perfect actual-output grading; independent semantic disagreements are reported separately.

The declared diagnostic gates require each metric to reach 80%, no paired baseline pass becoming a candidate fail, and all completed/unfinished boundaries to pass in every repetition. Format/provider/judge errors stay in planned denominators. Passing this development comparison would not establish general reliability or broad product acceptance.

## Results and interactions

The following are machine grades, not fully independently reannotated scores. Every denominator is 27; three repetitions do not constitute three independent scenarios.

| Arm | Contextual progression | Observation prerequisite | No premature disclosure | All three |
| --- | --- | --- | --- | --- |
| Baseline | 21/27 (77.8%) | 25/27 (92.6%) | 26/27 (96.3%) | 18/27 (66.7%) |
| Contextual completion | 23/27 (85.2%) | 24/27 (88.9%) | 24/27 (88.9%) | 18/27 (66.7%) |
| Task meaning | 22/27 (81.5%) | 27/27 (100%) | 26/27 (96.3%) | 21/27 (77.8%) |

Both candidates clear marginal 80% gates but fail non-regression and exact boundary gates. Against baseline, contextual completion has one progression, three prerequisite and three disclosure pass-to-fail cases; task meaning has one progression and one disclosure regression. All exact IDs and per-case outcomes are in [final-summary.json](final-summary.json). The judgment-versus-agreement pair passes 2/3 repetitions for baseline and 1/3 for each candidate. The acknowledgment-versus-contradiction pair passes 2/3, 2/3 and 3/3 respectively. Neither candidate passes every required pair repetition.

Same-output progression/disclosure cells are:

| Arm | Both pass | Progression only | Disclosure only | Both fail | Unevaluable |
| --- | --- | --- | --- | --- | --- |
| Baseline | 20 | 1 | 6 | 0 | 0 |
| Contextual completion | 20 | 3 | 4 | 0 | 0 |
| Task meaning | 21 | 1 | 5 | 0 | 0 |

Progression/prerequisite cells (both pass, progression only, prerequisite only, both fail) are baseline (19,2,6,0), contextual completion (20,3,4,0), and task meaning (22,0,5,0), with zero unevaluable. The first candidate's higher marginal progression does not improve joint success because prerequisite/disclosure failures increase. Task meaning removes those prerequisite failures in this sample, while leaving five progression failures and a disclosure regression. These are model tradeoffs and measurement limitations, not incompatible requirements: joint-success witnesses exist.

Independent review found clean gift-card advancement in baseline 1/3, contextual completion 1/3 and task meaning 2/3. Task meaning also advances appropriately in two of three library judgment replies, but its third still invents an additional action. Its third gift-card reply requires saying the plausibility question aloud. Every arm fails to clearly elicit the distinct remaining posting-time behavior in the overlapping meeting-plan case. Task meaning also supplies “That seems too high” after bare “Okay” in one agreement repetition, violating disclosure. All arms consolidate the terminal all-complete case and correct the real public-visibility contradiction in 3/3 repetitions. See [independent output review](independent-output-review.json).

Recorded active execution totaled 7.010 minutes across two non-overlapping runs; the hours-long pauses between sessions are excluded. The second run completed at 2026-11-13T16:55:09.714Z. Target generation ran alongside calibration, followed by a flat 32-worker judging pool. No target was resampled to replace an unfavorable response.

## Interpretation and next diagnostic

The room report exposed a general weakness in the previous specification's broad “unexplained verdict” prohibition. Task-specific sufficiency is now explicit in the specification and tested across contexts. The prompt experiments show why that clarification alone is insufficient: generic action mandates and heading-by-heading treatment still compete with semantic completion. Removing two mandates improved two reward scenarios, but did not resolve overlapping task meanings.

The next defensible experiment should isolate semantic evidence mapping across overlapping tasks, and repair actual-output evaluator disagreements before further acceptance scoring. It should include equivalent evidence under different headings and distinct still-unfinished actions, rather than adding another broad instruction based on the single room. This is proposed work, not an implemented or verified solution. The tested candidates remain experimental.

## Separate input repair

The actual room investigation also found a general application defect: tutor suggestions loaded only legacy room progress, while learner progress was stored under `transfer_v1`. Commit `5b5b86e` selects the focused learner's checklist, or the sole learner when no focus is supplied. Explicit learner focus never falls back to room-shared legacy progress; ambiguous ownership or failed reads stop generation. Quiz enablement does not determine progress ownership.

The repair passed an initial 39 tests across six request/provider suites. Author review then corrected a focused-learner legacy fallback, and the affected suite passed 18/18 again; the other 21 checks cover unchanged paths. Independent source/test review found no remaining scoped issue. Full repository TypeScript checking remains failing on existing diagnostics, with none in the modified service or expanded ownership suite. See [verification](raw/request-progress-fix/verification.json) and [independent review](independent-request-progress-review.json). This verifies request plumbing, not semantic completion.

## Evidence and limits

The [experiment log](experiment_log.md) records commands, timing, changed factors and raw paths. [Final summary](final-summary.json) preserves scores, paired transitions and hashed per-item evidence; [evidence index](evidence-index.json) identifies the locally retained manifest of 371 raw files totaling 23,815,660 bytes. Preparation and exact-candidate audits are stored beside this report. The earlier [task-label report](../2026-11-13-task-label-continuity/report.md) and frozen evidence retain their original results. This follow-up is a prospective clarification, not retroactive relabeling.

Final independent review verified all 81 target hashes, 243 judgment hashes, aggregate cells, paired transitions and pair outcomes. It also found residual semantic grading disagreements, including inconsistent progression decisions on nearly identical generic action questions and disclosure passes for prescribed behavior. [Independent final review](independent-final-review.json) records exact cases and qualifications without overwriting machine grades. Consequently the reported rates are not fully corrected conformance estimates; 16/16 calibration did not prevent actual-output errors. The structural harness passed 2/2 checks for parsing and judge input isolation.

The live room's saved transcript and checklist establish repetition and a progress mismatch, but its original provider requests were not captured. The respective causal contributions of missing progress and prompt instructions remain hypotheses. Scripted answers and repeated model outputs do not establish human learning gains.
