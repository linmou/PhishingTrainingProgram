# Assigned Approach

**Audit event sourcing.** Guard Mode will use an immutable, room-scoped event stream as the source of truth. Every raw AI decision, failed structured response, semantic correction evaluation, human review, human mode rectification, final sent response, manual activation, and manual deactivation will be recorded as an event.

The room’s current Guard state will be maintained as a rebuildable projection of those events. Messages will retain their final response mode for stable historical rendering, while the event stream preserves how the AI proposal became the tutor-approved result.

Implementation order is therefore:

1. Define the events, transition rules, and projection.
2. Implement transactional persistence and projection rebuilding.
3. Connect structured AI decisions.
4. Connect tutor review, student presentation, progression locking, and real-time synchronization.
5. Make deterministic, Promptfoo, live-model, and browser evaluations blocking release gates.

# Assumptions

- The universal student-visible identity will be named **Security Supervisor**.
- Security Supervisor will use one application-owned static profile image, preferably a simple shield-style avatar committed with the frontend assets. It will not be configurable per room.
- A student will never see the phrases `Guard Mode` or `mode_reason`. The persona, avatar, response styling, and firm wording communicate the identity.
- Tutor-facing UI may explicitly display `Guard Mode Activated`.
- The structured AI mode values will be exactly `tutoring` and `guard` throughout TypeScript, database payloads, tests, and evaluations.
- The AI provider’s raw response is retained for audit, but downstream code may use it only after strict structural validation.
- A raw AI decision does not directly change the authoritative room state. The tutor-approved final mode does so when the response is sent. This prevents an unreviewed AI decision from briefly locking or unlocking the student.
- When Guard is already active, a validated AI decision of `tutoring` means the AI judged the student’s correction semantically adequate; `guard` means the correction was inadequate. That evaluation is recorded explicitly as a correction event.
- A human activation occurs by reviewing or rectifying an outgoing response to `guard` and sending it. Manual deactivation is also available as an immediate tutor action without requiring another message.
- Existing messages without a response mode remain legacy messages and retain their current presentation. No historical AI or human decisions will be invented for them.
- The current room-membership and tutor-authorization model can be reused in Supabase policies and functions.
- Existing Promptfoo credentials and Qwen configuration remain unchanged. Failed evaluations will not cause model, prompt, threshold, or fixture substitutions.
- Feature execution will follow the repository-required fast multi-agent Red-Green-Refactor workflow. Every new test will start with a comment naming the responsible production file and behavior, and refactored Python code—if any is touched—will receive applicable mypy validation.

# Major Decisions

1. **Use an immutable `guard_mode_events` stream as the audit authority.**

   Add an append-only Supabase table with at least:

   - `id`: UUID event identifier.
   - `room_id`: owning room.
   - `room_sequence`: monotonically increasing sequence within that room.
   - `event_type`: constrained event name.
   - `actor_type`: `ai`, `tutor`, or `system`.
   - `actor_user_id`: nullable authenticated actor.
   - `suggestion_id`: nullable correlation identifier shared by generation, review, and send events.
   - `message_id`: nullable link to the final sent message.
   - `causation_event_id`: nullable link to the event that caused this event.
   - `schema_version`: payload schema version.
   - `payload`: event-specific JSON.
   - `created_at`: server timestamp.

   Enforce uniqueness on `(room_id, room_sequence)`. Application roles cannot update or delete events.

2. **Use a small, explicit event vocabulary.**

   The initial event types will be:

   - `ai_decision_recorded`: validated raw `mode`, `mode_reason`, `suggested_response`, raw provider response, provider/model identity, prompt version or hash, relevant context/config metadata, and generation identifiers.
   - `ai_output_rejected`: invalid raw output, validation errors, and the same reproducibility metadata; it never creates a usable suggestion.
   - `correction_evaluated`: emitted when a room was already in Guard and a new validated decision evaluates the student correction as `adequate` or `inadequate`.
   - `human_review_completed`: proves that the tutor approved a mode and wording before sending.
   - `human_mode_rectified`: records raw AI mode, tutor-selected mode, tutor identity, and optional reason when the two modes differ.
   - `response_sent`: records the final mode, final wording, source AI event if present, and resulting message ID.
   - `guard_manually_activated`: optional explicit administrative activation if later required independently of sending; the initial tutor flow activates by sending a Guard response.
   - `guard_manually_deactivated`: immediate tutor-controlled deactivation with actor and optional reason.

   Reject unknown event types or malformed event payloads at the database boundary.

