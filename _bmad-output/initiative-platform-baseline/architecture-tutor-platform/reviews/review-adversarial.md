# Adversarial review: architecture spine, tutor platform

Intent: find pairs of independently built units that each obey every AD to the letter yet cannot work together, so each pair becomes a new or tightened AD. Reviewed 2026-10-22 against the spine, code sweeps 1-3 and the PRD. The spine was not edited.

## Verdict

The spine is sound where it is written (progress and assessment state inside `private`, one grading transaction, derived due). It is silent or unenforceable on everything outside that core. Eleven pairs below build incompatibly while obeying every AD. Three root causes explain nearly all of them:

1. **The spine governs RPCs, but the system is still mostly direct table access.** `rooms`, `messages`, `sessions`, `users`, `message_feedback`, `ai_suggestion_feedback` carry an `ALL ... USING true` policy (sweep 3 s2). Every AD that says "only through X" or "checked in SQL" is a rule a direct `supabase.from(...)` call walks around without breaking its letter, because the ADs bind RPC authors, not table writers.
2. **`rooms` is a shared row with at least six writers and no AD names an owner for any column** (Guard, in-room assessment flag, AI config, practice type, password, active flag).
3. **The trusted path is client-selected.** AD-2 puts the routing condition in one place, but that place is `RoomContext.tsx:719` and the server cannot tell which path a message took.

Severity key: **S1** produces wrong learning records or a security-visible divergence; **S2** produces a visible inconsistency or blocks a release; **S3** drift risk.

---

## Holes (ordered by severity)

### H1 (S1). Two writers of `rooms.guard_mode`; Guard has no AD

- **Unit A, "Guard toggle" (FR-30):** a tutor-side service sets `rooms.guard_mode` after confirmation. It follows AD-5 (defers progress) and AD-8 (checks `tutor_id`; sweep 2 s2 shows `guardModeService.ts:60-84` does `.update().eq('tutor_id', ...)` directly on the table).
- **Unit B, "character/AI reply send" (FR-48, FR-28):** calls `send_reviewed_tutor_response_v4`, which sets `guard_mode = (v_mode='guard')` on every reviewed send (sweep 1 s1, M21:352-353).
- **Where they clash:** the owner turns Guard on in tab 1. A reply drafted earlier in tab 2 with `response_mode='normal'` is sent and silently turns Guard off, with no confirmation and no tutor Guard action. This breaks FR-30 ("Guard changes only by the room owner's action; a recommendation alone never changes it") and FR-22 (progress resumes without the owner turning it back). Also, `messages.guard_mode`, `ai_suggestion_feedback.original/final guard_mode` and `rooms.guard_mode` are three stores of "Guard" with no stated meaning (state now / state at send / state at recommendation). Sweeps 1 and 2 even disagree on who writes the column (sweep 1: "no other writer found in src"; sweep 2: `guardModeService`), which is the same ambiguity at the documentation level.
- **Why every AD is satisfied:** AD-1 lists progress and assessment entities only. AD-5 describes Guard's effects, never its writer. AD-8 is satisfied by the `tutor_id` filter.
- **Close with:** *AD-13, One writer for room-level controls.* `rooms.guard_mode` changes only through `set_room_guard_v1(room, actor, on, expected_version)` (owner check in SQL, version compare-and-set). A reply send records the Guard state it was composed under as a message attribute and never writes the room. Same rule for `transfer_learning_enabled`, `ai_assistant_enabled`, practice-agnostic AI config: each column lists its single writer RPC in the spine table, and a column with no listed writer is not writable. Add a trigger so direct `UPDATE` of those columns is rejected.

### H2 (S1). In-room assessment toggle silently moves judging to the browser

