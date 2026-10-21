# Qwen3.8 Flash model comparison

Intent: measure whether changing the target model improves the selected tutor and transfer prompts while preserving comparable inputs and scoring.

Prepared and executed: 2026-10-15. Working repository baseline: `8441f11`; historical target revisions remain pinned in their reference snapshots. Status: complete model comparison; benchmark acceptance fails. Product model unchanged.

Only target model changes from qwen3.5-flash to qwen3.8-flash. Tutor uses the exact frozen candidate07 preflight:61cases×3repetitions, temperature0.3,max_tokens100,thinkingfalse, two JSON format attempts and original transport limits. This frozen prompt excludes the later approved Guard addition in the deployed version. All183saved baseline targets, including failures, are reused. Both arms are graded with the same current calibrated evaluator and Qwen3.5 Flash judge at temperature0,max_tokens8000,thinkingtrue. Historical semantic scores remain attached to their original evaluator.

Transfer uses frozen full-candidate02-20261015:73original cases,40additions and5propagated sequence steps,354logical records from348calls. Exact snapshot handler, prompt, gold, reducer, class metrics, pairs, aliases and0/600/nonthinking settings remain fixed. The candidate model is injected into the handler environment before request construction. Fixed-input comparisons use the same messages; sequences independently propagate each arm's resulting state under the same policy. Saved baseline responses are retained with their native failed checks.

Raw evidence: ignored `output/model-comparison-20261015/`. The driver freezes source text, rubric metadata, reference hashes and full inputs; saves raw target and judge responses; resumes saved successes and failures; and limits concurrent calls through configurable `--num_workers` (32for this run). A disk/swap monitor runs alongside model work. The semantic judge stays fixed; identical judge requests may reuse saved responses without outcome selection. No app settings or hosted model secrets change.

Commands and manifests are saved in the raw package. Availability probe returned HTTP200 with response model qwen3.8-flash, nonthinking JSON output. An independent audit reviews the exact experiment driver and frozen manifest before execution. Gates and label-review limitations remain unchanged; higher aggregate metrics alone do not establish acceptance or authorize deployment.

Executed package: `output/model-comparison-20261015/paired-02`, manifest SHA256 `e0ee3df4e81f8ba8b3d77cfffe7262cbe37a651d2b03c9270433e99bc229d9e0`, driver SHA256 `eac5285a0f88a7a4f3545276216c74d071c1e2be51a65a69b45cfb0e24fe264f`. [Independent audit](audit-qwen38-model-comparison-20261015.json) is clear. Three new structural checks and41existing harness checks pass. Earlier paired-01 is a superseded preparation manifest with no target eval calls. Run command: `rtk proxy env OAI_MODEL=qwen3.8-flash caffeinate -i node evals/promptfoo/v1/model-comparison.js run output/model-comparison-20261015/paired-02 --num_workers 32`. No runtime source or model secret is changed.

Paired-02 is interrupted and invalid as model-performance evidence: its frozen handler has a PROVIDER_MODEL equality check, so injecting OAI_MODEL alone produced348transfer503records with zero provider calls. The driver and first independent audit missed this configuration prerequisite. The failed package is retained with interruption metadata. Four integrated/structural tests now verify the actual frozen handler emits a Qwen3.8 request and consumes a valid saved response. The corrected experiment snapshot changes only the PROVIDER_MODEL initializer to the candidate model, in addition to the injected environment; the runtime source and downstream classification logic remain unchanged.

Superseding package: `output/model-comparison-20261015/paired-03`, manifest SHA256 `a032f05ca3f0d7fc52102d68ca2f6b367825fa4dd4110f81bd81dc46a3e4d1ba`, driver SHA256 `0c5ca4e687e858672a45561c350889455232cc7049318807182a33fdad1a1eb2`. Four tests pass. Fourteen completed baseline judge calls from the interrupted run are retained by exact request/settings hash, including failures if any; judge-reuse-manifest.json records every source hash. The superseding run uses the same command with paired-03. A separate audit addendum is required before restarting.

