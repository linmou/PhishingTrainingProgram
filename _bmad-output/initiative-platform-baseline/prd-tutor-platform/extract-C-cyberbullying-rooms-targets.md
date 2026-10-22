# Extract C — Cyberbullying practice, rooms/scenarios/templates, learning targets & progress, AI conversation history

Intent: brownfield PRD requirement extract for one scope slice. Built read-only on 2026-10-22 from worktree `rebuild_docs_by_BMAD` (HEAD 565ac76). Paths are relative to the repo root unless they start with `src/`, `supabase/` or `features/`; those are under `tutor-system/`.

Citation keys:
- **cb-request Rn**: `plan/cyberbullying-practise/request.md`.
- **cb-plan**: `plan/cyberbullying-practise/final_plan.md`. R13 is the browser-draft amendment, released as `9c7364c`.
- **cb-doc**: `tutor-system/docs/cyberbullying-practise.md`.
- **spec-five**, **spec-unified**, **spec-recheck**, **spec-tplread**, **spec-panel**, **spec-history**, **spec-uifix**: the archived specs in `docs/archive/_bmad-output/implementation-artifacts/`.
- **contract**: `tutor-system/docs/ai-behaviors/transfer-status-response-contract.md`.
- **mig-cb** and **mig-draft**: `supabase/archived_migrations/20261021000000_cyberbullying_practise.sql` and `…20261021010000_cyberbullying_browser_draft.sql`. These are archived migrations. The live schema was **not** inspected with MCP in this read-only pass.

---

## 1. Capabilities

### A. Rooms, scenarios and templates

**C-01 Create a room (common fields)**
- Requirement: A tutor can create a room with a title, description, preset/custom/default image, OP setting, optional password and pre-populated dialogue.
- Consequences:
  - An empty title is rejected with "Room title is required" (`src/pages/TutorView.tsx:192`).
  - Custom OP requires a name (`:201`). Password mode requires a password (`:206`).
  - If no image is chosen, the default is `/images/room-presets/privacy_3.png` (`:151-158`).
  - After creation the tutor is navigated to `/room/{id}`.
- Legacy IDs: room_management.feature (all scenarios); room_op_configuration.feature.
- Evidence: `features/room_management.feature`, `src/__tests__/room_management.bdd.test.tsx`, `room_management_steps.test.tsx`, `features/room_op_configuration.feature`, `src/__tests__/room_op_configuration.bdd.test.tsx`, `room_op_configuration.test.tsx`.
- Status: current. The feature text uses generic subjects ("Introduction to Python").

**C-02 Choose an immutable practice type**
- Requirement: A tutor can choose `practice_type` = phishing | cyberbullying when creating a room. The type cannot change afterwards.
- Consequences:
  - The DB rejects any update of `practice_type` with `PRACTICE_TYPE_IMMUTABLE` (mig-cb:66-70).
  - A cyberbullying room or template without a complete `scenario_config` is rejected with `SCENARIO_REQUIRED`. Required fields are id, source_commit, post text/image/author id+name, and an `initial_comments` array (mig-cb:71-81).
  - Existing rows were backfilled to `phishing` by column default (mig-cb:19,21).
  - Frontend and server select behaviour from the stored value only.
- Legacy IDs: cb-request R1, R9.
- Evidence: `src/__tests__/room_template_management.test.tsx` ("Cyberbullying scenarios"), `supabase/tests/cyberbullying_practise.sql`.
- Status: current.

**C-03 Create a room from a pinned Cyberbullying situation**
- Requirement: A tutor can pick one of the pinned Copilot situations, edit its post and opening comments, and create a room. The room keeps the source comment and persona identities.
- Consequences:
  - The catalog loads from `public/cyberbullying/scenarios.json`, which holds 2 situations (`copilot-1` and `copilot-2`) with 2 comments each. The source commit is `89e7fda…` (`src/services/cyberbullyingScenarios.ts:5,35-39`).
  - A malformed catalog throws, and room creation stays blocked (`:7-23`; test "keeps creation blocked when the scenario catalog fails to load").
  - Creating a cyberbullying room without a selected situation is rejected with "Choose a Cyberbullying situation." (`TutorView.tsx:196`).
  - The title defaults to "Cyberbullying practise — {scenario.id}". The OP becomes the post author, with the scenario avatar (`:118-127,259`).
  - Edited comments keep `source_comment_id`/`persona_id` when present. Otherwise they get new UUIDs (`:239-249`).
  - The AI assistant is force-enabled with `DEFAULT_AI_MODEL` (`:251`).
  - The 8 images were restored from parent commit `1ee51e5…` and hash-recorded in `asset-manifest.json` (cb-doc:14).
- Legacy IDs: cb-request R1, R5; cb-plan "Product and data contracts".
- Evidence: `room_template_management.test.tsx`, `scripts/browser-e2e.test.js`.
- Status: current.

**C-04 Prefill from shared global templates**
- Requirement: A tutor can prefill the creation form from a shared global template whose practice type matches the selected one.
- Consequences:
  - Only templates owned by the zero UUID are loaded. The `tutorId` argument is ignored (`src/services/supabase.ts:893-901`).
  - A narrow SELECT policy makes global templates readable for anon and authenticated users. Writes stay denied (spec-tplread matrix).
  - Picking a template sets practice type, scenario, image, OP, password and dialogue. Stale OP and password state is cleared (`TutorView.tsx:160-187`).
  - The template list is filtered by `practice_type ?? 'phishing'` (`:481`).
  - Saving a room as a template is disabled ("templates are now global") (`:320,692-711`).
  - For phishing only, a template's `ai_config_template` initializes the AI config, regenerated from `prompt_config` (`:267-318`).
- Legacy IDs: spec-tplread; cb-request R1 ("template round trips").
- Evidence: `room_template_management.test.tsx` (Template Selection/Usage/Management), `supabase/tests/global_room_template_read.sql`.
- Status: current. The R1 "round trip" claim is partially unsupported; see Conflicts K-13.

**C-05 Keep behavior/demo rooms away from teaching flows**
- Requirement: A tutor can create behavior-demo or test rooms only from `/tutor/test-rooms`. These rooms are hidden from the main dashboard and from student discovery.
- Consequences:
  - Demo template names are filtered out of the create form (`TutorView.tsx:480`).
  - A demo template used from the main form gets a behavior-test marker (`:226-229`).
  - Students do not see behavior-test or DemoTutor rooms (room_discovery.feature:109-123).
