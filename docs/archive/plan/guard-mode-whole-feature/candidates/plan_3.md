# Assigned Approach

Use a minimal suggestion overlay that extends the existing:

`generateTutorSuggestion` → `RoomContext` → `AISuggestionBox` → `CommentInput` → message insertion → `PostComment`

The implementation will preserve the current tutoring path and add only:

- A strictly validated structured AI response.
- One final response-mode field carried with the tutor’s draft.
- Guard-specific composer and message presentation branches.
- Immutable raw-versus-reviewed audit data.
- A small, persisted room-level Guard state.
- A shared progression-lock check.

Guard behavior will remain close to the existing suggestion and room responsibilities. To contain that complexity, mode parsing, transition calculation, and persistence-payload construction will each have one authoritative implementation rather than being repeated across components.

# Assumptions

- The universal identity will use the display name `Security Supervisor` and one prebuilt static profile image stored with the application. It will not be configurable per room.
- The student will see the Guard identity, profile image, and distinct visual treatment, but will never see the literal label `Guard Mode` or the AI’s `mode_reason`.
- The tutor will see the AI-selected mode, raw decision reason, and the exact status text `Guard Mode Activated` whenever the reviewed draft’s final mode is `guard`.
- A tutor’s mode change is initially a draft decision. It becomes authoritative, auditable room state only when the reviewed response is sent.
- A final `guard` response activates or preserves the room lock. A final `tutoring` response deactivates Guard and unlocks progression.
- The room remains locked after a student submits a correction while Guard is active. Unlocking occurs only after the AI evaluates the correction and the tutor sends a reviewed `tutoring` response.
- The AI receives the current persisted Guard state as context but must still make an independent semantic mode decision on every turn. The room state is context, not a forced output or substitute for evaluation.
- Human mode rectification is authoritative for the sent turn even when it disagrees with the AI decision.
- Existing manually composed tutor messages without an AI suggestion remain supported. Their final mode must be explicitly supplied by the composer, normally `tutoring`; their raw AI audit fields remain null.
- The existing feedback/audit persistence used by `RoomContext` can be extended to record every generated suggestion. It will be written when generation succeeds, rather than only when the tutor later rejects or regenerates.
- Existing message and room real-time subscriptions can be extended to include the new fields.
- The existing progression feature has identifiable mutation points that can share one Guard-state precondition. Both the UI and the authoritative persistence path will enforce it.
- Database migrations remain append-only. Existing messages are not backfilled as Guard responses; new response-mode fields may remain null for historical records.
- No new AI credentials or provider configuration are required. Qwen remains on the current production prompt/provider path.
- Implementation will follow the repository’s fast multi-agent TDD workflow, with purpose comments on all new tests, edge-case coverage, and mypy validation if any Python evaluation code is added or refactored.

# Major Decisions

1. **Use one strict AI contract**

   `generateTutorSuggestion` will return a typed result rather than a text suggestion:

   ```ts
   type TutorSuggestion = {
     suggestionId: string;
     mode: 'tutoring' | 'guard';
     modeReason: string;
     suggestedResponse: string;
     rawOutput: string;
     generationMetadata: ExistingGenerationMetadata;
   };
   ```

   The provider output contract will use the serialized field names:

   ```json
   {
     "mode": "tutoring",
     "mode_reason": "Non-empty audit explanation",
     "suggested_response": "Non-empty tutor response"
   }
   ```

   Parsing will require valid JSON, an allowed exact mode value, and non-empty strings. Missing fields, invalid values, empty values, malformed JSON, or text-only output will produce a typed visible generation error. The implementation will not infer a mode, extract a likely answer with pattern matching, or silently fall back to tutoring.

2. **Keep AI mode and final human mode separate**

   `RoomContext` will maintain:

   - The immutable parsed AI suggestion.
   - An editable response draft.
   - One explicit `finalMode`.
   - Generation/error state.

   Copying a suggestion into `CommentInput` will copy both its response text and its proposed mode. Editing response wording changes only the draft text. Changing the mode changes only `finalMode`. The raw AI fields remain unchanged.

3. **Use one simple room transition rule**

   After a reviewed tutor response is successfully committed:

   - `finalMode === 'guard'` → `guard_active = true`
   - `finalMode === 'tutoring'` → `guard_active = false`

   The AI’s raw mode never directly changes room state. Student messages never directly clear the lock. This keeps human review authoritative and prevents temporary drafts, invalid output, or unreviewed AI decisions from altering student progression.

