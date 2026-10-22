# Extract B — Transfer Assessment (brownfield PRD input)

Intent: give the PRD author a source-traced inventory of transfer-assessment requirements, with current status checked against code, so the PRD can restate only current product behavior and drop superseded, stale and process-only material.

Extracted 2026-10-22 from worktree `rebuild_docs_by_BMAD` (HEAD `565ac76`). Read-only. Paths are relative to the repository root. `T09.x` = `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md` (lines 120–127). `ARM` = `tutor-system/docs/assessment-result-messages.md` (governing for result publication, 2026-10-17). `TSRC` = `tutor-system/docs/ai-behaviors/transfer-status-response-contract.md`. `QA-TA-nn` = `tutor-system/docs/transfer-assessment-qa-guide.md`. `FEAT` = `tutor-system/features/transfer_assessment.feature`. Archive specs = `docs/archive/_bmad-output/implementation-artifacts/spec-*.md`. `MIG17` = `tutor-system/supabase/archived_migrations/20261017000000_assessment_result_messages.sql`.

Layering rule applied: each of specs 101–104 starts with a 2026-10-17 "Assessment dialogue revision" banner that defers to ARM; ARM overrides older body text on publication, audience, exports and UI display ownership.

---

## 1. Capabilities

### C1. Room enablement and learning-target setup
- **Candidate requirement:** A tutor can turn in-room assessment on or off for a room and set up approved learning targets for it, by generating them from the room configuration or entering them by hand, before any assessment can happen.
- **Consequences:**
  1. New rooms (every teaching/test template and plain creation) store `transfer_learning_enabled = true`. Saved values and explicit opt-outs persist, and null is rejected.
  2. A transfer room with no approved targets shows the tutor a setup reminder, even when the checklist is collapsed. A learner sees "Waiting for the tutor to set up learning targets." and has no setup controls.
  3. `initialize_checklist` takes only `{area_text, item_type∈{detection_area,verification_step,understanding,behavior}, priority∈{critical,important,optional}}`, rejects extra keys, and initialises each item to `pending/none`. Replaying it keeps the existing items and progress.
  4. Missing targets are an explicit `TARGET_SETUP_REQUIRED` error. No assessment is prepared.
  5. Targets created before a learner joins sync to that learner when they join, giving each learner their own checklist.
- **Legacy IDs:** spec-103 "TransferLearning Refactor Contract" (specs/103-transfer-room-ui/spec.md:16); spec-102 refactor contract (specs/102-transfer-backend/spec.md:18); QA-TA-01; FEAT "A transfer room waits for approved learning targets" (FEAT:140); spec-template-assessment-default I/O matrix (archive spec-template-assessment-default.md:26-34).
- **Evidence:** `tutor-system/supabase/tests/room_assessment_default_on.sql`; `tutor-system/src/components/__tests__/ChecklistPanel.transfer.test.tsx`; `tutor-system/src/__tests__/transfer_assessment.bdd.test.tsx`; code `tutor-system/supabase/functions/assessment-api/index.ts:703-718`.
- **Status:** current. spec-103 Assumption "unavailable until release gates pass" (spec-103:178) is **stale**: the room default is on and the env flag defaults to true.

### C2. Assessment eligibility (final check after developed understanding)
- **Candidate requirement:** The system makes a final assessment due for a learner's target only when accepted learner evidence moves that target from Partial to Covered through `demonstrated_understanding`.
- **Consequences:**
  1. Only Partial → Covered `demonstrated_understanding` creates an outstanding requirement. `initial_signal` and `post_repair_signal` continue tutoring.
  2. Direct Pending → Covered `demonstrated_understanding` and any `spontaneous_transfer` complete the target with no quiz.
  3. A Covered pair alone never creates eligibility. Readiness comes from trusted before/after learning history plus the assessment lifecycle. There is no new eligibility field.
  4. Blockers (Guard, another open assessment, required tutor feedback) defer readiness without losing it, and no repeated understanding event is needed later. A later contradiction invalidates readiness.
  5. Editing tutor notes or priority keeps readiness. Changing the actual target wording or progress state invalidates readiness and cancels an open question without consuming an attempt.
  6. Replaying a preparation or a passed cycle never produces a second assessment for the same cycle.
- **Legacy IDs:** spec-101 FR-020, US3 AS2/AS7/AS8 (specs/101-transfer-domain/spec.md:23-25,164); T09.1; TSRC "Assessment after full understanding" (TSRC:99-117); spec-103 final-assessment revision (spec-103:20); QA-TA-02, QA-TA-14, QA-TA-15, QA-TA-16; FEAT:19-47; archive spec-final-assessment-after-development I/O matrix.
- **Evidence:** `tutor-system/supabase/tests/final_assessment_after_understanding.sql`; `tutor-system/src/services/__tests__/learningProgressTransitions.test.ts`; `tutor-system/src/__tests__/transfer_assessment.bdd.test.tsx`; `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`.
- **Status:** current (released 2026-10-14 per TSRC:6). The trigger "partial evidence makes assessment due", found in older text, is **superseded** by the 2026-10-13 Partial-only decision.

### C3. Assessment preparation and routing
- **Candidate requirement:** When a tutor requests the next AI turn in a transfer room, the system first asks the server whether an assessment is due. If one is due, the system prepares exactly one assessment-only draft for review and does not call the shared tutor.
- **Consequences:**
  1. `prepare_turn` (browser `prepareAssessment()`) first runs analysis up to the focus message. It returns either one draft or explicit `null`. On `null`, ordinary tutoring or Guard generation follows.
  2. An eligible assessment is mandatory. Provider failure, invalid output, missing targets and incomplete analysis surface as visible errors (`AI_PROVIDER_ERROR`, `AI_OUTPUT_INVALID`, `AI_OUTPUT_TRUNCATED`, `ANALYSIS_INCOMPLETE`, `TARGET_SETUP_REQUIRED`). The system never substitutes a dummy question or falls back.
  3. Generation makes at most two provider attempts: the original plus one format-only repair. Truncation is detected. Every attempt is recorded privately (`record_transfer_provider_attempt_v1`).
  4. Only a tutor (`can_review_assessment`) in an authorised room can call it.
  5. Routing tests assert zero shared-tutor calls when an assessment is eligible, including on provider error.
  6. Discarding an unsent draft does not satisfy eligibility, so the next request prepares again.
