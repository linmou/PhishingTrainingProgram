# Deprecated: custom eval website

**Do not use this folder as the evaluation UI.**

The official Promptfoo visualization is:

| Goal | Command (from `tutor-system/`) |
|------|--------------------------------|
| Interactive browser UI | `npm run eval:prompts:view` → `promptfoo view` |
| Load saved JSON into the local viewer | `npm run eval:prompts:import` → `promptfoo import --force ../evals/promptfoo/results/latest.json` |
| Standalone HTML report | open `evals/promptfoo/results/latest.html` (from `npm run eval:prompts:report`) |
| Share URL with others | `npm run eval:prompts:share` after `promptfoo auth login -k YOUR_API_KEY` |

Docs:

- [Web viewer](https://www.promptfoo.dev/docs/usage/web-ui/)
- [Outputs / HTML](https://www.promptfoo.dev/docs/configuration/outputs/)
- [Sharing](https://www.promptfoo.dev/docs/usage/sharing/)

Primary project docs: [`../promptfoo/README.md`](../promptfoo/README.md)

This directory previously held experimental / PRD mock review surfaces and a homemade table UI. Those are **not** the Promptfoo product path and are not maintained for public hosting.