3. **Maintain a rebuildable real-time projection.**

   Add `room_guard_state` with:

   - `room_id` as its primary key.
   - `is_active`.
   - `active_since_event_id`, nullable.
   - `last_state_event_id`.
   - `last_room_sequence`.
   - `last_final_mode`.
   - `updated_at`.

   The projection is an optimization for real-time reads and progression checks, not a second source of truth. Only database append functions may update it. A replay/rebuild operation must reproduce the same projection from `guard_mode_events`.

4. **Keep state-changing rules deliberately small.**

   - `response_sent(final_mode=guard)` activates or keeps Guard active.
   - `response_sent(final_mode=tutoring)` deactivates Guard.
   - `guard_manually_deactivated` deactivates Guard immediately.
   - `guard_manually_activated`, if exposed, activates Guard immediately.
   - AI decisions, correction evaluations, and human reviews alone do not change student-visible state.
   - Repeated `guard` responses are idempotent with respect to active state but remain separately auditable.
   - Repeated deactivation while inactive is rejected or recorded as a no-op according to one documented rule; it must never create projection drift.

5. **Perform event append, final message insertion, and projection update transactionally.**

   Supabase RPCs will be the only production write path for state-changing events:

   - An AI-decision append function records validated or rejected model output.
   - A reviewed-response function validates the source decision, inserts the final message, appends review/rectification/send events, and updates the projection in one transaction.
   - A manual-deactivation function appends the event and updates the projection in one transaction.

   Each RPC will lock or compare the room’s last sequence to prevent concurrent sends from producing an invalid order. A stale caller receives an explicit conflict and must refresh; it does not overwrite newer state.

6. **Store final mode on the final message.**

   Add a nullable, constrained `response_mode` field to messages and a nullable link to the source AI-decision event. Every newly sent tutor response must have `tutoring` or `guard`; student and legacy messages may remain null.

   Historical message rendering uses the message’s immutable final mode. Current progress locking uses `room_guard_state`. This avoids changing old messages when the room later changes state.

7. **Use a strict structured AI contract.**

   Change `generateTutorSuggestion` from a text-only return value to a typed result containing:

   ```ts
   {
     mode: 'tutoring' | 'guard';
     mode_reason: string;
     suggested_response: string;
     metadata: { /* existing and required audit metadata */ };
   }
   ```

   Validation requires:

   - Exactly one supported mode.
   - A non-empty raw reason.
   - A non-empty suggested response.
   - Correct JSON structure and field types.
   - No extraction of an apparent mode from unstructured prose.
   - No guessed fallback based on room state, counters, keywords, or response wording.

   Invalid output is recorded as rejected, shown as an actionable tutor-facing error, and cannot be copied or accepted as a valid AI suggestion.

8. **Make semantic behavior explicit in the production prompt.**

   The prompt will receive conversation history, applicable checklist/guidance context, and the projected current Guard state. It will instruct Qwen to:

   - Select mode independently on every turn.
   - Activate Guard for deliberate system-playing, intentional disregard, or behavior requiring a firm corrective boundary.
   - Treat four consecutive deliberate violations as one qualifying example, not a production counter rule.
   - Avoid Guard for honest confusion, repeated genuine mistakes, partial improvement, effort, or clarification-seeking.
   - Keep Guard active until the required correction is semantically demonstrated.
   - Exit to tutoring when the correction is adequate, without requiring exact wording.
   - Make Guard responses identify the unresolved correction and give a concrete next action.
   - Remain firm and direct without insults, threats, humiliation, or personal attacks.
   - Return only the defined structured response.

9. **Treat tutor approval as authoritative while retaining the raw AI proposal.**

   The AI-selected mode preselects the tutor control. The tutor can:

   - Edit response wording.
   - Change `tutoring` to `guard`.
   - Change `guard` to `tutoring`.
   - Reject or regenerate a suggestion.
   - Send the reviewed result.
   - Manually deactivate an already active Guard state.

   The raw and final responses are never overwritten. Wording changes are recoverable by comparing `ai_decision_recorded.suggested_response` with the final message and `response_sent` payload.

10. **Enforce progress locking from server-backed state.**

    Student progression must consult the projected room state, not infer Guard from the latest rendered message or local component state. All existing actions that advance or complete student work will be routed through a Guard-aware check. Where progression writes reach Supabase, the database function or policy must reject advancement while `is_active=true`; the disabled UI is not the security boundary.