- **Legacy IDs:** spec-102 refactor contract (spec-102:20), spec-102 FR-004, FR-019, SC-009, US5; spec-103 refactor contract (spec-103:18); spec-104 refactor contract (spec-104:19); FEAT "An eligible assessment bypasses the shared tutor" (FEAT:147).
- **Evidence:** `tutor-system/supabase/functions/assessment-api/index.test.ts`; `tutor-system/src/pages/__tests__/RoomPagePost.transferDecision.test.tsx`; code index.ts:473-554.
- **Status:** current. The provider configuration in the spec-102 clarification is **stale** (see Conflict X3).

### C4. Assessment item validity
- **Candidate requirement:** Every assessment draft, whether generated or edited by a tutor, must be one valid transfer item for one known target before anyone can send it.
- **Consequences:**
  1. Exactly four options A–D with distinct, non-empty text. `single` has 1 correct option. `multiple` has 2 or 3.
  2. The stem has at most two sentences, and the full learner-visible question has at most 80 word-like segments. The boundaries are inclusive at 2 and 80 and exclusive at 3 and 81, with stable error categories.
  3. The draft must include a trimmed, non-empty `learner_safe_explanation`. A missing, blank or non-string explanation is rejected.
  4. `transfer_basis` (concept_rule, source_context, changed_context, source_evidence_message_ids) must cite only evidence IDs known for that target. The changed context must be a materially different situation, not a cosmetic name or brand swap.
  5. The draft carries no tutor mode, teaching instruction or duplicate response. Tutoring and Guard decisions keep `assessment = null`.
- **Legacy IDs:** spec-101 FR-001, FR-003, FR-007, US4, SC-003/SC-004; T09.2; spec-102 FR-005.
- **Evidence:** `tutor-system/src/services/__tests__/assessmentRendering.test.ts`; `tutor-system/src/services/__tests__/transferAssessmentGoldenFixtures.test.ts`; `tutor-system/src/services/__tests__/tutorDecisionContract.transfer.test.ts`; code `assessmentValidation.ts` (used at index.ts:252-264 and 538-541).
- **Status:** current. Code validates structure, while semantic validity ("meaningfully changed context") is enforced only by the prompt and evaluation (spec-101 Assumptions:200).

### C5. Tutor review and editing
- **Candidate requirement:** A tutor can review a private draft, edit it, and either send it or discard it. The review shows the target, the transfer context, the question, the answer type, the four options, the correct answer(s) and the learner-safe explanation ("Explanation after a second incorrect answer").
- **Consequences:**
  1. Any edit marks the draft "Unsaved edits ready to send". The production validator runs again before sending, and an invalid draft stays in review.
  2. When the answer type changes, the key is trimmed or normalised (single keeps at most one).
  3. "Discard candidate" removes the local draft. No draft row, revision or saved-draft claim exists.
  4. A server rejection maps to named local states (superseded / validation / unavailable / unauthorized / retryable). A superseded candidate cannot be sent again.
  5. The draft is never visible to learners or gradable until it is sent.
- **Legacy IDs:** spec-103 US1, FR-003, FR-004, FR-006; spec-101 US2 AS1-2, US5 AS5; T09.3; QA-TA-03.
- **Evidence:** `tutor-system/src/components/__tests__/AssessmentDraftEditor.test.tsx`; `tutor-system/src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx`; `tutor-system/src/pages/__tests__/RoomPagePost.transferDraft.test.tsx`.
- **Status:** current, with drift. There is no separate "confirm" step, so Send is the confirmation (AssessmentDraftEditor.tsx:298). Reject and regenerate actions do not exist (Conflict X6). Editing the stem overwrites `transfer_basis.changed_context` with the stem text (AssessmentDraftEditor.tsx:132-137).

### C6. Reviewed delivery
- **Candidate requirement:** A tutor can send a reviewed draft to its one intended learner. The server revalidates the draft and creates the public question atomically.
- **Consequences:**
  1. `send_reviewed` revalidates the full reviewed payload. Before an atomic write it rechecks room, learner, checklist, target, focus message, blockers and Guard. A stale target or active Guard blocks delivery (`ASSESSMENT_NOT_ELIGIBLE`, `ASSESSMENT_ALREADY_OPEN`).
  2. Delivery creates one tutor message (`response_mode: assessment`) whose content is the stem, plus one private grading record (key, explanation, basis). The reviewed values are used, and they become immutable once delivered.
  3. The public shape is exactly `{id, student_id, selection_type, stem, options}`. `student_id` only routes the question and does not authorise answers.
  4. Room participation stays tutoring or Guard. There is no room-level Assessment Mode.
  5. A retry after timeout produces exactly one question. An unsent, invalid, stale or duplicate candidate leaves no partial record.
  6. Learners see the stem once and each option once. The UI never edits question text.
- **Legacy IDs:** spec-102 FR-006, FR-007, FR-008, US1, SC-006; spec-103 FR-005, FR-010, FR-019, US3 AS3-4; T09.3; QA-TA-04; FEAT:49-57.
- **Evidence:** `tutor-system/supabase/tests/transfer_assessment_delivery_*.sql`; `tutor-system/src/contexts/__tests__/RoomContext.transferModes.test.tsx`; `tutor-system/src/components/__tests__/PublicAssessmentQuestion.test.tsx`; code index.ts:754-771, 163-182.
- **Status:** current. The spec-102 "Current Production Behavior" section (spec-102:28-36, `send_reviewed_tutor_response_v3`, public `assessment_key`) is **stale**: current code calls `send_reviewed_transfer_assessment_v1` with a private record.

