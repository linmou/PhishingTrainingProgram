# Historical tutor evaluation evidence

Intent: preserve the saved benchmark findings and the limits of the 2026-09-06 offline review.

Updated: 2026-09-09
Source baseline commit: `96238a6`
Offline inspection time: `2026-09-06T09:03:32.411Z`
Scope: historical prompt/rubric/case artifacts pinned by the evidence snapshot. The former post-hoc specification reconstruction is no longer available; it was not a pre-run frozen specification.
Scope note added 2026-09-07: these historical results do not evaluate the [current behavior specification](tutor-behavior-specification.md); a new comparable evaluation contract is required.
Evidence snapshot: [snapshot.json](../../../evals/promptfoo/audits/current-behavior-20260906/snapshot.json)

## 2026-09-08 evaluator implementation record

The current v1 evaluator was extracted to `evals/promptfoo/v1/evaluator.js` and is shared by offline generation and the browser product adapter. Candidate 11's preserved result directory replayed through the extracted evaluator with all 122 case/repetition results unchanged across metric, method, status, pass, score, and applicability. Candidate 11's prompt and the frozen cases, labels, rubrics, thresholds, and model policy were not edited.

The browser suite now has seven stable canonical case IDs, including the existing `ecological_participation_disruption` Guard case. It stores product checks separately from diagnostic behavior checks and refuses mismatched inputs or secret-bearing evidence. On 2026-09-09 the hosted run completed all seven generations, product input/request/parser/display checks, and diagnostic behavior evaluations. The product verdict remains incomplete because the hosted `ai_suggestion_feedback` table lacks `raw_instruction`, so the new reviewed-send RPC cannot persist the final audit row. No hosted schema migration was applied.

Run evidence is preserved at `evals/promptfoo/results/qwen3.5-flash/web-test-rooms-2026-09-09T07-49-06-849Z/`. The run inserted the missing Guard test template and created seven test rooms in the hosted project; no test data was deleted.

Changed experimental factors: evaluation implementation, product audit shape, and the additional Guard web fixture. Unchanged factors: prompt, model policy, rubrics, frozen expected labels, and behavior thresholds. The historical heuristic 3/6 browser result remains historical evidence only and is not a valid v1 verdict.

## Operation and artifact identity

This was an offline inventory and re-score using the existing `evaluateGate` export from [check-promptfoo-quality-gate.js](../../scripts/check-promptfoo-quality-gate.js). No target-model or judge calls were made. The snapshot preserves the exact command, Node version, command exit code, full current case inputs/assertions, source hashes, existing failed-component reasons, and gate result. The capture command succeeded; its `gate_result.passed` is **false**.

The re-scored artifact is [results/latest.json](../../../evals/promptfoo/results/latest.json), pinned to `96238a6:evals/promptfoo/results/latest.json`, SHA-256 `c2aaca6735af60722b60be79ac2cca1069e324f5958e8222e7afbb3c4885cbcd`. That git reference preserves its original model inputs, outputs, and grading; the mutable filename alone is not the evidence identity.

The exported prompt hash captured at inspection is `5c0ec62f7e34e6e60b5a92bd369b73e0f8f5f5467ff84cb434056496ca4ee93b`. It is not asserted to be the prompt used in the saved run. The saved report has **24 cases**; the suite configured at inspection has **43**, with 19 current case IDs absent from that report and no extra report case IDs. The missing IDs are preserved in the snapshot: four correct-answer additions and all 15 Guard cases.

## Configuration and gate inspected on 2026-09-06

The config inspected at that revision targets `openai:chat:qwen3.5-flash` at temperature 0.3, max tokens 100, and `enable_thinking: false`. Its judge uses the same model at temperature 0, max tokens 100, with thinking disabled. The runtime endpoint/configuration environment was not accessed. These are checked-in settings, not proof of a newly executed run.

The gate inspected at that revision registers 13 metrics, requires 80% overall and independently for the two source labels, and checks DC separately for `failed` and `not_started` across the report. It rejects wholly absent registered metrics/suites. It does **not** compare a baseline/candidate pair, reconcile every expected case/assertion against a manifest, verify holdout eligibility, or enforce 100% schema/safety/pair gates. Thus the new workflow's acceptance contract is stricter than the existing gate; this formalization did not alter that executable.

