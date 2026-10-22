## Assigned Approach

Implement Guard Mode as a small, explicit typed state machine. The state machine owns only Guard-specific decisions and invariants; existing `RoomContext`, message delivery, tutoring behavior, and room functionality remain responsible for their current concerns.

The implementation order is contract-first:

1. Define the structured AI decision and Guard state-transition contracts.
2. Prove transition behavior with deterministic tests.
3. Add Supabase persistence and an auditable transition boundary.
4. Adapt the existing Qwen suggestion path and `RoomContext`.
5. Adapt the tutor and student interfaces.
6. Add AI-behavior evaluation gates and production-path validation.

The state machine must be pure and independent of React, Supabase, and the AI provider. Those systems consume its outputs through thin adapters.

## Assumptions

- The universal student-facing Guard identity will use the working display name `Security Supervisor`.
- The identity will use one static, application-owned profile asset and style configuration. It will not be configurable per room or represented as a user-created account.
- `mode_reason` is visible to the tutor for review and audit but never rendered to the student.
- The AI returns exactly one structured decision per suggestion:

  ```ts
  type ResponseMode = 'tutoring' | 'guard';

  interface AISuggestionDecision {
    mode: ResponseMode;
    mode_reason: string;
    suggested_response: string;
  }
  ```

- All three fields must be present and non-empty; extra or malformed data is rejected according to one documented runtime schema.
- The AI reassesses the appropriate mode semantically on every turn. Current Guard state is context for deciding whether correction is adequate, not an instruction to repeat Guard unconditionally.
- The human-reviewed final mode is authoritative for the turn. Editing response wording does not automatically change the selected mode.
- A student correction does not directly mutate Guard state. It enters the conversation, the AI assesses it, and the tutor reviews and sends the next response. The final reviewed response changes the room state.
- Student communication remains available while Guard is active. Only the existing progression/completion action is locked.
- Historical Guard messages retain their Guard identity and presentation after the room returns to tutoring.
- Existing message content remains the final human-reviewed response. The raw AI suggestion is stored separately for audit.
- Legacy and non-tutor messages may have no response mode. Existing rendering treats legacy tutor messages as ordinary tutoring messages.
- Supabase migrations remain append-only.
- Existing evaluation credentials and Qwen configuration are reused unchanged. Evaluation failures must not cause model, prompt-path, or provider changes outside reviewed configuration.
- General evaluation metrics retain the existing 80% threshold. Structured-output validity and explicitly designated critical transition, false-positive, and correction-exit cases require 100%.
- Any new code and test files must include the repository-required purpose comment. Executable scripts must also include the appropriate shebang.
- The repository-required fast multi-agent TDD workflow is mandatory when implementation begins.

## Major Decisions

### 1. Keep the state machine narrow

Use a two-state room model:

```ts
type GuardState =
  | { status: 'tutoring' }
  | { status: 'guard' };

interface ReviewedTutorResponse {
  rawDecision: AISuggestionDecision;
  finalMode: ResponseMode;
  finalResponse: string;
  reviewerId: string;
  reviewedAt: string;
}

interface GuardTransition {
  previousState: GuardState;
  nextState: GuardState;
  source: 'reviewed_response' | 'manual_override';
  rectified: boolean;
}
```

The pure transition function accepts the current persisted Guard state and a validated, human-reviewed action. It returns the next state and audit facts. It does not fetch data, send messages, update React state, or write to Supabase.

Core invariants:

- An invalid AI result cannot create a usable suggestion or state transition.
- Generating, regenerating, rejecting, copying, or editing a draft does not change room Guard state.
- Sending a final `guard` response leaves or moves the room into Guard.
- Sending a final `tutoring` response leaves or moves the room into tutoring.
- A manual activation moves the room to Guard.
- A manual deactivation moves the room to tutoring.
- Only a successfully persisted reviewed response or manual override changes the authoritative room state.
- Room progression is allowed only when the authoritative persisted state is tutoring.
- Message presentation derives from that message’s final response mode, not the room’s current state.

### 2. Separate AI output, human review, and sent state

Maintain three distinct representations:

