# DeepSeek tutoring comparison record

Intent: trace the user-requested model comparison to the canonical evaluation plan and preserved experimental evidence.

Updated: 2026-11-13. Source baseline: `0b9f5d9`.

The user changed the local OAI configuration to DeepSeek and requested a comparison with Qwen3.8-flash for recognition before action, disclosure, factual accuracy and responsive progression. The evaluation plan now links the [focused comparison](../../../evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-comparison/README.md).

The new comparison reuses the previous final candidate prompt and real template learning points. A common calibrated judge regrades both target arms. The design distinguishes identical fixed inputs from controlled trajectories that contain each model's actual prior replies, and retains original Qwen scores separately. Model/provider packaging is the intended change; rubric meanings and teaching requirements are unchanged.

Execution results and validation belong in the comparison's report and experiment log. This documentation addition makes no release or full-suite acceptance claim.
