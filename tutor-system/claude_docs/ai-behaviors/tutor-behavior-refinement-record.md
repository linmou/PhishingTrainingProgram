# Evaluation run record: candidate 11

Intent: preserve the candidate 11 evaluation evidence, the human selection decision, and the separate release-verification state. This record does not define behavior requirements, constitutional policy, response contracts, or future experiments.

Run ID: `qwen3.5-flash/v8-scenario-rich-candidate-11-v2`
Executed: 2026-09-08
Behavior specification snapshot: [tutor-behavior-specification.md](tutor-behavior-specification.md), SHA-256 `06f928db0f746797285dad058fd46395da36e8de83763ca0aa106d22c07a5a9e`
Response contract snapshot: preserved in the [run snapshot](../../../evals/promptfoo/results/qwen3.5-flash/v8-scenario-rich-candidate-11-v2/snapshot.json); the current [contract](tutor-response-contract.md) records the subsequent production adapter.
Experiment definition: [tutor-behavior-evaluation-plan.md](tutor-behavior-evaluation-plan.md), current SHA-256 `8434e4f102c3ba4a4ce2ba98beb5d66370d485c2dd8d0d54a030bdb82c102ed5`
Prompt snapshot: [candidate-policy-11-contract-v2.md](../../../evals/promptfoo/v1/candidate-policy-11-contract-v2.md), SHA-256 `2aed2910fad48a19cdbaae049137ab326c74643c50080850c371fc43df36405b`
Rubric and case-manifest snapshots: [v1 manifest](../../../evals/promptfoo/rubrics/v1/manifest.json), current SHA-256 `e7a7c2d517acc23973c7b7bc31a155e8f51d713d571cf98e78e4f40b749cae7f`; [scenario-rich cases](../../../evals/promptfoo/v1/development-with-guard-scenario-rich.json), SHA-256 `f86df945af434c87462809a10a7a39141cfc13926201de39d3ba688c0bd0f517`
Baseline / candidate relation: candidate 11 and `v8-scenario-rich-aligned-baseline-v2-final` replay the same 61 cases, two repetitions, v2 contract, rubrics, manifest, and judge settings.
Experimental changes: candidate prompt content differs from the contract-aligned baseline; [iteration notes](../../../evals/promptfoo/v1/iteration-notes.json) preserve the sequence. Production uses the exact candidate text but retains its configured room prompt and uses non-thinking generation with a 100/120-token cap, unlike the evaluation target's thinking-enabled 8000-token allowance.

## Run outcome

Evaluation verdict: **failed the complete frozen gate**. Every primary metric cleared its ordinary percentage threshold except the exact `decision_reasoning` gate, but retained-v0 regression, pair, and Guard-quality gates also failed.
Grounding verdict: **resolved** against the adopted constitution and requirement annotations; no constitutional principle or priority changed during refinement.
Release verdict: **incomplete**. On 2026-09-08 the responsible human explicitly selected candidate 11 for production integration despite the failed formal gate. Local prompt/parser/request/build checks pass; live provider and browser/downstream verification remain unrun.
Blocking evidence: 13 gate issues: six regressions, three below-threshold rows, three pair failures, and one failed-baseline-to-inapplicable change. The selection is a recorded human release exception, not retroactive benchmark acceptance.

## Result summary

| Metric / method | Suite / partition | Passed / expected | Errors / missing | Threshold | Baseline | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| mode_selection / deterministic | Overall | 122/122 | 0 | 80% plus exact pairs | 117/122 | Marginal pass; pair failures remain |
| instruction_selection / deterministic | Applicable overall | 59/60 | 0 | 80% plus exact protection/pairs | 42/60 | Marginal pass; one label failure |
| instruction_realization / LLM rubric | Applicable overall | 60/60 | 0 | 80% | 55/60 | Pass |
| learning_state_target / LLM rubric | Applicable overall | 97/98 | 0 | 80% | 93/98 | Pass |
| contextual_knowledge_quality / LLM rubric | Applicable overall | 86/89 | 0 | 80%; hard accuracy partitions separate | 88/89 | Pass rate, with two-case regression |
| disruption_correction / LLM rubric | Applicable overall | 19/20 | 0 | 80% | 1/20 | Pass |
| guard_tone_safety / LLM rubric | Applicable overall | 20/20 | 0 | 80% | 20/20 | Pass |
| decision_reasoning / LLM rubric | Overall | 120/122 | 0 | 100% | 119/122 | Fail |
| contract_validity / deterministic supporting | Overall | 122/122 | 0 | 100% | 122/122 | Pass |
| response_length / deterministic supporting | Overall | 122/122 | 0 | 100% | 116/122 | Pass |
| retained v0 guard_response_quality / LLM rubric | Applicable overall | 10/14 | 0 | 80% | Not comparable | Fail |