- Raw AI decision: immutable structured `mode`, `mode_reason`, and `suggested_response`.
- Human review draft: editable final wording and selectable final mode.
- Sent record: final response content, final mode, raw AI fields, rectification status, reviewer, and generation metadata.

This prevents wording edits from destroying the original model output and makes mode rectification explicit.

A rectification is recorded when `finalMode !== rawDecision.mode`. A wording edit is recorded when `finalResponse !== rawDecision.suggested_response`. Both may happen independently.

### 3. Use message history as the turn audit and a room projection for current state

Extend sent tutor messages with nullable Guard audit fields sufficient to reconstruct each reviewed AI turn:

- Final `response_mode`.
- Raw `ai_mode`.
- Raw `ai_mode_reason`.
- Raw `ai_suggested_response`.
- Whether mode was rectified.
- Whether wording was edited.
- Reviewing tutor identifier and review timestamp.
- Existing or extended AI metadata containing provider, model, prompt/config version, context identifiers, and generation timing/result information.

Add an authoritative current Guard projection to the room or a one-to-one room-state record:

- Current state: `tutoring` or `guard`.
- Last transition timestamp.
- Last transition actor.
- Last transition source.
- Related message identifier when the transition was caused by a sent response.
- A revision/version field if the existing send path permits concurrent writes.

Add an append-only Guard transition audit record for state changes, especially manual activation or deactivation where no tutor message necessarily exists:

- Room identifier.
- Previous and next state.
- Source: reviewed response or manual override.
- Related message identifier when applicable.
- Acting tutor.
- Optional teacher-entered override reason.
- Timestamp and audit metadata.

The current room state is a projection; message and transition records preserve history.

### 4. Make state persistence atomic

A reviewed send must not create a final message without applying its corresponding Guard transition, or apply a transition without creating the message. Implement one Supabase transaction boundary, such as a database function/RPC, that:

1. Validates the final mode and required audit fields.
2. Confirms the tutor is authorized for the room.
3. Inserts the reviewed message.
4. Calculates and applies the next room Guard state.
5. Inserts the transition audit record when state changes or policy requires recording a reaffirmed Guard decision.
6. Returns the created message and authoritative room state.

Manual activation and deactivation use a similarly authoritative database operation and create a transition audit record. RLS and database constraints must prevent students from changing Guard state or audit fields.

### 5. Fail closed on malformed AI output

The Qwen response is parsed and runtime-validated before it enters `RoomContext`.

On malformed JSON, an unknown mode, missing field, empty reason, empty response, or wrong field type:

- Do not infer a mode from text.
- Do not default to tutoring or Guard.
- Do not copy partial content into the composer.
- Show the tutor a visible generation error with regeneration available.
- Preserve failure metadata for tests and diagnostics without exposing sensitive prompt content to students.

### 6. Make progress locking authoritative and narrowly scoped

Derive a single `canStudentProgress` value from the real-time authoritative room Guard state. Use it wherever the existing application advances or completes student progress.

Enforce the lock at both levels:

- Disable or hide the relevant student progression control with an accessible explanation.
- Reject the corresponding progress mutation at the service/database authority while Guard is active.

Do not disable commenting, clarification-seeking, or correction submission.

### 7. Keep the universal identity presentation centralized

Create one Guard identity configuration containing:

- Display name: `Security Supervisor`.
- Static profile-image reference.
- Visual treatment tokens/classes.
- Accessible label or alt text.

Use this configuration in tutor preview and student message rendering. Students see the identity, avatar, response style, and distinct presentation, but no explicit `Guard Mode` badge or label. The teacher-facing interface may display the required `Guard Mode Activated` status.

## Ordered Implementation Steps

### 1. Freeze executable requirements and TDD responsibilities

Before production changes, invoke the repository’s fast multi-agent TDD workflow and divide work around observable contracts:

- State-machine and structured-schema tests.
- Supabase migration, persistence, authorization, and real-time tests.
- React/`RoomContext` integration and UI tests.
- Promptfoo, production-path Qwen, and browser validation.

