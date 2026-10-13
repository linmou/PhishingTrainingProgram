# Transfer analysis baseline evaluation — 2026-10-13

Intent: report how the unchanged production analysis prompt classifies learner evidence against a frozen gold-label dataset.

Run ID: `baseline-01` under `output/transfer-analysis-eval-20261013/`. Executed 2026-10-13 12:31:35–12:32:19 UTC. Source revision: `6c5e7c0b7f5086746d0452bf685b9ed2d068048d`, plus the evaluation artifacts recorded in the freeze. Production source: Supabase project `zgbufaxooqxeabewktzd`, Edge `assessment-api` version 9, retrieved read-only through MCP.

## Outcome

The baseline failed the proposed gold-label benchmark: **71/102 event labels matched (69.6%)**, below the predeclared 80% threshold. All 102 requested generations completed. Human review of individual gold labels remains pending, so these are diagnostic benchmark results, not a final accepted accuracy estimate. The adopted constitution and TA01–TA05 grounding are resolved; release verification is outside scope.

The prompt reliably handled many clear no-evidence and direct-understanding examples, but repeatedly missed contradictions and confused transfer with direct understanding. Those errors can retain incorrect coverage or prevent valid recovery. Some production-style failures can create unnecessary assessment eligibility, although no live room-routing frequency was measured.

## Experiment definition

The user requested classification against correct answers on 2026-10-13. Every metric uses deterministic comparison with frozen gold labels. No model judge was called. The earlier draft grounding rubric is unused. Free-text explanation quality is examined diagnostically, not assigned a hidden score.

- Surveyed **73 learner messages from 10 production rooms** across six scenario families. The ecological slice replays 20 message–target combinations from seven of those rooms, retaining learner spelling and complete prior dialogue. Recent QA/demo rooms were excluded.
- Added 10 synthetic cases informed by those conversational patterns and a five-turn stateful sequence.
- An independent agent authored 16 holdouts from the spec/contract/constitution only, without seeing the target prompt or development dialogue. After this baseline their content is exposed and must become regression material if used to tune the prompt.
- Two repetitions for each of 51 cases; no seed, resampling, semantic retries, or selected-best results.
- Target settings: Qwen3.5-Flash, temperature 0, 600-token limit, thinking disabled, JSON object output. Provider endpoint: DashScope international compatible API. Four concurrent workers.
- The frozen production handler constructs requests and applies validation/filtering. Its bundled progress reducer applies the resulting events. SQL eligibility is projected for one target with other lifecycle blockers held false; the live SQL definition is pinned. This is an isolated consequence check, not a live database or browser evaluation.
- The five-turn sequence propagates actual observed state, so later errors can be consequences of earlier errors. Each step uses case-specific opaque identifiers; the target text and meaning remain constant. State-level attribution is reported separately from isolated classifications.
- Provider-reported usage: **166,024 prompt tokens; 16,363 completion tokens**.
- Production messages are historical; exported target states are replay inputs, not reconstructed original call state. Several legacy targets have mismatched semantic text and stored type. They were preserved.

