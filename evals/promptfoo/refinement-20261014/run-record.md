# Shortcut-removal evaluation record

Intent: preserve the audit findings, comparable experiments, failed candidates and remaining acceptance work for the requested prompt cleanup.

Executed: 2026-10-14–15. Source revision: `8dc7271` plus the recorded working changes. Updated2026-10-15: candidate11 full comparison completed and fails acceptance; refinement continues. This record summarizes executed evidence; [the experiment index](README.md) preserves chronology and declared factors.

## Decision and scope

The audit established development-case overlap and scoring accommodations in the original prompt. It did not establish deceptive intent. Worked JSON solutions and dialogue demonstrations overlapped the development scenarios; the prompt also prescribed substitute punctuation wording to accommodate the sentence counter. The cleaned candidates remove those mechanisms and state general participation, instructional, learning-target and factuality rules. Independent audits verify that evaluation IDs, expected labels and rubric metadata do not enter the target request.

No cleaned candidate has met every frozen gate. The latest full tutor comparison is candidate11 under calibrated evaluatorv1.3:183/183 generations,2706 assertions,19 overlapping gate issues and17 classification regression rows. It reuses all183 preflight targets and makes zero new target calls. The comparable baselinev1.3-r2 has two controlled-pair failures; its metadata replay reuses every target and judgment. Earlier failed conditions remain below. The approved Guard response template is retained. Transfer refinements include the40 added cases in the complete118-case suite. Recovered04finishes345/354correct events,343/354states and354/354routes/valid outputs; overall three-vote F1=.977617, but ecological, three controlled comparisons and nonregression gates still fail.

Grounding remains the adopted constitution1.0 and resolved T01–T08/G01–G03 interpretation. No new constitutional priority or exception was adopted. Subsequent explicit product selection applies tutor07 plus the previously approved Guard template and exact transfer02, both nonthinking after the thinking staging timeout. The user explicitly authorized release of exact02 with its known semantic errors. Benchmark acceptance remains failed; product delivery evidence and status are recorded separately in [the selected-candidate release record](../../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_15_selected_ai_candidates.md).

## Frozen authority and experimental controls

Latest completed diagnostics preserve all61cases and three repetitions. Candidate11's fullv1.3 result has180/183correct modes,88/90eligible action selections and78/90action realizations. Only77/90 jointly pass action selection and realization; correct labels alone do not establish correct teaching. Guard correction/tone jointly pass27/30. Full reason consistency is181/183. All183outputs satisfy the contract and length limits. Independent review flags three strong judge false negatives and one ambiguous mixed alternative; original scores are retained, with no waiver.

| Later diagnostic | Correct mode | Correct instruction | Length | Scope |
| --- | --- | --- | --- | --- |
| Candidate12, unrelated-task participation demonstrations |181/183|84/90|182/183|Complete preflight, failed|
| Candidate13, neutral schema description |179/183|83/90|182/183|Complete preflight, failed|
| Candidate11, compact context |181/183|89/90|181/183|Complete preflight, failed|
| Isolated participation01 |179/183|Not evaluated|Not a tutor response|Mode diagnostic, failed|
| Isolated participation02 |181/183|Not evaluated|Not a tutor response|Mode diagnostic, failed|
| Isolated participation03 |182/183|Not evaluated|Not a tutor response|Mode diagnostic, failed|

All listed outputs are valid; isolated mode calls do not establish complete tutor behavior. The latest compact-context diagnostic is separately declared in [round03](continuation-round03-20261015.md). New runs preserve failed outputs and use32target workers; no completed identical target is resampled. Transfer results and exact transport accounting are in the [full transfer record](../transfer-analysis/full-refinement-run-record.md).

The proposedv1.4realization rubric is rejected after91fixture calibration: current91/91, proposed87/91. Installedv1.3 remains. An [independent gold review](audit-participation-gold-ambiguity.json) identifies an unresolved interpretation of the lock-reliance case under G01; human clarification is pending, with the original label and every score retained. The unknown-prior topic-preference case is separately supported and is not relabeled.

[freeze.json](freeze.json) pins the authority, cases, settings, baseline and audit identities. Each immutable run's `snapshot.json` contains the actual prompt, full cases, source text, settings, rubric text and dependency hashes; its `report.json` and per-generation JSON preserve target and judge requests, outputs, attempts and errors.

