# Focused tutoring experiment report

Intent: determine whether the tutor lets a student recognize a problem and then attempt a safe action before receiving either answer, using unchanged pilot rooms and actual learning targets.

Updated: 2026-11-13. Source baseline: `2172ab600c042f454553e9369f057b2f65cb3c60`.

**The final candidate is not yet validated at the user-selected 80% ordinary-rubric threshold.** Across five prompt arms, 525 tutor responses were generated. The final candidate can produce the intended sequence, but an independent AI review of all 105 final responses found **79 disclosure passes, 19 clear failures and 7 ambiguous cases**. This is disclosure assessment, not an overall tutoring score or human agreement. See [the complete adjudication](disclosure-adjudication-cleanup-full.json).

Removing conflicting prompt clauses produced promising diagnostic changes, but premature action answers remain after a student attempts only recognition. The automated judge also makes boundary errors, so all semantic aggregates below are provisional. The final candidate is an experimental artifact; these results do not establish acceptance or release readiness.

**Threshold correction:** after the run, the user explicitly selected the skill default of **≥80% for ordinary behavior rubrics**. The working evaluation plan now uses 80% for recognition ordering and component disclosure. The original frozen plan's agent-imposed 100% thresholds are preserved as execution history, not presented as the user's requirement. At 80%, 84/105 passes are required. The independent audit confirms 79/105 (**75.2%**); resolving all seven ambiguous cases as passes would yield 86/105 (**81.9%**). At least five need confirmed passes to reach 80%, so the supported reassessment is **not yet validated**, rather than a proven sub-80% result. Ambiguous cases are not removed from the denominator. The provisional automated disclosure estimate is 72/105 (68.6%) but cannot settle this question because its judge failed calibration and has observed interpretation errors. Other hard-constraint, calibration, coverage and non-regression gates remain separate. No model rerun or score change was made for this threshold reassessment, and it is not described as a predeclared 80% acceptance run.

## Changed factors and coverage

The baseline is the merged Notice→action prompt with real document-derived targets. All six phishing/privacy standard templates retain their complete room context and learning-point inventories. The dataset adds 27 fixed learner histories and two four-turn controlled trajectories, each repeated three times. Every trajectory includes its actual generated tutor replies; later learner turns are scripted interventions. These are synthetic behavior tests, not observations of human learning. All ten standard templates have source provenance, but the four cyberbullying rooms were not behavior-tested in this focused run. Prior cases are accounted for in [the existing-case index](existing-case-index.json).

| Arm | Change from baseline | Responses |
| --- | --- | ---: |
| Baseline | Merged Notice→action instruction and original target labels | 105 |
| Instruction | Separate recognition/action attempt-or-confusion gates, retaining immediate protection | 105 |
| Instruction + expression | Same gates; teacher-reference labels replace target field labels without changing target content | 105 |
| Partial cleanup | Instruction arm plus removal of six conflicting active-policy clauses | 105 |
| Full cleanup | Instruction arm plus those six replacements and three conflicting room-generator clauses | 105 |

The partial cleanup missed mandatory safe-action directives in `responsePolicy.ts:17–18` and `emotionalParameters.ts:30`. The full cleanup addresses those directives too. Generic direct-teaching style examples remain. This isolates two levels of prompt conflict removal; it does not establish that target wording alone caused the original problem. There is no expression-only arm and therefore no full factorial interaction estimate.

All arms use `qwen3.8-flash`: target temperature 0.3 and 600 tokens; judge temperature 0 and 2,600 tokens; thinking disabled; three repetitions without a seed; at most eight concurrent calls. Four primary metrics are judged together with separate verdicts; seven secondary metrics use another batch. Private `reason` is excluded from primary judgments and used only for decision rationale in the secondary batch. Original target outputs remain preserved when measurement is replayed.

## Measurement reliability

Initial calibration agreed on 49/49 checks. Independent output inspection then found false disclosure failures, missed factual overclaims and inconsistent judgments. One generic measurement clarification was calibrated once: **69/71 checks agreed**. Recognition order agreed on 13/13, disclosure on **12/14**, progression on 5/5 and factual accuracy on 10/10; all secondary calibration checks agreed. Disclosure calibration failed, so continuation was explicitly diagnostic only. The remaining misses involved a legitimate contact-detail hint and a prior action attempt after a later contradiction.

All 525 target outputs received the same amended primary grading; the first 315 replayed targets are byte-identical to their originals. Secondary grading retains its original version. A later independent audit also found three false order failures on recognition-only final responses: `component_5_bare_agreement__cleanup_full__r3` and `component_5_unrelated_attempt__cleanup_full__r2/r3`. The grader penalized disclosed recognition even though no action-order violation occurred. Calibration agreement therefore does not validate real-output accuracy. [The measurement review](independent-measurement-review.json) preserves these defects, and no second measurement clarification was introduced.

