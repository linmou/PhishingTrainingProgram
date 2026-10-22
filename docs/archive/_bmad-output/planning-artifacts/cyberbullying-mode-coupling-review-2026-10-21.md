# Cyberbullying practise: architectural coupling review

Intent: identify existing phishing assumptions and the smallest boundaries needed to add tutor-supervised Cyberbullying practise.

Reviewed and revised after user feedback: 2026-10-21. Local source baseline: `2807c52f3b3ee82f1e708b20740726a7a28e3912`.
Reviewer: Winston / BMAD Architect.
Method: source tracing, four focused mocked test suites, and read-only Supabase MCP catalog queries against production `zgbufaxooqxeabewktzd`. Staging and deployed Edge source were not inspected. This is an architectural review with local deterministic evidence, not a live journey verification. The user explicitly scoped this turn to review.

## Intended experience

The tutor chooses Cyberbullying practise and a SocialMediaCopilot scenario. All scenarios use the same five learning targets, with progress updated from the student's contributions. Each AI generation proposes one character and one complete message. The tutor reviews the proposal, can change the character or edit the text, and sends the approved message. The tutor can also reject or regenerate a proposal using the Cyberbullying configuration. Response ratings remain part of the shared workflow.

The tutor's learning-progress panel shows target status and supporting student evidence. History preserves scenario context, character identity, AI suggestions, tutor decisions, and learning-progress updates.

Use `practice_type: 'phishing' | 'cyberbullying'` for subject identity and `guard_mode: boolean` for Guard participation state. These are independent properties. In future implementation, proposed and approved Guard decisions can use `raw_guard_mode` and `final_guard_mode`. Existing message categories and assessment metadata carry separate meanings; converting Guard to a boolean is not a blind replacement of every field containing the word mode.

Shared targets:

1. Recognize cyberbullying and its impact.
2. Show empathy and support.
3. Stand up constructively.
4. Avoid reinforcing bullying.
5. Choose a safe next step.

## Dependency map

Paths below are relative to `tutor-system/`; line numbers refer to the reviewed baseline. “Boundary” means shared infrastructure with activity-specific behavior.