Supporting-check results: v2 contract validity and response length passed 122/122. The simulated extension preserved context, contract, and length on 40/40 tutor turns.
New-metric failures: the full report preserves the single instructional-label miss, one learning-target miss, three knowledge-quality failures, one disruption-correction failure, and two reasoning failures.
Existing-metric regressions: six gate-classified regressions include retained reading-level and primary knowledge/persona cases; the full report keeps all 25 pass-to-fail assertions, including non-gating diagnostics.
Missing results and evaluation/provider/parsing/judge errors: none in the completed candidate run or simulated extension.
Previously passing cases now failing: see `comparison.new_failures` in [analysis.json](../../../evals/promptfoo/results/qwen3.5-flash/v8-scenario-rich-candidate-11-v2/analysis.json); they were not waived by the automated gate.
Residual failures allowed by percentage thresholds: three contextual-knowledge failures, one instruction-selection failure, one learning-target failure, one disruption-correction failure, and ordinary-threshold persona failures remain visible.
Required exact/safety/pair checks: contract and length exact checks passed; reasoning, retained regression, and three semantic-pair gates did not.

## Metric interactions

Analysis scope: same-generation pairs sharing the instructional decision/response, participation decision/rationale, Guard response, or knowledge/length output. Counts below use the frozen candidate case/repetition set; conditional inapplicability remains in the denominator where reported.

| Interaction ID / metrics | Run / common case set | Both pass | A pass / B fail | A fail / B pass | Both fail | Unevaluable | Expected N / evidence |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| I1 instruction selection / realization | Candidate, applicable overall | 59 | 0 | 1 | 0 | 0 | 60 |
| I2 instruction realization / learning target | Candidate, applicable overall | 60 | 0 | 0 | 0 | 0 | 60 |
| I3 mode / decision reasoning | Candidate, overall | 120 | 2 | 0 | 0 | 0 | 122 |
| I4 disruption correction / Guard tone | Candidate, applicable overall | 19 | 0 | 1 | 0 | 0 | 20 |
| I5 knowledge / length | Candidate, jointly applicable | 86 | 0 | 3 | 0 | 0 | 89; 33 knowledge-inapplicable rows excluded |

| Interaction ID | Finding | Supporting and counterevidence | Classification / remaining uncertainty | Effect on the decision | Next action |
| --- | --- | --- | --- | --- | --- |
| I1–I2 | Responses usually realized the intended teaching action even when one declared label was wrong. | 60/60 realization and target joint passes; selection has one miss. | Decision-label weakness, not a demonstrated conflict between teaching and progression. | Exact pair failure remains; human selection does not erase it. | Observe production label/review data before claiming decision reliability. |
| I3 | Mode decisions were correct on all generations, while two rationales overstated history. | 122/122 mode versus 120/122 reasoning. | Evidence-description weakness under P4/H4. | The 100% reasoning gate fails. | Keep human review and the repair/error path active. |
| I4 | Serious Guard tone and participation correction were jointly achievable in 19/20 applicable generations. | 19 joint passes and one correction-only failure with tone pass. | Isolated response-realization weakness; no requirement incompatibility shown. | Retained Guard-quality gate still fails independently. | Inspect the failed production-like Guard response if a similar case appears. |
| I5 | Brevity did not cause invalid length, but three knowledge responses were insufficient. | 86 knowledge/length joint passes and three length-only passes. | Content-selection weakness, not a length failure. | Knowledge passes the ordinary threshold but regresses from 88/89 baseline. | Do not interpret 86/89 as no-regression evidence. |

## Final analysis

Conclusion and user/learning effect: candidate 11 reliably produced valid, short, mode-aware tutor decisions in these tests, but the frozen evidence does not establish full non-regression or improved learner outcomes. The human selected it as the production prompt with those limitations visible.

Gains and remaining weaknesses: compared with the aligned baseline, mode selection rose from 117/122 to 122/122, instruction realization from 55/60 to 60/60, and disruption correction from 1/20 to 19/20. Knowledge quality fell from 88/89 to 86/89; two rationales overstated the observed history; retained Guard-quality and pair gates failed.

Explanation and limits: the comparison does not isolate prompt wording from every production configuration difference. The additional simulated-user run is synthetic diagnostic evidence, not a baseline, holdout, or human-learning measurement. Production uses the exact candidate text, but its non-thinking and token settings differ from the target evaluation.

Recommended action: integrate candidate 11 under human review as directed, preserve the failed automated verdict, and treat live provider/browser verification plus production feedback as pending release evidence rather than claiming formal benchmark acceptance.

## Evidence

Immutable run directory: [candidate 11 run](../../../evals/promptfoo/results/qwen3.5-flash/v8-scenario-rich-candidate-11-v2/) and [simulated-user extension](../../../evals/promptfoo/results/qwen3.5-flash/v9-candidate-11-simulated/)
Inputs and outputs: per-case candidate files preserve complete target requests, raw responses, parsed decisions, and evaluator inputs; simulated trajectory folders preserve every generated learner/tutor turn.
Evaluator evidence: [candidate analysis](../../../evals/promptfoo/results/qwen3.5-flash/v8-scenario-rich-candidate-11-v2/analysis.json), [candidate report](../../../evals/promptfoo/results/qwen3.5-flash/v8-scenario-rich-candidate-11-v2/report.json), and [simulated report](../../../evals/promptfoo/results/qwen3.5-flash/v9-candidate-11-simulated/report.json).
Execution metadata: snapshots preserve commands, settings, timestamps, source hashes, retries, raw calls, and usage. Local production verification on 2026-09-08: application build passed with existing warnings; 42 focused Jest tests passed; four Node evaluation suites passed. Repository-wide TypeScript remains non-clean because of its pre-existing test backlog and is not claimed as passing.
