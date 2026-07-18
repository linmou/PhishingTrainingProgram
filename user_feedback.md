user feedback on git commit 530bd592d683bf3274ca234fc4df9828df746d7d
relevant google doc: https://docs.google.com/document/d/1-cYuVZW2eU4M9TCgseWvwExDCWAoga76pprqIX5EGEQ/edit?tab=t.0 , 1st prototype feedback

1. Break the question-every-turn pattern. Interleave: explanation → question → explanation, not question → question → question. The chatbot should commit to teaching, not just prompting.
2. Add genuine disagreement and correction. When students give wrong or incomplete answers, the chatbot should redirect rather than validate. This builds trust in its authority and deepens learning.
3. Stabilize the persona. Pick one consistent voice — ideally a "knowledgeable peer" (college-age, informed but not stiff) — and apply it throughout. Optionally, offer a tone toggle at onboarding.
4. Reduce boilerplate encouragement. One genuine acknowledgment per exchange is enough. Constant "great job" reads as hollow scripting to users who know they're chatting with AI.
5. Add more specific knowledge. Real-world tools (URL decompilers, reverse image search, HTTPS indicators) were the highest-valued content. Expand this "what to actually do" layer.
6. Use third-person testimonials, not first-person AI claims. "A person in this situation did X and suffered Y" works; "I once did this and regretted it" breaks trust.
7. Fix response latency. Add a typing indicator. Prioritize a fast first acknowledgment to hold the user in the room, then deliver the full response.
8. Simplify language for younger audiences. Words like "urgency tactics" or "outright" confused child participants. The chatbot should detect user age/reading level and adjust.
9. Consider multi-bot simulation. Claudia's insight: a formal bot alongside an informal peer bot would feel more like a real social forum, with the safety message reaching users through multiple voices.

## Feedback status (as of 2026-07-18)

| # | Feedback | Status | How addressed |
| --- | --- | --- | --- |
| 1 | No question-every-turn | **Done (prompt + product path)** | System prompt tight rhythm; room AI user turn asks for a short tutor reply, not a follow-up question |
| 2 | Direct correction | **Done (prompt + product path)** | System prompt + ecological turn: correct wrong/incomplete answers, then one safe action |
| 3 | Stable persona | **Done (prompt)** | Knowledgeable peer coach; no fake friend/parent/personal history |
| 4 | Less hollow praise | **Done (prompt)** | Low enthusiasm/validation in `casual_peer`; brief specific acknowledgment only |
| 5 | Concrete safety knowledge | **Done (prompt + product path)** | Default safe actions in system prompt; user turn requires one concrete action; short length keeps focus |
| 6 | Third-person examples | **Done (prompt)** | Third-person only; demo room “Did this ever happen to you?” |
| 7 | Latency / typing indicator | **Open** | Needs UI/runtime (not prompt-only) |
| 8 | Simpler language | **Done (prompt)** | Reading-level substitutions; short replies reduce jargon piles |
| 9 | Multi-bot simulation | **Reinterpreted (product)** | Student opt-in Peer/Adult tone (1:1 only); locks tutor personality control — not dual bots |

---

## Phase 1 — Prompt improvement summary (2026-06-09)

Intent: record which prototype feedback items were improved by the prompt-only work, which prompt changes were made for each item, and what evaluation gate passed before the prompt was moved into `tutor-system`.

Updated: 2026-06-09

Implementation commits:
- `8ea9cc4 feat(eval): add prompt behavior quality gate`
- `64b2898 test(eval): refine prompt behavior benchmark`
- `f8cdc7e fix(ai): gate and update tutor prompt behavior`

### Improved By Prompt Changes

1. Break the question-every-turn pattern.
   - Prompt change: replaced the old 3-stage learning process with a tight tutoring rhythm in `tutor-system/src/services/prompts/index.ts`: teach one concrete point first, ask at most one focused question only when useful, and do not end every response with a question.
   - Supporting role change: the peer role in `tutor-system/src/services/prompts/pedagogy/parameters/roleParameters.ts` repeats the same response pattern.
   - Evaluation evidence: Promptfoo metric `turn_rhythm` passed `9/9` for the improved prompt.