Record the unchanged model/provider configuration and existing tutoring-gate baseline so later evaluation failures cannot silently alter the experiment.

Map every acceptance criterion to at least one deterministic, evaluation, integration, or browser test.

### 2. Add failing tests for the structured AI contract

Define test cases before implementing the parser:

- Accept exactly `tutoring` and `guard`.
- Accept meaningful non-empty `mode_reason` and `suggested_response`.
- Reject missing keys.
- Reject unknown mode strings and case variants unless normalization is explicitly part of the schema.
- Reject nulls, arrays, numbers, empty strings, and whitespace-only strings.
- Reject malformed JSON and non-JSON prose.
- Reject responses embedded in an unexpected wrapper.
- Verify invalid data produces an explicit error rather than a guessed mode.
- Verify raw validated strings are preserved without mutation for audit.

Designate all schema cases as critical and require 100%.

### 3. Implement the structured decision contract

Add the shared TypeScript types and one runtime validator at the AI adapter boundary. Reuse an existing schema-validation dependency if already present; otherwise implement the smallest explicit validator necessary.

Change `generateTutorSuggestion` from returning a text suggestion to returning:

- The validated `AISuggestionDecision`.
- Existing context and configuration metadata.
- Provider/model/prompt metadata already captured by the production path.

Do not allow consumers to construct a suggestion from unvalidated provider output.

### 4. Add failing tests for the pure Guard state machine

Cover the full transition table:

| Current state | Reviewed final mode/action | Next state | Progress |
|---|---|---|---|
| tutoring | send tutoring | tutoring | unlocked |
| tutoring | send Guard | Guard | locked |
| Guard | send Guard | Guard | locked |
| Guard | send tutoring | tutoring | unlocked |
| tutoring | manual activate | Guard | locked |
| Guard | manual deactivate | tutoring | unlocked |

Also test:

- Raw AI Guard rectified to final tutoring.
- Raw AI tutoring rectified to final Guard.
- Wording edit without mode rectification.
- Mode rectification without wording edit.
- Draft generation, regeneration, rejection, and editing cause no transition.
- Invalid AI decisions cannot be reviewed or transitioned.
- An inadequate correction followed by final Guard stays locked.
- A semantically correct correction followed by final tutoring unlocks.
- Historical message presentation remains based on message mode after later transitions.
- Repeated same-state decisions are deterministic and do not corrupt audit facts.
- Stale or unauthorized transition requests are rejected by the persistence boundary.

Require 100% for the state transition matrix and critical correction cases.

### 5. Implement the pure transition module

Implement only:

- Guard state and reviewed-action types.
- Transition calculation.
- Rectification and wording-edit calculation.
- Progress-permission derivation.
- Invariant checks required before persistence.

Keep React hooks, Supabase calls, prompt construction, and provider parsing out of this module. Do not create a parallel copy of general room or message state.

Run targeted unit tests before proceeding.

### 6. Add an append-only Supabase migration

Create database constraints/types using the project’s established migration style:

- Restrict stored modes to `tutoring` and `guard`.
- Add nullable per-message raw/final Guard audit fields so legacy and non-tutor messages remain valid.
- Add the room’s current Guard state projection.
- Add append-only transition audit storage.
- Add foreign keys for room, message, and tutor references.
- Add timestamps and required audit metadata.
- Add indexes needed for current room-state reads and chronological audit queries.
- Update RLS so authorized tutors can review/send/override, students can read appropriate final room/message state, and students cannot modify Guard fields.
- Include new tables or room-state fields in the appropriate Supabase real-time publication using the repository’s existing pattern.

Use database checks to prevent impossible combinations, including:

- A final Guard/Tutor response with no final mode.
- A reviewed AI message missing raw AI fields.
- A rectification flag inconsistent with raw and final modes.
- A transition referencing a message from another room.
- A student-originated message carrying tutor AI audit fields.

Do not rewrite historical migrations.

### 7. Implement and test atomic persistence adapters

Add failing integration tests around the reviewed-send operation:

