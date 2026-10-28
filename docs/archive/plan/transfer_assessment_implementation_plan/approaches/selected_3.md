# Selected Approach 3: Evaluation First

- Core strategy: freeze cases, rubrics, semantic metrics, and gates before prompt/runtime edits.
- Primary optimization target: measurable AI behavior and reproducibility.
- Decomposition boundary: spec, fixtures, harness, baseline/candidate, holdout, product checks.
- Sequencing principle: define expected behavior, validate evaluators, then implement and compare.
- Main tradeoff: live feature work waits for evaluation decisions.
- Major risk: evaluator scope can be overbuilt before product integration stabilizes.

## Required evaluation contract

Add transfer-specific deterministic fixtures and semantic metrics for trigger/target, medium transfer, item validity, follow-up, and verification evidence. Keep exact grading, IDs, authorization, transactions, and response shape as supporting checks. Preserve legacy assertions, calibrate judges, run unchanged and contract-compatible baselines, compare candidates on the same frozen cases, and use independent holdouts before any release claim.