2. Add genuine disagreement and correction.
   - Prompt change: added direct correction instructions before encouragement in `tutor-system/src/services/prompts/index.ts`.
   - Supporting parameter change: `mistake_normalization.high` now says to correct unsafe reasoning directly in `tutor-system/src/services/prompts/pedagogy/parameters/emotionalParameters.ts`.
   - Example added: direct correction for the unsafe claim that a lock icon proves a site is real.
   - Evaluation evidence: Promptfoo metric `direct_correction` passed `8/8`.

3. Stabilize the persona.
   - Prompt change: rewrote the peer role as a knowledgeable peer coach, not a fake friend, parent, or performer.
   - Supporting base prompt change: `BASE_SYSTEM_PROMPT` now frames the bot as a knowledgeable phishing-training tutor.
   - Guardrail added: do not claim personal memories, regrets, or lived experience.
   - Evaluation evidence: Promptfoo metric `persona_stability` passed `5/5`.

4. Reduce boilerplate encouragement.
   - Prompt change: validation now allows at most one brief, specific acknowledgment before teaching.
   - Supporting parameter change: high enthusiasm now means restrained lesson-focused energy, not exaggerated praise.
   - Preset change: `casual_peer` now uses low enthusiasm and low validation.
   - Evaluation evidence: Promptfoo metric `low_boilerplate_praise` passed `5/5`.

5. Add more specific knowledge.
   - Prompt change: added concrete safe-action requirements and default safe actions.
   - Examples of safe actions now required: do not click suspicious links, open the real app or real company website yourself, check account settings/security alerts/recent login activity, use the real banking app/site or card phone number for banking alerts, and remember that HTTPS or a lock icon does not prove the site is real.
   - Evaluation evidence: Promptfoo metric `practical_knowledge` passed `15/15`.

6. Use third-person testimonials, not first-person AI claims.
   - Prompt change: personal examples now require third-person examples and relatable analogies, not first-person stories.
   - Example added: a person follows a fake promotion, lands on a page asking for personal details, and gives the scammer useful information.
   - Evaluation evidence: Promptfoo metric `third_person_examples` passed `1/1`.

8. Simplify language for younger audiences.
   - Prompt change: added a reading-level section in `tutor-system/src/services/prompts/index.ts`.
   - Required substitutions: use "pressure words" instead of "urgency tactics", "fake web address" or "wrong website" instead of "illegitimate domain", "check in the real app" instead of "official account verification", "the lock does not prove the site is real" instead of explaining HTTPS encryption, and "real company" or "real app" instead of "legitimate".
   - Evaluation evidence: Promptfoo metric `reading_level` passed `7/8`, pass rate `0.875`, above the `0.8` threshold.

### Not Solved By Prompt-Only Work

7. Fix response latency and add a typing indicator.
   - Reason: this needs product/UI/runtime changes, not only system-prompt changes.
   - Likely work: typing indicator state, streaming or staged response behavior, and latency instrumentation.

9. Consider multi-bot simulation.
   - Original idea: formal bot + informal peer bot in one thread (multi-agent).
   - **Product reinterpretation (implemented):** student may opt in to choose AI tone (Peer | Adult) in single-student rooms; tutor AI Personality locks after choice. Multi-student blocked for now. See `features/student_ai_tone.feature`.

### Evaluation Gate Passed (Phase 1)

Promptfoo accepted run:
- Eval id: `eval-EFn-2026-06-09T18:40:25`
- Cases evaluated: `34`
- Tokens: `110,899`
- Errors: `0`
- Gate result: passed
- Report files:
  - `evals/promptfoo/results/latest.html`
  - `evals/promptfoo/results/latest.json`

Gate definition:
- The improved prompt must pass at least `80%` of applicable assertions for every metric.
- The improved prompt must match or beat the current prompt on every metric.

---

## Phase 2 — Product-path delivery so the website matches the prompt (2026-07-18)

Intent: the Phase 1 system prompt fixed feedback in eval, but the room ✨ AI button still asked the model for a “brief follow-up question,” so learners/tutors did not see the improvements on the real page. Phase 2 aligns the product call with the system prompt and adds ecological evaluation + browser demos.