# Ordered Implementation Steps

1. **Establish the behavior matrix and event contract before production changes.**

   - Start the required fast multi-agent TDD workflow.
   - Define the AI response type, event names, payload schemas, projection fields, and state-transition table.
   - Define examples for:
     - Tutoring while inactive.
     - Guard activation.
     - Guard persistence after inadequate correction.
     - Guard exit after valid correction.
     - Tutor rectification in both directions.
     - Manual deactivation.
     - Repeated activation/deactivation.
     - Invalid structured AI output.
     - Concurrent or stale tutor actions.
   - Define expected audit events and final projection for every example.
   - Write failing deterministic tests for schema validation and the event reducer before implementing database or UI behavior.

2. **Create the append-only Supabase migration.**

   - Add the message response-mode field and source-decision reference.
   - Create `guard_mode_events` with room sequence and correlation indexes.
   - Create `room_guard_state`.
   - Add database checks for supported modes, actors, event types, and required event payload fields.
   - Deny application-level event updates and deletes.
   - Restrict raw audit-event reads to authorized tutors or service operations; students must not read `mode_reason`, raw model responses, prompt data, or audit metadata.
   - Permit students to read only the room state needed by their room and the final message fields already visible to them.
   - Leave legacy messages without fabricated response modes or events.
   - Add migration tests covering authorization, invalid values, immutability, and room isolation.

3. **Implement the single event-append and projection path.**

   - Implement a database-owned sequence assignment and event append operation.
   - Centralize projection changes in that operation rather than updating `room_guard_state` from React services.
   - Implement the reviewed-response transaction:
     1. Verify tutor membership and source decision.
     2. Verify expected room sequence.
     3. Insert the final message with final mode.
     4. Append `human_review_completed`.
     5. Append `human_mode_rectified` only when modes differ.
     6. Append `response_sent`.
     7. Apply the event to `room_guard_state`.
     8. Return the message, appended events, and resulting projection.
   - Implement manual deactivation transactionally.
   - Implement replay/rebuild support using the same transition rules.
   - Test transaction rollback: if any message, event, or projection write fails, none of them may remain.
   - Test that live projection equals full event replay for every transition sequence.

4. **Implement and validate the structured AI contract.**

   - Add the TypeScript response-mode and structured-decision types without unsafe defaults.
   - Add a strict parser at the Qwen response boundary.
   - Update `generateTutorSuggestion` to return the validated decision and existing context/config metadata.
   - Preserve the unmodified provider output for audit.
   - On success, persist `ai_decision_recorded` before exposing the suggestion as sendable.
   - If Guard was active when the request was generated, append:
     - `correction_evaluated(adequate)` when the validated proposed mode is `tutoring`.
     - `correction_evaluated(inadequate)` when it remains `guard`.
   - On validation failure, persist `ai_output_rejected`, expose a visible error and regeneration action, and create no usable mode.
   - Add unit and integration tests for missing fields, unsupported modes, empty strings, malformed JSON, extraneous prose, provider errors, and audit-persistence failures.

5. **Update the production prompt and AI context.**

   - Add the semantic activation, false-positive protections, persistence, correction, exit, actionability, and safety rules.
   - Supply current projected state and enough prior conversation/checklist context to evaluate correction semantically.
   - Do not add a violation counter, keyword-only classifier, exact-match correction rule, or special four-turn branch.
   - Version or hash the prompt and record it with each AI decision.
   - Extend production-path prompt tests to prove the serialized request contains the current Guard state and required semantic instructions.
   - Preserve all existing tutoring instructions and regression expectations.

6. **Refactor `RoomContext` around a reviewable decision object.**

   - Replace string-only suggestion state with a state object containing the raw decision, source event ID, generation metadata, selected final mode, editable final wording, loading/error state, and expected room sequence.
   - Preserve the source decision ID when wording is copied into the composer.
   - Initialize selected mode from the AI proposal.
   - Mark a rectification when the selected mode changes.
   - Send through the transactional reviewed-response service rather than independently inserting a message and changing room state.
   - Clear the draft only after a successful transaction.
   - On stale-state conflict, keep the tutor’s draft, refetch events/projection/messages, and request review again.
   - Preserve existing suggestion regenerate, reject, feedback, and normal tutoring behavior.