### C7. Learner answers through option controls (option gate)
- **Candidate requirement:** A learner can answer only their own open question, by selecting the displayed option(s) and pressing Submit answer. Ordinary chat stays disabled for that learner until the question closes.
- **Consequences:**
  1. Single-answer questions use radio controls with the instruction "Choose one." Multiple-answer questions use checkboxes with "Select all that apply." Submit is unavailable until a choice is selected, and there is no free-text answer field.
  2. While the learner has an open question, their composer and generic Reply are disabled and the placeholder reads "select the correct option(s) to finish the assessments first". Another learner's question does not lock anyone else's chat.
  3. The shared send path rejects text-only, foreign, stale, duplicate, unknown-option and wrong-cardinality submissions before anything is saved (`ASSESSMENT_OPTIONS_REQUIRED`). The stored answer records the assessment ID, the question parent ID and the selected option IDs.
  4. Chat stays gated after a first incorrect answer. A terminal result or cancellation restores normal chat.
  5. Observers cannot post or answer (`OBSERVER_READ_ONLY`). Only the target learner can answer (`WRONG_LEARNER`).
  6. Each question shows the learner's saved submissions, which can be navigated with left/right controls ("Answer n of m"). Submissions are not separate chat comments.
- **Legacy IDs:** spec-103 FR-007, FR-008, US2 AS1-4/AS10; QA-TA-04, QA-TA-09; archive spec-assessment-option-gate-and-multi-target-e2e (I/O matrix).
- **Evidence:** `tutor-system/src/contexts/__tests__/RoomContext.transferAnswer.test.tsx`; `tutor-system/src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx`; `tutor-system/scripts/browser-e2e/workflows/assessment-answer.js`; code RoomContext.tsx:686-700, RoomPagePost.tsx:958, PublicAssessmentQuestion.tsx.
- **Status:** current. The free-text answer path in FEAT:61-65 ("B?") and FEAT:106-112 ("B or D", assistance) is **stale at the UI level**: it can still be reached only through direct API calls (Conflict X5).

### C8. Server grading and the two-attempt lifecycle
- **Candidate requirement:** The server grades each valid selection by exact set equality and allows at most two accepted attempts per delivered question. This attempt state is the only authority, across reloads, tabs and concurrent requests.
- **Consequences:**
  1. Grading deduplicates and sorts the selection, then requires exact set equality with the key. A subset, superset, empty set or all-four set (when the key is a proper subset) fails. No explanation or confidence is needed.
  2. First incorrect → `retry`: one attempt remaining, progress unchanged, no key or explanation.
  3. Correct on attempt 1 or 2 → `passed` exactly once, with no key or explanation published.
  4. Second incorrect → `failed` exactly once, and the reviewed key and explanation are published (see C10).
  5. Replaying an answer or request returns the stored result with no new attempt, evidence, history or transition. Concurrent distinct submissions become attempts 1 and 2 in a single order. A third submission, or any submission after a terminal result, returns the terminal state (`ASSESSMENT_TERMINAL` or duplicate).
  6. Processing uses optimistic concurrency (expected attempt count and resolution) and retries up to 3 times on `CONCURRENT_MODIFICATION`.
- **Legacy IDs:** spec-101 FR-005, FR-006, FR-009–FR-014, US1, SC-002, SC-005–SC-007; spec-102 FR-009–FR-018, US2, US4, SC-001–SC-003, SC-007; spec-103 FR-009, FR-012, SC-004; T09.4; QA-TA-05/06/07/08/10; FEAT:59-104.
- **Evidence:** `tutor-system/src/services/__tests__/assessmentGrading.test.ts`; `tutor-system/src/services/__tests__/transferAssessmentOrchestrator.test.ts`; `tutor-system/supabase/tests/transfer_assessment_race_*.sql`; `tutor-system/supabase/tests/transfer_assessment_terminal_faults.sql`; `tutor-system/src/contexts/__tests__/RoomContext.transferConcurrency.test.tsx`.
- **Status:** current. Grading is implemented twice: once in the TS pure resolver (transferAssessmentOrchestrator.ts:217, assessmentGrading.ts) and once in SQL (MIG17:263 `v_outcome := CASE WHEN v_selected=a.correct_option_ids ...`). SQL rejects a mismatch, so the database is the final authority.

### C9. Inputs that consume no attempt (clarification, assistance, stale, Guard)
- **Candidate requirement:** The system never consumes an attempt or changes progress for input that is not a valid selection for the learner's current, delivered, open question.
- **Consequences:**
  1. An ambiguous alternative ("B or D", "B/D", "not B") or a malformed combination leaves the question open and produces a clarification code. The UI says "Your selection is unclear… No attempt was counted."
  2. Content assistance or non-selection prose cancels the question as `assisted`, with no failing grade. A closure message is saved.
  3. Undelivered, stale (progress snapshot hash changed), wrong-assessment, wrong-learner, wrong-room and wrong-parent submissions are rejected with no effect.
  4. While Guard is active, the grade still commits, but progress application is deferred (`processing_state: deferred`, `progress_deferred: true`). It resumes after Guard clears, and only if the original target and cycle are still valid.
  5. A private processing ledger records handled non-consuming outcomes, so the system can tell them apart from pending grading.
- **Legacy IDs:** spec-101 FR-010, Edge Cases (spec-101:124-139); spec-102 FR-017, US4 AS5; T09.4; ARM:7, ARM:27; FEAT:106-112; spec-104 FR-025.
- **Evidence:** `tutor-system/src/services/__tests__/assessmentAnswerParser.test.ts`; `tutor-system/supabase/tests/assessment_result_messages.sql`; `tutor-system/supabase/tests/transfer_assessment_qa_regressions.sql`.
- **Status:** current server-side. With the option gate in place, the learner-prose paths (clarification and assistance) cannot be reached from the UI (Open question Q2).

### C10. Assessment result messages (publication)
- **Candidate requirement:** For every accepted answer, the system saves exactly one fixed-template, automatically attributed result message in room history. All authorised room participants see it, and it persists across reloads.
- **Consequences:**
  1. The templates are `Correct.`, `Incorrect. One attempt remaining.`, and `Incorrect. No attempts remaining. Correct option(s): X.\n<learner-safe explanation>` (MIG17:148-151). Creating or reading results makes no LLM call.
  2. Only the second-incorrect result publishes the stored, tutor-reviewed key and explanation. Pass and retry never do. The transfer basis, rationale and raw provider output stay private throughout.
  3. The grade, progress, accepted attempt and public result commit in one transaction, including when Guard defers progress. If the result write fails, the grade rolls back.
  4. Each result carries server-owned `assessment_event` metadata (event_key, kind result|closure, assessment/question/learner/answer IDs, attempt, outcome, counts, terminal, lifecycle, progress_deferred, closure_reason). A unique event key prevents duplicates. Participants and legacy writes cannot forge or edit the metadata.
  5. The audience is the tutor, all learners and observers in the room, and room exports. Reads inherit ordinary message visibility, which currently includes direct anonymous reads.
  6. Backfill covers historical attempts and cancellations from persisted authority, keeping original timestamps. Facts that cannot be recovered are marked unavailable and never regraded from dialogue.