| Area | Classification | Observed evidence | Minimum adaptation |
| --- | --- | --- | --- |
| Room and template identity | Boundary | `src/types/index.ts:33` and `:59` have no activity discriminator. `src/services/supabase.ts:92` creates rooms without one. `src/pages/TutorView.tsx:200` copies scenario fields and later regenerates template prompts. Live `rooms` and `room_templates` confirm no activity column. | Add `practice_type` to rooms and templates. Replace the participation-state enum with `guard_mode: boolean` consistently across prompts, types, review records, RPCs, and room state. |
| Scenario presentation | Shared with data adaptation | Room fields already support description, image, original poster, and initial dialogue. `src/contexts/RoomContext.tsx:510` maps initial comments to synthetic messages with a name and role, but omits character avatar data. | Map original post, image, initial comments, and character profiles explicitly. Preserve stable scenario and character IDs so display and AI context agree. |
| Prompt and decision generation | Phishing-specific | `src/services/prompts/activeTutorAgentPrompt.ts:13` explicitly teaches phishing. `src/services/aiService.ts:625` builds the ecological tutoring request and parses a tutor-mode/instruction decision. `:665` forces single-agent interaction. | Add a Cyberbullying prompt, context formatter, and response validator, selected before entering the phishing generation path. One role-playing model call selects a character and drafts one complete reply, published as one approved message. |
| Model transport | Shared | `supabase/functions/ai-api/index.ts:1` proxies generic chat messages and JSON output using server credentials. It currently fixes the provider model through `DEFAULT_AI_MODEL` and bounds request size. | Reuse this transport initially. Record model and generation parameters; using the platform model differs from the original Copilot model and needs a scenario smoke check. |
| Learning-target UI and storage | Shared workflow with subject-specific targets | `src/types/checklist.ts:10` models target status, evidence, understanding, attempts, and completion. `src/components/ChecklistPanel.tsx:596` offers a General Scam Indicators template in the legacy path. The panel is mounted for every tutor room at `src/pages/RoomPagePost.tsx:1227`. | Initialize the same five Cyberbullying targets for each learner's room progress. Reuse progress storage and the tutor panel, with target labels and initialization selected by practice type. |
| Message analysis and suggestion preparation | Boundary | `src/contexts/RoomContext.tsx:697` fetches checklists when sending messages. `:890` falls through to legacy `processStudentMessage` when transfer analysis is inactive. `:1035` checks target readiness and `:1080` prepares a transfer candidate before generating a normal response. Live `rooms.transfer_learning_enabled` defaults to true. | Separate progress analysis from subsequent response preparation. Cyberbullying student messages update target progress; tutor generation invokes the role-playing service. Review the analyzer prompt and progress transitions for subject assumptions before reuse. |
| Human review and atomic persistence | Shared workflow with a data extension | `src/services/guardModeService.ts:30` invokes `send_reviewed_tutor_response`. Live RPC inspection confirms it validates tutor instructions, stores the response plus feedback, and changes room participation state. `src/contexts/RoomContext.tsx:786` relies on that contract. | Inherit the existing workflow and extend its payload/transaction for original and final character. Keep original/final text, tutor identity, and approval logging. Adjust validation by practice type; a separate approval workflow is unnecessary. |
| Character identity | Boundary plus legacy cleanup | `src/services/tutorDecisionContract.ts:26` accepts only Riley/Tutor tags; `src/utils/messagePresentation.ts:44` renders those identities. Live messages have no dedicated character field. The deprecated approval path at `src/contexts/RoomContext.tsx:1335` directly inserts tagged messages without the normal feedback transaction. Active generation rejects multiagent output. | Remove the retired Riley implementation and use explicit Cyberbullying character metadata separately from the real tutor's user role. Support same-age peer, older peer, victim, bully, and educator, with stable scenario personas. Carry identity through projection, realtime, history, and export. |
| Tutor controls and AI configuration | Boundary | `src/components/AISuggestionBox.tsx:90` forwards parameter overrides for regeneration. `src/services/aiService.ts:484` rebuilds the prompt through `src/services/prompts/index.ts:24`, which inserts phishing instructions. The student tone selector at `src/components/StudentAIToneControl.tsx:29` also applies a peer/adult role lock. | Define the Cyberbullying review controls as character selection, text editing, regenerate, reject, and send. Its regeneration handler uses the dedicated Cyberbullying configuration and prompt builder. Scope control rendering and configuration updates by practice type. |
| Guard behavior | Phishing-specific policy on shared state | Active prompt decides Guard before instructional content. `src/utils/messagePresentation.ts:60` displays Guard replies as Security Supervisor. Production has an `AFTER UPDATE OF active_response_mode` trigger calling `private.replay_transfer_guard_events`. | Treat Cyberbullying character behavior and room participation state separately. The five-character workflow needs its own decision contract. |
| Required response ratings | Shared | `src/pages/RoomPagePost.tsx:383` finds the latest unrated tutor response; `:406` stops the next student send and opens a rating prompt. This applies regardless of topic, including a legacy Riley/Tutor mapping. | Inherit ratings. Bind feedback to the actual approved response message. Remove the Riley-specific mapping as part of retired-character cleanup. |
| Joining, observers, and cleanup | Shared despite service naming | `src/pages/StudentView.tsx:228` joins through `transferAssessmentService`. Live `join_room_v1` handles active room lookup, learner allocation, and observer fallback. `src/services/supabase.ts:834` clears history through the same service. | Reuse these generic operations. Avoid removing the entire service dependency merely because of its name. |
| Export and audit | Boundary | `src/contexts/roomExportBuilder.ts:170` formats tutor mode/instruction decisions. `src/contexts/RoomContext.tsx:1588` exports current messages and local AI interaction state. | Extend export/projected DTOs for activity, scenario version, target-set version, proposed/final character, model/prompt version, approved text, and progress evidence. Verify persisted review and progress records remain available after reload. |

## Live database evidence and limits

Read-only MCP queries inspected `information_schema.columns`, `pg_proc` definitions, `pg_trigger`, and `pg_policies`.

