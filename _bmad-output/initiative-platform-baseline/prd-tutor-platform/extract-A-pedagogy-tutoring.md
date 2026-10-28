# Extract A — Product intent, pedagogy, supervised AI tutoring

Intent: give the brownfield PRD author a sourced inventory of what the supervised AI tutor is for, what it does today, which documents are stale, and which decisions remain open. Read-only extraction; no repository file was changed.

Extracted: 2026-10-22, branch `rebuild_docs_by_BMAD` (HEAD `565ac76`). Paths are relative to the repository root unless they start with `src/`, `docs/`, `features/` or `supabase/`, which are relative to `tutor-system/`.

Evidence labels: **[code]** = confirmed in source; **[test]** = test file confirmed to exist; **[doc]** = document claim only; **[stale]** = doc contradicted by code.

---

## 1. Vision / intent statements

| # | Statement (brief quote) | Source |
|---|---|---|
| V1 | Goal is understanding, not volume: "Develop the learner's understanding and online-safety judgment. More information, longer participation, and better compliance are not automatically better tutoring." | `docs/ai-behaviors/constitution.md:13` |
| V2 | "Understanding is the goal. Knowledge and engagement serve it. Safety, dignity, honesty, and human supervisability constrain how it is pursued." | `docs/ai-behaviors/constitution.md:17` |
| V3 | AI is a supervised suggester, not an autonomous agent: the constitution "does not … replace human tutor review". | `docs/ai-behaviors/constitution.md:15` |
| V4 | Who it serves: teens learning scam/phishing and privacy detection ("the bot positions itself as a fellow learner navigating scam detection alongside the teen"). | `raw_instrcutions/how_to_respond_design_parameters.txt:7` |
| V5 | Learning content: a "WHO / WHAT / WHERE / WHEN / WHY" scam check, plus privacy-risk recognition (location, address, phone number). | `raw_instrcutions/what_to_respond.txt:31-36,137-174` |
| V6 | Original pedagogy: a 3-stage flow (first reaction → ask why → fill gaps with 6 scaffolding means). **Superseded** by the "tight tutoring rhythm" (see C3). | `raw_instrcutions/what_to_respond.txt:1-28`; `user_feedback_improvement_summary.md:38-53` |
| V7 | Tutor's daily use: "You help a human tutor teach phishing detection." | `src/services/prompts/activeTutorAgentPrompt.ts:13` [code] |
| V8 | Behavior outcome: "develop learner understanding and online-safety judgment, not merely deliver answers or obtain compliance. … imminent unsafe action requires protective instruction; participation management addresses deliberate obstruction." | `docs/ai-behaviors/tutor-behavior-specification.md:13` |
| V9 | Assessment as a final check after developed understanding, avoiding "annoying repetition" for students who already know an item. | `docs/ai-behaviors/tutor-behavior-specification.md:116` |
| V10 | Research purpose of tracking: "Export for Analysis: Download complete interaction data for research". | `docs/ai-suggestion-tracking.md:124` |
| V11 | Scope widened beyond phishing: a second practice type, Cyberbullying, uses tutor-supervised AI role-play characters (out of this extract's depth; flagged in §6/§7). | `docs/cyberbullying-practise.md:7-37`; `src/types/index.ts:10-11` [code] |

Users: tutor (configures AI, reviews/sends suggestions, controls Guard), student (learner; chooses AI role in 1:1 rooms; must rate tutor responses), observer (read-only). `src/types/index.ts:7`.

---

## 2. Capabilities

### C1. Tutor enables/configures the AI assistant per room
- **Requirement:** A tutor can enable or disable the AI assistant for a room they own and configure its prompt/persona parameters; settings persist across leave/rejoin.
- **Consequences:**
  1. Only tutors see AI Settings and the AI suggestion button; students and observers do not (`features/ai_assistant.feature:99-105`).
  2. Disabled AI → generation throws "AI assistant is not enabled for this room" (`src/contexts/RoomContext.tsx:1022-1024`; `src/services/aiService.ts:991-993`).
  3. Reopening settings/Quick Adjust shows the saved role and parameter values, not defaults (`docs/ai-assistant-module.md:95-99`).
  4. Model selection is effectively fixed: every value normalises to `qwen3.8-flash` (`src/services/aiService.ts:172`; `src/services/aiModels.ts:7-18`).
  5. Room temperature/max_tokens are persisted, but generation always uses temperature 0.3 / 600 tokens (`src/services/aiService.ts:70-74,704,958-959`). See conflict X5.
- **Legacy IDs:** feature `@ai-assistant` scenarios 1, 2, 9, 11.
- **Evidence:** `src/__tests__/ai_assistant.bdd.test.tsx`, `src/components/__tests__/AIAssistantSettings.test.tsx`, `src/contexts/__tests__/RoomContext.aiConfigReload.test.tsx`, `src/services/__tests__/aiService.defaultModel.test.ts`, `aiService.roomSourceOfTruth.test.ts`.
- **Status:** current (model list and "dummy service" claims in `docs/ai-assistant-module.md` are stale — X1).

### C2. Tutor requests an AI suggestion for a specific student message
- **Requirement:** A tutor can request an AI-drafted reply to a selected (or the latest) student message in an AI-enabled room; the draft is shown privately to the tutor and never posted automatically.
- **Consequences:**
  1. No student message → error, no suggestion (`src/contexts/RoomContext.tsx:1063-1065`). UI shows "The transfer request could not be completed. Try again." (`features/ai_assistant.feature:92-97`; X6).
  2. Requesting a new suggestion while one is open records the old one as `ignored` (`src/contexts/RoomContext.tsx:1033-1036`).
  3. Context = scenario (room title/description) + full history incl. pre-populated discussion + focused student line + prior Guard mode (`src/services/aiService.ts:922-946`; `src/services/ecologicalTutorCall.ts`).
  4. Checklist progress is appended to the system prompt as "CURRENT LEARNING PROGRESS" when available (`src/services/aiService.ts:905-917`).
  5. Failure leaves the tutor free to type manually (`features/ai_assistant.feature:114-120`).
- **Legacy IDs:** feature `@ai-assistant` scenarios 3, 7, 10, 12, 13; `user_feedback_improvement_summary.md` Phase 2 (ecological user turn).
- **Evidence:** `src/__tests__/ai_assistant.bdd.test.tsx`, `src/contexts/__tests__/RoomContext.aiGenerationFailure.test.tsx`, `src/services/__tests__/aiContextIntegration.test.ts`, `simplifiedAIContext.test.ts`, `aiService.edgeBoundary.test.ts`, `aiService.externalFailure.test.ts`.
- **Status:** current.

### C3. Pedagogical shape of each suggestion (teach, correct, protect)
- **Requirement:** The AI suggestion teaches one target per turn, corrects misconceptions after a failed focused scaffold, gives immediate protective instruction for any stated unsafe click intention, and never calls correct partial knowledge wrong.
- **Consequences:**
  1. "I would click" (hypothetical) gets the same `protective_instruction` as "I am opening it now" (behavior T01; `activeTutorAgentPrompt.ts:28`).
  2. Incorrect answer to a focused misconception question → `correction` + one concrete safe action; a broad opening question does not count as failed scaffold (T01; `src/services/prompts/responsePolicy.ts:17`).
  3. At most one question; no question chains; no "What else?" (`responsePolicy.ts:6,14`).
  4. One unmet target selected from room Detection Areas / Verification Steps; tutor mentions do not count as mastery; contradiction reopens a target (T02; `responsePolicy.ts:7-9`).
  5. `consolidation` only when every useful configured target is demonstrated (`responsePolicy.ts:15`).
- **Legacy IDs:** behavior T01, T02, TA01–TA04; constitution P2, R1, R2; prototype feedback #1, #2, #5 (`user_feedback.md:4-8`).
- **Evidence:** `src/__tests__/tutor_behavior_contract.test.ts`, `src/services/__tests__/systemPrompts.test.ts`, `promptfooQualityGate.test.ts`, `promptfooBrevityQualityGate.test.ts`, `qwenPromptBrevity.integration.test.ts`; Promptfoo suite `evals/promptfoo/` (cases, rubrics, holdouts). Model conformance **not** established: active Qwen run `DOES_NOT_SATISFY_RUBRICS` (`docs/aiService.md:101`; `user_feedback_improvement_summary.md:26`).
- **Status:** current (intended); conformance unproven.

### C4. Contribution feedback without hollow praise
- **Requirement:** The AI acknowledges what the learner actually noticed, at most once and briefly, and never with praise alone.
- **Consequences:** no praise-only reply; no inflated mastery claim; "Great job! Amazing!" fails the heuristic (T03; `responsePolicy.ts:10-11`; `user_feedback_improvement_summary.md:216-251`).
- **Legacy IDs:** behavior T03; constitution P3.1, R3, H1, H2; feedback #4.
- **Evidence:** Promptfoo `low_boilerplate_praise` metric; claimed `tutorBehaviorHeuristics.test.ts` **does not exist** (X8).
- **Status:** current (prompt-level only).

### C5. Accurate contextual knowledge and concrete safe actions
- **Requirement:** Advice is accurate, scenario-grounded and concrete (open the real app/site, do not click, a lock icon does not prove identity).
- **Consequences:** no invented scenario facts or official addresses; never recommend the suspect link; HTTPS/tool results are not proof (T04; `activeTutorAgentPrompt.ts:37-38,53-55`).
- **Legacy IDs:** behavior T04; constitution P1, H1; feedback #5.
- **Evidence:** Promptfoo `practical_knowledge`; `src/__tests__/tutor_behavior_contract.test.ts`.
- **Status:** current.

### C6. Configurable voice: Peer vs Trusted Adult (+ style/cognitive/emotional parameters)
- **Requirement:** A tutor can choose a Peer or Trusted Adult role and low/high communication, cognitive and emotional parameters, via presets or Quick Adjust, unless a student has locked the role.
- **Consequences:**
  1. Peer = "knowledgeable peer coach", not fake friend/parent; adult = mature supportive guide (T05; `src/services/prompts/pedagogy/parameters/roleParameters.ts:10-32`).
  2. Clarity/correction override style (R5).
  3. Quick Adjust regeneration persists the effective config immediately (`docs/ai-assistant-module.md:95-98`).
  4. Quick Adjust is unavailable for Cyberbullying rooms (`src/services/aiService.ts:884`).
- **Legacy IDs:** behavior T05; constitution P3.2, R5; `raw_instrcutions/how_to_respond_design_parameters.txt` (all parameter tables); feedback #3.
- **Evidence:** `src/services/__tests__/aiService.parameterOverrides.test.ts`, `systemPrompts.test.ts`, `src/components/__tests__/AISuggestionBox.test.tsx`.
- **Status:** current; parameter semantics rewritten vs 2025 originals (e.g. high enthusiasm now "restrained") — raw file is superseded (`user_feedback_improvement_summary.md:222-236`).

### C7. Honest self-representation
- **Requirement:** The AI never fabricates personal experience, memories, friendship or parental identity; it may say it has no personal experience and give a third-person example.
- **Legacy IDs:** behavior T06; constitution P3.2, H3; feedback #6.
- **Evidence:** Promptfoo `third_person_examples`, `persona_stability`; demo template "Demo: Personal Story Trap".
- **Status:** current. Original 2025 peer role ("Honestly, I fall for stuff like this too", "In my experience…") is explicitly superseded (`raw_instrcutions/how_to_respond_design_parameters.txt:8,15` vs `user_feedback_improvement_summary.md:166-181`).

### C8. Accessible expression / reading level
- **Requirement:** The AI uses short sentences and plain words ("pressure words" not "urgency tactics") at the learner's demonstrated level without misleading simplification.
- **Legacy IDs:** behavior T07; constitution P2, R3, H1; feedback #8.
- **Evidence:** Promptfoo `reading_level` (historical GPT 7/8).
- **Status:** current (prompt). Note feedback #8 asked to "detect user age/reading level"; no age detection exists — open question Q7.

### C9. Bounded suggestion length
- **Requirement:** Every suggestion is non-empty and bounded.
- **Consequences:** spec says ≤3 sentences / ≤50 words (T08; `responsePolicy.ts:5`); active prompt says ≤2 sentences / ≤35 words (`activeTutorAgentPrompt.ts:7,13,40`). See X3.
- **Legacy IDs:** behavior T08.
- **Evidence:** `evals/promptfoo/response-length-rubric.js`; `promptfooBrevityScaffold.test.ts`.
- **Status:** current, internally inconsistent.

### C10. Structured decision + human-supervisor rationale
- **Requirement:** Each suggestion carries a supervisor-facing reason and an instructional-action label, inspectable by the tutor and exported, but not shown to learners.
- **Consequences:**
  1. Model output must be JSON `{reason, decision:{guard_mode:boolean, instruction}, response}`, `reason` serialized first; extra keys rejected (`src/services/tutorDecisionContract.ts:7-25`).
  2. `instruction ∈ {protective_instruction, correction, scaffolding, explanation, consolidation, null}`; null only when Guard (`tutorDecisionContract.ts:5,22`).
  3. One format-repair retry (2 attempts); truncated output retried; then `success:false`, empty suggestion (`src/services/aiService.ts:69,700-740`).
  4. Raw instruction persisted for accepted/modified/rejected/ignored and in tutor exports (`docs/tutor-response-contract.md:89`; `docs/ai-suggestion-tracking.md:54,64`).
  5. Reasoning/instruction labels are never shown to learners (`docs/ai-suggestion-tracking.md:47,103`).
- **Legacy IDs:** constitution P4, H4; response contract v2/v3; "candidate 11".
- **Evidence:** `src/services/__tests__/tutorDecisionContract.test.ts`, `tutorDecisionContract.transfer.test.ts`, `aiService.feedbackInstruction.test.ts`, `src/__tests__/tutor_behavior_contract.test.ts`.
- **Status:** current in code; `docs/tutor-response-contract.md` shape (`decision.mode` string, multiagent) is stale (X2).

### C11. Tutor review: copy / modify / reject / regenerate, then send
- **Requirement:** A tutor can copy a suggestion into the composer, edit it, reject it, or regenerate it; only the tutor's explicit send publishes a message.
- **Consequences:**
  1. Copy then send unchanged → `accepted`; edited → `modified`; Reject → `rejected`, box disappears, input stays empty; new request → `ignored` (`features/ai_suggestion_tracking.feature:12-53`).
  2. Empty final response refused ("Tutor response cannot be empty") (`src/services/guardModeService.ts:29-31`).
  3. Failed send keeps the editable draft (`docs/ai-suggestion-tracking.md:103`).
  4. Quick Adjust regenerate marks the previous suggestion `modified`, not `ignored` (`src/contexts/RoomContext.tsx:1227-1229`) — X7.
- **Legacy IDs:** feature `@ai-assistant` 4–6; `@ai-tracking` 1–4.
- **Evidence:** `src/__tests__/ai_suggestion_tracking.bdd.test.tsx`, `ai_assistant.bdd.test.tsx`, `src/components/__tests__/AISuggestionBox.test.tsx`, `src/services/__tests__/guardModeService.test.ts`.
- **Status:** current.

### C12. Suggestion tracking and research export
- **Requirement:** The system records every tutor interaction with a suggestion (action, suggestion text, final text, response time, context messages, raw/final mode, raw instruction) and exports it as JSON/TXT.
- **Consequences:** response_time = action time − suggestion time; data survives sessions; TXT summary with per-action percentages; only action/time/content tracked, not IP/browser/personal info (`features/ai_suggestion_tracking.feature:55-111`).
- **Legacy IDs:** `@ai-tracking` 5–11; migrations `023_guard_mode.sql`, `024_raw_instruction.sql` (now under `supabase/archived_migrations/`).
- **Evidence:** `src/__tests__/ai_suggestion_tracking.bdd.test.tsx`; feature `features/chat_history_download.feature`.
- **Status:** current. Privacy scenario contradicts `message content` being tracked alongside student-authored content — Q4.

### C13. Guard mode (participation management)
- **Requirement:** The AI can recommend Guard for clear deliberate obstruction or knowing unsafe continuation after correction; the tutor decides, and the tutor can manually turn Guard on/off for the room.
- **Consequences:**
  1. Entry: deliberate obstruction / knowing rejection; mistakes, confusion, frustration, personal questions stay `tutoring` (G01; `activeTutorAgentPrompt.ts:16-19`).
  2. Persistence/recovery: bare acknowledgment/promise keeps Guard; any substantive attempt (even wrong) restores tutoring; unknown prior mode cannot establish persistence; no violation counts (G01).
  3. Guard response names the behavior, its effect, and the required change; firm, no insults/threats/apology demands (G02, G03; `activeTutorAgentPrompt.ts:21-22,45-46`).
  4. Two controls: suggestion-card toggle edits the pending reviewed mode; header toggle is a confirmed room-level manual override (`window.confirm("Activate/Deactivate Guard Mode?")`, `src/pages/RoomPagePost.tsx:613-629`; `src/services/guardModeService.ts:62-84`).
  5. While Guard is on, tutor composer identity becomes "Security Supervisor" (`src/pages/RoomPagePost.tsx:94-96`; `src/utils/messagePresentation.ts:60`); learning progress is locked (`RoomPagePost.tsx:1094`).
- **Legacy IDs:** behavior G01, G02, G03; constitution P3.3, P3.1, R4, H2, P4.
- **Evidence:** `src/services/__tests__/aiService.guardMode.test.ts`, `guardModeService.test.ts`, `guardModeProgressLock.test.ts`, `src/components/__tests__/AISuggestionBox.guardMode.test.tsx`, `PostComment.guardMode.test.tsx`, `src/__tests__/guardModeComposerIdentity.integration.test.tsx`.
- **Status:** current; Guard is a **boolean** in code (`src/types/index.ts:204-215`), not the `tutoring|guard` enum the docs describe (X2).

### C14. Student chooses AI role (1:1 rooms) and locks it
- **Requirement:** In an AI-enabled room with exactly one student, the student can opt in ("Choose AI role?") and pick Peer or Adult; this locks the tutor's role control.
- **Consequences:**
  1. Hidden when AI disabled, when ≥2 students, and for observers (`features/student_ai_tone.feature:56-81`; `src/utils/studentAITone.ts:26-31`).
  2. Write rejected if a second student joins before selection (`src/services/studentAIToneService.ts:24-32`).
  3. Only students may set it (`src/contexts/RoomContext.tsx:1286-1288`).
  4. Persists `role` + `student_tone_lock{locked, chosen_by_user_id, chosen_role, chosen_choice}` (`studentAITone.ts:91-101`); regeneration forces the locked role (`RoomContext.tsx:1218-1224`).
  5. Tutor AI Personality shows a lock indicator ("Student chose AI tone") (`src/components/AIAssistantSettings.tsx:416-440`).
- **Legacy IDs:** feature `@student-ai-tone`; feedback #3, #9 (reinterpreted); commits `6980272`, `29ba240`.
- **Evidence:** `src/utils/__tests__/studentAITone.test.ts`, `src/services/__tests__/studentAIToneService.test.ts`, `src/components/__tests__/StudentAIToneControl.test.tsx`, `src/__tests__/student_ai_tone.integration.test.tsx`. Claimed `student_ai_tone_e2e.test.tsx` does **not** exist (X8).
- **Status:** current. No unlock path found (Q3).

### C15. Student rates the latest tutor/AI response (mandatory gate)
- **Requirement:** A student must rate the latest persisted AI/tutor response (helpful/unhelpful, 1–5 stars) before sending their next reply.
- **Consequences:**
  1. Applies only to students; tutors are not gated (`src/pages/RoomPagePost.tsx:291-304`).
  2. Pre-populated (`prepop-`) lines and assessment-event rows are exempt (`RoomPagePost.tsx:296-298`).
  3. Unlocks only after rating persistence succeeds; failure alerts "Failed to save your rating" and keeps the reply (`RoomPagePost.tsx:337-352`).
  4. Labels: "Slightly … Extremely helpful/unhelpful" (`src/components/feedbackRatingLabels.ts`); optional per-comment ratings via `FeedbackRating` (`src/components/PostComment.tsx:335-342`).
- **Legacy IDs:** README "Required Response Ratings" (`tutor-system/README.md:30`); `docs/doc_update_record/documentation_update_record_v2026_09_12_rating_gate_prepop.md`.
- **Evidence:** `src/__tests__/tutor_response_rating_gate.integration.test.tsx` (8 cases incl. tutor-exempt, prepop).
- **Status:** current; `docs/ai-assistant-module.md:306` still lists "Response Rating" as a future enhancement (stale, X1). Not in any `.feature` file.

### C16. Transfer assessment (AI-prepared, tutor-reviewed final check)
- **Requirement:** When a target moves Partial → Covered, the tutor receives a private AI-drafted A–D transfer question to edit and explicitly send; grading is deterministic, max two attempts.
- **Consequences:** direct Pending → Covered skips the quiz; answer key/basis stay private; Guard, open assessment, required feedback block a new one; second wrong attempt → `needs_review` and tutoring resumes (T09.1–T09.6).
- **Legacy IDs:** behavior T09.1–T09.6, TA01–TA04; `docs/ai-behaviors/transfer-status-response-contract.md`.
- **Evidence:** `features/transfer_assessment.feature`; `tutorDecisionContract.transfer.test.ts`. (Owned by another extract; listed for completeness.)
- **Status:** current (hosted/live acceptance noted pending in `docs/tutor-response-contract.md:7,161`).

### C17. Multi-agent (Riley) simulation — deprecated
- **Requirement (historical):** AI could present a simulated incorrect peer "Riley" alongside the AI tutor.
- **Status:** **superseded** — requests always `single_agent`; parser rejects `[agent:…]` tags (`src/services/tutorDecisionContract.ts:23`; `src/utils/studentAITone.ts:41-43`); stored rows still render (`docs/tutor-response-contract.md:95-117`). Feedback #9 reinterpreted as C14.

### C18. Prototype feedback #7 — typing indicator / latency
- **Status:** **open** per `user_feedback.md:24` and `user_feedback_improvement_summary.md:363-379`. A generic `TypingIndicator` type exists (`src/types/index.ts:266-271`; `startTyping/stopTyping` in RoomContext) but no AI "thinking"/streaming first-acknowledgment was found; the AI button title only changes to "Generating AI response..." (`RoomPagePost.tsx:970`).

---

## 3. Constraints and non-functional requirements

| ID | Constraint | Source |
|---|---|---|
| NF-HS1 Human supervision | AI never sends, enforces, or changes room state automatically; tutor may override mode; "no automatic sending, enforcement, or room-mode authority". | `docs/tutor-response-contract.md:86,91`; behavior spec non-goal `:21`; G01 user-visible effect |
| NF-HS2 Explainability | Reason cites observable evidence, not hidden chain-of-thought; must agree with mode/instruction/response. | constitution P4, H4 (`:26,49`); `activeTutorAgentPrompt.ts:4,40` |
| NF-HON1 Truthful content | Do not teach falsehoods to simplify or encourage. | constitution H1 (`:46`) |
| NF-HON2 Identity honesty | No fabricated identity/experience. | constitution H3 (`:48`); T06 |
| NF-DIG1 Dignity | Do not humiliate to obtain participation; Guard without insults, ridicule, threats, sarcasm, apology demands. | constitution H2 (`:47`); G02, G03 |
| NF-SAFE1 Imminent-risk protection | Stated unsafe action → protective instruction before exploration. | constitution R2; T01 |
| NF-ACC1 Reading level | Plain words, short sentences, explain jargon. | T07 |
| NF-LEN1 Length | ≤3 sentences/50 words (spec) vs ≤2/35 (prompt). | T08; X3 |
| NF-PRIV1 Learner-facing privacy of AI internals | Reason, instruction, mode metadata, answer keys never shown to learners; "AI chatbot" badge hidden from students. | `docs/ai-suggestion-tracking.md:47,103`; `docs/ai-assistant-module.md:145`; T09.3 |
| NF-PRIV2 Tracking scope | Do not track IP, browser info, tutor/student personal info. | `features/ai_suggestion_tracking.feature:92-99` |
| NF-SEC1 Provider credentials server-side | AI calls go through the `ai-api` / `assessment-api` Edge Functions; transfer prompt absent from browser bundle. | `src/services/aiService.ts:91-102`; `docs/tutor-response-contract.md:161` |
| NF-REL1 Format robustness | One format-repair retry; network errors don't consume it; failure returns empty suggestion + error. | `docs/tutor-response-contract.md:66-70`; `aiService.ts:700-740` |
| NF-GOV1 Constitutional change control | Only an explicit human decision can revise principles; passing evals cannot authorize a revision. | constitution `:79` |
| NF-EVAL1 Eval gate | ≥80% per metric on ecological, holdout, and correction-state slices. | `user_feedback_improvement_summary.md:25` |
| NF-DUMMY | Dummy suggestions only when `REACT_APP_ENVIRONMENT=debug` and `REACT_APP_USE_DUMMY_AI=true`. | `aiService.ts:82-83,1018-1033` |

---

## 4. Explicit non-goals

1. Room administration, latency, multi-bot simulation, automatic enforcement of AI decisions — `docs/ai-behaviors/tutor-behavior-specification.md:21`.
2. Constitution does not change production settings or prove model conformance — `docs/ai-behaviors/constitution.md:15`.
3. Benchmark does not establish longitudinal learning outcomes; analyzer suite does not measure retention or learning gains — behavior spec `:9,52`.
4. Dual-bot multi-agent simulation "remains out of scope" — `user_feedback_improvement_summary.md:448`.
5. No separate onboarding tone flow — `user_feedback_improvement_summary.md:437`.
6. No question quota ("does not require questions on every turn") — constitution R1 `:59`.
7. No violation-count threshold for Guard — G01.
8. No room-level "Assessment Mode" — T09.3.
9. No permanent-mastery claim from completion — T09.5.
10. Authentication and server-side answer-key privacy outside research-build boundary — behavior spec `:148` (now partially contradicted by Edge Function work, `docs/tutor-response-contract.md:161`).
11. Student role control in multi-student rooms "blocked … for now" — `features/student_ai_tone.feature:9`.

---

## 5. Glossary (with drift flags)

| Term | Definition | Synonyms / drift |
|---|---|---|
| AI assistant | Per-room AI that drafts tutor replies. | "AI tutor", "chatbot", "bot" (raw docs), "AI Assistant module". |
| Suggestion | Private AI draft reply for the tutor. | `suggested_response` (DB/adapter), `response` (model JSON), "AI suggestion box", "✨ AI". **Drift:** "Generate AI Response" button title (`RoomPagePost.tsx:970`) implies posting; nothing is posted. |
| Tutor review | Tutor copies/edits/rejects/regenerates, then explicitly sends. | "reviewed send", `send_reviewed_tutor_response` RPC, "approval". |
| Tutor action | `accepted` / `modified` / `rejected` / `ignored`. | **Drift:** Quick Adjust regenerate records `modified`, docs say regenerate = `ignored` (X7). |
| Quick Adjust | In-card parameter overrides + Regenerate. | "parameter overrides", "regenerate". |
| Role | Peer (`low`) vs Trusted Adult (`high`). | **Heavy drift:** "tone" (`user_feedback.md`, service names `studentAIToneService`, error "Student AI tone…"), "AI role" / "Choose AI role?" (UI, feature), "Choose AI tone?" (`user_feedback.md:26`), "AI Personality (Preset)" (tutor settings), "persona", "voice", `trusted_adult`, `supportive_adult`/`casual_peer` (presets), "Peer Learner" heading for a "peer coach". |
| Student tone lock | `student_tone_lock` marker fixing the role chosen by the sole student. | "role lock", "AI role lock". |
| Preset | Bundled parameter set (`casual_peer`, `supportive_adult`, …). | "AI Personality". |
| Parameters | Communication style, cognitive, emotional low/high knobs. | `prompt_config`. |
| Detection Areas / Verification Steps | Room-approved knowledge inventory / learning targets. | "checklist items", "learning targets", "Learning Progress", "knowledge inventory", "configured points". |
| Guard (mode) | Participation-management state for deliberate obstruction. | "Guard Mode", `guard_mode` (boolean in code), `mode: 'guard'` (docs), "participation mode", "Security Supervisor" (display identity), `response_mode='guard'` (message). **Drift:** boolean vs enum. |
| Tutoring (mode) | Normal instructional participation state. | `guard_mode=false`. |
| Instruction | First substantive instructional move label. | `decision.instruction`, `raw_instruction`; types also list `transfer_assess`, `guard` (`src/types/index.ts:211`) not allowed by parser. |
| Reason | Supervisor-facing evidence summary. | `reason` (model), `guard_reason` (adapter/RPC), `mode_reason` (docs/DB historic). **Drift:** three names. |
| Protective instruction | Stop imminent unsafe action + safe alternative. | — |
| Correction | Instructional fix of a false inference (not participation correction). | Guard "participation correction" is a different thing. |
| Scaffolding / Explanation / Consolidation | Hint/question leaving inference; direct teaching; reinforcement when all targets met. | "Scaffolding means" (6 in 2025 doc: questioning, explaining, modeling, feeding back, hinting, instructing) — superseded taxonomy. |
| Ecological user turn | Product prompt packaging shared by website and Promptfoo. | "ecological call", `ecologicalTutorCall.ts`. |
| Candidate 11 | Currently selected production tutor prompt. | "active tutor agent prompt", "v3 contract" (prompt says v3; contract doc says v2). |
| Rating | Student helpful/unhelpful 1–5 star rating of a tutor/AI response. | "feedback", "message feedback", "like/dislike", "Required Response Ratings". **Drift:** "AI suggestion feedback" (`ai_suggestion_feedback` table) is tutor action tracking, not rating. |
| Transfer assessment | Private AI-drafted A–D question after Partial → Covered. | "final check", "transfer check", "assessment", "TransferLearning". |
| Pre-populated discussion | Seeded scenario transcript lines (`prepop-`). | "pre-pop", "template dialogue". |
| Observer | Read-only participant. | — |
| Riley / Multi-agent | Deprecated simulated incorrect peer. | "multiagent", "multi-bot". |
| Practice type | `phishing` or `cyberbullying`. | "Cyberbullying practise" (UK spelling in docs). |
| Character (cyberbullying) | `same_age_peer`, `older_peer`, `victim`, `bully`, `educator`. | Overlaps conceptually with "role". |

---

## 6. Conflicts (sources vs sources, docs vs code)

| # | Conflict | Evidence | Which wins |
|---|---|---|---|
| X1 | `docs/ai-assistant-module.md` describes a dummy service with 5% failures, models "GPT-4, GPT-3.5 Turbo, Claude 3", "No external API calls", python unit tests, "AI configurations visible to all room participants", "Generate AI Response" posting, and lists "Response Rating" as future. | doc `:75-89,197,203,241-261,306` vs `src/services/aiModels.ts:7-18` (single Qwen model), `aiService.ts:91-102` (Edge Function), `aiService.ts:1018` (dummy only in debug), C15 rating gate | Code. Doc is stale. |
| X2 | Response contract shape: doc says `decision.mode ∈ {tutoring, guard, multiagent}` and "other additional fields are tolerated"; code requires boolean `decision.guard_mode`, rejects extra keys and agent tags. Prompt calls it "v3"; contract doc header says "legacy v2 … remains implemented". | `docs/tutor-response-contract.md:34,39,7` vs `src/services/tutorDecisionContract.ts:14,19-23`; `activeTutorAgentPrompt.ts:6` | Code. |
| X3 | Length limit: T08 = ≤3 sentences/50 words (also `responsePolicy.ts:5`, improvement summary `:62`) vs active prompt ≤2 sentences/35 words; Phase-2 note said 2–4 sentences/40–70 words. | `tutor-behavior-specification.md:108`; `activeTutorAgentPrompt.ts:7,40`; `user_feedback.md:120,138` | Unresolved — both strings are sent to the model. |
| X4 | Model identity: `user_feedback.md:204` default `gpt-4o-mini`; improvement summary `:23,461` active `qwen3.5-flash`; code/feature `qwen3.8-flash`; `assessment-api` pinned `qwen3.5-flash`; contract doc says exact `OAI_MODEL=qwen3.5-flash`; the failed rubric run evidence is for qwen3.5-flash. | `src/services/aiModels.ts:7,18`; `supabase/functions/assessment-api/index.ts:24`; `supabase/functions/ai-api/index.ts:109`; `docs/tutor-response-contract.md:161`; `docs/aiService.md:12,101` | Code (two different models in two functions). Quality evidence does not cover qwen3.8. |
| X5 | Tutor-set temperature/max_tokens (feature scenarios set 0.7/300) are persisted but ignored: generation fixed at 0.3/600; `appliedConfig` reports the fixed values. | `features/ai_assistant.feature:18,80-90`; `aiService.ts:70-74,704,958-959` | Code; feature tests only persistence. |
| X6 | Non-transfer failures (no student message, provider down) surface the transfer-specific text "The transfer request could not be completed. Try again." | `features/ai_assistant.feature:96,119`; `src/contexts/transferAssessmentUiAdapter.ts:138`; `src/__tests__/ai_assistant.bdd.test.tsx:541,588` | Code + feature agree, but wording is misleading UX. |
| X7 | Regenerate via Quick Adjust records previous suggestion as `modified`; docs define regenerate = `ignored` and `modified` = edited-then-sent. | `src/contexts/RoomContext.tsx:1227-1229` (and cyberbullying `:977`) vs `docs/ai-suggestion-tracking.md:45,118`; `features/ai_suggestion_tracking.feature:48-53` | Code; corrupts research metric semantics. |
| X8 | Improvement summary cites tests that don't exist: `tutorBehaviorHeuristics.test.ts`, `tutor_behavior_e2e.test.ts`, `src/__tests__/student_ai_tone_e2e.test.tsx`. | `user_feedback_improvement_summary.md:78-79,250,350,474`; `find` returned nothing | Stale doc. |
| X9 | Default persona: feedback status says "Knowledgeable peer coach by default"; room initialization defaults role to Trusted Adult (`high`) unless `'peer'` is passed and fills parameters from `supportive_adult`. | `user_feedback.md:20` vs `src/services/aiService.ts:1120-1125`; `src/utils/studentAITone.ts:65-89` | Code (needs PM confirmation). |
| X10 | Control label drift: "Choose AI tone?" vs "Choose AI role?" vs tutor lock tooltip "Student chose AI tone"; summary says role control placed above comment input "not top nav". | `user_feedback.md:26`; `features/student_ai_tone.feature:21`; `src/components/StudentAIToneControl.tsx:67`; `AIAssistantSettings.tsx:421` | Code = "Choose AI role?". |
| X11 | `docs/ai-suggestion-tracking.md:13` calls `023_guard_mode.sql`/`024_raw_instruction.sql` "canonical current migrations"; they live in `supabase/archived_migrations/`, and `supabase/migrations/` does not exist. | filesystem | Filesystem. |
| X12 | Instruction enum: types include `transfer_assess`, `guard` which the parser rejects. | `src/types/index.ts:211` vs `tutorDecisionContract.ts:5` | Parser. |
| X13 | 2025 pedagogy (3-stage Socratic flow; peer admits own vulnerability; high enthusiasm "YES! Absolutely nailed it!"; "Mistakes as learning" with "Don't worry") contradicts current constitution H3, T03, T06 and direct correction. | `raw_instrcutions/how_to_respond_design_parameters.txt:8,52-55`; `raw_instrcutions/what_to_respond.txt:5-12` | Current docs/code; raw files superseded. |
| X14 | Behavior spec says authentication/answer-key privacy are outside the research-build boundary and transfer is a "browser-side v3 call"; contract doc says trusted `assessment-api` Edge Function holds the prompt server-side. | `tutor-behavior-specification.md:146-148` vs `docs/tutor-response-contract.md:161` | Contract doc appears newer. |
| X15 | Constitution P4 exposes reasons to the supervisor, but `docs/ai-suggestion-tracking.md:103` says "internal AI reasoning and mode metadata remain non-visual" in the card; reasons appear only in exports. | doc lines cited | Unclear whether tutor sees reason live (Q2). |

---

## 7. Open questions for the PM

1. **Length policy (X3):** Is the learner-facing limit 2 sentences/35 words or 3/50? Which one should the spec, prompt and length rubric enforce?
2. **Supervisor explainability (X15, P4):** Should tutors see the AI's reason and instruction label live on the suggestion card, or only in exports? P4 says decisions must be "inspectable by a human supervisor".
3. **Student role lock lifecycle (C14):** Can a student change or release their choice? What happens to the lock when a second student joins after it is set, or the tutor disables AI? Is the tutor intentionally unable to override?
4. **Tracking privacy (C12):** The feature says student personal info is not tracked, but full message content and context messages are exported. Do schools require consent, retention limits, or anonymised exports?
5. **Model governance (X4):** Which model is canonical for the tutor and for assessments? Is shipping qwen3.8-flash acceptable without a passing rubric run (the last one recorded is a failure on qwen3.5-flash)?
6. **Tutor-tunable generation (X5):** Should tutors still be offered temperature/max-tokens controls that have no effect? Remove them, or honour them?
7. **Age/reading-level adaptation (feedback #8):** Is detecting age/reading level a requirement, or is prompt-level plain language enough?
8. **Typing indicator / latency (#7):** Is this still wanted, and with what target (time to first acknowledgment)?
9. **Mandatory rating gate (C15):** Is forcing a student rating before every reply a research requirement or a product requirement? Does it apply to human-written tutor messages as well as AI-assisted ones (it does today)? Does it reach cyberbullying rooms?
10. **Tracking semantics (X7):** Should Quick Adjust regeneration count as `ignored` or `modified`? This affects the published acceptance/modification rates.
11. **Error wording (X6):** Should generic AI failures use non-transfer wording?
12. **Default persona (X9):** Should new rooms default to Peer coach (as the feedback status claims) or Trusted Adult (as code does)?
13. **Cyberbullying scope (V11):** Do the constitution's P/H/R rules and T/G requirements govern cyberbullying characters (including the "bully" character), or is a separate constitution needed? Current docs scope the constitution to phishing.
14. **Learning-outcome measurement:** The non-goals exclude longitudinal outcomes. Does the PRD need any outcome metric (e.g. pre/post, assessment pass rates) to support the product's stated vision?
15. **Multi-student rooms:** Is "blocked for now" (role choice) a long-term non-goal, or deferred work?