- **Legacy IDs:** ARM (all); spec-101 revision banner (spec-101:7); spec-102 revision banner (spec-102:7) extending FR-007–008, FR-013–018, SC-004/005; spec-103 revision banner (spec-103:7); spec-104 revision banner (spec-104:7); QA guide revision (qa-guide:7); T09.3/T09.4 revision note (tutor-behavior-specification.md:112); archive spec-assessment-results-in-dialogue.
- **Evidence:** `tutor-system/supabase/tests/assessment_result_messages.sql`; `tutor-system/supabase/functions/assessment-api/index.test.ts`; `tutor-system/src/contexts/__tests__/RoomContext.transferIngress.test.tsx`; `tutor-system/src/components/__tests__/PostComment.transfer.test.tsx`.
- **Status:** current (runtime release commit `518a07d`, ARM:3). This **supersedes** the learner-response-only disclosure in spec-102 FR-013, SC-004, SC-005; spec-103 FR-014, US4 AS2; spec-104 FR-028, SC-009. The `terminal_failure_feedback` field is still returned in the processing response (index.ts:236-239), but UI display comes from the result message.

### C11. Progress effects of assessment results
- **Candidate requirement:** The system applies each assessment result to the target's existing status/understanding pair exactly once.
- **Consequences:**
  1. Pass from `covered/good` records `assessment_pass` once and keeps `covered/good`. The item is then complete.
  2. Fail (second incorrect) records `assessment_fail` once and moves the target to `needs_review/basic`. Tutoring resumes.
  3. A first incorrect answer leaves the target `covered/good` and the question open.
  4. Pass/fail from pending, partial or review is rejected (`INVALID_TRANSITION`). Only four pairs exist, and there is no parallel mastery field and no new-policy `excellent`.
  5. Recovery runs Review → `post_repair_signal` → Partial → `demonstrated_understanding` → Covered, then a new assessment in a different context. Failure alone never triggers Guard.
  6. A later contradiction reopens Covered (including a completed item) or Partial as `needs_review/basic`. A covered item is not routinely reassessed.
- **Legacy IDs:** spec-101 FR-008, FR-015, FR-016, US3, SC-001 (32 combinations); T09.5, T09.6; TSRC:46-117 (event table and state machine); QA-TA-13; FEAT:131-138.
- **Evidence:** `tutor-system/src/services/__tests__/learningProgressTransitions.test.ts`; `tutor-system/supabase/tests/final_assessment_after_understanding.sql`; `tutor-system/supabase/tests/transfer_status_events.sql`.
- **Status:** current (learningProgressTransitions.ts:77-85).

### C12. Tutor feedback before the next assessment (sequencing and multiple targets)
- **Candidate requirement:** After an assessment reaches a terminal result, a tutor must deliver a human feedback reply before the same learner can be given another assessment.
- **Consequences:**
  1. The next AI turn after a terminal result is tutoring feedback, or an independently required Guard response. It contains no assessment payload.
  2. Automatic result messages do **not** satisfy this gate, and neither do AI-suggestion acceptance or mandatory ratings. Only a human tutor reply does.
  3. The feedback must reply to the terminal answer of that assessment. A reply about the next topic does not count (QA-TA-09A, option-gate spec change log line 75).
  4. When several targets become ready, the server's priority order queues them one at a time, each with distinct question and assessment IDs. A closed cycle never blocks the next target.
  5. Feedback after failure corrects the concept and gives an accurate safe action. During an open question or retry, tutor feedback must not reveal, paraphrase or eliminate options.
- **Legacy IDs:** spec-101 US5 AS2, Edge Cases (spec-101:137); T09.6; ARM:17, ARM:27; QA-TA-09A, QA-TA-11; FEAT:123-129.
- **Evidence:** `tutor-system/scripts/browser-e2e/workflows/assessment-delivery.js`; `tutor-system/src/__tests__/transfer_assessment.bdd.test.tsx`; `tutor-system/supabase/tests/assessment_result_messages.sql`.
- **Status:** current.

### C13. Reload, multi-tab and ingress convergence
- **Candidate requirement:** Every participant sees the same question, answers, attempt count, remaining chances and terminal state after a join, reload, remount, reconnect, polling, realtime update or duplicate tab.
- **Consequences:**
  1. The room waits for the stored identity to be restored before its first join, then replays persisted answers before showing outcomes. An unanswered question stays answerable.
  2. All ingress paths merge by persisted ID, with no duplicate messages or questions. Order is causal (question → answer → result), with ID as the tie-breaker. A result that arrives before its answer is handled.
  3. A stale or out-of-order event cannot reopen a terminal question. Lifecycle state is rebuilt from `assessment_event` without regrading.
  4. Teacher-selected learner, message, checklist, target and parent associations survive later messages from other learners or tabs.
  5. Local selection may reset on reload. The authoritative lifecycle may not.
- **Legacy IDs:** spec-103 US3, FR-001, FR-011, FR-012, FR-018, SC-001, SC-005; spec-102 SC-001; ARM:23; QA-TA-10; FEAT:96-104.
- **Evidence:** `tutor-system/src/contexts/__tests__/RoomContext.transferIngress.test.tsx`; `tutor-system/src/contexts/__tests__/transferAssessmentUiAdapter.lifecycle.test.ts`; `tutor-system/src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx`; code transferAssessmentUiAdapter.ts:465-521.
- **Status:** current.