| Authority | SHA-256 |
| --- | --- |
| [Constitution](../../../tutor-system/docs/ai-behaviors/constitution.md) | `8e794e17607ef4f2945e12f6c2fbad26e65dcde7ae0a5953d8616c14d9f8548e` |
| [Behavior specification](../../../tutor-system/docs/ai-behaviors/tutor-behavior-specification.md) | `fad175fe3abef0b50681868eac79bc8b7bbedf11d379046ffad79f9020be10cd` |
| [Response contract](../../../tutor-system/docs/ai-behaviors/tutor-response-contract.md) | `6896f22902c7b43996272084263233296f9a7aaa694fa57cd23848fc1110aa1a` |
| [Evaluation plan](../../../tutor-system/docs/ai-behaviors/tutor-behavior-evaluation-plan.md) | `a9ba894e5cb9cb32244dd9daad43ae2e415d60f60c38aecdde4953bf6ce2fbe8` |

All61 development cases and173 legacy assertions retain their inputs, reference labels and dispositions. Three repetitions yield183 target generations and2706 assertions per full arm. Mode and allowed-set instruction accuracy are the primary classification metrics: individual thresholds80%, three-member majority strictly greater than90% in every required partition, and100% in hard partitions. Fixed two-member ties abstain; missing/invalid outputs remain incorrect. Full gates additionally enforce exact constraints, every state transition, controlled pairs and baseline nonregression. Detailed confusion matrices, class support, precision/recall/F1, abstention and each repetition/ensemble are in each `classification.json` or `classification-comparison.json`.

The original configuration uses Qwen3.5 Flash, temperature0.3, thinking disabled and100 output tokens. The separately declared diagnostic enables thinking and raises the budget to8000, keeping other model parameters and the three repetitions fixed. This is a combined reasoning/budget factor. Neither configuration represents ordinary enabled-room defaults of temperature0.7/120 tokens. Product message construction, parsing and two-attempt format repair are exercised; transport retries and omitted live checklist/assessment enrichment limit product parity.

Candidate01 bundled exemplar removal with a broad policy rewrite and shorter reason guidance. Candidates02–05 added general priority/state distinctions and cleaned contradictory base guidance. Candidate06 retains more original general detail while removing worked answers; its reason allowance returns to40 words. Candidate07 combines that teaching guidance with05's prior-state participation branches and compact10–15-word reasons. This prevents attributing all changes to exemplar removal alone. The [candidate06 audit](audit-candidate06.json) and [candidate07 audit](audit-candidate07.json) verify61/61 requests differ from their predecessors only in policy; the earlier base changes remain declared factors relative to the original baseline.

## Completed full comparison: evaluator v1.1

The [baseline](../results/qwen3.5-flash/shortcut-removal-20261015-baseline-v1.1/gate.json), [candidate01](../results/qwen3.5-flash/shortcut-removal-20261015-candidate01-v1.1/comparison.json) and [candidate02](../results/qwen3.5-flash/shortcut-removal-20261015-candidate02-v1.1/comparison.json) each contain183 generations and2706 expected assertions. The original v1 grades are preserved separately. V1.1 calibrated41/41 boundary/existing examples and symmetrically rejudged all90 realization rows per arm; baseline and01 retain all183 target outputs and1803 unchanged judgments each.

Values below are passed/applicable; conditional inapplicability remains visible in the following paragraph. Overall rates do not override failed partitions or exact checks.

| Check | Baseline | Candidate01 | Candidate02 | Overall threshold |
| --- | --- | --- | --- | --- |
| Participation selection | 177/183 | 177/183 | 169/183 | 80%, additional classification gates |
| Instruction selection | 84/90 | 73/90 | 75/90 | 80%, additional classification gates |
| Instruction realization | 78/90 | 63/90 | 57/90 | 80% |
| Learning target | 142/147 | 144/147 | 135/147 | 80% |
| Contribution feedback | 101/102 | 88/92 | 82/88 | 80% |
| Contextual knowledge | 140/140 | 160/163 | 157/165 | 80%, separate accuracy constraints |
| Persona | 176/183 | 174/183 | 166/183 | 80% |
| Identity honesty | 183/183 | 183/183 | 182/183 | 100% |
| Reading level | 153/153 | 153/153 | 153/153 | 80% |
| Learner dignity | 183/183 | 183/183 | 182/183 | 100% |
| Response length | 183/183 | 183/183 | 182/183 | 100% |
| Contract validity | 183/183 | 183/183 | 182/183 | 100% |
| Supporting decision reason | 181/183 | 177/183 | 173/183 | 100% |
| Guard participation correction | 27/30 | 21/30 | 15/30 | 80% |
| Guard tone | 30/30 | 30/30 | 29/30 | 80% |