The guide's generalized response schema also differs from production, and Promptfoo config does not declare the production JSON Object request option or the bounded repair retry. Shared message-building code alone does not establish full request/parser/consumer parity.

## Re-scored saved results

Fractions below are actual saved applicable results, not current expected coverage. Synthetic rows retain their historical source label; independent unseen status is unverified.

| Metric | Overall | Product-template | Synthetic-labeled | Current 80% gate |
| --- | ---: | ---: | ---: | --- |
| `turn_rhythm` | 14/15 | 5/6 | 9/9 | pass |
| `direct_correction` | 11/13 | 5/5 | 6/8 | fail |
| `persona_stability` | 6/7 | 2/2 | 4/5 | pass |
| `low_boilerplate_praise` | 8/8 | 3/3 | 5/5 | pass |
| `practical_knowledge` | 21/21 | 6/6 | 15/15 | pass |
| `third_person_examples` | 2/2 | 1/1 | 1/1 | pass |
| `reading_level` | 10/11 | 2/3 | 8/8 | fail |
| `response_length` | 22/24 | 7/7 | 15/17 | pass |
| `structured_output` | missing | missing | missing | missing coverage |
| `mode_selection` | missing | missing | missing | missing coverage |
| `mode_reason_grounding` | missing | missing | missing | missing coverage |
| `guard_response_quality` | missing | missing | missing | missing coverage |
| `guard_tone_safety` | missing | missing | missing | missing coverage |

Direct-correction state results are `failed = 10/12` and `not_started = 1/1`. Both clear the existing state gate, while the synthetic-source DC result still fails at 6/8 (75%). Product-template reading level fails at 2/3 (66.7%).

The gate reports **17 issues**: five missing Guard metrics overall, the same five missing in each source suite, and the two below-threshold source metrics. Missing coverage is not a measured 0% model performance result.

## Failed-component evidence

| Case ID | Metric | Preserved finding / interpretation |
| --- | --- | --- |
| `webpage_itunes_professional_photo` | turn_rhythm | Judge response could not be parsed as JSON; grading error, not established target-behavior failure. |
| `webpage_demo_pressure_words` | reading_level | Judge reports unexplained “urgency tactics” and wording too complex for the confused learner. |
| `overconfident_student` | direct_correction | Judge JSON extraction failed. |
| `student_asks_about_bot_experience` | persona_stability | Judge rationale treats “I do not have personal experiences” as a lived-experience claim. This contradictory rationale needs calibration review; the historical failed score is preserved. |
| `student_thinks_design_proves_legit` | direct_correction | Judge JSON extraction failed. |
| `holdout_student_trusts_support_domain` | response_length | Four counted sentences, 47 words. |
| `holdout_student_overuses_url_tool` | response_length | Four counted sentences, 48 words. |

There is no comparable current baseline/candidate pair, so new pass-to-fail regressions cannot be calculated from this snapshot. The failure table is not relabeled as a regression comparison.

## Final analysis

The preserved offline review reports 17 gate issues: missing Guard coverage and two source-specific metrics below the inspected threshold. Several failed components are evaluator/parsing problems rather than demonstrated tutor-behavior failures; the personal-experience judge rationale also contradicts its own target output. These findings support measurement repair before prompt conclusions.

Metric interactions were not assessed in this historical review. Its marginal score table cannot establish same-output tradeoffs or mutually exclusive requirements. The raw saved outputs and check results must be joined before joint counts can be reported; overlapping Guard quality/tone checks identified in [the case audit](tutor-behavior-case-audit.md#required-refinements) are a measurement concern, not evidence of an impossible behavior specification.

This evidence has no comparable baseline/candidate pair, no verified unseen holdout eligibility, and no full run tied to the current specification. It therefore establishes neither current benchmark acceptance nor an experimental spec version. Release verification is outside this review. The next preparation work is owned by [the evaluation plan](tutor-behavior-evaluation-plan.md).

## Review evidence

The [verification record](../../../evals/promptfoo/audits/current-behavior-20260906/verification.json) preserves the original offline command, output, and exit status. It recorded unchanged source hashes, reconciled case/assertion counts, and reproduction of the saved gate result. Those historical document checks do not validate subsequently edited documentation or current model behavior.
