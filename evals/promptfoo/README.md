# Promptfoo Tutor Behavior Evaluation

Intent: document how to review and run the local Promptfoo benchmark for tutor prompt behavior before spending live LLM calls or changing production prompts.

Updated: 2026-08-30

Source baseline commit: `530bd59`

This benchmark uses ecological webpage-shaped cases (generated from demo room templates) plus explicitly synthetic holdout account-security cases. The chat user turn matches the product room AI path (`buildEcologicalChatCompletionMessages` / `TutorSuggestionService`): draft the full tutor message, with room scenario + discussion history + latest student line.

The active model is only `qwen3.5-flash` through DashScope's OpenAI-compatible endpoint. Both runtime paths send `enable_thinking: false`; responses are preserved verbatim apart from the existing wrapped-quote cleanup.

## V1 Fixture (ecological)

- Agent preset: `casual_peer`
- Scenario template: `Account Security Alert` (+ demo rooms)
- Active prompt: `prompts/current.prompt.txt` (export = live `generateSystemPrompt`)
- Promptfoo runtime prompt: `prompts/current.chat.prompt.json`
- Cases: `cases/webpage-ecological.yaml` + `cases/account-security-alert.yaml`
- Rubrics: `rubrics/*.md`
- One-shot command: `npm run eval:prompts` (export + eval + gate)
- Browser layer: `npm run test:browser:behavior-demos` (app must be running)

The `.chat.prompt.json` user turn is shared with the website AI button (not the old “brief follow-up question” co-pilot wrapper).

The v1 benchmark stays on one fixture, but the case set includes holdout-style account-alert variations with different platform names, domains, and user relationships. These synthetic holdouts are intentionally separate from the product-derived ecological cases, so the benchmark checks whether the behavior transfers within the scenario instead of only matching memorized strings.

## Review Order

1. Read `cases/account-security-alert.yaml`.
2. Read every rubric in `rubrics/`.
3. Check that each case declares `source_type`, `scaffolding_status`, and `response_length`.

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

`npm run eval:prompts` needs `REACT_APP_OAI_API_KEY` in `tutor-system/.env`; `REACT_APP_OAI_BASE_URL` defaults to the DashScope international endpoint.

Optional low-level pieces (usually unused):

```bash
npm run eval:prompts:export-current   # only refresh fixtures
npm run eval:prompts:report           # only run Promptfoo
npm run eval:prompts:gate             # only score latest.json
npm run eval:prompts:view             # open HTML report
```

The blocking quality gate applies the same 80% threshold to all eight metrics (`turn_rhythm`, `direct_correction`, `persona_stability`, `low_boilerplate_praise`, `practical_knowledge`, `third_person_examples`, `reading_level`, and deterministic `response_length`). It requires ecological and synthetic-holdout suites to pass independently, and requires `direct_correction` to pass independently for `not_started` and `failed` scaffold states. There is no improved-prompt comparison and no 100% requirement.

`response_length` counts English word-like and sentence segments with `Intl.Segmenter`; empty output, over three sentences, or over 50 words fails. Runtime code does not clip, summarize, retry, or replace an over-limit Qwen answer.

Each case declares its own applicable rubric assertions. Keep `applicable_requirements` and each case's `assert` list aligned so the judge only scores behavior that is observable in that case.

## Historical GPT Gate

- Date: 2026-06-09
- Promptfoo eval id: `eval-EFn-2026-06-09T18:40:25`
- Cases evaluated: 34
- Tokens: 110,899
- Errors: 0
- Gate: passed
- Threshold: 80% per metric, with a historical current-versus-improved comparison (this rule is not used by the active Qwen gate)

Improved prompt metric results:
- `turn_rhythm`: 9/9
- `direct_correction`: 8/8
- `persona_stability`: 5/5
- `low_boilerplate_praise`: 5/5
- `practical_knowledge`: 15/15
- `third_person_examples`: 1/1
- `reading_level`: 7/8

That record is retained as historical evidence. It is not the active Qwen verdict and is not used by the current gate.

## Related product-path E2E

Promptfoo judges the frozen current fixture. For a live product-path smoke check that builds the current `casual_peer` prompt in code and calls `QwenService.generateResponse`, run from `tutor-system/`:

```bash
npm run test:integration:tutor-behavior
```

That suite is opt-in (`RUN_LIVE_QWEN_TESTS=true`), uses deterministic heuristics (not LLM judges), and catches drift between production `generateSystemPrompt` and the evaluated behavior.

## Expansion Rule

Only expand after the active Qwen prompt passes the reviewed v1 benchmark:

1. Add `casual_peer + Nintendo Switch Deal ($19.99)`.
2. Add `casual_peer + iTunes Gift Card Survey ($500)`.
3. Add one privacy scenario.
4. Add `supportive_adult` only after the knowledgeable-peer behavior is stable.