7. **Add the universal Security Supervisor presentation.**

   - Define the fixed display name, static avatar path, accessible alt text, and Guard visual tokens in one shared frontend configuration.
   - Update `AISuggestionBox` to show the AI-selected mode and raw reason to the tutor, while clearly separating that proposal from the tutor’s final selection.
   - Update `CommentInput` to:
     - Preview the final identity and appearance.
     - Allow mode rectification before send.
     - Preserve arbitrary tutor wording edits.
     - Display `Guard Mode Activated` when the final reviewed selection is Guard.
   - Update `PostComment` to render final Guard messages with Security Supervisor’s name, avatar, and distinct response presentation based only on the persisted message mode.
   - Keep normal tutor messages visually unchanged.
   - Ensure no student-facing component renders `Guard Mode`, `mode_reason`, or raw audit data.
   - Add accessibility checks for avatar text, color contrast, focus order, disabled controls, and screen-reader status announcements.

8. **Connect room state, real-time synchronization, and manual control.**

   - Load the current projection with the initial room data.
   - Subscribe tutor and student views to `room_guard_state` changes in addition to messages.
   - Apply projection updates only when their sequence is newer than the locally known sequence.
   - Refetch the projection after reconnect to close subscription gaps.
   - Add the tutor’s immediate manual-deactivation action with clear confirmation of its effect.
   - Do not optimistically unlock the student; render the state returned by the successful transaction or subsequent authoritative refetch.
   - Keep the final mode of already-sent messages independent of the room’s later active state.

9. **Enforce the student progression lock.**

   - Identify every existing client and Supabase path that advances, completes, or navigates beyond the current learning step.
   - Use the projected `is_active` state to disable those controls and present student-safe guidance such as “Complete the requested correction before continuing.”
   - Add a server-side check to any progression mutation so a stale or manipulated client cannot advance during Guard.
   - Keep comment submission available so the student can provide the required correction.
   - On inadequate correction, confirm the next reviewed Guard response leaves the projection active.
   - On adequate correction, preselect tutoring; after tutor review and send, atomically deactivate Guard and unlock progression.
   - On manual deactivation, unlock without modifying historical Guard messages.

10. **Complete deterministic critical-state coverage.**

    Add tests with required purpose comments for:

    - Structured response parsing and rejection.
    - Every event-payload schema.
    - Event immutability and RLS.
    - Room sequence ordering and stale-write rejection.
    - Transactional send and rollback.
    - Replay/projection equivalence.
    - Activation, persistence, semantic exit, and manual deactivation.
    - Human rectification in both directions.
    - Raw versus edited wording persistence.
    - Legacy message rendering.
    - Student inability to read reasons or raw audit metadata.
    - Tutor/student real-time convergence.
    - Student progression rejection during active Guard.
    - Normal tutoring room behavior while Guard is inactive.
    - All named component states in `RoomPagePost`, `AISuggestionBox`, `CommentInput`, and `PostComment`.

    Critical schema and transition suites must pass at 100%; skipped or missing applicable assertions count as failures.

11. **Extend Promptfoo with ecological and synthetic-holdout Guard evaluation.**

    - Teach the evaluator to parse the structured contract before scoring content.
    - Add ecological cases derived from realistic room conversations.
    - Add separately maintained synthetic holdout cases that are not used to tune the prompt.
    - Cover:
      - Deliberate system-playing activation.
      - The four-consecutive-deliberate-violation example.
      - Repeated honest confusion.
      - Genuine effort and partial improvement.
      - Clarification seeking.
      - Inadequate corrections while active.
      - Semantically correct paraphrased corrections.
      - Guard actionability.
      - No insults, threats, humiliation, or personal attack.
      - Structured schema validity.
    - Require 100% on designated critical false-positive, valid-correction, schema, and state-transition cases.
    - Require the repository threshold for general new Guard metrics, with no missing applicable results.
    - Run all existing eight tutoring metrics in both ecological and synthetic-holdout suites and retain their current per-metric and per-suite thresholds.
    - Save case input, model output, parsed decision, score, prompt/model/config metadata, and failure explanation for every result.
    - Do not change model, provider, prompt configuration, fixtures, or thresholds silently after a failure.

12. **Run production-path Qwen evaluation.**

    - Use the existing production prompt-building and Qwen3.5 Flash provider path.
    - Exercise activation, non-activation, persistence, semantic exit, and safe/actionable Guard wording.
    - Verify that structured output is parsed by the same production validator used by the application.
    - Preserve the full input/output pair and model, prompt, configuration, timing, parser, and result metadata.
    - Treat invalid structured output and any critical behavioral miss as blocking.
    - Re-run existing live tutoring behavior checks to detect regression.

