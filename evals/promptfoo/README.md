# Promptfoo Tutor Behavior Evaluation

Intent: document how to review and run the local Promptfoo benchmark for tutor prompt behavior before spending live LLM calls or changing production prompts.

Updated: 2026-07-18

Source baseline commit: `530bd59`

This benchmark uses ecological webpage-shaped cases (demo room templates) plus holdout account-security cases. The chat user turn matches the product room AI path (`ecologicalTutorCall` / `TutorSuggestionService`): draft the full tutor message, with room scenario + discussion history + latest student line.

## V1 Fixture (ecological)

- Agent preset: `casual_peer`
- Scenario template: `Account Security Alert` (+ demo rooms)
- Baseline prompt: `prompts/current.prompt.txt` (export = live `generateSystemPrompt`)
- Candidate prompt: `prompts/improved.prompt.txt`
- Promptfoo runtime prompts: `prompts/current.chat.prompt.json` and `prompts/improved.chat.prompt.json`
- Cases: `cases/webpage-ecological.yaml` + `cases/account-security-alert.yaml`
- Rubrics: `rubrics/*.md`
- One-shot command: `npm run eval:prompts` (export + eval + gate)
- Browser layer: `npm run test:browser:behavior-demos` (app must be running)

The `.chat.prompt.json` user turn is shared with the website AI button (not the old “brief follow-up question” co-pilot wrapper).

The v1 benchmark stays on one fixture, but the case set includes holdout-style account-alert variations with different platform names, domains, and user relationships. These are intentionally not copied into the improved prompt examples, so the benchmark checks whether the behavior transfers within the scenario instead of only matching memorized strings.

## Review Order

1. Read `cases/account-security-alert.yaml`.
2. Read every rubric in `rubrics/`.
3. Compare `prompts/current.prompt.txt` and `prompts/improved.prompt.txt`.
4. Tighten any vague case or rubric before running live evaluation.

The baseline should expose known weaknesses from `user_feedback.md`: repeated questions, excessive praise, soft validation of wrong answers, fake first-person examples, and limited practical guidance.

## Two-layer design

| Layer | Command | What it checks |
| --- | --- | --- |
| **1. Promptfoo (ecological)** | `npm run eval:prompts` | Export live product prompt → run ecological + holdout cases → quality gate |
| **2. Real browser** | `npm run test:browser:behavior-demos` | Login as tutor, create demo rooms from Supabase, click ✨ AI, score suggestions |

From `tutor-system/`:

```bash
# Layer 1 — one command (export + live eval + gate)
npm run eval:prompts

# Layer 2 — app must be running (e.g. PORT=3001 npm start)
npm run test:browser:behavior-demos
```

`npm run eval:prompts` needs a live model key (`OPENAI_API_KEY` or `REACT_APP_OAI_API_KEY` in `.env`).

Optional low-level pieces (usually unused):

```bash
npm run eval:prompts:export-current   # only refresh fixtures
npm run eval:prompts:report           # only run Promptfoo
npm run eval:prompts:gate             # only score latest.json
npm run eval:prompts:view             # open HTML report
```

The quality gate requires the improved prompt to pass at least 80% for each metric and to match or beat the current prompt on every metric.

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

## Related product-path E2E

Promptfoo judges frozen prompt fixtures. For a live product-path smoke check that builds the current `casual_peer` prompt in code and calls `OpenAIService.generateResponse`, run from `tutor-system/`:

```bash
npm run test:integration:tutor-behavior
```

That suite is opt-in (`RUN_LIVE_OPENAI_TESTS=true`), uses deterministic heuristics (not LLM judges), and covers the same feedback items (1–6, 8) with a smaller case set. Prefer Promptfoo for release-quality gates; use the product-path E2E to catch drift between production `generateSystemPrompt` and the evaluated behavior.

## Expansion Rule

Only expand after the improved prompt passes the reviewed v1 benchmark:

1. Add `casual_peer + Nintendo Switch Deal ($19.99)`.
2. Add `casual_peer + iTunes Gift Card Survey ($500)`.
3. Add one privacy scenario.
4. Add `supportive_adult` only after the knowledgeable-peer behavior is stable.
