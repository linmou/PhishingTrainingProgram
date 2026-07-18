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

The v1 benchmark stays on one fixture, but the case set includes holdout-style account-alert variations with different platform names, domains, and user relationships. These are intentionally not copied into the improved prompt examples, so the benchmark checks whether the behavior transfers within the scenario instead of only matching memorized strings.

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
npm run eval:prompts:import
npm run eval:prompts:view
npm run eval:prompts:share
```

Do not run `eval:prompts` or `eval:prompts:report` until the evaluation set and rubrics have been reviewed. Those commands call live LLM providers through Promptfoo and require `OPENAI_API_KEY`.

### Official visualization and sharing (Promptfoo only)

Use Promptfoo’s own UI and share flow — not a custom website.

1. **Interactive viewer (local)** — after a run, or after importing a saved export:

   ```bash
   # If you only have results/latest.json on disk:
   npm run eval:prompts:import
   npm run eval:prompts:view
   ```

   This starts Promptfoo’s browser UI (default [http://localhost:15500](http://localhost:15500)). See [Web viewer](https://www.promptfoo.dev/docs/usage/web-ui/).

2. **Standalone HTML report** — produced by `eval:prompts:report`:

   ```text
   evals/promptfoo/results/latest.html
   ```

   Self-contained file; open in a browser or attach in email/Slack. See [Output formats](https://www.promptfoo.dev/docs/configuration/outputs/).

3. **Public web (official Promptfoo UI, shared on the internet)** — run the real `promptfoo view` server, then tunnel it:

   ```bash
   # terminal 1 — official viewer (do not rebuild a custom site)
   npm run eval:prompts:import
   npm run eval:prompts:view:public

   # terminal 2 — public URL (ephemeral trycloudflare hostname)
   cloudflared tunnel --url http://127.0.0.1:15500
   ```

   Open the printed `https://….trycloudflare.com` URL (Promptfoo serves the app at `/` and `/eval`). Anyone with the link can use the real Promptfoo results UI while the tunnel and laptop are up.

4. **Promptfoo cloud share** (stable org-private link, needs API key from [promptfoo.app/welcome](https://promptfoo.app/welcome)):

   ```bash
   npx promptfoo auth login -k YOUR_API_KEY
   npm run eval:prompts:share
   ```

   Or Share from the web UI: Eval actions → Share. See [Sharing](https://www.promptfoo.dev/docs/usage/sharing/).

The quality gate is deterministic and runs after a JSON report exists. It requires the improved prompt to pass at least 80% for each metric and to match or beat the current prompt on every metric.

Each case declares its own applicable rubric assertions. Keep `applicable_requirements` and each case's `assert` list aligned so the judge only scores behavior that is observable in that case.

## Latest Accepted Gate

- Date: 2026-06-09
- Promptfoo eval id: `eval-EFn-2026-06-09T18:40:25`
- Cases evaluated: 34
- Tokens: 110,899
- Errors: 0
- Gate: passed
- Threshold: 80% per metric, with the improved prompt required to match or beat the current prompt on every metric

Improved prompt metric results:
- `turn_rhythm`: 9/9
- `direct_correction`: 8/8
- `persona_stability`: 5/5
- `low_boilerplate_praise`: 5/5
- `practical_knowledge`: 15/15
- `third_person_examples`: 1/1
- `reading_level`: 7/8

This gate supports production prompt changes for feedback about repeated question loops, soft correction, unstable persona, excessive generic praise, vague safety advice, fake personal testimonials, and over-complex language. It does not cover UI latency/typing indicators or multi-bot simulation requests.

## Expansion Rule

Only expand after the improved prompt passes the reviewed v1 benchmark:

1. Add `casual_peer + Nintendo Switch Deal ($19.99)`.
2. Add `casual_peer + iTunes Gift Card Survey ($500)`.
3. Add one privacy scenario.
4. Add `supportive_adult` only after the knowledgeable-peer behavior is stable.