- Evidence: `src/utils/__tests__/behaviorTestRooms.test.ts`, `src/pages/__tests__/StudentView.roomVisibility.test.tsx`, `room_discovery.bdd.test.tsx`.
- Status: current.

**C-06 Password protection and owner bypass**
- Requirement: A non-owner student or observer must enter the correct password to join a protected room. The owner enters directly.
- Consequences:
  - A wrong password shows "Incorrect password. Please try again.", keeps the prompt open and clears the field.
  - Cancel redirects home.
- Legacy IDs: room_management.feature:89-150.
- Evidence: room_management BDD tests.
- Status: current. Note that the password is shown in plaintext on the tutor's room card (`TutorView.tsx:817-820`).

**C-07 OP configuration**
- Requirement: A tutor can show their own profile or a custom name as the Original Poster.
- Consequences: Custom OP has no avatar or account. Older rooms backfill OP to the tutor.
- Legacy IDs: room_op_configuration.feature.
- Evidence: room_op_configuration BDD tests.
- Status: current.

**C-08 Discover and join a room; one learner per room**
- Requirement: A student can join an available room as its single learner. Later joiners, and all observers, get read-only observer access.
- Consequences:
  - The learner is the earliest active session, ordered by `started_at, id`. Every other caller receives `room_role:'observer'` (mig-cb:1080-1092; cb-doc:26).
  - The observer UI hides the input.
  - In cyberbullying rooms the DB rejects non-learner inserts with `OBSERVER_READ_ONLY` (mig-cb:1500-1504).
  - The room list updates in real time.
- Legacy IDs: room_discovery.feature; cb-request R9 / E12.
- Evidence: `room_discovery.bdd.test.tsx`, `room_discovery.test.tsx`.
- Status: current.

**C-09 Tutor room persistence and deletion**
- Requirement: A tutor can see and manage only their own rooms across sessions, and can delete a room after confirmation.
- Evidence: `features/tutor_room_persistence.feature`, `src/__tests__/tutor_room_persistence.test.tsx`.
- Status: current.

### B. Learning targets and progress

**C-10 Maintained teaching-scenario targets: one inventory of five**
- Requirement: The system supplies each maintained phishing/privacy teaching template with exactly five unique, non-empty learning targets in one `detection_areas` list. `verification_steps` is empty.
- Consequences:
  - Six maintained scenarios have five targets each (`src/services/detectionTemplates.ts:6-95`).
  - Account-alert demo and comparison variants inherit the account inventory.
  - Custom rooms keep all authored targets, with no truncation.
  - Template migrations fail atomically when the stored prompt has drifted.
  - Existing room inventories are not rewritten.
- Legacy IDs: spec-unified (supersedes spec-five).
- Evidence: `src/services/__tests__/detectionTemplates.test.ts`, `demoRoomTemplates.test.ts`, `checklistGenerationContext.test.ts`, `supabase/tests/five_learning_targets.fixture.sql`.
- Status:
  - current (spec-unified, done).
  - spec-five is **superseded** by spec-unified: its 4+1 / 3+2 recognition/action grouping across two lists is gone.
  - Note: two non-maintained catalog entries break the five rule: "General Scam Indicators" (18 items) and "Personal Details Protection" (11 items) (`detectionTemplates.ts:39-62,96-111`).

**C-11 Smart Generate / LLM target extraction**
- Requirement: A tutor can extract targets from a room prompt into the same single-list contract `{"detection_areas":[…]}`.
- Consequences:
  - An empty prompt makes no provider call and returns an empty result.
  - Malformed, invalid or failed provider output gives an empty result, and the panel reports that targets are unavailable. No targets are invented.
  - Exact duplicates are kept once, after trimming whitespace.
- Legacy IDs: spec-unified contracts table.
- Evidence: `src/services/__tests__/promptDetectionExtractor.test.ts`, `src/hooks/__tests__/useChecklist.smartGeneration.test.tsx`, `src/components/__tests__/ChecklistGenerationModal.test.tsx`.
- Status: current.
- The `@non_feasible` scenarios in ai_checklist_integration.feature:11-66 (understanding/behavior split) are **stale**, superseded by the single list.

**C-12 Tutor initializes learner-owned (transfer_v1) targets and early messages are replayed**
- Requirement: A tutor can save targets for the room's identified learner. The system then analyzes that learner's earlier ordinary messages oldest first, before showing refreshed progress.
- Consequences:
  - Initialization goes through the trusted API only (`checklistService.ts:102-132`). Transfer items cannot be edited in place (`:959`).
  - The replay inventory includes only that learner's student-role messages with `assessment_id IS NULL`. It is ordered by `created_at, id` and paged 500 at a time (`:143-162`).
  - Inventory, analysis or reread failures keep the local draft and show "Retry sync". Server dedup makes retry safe.
  - If initialization fails, no analysis runs.
  - Targets saved before a learner joins are promoted later and run the same replay.
  - A tutor can open target setup before the learner posts. The sole active learner session is resolved.
- Legacy IDs: spec-recheck (I/O matrix, AC1-4).
- Evidence: `src/hooks/__tests__/useChecklist.earlyMessages.integration.test.tsx`, `src/components/__tests__/ChecklistPanel.transfer.test.tsx`.
- Status: current.

**C-13 Ordered-prefix evidence analysis on every send and tutor focus**
- Requirement: The system analyzes a learner message only after all of that learner's earlier pending messages in the room.
- Consequences:
  - An unknown focus ID fails with "Learning evidence focus message was not found" (`checklistService.ts:164-167`).
  - A sessionStorage cache keyed `confirmed-learning-evidence:{room}:{learner}` holds only IDs the server confirmed with `already_processed:true`. Deferred IDs stay retryable.
  - If the cache is corrupt, the browser falls back to server analysis (`:168-197`).
  - If targets appear while a learner's insert is in flight, the send path rereads the checklist (`RoomContext.tsx:910-915`).
  - Warm history costs about 1–2 requests per new message, not one per historical message (spec-recheck Design Notes).
- Legacy IDs: spec-recheck change log 2026-10-14 (×3).
- Evidence: `useChecklist.earlyMessages.integration.test.tsx` (14 cases including concurrency and 1,001-message warm history).
- Status: current.

