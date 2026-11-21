# Evaluation run record: task-label continuity, 2026-11-13

Intent: preserve the evidence and decision for the focused observation-task → behavior-task → next-point comparison.

Updated: 2026-11-13. Source baseline: `297a1b389e99f2843d5cb51e46ef402ae3ae5f50`, with the four pre-existing runtime prompt edits captured in the frozen sources.

Branch: `eval/tutor-stage-scaffolding-20261113`. Preparation, candidate definitions, scoped specifications and execution log checkpoint: `fb5ca91c090aa92a8f7487cf86d5c19ffbcde291`.

## Run outcome

Verdict: labels alone do not resolve unfinished-point switching. Explicit sequencing and clarified completion rules improve same-point continuation in the reviewed cases, but every candidate retains confirmed behavior failures. No candidate is accepted. Execution has closed with one blocked continuation, four invalid targets and one unresolved judge timeout; the comparison remains incomplete for acceptance.

Grounding: resolved under the adopted constitution and T01.1/T02.1/T02.2; see [grounding review](grounding-review.json). The latest user decisions retain the complete original knowledge-point headings, use Qwen3.8-flash for target and judge, keep the tutor non-thinking, permit thinking-enabled judges, and increase subsequent concurrency to 32. The user requested concurrent generation and evaluation; candidate generation therefore proceeded while the last grading annotation was adjudicated.

Refinement integrity: preparation and all 60 cleanup outputs received independent review. The review found evidence-tracking and disclosure failures, plus residual evaluator false passes. This is a focused development experiment, with no claim of human learning gains or broad acceptance.

## Definition and comparison

Canonical sources: [specification](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-specification.md), [response contract](../../../../tutor-system/docs/ai-behaviors/tutor-response-contract.md), and [evaluation plan](../../../../tutor-system/docs/ai-behaviors/tutor-behavior-evaluation-plan.md). The exact text/hashes are preserved inside the frozen snapshots rather than inferred from later working documents.

| Arm | Change | Expected responses |
| --- | --- | --- |
| Current | Frozen current experimental branch prompt | 60 |
| Labels | Replace only `What to notice:` / `What to do:` with `Observation task:` / `Behavior task:` | 60 |
| Sequence | Same labels plus [explicit per-point completion instruction](candidate-sequence.txt) | 60 |
| Completion cleanup | Sequence plus [four task-level completion/progression replacements and an evidence-repair rule](candidate-completion-cleanup.json) | 60 |
| Historical production reference | Exact earlier baseline requests on the nine matching inherited fixed cases | 27 |

All headings, task payloads, point grouping and target-to-status mapping are preserved. The 12 selected fixed cases and two four-turn trajectories receive three repetitions; the 25-case prepared inventory and reasons for selecting 12 remain recorded. Selection occurred before any comparison target output and covers four scenario families. Earlier broader execution plans remain preserved, not represented as executed coverage.

The completion-cleanup arm is a later development refinement, added after observed switches in the original candidates. It changes conflicting generic rules that treated a correct answer or demonstrated “idea” as sufficient to advance, while keeping the sequence arm's other factors fixed. Its additional 60 responses bring the final declared scope to 267. This tests an instruction-consistency hypothesis; it must not be attributed to the label change alone.

Targets use Qwen3.8-flash, temperature 0.3, maximum 600 tokens, `enable_thinking:false`, and JSON-object format. Target prompts and sampling settings are identical between arms except the declared label/instruction factors. The production reference has a smaller matched case set and must not be compared against the full 60-response arms as though coverage were identical. Trajectories retain each arm's own generated tutor messages, so later turns compare controlled journeys rather than identical inputs.

## Result summary

The three metrics are LLM rubrics: observation-before-behavior (`recognition_before_action`), useful continuation and completion (`responsive_progression`), and component-specific answer disclosure (`component_disclosure`). Each retains the declared ≥80% threshold and non-regression requirement, with errors and missing results visible in the frozen denominators. The completion pair has a separate exact-pair check. No classification ensemble is used. These are machine grades, with known semantic disagreements reported below.

| Arm | Observation before behavior | Progression | No premature disclosure | All three |
| --- | --- | --- | --- | --- |
| Current | 54/60 (90%) | 44/60 (73.3%) | 47/60 (78.3%) | 37/60 |
| Labels | 55/60 (91.7%) | 39/60 (65%) | 47/60 (78.3%) | 33/60 |
| Sequence | 57/60 (95%) | 50/60 (83.3%) | 48/60 (80%) | 42/60 |
| Completion cleanup | 54/60 (90%) | 52/60 (86.7%) | 45/60 (75%) | 42/60 |

