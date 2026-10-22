# Extract D — Platform Basics and Executable Behavior

Intent: give the brownfield PRD a source-traced inventory of the platform layer (identity, roles, room discovery/access, chat, student/observer views, export, image upload, platform constraints) as it is specified, tested and actually implemented on 2026-10-22.

Method: read the feature files, their jest-cucumber bindings, the named docs, and the code; inspected the live **production** schema (`zgbufaxooqxeabewktzd`) read-only via Supabase MCP (`pg_policies`, `information_schema.columns`, `pg_indexes`, `has_table_privilege`). No repository file was modified.

Paths below are relative to `tutor-system/` unless they start with `.specify/` or `AGENTS.md`.

Status legend: **current** = feature scenario bound by an existing test AND matching code path; **current (mock-only)** = bound, but the binding mocks the boundary that matters, so it does not prove live behavior; **stale** = source contradicts code/live schema.

BDD binding inventory (all scenarios in each bound file have a matching `test(...)`; none skipped):

| Feature | Binding test | Tag filter | Scenarios bound |
|---|---|---|---|
| features/real_time_chat.feature | src/__tests__/real_time_chat.bdd.test.tsx | none | 7/7 |
| features/student_view.feature | src/__tests__/student_view_steps.test.tsx | none | 12/12 |
| features/observer_view.feature | src/__tests__/observer_view_steps.test.tsx | `@observer-ui` (feature-level, so all) | 13/13 |
| features/chat_history_download.feature | src/__tests__/chat_history_download.bdd.test.tsx | none | 8/8 |
| features/room_discovery.feature | src/__tests__/room_discovery.bdd.test.tsx | none | 12/12 |
| features/tutor_view.feature | src/__tests__/tutor_view.test.tsx | `@tutor-ui` (feature-level) | 5/5 |
| features/ai_openai_integration.feature | **none** | — | 0/10 (orphaned) |

All BDD bindings mock `../services/supabase` and (in most cases) `useAuth`, so they prove UI and context behavior against a fake database boundary, not RLS, Realtime or Storage.

---

## 1. Capabilities

### C1. Join with name and role (application identity)
- **Requirement:** A visitor can enter a display name and choose Student, Tutor or Observer to get an application identity, with no password or email.
- **Testable consequences:**
  1. An empty or whitespace name shows "Please enter your name" and creates nothing (src/components/SimpleLogin.tsx:16-19).
  2. The same normalized name (lower-cased, trimmed, spaces collapsed) plus the same role always yields the same user UUID (src/contexts/AuthContext.tsx:19-45). Different people who type the same name and role become the **same user**.
  3. An existing row is reused and its `current_role`/`updated_at` updated; otherwise a `users` row is inserted (AuthContext.tsx:204-271).
  4. The user object is stored in `localStorage['tutor_system_user']` and restored on reload. On reload the row is re-created if it is missing (AuthContext.tsx:50-82, 98-133).
  5. If the DB connectivity probe fails 3 times (1 s, 2 s back-off), a **localStorage-only "offline" user** is created silently (AuthContext.tsx:176-197).
  6. A user with a role is redirected to `/<role>` from `/` (src/pages/HomePage.tsx:12-16).
- **Legacy source:** docs/simplified-authentication.md; docs/AuthContext.md; README.md:16, 251-252; feature Backgrounds ("a user is authenticated").
- **Evidence:** src/components/__tests__/SimpleLogin.test.tsx, src/contexts/__tests__/AuthContext.test.tsx (exist). No feature file specifies login directly.
- **Status:** current. simplified-authentication.md is **stale** on ID format, capacity and cleanup (see §6).

### C2. Switch role / leave session
- **Requirement:** A signed-in user can change their role (Role Selection or Profile) or "Leave Session", which clears only the local identity.
- **Testable consequences:**
  1. `setUserRole` updates `users.current_role`, then localStorage, and keeps the same user ID. A later fresh join with the new role produces a *different* ID (AuthContext.tsx:309-347 vs 19-45).
  2. There are no role capacity limits (AuthContext.tsx:199, 314).
  3. Sign-out removes `tutor_system_user` and does **not** delete the DB row (AuthContext.tsx:298-307).
  4. Note: RoleSelection is only rendered when `user && !user.current_role` (HomePage.tsx:29), which is unreachable after a normal join because join always sets a role. In practice role switching happens on `/profile` (src/pages/UserProfile.tsx `handleSaveProfile`).
- **Legacy source:** features/tutor_view.feature "Tutor selects their role and sees the dashboard"; features/observer_view.feature "Observer selects their role…"; features/student_view.feature "Student selects their role…".
- **Evidence:** tutor_view.test.tsx, observer_view_steps.test.tsx, student_view_steps.test.tsx (exist; they render the role selection with a mocked auth).
- **Status:** current (mock-only). The role-selection scenarios exercise a screen normal users rarely reach.

