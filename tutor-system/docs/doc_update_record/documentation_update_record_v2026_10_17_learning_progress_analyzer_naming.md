# Learning-progress analyzer naming update

Intent: record the evaluation-suite rename and distinguish current navigation from historical experiment identities.

Date: 2026-10-17. Source baseline: `c6d5129`.

Renamed `evals/promptfoo/transfer-analysis/` to `evals/promptfoo/learning-progress-analyzer/`, including its cases, runners, prompt candidates and records. The canonical evaluation plan and baseline record now use `learning-progress-analyzer-evaluation-*` filenames. Updated executable imports, artifact-source lists and documentation links. The suite README explains its evidence classes, deterministic classification metrics, prompt ownership, candidate meaning, and boundaries relative to tutor and assessment evaluation. The root Promptfoo README now maps those responsibilities.

Case labels, model prompts, thresholds and scoring rules retain their meanings. Historical JSON audit contents, branch names, runtime/behavior identifiers, source hashes, experiment outcomes and archived `output/transfer-analysis-*` directories retain their recorded identities. The moved baseline record explicitly distinguishes historical commands/hashes from current navigation. Old frozen runs still require matching historical source; the rename does not grant new acceptance or bypass source-drift validation. New example runs use `output/learning-progress-analyzer/`.

Validation:

| Check | Evidence |
| --- | --- |
| Before rename: `rtk proxy node --test evals/promptfoo/transfer-analysis/*.test.cjs` | 30/31 passed. The existing legacy detection-area filtering assertion fails because its expected rejected event is absent in the current working-tree handler. |
| After rename: `rtk proxy node --test evals/promptfoo/learning-progress-analyzer/*.test.cjs evals/promptfoo/v1/model-comparison.test.js` | 34/35 passed: the same 30 analyzer checks and all four cross-suite model-comparison checks pass; the same legacy assertion fails at `evaluate.test.cjs:61`. |
| Freeze/replay integration exercised by those tests | New artifact paths resolve; expanded coverage remains 118 logical cases, 354 records and 348 provider-call slots. The added slice remains 40 cases, 120 records and 114 provider-call slots. Tests use mock/replayed provider responses. |
| Rename integrity and navigation | 47 files moved; all 21 JSON case/audit files and all four candidate prompt files match their pre-rename SHA-256 hashes. All 26 checked links to the renamed suite/documents resolve. Remaining old names in executable files refer only to historical output archives. |
| Patch whitespace | `rtk git diff --check` passed. |

This is a local naming/navigation change. No model evaluation or release acceptance is claimed.

## Follow-up review

Reviewed again on 2026-10-17; commit-preparation baseline: `518a07d`. Corrected the remaining active name in the app README, browser workflow description, analyzer dialogue-contract title, source comments and new-run comparison description. Added an explicit mapping from the display name to stable behavior/runtime IDs. Updated an implementation spec's inline runner path and two historical-record navigation references. Repaired the final-assessment record's link to a removed evaluation-plan heading; historical section layouts remain available in frozen packages.

The broader scan covered 800 files, checked 32 links to the renamed suite/documents including Markdown anchors, and resolved all 23 relative imports in or into the analyzer suite. No missing links or imports remain in that scope. All 21 moved JSON files and four prompt candidates still match the original hashes. The focused test command was repeated: 34/35 pass with the same pre-existing legacy-filtering failure at `evaluate.test.cjs:61`.

Commit preparation: the main-thread assessment change is recorded separately at `518a07d`. The naming commit includes both old-path removals and every renamed file, together with the reference/documentation edits described here. Unrelated assessment workflow/release-evidence changes and `tmp/` are excluded. Prior failed model-evaluation verdicts remain unchanged.