The [final summary](final-summary.json) contains every declared partition and every paired pass-to-fail ID. On the 36 fixed comparisons, labels introduce four progression regressions against current, sequence introduces two, and cleanup introduces three; the five independently adjudicated false passes understate the latter two counts. Cleanup also introduces three ordering regressions and seven disclosure regressions against current. Three current format failures are unevaluable in these fixed comparisons. Machine completion-pair passage is current 3/3, labels 0/3, sequence 1/3 and cleanup 1/3; independent review rejects every candidate's completed-task replies.

On the matched 27-response historical slice, ordering/progression/disclosure counts are production 20/19/17, current 24/20/17, labels 27/23/21, sequence 27/24/20 and cleanup 24/24/19, all over 27. This slice excludes the newer room boundaries and trajectories, so its gains do not establish overall acceptance.

| Supporting validity check | Saved target responses | Valid responses | Unusable / blocked |
| --- | --- | --- | --- |
| Current | 60/60 | 57/60 | Three wrong-action-attempt responses failed the product format contract after the configured repair |
| Labels | 59/60 | 58/60 | One provider content-inspection refusal; the dependent final turn was not generated |
| Sequence | 60/60 | 60/60 | None observed in target generation |
| Completion cleanup | 60/60 | 60/60 | None observed in target generation |
| Historical reference | 27/27 | 27/27 | None observed in target generation |

The labels-arm provider failure is `journey_3__labels__r2__t3`, HTTP 400 `data_inspection_failed`; turn 4 depends on the unavailable tutor reply. No replacement tutor text or modified input is supplied to complete that trajectory. Current-arm format failures are the three `component_5_action_attempt` repetitions. These validity issues are separate from ordinary behavior failures.

Total coverage is 267 planned, 266 saved and 262 valid targets. There are 798/801 primary judgment records, including 12 propagated target-error entries and three judgments blocked by the missing continuation. A bounded identical-request repair of `journey_5__sequence__r1__t3` progression returned fail; the original timeout remains preserved. A later disclosure timeout on `journey_3__current__r3__t4` remains unevaluable. The remaining 4.12 active minutes could not accommodate the unchanged worst-case two-attempt timeout policy, so no further retry was started.

## Measurement evidence and corrections

The original non-thinking judge calibrated 28/32. An evidence-attribution protocol and explicit handling of structured evidence recovered 29/32, with progression and disclosure calibration passing but ordering still failing. The thinking judge then passed all 32 examples. Its full raw calibration remains available.

A mixed evaluator was initially used for baseline responses to limit runtime. Independent review found false progression passes on actual unfinished-point switches and disclosure disagreements. Final judging therefore uses the same thinking-enabled Qwen3.8-flash configuration for all three metrics, 8,000 tokens, temperature 0. Preserve the mixed results separately. Reuse only exact same-request valid ordering judgments, including unfavorable judgments; regrade all affected progression/disclosure outputs. A judge-only timeout increase from 90 to 180 seconds repairs unresolved operational failures without changing request payloads or resampling target responses.

The seven new observed-error boundaries were independently annotated. One initial disclosure label was corrected after review: the inventory itself includes keeping plans private as part of the behavior answer, so a question prescribing that goal can disclose part of the answer even when it leaves the communication method open. See [adjudication](disclosure-boundary-adjudication.json) and [corrected labels](new-boundary-calibration-labels-v2.json). Preserve the original 6/7 result; reconciliation under corrected reference labels is not a new model call or a model improvement.

## Metric interactions

The three requirements apply jointly to each planned response. Progression/disclosure outcomes joined on the exact same output are:

| Arm | Both pass | Progression only | Disclosure only | Both fail | Unevaluable | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Current | 37 | 6 | 10 | 3 | 4 | 60 |
| Labels | 33 | 6 | 14 | 5 | 2 | 60 |
| Sequence | 42 | 8 | 6 | 4 | 0 | 60 |
| Completion cleanup | 42 | 10 | 3 | 5 | 0 | 60 |

Cleanup improves marginal progression but increases progression-with-disclosure violations from eight to ten versus sequence, leaving three-metric joint success unchanged at 42/60. Ordering/progression both-pass counts are 44, 39, 50 and 52 respectively; ordering-only counts are 10, 16, 7 and 2. The complete cells and partitions are in the final summary. This is an empirical tradeoff with residual evaluator error, not proof that the requirements are incompatible. Joint-success witnesses exist, and a focused question can continue an unfinished behavior without prescribing its answer.

Confirmed baseline examples include all three movie `recognition_done` replies switching to timing before a destination behavior attempt. Five of six second-turn baseline trajectories similarly move from completed observation to another point instead of the corresponding behavior. The address trajectory repetition 2 is counterevidence: it preserves the same-point action opportunity. These are spec-conditioned progression findings, not a claim that discussing timing or consequences is inherently poor teaching.