Contribution-feedback expected N is183 in each arm, with81/91/95 inapplicable. Contextual-knowledge expected N is183 with43/20/18 inapplicable. Candidate02 contains one terminal target-format failure after its permitted repair; it also exposes a schema-valid Guard/null output mislabeled as a realization contract error. Its14 distinct unevaluable assertion rows (12 error,2 missing) and original grades remain recorded. These are not inferred dignity/identity violations or silently removed samples.

Standalone gate issue counts are13/20/63; candidate comparison counts are42/105. Counts overlap across partitions/checks and are not distinct case counts. Overall three-vote mode is59/61,59/61,57/61; instruction29/30,24/30,26/30. Every arm fails acceptance. Baseline's hard failures include three known-Guard acknowledgment transitions, one imminent-protection action, two decision reasons and seven controlled-pair rows. Candidate01 additionally has factual-accuracy failures and instruction-realization/Guard-protocol regressions. Every pass→fail row and applicability change is retained in the comparison artifacts; none receives a waiver.

## Target-only screening

These runs are complete target-generation diagnostics, not complete behavior experiments. All semantic checks remain unrun. The three repetitions reuse the same61 scenarios and are not183 independent scenarios.

| Run | Valid final outputs | Correct mode | Correct instruction | Screening verdict |
| --- | --- | --- | --- | --- |
| Candidate03, short | 183/183 | 170/183 | 79/90 | Failed |
| Candidate04, short | 183/183 | 172/183 | 71/90 | Failed |
| Candidate04, thinking | 183/183 | 168/183 | 81/90 | Failed required partition |
| Candidate04, lean adapter | 183/183 | 174/183 | 62/90 | Failed |
| Candidate05, short | 183/183 | 179/183 | 76/90 | Failed |
| Candidate05, thinking | 183/183 | 177/183 | 81/90 | Failed;27 overlapping comparison regression rows |
| Original baseline, thinking | 183/183 | 183/183 | 89/90 | Classification accepted; full semantics incomplete |
| Candidate06, short | 177/183 | 165/183 | 77/90 | Incomplete classification; six terminal format failures |
| Candidate06, thinking | 183/183 | 173/183 | 85/90 | Failed |
| Candidate07, short | 183/183 | 177/183 | 80/90 | Failed;16 overlapping comparison regression rows |
| Candidate07, thinking | 183/183 | 175/183 | 86/90 | Standalone accepted;20 overlapping comparison regression rows |

Candidate05 fixes all six known-Guard acknowledgment/promise outputs under thinking, versus1/6 for04thinking. Five of its nine action failures involve incorrect proposed answers phrased as questions; four are premature consolidation. The independent [candidate05 diagnosis](diagnostic-policy-review-candidate05.json) supports restoring the original generic distinction without restoring worked answers. All six initial format failures across05's two configurations emitted the unsupported `instructing` label and ended normally; this is evidence of possible taxonomy interference, not token truncation. Candidate06short, in contrast, has actual truncation under the restored reason allowance.

The new thinking baseline preserves all183 original initial message arrays exactly. It was generated after05 authorship and before06; that timing is explicit. Each run's snapshot and classification artifacts contain the exact identities. The lean04 adapter changed several composition factors together; all183 initial/final outputs were independently checked against production parsing. Future v2 adapters now share strict production validation and repair.

The [candidate07 diagnosis](diagnostic-review-candidate07.json) independently reproduces the comparison and finds that its residual errors violate already explicit rules. The deterministic comparison uses v1.2 on both sides after checking unchanged classification definitions and exact cases/settings; no new model calls or semantic judgments enter that derived comparison. Another equivalent prompt admonition lacks a concrete basis. A reviewed next diagnostic holds06/07 policies fixed and restores the historical base minus four dialogue demonstrations, isolating accumulated base changes. That control would restore competing guidance and fixed microexamples, so it is not a cleaned promotion candidate. It remains unrun; no source hydration occurred before the disk interruption.