## Per-rubric results

Counts are automated passes out of 105 expected outputs per arm unless noted. All semantic counts are provisional. The partial-cleanup arm has one unresolved primary judge batch, so its four primary rows contain 104 scored outputs plus one error; the denominator remains 105. Invalid original records and all bounded retries remain preserved.

| Rubric | Baseline | Instruction | Instruction + expression | Partial cleanup | Full cleanup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recognition before action | 92 | 93 | 91 | 94 + 1 error | 98 |
| Component-specific disclosure | 63 | 69 | 69 | 68 + 1 error | 72 |
| Responsive progression | 87 | 86 | 89 | 87 + 1 error | 91 |
| Factual accuracy | 104 | 104 | 105 | 102 + 1 error | 105 |
| Instruction realization | 102 | 100 | 100 | 100 | 101 |
| Contribution feedback, applicable only | 45/45 | 44/44 | 41/43 | 43/43 | 40/40 |
| Reading accessibility | 105 | 104 | 105 | 105 | 105 |
| Learner dignity | 105 | 105 | 105 | 105 | 105 |
| Honest self-representation | 105 | 105 | 105 | 105 | 105 |
| Persona stability | 105 | 105 | 105 | 105 | 105 |
| Decision rationale | 101 | 101 | 100 | 101 | 103 |

Feedback has respectively 60, 61, 62, 62 and 65 inapplicable outputs; absence is not an automatic pass. The final candidate's factual score and high accessibility scores do not offset its disclosure failures.

Matched fixed histories and trajectories must be interpreted separately. There are 81 fixed outputs and 24 trajectory turns per arm; the latter contain different generated histories.

| Primary metric | Baseline fixed /81 | Full cleanup fixed /81 | Baseline trajectory /24 | Full cleanup trajectory /24 |
| --- | ---: | ---: | ---: | ---: |
| Recognition before action | 68 | 75 | 24 | 23 |
| Component-specific disclosure | 43 | 51 | 20 | 21 |
| Responsive progression | 65 | 68 | 22 | 23 |
| Factual accuracy | 80 | 81 | 24 | 24 |

On fixed histories, the amended judge records baseline-to-final pass→fail / fail→pass counts of 4/11 for order, 8/16 for disclosure, 8/11 for progression, and 0/1 for facts. These are diagnostic flags, including known judge errors, rather than verified regression counts. [Analysis](analysis-summary.json) preserves each case ID and judgment; aggregate gains do not imply non-regression.

## Case analysis and metric interactions

**Clear failure after a recognition attempt.** In `component_5_failed_focused__cleanup_full__r1`, the student answers a focused question about a public post: “Only his friends can see it because it is his own post.” The tutor replies: “That is incorrect. Public posts are seen by strangers, not just friends. **Check who can see your posts to keep info private.**” Correcting recognition is allowed after that attempt. Giving the safe action is premature because the student has neither attempted the action nor expressed confusion about it. The same failure pattern appeared in the baseline and initial instruction arms.

**Clear failure after recognition confusion.** In `component_0_recognition_confusion__cleanup_full__r2`, the tutor adds “If you feel afraid, stop and look closer before doing anything.” Confusion about recognition has opened the action answer as well. In `component_5_recognition_done__cleanup_full__r3`, the tutor gives a new account-access mechanism and then deletion/trusted-adult actions without giving the student an opportunity for that new point. The issue crosses both component and learning-point boundaries.

**Successful controlled journey.** `journey_3__cleanup_full__r2` demonstrates a valid sequence for the address point:

1. Student: “I am looking at the post.” Tutor: “Look at the text in the post. Do you see any details that tell people exactly where Jasmine lives?”
2. The student explains that a full address lets viewers find the home. Tutor: “You found the exact address. What is one safe thing to do with that post now?”
3. The student explicitly does not know what to do. Tutor: “You should tell Jasmine to delete the post immediately. Never share your full home address online.”
4. The student proposes deletion/private sharing; the tutor advances to photo clues.

This is a counterexample to the claim that the two scaffolding obligations are inherently incompatible. It establishes that this prompt/model can follow the sequence in one controlled context, not that a real student learned from it.

The four primary requirements share the same response and were screened jointly. Automated all-four-pass counts are baseline 52/105, instruction 56/105, expression 59/105, partial cleanup 56/105 with one unevaluable, and full cleanup 64/105. For the final arm, the remaining combinations are disclosure-only failure 26, progression-only failure 8, order+disclosure+progression failure 6, and order+disclosure failure 1. These total the frozen 105 outputs. Fixed-history all-four-pass changes from 33/81 to 43/81; trajectory all-four-pass changes from 19/24 to 21/24. These joint counts inherit the judge's errors and are not an acceptance gate.

