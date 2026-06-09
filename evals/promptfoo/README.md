# Promptfoo Tutor Behavior Evaluation

Intent: document how to review and run the local Promptfoo benchmark for tutor prompt behavior before spending live LLM calls or changing production prompts.

Updated: 2026-06-09

Source baseline commit: `530bd59`

This benchmark starts with one fixed AI situation so cases and rubrics can be inspected, tightened, and trusted before expanding to other room templates or agent configurations.

## V1 Fixture

- Agent preset: `casual_peer`
- Scenario template: `Account Security Alert`
- Baseline prompt: `prompts/current.prompt.txt`
- Candidate prompt: `prompts/improved.prompt.txt`
- Promptfoo runtime prompts: `prompts/current.chat.prompt.json` and `prompts/improved.chat.prompt.json`
- Cases: `cases/account-security-alert.yaml`
- Rubrics: `rubrics/*.md`

This evaluates prompt behavior only. It does not call Supabase, does not exercise the React app, and does not verify UI latency.

The `.chat.prompt.json` files use the same logical message order as the product AI call: one `system` message containing the selected tutor prompt, followed by one `user` message containing scenario context, recent conversation, and the latest student message from the eval case.

## Review Order

1. Read `cases/account-security-alert.yaml`.
2. Read every rubric in `rubrics/`.
3. Compare `prompts/current.prompt.txt` and `prompts/improved.prompt.txt`.
4. Tighten any vague case or rubric before running live evaluation.

The baseline should expose known weaknesses from `user_feedback.md`: repeated questions, excessive praise, soft validation of wrong answers, fake first-person examples, and limited practical guidance.

## Commands

From `tutor-system/`:

```bash
npm run eval:prompts:export-current
npm run eval:prompts
npm run eval:prompts:report
npm run eval:prompts:gate
npm run eval:prompts:ci
npm run eval:prompts:view
```

Do not run `eval:prompts` or `eval:prompts:report` until the evaluation set and rubrics have been reviewed. Those commands call live LLM providers through Promptfoo and require `OPENAI_API_KEY`.

The quality gate is deterministic and runs after a JSON report exists. It requires the improved prompt to pass at least 80% for each metric and to match or beat the current prompt on every metric.

## Expansion Rule

Only expand after the improved prompt passes the reviewed v1 benchmark:

1. Add `casual_peer + Nintendo Switch Deal ($19.99)`.
2. Add `casual_peer + iTunes Gift Card Survey ($500)`.
3. Add one privacy scenario.
4. Add `supportive_adult` only after the knowledgeable-peer behavior is stable.
