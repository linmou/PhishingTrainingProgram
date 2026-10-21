# Contextual reply evaluation record

Intent: preserve the regression cases, evaluator calibration and unchanged-prompt results for the live-room misunderstanding.

Date: 2026-10-16. Source revision: `0e5c156fee9d1757b42a5db7beb93b3ee26a6993` plus the recorded worktree additions. Status: focused evaluation complete; strict gate failed on one retained length assertion.

Correction after product-path comparison: this run was not request-equivalent to the app. The offline request supplied all 24 saved messages; `simplifiedAIContext.ts:39` orders ascending then limits to 15, selecting the earliest messages. Message 15 is the fake-account assessment feedback; message 23, the immediately preceding link instruction, is excluded from app history. The current focus reply is supplied separately through `aiService.ts:640`, leaving its antecedent absent. The app also appends CURRENT LEARNING PROGRESS (`aiService.ts:868`), which this eval omitted. The frozen aiService.ts dependency already had max_tokens 600, while eval settings requested 100. Earlier “unchanged production” decoding claims were incorrect; preserve raw runs as offline diagnostics, not exact app reproduction. These mismatches were identified after the run and were not adjusted or rerun here.

## Frozen inputs and grounding

[Plan](contextual-reply-plan.md), [cases](contextual-reply-cases.json), [existing-case audit](contextual-reply-case-audit.json), [settings](contextual-reply-settings.json), [calibration examples](contextual-reply-calibration.json), and [current-turn rubric](../rubrics/v1/current_turn_grounding.md).

Authority: constitution 1.0 with recorded human adoption; existing T01/T02/T03 and response-contract C01. The user explicitly clarified that “Looks like it does” affirms the preceding link proposition, and requested a similar eval and test. No constitutional or domain-spec revision. The new supporting criterion operationalizes C01/H4 attribution; the existing generic reasoning criterion remains separate. No tutor prompt, decoder or deployed source was changed.

The ecological case uses all 24 saved room messages through focus `cf667e30-7f02-41b7-8e6b-9ce5418183b2`, pre-populated dialogue, inventory and actual saved room prompt. The derivative changes only the focus reply's polarity, including its history occurrence. Speaker labels are normalized; this is an offline reproduction, not an exact historical HTTP capture. Both cases are exposed development/regression evidence. The original 61 cases and every old assertion remain represented unchanged by the `full` entrypoint; their audit records explicitly limit the new criterion's applicability to the contextual-reply increment.

## Calibration and validation

Initial generic decision-reasoning calibration: **2/3 agreement**. It passed the observed stale reason, so it cannot alone detect this failure. [Immutable evidence](../results/qwen3.8-flash/contextual-reply-20261016-calibration/summary.json).

The added `current_turn_grounding` criterion: **3/3 agreement**, rejecting the observed bad reason and passing correct affirmation and negation interpretations. [Immutable evidence](../results/qwen3.8-flash/contextual-reply-20261016-current-turn-calibration/summary.json). This run's snapshot `rubric` field inadvertently contains the old generic rubric; each actual judge request in the per-example files preserves the exact new current-turn instructions used. The entrypoint snapshot field was corrected for future runs; these raw files remain unchanged. This is a limited calibration set, not comprehensive validation of every semantic judge on Qwen3.8.

Local validation: **56/56 tests passed**, including the new judge-input scoping integration test, product adapter, gate/error handling, classification, analysis and registry hash checks. Structural inspection confirmed unchanged old assertions, identical paired history prefix/room inventory/prompt, and no expected labels or pair identifiers in target inputs. Registry version assertion and its file hash were updated for v1.4; an initial version-expectation failure is resolved. The run snapshot retains the earlier registry hash metadata, while rubric bytes and scoring definitions are unchanged.

Commands:

```sh
rtk proxy node evals/promptfoo/v1/contextual-reply.js calibrate evals/promptfoo/results/qwen3.8-flash/contextual-reply-20261016-current-turn-calibration
rtk proxy node evals/promptfoo/v1/contextual-reply.js focused evals/promptfoo/results/qwen3.8-flash/contextual-reply-20261016-production
rtk proxy node --test evals/promptfoo/v1/harness.test.js evals/promptfoo/v1/product-adapter.test.js evals/promptfoo/v1/classification.test.js evals/promptfoo/v1/analyze.test.js evals/promptfoo/rubrics/v1/decision-metrics.test.js
```

## Executed target run

