# Client architecture code sweep (tutor-system/src)

Intent: code-evidenced facts for the architecture document. Paths are relative to `tutor-system/src`. UNCONFIRMED marks unverified claims.

## 1. Layering and dependency direction (non-test imports, counted by grep)
- Observed direction: pages -> components, contexts, services, utils, types; components -> contexts, hooks, services, utils, types; contexts -> services, types; hooks -> services, types; services -> types; utils -> services; types -> services.
- Violations:
  - contexts -> components: `contexts/RoomContext.tsx:41` imports `ParameterOverrides` from `../components/AISuggestionBox`.
  - hooks -> contexts: `hooks/useChecklist.ts:11` imports `useOptionalAuth`.
  - types -> services: `types/index.ts:3` imports `SystemPromptConfig` from `services/prompts/types`.
  - utils -> services: `utils/studentAITone.ts:7-8`, `utils/behaviorTestRooms.ts:15`.
  - services -> utils (1 import) is UNCONFIRMED for which file.
  - services use the Supabase client directly, e.g. `services/guardModeService.ts:66-77`.
  - contexts and pages also call `supabase` directly: `contexts/AuthContext.tsx:50-` and `contexts/RoomContext.tsx:872-`.
- Routing is flat: `App.tsx:19-28` uses a HashRouter with `/`, `/student`, `/tutor`, `/tutor/test-rooms`, `/observer`, `/room/:roomId` and `/profile`. There is no route-level role guard in `App.tsx` (UNCONFIRMED whether the individual pages redirect).

## 2. State ownership
- Session identity: `contexts/AuthContext.tsx` (`user`, `loading`). It is mirrored in localStorage key `tutor_system_user` (`AuthContext.tsx:46,103,274,340,378`). The server table `users` is synced on boot (`ensureStoredUserProfile`, `AuthContext.tsx:50-80`), and on sync failure the local copy is kept (`AuthContext.tsx:117-119`).
- Current room, messages, participants, AI assistant state and Guard state: `contexts/RoomContext.tsx:68-108`.
  - `currentRoom`, `messages`, `participants`, `aiConfig`, `loadingAI`, `typingUsers`.
  - `aiSuggestion`, `aiDecision`, `cyberbullyingDraft`, `finalCharacter`, `finalGuardMode`, `currentSuggestionContext`, `aiInteractions`, `messageFeedbackStats`, `transferDraft`.
  - Guard truth is the server column `rooms.guard_mode`, written by `services/guardModeService.ts:60-84` (`.eq('tutor_id', tutorId)`). The composer reads it at `pages/RoomPagePost.tsx:94`.
- Learning progress: `hooks/useChecklist.ts` and `components/ChecklistPanel.tsx`. The server owns the checklist (`ChecklistService`). The client keeps a tutor learning-target draft in localStorage (`hooks/useChecklist.ts:34,192,293,594`, key from `draftStorageKey(roomId)`). A sessionStorage cache of `confirmed-learning-evidence:{room}:{student}` holds completed message IDs (`services/checklistService.ts:166-193`).
- Assessment state: derived from `messages` through the pure adapter `contexts/transferAssessmentUiAdapter.ts` (`projectRoomMessage:211`, `findOpenLearnerAssessment:315`, `mergeRoomMessages:465`). The projection strips the private key before the data enters React state (`RoomContext.tsx:726-728`, `RoomContext.tsx:290-292`).
- Observer-in-room flag: sessionStorage `room-observer:{roomId}`, written at `pages/StudentView.tsx:230,237,270` and `pages/RoomPagePost.tsx:255`, read at `RoomPagePost.tsx:112-115`.

## 3. Identity
- Built in `AuthContext.tsx:19-44` by `generateUserId(displayName, role)`:
  - Name normalization: lowercase, trim, collapse whitespace. Input string is `${normalized}-${role}`.
  - A non-cryptographic 32-bit hash is run 5 times, then formatted as a pseudo-UUID v4.
  - Called at `AuthContext.tsx:181` (offline) and `:202` (join).
