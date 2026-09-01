# Prompt changes vs Phase 0 — feedback by feedback

**Intent:** Show, for each prototype feedback item, what changed from the Phase 0 (raw) prompt to the final prompt, which tests cover it, and a model reply that meets the requirement.

**Updated:** 2026-08-31 (correct-answer knowledge-inventory continuation and live evidence)

**Phase 0 (raw):** system prompt / pedagogy before `f8cdc7e` (3-stage discovery, high-praise peer, no reading-level block, no default safe actions, Socratic examples). Room AI user turn still asked for a “brief follow-up **question**” (`aiService.original.ts`).

**Final:** production `generateSystemPrompt` + `casual_peer` preset + ecological user turn (`ecologicalTutorCall.ts`) used by the room ✨ AI and evaluated by the Qwen Promptfoo benchmark.

**Key commits:**  
- `f8cdc7e` — system prompt  
- `5014acf` — product packaging / ecological user turn  
- `6980272` — student Peer/Adult tone (1:1), default `gpt-4o-mini`, drop auth diagnostics  
- `29ba240` — student AI tone control placed above comment input  
- `1b90c40` — Qwen Promptfoo evaluation made the sole active LLM evaluator; concise response policy

Open items (not prompt text): **#7 latency/typing indicator** only.  
**#9** product path **done** as student tone opt-in (not dual-bot multi-agent).

### Active evaluator after `1b90c40`

- The active LLM evaluator is `qwen3.5-flash` through the DashScope OpenAI-compatible endpoint, with `enable_thinking: false`.
- Promptfoo evaluates one active prompt, `evals/promptfoo/prompts/current.chat.prompt.json`; the old current-versus-improved prompt comparison was removed.
- The blocking gate covers eight metrics, including deterministic `response_length`, with an 80% threshold applied independently to product-template ecological cases, synthetic holdouts, and `not_started` / `failed` direct-correction states.
- The active Qwen run recorded in `tutor-system/claude_docs/aiService.md` did **not** satisfy the rubrics: `eval-SqR-2026-08-30T22:54:55`. Evidence is preserved under `evals/promptfoo/results/qwen3.5-flash/20260830T225452Z/`.
- Historical GPT comparison results below remain useful evidence about the earlier prompt, but are not the active Qwen verdict or gate input.
- The real-browser demos and deterministic product-path E2E remain separate validation layers; they are not additional LLM evaluators.

---

## Feedback 1 — Break the question-every-turn pattern

**Requirement:** Interleave teaching with questions; commit to teaching; do not run question → question → question.

### Prompt change (Phase 0 → final)

Learning process in `tutor-system/src/services/prompts/index.ts`:

```diff
 ## Learning Process:
-Always follow the 3-stage learning process:
-1. Get their first reaction without influencing them
-2. Ask why they think that - understand their reasoning
-3. Fill knowledge gaps using appropriate scaffolding techniques
+Use a tight tutoring rhythm:
+- Teach one concrete point first.
+- Ask at most one focused question when it helps the student think.
+- If the student is wrong or incomplete, correct the mistake directly before encouraging them.
+- Include one concrete safe action when the student is unsure, wrong, or asking what to do.
+- Do not stop at "be careful", "be cautious", or "check it." Say exactly what to check or where to go.
+- Do not end every response with a question.
```

Style examples (same file): Socratic multi-question scripts replaced with short teach/correct examples (see Feedback 2 / 5 / 6).

Product **user turn** (Phase 2) — was co-pilot quiz, now full tutor reply:

```diff
-Based on the recent conversation below, suggest a brief follow-up question or prompt
-that a tutor could use to engage the student further. The suggestion should be under
-2 sentences, interactive, and focused on deepening the student's understanding.
+Draft the next tutor message the student should hear.
+Keep it short: use no more than 3 sentences and 50 words.
+Teach one point or ask one focused question; do not use question chains.
+Before any failed scaffold, allow either one focused question or concise direct teaching.
+If the immediately preceding tutor turn asked a question and the latest student answer remains unsafe or incomplete, directly correct the misconception and give one concrete safe action; do not ask another question instead.
+A first-round direct correction is allowed when the student is about to take an unsafe action.
```

Sources: Phase 0 `aiService.original.ts`; final `ecologicalTutorCall.ts` → `buildEcologicalTutorUserTurn`.

### Tests