**C-14 Learner-message analyzer: evidence events and status transitions**
- Requirement: The system judges each learning target independently against the current learner contribution and applies at most one eligible event per target.
- Consequences:
  - There is one model call per target, with up to 2 attempts. The second attempt is a format repair (`supabase/functions/assessment-api/index.ts:349-452`).
  - An event must use the current message ID and a verbatim quote from it. Kind and evidence_type must come from the enums. The item must belong to the checklist. A malformed event is rejected; nothing is inferred.
  - An ineligible transition is recorded under `rejected_events` with reason `INELIGIBLE_TRANSITION` (`:423-428`).
  - Transitions (contract:48-56):
    - pending → partial via `initial_signal`.
    - pending or partial → covered via `demonstrated_understanding`.
    - needs_review → partial via `post_repair_signal`.
    - any state except covered → covered via `spontaneous_transfer`.
    - partial or covered → needs_review via `contradiction`.
  - Assessment rules: covered reached from partial makes an assessment due. Pending → covered completes the item without assessment (contract:99-117).
  - Item-type rules: an `understanding` item needs `explanation` evidence, and a `detection_area` item rejects action-only evidence (contract:44).
  - Dialogue is supplied only up to the focus message. Earlier dialogue cannot advance status (contract:14-16).
  - If any target's call fails, the whole analysis fails and stays retryable (`index.ts:453-454`; cb-doc:26 "All five target calls settle before progress is applied").
- Legacy IDs: contract T09.1; cb-request R4, E4, E5.
- Evidence: `src/services/__tests__/learningProgressTransitions.test.ts`, `supabase/functions/assessment-api/index.test.ts`, `supabase/tests/transfer_status_events.sql`, `transfer_status_dialogue_history.sql`, `final_assessment_after_understanding.sql`.
- Status: current.

**C-15 Legacy checklist path (legacy_v1)**
- Requirement: When a room has no owner-scoped transfer checklist, a learner's message is analyzed by the browser-side `CoverageDetectionService`. A tutor can manually set an item's status, add a note, add custom items and change priority.
- Consequences:
  - This path is reached only when the transfer checklist is absent and the room is not cyberbullying (`RoomContext.tsx:706-720,916-926`).
  - A missing checklist logs a message and returns empty updates (`checklistService.ts:521-524,565-571`).
  - The history row hard-codes `previous_status:'pending'` as a TODO (`:640-642`).
  - A manual override adds `tutor_manual` evidence (`:734-745`).
- Legacy IDs: checklist_management.feature; ai_checklist_integration.feature (feasible scenarios); cb-request E3.
- Evidence: `src/__tests__/checklist_management.bdd.test.tsx`, `checklist_management.test.ts`, `ai_checklist_integration.bdd.test.tsx`.
- Status: current but legacy.
  - ai_checklist_integration's BDD suite had **4 baseline failures** (spec-uifix:69). Its evidence is not green.
  - Its category prefixes and 6-item template text are stale (see K-10 and K-11).

**C-16 Guard freezes progress**
- Requirement: While the room's `guard_mode` is true, learner progress cannot advance. Deferred evidence is replayed when Guard ends.
- Consequences:
  - Client-side legacy writes throw "Learning progression is locked while Guard Mode is active" (`checklistService.ts:21-34`).
  - The DB trigger `transfer_replay_guard AFTER UPDATE OF guard_mode` replays deferred events (mig-cb:987).
  - The contract says "Guard mode defers progression in the trusted database" (contract:56).
- Legacy IDs: cb-request R2, R4; contract.
- Evidence: `supabase/tests/cyberbullying_practise.sql`, `transfer_assessment_*` SQL tests.
- Status: current.

**C-17 Learning Progress panel**
- Requirement: A tutor and the owning learner can open a Learning Progress panel showing per-target status and evidence.
- Consequences:
  - The collapsed trigger is fixed at top/right 20px (10px at ≤768px), z-index 999.
  - The open panel is 400px × 100vh on the right. It is full width at ≤768px.
  - The desktop composer has a 400px clearance so the AI control stays clickable.
  - The Guard header wraps.
  - A short viewport can scroll to the manual-setup submit button.
  - A known collapsed-button overlap exists at 1024/769/768/320px.
- Legacy IDs: spec-panel; spec-uifix ("Expanded progress", "Guard progress").
- Evidence: `src/components/__tests__/ChecklistPanel.test.tsx`, `ChecklistPanel.transfer.test.tsx`, Chromium evidence under `output/playwright/original-placement/`.
- Status: current.

**C-18 Phishing AI prompt includes progress context**
- Requirement: The system includes the learner's current target progress in phishing tutor prompts without changing stored priorities.
- Consequences: Covered, partial and pending items are all present. Pending items are emphasized (ai_checklist_integration.feature:68-78,146-152; `aiService.ts:905-909`).
- Evidence: ai_checklist_integration BDD (feasible scenarios).
- Status: current (phishing only).

### C. Cyberbullying practice

**C-19 Five shared Cyberbullying targets, auto-initialized**
- Requirement: The system gives a cyberbullying room's learner exactly five shared targets, version `cyberbullying_v1`, initialized once when the learner joins.
- Consequences:
  - The keys are `recognize_cyberbullying_impact`, `show_empathy_support`, `stand_up_constructively`, `avoid_reinforcing_bullying` and `choose_safe_next_step` (`detectionTemplates.ts:118-145`; mig-cb:55-64).
  - Initialization is idempotent, unique per learner/room/target/version, and safe under concurrent joins (cb-plan step 3).
  - Targets cannot be deleted, edited or re-scoped. The checklist must be `transfer_v1` with a non-null student_id; violations raise `SHARED_TARGETS_REQUIRED` or `LEARNER_SCOPE_IMMUTABLE` (mig-cb:1449-1486).
  - There is no scenario-specific target variation (cb-request closed scope).
  - Only the learner, never observers, initializes or earns evidence.
- Legacy IDs: cb-request R4; cb-plan contracts.
- Evidence: `src/services/__tests__/cyberbullyingProgress.test.ts`, `supabase/tests/cyberbullying_practise.sql`.
- Status: current.

**C-20 Save the learner comment, then analyze it**
- Requirement: A learner in a cyberbullying room can post a comment. It is saved first and then analyzed against all five targets, with the saved, attributed history as context.
- Consequences:
  - Cyberbullying learners always use the trusted `post_message` path, even though `transfer_learning_enabled` is false (`RoomContext.tsx:719-728`).
  - If analysis fails, the comment stays saved. The failure is logged, not thrown (`:738-744`). Test: "stores a learner comment before analysis and leaves it available when analysis fails".
  - The cyberbullying analyzer prompt adds that "character dialogue and initial comments provide context; evidence belongs to the current learner message", and drops the phishing per-target literalness instruction (`assessment-api/index.ts:357-372`).
  - Each provider attempt is audited through `record_transfer_provider_attempt_v1`. This is for cyberbullying only (`:438-448`).
