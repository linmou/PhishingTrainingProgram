# PM Summary: Prompt Improvements From Prototype Feedback

Intent: explain, for education and product reviewers, which learner-experience issues were improved through prompt design and product-path packaging, and how evaluation checks that those improvements show up in real rooms—not only in offline prompt demos.

Updated: 2026-07-18

## Executive Summary

We improved chatbot behavior for the feedback items that can be addressed through prompt design and for delivering those improvements on the live room AI button.

**Phase 1 (2026-06-09) — system prompt.** The tutor is designed to teach more directly, correct unsafe reasoning, use a stable knowledgeable-peer voice, reduce hollow praise, provide concrete safety actions, avoid fake personal stories, and use simpler language for younger or confused learners.

**Phase 2 (2026-07-18) — product packaging.** The website ✨ AI path no longer asks the model for a “brief follow-up question.” It shares an ecological user turn with Promptfoo: short tutor message (2–4 sentences), direct correction when needed, one concrete safe action. Demo room templates and browser tests create real Supabase rooms from those templates so evaluation matches the webpage.

Still open (not prompt packaging):
- Response latency and typing indicators (UI/runtime).
- Multi-bot simulation (product design + multi-voice evals).

## Feedback coverage at a glance

| # | Feedback | Phase 1 system prompt | Phase 2 product path | Still open |
| --- | --- | --- | --- | --- |
| 1 | No question every turn | Yes | Yes (full tutor reply, not co-pilot quiz) | |
| 2 | Direct correction | Yes | Yes | |
| 3 | Stable peer persona | Yes | Yes (tutor voice on room AI) | Optional tone toggle |
| 4 | Less hollow praise | Yes | Helped by short replies | |
| 5 | Concrete safe actions | Yes | Yes (required in user turn) | |
| 6 | Third-person examples | Yes | Yes (demo trap + system rules) | |
| 7 | Latency / typing indicator | — | — | **Yes** |
| 8 | Simpler language | Yes | Helped by short replies | Age auto-detect optional |
| 9 | Multi-bot simulation | — | — | **Yes** |

---

## Phase 1 — What changed for learners (system prompt)

Source commit for prompt diff evidence: `f8cdc7e fix(ai): gate and update tutor prompt behavior`

### 1. The Bot Should Stop Asking A Question Every Turn

User feedback said the bot felt like it kept asking questions instead of teaching.

The system prompt now uses a tight tutoring rhythm:
- Teach one concrete idea first.
- Ask a focused question only when it helps the student think.
- Do not end every response with a question.

Evaluation gate result (Phase 1 Promptfoo): `turn_rhythm` `9/9`.

### 2. The Bot Should Correct Wrong Or Incomplete Answers

The prompt tells the bot to correct unsafe reasoning directly before encouragement (e.g. lock icon does not prove a site is real).

Evaluation gate result: `direct_correction` `8/8`.

### 3. The Bot Needs A Stable Persona

Knowledgeable peer coach for teen phishing training—not a fake friend, parent, performer, or person with personal memories.

Evaluation gate result: `persona_stability` `5/5`.

### 4. The Bot Should Reduce Boilerplate Praise

At most one brief, specific acknowledgment; `casual_peer` uses low enthusiasm and low validation.

Evaluation gate result: `low_boilerplate_praise` `5/5`.

### 5. The Bot Should Give More Specific Safety Knowledge

Default safe actions: do not click; open real app/site; check real account settings/login activity; banking via real app/card number; HTTPS/lock does not prove legitimacy.

Evaluation gate result: `practical_knowledge` `15/15`.

### 6. The Bot Should Use Third-Person Stories, Not Fake Personal Claims

Third-person examples only (“A person who…”), not “I once clicked…”.

Evaluation gate result: `third_person_examples` `1/1`.

### 8. The Bot Should Use Simpler Language

Prefer “pressure words,” “fake web address,” “real app,” short sentences when the student is confused.

Evaluation gate result: `reading_level` `7/8` (above 80% threshold).