- Stored: `users` row (`id`, `display_name`, `current_role`) and localStorage `tutor_system_user`. On join, an existing row has only `current_role` updated (`AuthContext.tsx:222-230`). There is no Supabase Auth session; the supabase client is anon-keyed (`services/supabase.ts:5-6,13`).
- Sent: header `x-application-user-id` is set in `services/aiService.ts:105-107` (cyberbullying operation only, explicit `userId`) and in `services/transferAssessmentService.ts:294-299`. For assessment-api the id is `applicationUserId ?? localStorage tutor_system_user .id` (`:281-290`). The `invokeAiApi` generic call at `aiService.ts:92` sends no such header.
- Role change: `setUserRole` (`AuthContext.tsx:309-345`) updates `current_role` on the same `id`, so the ID stays the same. It does not rehash.
- Rename: `updateUserProfile` (`AuthContext.tsx:349-380`) changes `display_name` only, so the ID stays.
- Consequence: re-joining with a new name or a new role through `joinWithNameAndRole` generates a different ID and therefore a different user. Switching role via `setUserRole` keeps the old ID, which no longer equals `hash(name, role)`. The same name and role on two devices collide into one identity by design.

## 4. Message routing (`contexts/RoomContext.tsx`)
- Trusted server path, `RoomContext.tsx:719-720`. The condition is `user.current_role === 'student' && (currentRoom.practice_type === 'cyberbullying' || options?.assessmentId || (currentRoom.transfer_learning_enabled && transferChecklist?.progress_policy_version === 'transfer_v1'))`.
  - It then calls `transferAssessmentService.postMessage`, followed by `processMessage` if an `assessmentId` is present, otherwise `ChecklistService.analyzeStudentMessages` (`:721-790`).
- Legacy path, `RoomContext.tsx:~839-933`: the browser inserts directly into `messages` (optimistic `temp-` message, `:848-891`, then replaced or removed at `:899-904`).
  - For students it then calls `ChecklistService.processStudentMessage` (`:920-927`), which runs `CoverageDetectionService.analyzeStudentResponse` in the browser (`services/checklistService.ts:502-540`). Coverage detection calls `QwenService` from `aiService`, which invokes `ai-api` (`services/coverageDetectionService.ts:7`).
  - If `transfer_learning_enabled` and the transfer policy is `transfer_v1`, the legacy insert is followed by `analyzeStudentMessages` instead (`:915-919`).
  - The legacy path applies to phishing rooms without a transfer checklist, and to tutor and other messages in all rooms. Tutor and observer sends never take the trusted path (`:682`, `:719`).
- Cyberbullying vs phishing:
  - `x-practice-contract: cyberbullying-v2` is NOT a per-practice branch. It is a static global header on every Supabase client request (`services/supabase.ts:14`).
  - Practice-type branching is scattered if/else, with no single seam. Locations: `RoomContext.tsx:719,795,818,1026,1207,1486`; `services/aiService.ts:883` (`roomData.practice_type === 'cyberbullying'` calls `invokeCyberbullyingOperation` with `operation: 'cyberbullying_suggest'`); `pages/TutorView.tsx:110,196,232-259,268,450-481`; `pages/RoomPagePost.tsx:754,771,902,928,947,1090`.
  - The type `PracticeType = 'phishing' | 'cyberbullying'` is at `types/index.ts:10`. The cyberbullying tutor send goes through `sendReviewedTutorResponse` (`RoomContext.tsx:795-833`).

## 5. Realtime, polling, optimistic updates, errors
- Realtime: channel `room_{id}` with postgres_changes INSERT on `messages` plus broadcast events `typing_start`, `typing_stop`, `message_feedback_changed` (`RoomContext.tsx:189-281`). Typing indicators expire after 5s via a 1s sweep (`:340-345`).
- Polling: `pollMessages` every 2000ms, described as "temporary until real-time replication is available" (`RoomContext.tsx:296-335`). Both paths merge through the idempotent `mergeRoomMessages`. Poll errors are logged and swallowed (`:307-309,328`).
- Optimistic updates: only on the legacy send path (`RoomContext.tsx:848-891`), with rollback by filtering the `temp-` id and rethrowing (`:893-898`). The trusted path is NOT optimistic; it merges the stored row after the server returns.
- Error handling convention:
  - Contexts throw; best-effort side effects are `console.warn` (`RoomContext.tsx:~729,929-931`); `console.log` with emoji is pervasive (e.g. `AuthContext.tsx:103-126`).
  - The room page has `catchUpRoom` retry state (`pages/RoomPagePost.tsx:367-403`).
  - Error codes are embedded in message strings such as `ASSESSMENT_OPTIONS_REQUIRED: ...` (`RoomContext.tsx:699`) and `createTransferPreparationError` (`:967-972`).