- Legacy IDs: cb-request R4, R6; cb-doc operation table.
- Evidence: `src/contexts/__tests__/RoomContext.cyberbullying.test.tsx`.
- Status: current.

**C-21 Request a character suggestion**
- Requirement: Only the room's tutor can request one AI character reply, using the selected character and complete text, for the latest saved learner comment.
- Consequences:
  - The caller must be the room tutor, with an active tutor profile and an active room. Otherwise the server returns `FORBIDDEN` (mig-draft:30-37).
  - AI must be enabled, or the server returns `AI_DISABLED`. A learner message is required, or it returns `LEARNER_MESSAGE_REQUIRED`.
  - The character must be one of the five values, or the server returns `INVALID_CHARACTER`. If the tutor chose a character, the model's output must match it (`ai-api/cyberbullying.ts:12-29`; `ai-api/index.ts:177-183`).
  - Output must be JSON with `student_role` ∈ 4 learner categories, `response_in_role` ∈ 5 characters, and non-empty `final_response`. There are at most 2 attempts.
  - Truncated output returns 502 `AI_OUTPUT_TRUNCATED`. Context over 50,000 characters returns 413 `CONTEXT_TOO_LARGE` (`ai-api/index.ts:194-219,252-254`).
  - The pending saved prefix is analyzed before generation (`RoomContext.tsx:986`).
  - Quick Adjust parameter overrides are rejected with "Quick Adjust is unavailable for this practice" (`aiService.ts:884`).
  - Request epochs discard late results after a new request or a room switch (`RoomContext.tsx:972,987,992`).
  - The tutor's character choice applies only to this draft. A new suggestion lets the AI pick again.
- Legacy IDs: cb-request R5, R6; cb-plan R13.
- Evidence: `RoomContext.cyberbullying.test.tsx` ("stops generation when the server rejects the active tutor identity", "discard invalidates a late generation result…"), `supabase/functions/ai-api/index.test.ts`.
- Status: current.

**C-22 Review, edit, regenerate, reject and send a character reply**
- Requirement: A tutor can edit the draft's character and text, override Guard, regenerate (keeping the chosen character), reject, or send through the shared reviewed-send RPC.
- Consequences:
  - Draft state lives in the browser. Reload or discard expires it (cb-doc:40).
  - Feedback actions:
    - Sending with unchanged text and character records `accepted`. Changing either records `modified`. A character-only edit counts as `modified` (`RoomContext.tsx:800-803`; test).
    - Regenerate records `modified`. Replacing the draft with a new suggestion records `ignored`. Reject records `rejected`. None of these publish anything.
  - A tutor cannot send in a cyberbullying room without a reviewed draft: "Generate and review a character reply before sending." (`:795-798`).
  - The DB rejects any tutor message without a character and outside the reviewed RPC with `REVIEWED_RESPONSE_REQUIRED` (mig-cb:1497-1499).
  - The send is atomic: message, feedback and Guard update together. A failed send changes nothing locally.
  - If regeneration fails, the current draft and character are kept.
- Legacy IDs: cb-request R6, R7; cb-plan R13.
- Evidence: `RoomContext.cyberbullying.test.tsx` (7 tests), `supabase/tests/cyberbullying_browser_draft.sql`, `scripts/database/browser-draft.integration.test.js`.
- Status: current. R13 superseded the persisted-proposal lifecycle (`private.cyberbullying_suggestions` and begin/finish/review RPCs were dropped in mig-draft:154-162).

**C-23 Stored character identity, ratings and exports**
- Requirement: Every viewer sees the stored character and persona of an approved reply. Ratings attach to that message ID. Exports carry the character and the learner's target progress.
- Consequences:
  - Display identities: same_age_peer = Jerry, older_peer = Tom, victim = Dylan, bully = Sarah, educator = Ms. Smith (cb-doc:32-38).
  - Realtime, reload, AI history and exports agree on the stored identity.
  - Approved messages are immutable (`APPROVED_MESSAGE_IMMUTABLE`, mig-cb:1494).
  - JSON export includes `learningProgress` only for cyberbullying rooms. The student export is owner-scoped; the tutor export uses the active projection (`RoomContext.tsx:1486-1490`).
  - Tutor exports include the original and final character.
- Legacy IDs: cb-request R8.
- Evidence: `RoomContext.cyberbullying.test.tsx` ("realtime/reload projection keeps stored character identity for every viewer"), `cyberbullyingProgress.test.ts`, `src/contexts/__tests__/roomExportBuilder.test.ts`, `RoomContext.roleBasedExport.test.tsx`.
- Status: current.

**C-24 Closed Cyberbullying operation set**
- Requirement: A cyberbullying room supports only: save comment, analyze progress, request suggestion, review character/text, regenerate, reject, approve/send, rate, continue, and Guard override.
- Consequences:
  - Assessment messages are rejected with `UNSUPPORTED_PRACTICE_OPERATION` (mig-cb:1495-1496).
  - Clear chat history is rejected with `UNSUPPORTED_PRACTICE_OPERATION` (mig-cb:1009).
  - Phishing transfer sends v3/v4 return `FORBIDDEN` when the practice type is not phishing (mig-cb:293,550).
  - `transfer_learning_enabled` is forced to false (mig-cb:82-84).
  - Direct calls whose claimed metadata conflicts with the stored room are rejected.
- Legacy IDs: cb-request R6.
- Status: current.

**C-25 Client contract gate and maintenance gate**
- Requirement: The system rejects writes and AI/assessment calls from stale clients during a coordinated cutover.
- Consequences:
  - The required header is `x-practice-contract: cyberbullying-v2`. Without it, Edge returns 409 `CLIENT_RELOAD_REQUIRED` (`ai-api/index.ts:233`; `assessment-api/index.ts:644`).
  - The DB gate `private.practice_write_gate` returns `PRACTICE_MAINTENANCE` when closed and `CLIENT_RELOAD_REQUIRED` when the contract does not match (mig-draft:17-27,169).
- Legacy IDs: cb-plan step 3, "Implementation clarification".
- Status: current (v2).