4. **Persist per-message history and current room state separately**

   The new append-only migration will extend tutor-response messages with fields equivalent to:

   - `response_mode`
   - `ai_suggestion_id`
   - `ai_mode`
   - `ai_mode_reason`
   - `ai_suggested_response`
   - `ai_raw_output`
   - `ai_generation_metadata`
   - `mode_rectified`
   - `reviewed_at`

   The existing message body remains the final human-reviewed response. Thus, raw wording and edited wording are independently recoverable without introducing a second final-message representation.

   The room will receive fields equivalent to:

   - `guard_active`
   - `guard_updated_at`
   - `guard_source_message_id`

   The existing AI feedback/audit record will also store each generated suggestion immediately, including its suggestion ID, raw contract fields, model/prompt/config metadata, creation time, and later disposition. Sending, editing, rectifying, rejecting, or regenerating updates that audit record with the reviewer action and linked final message where applicable.

5. **Make room-state updates atomic with final message persistence**

   A narrow database trigger or existing transactional server-side message operation will set the room’s Guard fields from the newly inserted final tutor message. The message insert must not succeed while the room-state transition fails independently.

   The database will enforce:

   - Allowed response-mode values.
   - All-or-none raw AI fields for AI-backed messages.
   - Tutor responses with new mode metadata cannot be used by student-authored messages.
   - `mode_rectified` reflects whether `ai_mode` and `response_mode` differ.
   - Only a committed final response can update `guard_active`.

6. **Centralize the two high-risk branches**

   To keep the additional `RoomContext` logic manageable, use:

   - One strict suggestion decoder.
   - One pure transition function from final mode to next Guard state.
   - One final-message payload builder that carries raw AI data, reviewed data, and metadata together.

   Components will consume these results and will not independently reconstruct mode or audit state.

7. **Enforce the progress lock at two levels**

   A shared `isProgressLocked` value derived from persisted `room.guard_active` will disable or hide student progression controls. The authoritative progression mutation must also reject advancement while Guard is active. UI disabling alone is insufficient because it can be bypassed or become stale.

8. **Treat evaluation as a blocking delivery gate**

   Guard-specific deterministic, Promptfoo, live-provider, and browser tests must pass before the feature is considered complete. Evaluation failures will not change prompts, models, thresholds, suites, or provider configuration silently. Any such change requires an explicit reviewed artifact and a fresh evaluation run.

# Ordered Implementation Steps

1. **Start the required TDD workflow and freeze observable behavior**

   - Run the repository-required fast multi-agent TDD workflow.
   - Record the current production prompt/provider configuration and the existing tutoring evaluation results as the regression baseline.
   - Define a transition truth table covering:
     - Inactive room plus final Guard response.
     - Active room plus final Guard response.
     - Active room plus final Tutor response.
     - Inactive room plus final Tutor response.
     - AI Guard rectified to Tutor.
     - AI Tutor rectified to Guard.
     - Student correction posted while the room remains active.
     - Invalid AI output.
     - Persistence failure during final send.
   - Add failing tests first for the structured decoder and transition rule. Every new test file must begin with the required file-purpose comment.
   - Do not refactor unrelated tutoring, room, or composer behavior.

2. **Introduce the structured suggestion contract**

   - Add the `TutorSuggestionMode`, parsed suggestion, raw suggestion, and generation-error types in the nearest existing AI/types module.
   - Change the production prompt used by `generateTutorSuggestion` to:
     - Require exactly `mode`, `mode_reason`, and `suggested_response`.
     - Explain that mode is chosen semantically on every turn.
     - Include current Guard state, relevant conversation history, phishing checklist/guidance context, and the latest student response.
     - Define deliberate system-playing behavior as a Guard candidate without introducing counters.
     - Explicitly protect confusion, genuine effort, partial improvement, and clarification-seeking from false escalation.
     - Require Guard responses to identify the necessary correction and one concrete next action.
     - Require firm, direct language while prohibiting insults, threats, humiliation, and personal attacks.
     - Require tutoring output to retain the existing tutoring quality rules.
   - Implement strict JSON parsing and runtime field validation.
   - Preserve the raw provider output and existing prompt/model/config metadata before parsing.
   - Return a typed error to `RoomContext` for invalid output. Do not emit a suggestion or modify room state in this case.
   - Add unit tests for:
     - Both valid modes.
     - Whitespace normalization around non-empty text fields.
     - Malformed JSON.
     - Missing and null fields.
     - Empty reason or response.
     - Unknown, differently cased, numeric, or boolean mode values.
     - Text surrounding otherwise valid JSON.
     - Provider errors and invalid structured output retaining diagnostic metadata.
     - Absence of any guessed-mode fallback.

