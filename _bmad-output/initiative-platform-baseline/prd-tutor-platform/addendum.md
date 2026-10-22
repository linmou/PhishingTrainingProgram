# Addendum: Online Safety Tutor Platform PRD

Intent: keep the material the PRD needs but should not carry in its main text — where each requirement came from, the technical choices currently deployed, and the known differences between the PRD and current behavior.

Updated: 2026-10-22 (aligned with the owner's review and open-question decisions). Source baseline commit: `b671519`; extracts were taken at `565ac76`. Evidence: `extract-A-pedagogy-tutoring.md`, `extract-B-transfer-assessment.md`, `extract-C-cyberbullying-rooms-targets.md`, `extract-D-platform-tested-behavior.md` in this folder. Archived sources are under `docs/archive/`.

## A. Legacy requirement crosswalk

Legacy IDs are cited with their source so colliding numbers stay distinct: `spec-101 FR-011` = `specs/101-transfer-domain/spec.md` (moves to `docs/archive/specs/` when Spec Kit is retired; the path prefix changes, the ID does not), `cb-request R4` = `plan/cyberbullying-practise/request.md`, `behavior T02` = `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md`, `constitution H1` = `tutor-system/docs/ai-behaviors/constitution.md`, `QA-TA-05` = `tutor-system/docs/transfer-assessment-qa-guide.md`, `feature:<name>` = `tutor-system/features/<name>.feature`, `spec-<slug>` = `docs/archive/_bmad-output/implementation-artifacts/spec-<slug>.md`.

| PRD | Legacy sources |
| --- | --- |
| FR-1 | feature:student_view, observer_view, tutor_view (role selection); docs simplified-authentication, AuthContext; cb-request R9 |
| FR-2 | UserProfile tests (no feature) |
| FR-3 | AuthContext sign-out behavior |
| FR-4 | feature:room_management, room_op_configuration, tutor_view |
| FR-5 | cb-request R1, R9 |
| FR-6 | spec-global-room-template-read; cb-request R1 (round trips — see G-11) |
| FR-7 | cb-request R1, R5; cyberbullying-practise.md |
| FR-8 | feature:room_discovery (behavior-test rooms) |
| FR-9 | feature:tutor_room_persistence |
| FR-10 | feature:room_management (password scenarios) |
| FR-11 | feature:student_view, room_discovery |
| FR-12 | feature:student_view, room_discovery; cb-request R9 |
| FR-13 | feature:observer_view, room_discovery, real_time_chat (observer read-only) |
| FR-14 | feature:real_time_chat; spec-full-tutor-conversation-history |
| FR-15 | feature:real_time_chat (typing) |
| FR-16 | README "Required Response Ratings"; feature:real_time_chat (feedback); cb-request R8 |
| FR-17 | Withdrawn 2026-10-22 (formerly supabase-service.md "Chat History Management"; assessment-result-messages, clear history). See G-21. |
| FR-18 | spec-unified-learning-targets (supersedes spec-five-learning-targets); spec-103 refactor contract; QA-TA-01; owner decision 2026-10-22 (OQ-14: all new learning targets learner-owned) |
| FR-19 | spec-recheck-messages-after-goals |
| FR-20 | transfer-status-response-contract; transfer-status-analysis.md; behavior T02 analysis; cb-request R4 |
| FR-21 | transfer-status-response-contract (event table); spec-101 FR-015, FR-016 |
| FR-22 | cb-request R2, R4; transfer-status-response-contract |
| FR-23 | spec-learning-progress-upper-right; spec-chat-feedback-and-tutor-ui-fixes |
| FR-24 | feature:ai_assistant (settings) |
| FR-25 | feature:ai_assistant; spec-full-tutor-conversation-history |
| FR-26 | behavior T01–T08; constitution P1–P3, R1–R5, H1–H3; user_feedback.md #1–#6, #8 |
| FR-27 | constitution P4, H4; tutor-response-contract |
| FR-28 | feature:ai_suggestion_tracking, ai_assistant |
| FR-29 | feature:student_ai_tone; behavior T05; user_feedback.md #3, #9 |
| FR-30 | behavior G01–G03; constitution P3.3, R4 |
| FR-31 | spec-template-assessment-default; spec-102 FR-022 |
| FR-32 | behavior T09.1; spec-101 FR-020; spec-final-assessment-after-development; QA-TA-02, 14, 15, 16 |
| FR-33 | spec-102 FR-004, FR-019; spec-103 and spec-104 refactor contracts |
| FR-34 | behavior T09.2; spec-101 FR-001, FR-003, FR-007; spec-102 FR-005 |
| FR-35 | behavior T09.3; spec-103 FR-003, FR-004, FR-006; QA-TA-03 |
| FR-36 | spec-102 FR-006–FR-008; spec-103 FR-005, FR-010, FR-019; QA-TA-04 |
| FR-37 | spec-103 FR-007, FR-008; spec-assessment-option-gate-and-multi-target-e2e; QA-TA-04, 09 |
| FR-38 | behavior T09.4; spec-101 FR-005, FR-006, FR-009–FR-014; spec-102 FR-009–FR-018; QA-TA-05–08, 10 |
| FR-39 | assessment-result-messages.md (governing); spec-assessment-results-in-dialogue; revision banners of spec-101–104 |
| FR-40 | behavior T09.5, T09.6; spec-101 FR-008, FR-015, FR-016; QA-TA-13 |
| FR-41 | behavior T09.6; QA-TA-09A, QA-TA-11 |
| FR-42 | spec-103 FR-001, FR-011, FR-012, FR-018; QA-TA-10 |
| FR-43 | assessment-result-messages.md (history and generation) |
| FR-44 | cb-request R4 |
| FR-45 | cb-request R6 |
| FR-46 | cb-request R4, R6 |
| FR-47 | cb-request R5, R6; final_plan R13 |
| FR-48 | cb-request R6, R7; final_plan R13 |
| FR-49 | cb-request R8 |
| FR-50 | feature:chat_history_download; spec-103 FR-013–FR-015; cb-request R8 |
| FR-51 | feature:ai_suggestion_tracking; cb-request R7 |
| FR-52 | Owner decision 2026-10-22 (OQ-8); ownership checks in cb-request R9 and the cyberbullying reviewed send |
| FR-53 | feature:checklist_management (manual status, notes); assessment-api `edit_learning_progress`; owner decision 2026-10-22 (OQ-14) |
| NFR-1 | constitution P4; tutor-response-contract |
| NFR-2 | `.specify/memory/constitution.md` II; spec-101–103 server-authority FRs |
| NFR-3 | `.specify/memory/constitution.md` II; spec-101 FR-004; spec-102 FR-007, FR-008 |
| NFR-4 | `.specify/memory/constitution.md` II and Project Constraints; release-decision 2026-09-30 |
| NFR-5 | spec-101 FR-014; spec-102 FR-015, FR-016 |
| NFR-6 | spec-102 SC-001; spec-103 FR-012, SC-005 |
| NFR-7 | `.specify/memory/constitution.md` V; spec-102 FR-003, FR-019 |
| NFR-9 | constitution H1–H4 |
| NFR-10 | constitution (revision authority); cb-request R10 |
| NFR-11 | final_plan (client contract) |

Not carried into the PRD (process or evaluation, not product behavior): spec-104 FR-001–FR-022, FR-031, FR-032 and its success criteria; spec-102 FR-021, FR-023; spec-101 FR-017; cb-request R10–R12; the 2026-09-30 release decision (closed by ADR).

## B. Technical choices currently deployed

These belong to the architecture spine; they are recorded here so the PRD stays free of them.

- **Identity transport:** browser-held application user ID (deterministic hash of normalized name and role) sent as `x-application-user-id`; Edge functions resolve it against `users.current_role`, `status`, room ownership and active sessions.
- **Data access:** `users`, `rooms`, `sessions`, `messages`, `message_feedback` have row-level policies allowing all operations to `public`. Private assessment data lives in the `private` schema; `anon` and `authenticated` have no usage on it. Assessment RPCs are `SECURITY DEFINER` and not executable by `anon` (verified 2026-10-22 on production and staging).
- **Server functions:** `ai-api` (AI suggestions, character drafts) and `assessment-api` (join, messages, learning-event judging, assessment drafts, delivery, attempts, manual progress edits, review reads, and clear history, which is to be removed per G-21).
- **Models:** tutoring and message analysis use `qwen3.8-flash` (`DEFAULT_AI_MODEL`); transfer-assessment generation uses `qwen3.5-flash`. Tutoring temperature 0.3 / 600 tokens; analysis temperature 0 / 600 tokens; assessment generation temperature 0.3 / 1200 tokens; character replies temperature 0.7 / 2000 tokens. All use JSON mode and at most one format-repair retry.
- **Limits:** `ai-api` accepts at most 30 messages and 50,000 characters; history reads page by `(created_at, id)` in pages of 1000 (tutor context) and 500 (analysis catch-up).
- **Client contract:** every request to both Edge functions must carry `x-practice-contract: cyberbullying-v2`; the database write gate enforces the same contract. A cutover for either practice type forces all clients to reload.
- **Feature flags:** `TRANSFER_ASSESSMENT_ENABLED` (operator, default true, on in both environments); `rooms.transfer_learning_enabled` (per room, default true; forced false for cyberbullying rooms).
- **Routing rule:** every routing point must check `practice_type` before `transfer_learning_enabled`; cyberbullying rooms use learner-owned progress while their transfer flag is false.
- **Result-message templates:** written by `private.write_assessment_result_message`, identical in production and staging (function hashes compared 2026-10-22).
- **Grading** is implemented both in the TypeScript resolver and in SQL; SQL is the final authority.
- **Realtime:** message inserts via Supabase Realtime plus a 2-second poll; typing via broadcast.

## C. Known gaps between this PRD and current behavior

Each open gap is a candidate backlog bug. Gaps accepted or withdrawn by the owner's decisions of 2026-10-22 keep their IDs and say so. IDs are stable.

| ID | Gap | Evidence | Related |
| --- | --- | --- | --- |
| G-1 | Custom avatar and room-image upload cannot succeed: it requires a Supabase Auth session the app never creates, storage policies require `auth.uid()`, and room uploads use a placeholder room ID. Unit tests mock the session and pass. | extract-D C13 | FR-2, §7.2 |
| G-2 | **Accepted for the pilot (OQ-1).** Any client can read and write users, rooms, sessions, messages and ratings directly; role checks for many actions run only in the browser. Revisit if the platform leaves supervised pilot use. | extract-D §2 | NFR-4 |
| G-3 | **Accepted for the pilot (OQ-1).** Room passwords are stored and checked in plain text in the browser and shown on tutor room cards. | extract-D C5; extract-C C-06 | FR-10, NFR-4 |
| G-4 | **Withdrawn (OQ-4).** No action ends a learner's seat; this is intended because rooms are single-use and kept as pilot data. | extract-D C4 | FR-12 |
| G-5 | Phishing AI suggestions must follow T08 (3 sentences / 50 words), but the active prompt also sends 2 sentences / 35 words. Align the prompt with T08. | extract-A X3 | FR-26 |
| G-6 | Tutor-set temperature and max-tokens are saved but ignored. | extract-A X5 | FR-24 |
| G-7 | Quick Adjust regenerate records the replaced suggestion as `modified`, not `ignored`, which skews tracking rates. | extract-A X7 | FR-28, FR-51 |
| G-8 | Generic AI failures show transfer-assessment wording ("The transfer request could not be completed"). | extract-A X6 | FR-25 |
| G-9 | Editing an assessment question overwrites the recorded new situation with the question text. | extract-B X13 | FR-34, FR-35 |
| G-10 | Retry result text differs between the saved message ("One attempt remaining"), the export ("1 attempt remaining") and the QA guide. | extract-B X9 | FR-39 |
| G-11 | Cyberbullying request R1 asks for template round trips; tutors cannot save templates and no cyberbullying templates are seeded. | extract-C K-13 | FR-6 |
| G-12 | Silent fallbacks: offline local-only login when the database is unreachable; direct session insert when the trusted join fails; swallowed errors on the observer room list. | extract-D NFR-6 | NFR-7 |
| G-13 | Observers see test rooms in their room list. (Observers receiving cyberbullying learning progress in exports is intended, OQ-10.) | extract-D C6 | FR-8, FR-13 |
| G-14 | Any tutor-role user gets AI, Guard and learning-progress controls in rooms they do not own; the server checks ownership only for cyberbullying character drafts. | extract-D §2 | FR-52 |
| G-15 | The legacy room-wide progress path (browser-side judging) has four failing BDD scenarios and stale category expectations. Per OQ-14 it serves only old rooms, which are not revisited; its tests can be retired with it. Manual progress edits must keep working on learner-owned learning targets (FR-53). | extract-C C-15, K-10, K-11 | FR-53, §6 |
| G-16 | The server still accepts typed assessment answers and runs clarification and help-request handling, which the PRD removes (OQ-6). Remove them so only option selections are accepted. | extract-B X5 | FR-37 |
| G-17 | `feature:ai_openai_integration` (10 scenarios) is not run by any test and describes a retired client-side provider. | extract-D §6.1 | — |
| G-18 | The "N observers" scenario passes only with a mocked count that nothing stores. | extract-D §6.7 | FR-13 |
| G-19 | Prototype feedback #7 (show the AI is working, faster first response) is still open. | extract-A C18 | — |
| G-20 | The latest recorded tutor quality-gate run (qwen3.5-flash) did not satisfy its rubrics; no run exists for qwen3.8-flash, which is deployed. | extract-A C3, X4 | NFR-10 |
| G-21 | Clearing chat history still exists for phishing room owners (button, backup download, `assessment-api` operation) but is not a supported feature. Remove it. | extract-D C12; extract-B C16 | FR-17 (withdrawn) |
| G-22 | The assessment editor offers Discard and Send. Check that Discard works as the PRD's reject: nothing is delivered, the room owner can write their own tutor reply, and the transfer assessment is offered again later. Rename it if it does. | extract-B C5, X6 | FR-35 |
| G-24 | Learner-owned learning targets and server judging are tied to in-room assessment: a new phishing room with in-room assessment off still uses room-wide learning targets and browser-side judging (`RoomContext.tsx:719`, routing on `transfer_learning_enabled`). Decouple them so every new room uses learner-owned learning targets, and in-room assessment only turns transfer assessments on or off. | extract-C X-04, C-15; code check 2026-10-22 | FR-18, FR-31 |
| G-23 | The rating gate should fire for character replies in cyberbullying rooms. The code suggests it does (they are saved as tutor replies), but no test covers it. Add one. | extract-C X-11 | FR-16 |

Stale documents found during extraction (to be consolidated in the documentation migration): `ai-assistant-module.md`, `tutor-response-contract.md` (mode shape), `RoomContext.md` (Guard and history), `simplified-authentication.md`, `supabase-service.md` (export, models), `README.md` and `docs/README.md` (capacity, RLS, roadmap, migrations path), `plan/cyberbullying-practise/README.md`, `user_feedback_improvement_summary.md` (cites three missing tests), spec-101–104 status headers.

## D. Verification notes

- 2026-10-22, production and staging, read-only: `public.messages` has no answer-key column; correct options and explanations exist only in `private.transfer_assessments`; staging has 5 second-failure results (all with the reveal template), 9 retries and 12 passes (neither reveals the answer); no other message mentions correct options. Production has no failed results yet.
- `TRANSFER_ASSESSMENT_ENABLED` is set in both projects; the owner confirmed it is on.