### C14. AI tutor context and the readiness gate
- **Candidate requirement:** The AI tutor receives assessment facts only through saved room dialogue (the public question and options, learner answers, and attributed result messages). The system does not call the provider while trusted grading for the focused learner is incomplete.
- **Consequences:**
  1. The dynamic `VERIFIED ASSESSMENT STATE` prompt section has been removed. Only invariant instructions remain: follow recorded grades, keep retries private, handle cancellations accurately, give required feedback, and keep safety/Guard priority.
  2. Initial generation, a focus on a historical answer, and regeneration all require complete trusted result history. A pending grade, missing result or failed history read gives an explicit processing/unavailable state before the provider call.
  3. Readiness covers only the focused learner. Another learner's unfinished answer does not block them.
  4. `read_review` can recover pending answers through the deterministic processor, running as the learner (index.ts:677-687).
  5. Readiness still applies to historical assessments after transfer learning is disabled (but see Conflict X8).
- **Legacy IDs:** ARM:25-27; archive spec-assessment-results-in-dialogue "History and generation".
- **Evidence:** `tutor-system/src/services/__tests__/transferTutorRequestV3.test.ts`; `tutor-system/supabase/functions/assessment-api/index.test.ts`.
- **Status:** current.

### C15. Role-appropriate views, exports and per-participant collapse
- **Candidate requirement:** Each participant gets only their role's view and exports. Progress is shown only for the selected learner, and the private assessment material in C10 is never exposed.
- **Consequences:**
  1. Tutors see the selected learner's progress. Learner B never receives learner A's progress through the room UI.
  2. Exports contain public messages, the public question, answer lifecycles and result messages (with event metadata). The terminal explanation appears only for failed terminal results (roomExportBuilder.ts:132-165).
  3. Teacher-only metadata appears only in the teacher export, and exports are never a source of progress authority.
  4. Every assessment message starts expanded. Each participant can collapse or expand it, and this changes no shared state (PostComment.tsx:208-211).
  5. Legacy room-shared checklist values are never displayed as transfer verification.
