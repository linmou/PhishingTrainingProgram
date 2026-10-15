<!-- Updated: 2026-10-15. Source baseline: 8dc7271; imported evaluation commit: af86353. -->
# Transfer analysis evaluation

Intent: test per-item event classification through the current product handler and preserve reproducible results.

The [evaluation plan](../../../tutor-system/docs/ai-behaviors/transfer-analysis-evaluation-plan.md) owns current policy, thresholds and coverage. `evaluate.cjs` retains historical two-arm comparisons. `current.cjs` adds current-handler evaluation using the 40 cases from `improve/transfer-analysis-negatives` commit `af86353`, without importing its archived runtime contract.

The imported files are byte-identical to their source: 20 semantic contrasts in `negative-cases.json`, four spelling/punctuation variants in `surface-cases.json`, and 16 exposed former holdouts in `negative-holdouts-v2.json`. Their original metadata is retained; execution namespaces IDs and scores current events, state, routing and validity. New synthetic identity normalization keeps case IDs and labels out of model input.

```sh
rtk proxy node --test evals/promptfoo/transfer-analysis/evaluate.test.cjs evals/promptfoo/transfer-analysis/classification.test.cjs evals/promptfoo/transfer-analysis/current.test.cjs
rtk proxy node evals/promptfoo/transfer-analysis/current.cjs freeze output/transfer-analysis-current/added-01 --coverage added
rtk proxy env OAI_MODEL=qwen3.5-flash caffeinate -i node evals/promptfoo/transfer-analysis/current.cjs run output/transfer-analysis-current/added-01 --num_workers 16
rtk proxy node evals/promptfoo/transfer-analysis/current.cjs report output/transfer-analysis-current/added-01
```

Prerequisites: local `tutor-system/node_modules`, configured `OAI_API_KEY`, `OAI_BASE_URL`, `OAI_MODEL`, and the archived production source/export under `output/transfer-analysis-eval-20261013`. The current snapshot reads working-tree handler dependencies. No live database is used. Freeze requires a new directory; run resumes exact saved successes and failures. Report and resume reject changed runner/scorer identities or mismatched saved requests. Run a disk/progress monitor alongside model work.

Added coverage is 40 logical cases, three repetitions, 120 records. Two exact-input aliases reuse their corresponding repetitions: 38 unique inputs and 114 fresh calls. Reports disclose dependent observations and include a unique-input diagnostic. Formal macro-F1, no-event recall, existing four metrics, pairs and all partitions remain separate gates. Human label review remains pending.

For any next refinement, freeze with `--coverage full`: all 73 original cases, all 40 additions, and five separate propagated sequence steps. Three fixed-input repetitions support classification; propagated sequences retain operational checks outside ensembles. This produces 354 logical records from 348 calls. Changes to a component require comparable full evidence; unchanged components and completed judgments can be reused with pinned provenance.

The current transfer component is shared across tutor prompt candidates, so its result is shared evidence. Earlier transfer outputs belong to different frozen prompts and are reported separately. The [completed added-case record](current-added-run-record.md) reports79/120 event/state checks passing and failed classification gates, with full evidence identities. Raw input/output artifacts remain under ignored `output/`; only code, source cases, methodology and audit records are tracked.