| Layer | Case / suite | Metrics |
| --- | --- | --- |
| Promptfoo ecological | All `webpage_*` cases in `evals/promptfoo/cases/webpage-ecological.yaml` | `turn_rhythm` |
| Heuristics unit | `tutor-system/src/services/__tests__/tutorBehaviorHeuristics.test.ts` | `turn_rhythm` |
| Live E2E (opt-in) | `student_notices_misspelling_only`, `student_gives_vague_answer`, … in `tutor_behavior_e2e.test.ts` | `turn_rhythm` |
| Browser demos | All 7 template rooms (`tmp/browser_demo_runs/report.json`) | `turn_rhythm` |

### Model response that satisfies

**Student:** “I think it is real because it says my account is at risk.”  
**Case:** `webpage_account_security_alert_classic` (browser demo)

> That is incorrect. Just because it says "your account is at risk" does not mean it is real. … Do not click the link. Instead, open the real app or type the official website address directly into your browser…

**Why it matches:** Teaches and corrects; **zero** questions; not a “What do you think?” loop.

---

## Feedback 2 — Genuine disagreement and correction

**Requirement:** When the student is wrong or incomplete, redirect/correct instead of soft-validating.

### Prompt change (Phase 0 → final)

Learning process (see Feedback 1) adds:

```diff
+If the student is wrong or incomplete, correct the mistake directly before encouraging them.
```

`mistake_normalization.high` in `emotionalParameters.ts`:

```diff
-Frame mistakes as normal learning experiences that happen to everyone.
-Example: "Ooh, this one got you! Don't worry - this scam fools tons of people. Even adults fall for it."
+Correct unsafe reasoning directly, then keep the student moving.
+Example: "Not quite. A lock icon does not prove the site is real. Check the web address."
```

Dialog example added in `index.ts`:

```diff
+#Direct correction
+Teen: It has a lock icon, so it is safe.
+Bot: Not quite. The lock does not prove the site is real. A fake site can have a lock too.
+Check the website name, and use the real app instead of the link.
```

Ecological user turn:

```diff
+If the student is wrong or incomplete, correct them in one clear sentence, then give one concrete safe action.
```

### Tests

| Layer | Case | Metrics |
| --- | --- | --- |
| Ecological / browser | `webpage_demo_lock_icon_myth` | `direct_correction`, `practical_knowledge`, … |
| Ecological / browser | `webpage_demo_click_impulse` | `direct_correction`, … |
| Ecological / browser | `webpage_account_security_alert_classic` | `direct_correction`, … |
| Ecological / browser | `webpage_nintendo_click_deal` | `direct_correction`, … |
| Ecological / browser | `webpage_itunes_professional_photo` | `direct_correction`, … |
| Live E2E | `student_wants_to_click`, `student_trusts_https`, `student_thinks_alert_is_real` | `direct_correction` |

### Model response that satisfies

**Student:** “If the site has HTTPS or a lock icon, then it should be safe, right?”  
**Case:** `webpage_demo_lock_icon_myth`

> That is incorrect. The lock icon and HTTPS do not guarantee that a site is safe. Scammers can create fake websites that also display these features. … Do not click the link in the post. Instead, manually type the official website address into your browser…

**Why it matches:** Explicit “That is incorrect” + wrong belief named + no “you’re right that…”.

---

## Feedback 3 — Stabilize the persona (knowledgeable peer)

**Requirement:** One consistent voice — college-age knowledgeable peer, not fake friend / parent / performer with personal history. Optional tone choice is product: student Peer/Adult opt-in near comment input (see Feedback 9; not a separate onboarding flow).

### Prompt change (Phase 0 → final)

`basePrompt.ts`:

```diff
-You are a professional teacher in an online teaching platform that helps students to understand the some knowledge.
+You are a knowledgeable tutor in a phishing-training session. Teach online safety clearly, directly, and with practical next steps.
```

Peer role (`roleParameters.ts` low / `casual_peer`):

```diff
-## Your Role: Peer Learner
-You position yourself as a fellow learner navigating scam detection alongside the teen.
-Use casual, relatable language like "Dude, this is so sketchy" and admit shared vulnerabilities
-with phrases like "Honestly, I fall for stuff like this too sometimes."
-Emphasize collaborative discovery through questions like "What do you think we should check?"
+## Your Role: Peer Learner
+You are a knowledgeable peer coach for teen phishing training. Sound college-age, informed,
+direct, and relaxed. Teach clearly without pretending to be the student's friend, parent,
+or a person with your own past experiences.
+… (tight tutoring rhythm) …
+Use third-person examples only. … Do not claim personal memories, regrets, or lived experience.
+Key distinction: Be a knowledgeable peer coach, not a fake friend, parent, or performer.
```

Trusted-adult role: removed “In my experience helping people with scams…”.

`casual_peer` preset (`presets.ts`) — less performer energy:

```diff
-teen_slang: high, conversational_markers: high
-perspective_taking: high
-enthusiasm_level: high, validation_frequency: high
+teen_slang: low, conversational_markers: low
+perspective_taking: low
+enthusiasm_level: low, validation_frequency: low
```

### Tests

| Layer | Case | Metrics |
| --- | --- | --- |
| Ecological / browser | `webpage_demo_pressure_words` | `persona_stability` |
| Ecological / browser | `webpage_demo_personal_story_trap` | `persona_stability` |
| Live E2E | `younger_student_confused`, `student_asks_personal_story` | `persona_stability` |
| Historical GPT Promptfoo gate | `persona_stability` suite | `5/5` |

### Model response that satisfies

**Student:** “Did this ever happen to you?”  
**Case:** `webpage_demo_personal_story_trap`

> A common scenario is when a person receives a message claiming their account is at risk… To stay safe, do not click the link… open the real app or type the official website address…

**Why it matches:** Peer coach teaching pattern; no “when this happened to me” / parent / slang performance.

---

## Feedback 4 — Reduce boilerplate encouragement

**Requirement:** One genuine acknowledgment is enough; constant “great job” reads hollow. After a correct student answer, a short, varied response is acceptable when it either gives a specific acknowledgment or directly reinforces the correct idea with useful teaching. A brief “That is correct” is acceptable when it is followed by specific teaching and is not repeated boilerplate.

### Prompt change (Phase 0 → final)

`emotionalParameters.ts`:

```diff
 enthusiasm_level.high:
-Show high energy and excitement… Example: "YES! Absolutely nailed it! That's exactly right!"
+Keep energy restrained… Example: "You caught the spelling issue. Now check the link."

 validation_frequency.high:
-Frequently validate effort… Example: "I totally get why you'd think that - this one's really tricky…"
+Use at most one brief, specific acknowledgment before teaching.
+Example: "You noticed the scary words. The safer check is the real app."

 confidence_building.high:
-Explicitly build confidence and celebrate progress.
-Example: "You're getting really good at this detective work! Your instincts are improving."
+Build confidence through specific evidence, not generic praise.
+Example: "You found the misspelling. The next check is whether the web address matches the real company."
```

`casual_peer` default enthusiasm/validation → **low** (see Feedback 3).

Phase 0 few-shot examples used “Great catch!”, “Perfect!”, “That’s amazing!” throughout; final few-shots do not.

### Tests

| Layer | Case | Metrics |
| --- | --- | --- |
| Ecological / browser, correct student | `webpage_demo_correct_safe_action`, `webpage_demo_correct_lock_reasoning` | `low_boilerplate_praise`, `practical_knowledge`, `turn_rhythm`, `response_length` |
| Synthetic holdout, correct student | `student_correctly_uses_real_bank_channel`, `student_correctly_rejects_https_identity` | `low_boilerplate_praise`, `practical_knowledge`, `turn_rhythm`, `response_length` |
| Existing incorrect/incomplete student coverage | `webpage_nintendo_click_deal`, `webpage_itunes_professional_photo`, `webpage_demo_click_impulse`, `student_wants_to_click` | `low_boilerplate_praise` plus case-specific teaching metrics |
| Heuristics unit | canned “Great job! Amazing!” fails | `low_boilerplate_praise` |

### Model response that satisfies

**Student:** “The lock only protects the connection; it does not prove the site is real. I would check the exact address and use the real app.”
**Case:** `webpage_demo_correct_lock_reasoning`

> You identified the key distinction: the lock protects the connection, not the site's identity. Checking the full address and opening the real app are stronger trust checks.

**Why it matches:** It gives one specific acknowledgment, then reinforces the practical check without stacked praise.

**2026-08-31 targeted live Qwen result:** three of four correct-answer cases passed with the final prompt and rubrics. Both synthetic holdouts and `webpage_demo_correct_lock_reasoning` passed all four applicable metrics. `webpage_demo_correct_safe_action` produced useful reinforcement about an untouched urgency clue, but failed because the turn-rhythm judge returned non-JSON and the deterministic length check counted the quoted `!!ALERT!!` punctuation as five sentence segments despite a 37-word response. Full inputs, outputs, rubric components, model settings, and failure reasons are preserved under `evals/promptfoo/results/qwen3.5-flash/20260831T063908Z/`.

---

## Feedback 5 — More specific safety knowledge (“what to actually do”)

**Requirement:** Concrete tools/checks (domain, real app, reverse image, HTTPS not enough, etc.), not vague “be careful.”

### Prompt change (Phase 0 → final)

`index.ts` — new block (Phase 0 had none):