## Metric interactions and interpretation

The analysis screens shared requirements in T01/T02, T04/T08, G01/G02/G03 and supporting truthful reasons. It joins checks on the same case/repetition/output. Marginal improvements cannot establish joint conformance. Four evaluated cells plus unevaluable total the fixed N below.

| Pair; arm | Both pass | A only | B only | Both fail | Unevaluable | N |
| --- | --- | --- | --- | --- | --- | --- |
| Action selection × realization; baseline | 76 | 8 | 2 | 4 | 0 | 90 |
| Action selection × realization;01 | 63 | 10 | 0 | 17 | 0 | 90 |
| Action selection × realization;02 | 54 | 21 | 3 | 11 | 1 | 90 |
| Realization × target; baseline | 78 | 0 | 12 | 0 | 0 | 90 |
| Realization × target;01 | 62 | 1 | 27 | 0 | 0 | 90 |
| Realization × target;02 | 56 | 1 | 28 | 4 | 1 | 90 |
| Mode × reason; baseline | 175 | 2 | 6 | 0 | 0 | 183 |
| Mode × reason;01 | 171 | 6 | 6 | 0 | 0 | 183 |
| Mode × reason;02 | 161 | 8 | 12 | 1 | 1 | 183 |
| Guard protocol × tone; baseline | 27 | 0 | 3 | 0 | 0 | 30 |
| Guard protocol × tone;01 | 21 | 0 | 9 | 0 | 0 | 30 |
| Guard protocol × tone;02 | 15 | 0 | 14 | 0 | 1 | 30 |

Candidate01 slightly improves target selection but loses teaching-action realization:62/90 jointly pass, versus78/90 baseline. This is an observed tradeoff under the combined prompt changes, not proof that the requirements conflict. Guard tone alone remains strong while participation correction declines; respectful delivery does not establish that the conduct, discussion impact and return-to-task requirement were stated. Joint-success witnesses in each [analysis artifact](../results/qwen3.5-flash/shortcut-removal-20261015-candidate01-v1.1/analysis.json) refute absolute incompatibility for those observed contexts.

The same analyses include Guard tone×persona, target×content and content×length. Conditional N/A rows in the content pairs remain separate and must not be silently counted as either joint success or failure. Independent raw-output review also found judge overreach and actual factual errors, including unsafe domain explanations. A possible judge defect does not waive a failed model gate. No unresolved constitutional contradiction has been established.

## Execution integrity and validation

Sleeping-host transport failures and disk exhaustion interrupted earlier baselines. Every original directory remains. Baseline-r5 replays all179 saved r4 records, including failures, and generates only the four absent records. This is availability-based recovery; received but unsaved output may have been lost at the disk interruption. Model calls use a wake assertion, bounded concurrency and a separate progress/disk monitor. Endpoint credentials are not stored in reports.

Completeness fixes prevent missing assertions, duplicates, absent partitions or provider errors from producing acceptance. The same checks apply to baseline and candidate. Strict replay validates target inputs/settings and cached requests; integration tests exercise valid, repaired and exhausted outputs without extra target calls. [Validation evidence](validation.json) records88 passing focused Node checks after the null-routing fix, focused TypeScript success, and77/78 product tests. The remaining demo-dialogue-prefix failure is in unchanged source; the obsolete transfer-v3 suite separately has12 historical failures. Neither is represented as passing.

Sixteen independently authored holdout scenarios remain isolated from the prompt author. Earlier baseline/01/02 holdout executions are preserved by their independent owner; their semantic outcomes have not been used for refinement. Later candidates require their own frozen, matched holdout validation. No unseen-set pass is claimed here.

Evaluator v1.2 distinguishes schema-valid Guard/null behavior failures from contract errors while preserving LLM judging, frozen applicability and denominators. Its first condition passed48/49 examples and remains failed evidence. A separately reviewed general clarification of protective benefit versus first instructional action passed49/49 under a new condition (50 provider attempts, no unresolved errors). V1.2 was then adopted. The completed short-baseline replay preserves183 targets and1803 unchanged judgments, makes zero new target calls, and rejudges90 realization rows; its full gate still has13 issues. [The independent review](audit-null-instruction-v12.json) and [proposal](instruction-realization-null-taxonomy-proposal.md) pin source identities and preserve this chronology.

