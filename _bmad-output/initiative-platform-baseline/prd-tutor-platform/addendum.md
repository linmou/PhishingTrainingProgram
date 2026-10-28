# Addendum: Online Safety Tutor Platform PRD

Intent: keep the material the PRD needs but should not carry in its main text — where each requirement came from, the technical choices currently deployed, and the known differences between the PRD and current behavior.

Updated: 2026-10-27 (§B realtime and cyberbullying templates follow the `no_sign_up` merge `617fe7c`). Earlier: 2026-10-24 (test-only gaps retired from §C; P6 open questions added as §F). Earlier: 2026-10-22 (aligned with the owner's review and open-question decisions). Source baseline commit: `b671519`; extracts were taken at `565ac76`. Evidence: `extract-A-pedagogy-tutoring.md`, `extract-B-transfer-assessment.md`, `extract-C-cyberbullying-rooms-targets.md`, `extract-D-platform-tested-behavior.md` in this folder. Archived sources are under `docs/archive/`.

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
- **Realtime:** messages, ratings and room changes arrive over one Supabase Realtime room channel (the `messages`, `message_feedback` and `rooms` tables are in the `supabase_realtime` publication); typing via broadcast. There is no fixed poll: on join and after a channel error or transport loss the client re-reads history in pages of at most 100 rows ordered by message id and recreates the channel, and a healthy room is audited every 60 seconds. Ratings are read in batches of 100 message ids.
- **Cyberbullying scenarios:** four global room templates (`copilot-1`, `copilot-2`, `screenshot-1`, `screenshot-2`) seeded by migration `20261023000000_seed_cyberbullying_templates.sql`; the first two are pinned to SocialMediaCopilot commit `89e7fda`.
- **Character draft prompt:** the role-play prompt currently asks for at most three sentences in simple language (see G-25).
- **Transfer-assessment evaluation plan:** `specs/104-transfer-evaluation/` (the suite is `evals/transfer-assessment/`).

## C. Known gaps between this PRD and current behavior

Each open gap is a candidate backlog bug where current behavior differs from the PRD. Gaps accepted or withdrawn by the owner's decisions of 2026-10-22 keep their IDs and say so. IDs are stable and never reused. Missing or weak tests for behavior that already matches the PRD are not listed here; IDs G-50 to G-56, G-58 to G-63, G-65, G-67, G-70, G-71, G-73 to G-75 and G-77 were such test gaps and are retired from this list.

| ID | Gap | Evidence | Related |
| --- | --- | --- | --- |
| G-1 | Custom avatar and room-image upload cannot succeed: it requires a Supabase Auth session the app never creates, storage policies require `auth.uid()`, and room uploads use a placeholder room ID. Unit tests mock the session and pass. | extract-D C13 | FR-2, PRD §10.2 |
| G-2 | **Accepted for the pilot (OQ-1).** Any client can read and write users, rooms, sessions, messages and ratings directly; role checks for many actions run only in the browser. Revisit if the platform leaves supervised pilot use. The server-side guarantees in FR-12, FR-39, FR-49 and FR-52 do not hold against a direct database write. | extract-D §2 | NFR-4, FR-12, FR-39, FR-49, FR-52 |
| G-3 | **Accepted for the pilot (OQ-1).** Room passwords are stored and checked in plain text in the browser and shown on tutor room cards. | extract-D C5; extract-C C-06 | FR-10, NFR-4 |
| G-4 | **Withdrawn (OQ-4).** No action ends a learner's seat; this is intended because rooms are single-use and kept as pilot data. | extract-D C4 | FR-12 |
| G-5 | Phishing AI suggestions must follow T08 (3 sentences / 50 words), but the active prompt also states a limit of 2 sentences / 35 words. Align the prompt with T08. | extract-A X3 | FR-26 |
| G-6 | Tutor-set temperature and max-tokens are saved but ignored. | extract-A X5 | FR-24 |
| G-7 | Regenerate (Quick Adjust in phishing, and in cyberbullying character drafts) records the replaced suggestion as `modified`, not `ignored`, which skews tracking rates. | extract-A X7; reconcile-CD CD-03 | FR-28, FR-48, FR-51 |
| G-8 | Generic AI failures show transfer-assessment wording ("The transfer request could not be completed"). | extract-A X6 | FR-25 |
| G-9 | Editing an assessment question overwrites the recorded new situation with the question text. | extract-B X13 | FR-34, FR-35 |
| G-10 | Retry result text differs between the saved message ("One attempt remaining"), the export ("1 attempt remaining") and the QA guide. | extract-B X9 | FR-39 |
| G-11 | Cyberbullying request R1 asks for template round trips; tutors cannot save templates and no cyberbullying templates are seeded. | extract-C K-13 | FR-6 |
| G-12 | Silent fallbacks: offline local-only login when the database is unreachable; direct session insert when the trusted join fails; swallowed errors on the observer room list. | extract-D NFR-6 | NFR-7 |
| G-13 | Observers see test rooms in their room list. (Observers receiving cyberbullying learning progress in exports is intended, OQ-10.) | extract-D C6 | FR-8, FR-13 |
| G-14 | Any tutor-role user gets AI, Guard and learning-progress controls in rooms they do not own; the server checks ownership only for cyberbullying character drafts. The server also does not refuse a non-owner who sends tutor replies or deletes a room. It must refuse all of them. | extract-D §2; reconcile-CD CD-04 | FR-52 |
| G-15 | The legacy room-wide progress path (browser-side judging) has four failing BDD scenarios and stale category expectations. Per OQ-14 it serves only old rooms, which are not revisited; its tests can be retired with it. Manual progress edits must keep working on learner-owned learning targets (FR-53). | extract-C C-15, K-10, K-11 | FR-53, PRD §9 |
| G-16 | The server still accepts typed assessment answers and runs clarification and help-request handling, which the PRD removes (OQ-6). Remove them so only option selections are accepted. | extract-B X5 | FR-37 |
| G-17 | `feature:ai_openai_integration` (10 scenarios) is not run by any test and describes a retired client-side provider. | extract-D §6.1 | — |
| G-18 | The "N observers" scenario passes only with a mocked count that nothing stores. | extract-D §6.7 | FR-13 |
| G-19 | Prototype feedback #7 (show the AI is working, faster first response) is still open. | extract-A C18 | — |
| G-20 | The latest recorded tutor quality-gate run (qwen3.5-flash) did not satisfy its rubrics; no run exists for qwen3.8-flash, which is deployed. | extract-A C3, X4 | NFR-10 |
| G-21 | Clearing chat history still exists for phishing room owners (button, backup download, `assessment-api` operation) but is not a supported feature. Remove it. | extract-D C12; extract-B C16 | FR-17 (withdrawn) |
| G-22 | The assessment editor offers Discard and Send. Check that Discard works as the PRD's reject: nothing is delivered, and the room owner can write their own tutor reply. Rename it if it does. | extract-B C5, X6 | FR-35 |
| G-23 | The rating gate should fire for character replies in cyberbullying rooms. The code suggests it does (they are saved as tutor replies), but no test covers it. Add one. | extract-C X-11 | FR-16 |
| G-24 | Learner-owned learning targets and server judging are tied to in-room assessment: a new phishing room with in-room assessment off still uses room-wide learning targets and browser-side judging (`RoomContext.tsx:719`, routing on `transfer_learning_enabled`). Decouple them so every new room uses learner-owned learning targets, and in-room assessment only turns transfer assessments on or off. | extract-C X-04, C-15; code check 2026-10-22 | FR-18, FR-31 |
| G-25 | Character drafts have no AI behavior constitution, specification or evaluation; their quality rests only on the role-play prompt and the pinned upstream strategy. | PRD §7 | FR-47, NFR-9 |
| G-26 | Learning-target generation has no AI behavior specification or evaluation. | PRD §7 | FR-18, NFR-9 |
| G-27 | Learning-event judging in cyberbullying rooms runs on the phishing judging prompt with an added paragraph, but the tutoring constitution covers phishing only; no constitution or evaluation covers cyberbullying judging. | PRD §7; extract-C X-10 | FR-20, NFR-9 |
| G-28 | Rejecting an assessment draft shows no warning. The target's progress may be wrong at that point, because the learner's Covered status was never confirmed by a check, and the next AI suggestion may bring back the same assessment. After a reject, show a message naming the learning target, saying its progress may be wrong, and asking the room owner to check and correct it by hand. Check the current behavior in the code first. | Owner, 2026-10-22 | FR-35, FR-53 |
| G-29 | Room deletion (FR-9) is not checked in the code. Check that only the room owner can delete a room, that the server refuses anyone else, and that deletion removes everything the room holds, including private assessment records and the students' data. | Owner, 2026-10-22; reconcile-CD CD-11 (not code-checked) | FR-9, FR-52 |
| G-30 | When judging a cyberbullying learner message fails, the failure is logged but not thrown, so the tutor is not told. | reconcile-CD CD-02 (not code-checked) | FR-46, NFR-7 |
| G-31 | In a cyberbullying room, context over 50,000 characters, or a draft with truncated or invalid output, returns an error. The owner cannot send a reply without a draft, so a long room becomes a dead end; FR-47 states none of these failures. | reconcile-CD CD-01 (not code-checked) | FR-47, FR-48 |
| G-32 | Export content depends on the user's global role, so a non-owner tutor can get owner-only data; TXT exports never include learning progress. | reconcile-CD CD-05 (not code-checked) | FR-50, FR-51, FR-52 |
| G-33 | Joining again under a changed name or role creates a new identity, so the user loses room ownership and a learner loses the seat. | reconcile-CD CD-06 (not code-checked) | FR-1, FR-12 |
| G-34 | A reload drops a student's observer mode, and phishing read-only is enforced only in the interface. | reconcile-CD CD-07 (not code-checked) | FR-13 |
| G-35 | FR-22 says learning events gathered during Guard are applied afterwards. The extracts support deferral only for assessment grades. Check the code and correct whichever is wrong. | reconcile-AB R-9 (not code-checked) | FR-22 |
| G-36 | The Guard flag has two writers: the browser updates `rooms.guard_mode` directly, and the reviewed-send RPC sets it on every send. A reply sent from a stale tab can switch Guard off without the owner choosing it. | architecture sweeps 1 and 2; code check 2026-10-22 | FR-30, FR-22 |
| G-37 | The trusted judging path is chosen in the browser from the in-room assessment switch, and a learner message can be inserted into `messages` directly, skipping server judging. (Related to G-24.) | architecture adversarial review H2/H4 (not code-checked) | FR-20, FR-31, NFR-2 |
| G-38 | A user's role inside a room is read from `users.current_role`, so a room owner who changes their profile role to student can become the learner in their own room or answer an assessment they sent. | architecture adversarial review H3 (not code-checked) | FR-2, FR-12, FR-52 |
| G-39 | Assessment state is stored twice with different value sets: `messages.assessment_lifecycle` (writable by any client) and `private.transfer_assessments.lifecycle`. | architecture sweep 1; adversarial review H5 | FR-42 |
| G-40 | A contract version bump has no rollout order; flipping the SQL gate locks out every old client before the new client is live. | architecture sweep 3; adversarial review H10 | NFR-11 |
| G-41 | **Withdrawn (owner, 2026-10-22).** While Guard is on or the operator switch is off, an open assessment waits and the learner's composer stays disabled. This is intended: the owner or operator can reverse it, and a sent assessment is never withdrawn, because that would confuse the learner. | architecture reconcile with the PRD | FR-22, FR-37 |
| G-42 | Older RPCs are still callable by anonymous clients: `update_checklist_progress` and `soft_delete_checklist_item` change progress, and a legacy `send_reviewed_tutor_response` sends tutor text, all without an owner check. | architecture rubric review (bodies not read) | FR-52, FR-53, NFR-1 |
| G-43 | Raw AI output is stored in the public `ai_suggestion_feedback` table, which any client with the anon key can read, against the rule that raw AI output is never visible to participants. | architecture rubric review | FR-51, NFR-3 |
| G-44 | The generic `ai-api` chat has no identity or ownership check and JWT verification is off, so anyone holding the anon key can spend the AI provider key. | architecture sweep 3 | FR-25, NFR-4 |
| G-45 | `assessment-api` hardcodes the model `qwen3.5-flash` while `ai-api` imports `qwen3.8-flash` from shared config. Owner decision 2026-10-23: assessment generation must use the room's chosen model (AD-10). | architecture sweep 3 | NFR-10 |
| G-46 | The client creates a new request id on every call, so a retry or a second tab can create a second answer message, and each is graded as its own attempt. | architecture sweep 1 | FR-38, NFR-5 |
| G-47 | Manual progress edits are refused in cyberbullying rooms by the database function, but FR-44 and FR-53 say they stay available. The owner decided on 2026-10-22 that the PRD is right: change the database function and the client so manual edits work in cyberbullying rooms. | architecture reconcile with the PRD | FR-44, FR-53 |
| G-49 | Tutor review of assessment drafts (edit, reject, send) is not recorded: discard is client-local and writes nothing. FR-51 now requires it. | owner decision 2026-10-22; architecture sweep 1 | FR-51, FR-35 |
| G-57 | The server rejects an outdated client with a reload code, but no client code handles it and nothing calls a reload, so the browser is not told to reload. Code search, 2026-10-23. | epic guard maps; code search | NFR-11 |
| G-64 | The typing indicator's 3-second clear has no test, and the receiver drops stale indicators after 5 seconds, not 3. | conversation epic guard map | FR-15 |
| G-66 | A test asserts that a failed target extraction silently falls back to the template's targets, against the rule that a failed generation invents none; no test shows the "unavailable" message, and no test covers a long custom target. | learning-progress epic guard map | FR-18 |
| G-68 | No test for the progress panel's desktop controls or narrow-screen width or the learner's rendered panel; a manual edit is attributed to the role "tutor", not the owner, and no test covers the learner seeing it or a non-owner edit. | learning-progress epic guard map | FR-23, FR-53 |
| G-69 | Tests and the sending path apply the tutor's final Guard state to the room when a reply is sent, against the rule that sending never changes Guard; a non-owner Guard change is also untested. (Related to G-36.) | supervision epic guard map | FR-30 |
| G-72 | Nothing enforces that a prompt or model change is released only after its evaluation suite runs: the pull-request workflow never runs the suite. Per-practice-type re-evaluation and human-only constitution changes are untested. | AI epic guard map | FR-26, NFR-9, NFR-10 |
| G-76 | The room owner's JSON export has no summary of suggestion actions (a test asserts it is undefined), and cyberbullying exports carry one learner's progress, not every participant's. | exports epic guard map | FR-50 |
| G-48 | Dependency-direction breaks in the client: a context imports a component, a hook imports a context, types and utils import services. | architecture sweep 2 | — |

Stale documents found during extraction (to be consolidated in the documentation migration): `ai-assistant-module.md`, `tutor-response-contract.md` (mode shape), `RoomContext.md` (Guard and history), `simplified-authentication.md`, `supabase-service.md` (export, models), `README.md` and `docs/README.md` (capacity, RLS, roadmap, migrations path), `plan/cyberbullying-practise/README.md`, `user_feedback_improvement_summary.md` (cites three missing tests), spec-101–104 status headers.

## D. Verification notes

- 2026-10-22, production and staging, read-only: `public.messages` has no answer-key column; correct options and explanations exist only in `private.transfer_assessments`; staging has 5 second-failure results (all with the reveal template), 9 retries and 12 passes (neither reveals the answer); no other message mentions correct options. Production has no failed results yet.
- `TRANSFER_ASSESSMENT_ENABLED` is set in both projects; the owner confirmed it is on.

## E. Resolved open questions

All resolved on 2026-10-22. Each decision is built into the PRD requirement named in brackets.

- OQ-1: identity accepted for the pilot (NFR-4).
- OQ-2: the whole room sees the second-wrong-attempt result (FR-39).
- OQ-3: Covered means complete where transfer assessments are not available (glossary "Complete", FR-45).
- OQ-4: no learner-seat release (FR-12).
- OQ-5: reply length depends on the practice type and is governed by the AI behavior specifications (PRD §7).
- OQ-6: only option selections are accepted as answers (FR-37).
- OQ-7: the room owner can reject an assessment draft and write their own tutor reply (FR-35).
- OQ-8: tutor controls for the room owner only (FR-52).
- OQ-9: the rating gate covers all tutor replies (FR-16).
- OQ-10: observers get cyberbullying learning progress but not test rooms (FR-13, FR-50).
- OQ-11: the tutoring constitution covers phishing only (NFR-9).
- OQ-12: no consent process for the pilot (PRD §10.2).
- OQ-13: the template catalog was cleaned in commit `c13af72` (FR-18).
- OQ-14: all new learning targets are learner-owned and judged on the server; no new room-wide learning targets; old rooms are left as they are; manual edits stay (FR-18, FR-31, FR-53, PRD §9).
- OQ-15: no accessibility target (PRD §10.2).

## F. Pilot limitations under P6

Opened 2026-10-24 from a review that sorted each failing test by the product constitution's P6 (quick implementation, without immediate harm); decided by the owner on 2026-10-24. Each question asked whether a PRD requirement may be met more loosely during the supervised pilot. "Deferred" means the limitation is accepted for the pilot and its tests wait for the formal product; "Required" means the requirement and its tests stay as written. Rules whose failure would cause immediate harm or break C1–C6 (owner-only publication, server grading and progress, private assessment material, retention and owner-only deletion, credentials) were not asked about and stay required.

| ID | Question | Decision | Related |
| --- | --- | --- | --- |
| OQ-16 | May tutor controls whose effect can be undone (AI settings and role, Quick Adjust, the AI-off switch, in-room assessment on or off, requesting a draft) be limited to the room owner on screen only during the pilot, instead of the server refusing everyone else? Publication, progress edits and room deletion keep the server check. | Deferred | FR-24, FR-25, FR-29, FR-31, FR-45, FR-47, FR-52 |
| OQ-17 | May sending a reply apply the Guard state the room owner chose in the composer, instead of Guard changing only through its own confirmed operation? | Deferred | FR-30 |
| OQ-18 | May setup checks (room form, practice type, template choice, test-room hiding, the five cyberbullying targets, failed target generation) rely on the room owner inspecting the room before teaching? | Deferred | FR-4, FR-5, FR-6, FR-7, FR-8, FR-18, FR-44 |
| OQ-19 | May live updates, the typing indicator, room lists, the progress panel layout, waiting explanations, result display and responsive layout be best effort during the pilot, with the supervising adult working around gaps? | Deferred | FR-11, FR-14, FR-15, FR-23, FR-37, FR-39, NFR-7, NFR-8, NFR-12 |
| OQ-20 | May research records be incomplete during the pilot: ratings and the rating gate, review actions (accepted, modified, rejected, ignored), response timing, the owner's suggestion summary and character labels in exports? | Required: the records serve P8 and cannot be recollected after the pilot; fix their guards. | FR-16, FR-28, FR-48, FR-49, FR-50, FR-51 |
| OQ-21 | May AI output checks and evaluation gating be manual during the pilot (the format repair retry, draft shape and word limits, running the evaluation suite before a prompt or model release), relying on the owner's review of every draft? | Deferred | FR-26, FR-27, FR-33, FR-34, NFR-9, NFR-10 |
| OQ-22 | May the tutor's feedback before the next assessment, re-offering a rejected assessment and keeping an open assessment answerable after in-room assessment is turned off be handled by the room owner by hand? | Deferred | FR-31, FR-35, FR-41 |

Identity and room passwords (FR-1, FR-2, FR-3, FR-10, NFR-4) are not asked again: OQ-1 already accepts them.