Frozen authority: [constitution and spec snapshots, full inputs, gold labels, settings, hashes, and audit](../../../output/transfer-analysis-eval-20261013/baseline-01/frozen.json). Behavior: [TA01–TA05](tutor-behavior-specification.md#t02-analysis-responsibilities). Contract: [transfer status](transfer-status-response-contract.md). Plan: [evaluation plan](transfer-analysis-evaluation-plan.md).

## Scores

Errors remain in every expected denominator. `applied_state` and `assessment_route` are distinct consumer consequences of the same target generation, not extra independent samples.

| Metric / method | Passed / expected | Errors / missing | Threshold | Gate |
| --- | --- | --- | --- | --- |
| raw_event / deterministic | 71/102 (69.6%) | 0 / 0 | 80% | fail |
| applied_state / deterministic | 73/102 (71.6%) | 2 / 0 | 80% | incomplete |
| safety_flags / deterministic | 96/102 (94.1%) | 2 / 0 | 100% | incomplete |
| assessment_route / deterministic | 91/102 (89.2%) | 2 / 0 | 80% | incomplete |
| validity / deterministic | 100/102 (98.0%) | 0 / 0 | 100% | fail |

| Event-label slice | Passed / expected | Accuracy | Gate |
| --- | --- | --- | --- |
| ecological | 31/40 | 77.5% | fail |
| development | 16/20 | 80.0% | pass |
| holdout | 20/32 | 62.5% | fail |
| sequence | 4/10 | 40.0% | fail |

The full proposed gate fails: raw-label accuracy, several partitions, validity, and semantic pairs fail. Supporting validity rejects two E01 generations because the model corrupts the evidence-message ID. These are model-output/consumer validity failures, not transport errors. There were no missing generations or provider HTTP failures.

Class-level confusion, grouped by expected label (rather than case partition):

| Gold class | Correct / expected | Other predicted classes |
| --- | --- | --- |
| none | 35/42 | demonstrated_understanding: 4; initial_signal: 3 |
| demonstrated_understanding | 24/30 | initial_signal: 4; none: 2 |
| initial_signal | 8/8 | none |
| contradiction | 2/8 | none: 6 |
| post_repair_signal | 2/6 | demonstrated_understanding: 2; none: 2 |
| spontaneous_transfer | 0/8 | demonstrated_understanding: 6; none: 2 |

Semantic pairs: **4/8 pair-repetition checks passed**. Both development pairs passed both repetitions; both independent holdout pairs failed both repetitions. Pair HP01 holds the incomplete learner answer constant and changes prior state from pending to partial; HP02 contrasts current-situation explanation with new-situation transfer. The source of failure is preserved per member. No thresholds were changed after observing results.

No baseline/candidate non-regression comparison applies: this is an unchanged-prompt baseline. Historical tutor-response and assessment-output assertions use different contracts and remain untouched. The frozen applicability audit accounts for 62 existing cases across the inspected inventories and retains their assertion data.

## Material findings

1. **Transfer is consistently confused with direct understanding.** D08, H10, and H12 return `demonstrated_understanding` instead of `spontaneous_transfer` in both repetitions. In the two review-state cases, the production handler rejects that event as an ineligible transition, leaving the target in review. H10 still becomes covered, but records the wrong evidence category. The sequence's S05 receives no event because earlier errors left it covered; that is a propagated failure, not an independent transfer trial.
2. **Contradictions can be recognized in prose but omitted from events.** D06 and S03 explain the learner's misconception and set correction, yet emit no contradiction. The target incorrectly stays covered. H14 also omits contradiction. H13 is a counterexample that correctly reopens covered progress, so this is observed inconsistency, not proof the rules are impossible to satisfy.
3. **Unrelated actions can create partial progress.** In E20, “Check the account for suspicious posts” is credited toward “Regularly check who can see your posts.” The production history makes clear that the learner is inspecting a suspicious sender, not their own privacy settings. Both repetitions create partial progress and assessment eligibility. E09 credits vague “proper investigations” in one repetition despite the target requiring specific profile checks.
4. **A short sufficient response can be undercredited.** E08's “It is way too cheap...they can't sell their product that cheap.” receives `initial_signal` in both repetitions. Under the proposed gold label, this satisfies the narrow implausible-pricing recognition target and should cover it. This is a priority label for human review because the target text is terse and the message follows tutor scaffolding. Clear full-mechanism cases D02/D04 and concise ecological explanations E03/E17 pass, which limits any claim that all short answers fail.
5. **Typing can discard a correct classification.** E18 correctly emits full understanding of using a group chat for private coordination. The stored item is `detection_area` although its text starts `[behavior]`; the handler rejects action evidence. This is a consumer/configuration mismatch, distinct from a prompt classification error.
6. **Protection and correction are not interchangeable.** D10 and H14 fail to set protection for explicit unsafe-click advice; correction alone is set. H16 does set protection but suppresses separately valid price-recognition evidence. The spec requires independent decisions. Whether D10 also permits correction is a label-review question, but missing protection is a failure under either interpretation.
7. **Evidence identifiers matter with realistic inputs.** E01 mixes UUID components between the message and target in both generations. The handler rejects the output. Synthetic cases use shorter opaque IDs, so source slices differ in identifier complexity as well as dialogue realism; no causal claim is made that wording alone explains their score difference.

## Metric interactions

A = raw event label; B = applied semantic state. Counts join the same case/version/repetition/generation and include errors.

| Suite | Both pass | A pass / B fail | A fail / B pass | Both fail | Unevaluable | Expected N |
| --- | --- | --- | --- | --- | --- | --- |
| ecological | 29 | 2 | 0 | 7 | 2 | 40 |
| development | 16 | 0 | 0 | 4 | 0 | 20 |
| holdout | 20 | 0 | 2 | 10 | 0 | 32 |
| sequence | 4 | 0 | 2 | 4 | 0 | 10 |

The ecological raw-only passes are E18's two type-filtering losses. The holdout applied-only passes are H10: wrong event kind still reaches covered. The sequence applied-only passes are S05: an earlier missed contradiction left covered in place, so the final state happens to match while the event path is wrong. A state-only score would conceal those failures. E01 supplies both unevaluable ecological observations.

The full-understanding partition has 26/30 event-label matches, 24/30 applied-state passes, and 26/30 projected-route passes, with two validity errors. The route projection records five false-positive assessment decisions overall: E08 twice, E20 twice, and E09 once. It records four false-negative decisions: H11 twice and S04 twice; E01's two route decisions are unevaluable. These consequences are conditional on the isolated-target fixture and gold labels, not measured production incidence.

Classification versus consumer disagreement is directly observed. A causal prompt tradeoff was not tested. Legacy typing is a concrete contract/configuration incompatibility at the consumer boundary; the general educational requirements themselves are not shown to be contradictory. The transfer/repair and partial/full boundaries warrant label review, especially H03 and E08. Any label revision requires a new manifest/version and a comparable baseline; this frozen run remains unchanged.

## Failure inventory

Every case with any failed or unevaluable check is listed. Each link opens repetition 0; the adjacent repetition 1 file is retained in the same directory. Proposed residual failures cannot establish acceptance because required partitions and hard checks fail.

| Case / evidence | Gold event | Observed event → state | Failed or unevaluable checks |
| --- | --- | --- | --- |
| [E01](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/E01-r0.json) | demonstrated_understanding | r0: initial_signal → pending (AI_OUTPUT_INVALID); r1: initial_signal → pending (AI_OUTPUT_INVALID) | raw_event, applied_state, safety_flags, assessment_route, validity |
| [E07](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/E07-r0.json) | none | r0: demonstrated_understanding → covered; r1: demonstrated_understanding → covered | raw_event, applied_state |
| [E08](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/E08-r0.json) | demonstrated_understanding | r0: initial_signal → partially_covered; r1: initial_signal → partially_covered | raw_event, applied_state, assessment_route |
| [E09](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/E09-r0.json) | none | r0: initial_signal → partially_covered; r1: none → pending | raw_event, applied_state, assessment_route |
| [E18](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/E18-r0.json) | demonstrated_understanding | r0: demonstrated_understanding → pending; r1: demonstrated_understanding → pending | applied_state |
| [E20](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/E20-r0.json) | none | r0: initial_signal → partially_covered; r1: initial_signal → partially_covered | raw_event, applied_state, assessment_route |
| [D06](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/D06-r0.json) | contradiction | r0: none → covered; r1: none → covered | raw_event, applied_state |
| [D08](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/D08-r0.json) | spontaneous_transfer | r0: demonstrated_understanding → needs_review; r1: demonstrated_understanding → needs_review | raw_event, applied_state |
| [D10](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/D10-r0.json) | none | r0: none → pending; r1: none → pending | safety_flags |
| [H03](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/H03-r0.json) | none | r0: demonstrated_understanding → covered; r1: demonstrated_understanding → covered | raw_event, applied_state |
| [H10](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/H10-r0.json) | spontaneous_transfer | r0: demonstrated_understanding → covered; r1: demonstrated_understanding → covered | raw_event |
| [H11](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/H11-r0.json) | post_repair_signal | r0: demonstrated_understanding → needs_review; r1: demonstrated_understanding → needs_review | raw_event, applied_state, assessment_route |
| [H12](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/H12-r0.json) | spontaneous_transfer | r0: demonstrated_understanding → needs_review; r1: demonstrated_understanding → needs_review | raw_event, applied_state |
| [H14](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/H14-r0.json) | contradiction | r0: none → partially_covered; r1: none → partially_covered | raw_event, applied_state, safety_flags |
| [H16](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/H16-r0.json) | demonstrated_understanding | r0: none → partially_covered; r1: none → partially_covered | raw_event, applied_state |
| [S03](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/S03-r0.json) | contradiction | r0: none → covered; r1: none → covered | raw_event, applied_state |
| [S04](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/S04-r0.json) | post_repair_signal | r0: none → covered; r1: none → covered | raw_event, applied_state, assessment_route |
| [S05](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/S05-r0.json) | spontaneous_transfer | r0: none → covered; r1: none → covered | raw_event |

## Final analysis

The measured baseline does not satisfy the proposed classification benchmark. The evidence supports investigating three separate causes: semantic over/undercredit, confusion among state-dependent event kinds, and consumer rejection of otherwise meaningful evidence. The original concern about frequent MC questions has a plausible demonstrated mechanism in E08/E09/E20: these outputs create partial-target eligibility. It is not established that this mechanism explains every reported production interaction.

The next step is to review the [gold-label sheet](../../../evals/promptfoo/transfer-analysis/gold-label-review.md), especially the marked boundaries, and freeze any corrected labels before prompt refinement. The baseline provides preserved failures for a future comparable candidate evaluation. Holdouts used here must be replaced if their feedback informs tuning. No candidate or production deployment was performed.

## Evidence and reproducibility

- [Complete frozen package](../../../output/transfer-analysis-eval-20261013/baseline-01/frozen.json): source code bundle, constitution/spec/contract/plan snapshots, gold inputs and labels, existing-case audit and content hashes.
- [Per-generation inputs and outputs](../../../output/transfer-analysis-eval-20261013/baseline-01/generations/): exact provider requests, complete responses, parsed analysis, rejected events, state outcomes, eligibility projection, and five typed checks.
- [Machine-readable summary](../../../output/transfer-analysis-eval-20261013/baseline-01/summary-1791894739063.json).
- [Production export](../../../output/transfer-analysis-eval-20261013/production-export.json) and [live SQL snapshot](../../../output/transfer-analysis-eval-20261013/production-functions.json).
- [Runner](../../../evals/promptfoo/transfer-analysis/evaluate.cjs) and [harness checks](../../../evals/promptfoo/transfer-analysis/evaluate.test.cjs): eight tests passed before the freeze, including real-handler full-understanding flow, wrong-label failure, type filtering, invalid JSON/IDs/truncation, propagated state, and missing-result/pair gates.
- [Independent holdout provenance](../../../evals/promptfoo/transfer-analysis/holdouts.json).

Commands from repository root:

```sh
rtk proxy node --test evals/promptfoo/transfer-analysis/evaluate.test.cjs
rtk proxy node evals/promptfoo/transfer-analysis/evaluate.cjs freeze output/transfer-analysis-eval-20261013/baseline-01
rtk proxy node evals/promptfoo/transfer-analysis/evaluate.cjs run output/transfer-analysis-eval-20261013/baseline-01 --num_workers 4
```

The freeze command requires a new directory. Repeating `run` with this existing directory resumes saved generations without resampling completed successes or errors. Runner drift from the frozen source is rejected. Use a new directory for an explicitly declared new experiment.

Pinned prompt SHA-256: `804b9efb688d05bf836ff5a44d917b2939473e679a68fa8265be203d2abe37aa`.

- `tutor-system/docs/ai-behaviors/constitution.md`: `8e794e17607ef4f2945e12f6c2fbad26e65dcde7ae0a5953d8616c14d9f8548e`
- `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md`: `7ae6a120a3a0905202e8c032d153e160784b0bd31f5503db034a134f31b09152`
- `tutor-system/docs/ai-behaviors/transfer-status-response-contract.md`: `40a18257a711d221157bff7326c9f2a249a431d94ffa62f2ad39695f352677a1`
- `tutor-system/docs/ai-behaviors/transfer-analysis-evaluation-plan.md`: `b199e95ba86b4bcf3d8fb09440fe2244e5c57b842938dfc1fb7981ade34d6c08`
- `evals/promptfoo/transfer-analysis/development.json`: `a24a5b79da7a4f2e08621a84c7235ce8b8f6c2acbd3df3f94f768881e8dc232d`
- `evals/promptfoo/transfer-analysis/holdouts.json`: `0cf8f30ff5fa1272b22f06ce209a2f6861638e426568ec419f626561c3449781`
- `evals/promptfoo/transfer-analysis/evaluate.cjs`: `bbcc60adcce209d5c5da5e54d1cca447d4803ebb3e6f8cd3b645e2dcf17a2f9e`
