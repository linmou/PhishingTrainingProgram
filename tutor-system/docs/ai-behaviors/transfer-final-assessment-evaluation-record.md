# Final assessment routing evaluation — 2026-10-13

Intent: record the executed comparison of the previous assessment trigger with the approved Partial-only final-assessment trigger, including unchanged model failures and downstream consequences.

Run: `final-assessment-comparison-01`; executed 2026-10-13 23:25:39–23:26:32 UTC. Git base: `7737cfb7026910e53684c6ad739c2f3005af3f54`, plus the exact working-tree handler, reducer, requirements, and harness snapshots in the [frozen package](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/frozen.json). Authority: [T09.1](tutor-behavior-specification.md#t09-transfer-assessment-and-verification-lifecycle) and the [approved policy provenance](../doc_update_record/documentation_update_record_v2026_10_13_final_assessment_provenance.md). Plan: [revision checks](transfer-analysis-evaluation-plan.md#final-assessment-revision-checks).

## Outcome

**Final source decision: retain the original analysis prompt.** Two bounded prompt clarifications were evaluated and rejected for newly observed regressions; the original prompt was restored and exact equality verified. The scheduling implementation remains the approved Partial-only change. The spontaneous-transfer classification defect described below remains unresolved and must not be presented as fixed by the scheduling change.

The revised route matches the approved timing in **118/122 generations**, compared with **96/122** for the old route on the same model outputs. The full benchmark **failed**: event classification, safety, validity, pair checks, and transfer-partition non-regression do not all pass. This is a completed diagnostic evaluation, not an accepted model-quality or deployment verdict.

The decisive policy cases passed: identical complete answers from Pending bypass assessment, while answers from Partial make assessment due. A material residual remains: the unchanged model sometimes calls spontaneous transfer `demonstrated_understanding`; under the new trigger that can produce an unnecessary assessment. Both repetitions of independent case N05 show this newly failing routing consequence.

The exact timing policy and its upstream grounding are human-approved. Individual semantic gold labels remain pending human review; that limitation applies to the classification benchmark, not to adoption of the Partial-only rule. Hosted database and browser release verification are outside this model comparison; local integrated lifecycle checks are recorded with the implementation evidence.

## Comparison and coverage

The analysis prompt, model, and request settings were unchanged. A fresh model response was obtained for every case/repetition, then replayed through both the frozen production handler and the working-tree candidate handler. Request equality and resulting analysis-state equality were enforced. Only the deterministic routing policy differed. Both routes were scored against the same revised expectation, so the gain measures alignment with the newly approved policy rather than improved model understanding.

The frozen manifest contains 61 cases with two repetitions each: 20 ecological, 10 development, 16 previously exposed holdouts retained as regression, five sequential turns, four new development boundaries, and six independently authored holdouts. The independent author read only constitution/specification/contract; the candidate was frozen before outputs were inspected. Controlled pairs keep instructional words and history identical while changing Pending versus Partial, apart from opaque case identifiers. The five-turn sequence propagates actual observed state. Every retained case preserves its event, state, flags, and validity assertions; its routing assertion is explicitly revised in the applicability audit. No historical run was overwritten.

Settings: `qwen3.5-flash`, temperature 0, 600 output tokens, thinking disabled, JSON-object output, no seed, one attempt per generation, four workers. Endpoint: DashScope international compatible API. Usage: 192,978 prompt tokens and 19,645 completion tokens. All 122 generations completed with no missing results or provider HTTP failures. Two model outputs had invalid evidence IDs and were rejected by the handler.

All metrics use frozen gold-label or state comparisons. Free-text explanation quality was not scored; no LLM judge or wording matcher was substituted. The existing 80% behavior thresholds, 100% safety/validity/pair gates, per-suite/per-partition checks, and zero-error requirement were retained. Ten harness tests passed before freezing, covering valid and invalid handler consumption, state propagation, missing-result gates, exact trigger boundaries, and paired route comparison.

## Results

Fractions retain unevaluable results in the denominator. The complete per-partition results, deltas, failures, and expected/actual values are in the [machine-readable report](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/summary-1791933992619.json).

| Metric / deterministic method | Baseline | Candidate | Errors / missing | Threshold | Verdict |
| --- | --- | --- | --- | --- | --- |
| Event label | 89/122 | 89/122 | 0 / 0 | 80% | fail |
| Applied progress state | 93/122 | 93/122 | 2 / 0 | 80% | incomplete; rate also below threshold |
| Protection/correction flags | 114/122 | 114/122 | 2 / 0 | 100% | incomplete |
| Assessment route | 96/122 | 118/122 | 2 / 0 | 80% plus partition non-regression | incomplete; transfer partition regresses |
| Validity | 120/122 | 120/122 | 0 / 0 | 100% | fail |

| Route slice | Baseline | Candidate | Interpretation |
| --- | --- | --- | --- |
| Ecological | 32/40 | 38/40 | Removes premature checks; two invalid outputs remain unevaluable. |
| Development | 16/20 | 20/20 | New timing satisfied. |
| Exposed holdout regression | 28/32 | 32/32 | New timing satisfied despite separate classification failures. |
| Stateful sequence | 6/10 | 10/10 | Routing matches, while missed contradiction/repair still breaks progress. |
| New development boundaries | 4/8 | 8/8 | Pending bypass and Partial final check both pass. |
| Independent holdouts | 10/12 | 10/12 | N02 improves; N05 regresses. Aggregate equality does not hide either. |
| Transfer partition | 10/10 | 8/10 | Two new false-positive assessments in N05; non-regression fails. |

Candidate semantic pairs passed 10/12 pair-repetition checks. The two failures are historical HP02 (current-situation understanding versus spontaneous transfer), one in each repetition. Both newly added prior-state pairs pass both repetitions. No classification/state/flag/validity score changed between baseline and candidate because both consumed the same outputs; this is measurement control, not evidence that those behaviors now satisfy requirements.

## Metric interactions and failure disposition

These checks join identical case/version/repetition/generation records. A = applied progress state; B = assessment route. All rows include invalid output in the denominator.

| Variant / scope | Both pass | A only | B only | Both fail | Unevaluable | N |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline / all cases | 73 | 20 | 23 | 4 | 2 | 122 |
| Candidate / all cases | 91 | 2 | 27 | 0 | 2 | 122 |
| Baseline / independent holdouts | 7 | 2 | 3 | 0 | 0 | 12 |
| Candidate / independent holdouts | 7 | 2 | 3 | 0 | 0 | 12 |

Equal holdout joint counts represent different case identities: N02 moves from state-only to both-pass, while N05 moves from both-pass to state-only. Event label versus state is also preserved in the report: 87 both-pass, two event-only, six state-only, 25 both-fail, and two unevaluable across 122 generations. A correct final state can therefore conceal the wrong event and wrong assessment decision.

- **Confirmed routing gain:** [F02](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/generations/F02-r0.json), [N02](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/generations/N02-r0.json), and S02 reach Covered from Partial and become due under the candidate. Their Pending counterparts complete without a quiz. These are joint-success witnesses for the approved distinction.
- **New downstream regression:** [N05](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/generations/N05-r0.json) applies independent verification to a physical concert poster after payroll-email tutoring. Both repetitions emit `demonstrated_understanding` instead of gold `spontaneous_transfer`. Both variants reach the correct covered pair, but only the candidate schedules an unwanted assessment. This is an observed dependency on incorrect event classification, not a prompt tradeoff or an incompatible requirement. The model's new-context explanation supports review of the incorrect event choice; no semantic text score was assigned.
- **Existing recovery errors remain:** [N04](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/generations/N04-r0.json), H11, and other review cases choose full understanding instead of repair. The handler rejects the transition, so Review persists. S03/S04 similarly expose missed contradiction and propagated recovery failure.
- **Flags can be wrong despite correct deferral:** [N06](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/generations/N06-r0.json) sets correction instead of protection for the unsafe intention. Assessment is deferred either way, so a passing route is insufficient evidence of correct safety classification. Both repetitions fail flags; the second also suppresses the target event.
- **Validity and type mismatches persist:** E01 corrupts its evidence message ID in both repetitions, leaving dependent checks unevaluable. E18 still loses action evidence because its stored item type is `detection_area`. Neither is repaired by a scheduling change.

These failures are not waived by the aggregate routing improvement. No new constitutional conflict was identified. The implemented timing is supported by the boundary cases; reliable application of its spontaneous-transfer exception still depends on classifier quality. Reviewing the named labels and separately testing a classification improvement is the next model-quality action. The new holdouts are now exposed and require replacements if used for tuning.

## Prompt refinement experiment 1

Run `final-assessment-prompt-01` completed at 2026-10-13 23:32:27–23:34:29 UTC. It tested one added context-comparison paragraph before choosing the full-coverage kind. Both baseline and candidate used the revised Partial-only route; they received separate fresh model calls on the same 67 cases, two repetitions each (268 calls). The original six holdouts became regression material and six independently authored replacements were frozen before evaluation. Model, sampling, output limit, response contract, labels, and thresholds were unchanged. Each variant propagated its own observed sequence state.

**Candidate 1 was rejected.** It corrected N05 in both repetitions and improved overall event classification, but introduced coverage and safety-routing regressions. The full-understanding partition fell from 38/42 to 34/42 event matches; ecological event matches fell from 31/40 to 29/40. Safety routing fell from 6/8 to 4/8. Those regressions cannot be waived by aggregate improvements.

| Metric | Matched baseline | Candidate 1 | Candidate errors / missing |
| --- | --- | --- | --- |
| Event label | 94/134 | 112/134 | 0 / 0 |
| Applied state | 100/134 | 111/134 | 0 / 0 |
| Safety flags | 125/134 | 124/134 | 0 / 0 |
| Assessment route | 125/134 | 130/134 | 0 / 0 |
| Validity | 133/134 | 134/134 | 0 / 0 |

New failures included E05 and E15 being downgraded from full understanding to initial evidence in both repetitions, H16 losing the protection flag in both repetitions, and N06 losing its assessment blocker in both repetitions. H14 also regressed on contradiction/state in repetition 1. N06 and R06 produced false-positive assessment eligibility; R06 was already wrong in the matched baseline, while N06 was a new routing regression. The candidate passed 13/14 semantic pair-repetition checks but failed required safety and partition/non-regression gates. Baseline output validity left one dependent observation unevaluable; candidate validity was complete. No generations were missing.

Joint applied-state/routing outcomes were 94 both-pass, six state-only, 31 route-only, two both-fail, and one unevaluable for baseline; candidate outcomes were 107 both-pass, four state-only, 23 route-only, zero both-fail, and zero unevaluable (N=134 each). Thus improved joint totals still concealed new safety failures. This is observed prompt sensitivity; it does not demonstrate incompatible requirements or establish the exact cause of the collateral change.

Evidence: [frozen package](../../../output/transfer-analysis-eval-20261013/final-assessment-prompt-01/frozen.json), [all paired input/output records](../../../output/transfer-analysis-eval-20261013/final-assessment-prompt-01/generations/), [summary with every new failure](../../../output/transfer-analysis-eval-20261013/final-assessment-prompt-01/summary-1791934469743.json), and [execution metadata](../../../output/transfer-analysis-eval-20261013/final-assessment-prompt-01/execution-1791934469655.json). Usage across both variants: 437,312 prompt tokens and 44,388 completion tokens. The preserved candidate prompt is experimental evidence, not an approved replacement. This result motivated the shorter second clarification below, retaining all failures as regression cases.

## Prompt refinement experiment 2 and final disposition

Run `final-assessment-prompt-02` completed at 2026-10-13 23:36:07–23:38:15 UTC. It tested a shorter event-kind clarification after sufficiency and current-state instructions, explicitly preserving the target's evidence threshold and independent safety decisions. The full previous set was retained; six further independent holdouts brought the manifest to 73 cases. Each variant ran twice per case, for 292 fresh model calls with unchanged settings and checks. Previously exposed holdouts remained regression material.

**Candidate 2 was rejected and the original prompt restored.** It did not correct N05 in either repetition. Overall event matches declined from 105/146 to 98/146 and applied-state matches from 112/146 to 104/146. A small aggregate route improvement did not satisfy the partition regression gates or the targeted fix.

| Metric | Matched baseline | Candidate 2 | Candidate errors / missing |
| --- | --- | --- | --- |
| Event label | 105/146 | 98/146 | 1 / 0 |
| Applied state | 112/146 | 104/146 | 1 / 0 |
| Safety flags | 135/146 | 136/146 | 1 / 0 |
| Assessment route | 135/146 | 137/146 | 1 / 0 |
| Validity | 145/146 | 145/146 | 0 / 0 |

All newly failing case/check combinations are preserved in the summary. They include E01 repetition 0 (event/state), H02 repetition 0 (initial evidence lost), H03 repetition 0 (unsupported full understanding and assessment), N06 repetition 1 and R06 both repetitions (target evidence suppressed), S01 both repetitions (initial evidence lost), S02 both repetitions (the propagated state skips the intended final check), S03 repetition 0 (contradiction lost), and V06 (truncated output in repetition 0 and target evidence lost in repetition 1). N05 and R02 continue to produce a quiz-triggering full-understanding event instead of spontaneous transfer in both repetitions. V06's truncated generation was preserved as `AI_OUTPUT_TRUNCATED`; it was not resampled or omitted. There were no missing generations.

Applied-state/routing joint outcomes were 103 both-pass, nine state-only, 32 route-only, one both-fail, and one unevaluable for baseline; candidate outcomes were 98 both-pass, six state-only, 39 route-only, two both-fail, and one unevaluable (N=146 each). Candidate pairs passed 10/16. These results show why route accuracy alone cannot establish correct progress: withholding an assessment can match the routing label even when learner evidence was wrongly discarded. This supports rejecting the prompt change, not broadening the scheduling task into unrelated analysis redesign.

Evidence: [frozen package](../../../output/transfer-analysis-eval-20261013/final-assessment-prompt-02/frozen.json), [complete paired input/output records](../../../output/transfer-analysis-eval-20261013/final-assessment-prompt-02/generations/), [summary and regression inventory](../../../output/transfer-analysis-eval-20261013/final-assessment-prompt-02/summary-1791934695298.json), and [execution metadata](../../../output/transfer-analysis-eval-20261013/final-assessment-prompt-02/execution-1791934695216.json). Usage across both variants: 462,822 prompt tokens and 48,770 completion tokens. The implementation's final Deno API/handler integration rerun passed 41 checks after restoring the original prompt; see the separate [implementation validation evidence](../../../output/final-assessment-implementation-20261013/validation.md).

Across the three experiments, 682 provider calls completed and 402 paired case/repetition records were retained. The next model-quality work requires reviewed labels and a separately scoped classification refinement; all holdouts used here are now exposed. The deterministic scheduling change is locally verified, while broad model benchmark acceptance and hosted release verification remain unsatisfied.

## Evidence and reproduction

- [Frozen manifest and source snapshots](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/frozen.json): full inputs/history/prior states, gold labels and rationales, provenance, requirement mappings, settings, baseline/candidate sources, Git revision and worktree status, and preserved-case audit.
- [Per-generation records](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/generations/): complete provider requests/responses and usage, parsed/validated outputs, rejection details, paired consumer results, and typed expected/actual checks.
- [Execution metadata](../../../output/transfer-analysis-eval-20261013/final-assessment-comparison-01/execution-1791933992550.json): command, endpoint without credentials, timestamps, workers, and exit code 0.
- [Independent case provenance](../../../evals/promptfoo/transfer-analysis/final-assessment-holdouts.json), [new boundary cases](../../../evals/promptfoo/transfer-analysis/final-assessment-cases.json), [runner](../../../evals/promptfoo/transfer-analysis/evaluate.cjs), and [harness checks](../../../evals/promptfoo/transfer-analysis/evaluate.test.cjs).

Commands from repository root:

```sh
rtk proxy node --test evals/promptfoo/transfer-analysis/evaluate.test.cjs
rtk proxy node evals/promptfoo/transfer-analysis/evaluate.cjs freeze output/transfer-analysis-eval-20261013/final-assessment-comparison-01
rtk proxy node evals/promptfoo/transfer-analysis/evaluate.cjs run output/transfer-analysis-eval-20261013/final-assessment-comparison-01 --num_workers 4
```

Freeze requires a new directory. Run resumes preserved generations without resampling completed successes or failures, and rejects runner drift. Outputs remain outside Git; this tracked record preserves the executed conclusion and exact local evidence paths. The historical [baseline record](transfer-analysis-evaluation-record.md) retains its original policy and results.

The prompt experiments used these additional commands with their candidate source restored before freezing:

```sh
rtk proxy node evals/promptfoo/transfer-analysis/evaluate.cjs freeze output/transfer-analysis-eval-20261013/final-assessment-prompt-01 --comparison prompt
rtk proxy node evals/promptfoo/transfer-analysis/evaluate.cjs run output/transfer-analysis-eval-20261013/final-assessment-prompt-01 --num_workers 4
rtk proxy node evals/promptfoo/transfer-analysis/evaluate.cjs freeze output/transfer-analysis-eval-20261013/final-assessment-prompt-02 --comparison prompt --fresh_holdouts final-assessment-refinement-holdouts-v2.json
rtk proxy node evals/promptfoo/transfer-analysis/evaluate.cjs run output/transfer-analysis-eval-20261013/final-assessment-prompt-02 --num_workers 4
```

Each frozen package includes the exact runner and candidate source. Use those snapshots for reproduction: the final working tree intentionally retains the original production prompt, not either rejected candidate.
