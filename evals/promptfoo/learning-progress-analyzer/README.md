<!-- Updated: 2026-10-17. Naming review baseline: c6d5129; imported evaluation commit: af86353. -->
# Learning-progress analyzer evaluation

Intent: test per-item event classification through the current product handler and preserve reproducible results.

## Scope and naming

The learning-progress analyzer classifies the focus student's contribution for one learning target: no evidence (`none` in reports), `initial_signal`, `demonstrated_understanding`, `contradiction`, `post_repair_signal`, or `spontaneous_transfer`. Ordinary understanding and recovery belong here alongside application in a different situation. For example, D09 checks that agreeing with another student's explanation does not establish the focus student's understanding.

`classification.cjs` compares event predictions with frozen reference labels and reports accuracy, precision, recall, macro-F1 and confusion matrices. The handler/reducer checks also measure applied progress and isolated assessment readiness. These checks use deterministic scoring; free-text explanation quality is outside their scorecard. `grounding-rubric.md` is retained unused preparation.

The production prompt is `TRANSFER_ANALYSIS_SYSTEM_PROMPT` in [assessment-api/index.ts](../../../tutor-system/supabase/functions/assessment-api/index.ts). `refinement-policy-*.md` contains experimental analyzer prompt variants; their numbers identify candidates, not deployed versions. The [full refinement record](full-refinement-run-record.md) pins the tested variants and outcomes.

The tutor's mode/action classification is scored separately by [v1/classification.js](../v1/classification.js). Assessment eligibility, question quality and lifecycle checks live in [v1/transfer/](../v1/transfer/). This suite does not evaluate the next tutor response or whether its teaching strategy agrees with the updated progress.

This directory was renamed from `evals/promptfoo/transfer-analysis/` on 2026-10-17. The evaluation plan and baseline record now use the `learning-progress-analyzer-evaluation-*` filenames. Historical branch names, behavior/protocol IDs, runtime identifiers, frozen JSON audits, hashes and `output/transfer-analysis-*` paths retain their recorded identities. Resolve historical source paths through this rename; use a historical checkout to replay an old source-pinned run. Renaming runners changes artifact identities and does not revalidate past results or permit bypassing drift checks.

## Run the evaluation

The [evaluation plan](../../../tutor-system/docs/ai-behaviors/learning-progress-analyzer-evaluation-plan.md) owns current policy, thresholds and coverage. `evaluate.cjs` retains historical two-arm comparisons. `current.cjs` adds current-handler evaluation using the 40 cases from `improve/transfer-analysis-negatives` commit `af86353`, without importing its archived runtime contract.

The imported files are byte-identical to their source: 20 semantic contrasts in `negative-cases.json`, four spelling/punctuation variants in `surface-cases.json`, and 16 exposed former holdouts in `negative-holdouts-v2.json`. Their original metadata is retained; execution namespaces IDs and scores current events, state, routing and validity. New synthetic identity normalization keeps case IDs and labels out of model input.

```sh
rtk proxy node --test evals/promptfoo/learning-progress-analyzer/evaluate.test.cjs evals/promptfoo/learning-progress-analyzer/classification.test.cjs evals/promptfoo/learning-progress-analyzer/current.test.cjs
rtk proxy node evals/promptfoo/learning-progress-analyzer/current.cjs freeze output/learning-progress-analyzer/added-01 --coverage added
rtk proxy env OAI_MODEL=qwen3.5-flash caffeinate -i node evals/promptfoo/learning-progress-analyzer/current.cjs run output/learning-progress-analyzer/added-01 --num_workers 16
rtk proxy node evals/promptfoo/learning-progress-analyzer/current.cjs report output/learning-progress-analyzer/added-01
```

Prerequisites: local `tutor-system/node_modules`, configured `OAI_API_KEY`, `OAI_BASE_URL`, `OAI_MODEL`, and the archived production source/export under `output/transfer-analysis-eval-20261013`. The current snapshot reads working-tree handler dependencies. No live database is used. Freeze requires a new directory; run resumes exact saved successes and failures. Report and resume reject changed runner/scorer identities or mismatched saved requests. Run a disk/progress monitor alongside model work.

Added coverage is 40 logical cases, three repetitions, 120 records. Two exact-input aliases reuse their corresponding repetitions: 38 unique inputs and 114 fresh calls. Reports disclose dependent observations and include a unique-input diagnostic. Formal macro-F1, no-event recall, existing four metrics, pairs and all partitions remain separate gates. Human label review remains pending.

For any next refinement, freeze with `--coverage full`: all 73 original cases, all 40 additions, and five separate propagated sequence steps. Three fixed-input repetitions support classification; propagated sequences retain operational checks outside ensembles. This produces 354 logical records from 348 calls. Changes to a component require comparable full evidence; unchanged components and completed judgments can be reused with pinned provenance.

The learning-progress analyzer is shared across tutor prompt candidates, so its result is shared evidence. Earlier analyzer outputs belong to different frozen prompts and are reported separately. The [completed added-case record](current-added-run-record.md) reports79/120 event/state checks passing and failed classification gates, with full evidence identities. Raw input/output artifacts remain under ignored `output/`; only code, source cases, methodology and audit records are tracked.