[Frozen run snapshot](../results/qwen3.8-flash/contextual-reply-20261016-production/snapshot.json). Three independent repetitions per case; production Qwen3.8 Flash, temperature 0.3, 100 tokens, thinking disabled, JSON output and production format repair. Semantic judge: Qwen3.8 Flash, temperature 0, 8000 tokens, thinking enabled. Credentials/endpoint use existing project configuration; credentials are absent from evidence. Workers and request concurrency are two. The runner preserves completed records and resumes identical runs without selecting successful generations.

All six target/semantic evaluations completed (command exit 0), reconciling 84/84 expected assertions: 83 pass, one fail, zero missing/error results. All 13 metrics other than response_length passed 6/6, including current_turn_grounding, decision_reasoning, learning_state_target, mode and instruction selection. response_length passed 5/6. The unchanged full development suite and independent holdouts were not executed; no experiment/spec version or release acceptance is registered from this focused run.

| Result | Evidence | Verdict |
| --- | --- | --- |
| Current contribution interpretation | 6/6 current_turn_grounding judgments; affirmative replies receive correction, negated replies receive scaffolding | Pass in this focused pair |
| Individual classifications | Each repetition 2/2; pooled mode and allowed-action accuracy 6/6 | Pass |
| Fixed two-/three-member classifications | Each mode/action view 2/2; no abstentions | Pass |
| Existing semantic/contract checks | All applicable checks except response length pass 6/6 | Pass in this focused pair |
| Response length | Negation repetition index 2: 27 words, four Intl.Segmenter segments | Fail under frozen rule |
| Strict semantic-pair gate | Same negation output fails the all-check pair condition | Failed |
| Full-suite non-regression / unseen generalization | Not run; 61 original cases preserved | Unassessed |

Raw [report](../results/qwen3.8-flash/contextual-reply-20261016-production/report.json), [gate](../results/qwen3.8-flash/contextual-reply-20261016-production/gate.json), [classification including confusion matrices and per-class metrics](../results/qwen3.8-flash/contextual-reply-20261016-production/classification.json), [general analysis and usage](../results/qwen3.8-flash/contextual-reply-20261016-production/analysis.json), [contextual joint analysis and sentence segments](../results/qwen3.8-flash/contextual-reply-20261016-production/contextual-interactions.json), and [56-test validation log](../results/qwen3.8-flash/contextual-reply-20261016-production/local-validation.tap).

Post-run commands: gate exited 1 (three issues: length below threshold overall/ecological and the same pair failure); classification exited 0; analyze exited 0 while reporting the failed gate. Usage recorded by the analyzer: seven target requests, 60 judge requests, 34,676 target total tokens and 153,639 judge total tokens (provider totals include input). Format-repair initial outputs are preserved; no valid semantic-failure output was resampled.

## Final analysis

The initial calibration confirms an evaluator gap: historical truth can conceal failure to address the current learner contribution. The added criterion rejects the observed bad output, preserving the generic check's earlier pass rather than retroactively changing it. The unchanged production prompt correctly interpreted both reply polarities in all six new generations; the observed production misunderstanding was not reproduced in this offline sample. This does not isolate its original cause or establish a production fix.

The sole failed output contains three grammatical sentences, but Intl.Segmenter splits the quote “crazy deal!!” from the remainder of its sentence, yielding four segments. That directly explains the deterministic failure and suggests a sentence-count evaluator boundary rather than a contextual-understanding failure. Preserve the failed strict verdict; a versioned length-rule clarification and comparable re-evaluation would be separate work. No semantic requirement conflict was found. Full-suite non-regression, independent holdouts, live checklist enrichment and UI behavior remain unmeasured. The requested case addition and focused test are complete; overall benchmark acceptance is not claimed. The subsequently confirmed oldest-15 history defect is a strong explanation for the real/offline difference: the app omits the latest link instruction that gave “does” its meaning, while the eval includes it. Exact causal reproduction still requires the original outbound request or a controlled product-path test.

## Metric interactions

Predeclared relationships: `current_turn_grounding` with `instruction_selection`, `decision_reasoning`, and `learning_state_target`. Each pair has N=6, both_pass=6, a_only=0, b_only=0, both_fail=0, unevaluable=0, joined by case/repetition/generation. All six outputs also satisfy all three companion criteria jointly, showing no necessary conflict between current-meaning attribution, correction eligibility and target selection in these cases. The saved observed response is counterevidence to relying solely on generic reasoning: it passed that check but failed current-turn grounding during calibration.

Knowledge quality versus response length: N=6, both_pass=5, knowledge_only=1, length_only=0, both_fail=0, unevaluable=0. The exact output and segmentation witness are preserved. This is an evaluator-boundary finding, not evidence that useful knowledge requires excessive length or that gates should be waived. Two distinct exposed cases and three repetitions each measure this controlled comparison only, not broad generalization.
