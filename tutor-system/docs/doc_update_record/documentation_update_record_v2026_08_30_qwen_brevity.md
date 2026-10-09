# Documentation update record — 2026-08-30

Intent: record the documentation changes accompanying the Qwen-only tutor and Promptfoo brevity redesign.

- Documented `qwen3.5-flash` as the sole runtime/UI model and DashScope-compatible transport.
- Documented `enable_thinking: false`, prompt-controlled three-sentence/50-word behavior, and the absence of runtime clipping.
- Documented the eight-metric 80% blocking gate, conditional correction states, ecological product-template provenance, and synthetic holdouts.
- Renamed live integration commands and gates from OpenAI to Qwen terminology.
- Corrected active documentation to distinguish the failed Qwen run from the preserved historical GPT comparison and to describe holdouts as synthetic rather than product-identical.
- Removed the redundant independent ecological Qwen evaluator from the active Promptfoo runner; ecological cases remain evaluated by Promptfoo and the browser tier remains a separate product check.