[Corrected independent audit](audit-qwen38-model-comparison-model-pin-addendum-20261015.json) is clear against the paired-03 manifest and driver above, including the model-pin-only source delta and actual handler HTTP200 test. Paired-03 has started with32workers. Known human-label/unseen-validation limitations and native gate failures are retained.

A32→48worker resume exposed a harness identity-check error: strict object equality rejected equal serialized consumer values because frozen-handler objects use a VM prototype. Paired-03 was stopped with completed outputs retained. Replay validation now compares their serialized SHA256 identities, matching the existing transfer runner's approach; no provider outputs, semantic labels or consumer logic change. Four integrated/structural tests pass, including serialization and replay through the actual frozen handler.

Superseding paired-04 manifest SHA256 `3ad24d07d42d8e4124cf0e9e08c78dd9743fcf794c798776b0588c81fb4c53ea`, driver SHA256 `9ee992a924c4ffa1dfd6982170665631396a26b76d2d1e276309ec77abe8e813`. All713completed transfer/tutor/judge artifacts were copied, preserving successes and failures. Only experiment_fingerprint bookkeeping changes where present; source and target SHA256 identities are listed in reuse-manifest.json after exact equality checks on all experiment factors. The48worker run reuses those completed records rather than regenerating them. An audit addendum covers this correction.

[Resume audit](audit-qwen38-model-comparison-resume-addendum-20261015.json) is clear. Reuse comprises345transfer records,18completed tutor baseline judgments and350raw judge-cache responses. The48worker resume passes the corrected replay checks.

## Completed transfer result

All348physical calls and354logical records are complete, including six dependent alias records. `paired-04/transfer-complete-summary.json` derives aliases from their corresponding canonical repetitions and preserves case/repetition identities; the main driver's final report remains pending tutor grading. Classification uses339fixed-input logical records;15propagated sequence records are separate diagnostics.

| Metric | Qwen3.5 Flash | Qwen3.8 Flash |
| --- | ---: | ---: |
| Raw event checks |266/354|294/354|
| Applied state checks |272/354|300/354|
| Assessment route checks |344/354|347/354|
| Valid consumed outputs |354/354|350/354|
| Three-vote macro-F1 |0.693978|0.799898|
| Pooled macro-F1 |0.710744|0.785423|
| Ecological three-vote macro-F1 |0.418860|0.653236|

Qwen3.8 passes15/15propagated sequence raw/state/route/validity checks. It improves aggregate classification but fails acceptance: four providerHTTP200outputs are rejected by the unchanged consumer (N04/r3,R01/r2,V02/r3 insert ellipses into evidence quotes; af86353_NH14/r2 truncates an item ID). No semantic repair or favorable resampling is added. No-event recall0.725remains below0.90; initial-signal precision is0.2778. Failed paired repetitions fall38→32of84, and the fixed-input slice has58new pass-to-nonpass checks. Improvements do not remove regression/class/validity gates. The [independent fixed-input results audit](audit-qwen38-transfer-fixed-input-results-20261015.json) supports these findings and preserves its own narrower sequence-pending scope.

Saved-call latency is observational: Qwen3.8transfer median≈2.75seconds,p95≈4.11seconds, versus historical3.5median≈1.68seconds,p95≈2.57seconds. Serving time and concurrency differ, so this does not isolate model latency. The final tutor comparison and joint verdict follow below.

## Final comparison

Qwen3.8 provides a clear aggregate transfer-classification gain and a smaller tutor teaching gain on these frozen prompts. It is not a uniform improvement across the benchmark: remaining class/partition/regression gates and four invalid transfer outputs prevent acceptance. The application remains on Qwen3.5; this task changes evaluation tooling and records only.

All183tutor targets per model are present, with no terminal target errors. Qwen3.5targets are entirely reused. Qwen3.8uses184saved target calls because one output required the existing single JSON repair; target output limits and semantics remain unchanged. Actual response model IDs match their respective target arms; all semantic judges return Qwen3.5 Flash. The parser SHA256 `4a982e3e5080ed02e2e43ab99dde8bb8a2a1f8264d9f6da8c6f64051d9922e66` matches the historical target contract, recorded in parser-parity.json.