```diff
+## Default Safe Actions:
+- Do not click suspicious links.
+- Open the real app or type the real company website yourself.
+- Check account settings, security alerts, or recent login activity in the real account.
+- If the alert is about a bank or parent account, use the real banking app/site or the phone number on the card.
+- A lock icon or HTTPS does not prove the site is real. Scammers can use them too.
```

Learning process:

```diff
+- Include one concrete safe action when the student is unsure, wrong, or asking what to do.
+- Do not stop at "be careful", "be cautious", or "check it." Say exactly what to check or where to go.
```

```diff
+#Concrete action
+Teen: What should I do?
+Bot: First, avoid the link in the post. Open the real website yourself, check whether the offer
+or warning exists there, and only continue if the source is clearly official.
```

Ecological user turn requires one concrete safe action when wrong/unsure.

### Tests

| Layer | Case | Metrics |
| --- | --- | --- |
| Ecological / browser | All 7 `webpage_*` cases | `practical_knowledge` (where asserted) |
| Live E2E | click / HTTPS / vague / personal-story cases | `practical_knowledge` |
| Historical GPT Promptfoo gate | `practical_knowledge` | `15/15` |

### Model response that satisfies

**Student:** “I would click it quickly just in case.”  
**Case:** `webpage_demo_click_impulse`

> That is incorrect. … Instead, do not click the link. Open the real website by typing the correct URL into your browser and check if there are any actual alerts or notifications there.

**Why it matches:** Names **do not click** + **type real URL / open real site** (not “be careful”).

---

## Feedback 6 — Third-person testimonials, not first-person AI claims

**Requirement:** “A person who…” works; “I once did this and regretted it” breaks trust.

### Prompt change (Phase 0 → final)

`cognitiveParameters.ts` `personal_examples.high`:

```diff
-Use relatable personal stories and analogies that connect to teen experiences.
-Example: "Think about it - would you give away your phone for free to random people?…"
+Use third-person examples and relatable analogies, not first-person stories.
+Example: "A person who follows a fake giveaway link might land on a page asking for personal details."
```

Peer role forbids personal memories (Feedback 3). Dialog example:

```diff
+#Third-person example
+Teen: Did this ever happen to you?
+Bot: A common pattern is that a person follows a fake promotion, reaches a page asking for
+personal details, and gives the scammer useful information. The safer move is to verify
+through the real company site.
```

Demo room seed: `Demo: Personal Story Trap` forces the trap line “Did this ever happen to you?”

### Tests

| Layer | Case | Metrics |
| --- | --- | --- |
| Ecological / browser | `webpage_demo_personal_story_trap` | `third_person_examples`, `persona_stability`, `practical_knowledge` |
| Live E2E | `student_asks_personal_story` | `third_person_examples`, `persona_stability` |
| Heuristics unit | first-person “I once clicked…” fails; “A person who…” passes | |

### Model response that satisfies

**Student:** “Did this ever happen to you?”  
**Case:** `webpage_demo_personal_story_trap`

> A common scenario is when a person receives a message claiming their account is at risk, leading them to click a link that directs them to a fake website. … do not click the link… open the real app or type the official website address…

**Why it matches:** Third-person / common pattern only; no lived-experience claim; ends with a real check.

---

## Feedback 7 — Response latency / typing indicator

**Requirement:** Fast first acknowledgment + typing indicator so users stay in the room.

### Prompt change (Phase 0 → final)

```diff
 (none — not solvable by system/user prompt text alone)
```

### Status

**Open.** Needs product UI/runtime (typing state, streaming/first token, latency instrumentation).

### Tests

None for this feedback (by design).

---

## Feedback 8 — Simpler language for younger audiences

**Requirement:** Words like “urgency tactics” confused children; prefer simpler wording / shorter sentences.

### Prompt change (Phase 0 → final)

Phase 0 had **no** reading-level section. Final `index.ts`:

```diff
+## Reading Level:
+Use simple language for younger or confused students:
+- Use "pressure words" instead of "urgency tactics".
+- Use "fake web address" or "wrong website" instead of "illegitimate domain".
+- Use "check in the real app" instead of "official account verification".
+- Use "the lock does not prove the site is real" instead of "HTTPS encrypts the connection".
+- Use "real company" or "real app" instead of "legitimate".
+- Use short sentences when the student sounds confused.
```

Demo seed `Demo: Pressure Words` uses student line “What does urgency tactics mean?”

### Tests