13. **Run browser-level end-to-end validation with tutor and student sessions.**

    Validate at least these flows:

    - AI proposes Guard; tutor reviews, edits wording, sends; student sees Security Supervisor and becomes locked.
    - AI remains Guard after inadequate correction; tutor sends; student remains locked.
    - Student gives a semantically correct correction; AI proposes tutoring; tutor sends; student unlocks.
    - Tutor rectifies tutoring to Guard.
    - Tutor rectifies Guard to tutoring.
    - Tutor manually deactivates an active Guard state.
    - Invalid AI JSON displays an error and never guesses or sends a mode.
    - A repeated-confusion case stays in tutoring.
    - Tutor and student views converge after real-time updates and after reconnect.
    - Existing non-Guard tutoring flows, message composition, regeneration, rejection, and feedback still work.

    Capture room ID, test data, browser role, event IDs/sequences, final messages, projection state, screenshots, and pass/fail results.

14. **Update documentation and enforce the release gate.**

    - Update the nearest AI, Supabase, room UI, and testing documentation.
    - Extend `evals/promptfoo/README.md` with:
      - The structured-output requirement.
      - How to add ecological and synthetic-holdout cases.
      - How to mark critical cases.
      - Required metadata.
      - Threshold and no-missing-result rules.
      - How to run production-path and regression evaluations.
    - Document the event vocabulary, source-of-truth rule, projection rebuilding, privacy boundary, and manual-deactivation semantics.
    - Record test and evaluation commands, logs, artifacts, inputs, outputs, model/prompt metadata, and final results.
    - Do not declare the feature complete until deterministic tests, Promptfoo gates, existing tutoring gates, live Qwen tests, and browser E2E tests all pass.
    - Before any commit, review and update the nearest required Markdown or `claude_docs` documentation and its required update record/date/commit metadata.

# Risks and Mitigations

- **Event sourcing introduces excessive complexity for a one-to-one room.**  
  Keep the event vocabulary fixed and small, keep one projection, and put transition logic behind a single database write path. Do not introduce a general event framework, message broker, snapshot service, or cross-room event bus.

- **Event history and projected state diverge.**  
  Prevent direct projection writes, update events and projection transactionally, and require replay/projection equivalence tests. Provide a controlled rebuild operation.

- **Messages are inserted without their corresponding audit events.**  
  Insert the final message, review events, rectification event, response event, and projection update in one database transaction.

- **Concurrent tutor actions create conflicting room sequences.**  
  Assign sequences under a row lock or compare an expected last sequence. Reject stale operations explicitly and preserve the unsent local draft for re-review.

- **Raw AI reason or prompt context leaks to students.**  
  Restrict the event stream with RLS, expose only final messages and projected active state to students, and test unauthorized reads.

- **The application silently interprets malformed model output.**  
  Validate at the provider boundary, persist a rejection event, disable acceptance of that suggestion, and require regeneration. Never derive mode from keywords, current state, or response text.

- **Guard activates for repeated genuine mistakes.**  
  Put semantic false-positive protections in the prompt and make confusion, effort, partial improvement, and clarification cases critical 100% evaluation gates.

- **Guard fails to exit because the correction is paraphrased.**  
  Evaluate semantic correction using conversation and guidance context. Include paraphrased valid corrections and partial/inadequate corrections in deterministic and live evaluation cases.

- **The student unlocks before the tutor reviews the AI decision.**  
  AI decisions and correction evaluations do not update the authoritative projection. Unlock only when the tutor-approved tutoring response is transactionally sent or when the tutor manually deactivates Guard.

- **A tutor wording edit loses the connection to the raw AI output.**  
  Carry the immutable source decision event ID through the composer and final transaction. Store the final text separately rather than overwriting the event.

- **Real-time delivery is delayed or arrives out of order.**  
  Use room sequence numbers, ignore older projection updates, refetch after reconnect, and enforce progress at the server even if the UI is stale.

- **Guard styling is confused with an explicit system label.**  
  Centralize Security Supervisor identity and presentation. Limit `Guard Mode Activated` to tutor-facing UI and add student-rendering tests that prohibit the phrase and raw reason.

- **Guard responses become punitive or unsafe.**  
  Add explicit prompt constraints and blocking evaluations for insults, threats, humiliation, personal attacks, missing correction descriptions, and missing concrete next actions.