- **Unit A, "In-room assessment setting" (FR-31):** toggles `rooms.transfer_learning_enabled`.
- **Unit B, "Message judging" (FR-20, FR-19):** the learner-send path chooses trusted vs legacy with `practice_type='cyberbullying' || assessmentId || (transfer_learning_enabled && policy==='transfer_v1')` (sweep 2 s4).
- **Where they clash:** in a phishing room with the toggle off, the condition is false, so the learner message is inserted from the browser and judged by `CoverageDetectionService` in the browser. FR-31 and FR-18 require learning progress to work the same with the toggle on or off, and NFR-2 forbids browser-side progress change. Obeying AD-2 does not help: AD-2 says the legacy path "serves old rooms only", but the PRD makes the toggle a normal tutor control. A builder of the toggle UI writes exactly what FR-31 says and flips a column. A builder of judging copies the existing condition. Both follow AD-2's letter ("stays in one place").
- **Also:** AD-2's text includes `transfer_learning_enabled` in the *trusted-path selector*, but AD-6 says the flag controls only assessment. One flag, two meanings.
- **Close with:** tighten AD-2. The trusted path is selected by `session_checklists.progress_policy_version` (server fact), never by `transfer_learning_enabled`. The assessment flag gates only assessment preparation and send. Server enforcement: a `BEFORE INSERT` trigger on `messages` rejects learner-role messages in any room with a server-judged policy unless inserted by `post_assessment_message_v2`. A client that picks the legacy path must fail loudly (NFR-7).

### H3 (S1). Role-in-room is read from `users.current_role`, which a user can change

- **Unit A, "Manage own profile" (FR-2):** `setUserRole` changes `users.current_role` for the same id (sweep 2 s3).
- **Unit B, "Join room" (FR-12, `join_room_v1`):** any active student user takes the learner seat if free; `assertTeacher` is `current_role==='tutor'` (sweep 1 s2f).
- **Where they clash:** a tutor who owns room R switches role to student (id unchanged by FR-2) and joins R as its learner, or answers an assessment they authored (`process_assessment_message_v2` checks `student_id = actor` only; `send_reviewed` checks `tutor_id = actor` and role tutor, never that actor differs from the learner). The same id is both owner and learner. Conversely, flipping to tutor mid-room changes `can_review_assessment` for rooms where the user is a learner. Each unit obeys AD-8 literally.
- **Close with:** *AD-14, Room role is derived from the room, never from the user.* Owner = `rooms.tutor_id`; learner = the one active session row; observer = anything else. `users.current_role` only picks the dashboard. `join_room_v1` refuses a user who equals `rooms.tutor_id`. Every tutor operation checks `tutor_id = actor` and does not read the user role.

### H4 (S1). The client picks the trusted path, so "one writer" is advisory

- **Unit A, "Learner send" (trusted path):** `post_message` then `process_message`.
- **Unit B, any new learner-message source** (for example a "resume after disconnect" feature, an imported demo dialogue, a test-room behavior demo): inserts into `messages` directly, as the legacy path already does for all tutor and observer messages and still does for learner messages in some rooms.
- **Where they clash:** the direct insert is legal under the table policy and breaks no AD (AD-1 names progress and assessment tables; `messages` is not one; AD-12 restricts only result and closure messages). The result is a learner message that the server never judges and no catch-up sees, for example a cyberbullying learner message that violates FR-46 ("saved first, then judged").
- **Close with:** same trigger as H2, and tighten AD-1 to include an explicit list of `public` tables with their permitted direct writes: direct `INSERT` into `messages` only for `user_role in ('tutor','observer')` non-assessment kinds; everything else only via a definer function.

### H5 (S1). Two stores of assessment state, no precedence

- **Unit A, "Learner assessment UI" (FR-37, FR-42):** derives open/answered state from `messages.assessment_lifecycle` (`findOpenLearnerAssessment`, sweep 2 s2), values `delivered, answered, passed, failed, cancelled, invalidated, legacy_incomplete`.
- **Unit B, "Owner review / export" (FR-50, `read_review`):** reads `private.transfer_assessments.lifecycle` (`open, passed, failed, cancelled, legacy_incomplete`).
- **Where they clash:** two enumerations with no mapping. `answered` and `invalidated` exist in only one. A builder of the export maps `invalidated` to `cancelled`; the UI builder treats it as terminal-failed. Because `messages` is directly writable (policy true) a client can also edit the mirror. AD-1 names `private` as the one writer's target and ignores the public mirror; AD-6's "cancelled" state does not say what the mirror shows when a passed assessment is cancelled by replay (`invalidated` in the mirror, `progress_invalidated` in the closure message).
- **Close with:** *AD-15, Projection tables are derived.* `messages.assessment_lifecycle` and `assessment_event` are written only by the same functions as the private row, in the same transaction; the spine gives the single mapping table private-lifecycle -> public mirror -> UI state; a client never writes either column (trigger, as `postgres`-only insert is already done for result messages). Readers use the mapping, not their own enumeration.

### H6 (S2). Target set has two owners; target identity undefined