**C-26 Retired Riley / multi-agent functionality**
- Requirement: The system no longer generates or plays back multi-agent (Riley) output. Stored historical transcripts are preserved.
- Legacy IDs: cb-request R3, E8.
- Evidence: `room_template_management.test.tsx` ("should hide the shipped Multi-agent room…"). `src/contexts/__tests__/RoomContext.multiAgentDraft.test.tsx` still exists.
- Status: current requirement. Completeness of the cleanup is unverified here; see Q-10.

### D. Conversation history used by AI

**C-27 Phishing tutor context reads the complete saved discussion**
- Requirement: The system gives the phishing tutor model the scenario, the pre-populated dialogue and every saved room message in deterministic order.
- Consequences:
  - Reads use a cursor over `(created_at, id)`, with pages of 1000 (`src/services/simplifiedAIContext.ts:39-75`).
  - A failed page throws. A partial history is never passed to the model (spec-history matrix).
  - An empty room still gets the scenario and pre-populated context.
  - Role prefixes are `Student:`, `Tutor:` and `Observer:`, plus `AI character {name} [{persona}; {character}]` (`:174-178`).
  - Assessment readiness: incomplete results, options or answers block generation with `ASSESSMENT_RESULT_UNAVAILABLE` (`:82-124`).
  - Malformed legacy template posts are filtered out.
- Legacy IDs: spec-history.
- Evidence: `src/services/__tests__/simplifiedAIContext.test.ts`, `aiContextIntegration.test.ts`.
- Status: current.

**C-28 Cyberbullying generation context is built server-side**
- Requirement: The system builds the role-play context from the stored scenario and the full room dialogue on the server. Each turn carries speaker, persona, character and Guard attribution.
- Consequences:
  - The `get_cyberbullying_context_v1` RPC returns `{practice_type, scenario, dialogue[], guard_mode, parent_message_id}` and makes no draft writes (mig-draft:30-55).
  - The dialogue is sent as one JSON user message. The total limit is 50,000 characters; beyond that the server returns `CONTEXT_TOO_LARGE`.
  - Messages whose user row is missing are dropped by the inner join.
- Legacy IDs: cb-request R5; cb-plan step 4 ("address 30-message and body-size limits").
- Evidence: `supabase/functions/ai-api/index.test.ts`, `supabase/tests/cyberbullying_browser_draft.sql`.
- Status: current.

**C-29 Analyzer context stops at the focus message**
- Requirement: The analyzer receives the dialogue history only through the focus learner message.
- Consequences: Scope is validated: the message, room, student and focus index must match, or the server returns `INVALID_SCOPE` (`assessment-api/index.ts:336-342`).
- Legacy IDs: contract "Input and decision order".
- Status: current.

---

## 2. Cross-feature interactions (shared state and the invariant that must hold)

**X-01 `public.messages` is shared by both practice types**
- Invariant for cyberbullying rooms (trigger `private.enforce_practice_message`, mig-cb:1488-1510):
  - Every tutor row carries a character and is written only by the reviewed RPC.
  - Learner rows never carry a character, and only the active learner may insert.
  - Rows are immutable after insert.
  - No assessment columns are used.
- For both practice types, the trigger derives `guard_mode` from `response_mode` on insert when it is null.
- Phishing rows must keep using the optimistic direct insert and the trusted transfer paths, unchanged (cb-request "preserve existing phishing behavior").

**X-02 Shared reviewed-send RPC `send_reviewed_tutor_response`**
- One atomic transaction inserts the message and the feedback row and updates Guard. This holds for both types (cb-plan contracts; RoomContext.md:29).
- Character, persona and provenance fields apply only when the practice type is cyberbullying (mig-cb:1399-1440).
- The phishing transfer variants v3/v4 must refuse cyberbullying rooms (mig-cb:293,550).
- Ownership is checked by comparing the supplied application user with `rooms.tutor_id` and the tutor profile.

**X-03 `public.ai_suggestion_feedback` holds review history for both types**
- Shared action vocabulary: accepted / modified / rejected / ignored.
- Shared Guard fields: `raw_guard_mode`, `final_guard_mode`, `guard_rectified`.
- Cyberbullying adds `raw_character`, `final_character`, `generation_provenance` and `contract_version:'cyberbullying_v1'` (`aiService.ts:1364-1372`).
- Invariant: the original and final values are both browser-reported, under the same trust model as phishing (cb-plan:41, cb-doc:56). The model persona and the human tutor ID stay distinct (cb-plan:43).

**X-04 Progress storage (`session_checklists`, `checklist_items`, evidence, `apply_learning_event_v1`) is shared**
- Cyberbullying checklists must be `progress_policy_version='transfer_v1'` and `target_version='cyberbullying_v1'`, with a non-null learner (mig-cb:1462-1469).
- Yet cyberbullying rooms force `transfer_learning_enabled=false` (mig-cb:82-84).
- Invariant: **every routing point must test `practice_type` before `transfer_learning_enabled`**. The current routing points are:
  - `RoomContext.tsx:719` (send),
  - the analysis-context RPC `transfer_learning_enabled OR practice_type='cyberbullying'` (mig-cb:1114),
  - export (`RoomContext.tsx:1486`).
- If any new code path routes on the transfer flag alone, it sends cyberbullying learners to the legacy `processStudentMessage` path. That path would then fail on the protected targets or produce wrong evidence.

**X-05 The assessment lifecycle is attached to the shared state machine**
- The contract makes partial → covered (`demonstrated_understanding`) mark an item "assessment due". Completion then requires `assessment_pass` (contract:59,103).
- Cyberbullying forbids assessment messages (mig-cb:1495) and never prepares one. RoomContext's cyberbullying generation skips transfer-candidate preparation.
- Invariant to decide: whether a cyberbullying `covered/good` reached from partial counts as complete. As built, the "assessment due" phase can never resolve. See Q-01.

**X-06 Guard (`rooms.guard_mode` boolean) and progress deferral/replay**
- Guard defers progress for both types.
- A manual override changes only current room state. It never rewrites historical messages (RoomContext.md:97).
- The cyberbullying draft records the room's Guard value at generation time. The tutor's Guard override is independent of the character choice (cb-plan:40).
- Unknown historical Guard provenance stays null and never silently becomes false (cb-request R2; cb-doc:44).
- The replay trigger fires on `UPDATE OF guard_mode` (mig-cb:987).