- **Existing tutoring quality regresses because the prompt and output format changed.**  
  Retain existing tutoring instructions and run all existing ecological, holdout, and live tutoring gates unchanged alongside the new metrics.

- **Live-model failures encourage configuration drift.**  
  Store the exact model, provider, prompt version/hash, evaluator, thresholds, and inputs with every run. A failure remains a failure until reviewed code, prompt, or requirements change is explicitly recorded.

- **Legacy messages break after introducing mandatory mode rendering.**  
  Permit null mode only for student or pre-migration messages, retain their current display behavior, and require all newly sent tutor responses to carry a valid final mode.

# Validation Criteria

The implementation is complete only when all of the following evidence exists and passes:

1. **Event and persistence correctness**

   - Every valid AI suggestion produces one immutable `ai_decision_recorded` event.
   - Every invalid model response produces an `ai_output_rejected` event and no usable suggestion.
   - Every reviewed send records human review, optional rectification, final response, final message mode, and audit metadata.
   - Raw AI wording and final tutor wording remain separately recoverable.
   - Event updates and deletes are denied.
   - Event append, message insertion, and projection update are atomic.
   - Replaying the full room stream reproduces `room_guard_state`.
   - Cross-room and student access tests prove audit-data isolation.

2. **Transition correctness**

   - Final Guard response activates or maintains Guard.
   - Inadequate correction produces a Guard proposal and, after review/send, remains active and locked.
   - Semantically valid correction produces a tutoring proposal and, after review/send, deactivates and unlocks.
   - Tutor rectification is authoritative in both directions and is auditable.
   - Manual deactivation immediately deactivates and unlocks.
   - Stale and concurrent actions cannot reorder or corrupt the event stream.
   - All critical transition tests pass at 100%.

3. **AI contract and behavior**

   - Every usable suggestion has valid `mode`, `mode_reason`, and `suggested_response`.
   - No runtime fallback guesses a mode.
   - No hardcoded violation count, four-turn trigger, keyword classifier, or exact-match correction check controls production behavior.
   - Deliberate system-playing, including the specified four-violation example, can activate Guard.
   - Honest confusion, effort, partial improvement, and clarification seeking remain tutoring in all critical cases.
   - Guard responses name the required correction and provide a concrete next action.
   - Guard safety constraints pass all critical cases.

4. **Tutor UI and auditability**

   - The tutor can inspect the AI mode and raw reason, edit wording, rectify mode, reject, regenerate, send, and manually deactivate.
   - `Guard Mode Activated` appears in the tutor interface when the final reviewed response is Guard.
   - Invalid model output is visible as an error and cannot be accepted as a valid suggestion.
   - Regeneration and rejection do not erase prior raw decisions from the event history.

5. **Student UI and progression**

   - A final Guard message displays the fixed Security Supervisor name, profile image, and Guard presentation.
   - Students never see `Guard Mode`, `mode_reason`, raw output, prompt data, or audit metadata.
   - Progress controls and server-side progression writes are blocked while Guard is active.
   - Commenting remains available for correction.
   - Correct correction followed by the reviewed tutoring response unlocks progress.
   - Historical Guard messages retain their identity after the room returns to tutoring.
   - Existing non-Guard room behavior remains unchanged.

6. **Real-time behavior**

   - Separate tutor and student sessions converge on the same final messages and projected state.
   - Out-of-order events do not regress local state.
   - Reconnect and refetch recover missed updates.
   - Server enforcement prevents progression even during client-side delay.

7. **Evaluation gates**

   - Critical schema, transition, false-positive, valid-correction, actionability, and safety cases pass at 100%.
   - New general Promptfoo metrics meet the repository quality threshold with no missing applicable results.
   - Existing eight tutoring metrics continue to pass their current 80% per-metric and per-suite thresholds in ecological and synthetic-holdout suites.
   - The production-path Qwen suite uses the existing provider and model configuration and passes without silent configuration changes.
   - Every live and Promptfoo result preserves full input/output, parsed decision, model, provider, prompt/configuration, evaluator, score, and failure metadata.

8. **Integrated evidence**

   - Browser E2E covers activation, persistence, correction exit, both rectification directions, manual deactivation, invalid output, false-positive protection, real-time convergence, and existing tutoring regression.
   - Deterministic, integration, Promptfoo, live-model, and browser logs are retained with their commands and metadata.
   - Required nearby AI/testing/Supabase documentation explains the event model and how future AI behavior evaluations must be added.
   - No completion or release occurs while any blocking test, evaluation, metadata check, or applicable result is missing.