3. **Add append-only Supabase persistence**

   - Create one new migration extending the existing message, room, and AI feedback/audit structures.
   - Add check constraints and indexes required to:
     - Query final messages by room and response mode.
     - Resolve the audit record by `ai_suggestion_id`.
     - Subscribe to the current room Guard state.
   - Make legacy-message compatibility explicit through nullable new message fields; do not rewrite historical messages.
   - Change successful generation handling so the raw suggestion and full generation metadata are persisted immediately under a stable `suggestionId`.
   - Extend feedback dispositions to distinguish at least:
     - Accepted without mode rectification.
     - Accepted with wording edit.
     - Accepted with mode rectification.
     - Rejected.
     - Superseded by regeneration.
   - Implement the atomic final-message/room-state transition. The committed final mode must determine `guard_active`, regardless of the AI’s raw mode.
   - Update Supabase TypeScript types after the migration.
   - Add migration and service tests covering:
     - Raw and final values surviving independently.
     - Both rectification directions.
     - Wording edits without mode rectification.
     - Rejected and regenerated suggestions retaining audit data.
     - Manual messages with null AI fields.
     - Legacy messages remaining readable.
     - Student-authored messages being unable to alter Guard state.
     - Failed message insertion not changing Guard state.
     - A committed final message updating the room and source-message reference atomically.

4. **Overlay mode state onto `RoomContext`**

   - Replace text-only suggestion state with the typed suggestion result.
   - Add a single final draft mode beside the existing editable draft text.
   - Preserve immutable raw suggestion data throughout copy, edit, send, reject, and regenerate operations.
   - On regeneration, mark the previous suggestion audit record as superseded before adopting the new suggestion.
   - On rejection, retain the audit record and clear only active UI draft state.
   - On send:
     - Validate that final text and final mode are present.
     - Build one persistence payload containing the final response, raw AI values, rectification status, and metadata.
     - Wait for the atomic commit before clearing the draft.
     - Leave the draft intact and display a retryable error if persistence fails.
   - Extend the room real-time subscription so both tutor and student views update from persisted `guard_active`, not from local optimistic mode state.
   - Add focused `RoomContext` tests for stale suggestions, rapid regeneration, duplicate send prevention, send failures, real-time updates, and raw/final state separation.

5. **Add the universal Guard identity and tutor review controls**

   - Add the static `Security Supervisor` identity and profile image through one shared application constant.
   - Update `AISuggestionBox` to show the tutor:
     - The AI-proposed mode.
     - The raw `mode_reason`.
     - The proposed response.
     - Existing copy, regenerate, and reject actions.
     - A visible structured-output error with a regenerate action when parsing fails.
   - Update `CommentInput` to:
     - Carry the final draft mode alongside the editable wording.
     - Allow explicit Tutor/Guard rectification.
     - Preview the `Security Supervisor` identity when Guard is selected.
     - Display `Guard Mode Activated` when the final draft mode is Guard.
     - Return to the normal tutor preview when Tutor is selected.
   - Ensure selecting Tutor while the room is currently in Guard constitutes manual deactivation when the reviewed message is sent.
   - Ensure selecting Guard from an AI Tutor suggestion constitutes manual activation when sent.
   - Keep AI reasons tutor-only and out of final message content.
   - Add component tests for both rectification directions, wording edits, invalid output, profile preview, the exact tutor status text, and preservation of existing composer actions.

6. **Render Guard responses without exposing an explicit mode label to students**

   - Update `PostComment` to branch on persisted `response_mode`.
   - For Guard responses, render:
     - `Security Supervisor` as the author identity.
     - The universal profile image.
     - A distinct but accessible visual treatment.
     - The final human-reviewed response text.
   - Do not render `Guard Mode`, the mode reason, raw response, rectification status, or audit metadata in the student view.
   - Preserve normal tutor rendering for `tutoring`, null legacy modes, student messages, and other existing roles.
   - Add UI tests for Guard identity, Tutor identity, legacy records, accessibility labels, and absence of tutor-only metadata.

