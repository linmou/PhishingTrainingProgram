# Judge thinking configuration

Intent: record the source and declared change of the evaluator setting used after the non-thinking judge failed calibration.

Updated: 2026-11-13. Source baseline: `297a1b3`.

The [official Model Studio deep-thinking documentation](https://www.alibabacloud.com/help/en/model-studio/deep-thinking), fetched on 2026-11-13, lists Qwen3.8 Flash (`qwen3.8-flash`) as a hybrid-thinking model controlled by `enable_thinking`. It also documents non-streaming synchronous output for commercial deep-thinking models. This supports the existing OpenAI-compatible transport with `enable_thinking:true`; no streaming conversion is required.

Version 5 changes the judge to thinking enabled and an 8,000-token limit. The local `evals/promptfoo/v1/settings.json` uses those two values for the earlier Qwen judge, providing project precedent for the cap. The target remains Qwen3.8-flash, temperature 0.3, 600 tokens and thinking disabled. Judge temperature remains 0. The provider's raw response, including returned usage and any reasoning field, is retained; reasoning content is not used as a target behavior score.

All 32 calibration checks receive new calls under the new judge settings. Previous failed calibration records remain evidence, not passing measurements. Model-facing prompts, expected labels, target cases and candidate prompt content retain their previous versions.