- Message and state transition both commit.
- A failure rolls both back.
- Raw AI values remain unchanged.
- Edited final wording is stored separately as final content.
- Final mode is authoritative.
- Rectification and edit flags are correct.
- Guard-to-Guard preserves the lock.
- Guard-to-tutoring unlocks.
- Manual activation and deactivation are audited.
- Unauthorized users cannot transition the room.
- Real-time consumers receive the final message and resulting room state.
- Concurrent or stale writes cannot silently overwrite a newer state.

Implement the database function/RPC and its TypeScript service adapter only after these tests fail for the expected reason.

### 8. Update the Qwen prompt and production parsing path

Revise the existing production prompt so Qwen must emit the structured contract and evaluate each turn using:

- Recent conversation.
- Current room Guard state.
- Relevant checklist/guidance context.
- The student’s latest response.
- The correction required by the active Guard response, when applicable.

Prompt rules must state:

- Select mode semantically on every turn.
- Activate Guard for deliberate system-playing, intentional disregard, manipulation, or refusal to make the required correction.
- Do not activate merely for repeated mistakes, genuine confusion, partial improvement, visible effort, or clarification-seeking.
- While Guard is active, remain in Guard when correction is absent or inadequate.
- Return to tutoring when the required correction is semantically satisfied; exact wording is unnecessary.
- Guard responses identify the specific correction and a concrete next action.
- Guard wording is firm and direct but never insulting, threatening, humiliating, or personally attacking.
- Tutoring responses continue to follow the existing tutoring rubric.
- Output only the required structured fields.

Examples may include four consecutive deliberate violations as one activation case, but no counter or fixed violation threshold may appear in production logic or prompt policy.

### 9. Refactor `RoomContext` into an adapter over the contracts

Update `RoomContext` suggestion state to distinguish:

- Idle/loading.
- Validated raw AI decision.
- Human review draft containing final mode and editable response.
- Structured-output error.
- Persistence/send error.

Adapt existing actions:

- Generate/regenerate replaces the raw decision and initializes a fresh review draft.
- Copy-to-input transfers both the suggested wording and the currently reviewed final mode.
- Editing updates final wording only.
- Mode rectification updates final mode only.
- Reject clears the usable draft and records existing feedback without changing room Guard state.
- Send invokes the atomic reviewed-send operation.
- A successful send adopts the returned authoritative room state.
- A failed send retains the draft for retry and does not pretend that state changed.
- Real-time events reconcile message and room state for tutor and student views.

Avoid maintaining a second independent Guard-active boolean in `RoomContext`; derive it from the authoritative subscribed room state.

### 10. Update `AISuggestionBox`

Extend `AISuggestionBox` to show the tutor:

- Raw AI mode decision.
- Raw `mode_reason`.
- Suggested response.
- A clear final-mode selector or rectify action.
- Whether the final mode differs from the AI decision.
- Existing regenerate, reject, and copy/edit workflow.
- Explicit structured-output errors.

When the reviewed final mode is Guard, show the exact teacher-facing text `Guard Mode Activated`.

Do not expose `mode_reason` through student-visible message content or presentation data.

Add component tests for:

- Both valid modes.
- Rectification in both directions.
- Wording edit preservation.
- Error display and disabled copy/send for invalid output.
- Regeneration replacing, rather than merging, raw audit data.
- Existing regenerate/reject behavior.
- Keyboard and accessible-label operation.

### 11. Update `CommentInput` and the tutor composer

Carry the final selected mode alongside edited text through the existing composer.

When final mode is Guard:

- Preview the universal `Security Supervisor` identity, avatar, and response styling.
- Display `Guard Mode Activated` to the tutor.
- Preserve human wording edits.
- Permit the tutor to change the mode before send.

When final mode is tutoring, retain the existing tutor presentation and behavior.

Prevent sending when:

- No validated AI decision is attached to an AI-reviewed send.
- Final response is empty.
- Final mode is invalid.
- A persistence request is already in flight.

Do not infer mode from response text, avatar, styling, or current room state.

### 12. Update `PostComment` and student-visible message rendering

Render sent messages using their persisted final `response_mode`:

- Guard response: universal Guard identity and distinct presentation.
- Tutoring response: existing tutor identity and presentation.
- Legacy tutor response with no mode: existing tutoring presentation.
- Student and other messages: unchanged.

Ensure the raw AI decision, reason, rectification status, and internal audit metadata never appear in student-visible content or DOM attributes.

Add tests for historical rendering after the room changes state and for legacy records.

### 13. Integrate state, real-time synchronization, and progress locking in `RoomPagePost.tsx`

Subscribe tutor and student room views to the authoritative Guard state.

Use the pure permission derivation to control progression:

- While Guard is active, disable the existing progression/completion control and give an accessible student-facing explanation focused on completing the requested correction.
- Keep commenting and clarification available.
- On an inadequate correction and reviewed Guard response, retain the lock.
- On a correct correction and reviewed tutoring response, remove the lock after the authoritative state update is received.
- Apply manual tutor activation/deactivation through the audited persistence operation.
- Reconcile reconnects from persisted state rather than stale client state.

Protect the underlying progress mutation so bypassing the client control cannot advance the student during Guard.

### 14. Add deterministic integration tests across the whole reviewed-turn path

Build tests that exercise provider result → schema validation → review → send → persistence → room transition → rendering.

Critical scenarios:

- Deliberate system-playing activates Guard.
- The four-consecutive-violation example can activate Guard without encoding a fixed count rule.
- Repeated genuine confusion remains tutoring.
- Repeated effort with partial improvement remains tutoring.
- Clarification-seeking remains tutoring.
- Guard response names the required correction and concrete next action.
- Inadequate correction produces another Guard proposal and remains locked after tutor approval.
- Semantically correct correction produces tutoring and unlocks after tutor approval.
- Tutor rectifies a false-positive Guard proposal to tutoring.
- Tutor rectifies a missed escalation to Guard.
- Tutor edits wording while preserving raw suggestion.
- Tutor manually deactivates Guard.
- Invalid output stops before composer/send/persistence.
- Existing non-Guard tutor and student flows remain unchanged.

### 15. Extend Promptfoo with structured and behavioral metrics

Update the existing evaluation configuration and documentation without replacing the current eight tutoring metrics.

Add structured-output parsing and metrics for:

- Schema validity.
- Semantically justified Guard activation.
- Critical false-positive avoidance.
- Guard persistence after inadequate correction.
- Guard exit after valid semantic correction.
- Required-correction specificity.
- Concrete next-action quality.
- Guard safety and non-abusive tone.
- Independence from hardcoded violation counts.
- Existing tutoring response quality.

Run both:

- Ecological cases representing realistic room conversations and guidance context.
- Synthetic holdout cases not used as prompt examples, including paraphrases, ambiguous corrections, partial corrections, manipulation attempts, and genuine confusion.

Mark schema validity, critical false positives, and critical valid-correction exits as 100% gates. Apply the existing 80% per-metric and per-suite threshold to general new metrics unless a reviewed evaluation artifact sets a stricter threshold. Missing applicable results fail the gate.

Preserve complete case input, model/provider/configuration, prompt/version, raw output, parsed output, assertions, scores, and timestamps.

### 16. Run the live production-path Qwen evaluation

Use the existing production prompt construction, provider integration, and Qwen3.5 Flash configuration.

Validate at minimum:

- Valid structured output for every live case.
- One deliberate system-playing activation.
- One repeated-confusion non-activation.
- One Guard persistence case.
- One semantic correction exit.
- One firm-but-safe Guard response.
- One ordinary tutoring regression case.

Do not repair a failure by silently changing the model, provider, temperature, suite, prompt inputs, or thresholds. Record failures with full metadata and return to the relevant implementation or prompt step.

### 17. Run browser-level end-to-end validation

Exercise the real tutor-room and student-room views:

1. Create or open a test room through the existing browser workflow.
2. Generate a Guard suggestion.
3. Verify the tutor sees the AI mode, reason, response, and `Guard Mode Activated`.
4. Edit wording and verify the edit survives sending.
5. Rectify mode in each direction and verify the persisted final mode wins.
6. Send Guard and verify the student sees `Security Supervisor`, the Guard artwork/style, and no explicit `Guard Mode` label.
7. Verify progression is locked but comments remain usable.
8. Submit an inadequate correction, approve the next Guard response, and verify the lock persists.
9. Submit a semantically correct correction, approve tutoring, and verify the room unlocks.
10. Manually activate and deactivate Guard and verify both views synchronize.
11. Reconnect or reload both views and verify persisted state and historical message identity.
12. Exercise an invalid structured response through a controlled test double and verify the tutor sees a blocking error.

Save browser evidence and full run metadata according to the existing testing pattern.

### 18. Run regression, type, build, and migration checks

Run:

- State-machine and schema unit tests.
- Supabase/database integration and RLS tests.
- React component and `RoomContext` integration tests.
- Existing focused regression suites.
- Existing BDD suite.
- Promptfoo ecological and synthetic-holdout gates.
- Production-path Qwen tests.
- Browser end-to-end tests.
- TypeScript compilation and production build.
- Coverage checks.
- Cloud Functions build if shared message types or related functions are affected.
- `mypy` for any refactored Python evaluation/support code; record it as not applicable if no Python code is changed.

Critical state behavior must pass completely. Existing tutoring gates must remain at or above their current thresholds.

### 19. Update nearby documentation

Update the existing Promptfoo and nearby AI/testing documentation with:

- The structured output contract.
- Where runtime validation occurs.
- Guard state invariants and transition table.
- Raw versus final message audit fields.
- Human rectification semantics.
- Universal Guard identity behavior.
- Progress lock/unlock semantics.
- How to add future AI-behavior evaluation metrics and cases.
- Which metrics are critical 100% gates.
- How to add ecological and synthetic-holdout cases.
- How to preserve production-path model, prompt, input/output, and result metadata.
- How invalid structured output is diagnosed.
- The exact validation commands and expected gates.

Follow the repository’s documentation intent, non-overlap, necessity, and detail rules. If the eventual change is committed, review the nearest documentation and apply the required update-date, commit-ID, or documentation-update-record procedure.

### 20. Produce final delivery evidence

Before declaring the feature complete, provide:

- Requirement-to-test traceability.
- State-machine transition test results.
- Schema, persistence, authorization, real-time, and UI test results.
- Promptfoo metric totals for both suites, including missing-result checks.
- Existing tutoring metric results.
- Production-path Qwen input/output/model/prompt/result metadata.
- Browser evidence for activation, persistence, rectification, identity, lock, correction exit, and manual deactivation.
- Build/type/coverage results.
- Migration and RLS validation evidence.
- Any known residual risk, with no hidden fallback or changed experiment configuration.

## Risks and Mitigations

- **State machine duplicates `RoomContext` state.**  
  Keep it pure and limited to Guard status, transitions, audit derivation, and progress permission. `RoomContext` remains an adapter and does not hold an independent authoritative Guard boolean.

- **Message persistence and room state diverge.**  
  Use one transactional database boundary for reviewed sends and one audited operation for manual overrides. Test rollback and stale-write behavior.

- **AI emits plausible prose instead of valid structured output.**  
  Require structured output in the prompt, validate at the provider boundary, fail visibly, and gate schema compliance at 100%. Never infer a mode from prose.

- **Guard escalates ordinary learning difficulty.**  
  Add critical ecological and holdout cases for confusion, effort, partial improvement, and clarification-seeking. False-positive cases are blocking at 100%.

- **Guard exits on superficial compliance.**  
  Supply relevant conversation and correction context, evaluate semantic correction, and add partial, evasive, paraphrased, and genuinely correct holdout cases.

- **Guard becomes sticky because current state biases the model.**  
  Explicitly require a fresh semantic decision every turn and include critical valid-correction exit cases requiring 100%.

- **A fixed violation count leaks into production behavior.**  
  Keep activation semantic, search production code and prompt configuration for counter logic, and test cases where four deliberate violations escalate while repeated genuine mistakes do not.

- **Tutor rectification is lost during copy/edit/send.**  
  Carry final mode as typed composer state, persist it with the final response, and test both rectification directions plus independent wording edits.