- **Legacy IDs:** spec-103 US4, FR-013, FR-014, FR-015, FR-020, SC-003, SC-009; spec-102 US3 AS3, SC-005, SC-008; ARM:9.
- **Evidence:** `tutor-system/src/contexts/__tests__/roomExportBuilder.transfer.test.ts`; `tutor-system/src/components/__tests__/PostComment.transfer.test.tsx`; `tutor-system/src/components/__tests__/ChatMessage.transfer.test.tsx`.
- **Status:** current, as amended by C10 (the terminal-failure explanation is now in every role's export).

### C16. Kill switch, error surface and clearing history
- **Candidate requirement:** An operator can disable all assessment operations with `TRANSFER_ASSESSMENT_ENABLED=false`, while a room owner can still clear chat history atomically.
- **Consequences:**
  1. The flag defaults to `true` (index.ts:832). An explicit `false` makes every operation except `clear_chat_history` return `ASSESSMENT_FEATURE_DISABLED` (503). A missing Supabase URL or key also disables operations (index.ts:797-806).
  2. When disabled, the room shows an "unavailable" state, and legacy tutoring/Guard paths keep working.
  3. Errors use one envelope `{ok:false, error:{code,message,retryable}}` with stable codes and statuses (index.ts:103-128).
  4. Clear Chat History deletes assessment sources before messages, atomically. It keeps the backup/export flow and the pre-populated dialogue. Individual event edits and deletes stay blocked.
  5. An outdated client gets `CLIENT_RELOAD_REQUIRED` unless it sends `x-practice-contract: cyberbullying-v2` (index.ts:644-646).
- **Legacy IDs:** spec-102 FR-003, FR-022; spec-103 FR-016, FR-017; ARM:29; release-decision (specs/orchestration/transfer-assessment/release-decision-2026-09-30.md:9).
- **Evidence:** `tutor-system/supabase/functions/assessment-api/index.test.ts`; `tutor-system/src/contexts/__tests__/transferAssessmentUiAdapter.test.ts`.
- **Status:** current.

### C17. Coexistence with legacy data
- **Candidate requirement:** Legacy checklists, messages and incomplete historical assessments keep their original meaning and are never silently promoted into transfer assessments.
- **Consequences:**
  1. `progress_policy_version` is either `legacy_v1` or `transfer_v1`. Only `transfer_v1` uses the transfer rules.
  2. An assessment with no recoverable key or explanation stays `legacy_incomplete` (`LEGACY_ASSESSMENT_INCOMPLETE`). Missing values are never inferred.
  3. A migration cancels incompatible historical open questions without changing attempts, results or progress.
- **Legacy IDs:** spec-101 Assumptions:202, Edge Cases:139; spec-102 Edge Cases:149-150; spec-103 US4 AS4; archive option-gate spec change log line 74.
- **Evidence:** `tutor-system/supabase/tests/transfer_assessment_legacy_fixture_*.sql`; `tutor-system/supabase/tests/final_assessment_release_existing_rows.sql`; `tutor-system/src/services/__tests__/transferAssessmentMigration.test.ts`.
- **Status:** current.

### C18. Identity and authorization (as it bears on assessment)
- **Candidate requirement:** The service authorises every assessment operation from the database role and room membership of the app user ID in `x-application-user-id`. It never trusts caller-supplied role or scope claims.
- **Consequences:**
  1. A missing or malformed UUID gives `UNAUTHORIZED`. An inactive profile gives `FORBIDDEN`. Allowed rooms are those with an active session plus rooms the user owns as tutor.
  2. Only tutors can prepare, send, review, initialise checklists, edit progress or clear history.
  3. The header is self-asserted and does not prove who is using the browser, so impersonation is possible. This limitation is accepted and recorded.
  4. Direct and legacy untrusted writes cannot create attempts, read private grading data, or change transfer progress.
- **Legacy IDs:** spec-102 FR-002, FR-021, US3, SC-008; release-decision:20.
- **Evidence:** `tutor-system/supabase/tests/transfer_assessment_direct_roles.sql`; `tutor-system/supabase/functions/assessment-api/index.test.ts`; code index.ts:808-830.
- **Status:** current, with a known weakness.

---

## 2. Constraints / NFRs

| ID | Constraint | Sources |
|---|---|---|
| NFR-1 Answer-key privacy | Correct option IDs and the learner-safe explanation stay server-private until a terminal second-incorrect result, and are then published to the room (C10). The transfer basis, rationale, raw provider output, credentials and generation records are **never** public. Public and processed DTOs use allowlists (`PUBLIC_MESSAGE_DTO_KEYS`, `PUBLIC_ASSESSMENT_FORBIDDEN_KEYS`, transferAssessmentService.ts:55-83), and the Edge projection drops unknown fields (index.ts:184-241). Verified 2026-10-22: `public.messages` has no `assessment_key` column. | spec-101 FR-004, SC-004; spec-102 FR-007/008, SC-005; spec-103 FR-014; spec-104 FR-028; ARM:9 |
| NFR-2 Reader-identity limits | Result messages, including terminal explanations, are readable by anyone who can read ordinary messages, currently including anonymous direct reads. App identity is self-asserted. These are accepted limitations, not protections. | ARM:11; spec-102 FR-002; release-decision:20 |
| NFR-3 Server authority | Grading, attempt counting, lifecycle, disclosure and progress are decided only on the server (Edge resolver plus SQL check). The browser never grades, increments, resets or infers. The provider never grades or emits pass/fail. | spec-101 Clarification:33; spec-102 FR-010; spec-103 FR-008/009; T09.5 |
| NFR-4 Idempotency and concurrency | Repeating a request ID, answer message ID or event key returns the stored result. Concurrent submissions resolve to at most 2 attempts, 1 terminal result and 1 transition, using an optimistic expected-state check plus DB locks. | spec-101 FR-014; spec-102 FR-015/016, SC-002; ARM:15 |
| NFR-5 Atomicity | Terminal grading commits the assessment state, accepted attempt, causal evidence, progress pair, before/after history, result message and idempotency record together. Failure rolls all of it back. | spec-102 FR-018, SC-007; ARM:17 |
| NFR-6 Reload/tab persistence | All lifecycle state survives reload, remount, reconnect, polling, realtime updates and duplicate tabs. | spec-101 Clarification; spec-102 SC-001; spec-103 FR-012, SC-005 |
| NFR-7 Fail closed / no silent fallback | Missing config, provider errors, invalid output, missing scope or missing history give stable errors. There is no dummy question, inferred value or fallback model. | spec-102 FR-003, FR-019; spec-103 FR-016; ARM:25 |
| NFR-8 Feature flag / rollback | `TRANSFER_ASSESSMENT_ENABLED` defaults to true, and `false` disables operations. A per-room `transfer_learning_enabled` (default true) also exists. Rollback evidence was "accepted pending" at the 2026-09-30 decision (now being closed by an ADR). | spec-102 FR-022; release-decision:9,18; archive spec-template-assessment-default |
| NFR-9 Determinism | Domain outcomes can be computed without a provider, DB, browser or flag (pure resolver and transitions). Result creation makes no LLM call. | spec-101 FR-019, SC-008; ARM:7 |
| NFR-10 Provider bounds | Generation uses at most 2 attempts, temperature 0.3, max 1200 tokens and JSON mode (index.ts:498-509). Analysis uses temperature 0, 600 tokens and 1 repair. Every attempt is audited privately. | spec-102 FR-019, SC-009; transfer-status-analysis.md:15-17 |
| NFR-11 Accessibility/UI | Each participant can collapse or expand an assessment message through an accessible control, and the stem and each option render exactly once. | spec-103 FR-019, FR-020 |

---

## 3. Non-goals stated in sources

- Assessment is not a room-level Assessment Mode or a separate quiz application. It is one tutor turn (spec-103 Out of Scope:185; spec-102:220; T09.3).
- There is no client-side grading, no client-side attempt authority and no direct progress change from the room (spec-103:185; spec-102:220).
- There is no parallel mastery field, no new-policy `excellent`, and legacy progress is not reinterpreted as verification (spec-101:211; T09.5).
- No new sign-in or authentication product (spec-101:210; spec-102:220; spec-103:185).
- The key and explanation are not disclosed automatically after a correct answer (spec-102:221; ARM:9).
- No quiz after direct Pending → Covered or spontaneous transfer (TSRC:105; T09.1).
- Covered targets are not routinely reassessed (spec-101:138; T09.6).
- Failure alone never triggers Guard (spec-101 FR-016; T09.6).
- No saved draft row, draft revision or content versioning for candidates (spec-103 FR-003, FR-005; spec-101 Key Entities:168).
- There are no separate reject or regenerate actions (spec-103 FR-006), though T09.3 disagrees (X6).
- Coverage does not claim long-term retention or real-world behavior (TSRC:59; T09.5).
- Evaluation does not implement production generation and cannot satisfy DB, authorization, browser or release gates (spec-104:25, FR-016).
- Keyword or pattern matching does not replace semantic judgment (spec-104 FR-030; ARM-era instruction "do not replace semantic review with wording assertions").

---

## 4. Glossary (with naming drift)

| Term | Definition | Drift / aliases |
|---|---|---|
| Transfer | Applying the same concept to a materially different concrete situation. Changing a name or brand does not count. | "transfer learning", "TransferLearning" (component name), "transfer check" |
| Transfer assessment | A tutor-reviewed four-option multiple-choice question that tests a target in a changed context, delivered as one tutor turn. | "final assessment", "final check", "final application check", "in-room assessment" (UI toggle), "assessment", "quiz", "question" |
| Transfer-enabled room | A room with `rooms.transfer_learning_enabled = true`. | UI label "Enable In-Room Assessment". The env-level flag `TRANSFER_ASSESSMENT_ENABLED` is separate. |
| Learning target | One approved checklist item (`area_text`, `item_type`, `priority`) owned per learner in a transfer room. | "checklist item", "target", "knowledge point" (option-gate spec), "concept", "Detection Area / Verification Step" |
| Progress pair | `status/understanding_level`. Only four pairs are valid: `pending/none`, `partially_covered/basic`, `needs_review/basic`, `covered/good`. | UI and docs say Pending / Partial / Review (Needs Review) / Covered |
| Covered | Sufficient understanding has been demonstrated. This is **not** completion when reached from Partial, because the assessment is still outstanding. | "verified" in older FEAT text (FEAT:138, "already verified concept") |
| Partial | `partially_covered/basic`. A relevant component is shown, but essential content is unresolved. | "partially covered" |
| Pending | `pending/none`. No evidence yet. | — |
| Item complete | A phase derived from evidence and lifecycle (direct Pending→Covered, spontaneous transfer, or assessment pass). It is not a stored state. | "completion", "resolved requirement" |
| Outstanding assessment requirement / readiness | A target due for assessment after Partial→Covered `demonstrated_understanding`. It is derived from history, not a stored field. | "assessment due", "eligible", "readiness" (also used for **history readiness**, a different concept, see below) |
| History readiness | Whether the focused learner's answers all have committed results before an AI tutor call. | Overloads "readiness" (ARM:27 vs TSRC:107) |
| Learning event kinds | `initial_signal`, `demonstrated_understanding`, `post_repair_signal`, `spontaneous_transfer`, `contradiction` (model-emitted), plus `assessment_pass`, `assessment_fail`, `no_change` (deterministic). | spec-101 counts "eight event kinds" |
| Draft / candidate | `TransferAssessmentDraft {reason, target_item_id, assessment: PrivateAssessment}`. It exists only in local review and is never persisted as a draft. | "candidate", "review question", "teacher review question" |
| Learner-safe explanation | Tutor-editable text explaining why the key is correct. Published only after the second incorrect answer. | UI label "Explanation after a second incorrect answer"; "terminal failure explanation", "terminal feedback" |
| Attempt | One accepted, valid selection for the current open question. There are at most 2. | "chance", "valid selection", "submission" (submissions can be non-consuming) |
| Lifecycle / resolution | Question lifecycle is `delivered`(open) / `passed` / `failed` / `cancelled` / `legacy_incomplete`. Snapshot resolution is `open` / `passed` / `failed`. | `answer_outcome` `retry`/`passed`/`failed`; `processing_state` `applied`/`duplicate`/`rejected`/`deferred`; resolver dispositions `retryable`, `assisted`, `unresolved`, `stale`, `guard_deferred`, `not_delivered`, `duplicate` |
| Result message | A saved, automatic, fixed-template room message for each accepted answer, presented as "Assessment result". It is stored as a tutor-role row with `response_mode: null` and `assessment_event.kind = result`. | "automatic result", "assessment result row" |
| Closure message | `assessment_event.kind = closure`, saved for cancellation by assistance or target/progress change. | "cancellation notice" |
| Assisted | The question was cancelled because content help could have revealed the answer. There is no grade. | "assistance cancels" |
| Guard / Guard blocker | Room participation mode `guard_mode = true` (a protective response for an imminent unsafe action). It blocks preparation and delivery and defers progress application. Assessment blockers are Guard, an open assessment and required feedback. | "Guard mode", "progression lock", "protective response"; TSRC:109 says blockers are "Guard and the assessment lifecycle" |
| Required feedback | A human tutor reply, parented to the terminal answer, that must exist before the next assessment. | "feedback turn", "tutor-feedback gate" |
| Option gate | While a learner's question is open, their chat composer and Reply are disabled, so they can answer only through option controls. | — |
| Room participation mode | Tutoring or Guard (boolean `guard_mode`). Never "assessment". | `response_mode: assessment` is per message, not per room |
| Observer | A read-only room participant who cannot post or answer. | — |

---

## 5. Conflicts (specs vs specs, specs vs code)

| # | Conflict | Locations | Resolution hint |
|---|---|---|---|
| X1 | **Terminal-failure audience.** The older body text limits key/explanation disclosure to the "authorized learner response", and learner exports exclude the key. ARM publishes them to all room participants, observers, exports and anonymous readers. The QA Roles table still says learners must not see "another learner's lifecycle" and observers must not see "learner-only assessment lifecycle". | spec-102:168 (FR-013), :197 (SC-004), :198 (SC-005); spec-103:138 (FR-014), :105; spec-104:149 (FR-028), :183 (SC-009); qa-guide:56-57 vs ARM:9, MIG17:150 | ARM governs. The QA Roles table is stale. The PRD should state the room-wide audience explicitly and flag the privacy trade-off. |
| X2 | **Operation set.** spec-102 FR-001 says six operations. Code has ten: it adds `join_room`, `edit_learning_progress`, `read_review` and `clear_chat_history`. | spec-102:156 vs index.ts:18-21 | Code is current, so the spec is stale. |
| X3 | **Provider configuration.** The spec says `REACT_APP_OAI_API_KEY`, `REACT_APP_OAI_BASE_URL` and an exact `OAI_MODEL`, with mismatch failing closed. Code reads `OAI_API_KEY`/`OAI_BASE_URL` and hard-codes the model `qwen3.5-flash` for generation (`DEFAULT_AI_MODEL` for analysis). | spec-102:48, :210 vs index.ts:24-25, 303-308, 345 | Code is current. The model choice is hard-coded rather than configured. |
| X4 | **Production snapshot.** spec-102 "Current Production Behavior" describes `send_reviewed_tutor_response_v3`, `process_assessment_message_v1`, an unused private table and a public `assessment_key`. Current code calls `send_reviewed_transfer_assessment_v1`, `process_assessment_message_v2` and private storage. The release decision claims a participant-readable `assessment_key`, which was verified absent on 2026-10-22. | spec-102:13-36; release-decision:20 vs index.ts:622, 760; MIG17:141-151 | Both are stale. Keep them out of the PRD. |
| X5 | **Free-text answers.** FEAT has the learner submit `"B?"` with an explanation, and `"B or D"` followed by content help. T09.4 allows prose parsing. spec-103 FR-008 and the option gate forbid free-text answers in the UI. The server still parses prose when `selected_option_ids` is null. | FEAT:61-65, :106-112; tutor-behavior-specification.md:123 vs spec-103:132; RoomContext.tsx:686-699; index.ts:580-582, 618-620; 20261013 SQL post_assessment_message_v2 (allows null selection) | Decide whether the server should also reject prose answers (PRD decision). |
| X6 | **Reject/regenerate.** T09.3 lets the teacher "edit and reconfirm, reject, or explicitly regenerate". spec-103 FR-006 says there is no separate reject or regenerate action. spec-101 US5 AS5 says explicit rejection suppresses automatic re-proposal. spec-103 says discarding does not satisfy eligibility, so re-proposal happens on the next request. Code has only Discard and Send. | tutor-behavior-specification.md:122; spec-103:130, :18; spec-101:120 vs AssessmentDraftEditor.tsx:291-301 | Pick one rule for re-proposal after discard. |
| X7 | **Confirmation step.** spec-103 FR-004 and SC-002 require edits to clear a confirmation and need explicit reconfirmation. Code has no confirmation control: Send is the confirmation, and edits only set `dirty`. | spec-103:128, :164 vs AssessmentDraftEditor.tsx:65, 298 | Simplify the requirement to "explicit Send after review". |
| X8 | **History readiness when disabled.** ARM says readiness "remains required for historical assessments after transfer learning is disabled". With the env flag false, `read_review` (the recovery/readiness path) is refused. | ARM:27 vs index.ts:664 | Probably means the per-room toggle. Clarify (Q4). |
| X9 | **Retry wording.** QA expects "Incorrect. 1 attempt remaining.". The saved result is "Incorrect. One attempt remaining.". The export renders "Incorrect. 1 attempt remaining.". | qa-guide:158 vs MIG17:149; roomExportBuilder.ts:150-152 | Cosmetic. Pick one canonical text. |
| X10 | **Where verdicts are displayed.** spec-103 US2 AS5–7 and FR-009 have the question UI show "incorrect", the remaining chance and the explanation. Since 2026-10-17 the saved result message owns the verdict and explanation, and `PublicAssessmentQuestion` shows only selections and processing/rejection status. | spec-103:69-71, :133 vs ARM:23; PublicAssessmentQuestion.tsx:106-154 | Superseded by the banner. Rewrite the PRD in terms of the result message. |
| X11 | **Blocker list.** T09.1 and QA name Guard, an open assessment and required feedback. TSRC says the 2026-10-14 decision limits blockers to "Guard and the assessment lifecycle". | tutor-behavior-specification.md:120; qa-guide:100 vs TSRC:109 | Probably the same rule (feedback is part of the lifecycle). Normalise the wording. |
| X12 | **Stale status headers.** spec-101 "Ready for implementation", spec-103 "Planned", spec-104 "Draft". All are implemented and released, per ARM and TSRC. | spec-101:12; spec-103:11; spec-104:14 | Ignore the headers. |
| X13 | **Edited stem overwrites the transfer basis.** When the stem is edited, `changed_context` is replaced by the stem text, which can break basis/stem consistency (T09.2) and the explanation-provenance evaluation (spec-104 FR-029). | AssessmentDraftEditor.tsx:132-137 vs tutor-behavior-specification.md:121; spec-104:150 | Verify the intent. |
| X14 | **Public assessment id.** The adapter builds the public projection with `id = messageId` for the preview, but lifecycle matching uses `assessmentId === question.id`. | transferAssessmentUiAdapter.ts:370-372 vs :322-323 | Low impact (preview only). Note it for the architect. |

---

## 6. Evaluation/release process, not product requirements (keep out of the PRD)

- Everything in spec-104 except the product-facing parity rule. This covers scenario schemas, partitions, holdouts, calibration, the 80% semantic threshold, semantic pairs, run manifests, quality-gate verdicts and immutable run evidence (spec-104 FR-001–FR-022, FR-031, FR-032, SC-001–SC-008, SC-010). At most, the PRD might keep one NFR: "assessment generation quality is evaluated against a calibrated rubric before prompt changes ship".
- spec-102 FR-021 (PostgreSQL 17 disposable-restore verification), FR-023 (lane separation), SC-010; spec-101 FR-017, SC-008 (evidence reporting).
- Release decision 2026-09-30 (owner authorisation, open gates, `release_not_approved` verdict). An ADR is closing this.
- AGENTS.md staging→production delivery, lease, merge-before-production and artifact hashing. Archive specs' "Tasks & Acceptance", "Verification" and "Release follow-up" sections. The ARM "Delivery evidence" section (ARM:31-33).
- QA guide "Evidence To Capture" and the `@non_feasible` note (qa-guide:330-351).
- Backfill execution order ("backfill precedes prompt-state removal"; ARM:19). This is a rollout constraint. Only the product outcome (historical results appear exactly once, and unrecoverable facts are marked unavailable) belongs in the PRD.
- Model-conformance results. Example: the analysis prompt failed the semantic benchmark (archive spec-final-assessment-after-development:68-76). This is evidence, not a requirement.

---

## 7. Open questions

- **Q1 (privacy decision).** Should the second-failure key and explanation really be readable by other learners, observers and anonymous readers (ARM:9-11)? Or should the PRD scope publication to the room's authorised participants and treat anonymous read access as a defect? This affects NFR-1/NFR-2 and conflicts with the QA Roles table (X1).
- **Q2.** The option gate makes learner prose impossible during an open question. Are clarification ("B or D") and assistance cancellation still product requirements? If they are, how does a learner ask for help, and does a tutor's content help trigger `assisted`? If not, should the server reject prose answers (X5)?
- **Q3.** After a tutor discards a candidate, should the next AI request propose the assessment again (current behavior) or suppress it (spec-101 US5 AS5)? Is reject/regenerate in or out (X6)?
- **Q4.** Which "disabled" does ARM:27 mean: the per-room toggle or the env kill switch? Should `read_review` and readiness work while the env flag is false (X8)?
- **Q5.** Should the generation model (`qwen3.5-flash`) and provider settings be configurable with fail-closed validation (spec-102 clarification), or is hard-coding acceptable (X3)?
- **Q6.** Must the required tutor feedback be a reply parented to the terminal answer (QA-TA-09A), or can it be any later human tutor message? The PRD should state one rule.
- **Q7.** When the tutor edits the stem, should the transfer basis `changed_context` be kept, be editable, or follow the stem (X13)? Must the generated values plus edit provenance be retained (spec-104 FR-029)?
- **Q8.** Should the PRD carry the per-learner multi-target queue ("server priority order", QA-TA-09A) as a stated rule? Who defines the priority order (item priority? T02?), and is there an upper limit on questions per session?
- **Q9.** Identity: given the self-asserted `x-application-user-id` and that any tutor-role user with a session in the room passes `can_review_assessment`, does the PRD need a stronger requirement (for example "only the room's tutor can review or send"), or is this explicitly out of scope?
