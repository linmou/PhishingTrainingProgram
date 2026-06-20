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

## Prompt Improvement Summary

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
   - Reason: this needs product design and additional evaluation fixtures for multiple agent voices.
   - A single system prompt can adjust tone, but it cannot reliably create a multi-bot simulation.

### Evaluation Gate Passed

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
- The deterministic gate command is `npm run eval:prompts:gate`.

Improved prompt metric results:

| Metric | Result | Pass rate |
| --- | ---: | ---: |
| `turn_rhythm` | `9/9` | `1.0` |
| `direct_correction` | `8/8` | `1.0` |
| `persona_stability` | `5/5` | `1.0` |
| `low_boilerplate_praise` | `5/5` | `1.0` |
| `practical_knowledge` | `15/15` | `1.0` |
| `third_person_examples` | `1/1` | `1.0` |
| `reading_level` | `7/8` | `0.875` |

### Evaluation Reliability Checks

The evaluation set was reviewed with `$review-with-multi-debate`.

Final debate summary:
- `audits/prompt_eval_set_quality_review_iteration3_summary.json`

Reliability improvements made before accepting the prompt:
- Case assertions are tied to observable behavior.
- Each case only evaluates applicable requirements.
- Holdout-style account-alert variations were added so the prompt is not only memorizing one exact example.
- Improved prompt examples do not copy the holdout cases verbatim.
- Promptfoo case loading and complex prompt formatting are covered by integration-style tests.

Local verification passed:
- `npm run eval:prompts:gate`
- Prompt/eval Jest focused run: `9` suites, `47` tests passed.
- `npm run test:tasks`