- **Students see internal reasons or an explicit mode label.**  
  Keep internal audit fields outside student-facing view models and test rendered student output/DOM for the absence of `mode_reason` and `Guard Mode`.

- **Past messages change appearance after Guard exits.**  
  Render each message from its persisted final mode rather than current room state.

- **Progress locking exists only in the UI.**  
  Apply both client presentation controls and authoritative mutation rejection while Guard is active.

- **Real-time events arrive out of order.**  
  Return authoritative state from the write operation, include timestamps or a revision, and reconcile subscriptions against persisted state.

- **Legacy messages break after schema changes.**  
  Permit null response mode for legacy and non-tutor messages and render legacy tutor messages using existing tutoring presentation.

- **Manual override bypasses auditing.**  
  Route activation and deactivation through the same typed transition adapter and append-only transition audit.

- **Evaluation improvements degrade tutoring.**  
  Preserve all existing tutoring metrics and thresholds in both ecological and synthetic-holdout runs.

- **Live evaluation becomes irreproducible.**  
  Record provider, model, prompt/config version, inputs, raw/parsed outputs, scores, timestamps, and failures. Do not silently adjust configuration.

- **Universal artwork is unavailable or unsuitable.**  
  Finalize one application-owned static asset before UI acceptance testing, verify licensing/accessibility, and use a deterministic test-safe asset reference.

- **The implementation becomes too broad.**  
  Do not add a review dashboard, teacher-availability logic, room-specific Guard profiles, violation counters, runtime mode guessing, or replacement tutoring behavior.

## Validation Criteria

The implementation is complete only when all of the following are demonstrated:

- Every successful AI suggestion contains validated, non-empty `mode`, `mode_reason`, and `suggested_response`.
- Every malformed structured output produces a visible blocking error and no guessed mode, usable draft, send, or room transition.
- The pure transition matrix passes at 100%.
- The AI makes semantic per-turn decisions without a production violation counter.
- Deliberate system-playing, including the four-consecutive-violation example, can activate Guard.
- Critical confusion, effort, partial-improvement, and clarification cases remain tutoring at 100%.
- Inadequate corrections keep Guard active and progress locked.
- Critical semantically correct corrections return to tutoring and unlock progress at 100%.
- Guard responses identify the required correction and provide a concrete next action.
- Guard safety tests show no insult, threat, humiliation, or personal attack.
- Existing tutoring quality metrics continue to meet their current ecological and synthetic-holdout gates.
- Tutors can edit wording and rectify modes independently in both directions.
- Tutors can manually activate and deactivate Guard through an audited operation.
- Raw AI mode, reason, response, generation metadata, final mode, final response, reviewer, edit status, and rectification status are persisted and auditable.
- Reviewed message persistence and room transition are atomic and rollback together.
- RLS prevents students or unauthorized users from changing Guard state or audit data.
- Tutor and student views converge on the same persisted Guard state through real-time synchronization and after reload/reconnect.
- The tutor interface displays `Guard Mode Activated` when the reviewed final response is Guard.
- The tutor composer previews the universal Guard identity when final mode is Guard.
- Students see `Security Supervisor`, the universal image, and distinct presentation for Guard messages without an explicit `Guard Mode` label.
- Past Guard messages retain their identity after the room returns to tutoring.
- Student progression mutations are rejected while Guard is active, while comments and correction attempts remain available.
- Existing room, message, tutoring, and student behavior passes regression tests outside Guard Mode.
- New Promptfoo metrics meet their defined thresholds with no missing applicable results.
- Production-path Qwen evaluation uses the unchanged configured provider path and preserves full input/output/model/prompt/result metadata.
- Browser validation demonstrates activation, tutor review, editing, rectification, student identity, locking, Guard persistence, semantic exit, manual deactivation, real-time synchronization, and reload persistence.
- Type checks, build, coverage, migration, database authorization, focused regression, BDD, live evaluation, and browser suites all pass.
- Documentation explains the contract, state invariants, audit model, evaluation gates, and how to add future AI-behavior evaluations.