**X-07 Identity**
- Both types and both Edge functions share the same identity mechanism:
  - a name-and-role entry,
  - a browser-held application-user ID,
  - the `x-application-user-id` header,
  - DB checks on `users.current_role` and `status`.
- Generation and analysis pass the active room actor explicitly. This is the identity fix in release 8e5f880 (cb-doc:3; `checklistService.analyzeStudentMessages(…, applicationUserId)`).
- The single-learner rule (earliest active session) is shared with phishing transfer. Phishing tutor setup resolves the "sole active learner session".

**X-08 `practice_type` routing must be authoritative at every boundary**
- The boundaries are:
  - TutorView (create, template filter),
  - RoomContext (send, generate, regenerate, export),
  - aiService (`validateRoom` reads `practice_type`, `aiService.ts:987`),
  - ai-api (any `operation` field takes the cyberbullying route),
  - assessment-api (prompt variant and audit),
  - DB triggers.
- Invariant: behaviour comes from the stored room value. Prompt labels, claimed roles or character metadata supplied by the client never select behaviour (cb-plan step 5).

**X-09 The client-contract gate is global**
- ai-api and assessment-api reject **every** request without `x-practice-contract: cyberbullying-v2`, phishing included (`ai-api/index.ts:233`).
- The DB gate also covers direct writes (mig-draft:17-27).
- Invariant: phishing and cyberbullying clients must be deployed and reloaded together. A future cutover for either practice type invalidates the other's clients.

**X-10 Shared model and analyzer prompt**
- Message analysis for **both** types uses `DEFAULT_AI_MODEL` = `qwen3.8-flash` (`assessment-api/index.ts:343-346`; `aiModels.ts:18`).
- Assessment-question generation keeps `qwen3.5-flash` (`PROVIDER_MODEL`, `:24`).
- The cyberbullying analyzer prompt is the phishing `TRANSFER_ANALYSIS_SYSTEM_PROMPT` with a string replace plus an appended paragraph (`:357-359`).
- Invariant: changing the default model or the shared prompt is a changed experimental factor for both practice types. Each needs separate behavioural validation (cb-plan:149; cb-request R10).

**X-11 Ratings gate**
- Before replying, a student must rate the latest persisted tutor or AI response they have not rated yet. Pre-populated rows are skipped (RoomContext.md:218-222).
- This gate also applies to approved cyberbullying character replies, because they are tutor-role rows.
- Ratings key on the stored message ID (cb-request R8).

**X-12 Exports**
- One export builder serves both types.
- The role split is that tutors get AI analytics and config snapshots; students and observers do not.
- Only cyberbullying rooms export `learningProgress`. Phishing transfer progress stays in the trusted checklist projection (RoomContext.md:202).
- Invariant: export permission boundaries are inherited and must not widen (cb-request R8).

**X-13 Conversation-history builders differ by practice type**
- Phishing uses the browser-side `simplifiedAIContext`, which reads all room messages including other users.
- Cyberbullying uses the server RPC.
- The analyzer uses its own server-side history, truncated at the focus message.
- Invariants:
  - Only the current learner's own contribution can earn evidence (contract:16; cb-request R4).
  - Character and persona attribution must appear in every history builder (`simplifiedAIContext.ts:175-176`; mig-draft:46-49).

**X-14 Learner isolation in progress**
- The replay inventory, the cache key and checklist reads are all scoped to (room, learner).
- The returned owner is verified on both the scoped lookup and the legacy fallback, and a mismatch clears the view (RoomContext.md:134-138).

**X-15 Templates and practice type**
- `room_templates.practice_type` defaults to phishing. Seeded rows from `toRoomTemplateInsertRow` do not set it (`demoRoomTemplates.ts:652-664`).
- A cyberbullying template must carry a full `scenario_config`. No cyberbullying template seeds exist; scenarios come from `public/cyberbullying/scenarios.json`.

---

## 3. Constraints and NFRs

**Delivery and process**
- Staging → merge into `no_sign_up` → integrated staging verification → production. Exact-artifact hashes. At most one pending migration, archived only after both environments pass (cb-request R11; AGENTS.md).
- Shared staging writes need the project lease (AGENTS.md).
- No Docker. The live schema is inspected with Supabase MCP; archived migrations are not live truth (cb-request closed scope; AGENTS.md).
- Verification must run deterministic, migration, browser and real-provider checks. Deterministic passes are reported separately from model-behaviour acceptance. All input/output pairs are preserved outside Git (cb-request R10; cb-plan step 7).
- Docs are updated before implementation commits (cb-request R12).

**Security and data**
- Provider credentials stay server-side. The existing server AI transport is reused (cb-request R5; E6).
- No destructive deletion of existing records under "cleanup". Historical content and attribution are preserved (cb-request R3; closed scope).

**AI limits**
- ai-api limits: ≤30 provider messages, ≤50,000 characters per message and in total, `max_tokens` ≤2000 (`ai-api/index.ts:34-37`).
- Cyberbullying generation: temperature 0.7, max_tokens 2000, JSON mode, thinking off, ≤2 attempts (`:194-218`).
- The character reply must be ≤3 sentences in simple language, for learners aged 9–14 (`ai-api/cyberbullying.ts:10`, prompt text).
- Analyzer: temperature 0, max_tokens 600, JSON mode, ≤2 attempts per target, `Promise.allSettled` across targets (`assessment-api/index.ts:349-382`).
- Upstream fidelity: the scenario assets and strategy are pinned to Copilot `89e7fda…`, and images carry SHA-256 hashes. Any change to the role strategy is an explicit, reviewed semantic correction (cb-request E7; cb-doc:12-14).

**Data access sizes**
- History page sizes: 500 for the analyzer inventory and 1000 for tutor context.
- History reads use stable `(created_at, id)` ordering (`checklistService.ts:143`; `simplifiedAIContext.ts:40`).

**UI and code standards**
- Panel geometry is in spec-panel (C-17).
- Jest coverage thresholds: 75% branches, 80% functions, lines and statements (AGENTS.md).
- CRA-imported modules must not start with a shebang (tutor-system/AGENTS.md). Hence the commented `// #!/usr/bin/env node` in `cyberbullyingScenarios.ts:1`.
- Keep modules small. Avoid generalized frameworks (cb-request closed scope).

---

## 4. Non-goals stated in sources