7. **Apply and enforce the student progression lock**

   - In `RoomPagePost`, derive `isProgressLocked` from the real-time persisted room state.
   - Pass the lock state to the existing progression controls instead of adding a second local Guard flag.
   - While active:
     - Disable or suppress student advancement controls.
     - Prevent advancement requests through the authoritative progression mutation path.
     - Continue allowing the student to submit corrective or clarifying responses.
     - Continue allowing tutor review, regeneration, rectification, and sending.
   - Keep the lock after an inadequate correction because the persisted room state remains active.
   - Unlock only after a reviewed Tutor response is committed and the real-time room update is observed.
   - Add deterministic integration tests for direct mutation attempts, stale UI state, inadequate correction, valid correction, manual deactivation, reconnect/reload, and simultaneous tutor/student views.

8. **Add Guard behavior evaluation fixtures and assertions**

   - Extend the current Promptfoo parser so assertions evaluate the structured response while retaining the full raw output.
   - Add ecological cases drawn from realistic room context and synthetic holdout cases that were not used during prompt development.
   - Include critical positive cases:
     - Deliberate system-playing.
     - Repeated intentional violations.
     - The four-consecutive-violation example, without encoding four as a runtime trigger.
     - Inadequate corrections during active Guard.
   - Include critical negative cases:
     - Repeated genuine confusion.
     - Honest clarification requests.
     - Partial improvement.
     - Good-faith mistakes.
     - Semantically correct corrections expressed with different wording.
   - Add metrics for:
     - Contract validity.
     - Correct Guard activation.
     - False-positive avoidance.
     - Guard persistence.
     - Correct Guard exit.
     - Required-correction identification.
     - Concrete next action.
     - Guard language safety.
   - Continue running every existing tutoring metric in both ecological and synthetic-holdout suites.
   - Configure critical contract, transition, false-positive, and valid-correction cases to require 100%. Apply the existing repository threshold to noncritical aggregate metrics unless a reviewed evaluation artifact explicitly raises it.
   - Treat missing applicable results, parse failures, or unscored cases as failures.

9. **Run production-path live and browser validation**

   - Run live tests through the unchanged production prompt construction and Qwen provider path.
   - Record, for every evaluated case:
     - Complete input context.
     - Rendered prompt or its reproducible identifier.
     - Model and provider configuration.
     - Raw model output.
     - Parsed structure or parse error.
     - Final assertion results.
     - Timestamps and suite/fixture version.
   - Add browser-level scenarios covering:
     - AI Guard suggestion → tutor accepts → student sees Guard identity → progression is locked.
     - Inadequate student correction → next AI suggestion remains Guard → lock remains.
     - Semantically valid correction → AI suggests Tutor → tutor sends → lock clears.
     - AI Guard suggestion → tutor rectifies to Tutor.
     - AI Tutor suggestion → tutor manually activates Guard.
     - Active Guard → tutor manually deactivates by sending a reviewed Tutor response.
     - Tutor wording edit preserving raw AI wording in audit storage.
     - Invalid structured output producing a visible error without a draft or room-state change.
     - Reload and separate tutor/student sessions converging through Supabase real-time updates.
   - Preserve test-room identifiers and cleanup evidence. Remove only test scripts created during this implementation; do not remove pre-existing test assets without approval.

10. **Run all blocking gates and resolve failures without configuration drift**

    - Run deterministic schema, transition, persistence, context, UI, and progression tests.
    - Run the complete existing application regression suite.
    - Run Guard Promptfoo ecological and synthetic-holdout suites.
    - Run all existing tutoring Promptfoo metrics unchanged.
    - Run production-path live Qwen evaluation.
    - Run browser end-to-end validation.
    - Run TypeScript build, lint, and coverage checks.
    - Run mypy if Python evaluation or supporting code was added or refactored.
    - Stop delivery on any critical failure, missing result, silent fallback, metadata omission, tutoring regression, or unexplained model/configuration change.

11. **Update nearby documentation and prepare delivery evidence**

    - Update the Promptfoo documentation with:
      - The structured output format.
      - How to add ecological and holdout behavior cases.
      - How to classify critical cases.
      - Required metadata.
      - Threshold and missing-result behavior.
      - Commands for deterministic, live, and browser validation.
    - Update nearby AI documentation with semantic activation, persistence, exit, human authority, invalid-output handling, and privacy boundaries.
    - Update nearby testing documentation with the Guard transition matrix and required regression suites.
    - Record the migration, tests, evaluation artifacts, and browser evidence in the final implementation summary.
    - If committing, follow the repository’s documentation date and commit-ID requirements for the nearest README or documentation update record.

# Risks and Mitigations

- **`RoomContext` accumulates divergent Guard branches.**  
  Keep one typed suggestion object, one `finalMode`, one transition helper, and one persistence-payload builder. Components must not duplicate transition logic.