The full thinking comparison uses identical model settings and per-process request concurrency12, bounding both arms at24. Both runs failed to save a result with `ENOSPC` on2026-10-15; remaining workers were terminated at07:11 UTC. [The first interruption record](thinking-v12-disk-interruption.json) pins76 valid saved records. After space recovered to1.7GiB, exact-command resumption added15 records before space fell below200MiB and both workers were stopped proactively. [The latest checkpoint](thinking-v12-disk-resume-checkpoint.json) pins46 baseline records/776 assertions and45 candidate records/761 assertions, against183 generations/2706 assertions expected per arm. All saved targets exactly match the complete preflights, with zero new target calls and no malformed saved JSON. Unsaved in-flight judgments may be lost. Stable disk capacity and exact-command resumption are required; every saved result, including failures, must be reused. No full semantic verdict is inferred from this partial sample.

## Remaining decision

The cleanup and harness repairs are reviewable, but a passing behavior result has not been achieved. Full thinking resumption, the requested added transfer coverage, the compact-context diagnostic and transfer04recovery are complete. The user's reuse instruction takes precedence over regenerating existing outputs. Human interpretation is pending for the contested lock label, pricing target scope, support-contact partial-credit boundary, and private-coordination target/evidence taxonomy. The [transfer audit](../transfer-analysis/audit-transfer03-04-residual-gold.json) preserves concrete decisions and distinguishes genuine model errors. Another refinement needs a supported hypothesis and must include all original and added coverage. Acceptance still requires comparable semantic, regression and unseen holdout gates; release verification remains separate.

## Completed thinking comparison and added transfer coverage

The completed directories are `shortcut-removal-20261015-baseline-thinking-v1.2-4x` and `shortcut-removal-20261015-candidate07-thinking-v1.2-4x` under `../results/qwen3.5-flash/`. Workers increased8→32 and request concurrency12→48 per arm; model requests, rubrics and sampling settings were unchanged. [Replay manifest](thinking-v12-4x-replay-manifest.json) and [independent audit](audit-thinking-v12-4x-replay.json) verify all366 target outputs reused unchanged, all175 previously completed semantic records retained including failures, and2074 existing judgments preserved. No new target calls occurred. All3801 recorded judge requests follow the frozen protocol.

| Check | Original thinking | Cleaned07 thinking |
| --- | --- | --- |
| Mode | 183/183 | 175/183 |
| Instruction selection | 89/90 | 86/90 |
| Instruction realization | 88/90 | 73/90 |
| Learning target | 143/147 | 144/147 |
| Contribution feedback | 104/107 | 70/71 |
| Contextual knowledge | 123/124 | 157/159 |
| Persona | 175/183 | 170/183 |
| Decision reason | 183/183 | 177/183 |
| Guard correction | 30/30 | 14/30 |
| Guard tone | 30/30 | 30/30 |

Identity, dignity, response length and contract validity pass183/183 in both; reading level is153/153 versus152/153. Feedback has76/112 inapplicable records and knowledge59/24, so numerator growth alone is not improvement. Two failed baseline feedback checks becoming inapplicable remain blocking. The original fails imminent-protection realization20/21 and five pair rows. Candidate07 regresses across mode, instruction, realization, factual knowledge, persona and reasons; exact thresholds and pair failures also block acceptance.

Interaction analysis uses joined generations: instruction selection/realization both pass87/90 versus70/90; selection alone passes2 versus16, showing that correct labels do not ensure the requested intervention. Guard correction/tone both pass30/30 versus14/30; candidate tone alone passes16, so polite wording does not establish the Guard protocol. Learning-target/realization both pass88/90 versus73/90; target alone passes2 versus17. These are observed failures, without a new policy exception or relaxed gate.

The [added transfer record](../transfer-analysis/current-added-run-record.md) preserves120 logical results from114 fresh calls, with two aliases reused. Transfer prompt and handler are shared across tutor conditions. All old transfer outputs remain historical because their prompts differ. The new full-suite path retains73 original plus40 added cases and separate propagated sequence checks. These component results do not convert the failed tutor candidate into an accepted system.