- No unrelated product features. No scenario-specific variation of the cyberbullying targets. No generalized frameworks (cb-request closed scope).
- No persisted Cyberbullying proposal lifecycle (proposal IDs, generation statuses, context revisions). R13 retired it (cb-plan:30-32).
- No automatic Cyberbullying Guard decisions beyond the inherited behaviour (cb-request A3).
- No fixes to phishing parameter persistence as part of this integration (cb-request E10).
- Assessment questions keep their separate private delivery path. Cyberbullying does not use it (cb-plan:42; cb-doc:60).
- spec-five lists:
  - **Never**: rewrite active room inventories, alter frozen evaluation datasets, change assessment scheduling, or introduce a new target schema.
  - Custom room targets are not truncated.
- spec-unified: the template migration does not rewrite existing room data.
- spec-recheck: no second progress ledger.
- spec-tplread: global template write and mutation behaviour does not change.
- spec-history: server contracts do not change (browser-only fix).
- contract: coverage claims nothing about long-term retention or real-world behaviour (contract:59).
- Code-implied: tutors cannot save their own templates; templates are global and centrally managed (`TutorView.tsx:320,692`).

---

## 5. Glossary (with naming drift)

| Term | Definition | Drift / aliases |
|---|---|---|
| Practice type | Immutable room/template subject: `phishing` or `cyberbullying` | UI labels are "Phishing training" and "Cyberbullying practise" (British spelling in the UI and docs, "practice" in code comments) |
| Room | A post-style discussion space with a tutor, one learner and observers | — |
| Template (room template) | A global, zero-UUID-owned prefill for room creation (`room_templates`) | "Teaching template", "demo template", "behavior-demo/test-only template", "global template" |
| Scenario (phishing) | A named entry in `SCENARIO_TEMPLATES` that supplies target inventories | Names drift: "Contact Information Exposure" (code) / "Phone Number Exposure" (spec-five) / "Phone Number Phishing Training" (template) |
| Situation / Cyberbullying scenario | A pinned Copilot post with initial comments, stored as `scenario_config` (`copilot-{n}`) | UI says "Situation"; types say `CyberbullyingScenario` |
| Character | The AI role in a cyberbullying reply: same_age_peer, older_peer, victim, bully, educator | Also called "role", "persona" or `response_in_role`. The **persona** is the display identity (Jerry, Tom, Dylan, Sarah, Ms. Smith; `persona_id`/`persona_name`). Upstream calls the learner's classification `student_role`; code stores it as `reason` |
| Learner role (student_role) | One of four model classifications of the learner: Neutral/silent bystanders, Aggressive upstanders, Bully accomplices, Constructive upstanders | Not stored as a field; it flows into `guard_reason` |
| Learning target | One observable goal tracked per learner | Synonyms: checklist item, knowledge point, learning goal, objective, detection area |
| Checklist | A set of targets plus progress (`session_checklists` + `checklist_items`) | "Learning Progress" in the UI |
| Detection areas / verification steps | The two legacy target lists. Since spec-unified, everything lives in `detection_areas` and `verification_steps=[]` | Item types: `detection_area`, `verification_step`, `understanding`, `behavior`. Cyberbullying uses `understanding` ×1 and `behavior` ×4. Legacy UI shows `[understanding]`/`[behavior]` prefixes |
| Progress policy | `legacy_v1` (browser coverage detection, tutor manual edits) or `transfer_v1` (trusted, learner-owned, event-based) | "Transfer" is used generically for learner-owned progress |
| Target version | `cyberbullying_v1` for the five shared targets | Feedback `contract_version` also reuses `cyberbullying_v1` |
| Progress state | A `status/understanding_level` pair: pending/none, partially_covered/basic, covered/good, needs_review/basic | — |
| Learning event | `initial_signal`, `demonstrated_understanding`, `post_repair_signal`, `spontaneous_transfer`, `contradiction`; plus `assessment_pass`/`assessment_fail` | Evidence types are `action`, `recognition` and `explanation` |
| Guard / guard_mode | A boolean room participation state in which a security-supervisor response is given and progress is deferred | Older docs say `tutoring|guard`, `response_mode`, `active_response_mode`, `raw_mode/final_mode/mode_rectified`. The current names are `raw_guard_mode/final_guard_mode/guard_rectified` |
| Browser draft | Unsent AI suggestion state held in React (original and final text/character/Guard) | It replaced "proposal" / `cyberbullying_suggestions` |
| Reviewed send | The atomic publication RPC `send_reviewed_tutor_response` | — |
| Practice contract | The client-compatibility header `x-practice-contract` (currently `cyberbullying-v2`) | The plan text says `cyberbullying-v1` |
| Riley / multi-agent | A retired multi-agent tutor mode | — |
| Observer | A read-only room participant, including any later student joiner | — |

---

## 6. Conflicts (sources vs sources, or sources vs code)

- **K-01 Practice-contract header version.** cb-plan:147 says the client cutover contract is `x-practice-contract: cyberbullying-v1`. The code uses `cyberbullying-v2` at `supabase/functions/ai-api/index.ts:233,274` and `assessment-api/index.ts:644,807`, and mig-draft:169 sets the gate to v2. The plan line describes the first batch; v2 is current.
- **K-02 Analyzer model.**
  - cb-plan:149 says "Cyberbullying analysis retain[s] their validated Qwen3.5 model", and `src/services/README.md:15` says "assessment-api retains Qwen3.5".
  - The code overrides analysis to `DEFAULT_AI_MODEL` = `qwen3.8-flash` (`assessment-api/index.ts:343-346`; `src/services/aiModels.ts:18`; commit `8dffa9c` "use the shared model for cyberbullying progress").
  - Only assessment generation keeps qwen3.5 (`:24,307`).
- **K-03 Release status.** `plan/cyberbullying-practise/README.md:9-11` says "the current release implements the earlier approved proposal workflow". cb-plan:7 says R13 is released (`9c7364c`), and the proposal table was dropped (mig-draft:154-162). The README is stale.
- **K-04 Target 3 wording.**
  - cb-doc:22: "Challenge bullying calmly and respectfully, avoiding escalation."
  - Code and DB: "Challenge bullying with a calm, respectful response that avoids escalating the conflict." (`detectionTemplates.ts:133`; mig-cb:61).
  - The DB trigger requires exact text, so the doc is a paraphrase, not the contract. Targets 1, 4 and 5 also differ in punctuation (cb-doc:20-24).
