# Temporary fourth-grade tutor prompt

Intent: record the temporary adoption decision, known regressions and replacement criteria for the active tutor prompt.

Updated: 2026-11-04. Integration baseline: `a69b836`. Status: temporary fix; benchmark acceptance failed. Scope: default-branch integration requested by the user, with hosted delivery assessed separately.

The user directed: “first merge the new prompt to default branch, but mark it as a tempt fix, since it regressed on many other rubrics.” This explicitly accepts the known tradeoff for temporary integration; it does not change evaluation thresholds or turn the failed experiment into an accepted benchmark.

The active tutor policy adopts `tutor-candidate-01.md` from branch `auto-experiment/fourth-grade-phishing`, experiment commit `5c1867e`. It adds one fourth-grade audience paragraph. The policy matches the experimental candidate after trimming outer whitespace; the runtime export already uses `.trim()`. Normalized policy SHA-256: `3802306babc4a92baf1ecc35241856c3e7eeda357e063ec3b06bd0fcac23c370`. Original candidate file SHA-256: `1479d184e4f57cefcf31a0c36f3d5df765fe5c9230ef38e75d811467bf122969`. The separate assessment-generator candidate is outside this tutor change.

## Known behavior and evidence

The published-source reading rubric scored the tutor baseline 171/183 and candidate 183/183. Both passed the reading threshold. The full candidate comparison failed 37 gate issues:

- Factual-accuracy findings increased from 1 to 6, including unsupported certainty about suspicious sites and incorrect address explanations.
- Response-length passes declined from 181/183 to 175/183.
- Instruction realization declined from 80/90 to 79/90; learning-target quality from 143/147 to 141/147.
- Knowledge quality declined from 139/143 to 131/143 on the common applicable outputs.
- One exact Guard-recovery transition and four semantic-pair checks failed.

The experiment record is `auto_experiments/2026-10-30-fourth-grade-phishing/run-record.md` on the experiment branch; its `raw/education-candidate-01/comparison.json` preserves every gate result. Raw evidence remains in the fourth-grade-phishing worktree, indexed by `evidence-index-1793369450885.json`. Published sources and the distinction between evaluator revisions are documented there. These historical results are not new integrated-branch model measurements.

## Replacement criteria

Resolve documented rubric/lifecycle mismatches, retain the fourth-grade audience requirement, and evaluate an accuracy-preserving replacement against the complete comparable suite with independent holdouts. Require existing accuracy, length, transition, pair and non-regression gates; close missing assessment semantic and instruction-selection holdout coverage before claiming comprehensive acceptance. The temporary marker remains until a reviewed replacement meets those criteria or the user explicitly revises the decision.

Recovery: revert the focused temporary-prompt integration commit to restore the prior tutor policy. No response schema or model settings change in this integration.
