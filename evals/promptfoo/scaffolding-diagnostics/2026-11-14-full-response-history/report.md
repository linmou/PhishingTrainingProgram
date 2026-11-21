# Full response history: quick failed-case comparison

Intent: report whether removing the reason word cap and retaining structured tutor history fixes the previously observed progression failures.

Updated: 2026-11-14. Source baseline: `e3e8697513d52561438e7212ddb443ef962104df` plus the pre-existing local task-meaning candidate. Branch: `eval/tutor-stage-scaffolding-20261113`. Final experimental fingerprint: `0f6e1f0a5c7758bfac33e24f28d82409b73d74210c1bd3e9b0b9c6c09fbc5296`.

## Result

The independent review does not show an overall progression improvement. Across both generated turns, baseline and candidate each pass progression in 21/36 outputs and all three checks in 19/36. On the second turn, where the candidate actually receives its previous JSON, progression rises from 9/18 to 10/18 and joint success from 7/18 to 9/18. These small differences do not establish a reliable fix. Completed-task repetition and premature advancement both remain.

| Independent review, second turn | Baseline | Full history + uncapped reason |
| --- | ---: | ---: |
| Correct progression | 9/18 | 10/18 |
| Observation prerequisite respected | 16/18 | 18/18 |
| No premature answer disclosure | 14/18 | 15/18 |
| All three together | 7/18 | 9/18 |

All 72 generated outputs were valid and independently reviewed. All 216 automated judgment slots were saved: 215 valid judgments and one unresolved schema error after the configured two format attempts. Calibration passed all 16 existing examples. Calibration success does not remove the actual-output grader ambiguity already found in the previous experiment.

| Automated judge | Baseline | Full history + uncapped reason |
| --- | ---: | ---: |
| Progression, both turns | 23/36 | 22/36 |
| Observation prerequisite, both turns | 34/36 | 33/36, plus 1 error |
| No premature disclosure, both turns | 32/36 | 31/36 |
| All three, both turns | 21/36 | 18/36 |
| Progression, second turn | 9/18 | 10/18 |
| All three, second turn | 7/18 | 7/18 |

The independent review disagrees with 10 valid machine judgments, plus the separate schema error. These differences include generic library action questions, treating a sender comparison as behavior, whether naming scammers discloses urgency, and advancement after bare acknowledgment. Original grades are retained. Both assessments support the bounded conclusion: no reliable overall improvement and no acceptance. Independent all-turn progression is tied; the automatic count falls slightly. The second-turn progression totals agree, although not every per-output label does.

## What changed

The candidate removes only the two literal `At most 40 words of ` prefixes in the active prompt. It does not add a target field or new target-analysis instruction. The pre-existing prompt already asks reason to identify demonstrated and remaining meaning. Subsequent model history includes complete `{reason,decision,response}` from the generated prior turn. The baseline retains the cap and response-only history.

The six cases contain four prior failure boundaries and two controls. Each arm has three repetitions and two turns; the follow-up is always `Okay.`. There are 72 generations total, not 72 different cases. First-turn histories lack historical JSON and are kept unchanged rather than fabricating rationale. Consequently first-turn differences concern the cap only; the second-turn comparison bundles that change, full history and each arm's own first response. The exact initial runtime requests match the prior frozen task-meaning requests with only the two removals.

Models: Qwen3.8-flash target and judge, configured DashScope endpoint. Target temperature 0.3/nonthinking/max600; judge temperature0/thinking/max8000. Provider token limits still apply. Reasons averaged 21.3 words in baseline versus 36.7 in candidate; candidate maximum197, with7/36 above40 words. Longer evidence summaries were produced, but length does not establish better completion judgments.

## Concrete remaining failures

- **Gift card, candidate repetition3 turn1:** learner had already said `Not possible` after the explicit $500/five-minute comparison. The candidate asks `would a big company really give away $500 just for five minutes of work?` Its reason says observation is complete but that questioning the business logic remains. It still separates two task labels whose meaning was already demonstrated.
- **Overlapping meeting plan:** the learner already explained that strangers can use the cafe/time to find Mira and proposed sharing both privately. Candidate first turns all ask again about `tomorrow` or future-plan exposure. Candidate repetition1 turn2 eventually reaches posting time, but supplies `wait until after the meeting ends to post about it` without a behavior attempt. Selecting the missing target and disclosing its answer are separate checks.
- **Contradiction followed by acknowledgment:** both arms correctly repair the explicit false claim about public posts on turn1, but all six turn2 replies advance to unwanted-contact consequences after only `Okay.`. No learner-owned repair was demonstrated.
- **Exact repetition:** candidate library bare-agreement repetitions1 and3 repeat the preceding question verbatim. This is reported separately from retesting completed meaning because that task is still unfinished. An all-complete consolidation also repeats verbatim once without adding a new exercise.

All-complete library cases remain consolidation in both arms. This is useful counterevidence to a claim that every continuation fails.

## Runtime verification and limits

Local tutor generation now reads existing linked accepted/modified feedback and reconstructs complete output. Human edits retain the actual posted text separately; manual/incomplete historical rows retain their text. No new database schema is needed. See the [runtime record](../../../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_11_14_full_tutor_response_history.md).

Five focused product suites passed70/70; four experiment-harness checks passed. Full project TypeScript checking remains blocked by436 diagnostics across37 files, with no diagnostics in changed runtime files or the new integration test. Localhost3107 serves the compiled formatter and no old reason-limit phrase. Actual saved-room feedback-read authorization and browser request replay remain unverified.

This is exposed development coverage, with synthetic follow-up turns, no unseen holdout, no measured learning outcome, and no full behavior acceptance. The independent review retains the prior ambiguity around generic extra action questions in the library case. Participation errors, factual claims and response-length violations are noted where visible but are outside the three scored metrics. No hosted release or PR push is included.

## Evidence and next step

The [plan](plan.md), [preparation review](independent-preparation-review.json), [independent output review](independent-output-review.json), and [experiment log](experiment_log.md) preserve design and interpretation. The [machine summary](final-summary.json) includes every case partition, paired pass-to-fail changes and joint-metric tables. Complete requests and responses remain in ignored `raw/`; the [evidence manifest](evidence-manifest.json) hashes315 files totaling16,378,340 bytes. Frozen-v1 was prepared but never executed; frozen-v2 adds dependency provenance and the CRA-compatible helper header without changing scientific inputs.

Execution started at22:06:50UTC. The 72 target generations finished by22:09:03UTC; grading finished at22:21:18UTC. Initial execution used8 workers. At22:11:37UTC, it was deliberately interrupted (exit130) after16 calibration checks,72 targets and24 saved grades, then resumed at16 workers using all saved results. The resumed command exited0. Up to8 interrupted in-flight judge responses were not saved; their provider completion/usage is unknown and documented in the scheduling amendment. Saved API responses were HTTP200; one transport timeout recovered under the fixed retry policy. The final schema error remains in its denominator rather than being retried for a preferred outcome.

The next defensible experiment would compare identical prior tutor outputs with and without their reason in the next request. Mistaken target judgments remained after being carried forward in this run; whether carrying them caused persistence is unmeasured. That controlled comparison would isolate history's contribution more cleanly than the bundled intervention here.