- **K-05 Cyberbullying item types vs the unified schema and evidence rules.**
  - spec-unified:53-56 says new output uses `detection_area`.
  - Cyberbullying targets use `understanding` + `behavior` (mig-cb:59-63).
  - contract:44 defines evidence-type rules only for `understanding` and `detection_area`. Rules for `behavior` items are unspecified.
- **K-06 Guard representation in RoomContext.md.**
  - RoomContext.md:165 says "Room participation remains `tutoring` or `guard`", and :97 names `raw_mode/final_mode/mode_rectified`.
  - The code uses boolean `RoomParticipationMode` (`src/types/index.ts:204-209`) and `raw_guard_mode/final_guard_mode/guard_rectified` (`aiService.ts:1364-1368`; `RoomContext.tsx:833-837`). RoomContext.md (updated 2026-10-14) is stale.
- **K-07 AI context description.** RoomContext.md:83 says "Context building: Extracts recent student messages". The code reads the complete paginated discussion (`simplifiedAIContext.ts:39-75`; spec-history).
- **K-08 Meaning of `ignored`.** RoomContext.md:93 says "Suggestion times out without action". The code records `ignored` when a new suggestion replaces the current one (`RoomContext.tsx:977,1035`; cb-doc:40). No timeout path was found.
- **K-09 Progress model in RoomContext.md.** RoomContext.md has no mention of `practice_type` routing or cyberbullying (it predates 2026-10-21), while the code branches at `RoomContext.tsx:719,795,1026,1207,1486`.
- **K-10 Contradiction outcome.**
  - ai_checklist_integration.feature:139-143 says a later misunderstanding reopens a covered item as `partially_covered`.
  - contract:54 says `contradiction` moves it to `needs_review/basic`.
  - The legacy and transfer paths therefore differ, and the BDD suite has 4 baseline failures (spec-uifix:69).
- **K-11 General Scam Indicators template and categories.**
  - checklist_management.feature:74-86 expects 6 template items, and :17 expects `[understanding]`/`[behavior]` prefixes.
  - The code has 18 `detection_areas` items with no categories (`detectionTemplates.ts:39-62`).
  - "Personal Details Protection" (11 items, `:96-111`) also violates "five per scenario" (`src/services/README.md:5`).
- **K-12 Scenario naming and count.**
  - spec-five:20 names six scenarios, including "Phone Number Exposure".
  - The code has eight catalog entries; the "Contact Information Exposure" key is used by the "Phone Number Phishing Training" template (`detectionTemplates.ts:85`; `demoRoomTemplates.ts:586,605`).
- **K-13 Template round trips.**
  - cb-request R1 and cb-plan:35 require preserving the scenario "through creation/copy/export" and template round trips.
  - In code, tutors cannot save templates (`TutorView.tsx:320,692-711`), the loader ignores the tutor (`supabase.ts:893-901`), and seeds omit `practice_type` and contain no cyberbullying entries (`demoRoomTemplates.ts:652-664`).
  - A cyberbullying template round trip exists only for DB-inserted rows (test "reuses the complete stored Cyberbullying template").
- **K-14 Template token budget.** Template AI configs set `max_tokens: 100` (`demoRoomTemplates.ts:74`; also `TutorView.tsx:311` falls back to 100). `src/services/README.md:14` says tutor requests use `max_tokens 600`. It is unconfirmed whether the runtime overrides the stored value.
- **K-15 cb-doc dates.** Line 3 says "Updated 2026-10-22"; line 6 says "Updated: 2026-10-21". These are minor header drift.
- **K-16 Focus selection.** The phishing `generateAIResponse(prompt, focusMessageId, overrides)` honours an explicit focus. Cyberbullying ignores both arguments and always targets the latest saved learner message (`RoomContext.tsx:966-970,1026-1028`). The docs say nothing on this.
- **K-17 Learner initialization trigger.** For phishing, the tutor saves targets, or enabling transfer copies legacy items (`RoomContext.tsx:1340-1365`). For cyberbullying, initialization is automatic at join (mig-cb:1085-1087). cb-doc:26 ("The first learner joining receives these targets") matches the code. This is a divergence, not a defect, but a PRD must state both.

---

## 7. Open questions

- **Q-01** What does "complete" mean for a cyberbullying target reached from partial, when assessments are forbidden (X-05)? Options: treat covered as complete for cyberbullying, or add a cyberbullying application check.
- **Q-02** What evidence-type rules apply to `behavior` items (four of the five cyberbullying targets; K-05)? Does an action-only answer cover "recognize impact" (understanding)?
- **Q-03** Does the live schema in staging `ciubrzggdqesgvfkpolj` and production `zgbufaxooqxeabewktzd` match mig-cb and mig-draft (triggers, gate, `join_room_v1`)? This was not inspected here; AGENTS.md requires MCP inspection.
- **Q-04** Should the practice-contract gate be renamed and generalized as a platform client contract, given that it blocks phishing clients too (X-09)?
- **Q-05** Is the `legacy_v1` path (browser coverage detection, tutor manual status override, custom items) still in product scope? With `transfer_learning_enabled` defaulting to true (cb-request E2), how is it reached, and who owns its 4 failing BDD scenarios?
- **Q-06** Should the PRD keep the non-five catalog entries (General Scam Indicators: 18; Personal Details Protection: 11), or state that the "five targets" rule applies only to maintained teaching templates?
- **Q-07** Are tutor-owned templates and "save as template" out of scope permanently? If so, R1 "template round trips" should be restated (K-13).
- **Q-08** Should phishing exports include durable learner progress the way cyberbullying exports do (R8 says "appropriate exports")?
- **Q-09** Is the student rating gate intended to fire on every approved cyberbullying character reply (X-11)?
- **Q-10** Is the Riley cleanup complete? `RoomContext.multiAgentDraft.test.tsx` and the "Multi-agent room" template-hiding tests remain. An inventory reconciliation record is needed.
- **Q-11** Is 413 `CONTEXT_TOO_LARGE` at 50,000 characters an acceptable terminal failure for long cyberbullying rooms? Clear-chat is unsupported for cyberbullying, so there is no in-room recovery.
- **Q-12** Should tutors be able to target an older learner message in cyberbullying, as they can in phishing (K-16)?
- **Q-13** How does a tutor reset a cyberbullying room, given that clear-chat history is unsupported (mig-cb:1009)? Is "create a new room" the intended answer?
- **Q-14** Is the plaintext room password on tutor cards (`TutorView.tsx:817-820`) an accepted requirement (room_management.feature:98-99) or a security debt?