| Tutor07 metric | Qwen3.5 Flash | Qwen3.8 Flash |
| --- | ---: | ---: |
| Correct mode |177/183|177/183|
| Correct instruction selection |80/90|84/90|
| Instruction realization |74/90|76/90|
| Selection and realization both pass |66/90|75/90|
| Learning target |137/147|141/147|
| Persona stability, native judge |182/183|177/183|
| Decision reason consistency |177/183|176/183|
| Guard correction |13/30|16/30|
| Guard tone safety |30/30|30/30|
| Contract validity / response length |183/183|183/183|

The joint action gain66→75is stronger than the marginal realization gain74→76: more outputs pair the right declared action with the teaching actually delivered. Guard correction/tone jointly pass13→16of30because tone passes all30 in both arms. Ecological instruction realization decreases21→20of24 and ecological target choice34→33of36, despite overall improvement. Conditional feedback and factual-knowledge denominators differ by arm; native comparable-overlap results and inapplicability transitions remain in the report rather than treating larger numerators as automatic improvement.

Tutor three-member instruction accuracy increases26/30→27/30, but exactly0.90fails the frozen strictly-greater-than0.90gate. Synthetic instruction accuracy is19/22in the candidate; synthetic mode accuracy decreases47/48→46/48. One case has three different permitted teaching actions, producing an ensemble abstention; this is an aggregation limitation, not evidence that all three replies are wrong. Six classification nonregression rows fail after normalizing only the declared model factor in comparison metadata. Actual raw requests retain their real models.

The native persona score decrease is uncertain evidence of actual role degradation: independent review identifies several candidate failures that cite formal or imperative Guard wording even though the installed rubric explicitly permits those features. Native scores remain unchanged; suspected judge overreach is flagged, not silently relabeled. The frozen07prompt also lacks the later approved release Guard paragraph, so these Guard results do not measure the exact current deployed prompt. [Final native results audit](audit-qwen38-final-native-results-20261015.json) records these distinctions and verifies output/model identities.

One baseline legacy practical-knowledge judgment omitted the required root-key suffix `:1` in both native format attempts. The native report retains this missing result; no key alias or manual pass is introduced. Under the separately declared [schema-recovery policy](qwen38-judge-schema-recovery-policy-20261015.json), only error/missing judgments in either arm were eligible for one extra format attempt with the same target, rubric and judge settings. The single eligible baseline judgment returned a valid pass in one call. Raw evidence is judge-schema-recovery-01.json. Original native report SHA256 `c75e46aa3ca870cc1e41cb7dd149e7cd5f10cdcd4467e37bbc90061ccce3e979` remains immutable. A separate tutor judge timeout is preserved and recovered by the ordinary native format-retry path.

Final postprocessed evidence is `paired-04/final-results.json`, SHA256 `c14e4dbe03157822d1381cb1f5901128bbaaa22c3beab22397edb5cf4ace8242`; completion.json preserves command, completion time, exit0 and result hash. There are zero unresolved judgments after the declared supplemental recovery. Native tutor issue counts are13baseline/21candidate; final counts are11/20after removing the legacy schema error, without changing any core metric. Both verdicts remain failed. Full per-partition metrics, confusion matrices, ensemble predictions, pairs, new failures and same-output interactions are preserved. Saved judge evidence comprises3599unique responses,3716attempts and12,850,128tokens; this counts copied identical cache entries once and excludes unavailable billing metadata for interrupted unsaved requests. Native per-record usage summaries may count shared judge-cache responses more than once; the final saved_judge_usage field is the unique saved-call accounting.

No new behavior-spec priority, gold label, prompt clause or acceptance threshold is adopted. Existing exposed cases establish regression performance, not unseen generalization. Four integrated/structural driver tests and41existing harness tests pass; all target inputs/raw outputs, failed conditions, reused artifact hashes, provider settings and corrective grading evidence are retained under the ignored raw package.

[Final recovery audit](audit-qwen38-final-recovery-addendum-20261015.json) is clear: all366tutor rows were checked, exactly one error/missing judgment was eligible, the supplemental exact-key judge result matches checkedResult, and reconstructed final gates match11/20issues. Native report hash and transfer results remain unchanged. The resource monitor was stopped after completion; no application process, hosted function or model secret was changed.