### C3. Student discovers rooms
- **Requirement:** A student can see active teaching rooms with title, tutor, description, preview image and live status, and can search them.
- **Testable consequences:**
  1. "Loading rooms..." appears first, then "Available Rooms" (src/pages/StudentView.tsx:357, 389-390).
  2. With no visible rooms: "No rooms available" and "Please wait for a tutor to create a room." (StudentView.tsx:426-429).
  3. Rooms marked `[behavior-test-room]`, rooms titled from test-only `Demo:` templates, and rooms owned by `DemoTutor_*` tutors are hidden (src/utils/behaviorTestRooms.ts; StudentView.tsx:106).
  4. Status is `Available` / `Observer Available` (another student holds the active seat) / `Your Session`, with buttons `Join Room` / `Observe Room` / `Rejoin Room` (StudentView.tsx:106-118).
  5. A room create/update or a `sessions` change triggers a refetch through Realtime subscriptions, which are set up after a 3 s delay (StudentView.tsx:140-188).
  6. A client-side search filters by title or description (StudentView.tsx:404-411). No feature scenario covers this.
- **Legacy source:** features/student_view.feature (all 12 scenarios); features/room_discovery.feature "Student views available rooms", "Student sees waiting message…", "Room list updates in real-time", "Student sees room status change in real-time", "Room displays preview image", "Student does not discover behavior-test…", "Student still discovers classic teaching rooms…".
- **Evidence:** student_view_steps.test.tsx; room_discovery.bdd.test.tsx; src/pages/__tests__/StudentView.roomVisibility.test.tsx; src/utils/__tests__/behaviorTestRooms.test.ts (all exist).
- **Status:** current. Live room discovery depends on Realtime publication for `rooms`/`sessions`, which no test checks.

### C4. Student takes the learner seat (one learner per room)
- **Requirement:** A student can join an active room as its single learner. If another student already holds the seat, they enter as a read-only observer.
- **Testable consequences:**
  1. The DB enforces one active learner per room: unique index `sessions_one_active_learner_per_room` on `(room_id) WHERE status='active' AND student_id IS NOT NULL` (live schema).
  2. The trusted path is `transferAssessmentService.joinRoom` (Edge `assessment-api`), which returns `room_role: 'student'|'observer'` (src/services/transferAssessmentService.ts:343).
  3. If the trusted join fails, the code **falls back** to a direct `sessions` insert. If the room is occupied, the student is sent in read-only mode anyway (StudentView.tsx:227-240, 274-276).
  4. A `23505` on insert results in "This room is full. Another student has joined." with the card set to `Room Full`. Other insert errors show "Failed to join the room: <message>" (StudentView.tsx:283-317).
  5. Read-only mode is passed to the room page through `sessionStorage['room-observer:<roomId>']`, which is consumed once (src/pages/RoomPagePost.tsx:110-117).
  6. **No code ends a student session.** Leaving the room or signing out never sets `sessions.status` to anything else, so a seat is held until someone changes it outside the app (no `ended_at` write in RoomContext/StudentView).
- **Legacy source:** student_view.feature "Student joins a room successfully", "Student sees a room is full", "Student fails to join a room due to an error"; room_discovery.feature "Student joins an available room", "Student can observe an occupied room".
- **Evidence:** student_view_steps.test.tsx; room_discovery.bdd.test.tsx; src/pages/__tests__/StudentView.roomCapacity.test.tsx; RoomPagePost.directJoin.test.tsx.
- **Status:** current (mock-only). The "Insert failed" scenario only fires through the legacy fallback path.

### C5. Password-protected room entry
- **Requirement:** A tutor can set a room password. Non-owners must enter it before the room loads, and the owner bypasses it.
- **Testable consequences:**
  1. Without a password, the room page shows "Password Required" (RoomPagePost.tsx:633-670; src/contexts/RoomContext.tsx:481-496).
  2. A wrong password shows "Incorrect password. Please try again." and the prompt stays open.
  3. The owner (`user.id === rooms.tutor_id`) is not prompted.
  4. The check runs **in the browser**: `validateRoomPassword` selects the plaintext `rooms.password` column, which anon can read (src/services/supabase.ts:170-197; live policy `Allow room operations` ALL/true).