- **AI output is almost valid and gets silently accepted.**  
  Use strict JSON and field validation. Surface invalid output to the tutor and permit regeneration without creating a draft or changing room state.

- **Guard activates from repeated good-faith mistakes.**  
  Make mode selection semantic, include protected learning behaviors in the prompt, and require 100% success on critical false-positive fixtures.

- **Guard exits on superficial compliance.**  
  Supply relevant checklist and conversation context, evaluate semantic correction rather than exact wording, and require critical persistence and correction-exit tests.

- **The AI decision and room state disagree.**  
  Treat the AI mode as a proposal and the final human mode as authoritative. Update room state atomically from the committed final message.

- **Raw AI evidence is lost after editing or regeneration.**  
  Persist every successful generation immediately under a stable suggestion ID. Keep raw fields immutable and record later disposition separately.

- **Message insertion succeeds but room lock update fails.**  
  Use one database transaction, trigger, or existing atomic server-side operation. Test rollback behavior explicitly.

- **A stale client unlocks progression.**  
  Derive UI state from the real-time room row and enforce the same condition in the authoritative progression mutation.

- **Students see internal mode or reasoning data.**  
  Restrict student rendering to the identity, final response, and Guard presentation. Test that `mode_reason`, raw output, audit metadata, and the literal mode label are absent.

- **Legacy messages or existing tutoring behavior break.**  
  Keep new historical message fields nullable, render null response modes as existing tutor messages, and retain all current tutoring regression and evaluation gates.

- **Manual deactivation clears the lock before a reviewed response is delivered.**  
  Treat mode controls as draft-only. Commit state changes only with a successfully sent final response.

- **Real-time event ordering causes a temporary inconsistent view.**  
  Use the persisted room row as the lock authority, retain the source message ID, and test reload, reconnect, and separate-session convergence.

- **Prompt tuning overfits the visible examples.**  
  Separate ecological development cases from synthetic holdout cases and preserve the holdout set from prompt-development decisions.

- **Evaluation failure causes silent experiment drift.**  
  Record the exact prompt, model, provider, suite, thresholds, and results. Require an explicit reviewed change before rerunning with different configuration.

- **Guard wording becomes punitive or unsafe.**  
  Add prompt constraints and evaluation assertions for action-focused correction, prohibited personal attacks, and concrete next steps.

# Validation Criteria

The implementation is complete only when all of the following are evidenced:

- Every successful AI suggestion contains validated `mode`, `mode_reason`, and `suggested_response`.
- Every malformed or incomplete structured response produces a visible tutor-side error and never produces a guessed mode, draft, sent message, or room transition.
- The AI chooses mode semantically on every turn; no production counter or four-violation trigger exists.
- Deliberate system-playing can activate Guard, including the four-consecutive-violation evaluation example.
- Critical genuine-confusion, effort, partial-improvement, and clarification cases do not activate Guard.
- Inadequate correction keeps the next AI decision and reviewed room state in Guard.
- Semantically correct correction permits a Tutor decision and unlocks only after the reviewed Tutor response is committed.
- The tutor can accept or reverse either AI mode before sending.
- Edited final wording and immutable raw AI wording are separately persisted and recoverable.
- Raw mode, reason, response, full output, generation configuration, disposition, final mode, reviewer action, and linked final message are auditable.
- Sent messages retain their final Tutor/Guard mode independently of the current room state.
- The tutor sees `Guard Mode Activated` when the final reviewed draft is Guard.
- Students see only the universal `Security Supervisor` identity, profile, presentation, and reviewed response—not the explicit mode label or decision reason.
- Student progression is rejected by both the UI and authoritative mutation path while `guard_active` is true.
- Tutor and student sessions converge on the same Guard state after send, reload, reconnect, and real-time updates.
- Critical deterministic schema, transition, persistence, lock, false-positive, and correction-exit tests pass at 100%.
- All new applicable Promptfoo metrics meet their configured threshold with no missing results.
- All existing tutoring metrics continue meeting their current thresholds in ecological and synthetic-holdout suites.
- Production-path Qwen tests use the unchanged configured provider path and retain complete input, prompt, model, raw output, parsed output, and assertion metadata.
- Browser tests demonstrate activation, persistence, correction exit, both rectification directions, manual deactivation, invalid-output handling, identity presentation, and progression locking.
- The application build, lint, type checks, coverage gates, focused tests, regression tests, live evaluation, and browser suite all pass.
- Nearby AI and evaluation documentation explains the new behavior and provides a repeatable process for adding and gating future AI-behavior evaluations.