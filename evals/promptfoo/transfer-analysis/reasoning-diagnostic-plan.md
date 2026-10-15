# Transfer reasoning-budget diagnostic

Intent: test whether the remaining procedural mistakes arise partly from the current low-budget, reasoning-disabled request configuration.

Date:2026-10-15. Transfer01 improves three-member macro-F1 from57.26% to70.58% but adds invalid responses. Transfer02 restores354/354 validity and repairs several recovery/transfer decisions, yet reaches only69.40% macro-F1. Outputs still violate explicit attribution, scope and state rules. Further equivalent reminders have an uncertain basis.

Compare the unchanged transfer prompt and cleaned02 under a declared diagnostic configuration: enable_thinking true, max_tokens8000, timeout180seconds. ModelQwen3.5Flash, temperature0, JSON output, one target attempt, three repetitions,16workers, full118 logical cases and all gates remain unchanged. Both arms use the same configuration. The original600-token reasoning-disabled conditions remain complete and immutable. This is a combined reasoning/budget factor, not proof that prompt cleanup alone caused a change.

`thinking.cjs` modifies only the two analysis-request literals inside the frozen analyzeMessage function, using AST offsets. The live handler and assessment-generation call remain unchanged. The original and cleaned reasoning arms retain the same modified request configuration and unchanged consumer logic, so `refine.cjs compare` still checks prompt-only differences between those arms. The source patches, settings and full requests are preserved in each freeze. Existing responses cannot represent changed requests, so each new arm requires348 new independent calls; no old result is discarded or resampled under its original condition.

Require independent audit before execution, full existing/expanded coverage, and the same validity, partition, pair and non-regression gates. No release setting changes are adopted by this diagnostic alone.