## Final analysis

The target-switching phenomenon is reproduced in the current branch. Labels alone do not remove it: movie replies ask about `THIS FRIDAY` or `8` before finishing destination behavior. The following are independently reviewed continuity observations, not all-metric pass rates:

| Same-point behavior after demonstrated observation | Current | Labels | Sequence | Completion cleanup |
| --- | --- | --- | --- | --- |
| Movie fixed case | 0/3 | 0/3 | 1/3 | 3/3 |
| Second turn of the two trajectories | 1/6 | 0/6 | 5/6 | 6/6 |

These gains support clarifying task completion versus whole-point completion as a useful intervention. They do not establish that wording is the only cause. Cleanup also embeds the behavior answer in all three movie questions, advances to behavior after a bare `Okay` in all three agreement cases, and still advances before learner-owned observation meaning in all three original-room replays. The completed-task control is another failure: all three candidate arms redundantly retest meaning already demonstrated, each in 3/3 repetitions.

Independent review identified five progression false passes on that completed-task control: sequence repetitions 1 and 3, and all three cleanup repetitions. It also identified a sequence movie disclosure false pass. Preserve these machine grades and report the adjudications separately; the resulting automatic rates are not fully human-corrected rates. The 39/39 reconciled calibration does not establish perfect evaluator accuracy on actual outputs.

The next diagnostic should isolate learner-evidence tracking: distinguish the learner's observation evidence, behavior evidence, and the next unfinished task, including semantically equivalent evidence under overlapping headings. Reuse the bare-agreement and completed-task boundaries as exposed development cases, correct and recalibrate the known judge defects, then compare a frozen candidate on fresh cases. This is a hypothesis for the next iteration, not an implemented or accepted solution.

The experiment tests tutor output under controlled histories. Most cases are exposed synthetic development cases grounded in existing product templates; one room replay is an exposed real record. Scripted learner contributions are not observations of learning. Overlapping curriculum points, a frozen checklist and three repetitions per case limit generalization. The early original-room learner evidence does not establish observation meaning merely by saying `Yes` and `not safe`.

## Acceptance disposition

Grounding is resolved for the focused requirements; conformance is not. Labels fail to fix continuity, sequence retains premature transitions and redundant retesting, and cleanup adds confirmed ordering/disclosure regressions despite its continuity gains. No candidate satisfies the combined acceptance conditions. The exact completion-pair requirement fails under independent review. A favorable aggregate cannot override those failures.

All cases are development evidence, including refinements informed by observed outputs. No unseen holdout result or completed experimental behavior version is claimed. Provider-blocked coverage and format-invalid responses remain explicit gaps. The remaining work is a new evidence-tracking refinement and versioned evaluator repair, followed by a comparable run with complete coverage.

## Evidence

- [Experiment log](experiment_log.md): exact commands, timing, changed factors, partial failures and results.
- [Candidate instruction](candidate-sequence.txt): the unchanged tested sequencing addition.
- [Final V12 preparation](preparation-v12.json) and [preparation index](preparation-index.json): final frozen scope and hashes of all locally retained earlier versions.
- [Independent output review](independent-output-review-completion-cleanup.json): continuity observations, regressions and adjudicated evaluator disagreements.
- [Observed-error calibration](new-boundary-calibration.json): original independently annotated boundaries, retained with the later correction above.
- [Final summary](final-summary.json): aggregate scores, partitions, interactions, paired transitions, calibration provenance and hashed detailed evidence.
- [Evidence index](evidence-index.json): independently rehashed manifest of 1,543 locally retained raw files, totaling 181,643,591 bytes.
- `raw/`: frozen source/request snapshots, target attempts, full generated conversations, raw/parsed judge outputs, command streams and budget accounting; retained locally under this experiment directory.

Recorded active execution used 55.883 minutes by the union of overlapping intervals; the sum of process durations was 88.035 minutes. Concurrent phases shared a ceiling of 32 calls. The tutor used non-thinking Qwen3.8-flash throughout; final judges used thinking. Eight structural harness tests passed, including exact heading/task preservation, actual conversation history and the 32/33-worker boundary. The optional JavaScript type check failed with seven diagnostics in the frozen experiment runner and one historical provider typing diagnostic; the new postprocessing helpers had none. This is not a clean static-check result.

After execution, a separate local trial changed runtime sources. Frozen requests and outputs remain authoritative; postprocessing verifies the frozen content and evaluator helpers while recording subsequent workspace drift. The newly reported gift-card room is preserved as separate follow-up evidence in [independent manual-room review](independent-manual-room-review.json). Its findings motivate a new contextual-completion spec/rubric revision and do not retroactively change this run's labels or rates.