Observed prompt directives conflict: the old correction/teaching clauses demand safe-action content while the adopted component gate can require withholding it. The cleanup tests address that implementation conflict. They do not show a contradiction in the approved requirements. Independent failures remaining after full cleanup support incomplete model compliance; continuing direct-teaching examples are a plausible remaining influence, not a proven cause. Feedback and correct explanations can coexist with premature disclosure, so high feedback/factual scores cannot substitute for the learning-journey checks.

## Classification ensembles and brevity

These are deterministic supporting checks. Instruction accuracy uses the frozen allowed label sets on 27 fixed cases × three repetitions. Mode is correct on 81/81 in every arm. Two-/three-member votes use fixed members and abstain without a strict majority; they vote only on the instruction label, not the student-facing response. A conventional single-reference F1 is not claimed for these multi-acceptable-label cases.

| Supporting check | Baseline | Instruction | Instruction + expression | Partial cleanup | Full cleanup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Individual allowed-set instruction accuracy /81 | 80 | 79 | 78 | 79 | 79 |
| Two-member correct votes /27 | 24 | 24 | 22 | 24 | 26 |
| Two-member abstentions /27 | 3 | 3 | 4 | 2 | 1 |
| Three-member correct votes /27 | 27 | 27 | 26 | 26 | 27 |
| Three-member abstentions /27 | 0 | 0 | 0 | 0 | 0 |
| At most two sentences and 35 words /105 | 58 | 51 | 58 | 59 | 58 |

Ensemble classification succeeds much more often than prose scaffolding. Correctly naming an instruction does not ensure its response respects component-specific disclosure. Brevity remains a weakness in all arms.

## Execution integrity and remaining work

Active execution was **1,695,382 ms (28.26 minutes)** within the 30-minute model-execution budget. [The evidence summary](evidence-summary.json) records 2,381 raw files, 133,992,792 bytes, 2,032 unique HTTP attempts and 5,509,549 reported tokens. Of these attempts, 1,969 returned HTTP 200 and 63 returned HTTP 400: 31 calls against the then-configured incompatible endpoint, 31 missing the provider's literal-JSON instruction requirement, and one provider input-inspection rejection in partial cleanup recovered by the existing production repair path. The 63 rejected calls supplied no token usage. Copied replay targets are deduplicated in these totals.

The user restored the Dashscope configuration and explicitly requested retry. Transport repair added a generic JSON-format instruction. The first failed calibration incorrectly exited zero; the corrected runner exits nonzero for unresolved calibration disagreement or error. All failed snapshots remain unchanged. Three invalid initial secondary outputs recovered with one identical-request retry each. Two invalid full-cleanup primary outputs likewise recovered; `journey_3__cleanup__r2__t4` remains invalid after its one bounded retry and contributes one error to each primary metric in that historical arm. Valid unfavorable judgments were not retried.

Structural verification passed **12/12 tests**: ten harness checks plus two refinement checks. They cover original-room/target preservation, evaluator-reference isolation, prior generated tutor turns, typed judgment/error handling, conditional feedback, private-reason isolation, missing denominators and frozen cleanup behavior. They do not grade response wording. The DOCX SHA-256 is `fd0a0f49106e1b37795886dc39f974c3e99758e0007df5c2b0ba5d730dd6655b`. The initial comparison fingerprint is `e7278367336a5ada2a4b7c268a09f8bd020cf626928b88421b09bfaff452c60a`; full-cleanup freeze hash is `2ed9ccb2965eb8a89863f9c0e32caa2ae6b1c7d1ec6fe2c04f7f79c2cba7edf0`, and recipe hash is `352fac8f279a32df6496b7ad4351c43ce5b9bec15973f5d5b010e99a9d1139e6`. Full rendered requests are retained; the initial source freeze did not enumerate every transitive prompt import.

The focused generation run is complete. The original frozen 100% disclosure criterion fails on independently identified premature answers. Under the user's corrected 80% ordinary-rubric criterion, disclosure conformance remains unresolved within the 75.2%–81.9% audit bounds. Measurement acceptance is incomplete because disclosure calibration failed and real-output boundary errors remain. This experiment has no unseen holdout, full-suite acceptance, cyberbullying behavior coverage or human learning-effect evidence. Runtime prompts were not promoted by this experiment.

The next useful increment is to independently validate the grader's distinction between recognition-only disclosure and action-order violations, then test a narrowly changed remaining direct-teaching example/policy under the same fixed cases. Preserve a separate attempt/confusion gate for each component and learning point. That would require a new frozen measurement/candidate comparison and execution budget; the current results do not justify merging the prompt candidate.

See [README](README.md) for construction/reproduction, [experiment log](experiment_log.md) for exact commands and failures, [independent refinement review](cleanup-full-refinement-review.json) for the final recipe, and the [canonical plan](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-evaluation-plan.md) for priorities and gates.