- **Unit A, "Set up learning targets" (FR-18, FR-19):** `initialize_transfer_checklist_v1` replaces/creates the room's set, tutor-owned, before or after the learner joins.
- **Unit B, "Manual progress edit" (FR-53, `edit_room_checklist_v1`):** per sweep 1 it also edits wording, removes items and edits priority/notes, with its own request-id lock through `checklist_updates.event_id`.
- **Where they clash:** both are "owner manual edit of progress" paths allowed by AD-1. Re-running setup after Unit B removed an item resurrects it under a new row id; a deferred Guard event keyed to the old item id is `rejected` (AD-5) while the PRD says only an event "not allowed by the progress state" may be rejected (FR-22); an open assessment is cancelled with reason `target_changed` for both. `target_key` and `target_version` exist (sweep 3 s2) but no AD says who bumps them, what survives a re-setup, or whether the event inbox keys on item id or target key.
- **Close with:** *AD-16, Learning-target identity.* A target is identified by `(room, learner, target_key)`; `initialize_transfer_checklist_v1` is create-only and refuses a room that has any evidence or history; every later change (wording, removal, status, priority, note) goes through `edit_room_checklist_v1`, which bumps `target_version`; events and assessments reference `target_key + target_version`.

### H7 (S2). Learner writes the tutor's AI config row

- **Unit A, "Configure AI assistant" (FR-24, FR-52):** owner-only writes to `ai_assistant_configs`, `rooms.ai_assistant_*`, with an SQL owner check (AD-8).
- **Unit B, "Learner chooses AI role" (FR-29):** learner selects the AI role, which "locks it" for the owner.
- **Where they clash:** the lock needs a stored flag in the same row the owner writes. Builder A refuses any non-owner write per AD-8. Builder B writes the same row from the learner (the table is open) or adds a second column. Regeneration (`aiService`) and `get_cyberbullying_context_v1` read config in different ways. PRD tension: FR-7 says AI assistant is on for every cyberbullying room, FR-24 says the owner can turn it off, FR-47 refuses when off.
- **Close with:** put configuration ownership in the H1 column table: `ai_role` has two named writers (`set_ai_config_v1` owner; `choose_ai_role_v1` learner, one-shot, sets `ai_role_locked_by`), and the owner RPC refuses while locked. Resolve the FR-7/FR-24 conflict in the PRD.

### H8 (S2). Tutor-review record is written by two paths that cannot agree

- **Unit A, "Phishing send + record" (FR-28, FR-51):** the client inserts the tutor message directly, then inserts `ai_suggestion_feedback` with action, final text and Guard state in a second call (the legacy "Reject" button in `RoomPagePost.tsx:510` already does a separate write).
- **Unit B, "Character reply send" (FR-48):** `send_reviewed_tutor_response_v4` writes message, action and Guard state together in one transaction.
- **Where they clash:** the same export (FR-50) and the same record (FR-51) must serve both practice types, but only one is atomic. A phishing reply can exist without its `accepted/modified` record, or twice (a retry has a new client request id; AD-7 says the id is carried but never says who persists it across a reload). Both obey AD-7 on paper.
- **Close with:** tighten AD-7: the request id is minted once per user intent and persisted in the draft (not regenerated per call, sweep 1 s2e); and *AD-17, All tutor replies go through one send RPC family* regardless of practice type, writing message and review record in one transaction. `ai_suggestion_feedback` has that RPC as its only writer.

### H9 (S2). Participant membership has no server model for observers