Updated: 2026-07-18

Implementation commit (AI packaging):
- `5014acf fix(ai): align room AI call with full tutor response packaging`

Related local work (templates, short replies, eval/browser harness — commit separately if needed):
- Ecological user turn + short length (2–4 sentences, ~40–70 words, `max_tokens` ~100)
- Demo room templates with multi-turn realistic dialogue
- Ecological cases generated from the same templates
- Two-layer verification: `npm run eval:prompts` + `npm run test:browser:behavior-demos`

### Gap that Phase 1 did not close

| Path | What the model was asked to do |
| --- | --- |
| Promptfoo / system prompt | Write a full tutor teaching reply |
| Website ✨ AI (before Phase 2) | “Suggest a brief **follow-up question**… under 2 sentences” |

So even with the improved system prompt installed, the website produced question loops again (feedback #1) and soft, short co-pilot hints instead of correction + safe actions (#2, #5).

### Product packaging changes (how the prompt is *used*)

1. **User turn (shared product + Promptfoo)** — `ecologicalTutorCall.ts`
   - Draft the next tutor message the student should hear (not a meta follow-up question).
   - Keep it short: 2–4 short sentences (~40–70 words).
   - If wrong/incomplete: one clear correction + one concrete safe action.
   - At most one short question, and only if needed.

2. **Room AI path** — `TutorSuggestionService` / `generateTutorSuggestion` / `RoomContext`
   - Uses the ecological user turn.
   - Passes the focused student message from the UI.
   - Includes pre-populated discussion in AI context (same thread tutors see).
   - Caps length (`max_tokens` ~100) so replies stay chat-sized.

3. **System prompt content**
   - Phase 1 pedagogy remains the system message (teach, correct, peer coach, safe actions, third-person, reading level).
   - Phase 2 does not re-open multi-bot or latency; it makes the webpage obey Phase 1.

### How packaging maps back to feedback

| # | Feedback | Packaging contribution |
| --- | --- | --- |
| 1 | Question loops | User turn forbids answer-only-with-questions; prefer teaching |
| 2 | Correction | Explicit “correct in one sentence” |
| 3 | Persona | System prompt unchanged; full tutor voice instead of co-pilot quiz |
| 4 | Hollow praise | Short form + system low-praise preset |
| 5 | Concrete actions | One concrete safe action required in user turn |
| 6 | Third-person | System prompt; demo “Did this happen to you?” |
| 8 | Simple language | System reading-level rules; short replies |

### Ecological validity

Cases and demos now use the **same room-template dialogue** as the website:

- Source: `tutor-system/src/services/demoRoomTemplates.ts`
- Export: `npm run eval:prompts:export-ecological-cases` → `evals/promptfoo/cases/webpage-ecological.yaml`
- History packaging matches the product path (`Participant:` / `Tutor/AI:` lines from pre-pop discussion)
- Multi-turn threads: OP post → peer reactions → tutor → student wrong/confused line

### Two-layer verification (current)

```bash
cd tutor-system

# Layer 1 — Promptfoo ecological eval (export fixtures + run + ecological product gate)
npm run eval:prompts

# Layer 2 — real browser + real Supabase rooms from templates only
# (app running, e.g. PORT=3001 npm start)
# Creates rooms on /#/tutor/test-rooms (not the main Tutor room list)
npm run test:browser:behavior-demos
```

UI note (2026-07-18):
- Main Tutor dashboard (`/#/tutor`) “Create room” shows **normal teaching templates** (classics + non-demo catalog).
- Behavior-eval templates named `Demo: …` live only on **`/#/tutor/test-rooms`**.
- Browser demos use that Test Rooms page so they do not pollute “Your Rooms.”

Evidence from Phase 2 verification runs:
- Ecological product gate: **7/7** template-derived cases passed (deterministic heuristics on product-shaped calls).
- Browser demos: **7/7** template-only rooms passed (login → create from template → ✨ AI → short teaching reply).
- Unit suites for packaging/templates: passed after ecological dialogue updates.

### Still open

7. Latency / typing indicator — product UI/runtime.  
9. Multi-bot simulation — product design + multi-voice evals.