---

## Phase 2 — Making the website show the same behavior

### The delivery gap

Phase 1 improved the **system** prompt and passed offline Promptfoo. The room AI button still used a **user** wrapper that said, in effect:

> suggest a brief follow-up **question** for the tutor… under 2 sentences

So the webpage reintroduced question loops and weak correction even when the system prompt was correct.

### What we changed

| Area | Change |
| --- | --- |
| User turn | Shared ecological packaging (`ecologicalTutorCall.ts`): write the tutor message the student should hear |
| Length | 2–4 short sentences (~40–70 words); `max_tokens` ~100 |
| Correction + action | If wrong/incomplete: one correction sentence + one concrete safe action |
| Context | Pre-populated room discussion + focused student line included in the call |
| Templates | Global demo rooms with multi-turn realistic chat (OP → peers → tutor → student) |
| Eval ecology | Cases generated from the same templates; history format matches product packaging |
| Browser demos | Template-only room create in real Supabase + ✨ AI |

Primary product commit: `5014acf fix(ai): align room AI call with full tutor response packaging`.

### Example short reply (after length cap)

> That is incorrect. A lock icon or HTTPS does not guarantee the site is safe; scammers can use them too. Check the web address carefully to see if it matches the real company. Instead of clicking the link, open the real app or type the official website directly into your browser.

---

## What remains open

### Response latency and typing indicator (feedback #7)

Needs product UI/runtime: typing state, faster first token, streaming, or staged delivery. Not solved by system or user prompt text alone.

### Multi-bot simulation (feedback #9)

Needs multiple agent roles, UI design, and a separate multi-voice evaluation set.

---

## Evaluation: how we know it works

### Phase 1 gate (system prompt quality)

- Eval id: `eval-EFn-2026-06-09T18:40:25`
- Cases: `34`, errors: `0`, overall: **passed**
- Rule: ≥80% per metric; improved ≥ current on every metric

| Behavior category | Result |
| --- | ---: |
| Balanced teaching rhythm | `9/9` |
| Direct correction | `8/8` |
| Stable persona | `5/5` |
| Reduced boilerplate praise | `5/5` |
| Practical safety knowledge | `15/15` |
| Third-person examples | `1/1` |
| Simpler reading level | `7/8` |

### Phase 2 two-layer verification

```bash
cd tutor-system
npm run eval:prompts                 # Layer 1: export + Promptfoo + ecological product gate
npm run test:browser:behavior-demos  # Layer 2: real template rooms + ✨ AI
```

| Layer | What it proves | Latest evidence |
| --- | --- | --- |
| Ecological product gate | Production system prompt + product-shaped user turn + template dialogue | **7/7** cases passed |
| Browser demos | Real DB templates → real room → AI button → short teaching reply | **7/7** demos passed |

Reliability notes:
- Cases use multi-turn dialogue from the same seeds as the website (`demoRoomTemplates.ts`).
- Browser demos **only** create rooms from those templates (no freehand rooms).
- Dual-prompt LLM-judge scores can be noisy on some gateways; the ecological product gate (heuristics on product-shaped calls) is the primary Layer-1 pass/fail for delivery.

---

## Why this is more reliable than a single demo

1. Phase 1 tested many situations (including holdouts), not one cherry-picked reply.  
2. Phase 2 tests the **same packaging** the room AI uses.  
3. Template dialogue is multi-turn and room-like (OP post, peers, tutor, student).  
4. Browser demos hit Supabase and the real UI path.  
5. Short-reply constraints reduce hollow praise and question spam in practice.

---

## Commands reference

| Command | Role |
| --- | --- |
| `npm run eval:prompts` | Layer 1 Promptfoo ecological eval |
| `npm run test:browser:behavior-demos` | Layer 2 real-browser template rooms |
| `npm run seed:behavior-templates` | Upsert global demo templates to Supabase |
| `npm run eval:prompts:export-ecological-cases` | Regenerate Promptfoo YAML from templates |