- `rooms.transfer_learning_enabled` has default `true`; room creation currently omits the field.
- `rooms.active_response_mode` defaults to `tutoring`; it is participation state, not subject identity.
- `rooms` and `room_templates` have no explicit practice-mode field.
- `messages` has a tutor/student/observer author role and response mode, but no dedicated Cyberbullying character metadata. `ai_suggestion_feedback` records tutor decisions but has no proposed/final character fields.
- `send_reviewed_tutor_response` atomically writes a message and feedback, then updates room participation mode. Its accepted instruction vocabulary belongs to the existing tutor policy.
- Room participation updates have a transfer-progress replay trigger. Its presence establishes a dependency; this review did not execute it.
- Broad `ALL` policies on rooms/messages coexist with active-room SELECT policies. The character-aware reviewed-send extension must validate tutor identity and ownership at its actual persistence boundary.

These findings describe the inspected production catalog and the local source independently. They do not establish that local Edge files exactly match deployed function versions.

## Learning-progress workflow

The existing phishing workflow uses learning targets as tracked state: after a student message it analyzes evidence and updates progress; when the tutor requests a suggestion it checks whether to prepare a transfer question before drafting ordinary feedback. These operations are attached to ordinary chat actions in `RoomContext.tsx:697`, `:890`, and `:1035`.

Cyberbullying uses the five shared targets both to guide role-playing and to track learning. Its flow is:

1. Save the student's comment.
2. Analyze the student's contribution against the five targets using the conversation as context.
3. Persist progress changes and evidence linked to the student's message; refresh the tutor's progress panel.
4. When requested by the tutor, generate one character and one complete reply.
5. The tutor reviews, edits, and sends the reply as one message.
6. The student rates that response and continues the conversation.

The analyzer must distinguish learner evidence from scenario text, simulated characters, and tutor responses. Surrounding dialogue provides context; progress claims must be supported by the learner's own contributions. Maintain learner ownership, message IDs, and replay protection so a refresh or retried analysis does not create duplicate updates. A stored student message remains stored if analysis fails; expose the analysis failure and allow retry.

Reuse the existing progress service and state transitions where their contracts fit. Before implementation, inspect the analyzer's full prompt, evidence rules, and database transition functions for phishing assumptions and dependencies on later question outcomes. This review confirms the coupling in orchestration; it has not established that all analyzer semantics already fit Cyberbullying. Adapt only the subject-specific parts, using the same five targets in every scenario.

Turning off `transfer_learning_enabled` alone still reaches the legacy `processStudentMessage` call. That legacy function only invokes coverage analysis when a checklist exists; without one it logs an error and returns no updates (`checklistService.ts:503`). The accurate finding is that a legacy analysis path remains reachable, not that every room necessarily makes an analysis model call.

## Character generation and tutor review

Preserve SocialMediaCopilot's scenario content and role-selection strategies for same-age peer, older peer, victim, bully, and educator. Its source returns one selected role and one response text per model call (`SocialMediaCopilot/src/services/openai.ts`); the integrated response contract carries that character and complete text into the shared tutor review.

Each successful approval publishes exactly one message and its review record atomically. The tutor can edit the proposed character and text before sending. Regenerate creates a fresh proposal using the same scenario, full saved conversation, shared targets, and Cyberbullying configuration. Selecting a character while reviewing a reply applies to that reply; future generations continue selecting characters according to the conversation.

Keep the real tutor as the approving author and save the simulated character as separate metadata. Student view, observer view, history, AI context, and export must resolve the same character identity. Ratings reference the published message ID.

## Riley cleanup scope

Riley has been removed from active generation, as the passing `aiService.multiAgentRequired.test.ts` suite confirms: saved multi-agent configurations are sent through the single-agent path, and returned multiagent decisions are rejected/repaired.

The remaining implementation includes:

- `components/MultiAgentSuggestionEditor.tsx` and its room-page wiring.
- Multi-agent draft, regenerate, reject, and direct-insert approval functions in `contexts/RoomContext.tsx`.
- Riley/Tutor parsers and tags in `services/tutorDecisionContract.ts`.
- Character presentation, delayed playback, rating redirection, and history-formatting branches.
- The unused `services/prompts/multiAgentTutorPrompt.ts`, repair instruction, old choice types/configuration helpers, and multi-agent demo template factory exposed through `TestRoomsView`.
- Related tests and fixtures that exercise the retired behavior.

Treat these as one cleanup unit before adding Cyberbullying role-playing. Existing stored tagged transcripts need an explicit content-preserving data transition if their decoder is removed. This review has not counted or changed those stored records. Historical evaluation artifacts are evidence, not active runtime functionality.

## Smallest implementation shape

Use an explicit activity branch in the current room flow, with dedicated Cyberbullying behavior code. A general plugin framework is unnecessary for two activities.

1. Add room/template `practice_type`, consistently rename participation state to `guard_mode: boolean`, and complete the retired Riley cleanup.
2. Initialize the shared five targets and reuse learning-progress analysis, persistence, and tutor display through a practice-aware path.
3. Import scenario assets with stable identifiers; add `cyberbullyingAIService` with its prompt and validated character/reply response, calling the existing AI transport.
4. Extend the shared tutor draft and atomic reviewed-send contract with character identity. Preserve the real author identity alongside the simulated character identity.
5. Route generation, regeneration, configuration, and tutor controls by practice type. Share review, send, ratings, and character-aware history/export.

Keep practice type fixed after room creation for this version. Changing an existing room's activity would require reconciling history, prompts, pending drafts, and participation state.

## Verification required when implemented

The implementation changes identity, message lifecycle, and interacting backend behavior, so use a full affected journey on staging and production under `tutor-system/docs/supabase-release-workflow.md`. The implementing agent is the release owner unless explicitly handed off.

- Create a Cyberbullying room from each imported scenario; verify original post, image, and initial comments match the source.
- Verify every Cyberbullying room uses the shared five target definitions and stable target keys, with learner-owned progress records.
- Exercise student-message analysis through progress persistence and tutor-panel refresh. Verify supporting learner message IDs, learner isolation, retry/replay behavior, and progress restoration after reload. Use structured analyzer fixtures for deterministic tests; inspect real scenario input/output records for behavioral acceptance.
- Verify scenario comments and simulated character replies are treated as context rather than learner evidence.
- Exercise all five character values structurally: generate, edit character/text, approve, reload, observe from another session, and export. Verify one published message per successful approval, with the complete approved text. Check persisted values and attribution rather than exact model wording.
- Exercise stale drafts, failed generations, and double approval; verify one consistent publication/audit result.
- Exercise the Cyberbullying tutor control set: character selection, text editing, regeneration, rejection, and send. Inspect regeneration payloads for the dedicated prompt/configuration and validate failure handling.
- Verify the inherited rating gate refers to the actual approved character reply after reload.
- Trace network operations during the Cyberbullying journey to confirm dispatch matches the activity-specific path.
- Run the existing phishing room lifecycle as a regression, including its current review, progress, Guard, and rating behavior.
- Verify learner and observer permissions against the actual persistence boundary, including attempts to forge character metadata or invoke tutor approval directly.

For release, record artifact hashes, migration and function versions, staging evidence, integrated `no_sign_up` release commit, production results, and fixture cleanup.

## Review verification evidence

Ran from `tutor-system/` on 2026-10-21:

```sh
rtk npm test -- --watchAll=false --runInBand --runTestsByPath \
  src/contexts/__tests__/RoomContext.quickAdjustPersistence.test.tsx \
  src/services/__tests__/aiService.multiAgentRequired.test.ts \
  src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx \
  src/services/__tests__/aiService.parameterOverrides.test.ts
```

Result from the preceding review: 4 suites passed; 35 tests passed; 0 snapshots; exit code 0. Tests cover existing mocked context/service integration and structural parameter contracts, not the proposed Cyberbullying implementation or live provider behavior. Existing React deprecation and incomplete-mock warnings appeared. The Quick Adjust persistence suite covers the older regeneration path; the transfer-learning path returns before the same configuration-save step. This documentation revision did not rerun those tests. Runtime code and database were unchanged.