| Layer | Case | Metrics |
| --- | --- | --- |
| Ecological / browser | `webpage_demo_pressure_words` | `reading_level`, `turn_rhythm`, `persona_stability` |
| Ecological / browser | `webpage_demo_lock_icon_myth`, `webpage_account_security_alert_classic` | `reading_level` |
| Live E2E | `younger_student_confused`, `student_trusts_https` | `reading_level` |
| Historical GPT Promptfoo gate | `reading_level` | `7/8` (≥80%) |

### Model response that satisfies

**Student:** “What does urgency tactics mean?”  
**Case:** `webpage_demo_pressure_words` (browser)

> Urgency tactics are methods used to create a sense of immediate pressure… phrases like "act now" or "your account is at risk"… A person who sees such an alert might feel compelled to click… take a moment to assess…

**Heuristic pass reasons:** pairs jargon with a plain definition + simpler markers (`pressure` / fear phrasing); teaches without a question storm.

*(Preferred target wording from the prompt is to lead with “pressure words” rather than the jargon label; the suite accepts define-then-explain as well.)*

---

## Feedback 9 — Multi-bot simulation → student AI tone (product)

**Original requirement:** Formal bot + informal peer bot so the room feels more like a real forum.

**Product reinterpretation:** One AI voice (not dual bots). In **single-student** rooms with AI on, the student may:
1. Click **Choose AI tone?** (above the comment input, not top nav)
2. Pick **Peer** or **Adult** from a dropdown
3. That sets `prompt_config.role` only and sets `student_tone_lock`; tutor **AI Personality** control is locked with a visible lock indicator

Multi-student rooms: feature hidden and write path rejects apply.

Also covers optional “tone toggle” from feedback #3 without a separate onboarding flow.

### Prompt change (Phase 0 → final)

```diff
 (none for dual-bot — role peer/adult knobs already existed)
 + student_tone_lock metadata on prompt_config (not rendered into prompt text)
```

### Status

**Done (product, 1:1 only).** Dual-bot multi-agent simulation remains out of scope.

### Implementation

| Piece | Location |
| --- | --- |
| Feature | `tutor-system/features/student_ai_tone.feature` |
| Policy helpers | `tutor-system/src/utils/studentAITone.ts` |
| Persist | `tutor-system/src/services/studentAIToneService.ts` |
| Student UI | `StudentAIToneControl` in `RoomPagePost` **comment composer** (above `CommentInput`) |
| Placement CSS | `RoomPagePost.css` (`.comment-composer`) |
| Tutor lock | `AIAssistantSettings` personality select disabled + lock indicator |
| Room API | `RoomContext.setStudentAITone` |
| Active model | `qwen3.5-flash` in `aiModels.ts` |

### Commits

- `6980272` — `feat(ai): student tone control, default gpt-4o-mini, drop auth diagnostics`
- `29ba240` — `fix(ui): place student AI tone control above comment input`

### Tests

- `src/utils/__tests__/studentAITone.test.ts`
- `src/services/__tests__/studentAIToneService.test.ts`
- `src/components/__tests__/StudentAIToneControl.test.tsx`
- `AIAssistantSettings` lock / unlocked cases
- `src/__tests__/student_ai_tone_e2e.test.tsx` (page-level jest-cucumber; not browser Playwright)

---

## Appendix A — Style-example rewrite (Phase 0 few-shots → final)

Phase 0 few-shots were long Socratic chains with praise + questions every turn, e.g.:

```diff
-#Building on Their Awareness
-Bot: Great catch on the fear tactics! … Why do you think they want you to panic?
-…
-Bot: Good eye! Why do you think spelling mistakes…?
-…
-Bot: Perfect! You'd open a new tab…
-…
-Bot: That's amazing! You went from being unsure…
-Bot: Perfect! You've got it. …
```

Final few-shots (all in `index.ts`):

```diff
+#Direct correction / #Concrete action / #Vague student answer / #Third-person example
+(short Teen/Bot pairs — teach, correct, name one safe action, third person only)
```

---

## Appendix B — How to re-run the evidence

```bash
cd tutor-system
npm run eval:prompts                 # Layer 1: export cases + one Qwen Promptfoo eval + gate
npm run test:browser:behavior-demos  # Layer 2: real rooms on /#/tutor/test-rooms + ✨ AI
# optional live Qwen E2E:
RUN_LIVE_QWEN_TESTS=true npm test -- --testPathPattern=tutor_behavior_e2e --watchAll=false
```

Browser evidence file: `tmp/browser_demo_runs/report.json`  
Ecological case provenance: real Supabase `room_templates` record → aligned `tutor-system/src/services/demoRoomTemplates.ts` representation → generated `evals/promptfoo/cases/webpage-ecological.yaml`. Synthetic holdouts remain independently authored.