- **Legacy source:** features/room_management.feature (not in this extract's scope); TutorView.tsx:654-675 copy.
- **Evidence:** src/pages/__tests__/RoomPagePost.password.test.tsx; room_management.bdd.test.tsx.
- **Status:** current as UX. As access control it is **not effective**, because the password is readable by any client.

### C6. Observer discovers and enters rooms
- **Requirement:** A user with the Observer role can list all active rooms and open any of them read-only.
- **Testable consequences:**
  1. Lists every `is_active` room with its tutor. Unlike the student list, **no test/harness filtering** is applied (src/services/supabase.ts:246-263; src/pages/ObserverView.tsx:34-43).
  2. Join verifies the room is active and that the user's `current_role='observer'`, then navigates. No membership row is written (supabase.ts:265-302).
  3. A join failure shows "Failed to join the room. Please try again." (ObserverView.tsx:82-85).
  4. Layout classes are `mobile-layout` below 768 px, `tablet-layout` from 768 to 1023 px, and `desktop-layout` at 1024 px and above. The room list uses a grid on desktop and a list otherwise (ObserverView.tsx:88-91, 126).
  5. The room list refreshes on `rooms` Realtime changes (ObserverView.tsx:49-64).
  6. Room fetch errors are swallowed: no error is shown, and the result is an empty list that reads as "No rooms available" (ObserverView.tsx:38-42).
- **Legacy source:** observer_view.feature scenarios 1-5, 8, 10-12; room_discovery.feature "Observer views available rooms", "Observer joins a room as read-only", "Multiple observers can join the same room".
- **Evidence:** observer_view_steps.test.tsx; room_discovery.bdd.test.tsx.
- **Status:** current, except that "Multiple observers… I should see '4 observers'" is **stale** (see §6). Observers see harness rooms, and no source says whether that is intended.

### C7. Read-only observation inside a room
- **Requirement:** An observer, or a student entering an occupied room, can watch the conversation live but cannot post.
- **Testable consequences:**
  1. The composer and send button are absent when `current_role==='observer'` or room-observer mode is set (RoomPagePost.tsx:556).
  2. A notice reads "👁️ You are in observer mode. You can view the conversation but cannot participate." (RoomPagePost.tsx:989-991).
  3. The context also rejects sends when `current_role==='observer'` ("Observers cannot send messages") (RoomContext.tsx:681-683). A student in room-observer mode is blocked **only by the UI**, not by the context.
  4. Messages carry role labels (Tutor/Student).
- **Legacy source:** real_time_chat.feature "Observer has read-only access to the chat"; observer_view.feature "Observer has a read-only view of the chat", "Observer sees the conversation unfold in real-time", "Observer sees clear indication of read-only status in room".
- **Evidence:** real_time_chat.bdd.test.tsx; observer_view_steps.test.tsx.
- **Status:** current (UI only). The server does not enforce it: the live `messages` policy is ALL/true for `public`.

### C8. Real-time chat between tutor and student
- **Requirement:** Tutor and student can exchange messages in a room, and every participant sees new messages without refreshing.
- **Testable consequences:**
  1. Delivery uses a Realtime `postgres_changes` INSERT subscription on `messages` filtered by room, **plus** 2 s polling of the full room history (RoomContext.tsx:189-200, 286-336).
  2. A new message appears for the other party within about 2 s (feature "within 2 seconds" is bounded by the polling interval).
  3. History persists: leaving and re-entering shows all prior messages (`joinRoom` reloads `messages`).
  4. Messages sent while the receiver is offline appear after reconnect, through the next poll.
  5. Rows are projected through an allowlist (`projectRoomMessage`) before entering React state (src/contexts/transferAssessmentUiAdapter.ts:211).
  6. Student messages in cyberbullying or transfer-enabled rooms go through the trusted `assessment-api` `postMessage`. Ordinary messages use a direct insert (RoomContext.tsx:719-740).
- **Legacy source:** real_time_chat.feature "Tutor and Student can exchange messages", "Messages appear immediately without page refresh", "Chat history is preserved", "Offline message synchronization"; tutor_view.feature "Tutor enters and interacts in a room".
- **Evidence:** real_time_chat.bdd.test.tsx (mocks the network and polling flag; "offline" is simulated by the `mockNetworkConnected` flag); tutor_view.test.tsx.
- **Status:** current (mock-only for latency and offline behavior).

### C9. Typing indicators
- **Requirement:** Tutor and student can see when the other is typing.
- **Testable consequences:**
  1. A non-empty composer broadcasts `typing_start` on channel `room_<id>`. Clearing it, or 3 s without input, broadcasts `typing_stop` (RoomContext.tsx:1431-1475).
  2. The peer sees "<Name> is typing..." in the comments list, and the indicator clears on stop. Stale indicators are cleaned up periodically (RoomContext.tsx:338-350).
- **Legacy source:** real_time_chat.feature "Typing indicators are shown between tutor and student".
- **Evidence:** real_time_chat.bdd.test.tsx.
- **Status:** current. The feature has a typo in its last step: "should not see a typing indicator for the student" when it means the tutor. The binding asserts both.

### C10. Message rating (required before the next student reply)
- **Requirement:** A student must rate the latest persisted tutor/AI response (thumbs up or down plus 1-5 stars) before sending their next reply, and the tutor and observers see the counts update live.
- **Testable consequences:**
  1. Ratings are stored by upsert on `(message_id, user_id)` (unique index `unique_user_message_feedback`). A rating outside 1-5 is rejected (supabase.ts:611-652).
  2. Changing a rating replaces the previous one.
  3. A `message_feedback_changed` broadcast updates tutor and observer counts without refresh (RoomContext.tsx:253, 1720).
  4. Pre-populated (`prepop-`) and `temp-` messages are never rating targets (supabase.ts:657-670; README.md:30).
- **Legacy source:** real_time_chat.feature "Message feedback appears immediately without page refresh" (and the rating steps embedded in the other chat scenarios); README.md:30.
- **Evidence:** real_time_chat.bdd.test.tsx.
- **Status:** current.

### C11. Download chat history / room export
- **Requirement:** Any participant can download the room as TXT or JSON. Tutors additionally receive AI-interaction data, and learners receive only their own assessment lifecycle.
- **Testable consequences:**
  1. A download button (title "Download Chat History") is shown to every role. Its modal offers "Chat History (TXT)", "Complete Data (JSON)" and "Cancel" (RoomPagePost.tsx:763-769, 1103-1135).
  2. File names are `<Title_with_underscores>_chat_history_<YYYY-MM-DD>.txt` and `<Title>_chat_export_<YYYY-MM-DD>.json` (RoomContext.tsx:1478-1539).
  3. JSON contains `room{id,practice_type,scenario_config,guard_mode,title,created_at}`, `messages[]` with `id`, `user_id`, `user_role`, `display_name`, `content`, `created_at` and `feedback_stats`, `participants[{id,display_name,role}]`, and `export_metadata` (src/contexts/roomExportBuilder.ts:272-346).
  4. Only the tutor role gets `ai_interactions`, `room.ai_enabled/ai_model`, `total_ai_interactions`, and the TXT "AI Assistant Summary" (accepted/modified/rejected/ignored percentages).
  5. Assessment questions are exported from the public projection only (no answer key). `answer_lifecycle` is attached only when the exporter is the student the question targets (roomExportBuilder.ts:80-119).
  6. In cyberbullying rooms, JSON includes `learning_progress`. A student gets their own checklist, and **every other role, including observers, gets the room's active transfer checklist** (RoomContext.tsx:1486-1490). TXT never includes learning progress (the value is computed but not passed).
- **Legacy source:** chat_history_download.feature (all 8 scenarios); observer_view.feature "Observer downloads the chat history"; tutor_view.feature "Tutor downloads chat history from the room"; README.md:31, 257.
- **Evidence:** chat_history_download.bdd.test.tsx; src/contexts/__tests__/roomExportBuilder.test.ts, roomExportBuilder.transfer.test.ts, RoomContext.roleBasedExport.test.tsx.
- **Status:** current. Note that the role used is the global `current_role`, not the room role.

### C12. Clear chat history (tutor owner)
- **Requirement:** The tutor who owns a non-cyberbullying room can clear its messages after an automatic JSON backup download. Pre-populated dialogue is kept.
- **Testable consequences:**
  1. The button is visible only to tutors (`canUseAI`) in non-cyberbullying rooms (RoomPagePost.tsx:771-779).
  2. The service checks that the user's role is tutor and that the user owns the room, then calls the trusted `transferAssessmentService.clearChatHistory` (supabase.ts:802-855).
  3. A JSON backup is downloaded first. If the backup fails, the user must confirm before clearing.
- **Legacy source:** docs/supabase-service.md "Chat History Management".
- **Evidence:** RoomContext tests (no feature file).
- **Status:** current (the ownership check runs client-side before the trusted call).

### C13. Image upload (avatar and custom room image)
- **Requirement:** A user can upload a custom avatar, and a tutor can upload a custom room image (JPEG/PNG/GIF/WebP, ≤5 MB, avatar ≤512×512, room ≤800×600). Preset avatars and preset room images are also available.
- **Testable consequences:**
  1. Client validation rejects the wrong type or extension, more than 5 MB, or out-of-range dimensions (src/services/imageUpload.ts:14-84).
  2. Upload first calls `supabase.auth.getUser()` and returns "User not authenticated" when there is no Supabase Auth session (imageUpload.ts:114-117, 247-250). **No Supabase Auth session exists in this app**, so custom uploads always fail in production.
  3. The live storage policies require `auth.uid()` for `avatars` insert, `tutor-images` manage and `room-images` all, so Storage would refuse the upload as well.
  4. The custom room-image upload is rendered with `roomId="temp-room-id"` before the room exists (src/pages/TutorView.tsx:546-553), so even with auth the ownership lookup would fail.
  5. Preset room images (`/images/room-presets/*.png`) and preset avatars (profile page) work because no upload is involved. Room cards render `room.image_url` (src/components/RoomCard.tsx:31-33).
- **Legacy source:** README.md:130 "Role-based uploads: Only tutors can upload images"; docs/supabase-service.md "Avatar System"/"Tutor Image Management"; room_discovery.feature "Room displays preview image"; tutor_view.feature "Tutor creates a new room" ("select a predefined image").
- **Evidence:** src/services/__tests__/imageUpload.test.ts and imageServices.test.ts mock `auth.getUser` to return a user (imageUpload.test.ts:6, 30), which masks the defect; src/components/__tests__/ImageUpload*.test.tsx.
- **Status:** preset images **current**; custom upload **stale/broken** (tests green, behavior impossible in production).

### C14. Tutor dashboard and room creation (platform slice only)
- **Requirement:** A tutor can create a room (title, description, preset or custom image, optional password) and is taken into it. The dashboard lists the tutor's own non-test rooms with "Enter Room".
- **Testable consequences:** `createRoom` inserts with `is_active=true` and navigates to `/room/<id>` (TutorView.tsx:349). `getRoomsByTutor(user.id)` lists the rooms (TutorView.tsx:73). Behavior-test rooms are moved to `/tutor/test-rooms`.
- **Legacy source:** tutor_view.feature (5 scenarios).
- **Evidence:** tutor_view.test.tsx; TutorView.modal.test.tsx.
- **Status:** current. Room configuration details belong to other extracts.

### C15. Profile management
- **Requirement:** A user can change display name, role and avatar (preset or upload) on `/profile`.
- **Consequences:** display name and role update both `users` and localStorage (AuthContext.tsx:349-385). Changing the display name does **not** change the deterministic ID, so a later fresh join with the new name creates a different user.
- **Evidence:** src/pages/__tests__/UserProfile.test.tsx. No feature file.
- **Status:** current, except avatar upload (see C13).

---

## 2. Roles and permissions matrix (from code)

"UI" = enforced only in the browser. "Ctx" = enforced in React context/service code. "Srv" = enforced by the DB or an Edge Function. Live RLS on `users`, `rooms`, `sessions`, `messages` and `message_feedback` is `ALL USING true` for role `public`, and anon has SELECT/INSERT/UPDATE/DELETE on all five. Every UI/Ctx rule can therefore be bypassed by any client holding the public anon key.

| Capability | Tutor | Student | Observer | Enforcement |
|---|---|---|---|---|
| Landing route | `/tutor` | `/student` | `/observer` | UI (HomePage redirect). No route guards in src/App.tsx, so any role can open any route |
| See room list | own rooms (`getRoomsByTutor`), test rooms at `/tutor/test-rooms` | active rooms minus test/harness rooms | all active rooms (harness included) | UI |
| Create/delete room | yes (`deleteRoom` warns on owner mismatch but proceeds, supabase.ts:222-225) | no UI | no UI | UI only |
| Enter room | any room. Owner skips password, non-owner must enter it | takes the seat if free, else read-only | read-only. Join requires `current_role='observer'` | Srv: one-learner unique index. Rest UI/Ctx |
| Send message | yes, in any room (no owner check on send) | yes, when holding the seat. Assessment answers go through `assessment-api` | no | Ctx (observer), UI (room-observer student), Srv only on the assessment path |
| Rate tutor/AI message | — | required before the next reply | sees counts | UI/Ctx |
| AI assistant, guard mode, checklist panel | yes when `current_role==='tutor'` (`canUseAI`), **in any room**. Cyberbullying role-reply generation requires room ownership (RoomContext.tsx:962) | no | no | UI/Ctx |
| Clear chat history | room owner, non-cyberbullying | no | no | Ctx + trusted Edge call |
| Download TXT/JSON | yes, plus AI interactions and AI summary | yes, without AI data. Own `answer_lifecycle` | yes, without AI data. Gets the room learning-progress checklist in cyberbullying rooms | Ctx (export builder) |
| Change own role/name | yes | yes | yes | none: anyone can update any `users` row |
| Assessment private data (answer keys, transfer basis, attempts) | via `assessment-api` only | via `assessment-api` only | none | **Srv**: tables are outside `public` (e.g. `transfer_assessments`), and RPCs are SECURITY DEFINER and not executable by anon (given fact) |

---

## 3. Platform-wide constraints / NFRs

| ID | Constraint | Source |
|---|---|---|
| NFR-1 Identity model | No Supabase Auth. The identity is a self-asserted application user ID (deterministic hash of name and role) kept in `localStorage['tutor_system_user']` and sent to Edge functions as `x-application-user-id`. It **identifies but does not authenticate**. Accepted risk: anyone who types the same name and role becomes that user (including a tutor who owns rooms), and anyone holding the anon key can read and write `users/rooms/sessions/messages/message_feedback` directly. | .specify/memory/constitution.md:11, 26; docs/supabase-service.md:19; AuthContext.tsx:19-45; src/services/transferAssessmentService.ts:284-298; live pg_policies |
| NFR-2 Server authority | Authorization for assessment, private assessment data, answer keys, idempotency and progress transitions MUST be server-authoritative. The Edge function resolves the header ID against DB role and room membership. Must not introduce Supabase Auth or depend on `auth.uid()` for assessment. | constitution.md:11, 26 |
| NFR-3 Privacy of private data | Public DTOs/exports MUST exclude private drafts, keys, rationale, transfer basis and raw model output. The client applies an allowlist projection, and exports read only the public question projection. Private assessment tables live outside the anon-accessible `public` schema. Provider credentials are kept only as Edge secrets and never sent to the bundle. | constitution.md:11; roomExportBuilder.ts:40-43; README.md:166 |
| NFR-4 Realtime | Chat, ratings and typing update without refresh. Chat uses Realtime INSERT plus a 2 s poll, so new messages appear within about 2 s. Dashboards refetch on `rooms`/`sessions` changes (student subscriptions start after 3 s). Client Realtime is capped at 10 events/s. | real_time_chat.feature:22-30; RoomContext.tsx:329-330; supabase.ts:20-24 |
| NFR-5 Reload persistence | Identity survives reload (localStorage). Deep links survive refresh through `HashRouter`. Room history is re-read from the DB on entry. Room-observer mode is **not** reload-persistent: the sessionStorage flag is removed on first read. | README.md:252; docs/README.md:168-170; RoomPagePost.tsx:110-117 |
| NFR-6 Degradation | Several paths contain silent fallbacks: offline local-only user on DB failure; legacy direct session insert when the trusted join fails; read-only entry when the trusted observer join fails; student list "offline mode" on fetch failure; observer list errors swallowed. | AuthContext.tsx:176-197; StudentView.tsx:90-96, 227-240, 274-276; ObserverView.tsx:38-42 |
| NFR-7 Form factor | Responsive on mobile and desktop. Observer dashboard breakpoints are 768 and 1024 px. A responsive claim exists for students, but only the observer view is tested. | observer_view.feature:73-83; student_view.feature:6; README.md:32 |
| NFR-8 Accessibility | Only weak, implicit coverage: headings visible, error `role="alert"` on the student dashboard. No stated WCAG target. | observer_view_steps.test.tsx:795-800; StudentView.tsx:359 |
| NFR-9 Browsers | CRA browserslist production `>0.2%, not dead, not op_mini all`. | package.json:64-69 |
| NFR-10 Platform | React + TypeScript + Supabase. No Docker. Frontend env limited to `REACT_APP_*`. Two hosted environments: production `zgbufaxooqxeabewktzd`, staging `ciubrzggdqesgvfkpolj`. | constitution.md:24-25; AGENTS.md (Tool Restrictions, Security) |
| NFR-11 Assessment kill switch | `TRANSFER_ASSESSMENT_ENABLED` defaults to `true`. Rollback disables new generation and delivery without deleting evidence. | constitution.md:27-28 |
| NFR-12 Images | JPEG/PNG/GIF/WebP, ≤5 MB. Avatar ≤512×512, room image ≤800×600. | imageUpload.ts:15-17; UserProfile.tsx:395; TutorView.tsx:552 |

---

## 4. Non-goals stated in sources

1. No account creation, email or password sign-in, or email verification ("eliminates the need for email/password sign-up and sign-in"): docs/simplified-authentication.md:5, 36-39.
2. No role capacity limits ("users can join with any role"): AuthContext.tsx:199, 314; docs/AuthContext.md:75; docs/README.md:210. This contradicts README.md:24, 129 (see §6).
3. The simplified identity model is explicitly not for "user verification, secure authentication, audit trails, access control enforcement": docs/AuthContext.md:79-84; docs/README.md:214-219 ("not suitable for production"). This conflicts with the app being used in schools; see §7.
4. No Supabase Auth or `auth.uid()` for transfer assessment: constitution.md:26.
5. Observers do not participate in chat: observer_view.feature:3-6.
6. Observers need no session record: supabase.ts:294.
7. "Future enhancements" (not built): persistence across browser sessions, room access codes, admin override for capacity, activity tracking: simplified-authentication.md:80-85.
8. No rate limiting, limited audit logging: docs/README.md:216-219; docs/supabase-service.md:271-275.

---

## 5. Glossary (with drift)

| Term | Definition (from code) | Drift |
|---|---|---|
| **User** | A `public.users` row `{id, email?, display_name, current_role, status, avatar_url}`. The ID is a deterministic hash of name and role. | simplified-authentication.md:21 says `user_<ts>_<rand>` (stale). One person switching role keeps the old ID, but re-joining creates a new one. |
| **Role** | `current_role` ∈ {student, tutor, observer}. A **global** attribute of the user, not of the room. | Distinct from **room role** (below). Exports and UI use the global role. |
| **Room role** | The per-room role returned by `assessment-api` joinRoom: `student` (seat holder) or `observer`. | Only conveyed client-side by a one-shot sessionStorage flag. |
| **Room** | A tutor-created `rooms` row: title, description, image, optional plaintext password, AI/guard/practice configuration, `is_active`. | Rendered as a social "post" with "comments" (RoomPagePost, RoomPost, PostComment), while the features call it a chat room. |
| **Session (seat)** | A `sessions` row `{room_id, tutor_id, student_id, status}`. At most one active student per room. | "Session" also means the local login ("Join Session", "Leave Session") and README "Session: identity restored". This is an overloaded term. |
| **Learner / seat holder** | The student holding the active session of a room. | Feature text says "room is full", while code shows "Observer Available" plus "Observe Room" (student_view.feature:40-45 already matches the code). |
| **Observer** | (a) a user whose global role is observer, or (b) a student in read-only room mode. | room_discovery.feature counts observers ("4 observers"), but nothing persists observers. |
| **Message / comment** | A `messages` row. Public projection fields plus assessment metadata columns (`assessment_*`, persona, guard). | The UI calls them comments ("Write a comment...", "Send comment"). |
| **Pre-populated dialogue** | Scripted messages stored in `rooms.pre_populated_dialogue`, given `prepop-*` IDs, never persisted as rows. | Not ratable, and survives Clear. |
| **Rating / feedback** | A `message_feedback` row (like/dislike plus 1-5 stars), one per user per message. | |
| **Export / download** | A TXT or JSON file built client-side (roomExportBuilder). | docs/supabase-service.md describes the older `downloadChatHistory` in supabase.ts (filename `chat-history-<roomId>-<date>.json`), which no UI calls (stale). The modal label "Complete Data (JSON)" differs from the feature's "JSON". |
| **Behavior-test / harness room** | A room with the `[behavior-test-room]` marker, a test-only `Demo:` title, or a `DemoTutor_*` owner. Hidden from students and the tutor's main list. | Not hidden from observers. |
| **Offline mode** | A local-only user created when the DB is unreachable. Also the student-dashboard error state. | Two unrelated meanings. |

---

## 6. Conflicts between docs and code

1. **Orphaned feature:** features/ai_openai_integration.feature (10 scenarios, tag `@ai-qwen`, last touched 163db34 2026-10-03) is loaded by **no** test. The only repository reference is docs/doc_update_record/documentation_update_record_v2026_07_18_default_model_gpt4o_mini.md:17. Its "debug dummy suggestion generator" and "QwenService" steps describe a client-side provider that README.md:166 says no longer exists (credentials are Edge-only).
2. **Capacity limits:** README.md:24 "Capacity Management: 1 tutor + 1 student maximum" and README.md:129 "Capacity limits: Automatically enforced via application logic", and docs/simplified-authentication.md:14, 22, 45, 69 ("subject to capacity limits", "Still enforces 1 tutor + 1 student"), contradict AuthContext.tsx:199, 314 ("No capacity limits"). The only real limit is one active learner per room (DB index). Tutors per room are not limited.
3. **User ID format:** simplified-authentication.md:21 `user_1234567890_abc123def` vs AuthContext.tsx:19-45, which uses a deterministic UUID-shaped hash.
4. **Sign-out deletes the user:** simplified-authentication.md:46, 68 ("removes from database") vs AuthContext.tsx:298-307 ("Don't delete user from database").
5. **"Role-based permissions enforced at the database level" / RLS as access control:** README.md:118, 127-128 vs live policies `ALL USING true` for `public` on users/rooms/sessions/messages/message_feedback. docs/README.md:31 also lists "Auth" in the tech stack, but no Supabase Auth is used.
6. **Image upload:** README.md:130 and docs/supabase-service.md:154-172 present working avatar and tutor-image uploads. The code requires `supabase.auth.getUser()` (imageUpload.ts:114, 189, 247, 342), live storage policies require `auth.uid()`, and TutorView passes `roomId="temp-room-id"` (TutorView.tsx:553). Unit tests mock `auth.getUser` (src/services/__tests__/imageUpload.test.ts:6, 30), so they pass while production cannot upload.
7. **"N observers" display:** room_discovery.feature:71-79 expects "4 observers". `observer_count` is not a column on live `rooms` and is never populated (only src/types/index.ts:81 and src/components/RoomPost.tsx:114-118). The binding passes only by seeding a mock `observer_count` (room_discovery.bdd.test.tsx:340-363).
8. **docs/supabase-service.md stale export:** "Chat History Export (Lines 351-399)" describes supabase.ts:357-405, which is unused. The real export is in RoomContext.tsx:1478 plus roomExportBuilder.ts, with different filenames, content and role gating.
9. **Line references drift:** docs/AuthContext.md:15, 27, 37, 41 cite line ranges (16-42, 90-251, 253-262, 264-302) that no longer match (19-45, 135-296, 298-307, 309-347). docs/supabase-service.md uses similar stale line ranges.
10. **docs/README.md:260** "AI uses last 10 messages" vs README.md:27, where full conversation context is paged. docs/README.md:150 "OpenAI API with dummy service fallback" is stale.
11. **README roadmap:** README.md:134-146 marks Tasks 4-12 (discovery, chat, download, views) as not done, although all are implemented and BDD-bound.
12. **README database setup:** README.md:74 and docs/README.md:107 point to `supabase/migrations/001_initial_schema.sql` and `env.example`. `tutor-system/supabase/migrations/` does not exist in this worktree, and the file is `.env.example`.
13. **tutor-system/AGENTS.md** says step definitions live in `src/__tests__/step_definitions/` and that `npm run test:bdd` is "room management BDD". In fact only two checklist step files live there, the BDD bindings are `src/__tests__/*.bdd.test.tsx` / `*_steps.test.tsx`, and `test:bdd` (package.json:27) covers student/observer/tutor/tone/persistence plus `*.bdd.test` files.
14. **Role selection reachability:** three features start "Given the user is on the role selection page… selects the X role", but HomePage.tsx:29 shows RoleSelection only when the user has no role, which a normal join never produces.
15. **Observer list vs discovery hide rules:** room_discovery.feature:104-123 hides harness rooms only for students. ObserverView applies no filter, so observers see `Demo:`/`DemoTutor_*` rooms. The intent is unstated.
16. **docs/supabase-service.md:23** says `OAI_MODEL=qwen3.5-flash` is used for tutor responses, while README.md:163-166 says tutoring uses Qwen3.8 from aiModels.ts and `OAI_MODEL` is for offline evaluations only. This is outside this extract's scope but is the same doc family.
17. **Minor feature/UI wording:** features say "Download History" button / "TXT"/"JSON" options. The UI uses an icon button titled "Download Chat History" and options "Chat History (TXT)"/"Complete Data (JSON)". real_time_chat.feature:63 has a typo ("for the student" should be "for the tutor").

---

## 7. Open questions

1. **Identity risk acceptance for schools:** the docs call the model "not suitable for production", yet it is in production with schools. Should the PRD keep "identifies but does not authenticate" as an explicitly accepted risk, and with what boundary? For example: any client can read room passwords and every message, rewrite any user's role, or impersonate a tutor by typing the tutor's name.
2. **Name collisions:** two students named "Alex" become one user ID. Is that intended (cross-device continuity) or a defect? Should identity include a room or class code?
3. **Room password semantics:** should the PRD require the password to be verified server-side and hidden from clients, or treat it only as a UX gate?
4. **Seat release:** no code path ends an active student session. When should a seat free up (leave, sign-out, timeout, tutor action)?
5. **Custom image upload:** retire it (keep presets only) or redesign it for application identity? Today it is shown in the UI but cannot succeed.
6. **Observer data scope:** should observers (global role, or students in read-only mode) receive the room's learning-progress checklist in JSON exports of cyberbullying rooms (RoomContext.tsx:1486-1490)? Should observers see harness rooms?
7. **Tutor scope:** should any tutor-role user get tutor controls (AI assistant, guard mode, checklist panel, sending as tutor) in rooms they do not own? Today only cyberbullying role-reply generation and clear-history check ownership.
8. **Room role vs global role:** should exports and UI gating use the per-room role from `assessment-api` instead of the global `current_role`? Room-observer mode is currently lost on reload.
9. **Silent fallbacks:** should the offline local-only login and the legacy direct-insert join be kept? They conflict with the constitution's "no silent fallbacks" (constitution.md:20).
10. **"N observers" and observer presence:** is observer counting a requirement? If so, it needs persistence or Realtime presence. If not, drop the scenario.
11. **ai_openai_integration.feature:** delete it, or rewrite it against the Edge-function provider contract and bind it?
12. **Accessibility target:** no WCAG level is stated anywhere. Should the PRD set one, given school use?