## 6. Permissions on the client
- Enforcement is by checking `user.current_role` from AuthContext inside RoomContext actions and the UI. It is not structural.
  - Observers cannot send: `RoomContext.tsx:682`; `CommentInput.tsx:209`; `RoomPagePost.tsx:556`.
  - AI is tutor-only: `RoomContext.tsx:1018,1195,1319,1380,1550`; `RoomPagePost.tsx:557`.
  - The role-reply generator is tutor-only AND owner-only: `RoomContext.tsx:962` (`currentRoom.tutor_id !== user.id`).
  - Learner-only actions: `RoomContext.tsx:1286`; `components/StudentAIToneControl.tsx:35`.
  - Tutor-only settings: `components/AIAssistantSettings.tsx:255,338`; `ChecklistPanel.tsx:334`; `hooks/useChecklist.ts:169`.
  - Export content is role-gated (`contexts/roomExportBuilder.ts:205,283,336`).
- The learner/observer room role is decided by the server `join_room` operation (`transferAssessmentService.ts:339-341`, used at `StudentView.tsx:228,268`). The observer fallback in sessionStorage is client-only.
- The identity is client-asserted (hash plus header, no Supabase Auth). Real enforcement must be server-side. Server verification is UNCONFIRMED here (out of scope for this sweep).

## 7. Edge Function services
- `ai-api`, called from `services/aiService.ts`:
  - `invokeAiApi` (`:91-102`) sends `{body}` and unwraps `data?.data ?? data`. It requires `content: string` and throws `Error('AI Edge Function request failed')`.
  - `invokeCyberbullyingOperation` (`:104-128`) sends `{operation, room_id, ...}` with the `x-application-user-id` header. It reads the error code from `data.error.code` or the `FunctionsHttpError` `error.context.json()`, and validates the draft shape strictly.
  - `aiService.original.ts:13` is a legacy copy, UNCONFIRMED whether it is used.
- `assessment-api`, called from `services/transferAssessmentService.ts`:
  - Envelope: `{ok:true,data} | {ok:false,error:{code,message,retryable}}` (`types/assessmentApi.ts:25-27`), shared with the Edge Function.
  - The request carries `{operation, request_id, ...}` with the operation allowlist `ASSESSMENT_API_OPERATIONS` (`types/assessmentApi.ts:3-14`). The 10 operations are `initialize_checklist`, `join_room`, `edit_learning_progress`, `post_message`, `analyze_message`, `prepare_turn`, `send_reviewed`, `read_review`, `process_message`, `clear_chat_history`.
  - Error mapping, `request()` at `transferAssessmentService.ts:313-331`: parse the HTTP error body, throw `AssessmentApiRequestError{code,message,retryable}`, otherwise a generic `Error`. Stable error codes and status are at `types/assessmentApi.ts:34-53`.
  - DTO projections strip private fields (`PUBLIC_ASSESSMENT_DTO_KEYS`, `types/assessmentApi.ts:55-`).
- Both use `(supabase as any).functions.invoke`, which loses types.

## 8. Naming and file conventions
- Components and pages are PascalCase `.tsx`; services, utils and hooks are camelCase (`useChecklist.ts`, `guardModeService.ts`); tests are in `__tests__/` directories.
- Header comments use `// Purpose:` (e.g. `types/assessmentApi.ts:1`).
- Names are mostly `*Service`; the services directory mixes classes with static methods (`ChecklistService`, `TransferAssessmentService`) and plain functions (`guardModeService`).
- `services/README.md` and `utils/README.md` exist.
- Snake_case is used for DB and API fields, camelCase for UI-facing inputs (e.g. `postMessage` maps `roomId` to `room_id`).
- Indentation is mixed: 4 spaces in `AuthContext.tsx`, `RoomContext.tsx` and `supabase.ts`, versus 2 spaces in `transferAssessmentService.ts` and `useChecklist.ts`. AGENTS.md states 2 spaces.
- `RoomContext.tsx` is 1800 lines; `aiService.ts` 1418; `checklistService.ts` 1255 (`wc -l`).