- **Unit A, "Observe a room" (FR-13):** observer flag in `sessionStorage` (`room-observer:{roomId}`, sweep 2 s2); server `join_room_v1` returns `room_role:'observer'` without a stored row.
- **Unit B, "Download export" (FR-50, learner and cyberbullying-progress parts):** needs server data (the learner's attempts, progress for every participant) through `assessment-api`, whose `assertRoom` requires the room in `allowed_room_ids` (owner or active session).
- **Where they clash:** an observer has no session row, so Unit B's server call is refused for observers, or a builder adds an observer session row, which then collides with the "one active learner" seat rule (`sessions.student_id`) and with `allowed_room_ids` being used for learner authorization. Both obey AD-8.
- **Close with:** *AD-14 extension.* Define `room_participants(room, user, room_role)` as the only membership record: owner, learner (unique), observers. Edge membership checks and export reads use it; sessions is the learner seat only. Add the export reads to the data-visibility rule of H11.

### H10 (S2). Contract-version bump has no deployment order and a name that gates everything

- **Unit A, "Breaking phishing response change" (for example the tutor decision shape):** per AD-11 bumps `x-practice-contract` in client, both functions and SQL "together".
- **Unit B, "Unrelated cyberbullying fix" mid-release:** deployed by the release owner after SQL but before the new client bundle.
- **Where they clash:** `private.practice_write_gate.required_contract` flips with the SQL release. Every old browser immediately gets `CLIENT_RELOAD_REQUIRED` and `check_practice_write_gate` blocks even direct table writes, for both practice types, before the client hosting has changed. "Together" is not a deployable order. The header is also named `cyberbullying-v2` yet gates phishing (sweep 3 s1). Three other version axes exist and no AD relates them: `progress_policy_version` (`transfer_v1`), `target_version`, AI output contract and prompt version (`copilot-89e7fda-supervised-v2`, `generation_provenance`).
- **Close with:** tighten AD-11: contract bump order is client bundle live (accepting old and new), then SQL gate accepts both for an overlap window, then Edge, then the gate drops the old value; rename the header to a platform contract; add a table naming each version axis, what bumps it, and what it gates (AI prompt version never gates traffic).

### H11 (S2). Nothing says how data leaves `private`

- **Unit A, "Export builder" (FR-50):** the learner's export includes own attempts; the owner's export includes review records.
- **Unit B, "Assessment DTO projection":** `PUBLIC_ASSESSMENT_DTO_KEYS` strips private fields per API response.
- **Where they clash:** AD-12 restricts where the key is *stored* and says the answer key reaches `messages` only inside the result message. It does not constrain a *new RPC or Edge operation* that reads `private.transfer_assessment_attempts` for an export: the builder adds `get_learner_attempts_v1`, returns `correct_option_ids` "for the owner", and the client export builder (which runs in the browser from `roomExportBuilder.ts`, sweep 2 s6) decides by role what to include. Role gating in the export builder is client-side; observers use the same anon key. The FR-50 rule "no private material beyond what result messages publish" is thus a client convention.
- **Close with:** *AD-12 extension.* Every function returning rows derived from `private.*` ends in one named projection function per audience (owner, learner, public); exports are produced server-side from those projections, not assembled in the browser from open tables. A new reader of `private` must reuse a projection or add one in the spine.

### H12 (S3). Unresolved realtime merge precedence

- **Unit A, realtime subscription:** INSERT-only events (sweep 2 s5) add messages.
- **Unit B, 2-second poll:** returns current rows, including question messages whose lifecycle was updated in place.
- **Where they clash:** the convention says "merge by message id" without precedence. Builder A prefers the first-seen row, builder B the latest fetch. An INSERT event of an old `delivered` question arriving after a poll showing `cancelled` reopens it (violates FR-42). Both follow the convention.
- **Close with:** a merge rule: terminal lifecycle states are absorbing; otherwise the row with the greater `updated_at`/version wins. Add `version` to messages that mutate.

### H13 (S3). Event dedupe keys, model and envelope drift

- **Dedupe keys:** `assessment:<id>`, `analysis:<msg>`, manual-edit `event_id` all share the inbox space. AD-7 says "define your dedupe key before it ships" without a namespace table, so two features can pick colliding keys, or the same event can be keyed differently by the replay and by the direct call.
- **Models:** AD-10 says model configuration lives in `src/` and is imported by Edge Functions, but `assessment-api` hardcodes `PROVIDER_MODEL='qwen3.5-flash'` (sweep 3 s4) while `ai-api` imports `qwen3.8-flash`. The PRD says changing a model changes behavior for every practice type (NFR-10). The spine states the rule the code breaks.
- **Envelope:** the convention says every Edge Function answers `{ok, data|error}`; `ai-api` answers `{error:{code}}` with no `ok` and no message. A new `ai-api` operation (for example server-side learning-target generation, FR-18) copies either. The client already has two parsers.
- **Close with:** a key-namespace table in AD-7; an AD-10 clause forbidding model literals outside the shared config (with a lint test); and a decision whether `ai-api` is migrated to the envelope or exempted in writing.

### H14 (S3). AI context assembly has no owner

- **Unit A, "AI suggestion" (FR-25, FR-43):** phishing prompt built in the browser from client state and sent as generic chat; generic chat has no identity or ownership check (sweep 3 s1).
- **Unit B, "Assessment draft" (FR-33) and "character draft" (FR-47):** server loads context from the database via RPC with an owner check.
- **Where they clash:** FR-25 requires the "complete saved conversation" and FR-43 requires assessment outcomes to come only from the saved conversation. A browser-assembled prompt may include cached or optimistic messages and the `sessionStorage` evidence cache. AD-8 applies to RPCs and generic chat has none, so it is vacuously satisfied; AD-11 only says the call is made server-side.
- **Close with:** *AD-18, AI context is built on the server.* Every AI job obtains its inputs from a context RPC that checks `tutor_id = actor`; the client sends ids and style parameters, never conversation text. Add the generic chat path to the Deferred list with a removal condition if it is kept for old rooms.

### H15 (S3). Deletion and append-only history

- **Unit A, "Delete my room" (FR-9):** removes the room "and everything it holds, including private assessment records".
- **Unit B, "history is append-only" (AD-1):** `checklist_updates`, `coverage_evidence`.
- **Where they clash:** FR-9 is probably a direct `rooms.delete()` (the table policy is open), so the owner check is the browser's and the cascade into `private.*` depends on foreign keys the spine does not state. `clear_room_chat_history_v1` (still deployed, PRD FR-17 withdrawn) deletes assessments, attempts and messages. Both pass AD-1 because deletion is not "update".
- **Close with:** *AD-19.* Deleting a room is one owner-checked RPC with a stated cascade list; `clear_room_chat_history_v1` is revoked or removed to match FR-17/Non-Goals; append-only gets the carve-out "except room deletion".

---

## Where the spine contradicts its own evidence

| Spine statement | Evidence | Effect |
| --- | --- | --- |
| AD-1: "other RPCs ... never update these tables directly" | Sweep 3 s2 lists anon-callable legacy definer RPCs `update_checklist_progress`, `soft_delete_checklist_item`, `initialize_checklist_from_template` (x2), `send_reviewed_tutor_response`; only the Guard trigger blocks progress writes, and only while Guard is on | The one-writer rule is not enforced. Add: revoke or drop, and a table-level trigger that rejects progress writes from any caller but the two listed functions. |
| AD-2: routing condition "stays in one place" | It is inline at `RoomContext.tsx:719`; practice branching is scattered in about eight places | See H2/H4. |
| AD-9: "Practice-specific behavior branches on [practice_type] and nowhere else" | Contract header `cyberbullying-v2` gates both types; PRD FR-5 says the stored type is the only selector; Deferred table defers the seam | Branches written client-side and in SQL by different builders will diverge (client pins "five targets", SQL seeds them). Name the SQL function that is the authoritative per-type initializer. |
| AD-10: models live once in `src/` | `assessment-api` hardcodes its model | See H13. |
| AD-8: ownership "checked in SQL" for every tutor-only operation | `analyze_message`, `get_transfer_message_analysis_context_v1`, `process_assessment_message_v2`, `cancel_transfer_assessment_v1`, `join_room_v1` pass on membership or student identity; the remaining list is parked in "the addendum" | A reader of the spine cannot know which operations are safe to copy. Move the list into the spine as a table. |
| Convention "snake_case API / camelCase UI" | `x-practice-contract` is also the only versioned name carrying a practice name | cosmetic |

## Cross-cutting recommendations (smallest set that closes most holes)

1. **Add a "shared row ownership" table to the spine** (rooms columns, messages kinds, sessions, ai config, ai_suggestion_feedback): each column or kind has one writer and one permitted direct writer set. Closes H1, H2, H4, H7, H8.
2. **Add AD-14 (room role derived from room).** Closes H3, H9.
3. **Tighten AD-2 to a server-enforced rule** (message insert trigger) instead of a client convention. Closes H2, H4.
4. **Add a "data leaves private only through projections" rule.** Closes H5, H11.
5. **Resolve with the product owner:** AD-3 and AD-6 assumptions; FR-7 vs FR-24 (AI assistant on for cyberbullinng rooms but owner can turn it off); FR-37 "messaging disabled while open" and FR-16 "rate before next message" are client rules today and neither is enforced on the server, so a second tab breaks both.

## Not tested

Read-only review of docs; no live SQL queried. Claims about `update_checklist_progress` and the other legacy RPCs rely on sweep 3 s2, which marked their internal authorization UNCONFIRMED. Writer of `rooms.transfer_learning_enabled` is UNCONFIRMED in sweep 1.
