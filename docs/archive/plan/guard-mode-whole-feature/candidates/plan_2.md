# Assigned Approach

Use an evaluation-first delivery gate.

The structured AI contract, behavioral policy, multi-turn fixtures, Promptfoo metrics, deterministic transition tests, production-path evaluation, and browser validation scenarios are defined before runtime behavior changes. These initially failing tests become the product contract. Runtime, persistence, and UI work are complete only when they satisfy that contract while preserving all existing tutoring gates.

The implementation sequence is therefore:

1. Specify observable Guard behavior and thresholds.
2. Build the validators, fixtures, and failing evaluations.
3. Implement the structured AI contract and prompt behavior.
4. Implement authoritative persistence and state transitions.
5. Implement tutor review, Guard presentation, and progress locking.
6. close deterministic, Promptfoo, live-Qwen, and browser gates.

# Assumptions

- The universal student-visible identity will be named **Security Supervisor**.
- Its profile image will be a repository-owned static shield emblem with accessible alternative text. It will not depict a person, require room configuration, or depend on an external service.
- Students will see the Security Supervisor name, profile image, distinct styling, and firm response wording. They will not see an explicit `Guard Mode` label or the AI’s `mode_reason`.
- Tutor-facing controls may use the explicit labels `Guard Mode Activated`, `Tutor`, and `Guard`.
- The existing Qwen provider, production prompt path, model selection, credentials, and generation configuration remain unchanged except for the prompt and structured-output requirements needed by this feature.
- Every AI-generated draft still requires tutor review. “Automatic return to tutoring” means that the AI proposes `tutoring` after semantic correction and the normal reviewed send applies that mode without a separate Guard reset action.
- Activating or deactivating Guard state requires sending a reviewed tutor response. This ensures that every lock or unlock has a corresponding student-visible message and auditable transition.
- The tutor’s reviewed mode is authoritative for the sent turn. It may differ from the raw AI mode.
- Student messages do not directly alter Guard state. They provide evidence for the next AI decision.
- Final tutor wording remains in the existing message content field. The original AI suggestion is stored separately so edits remain auditable without duplicating the final text.
- Existing messages and rooms will be migrated to the `tutoring` state. New room creation will explicitly provide the initial mode rather than relying on an application-level implicit default.
- Existing Promptfoo credentials and provider configuration are sufficient; no replacement or guessed configuration is introduced.
- No Python changes are expected. If implementation reveals affected Python code, mypy validation becomes mandatory for that scope.

# Major Decisions

## 1. Strict structured AI contract

`generateTutorSuggestion` will stop returning an unvalidated text suggestion and instead return a validated object equivalent to:

```ts
type ResponseMode = 'tutoring' | 'guard';

interface AISuggestion {
  mode: ResponseMode;
  mode_reason: string;
  suggested_response: string;
  contextMetadata: ExistingContextMetadata;
  configMetadata: ExistingConfigMetadata;
}
```

The provider response must contain exactly one parseable structured result with non-empty `mode_reason` and `suggested_response`. Unknown modes, absent fields, wrong field types, blank values, prose surrounding the object, or otherwise malformed output are errors.

The application will not infer a mode from wording, previous room state, violation counts, or partial output. An invalid result produces a visible tutor-side error, prevents sending that result as an AI-reviewed draft, and allows regeneration.

## 2. Semantic behavior policy

The prompt and evaluation oracle will distinguish intentional system-playing from learning difficulty.

Guard may activate for deliberate evasion, repeated knowingly noncompliant behavior, attempts to manipulate the exercise, or continued refusal to perform an explicitly required correction. The four-consecutive-violation scenario is an evaluation example, not a production counter.

Guard must not activate merely because of repeated mistakes when the student shows genuine confusion, effort, partial improvement, or asks for clarification.

When Guard is active:

- Inadequate or cosmetic correction should produce another `guard` decision.
- The response must name the unresolved correction and give one concrete next action.
- Semantically correct correction should produce `tutoring`.
- Exact phrase matching is prohibited.
- Responses must remain firm and action-focused without insults, threats, humiliation, or personal attacks.

## 3. One authoritative room mode

The room will store one authoritative current mode: `tutoring` or `guard`. Student progression lock state is derived from this value rather than persisted as a second Boolean that could drift out of sync.

The final tutor-reviewed mode determines the next room state:

| Current room mode | Final reviewed mode | Result |
|---|---|---|
| `tutoring` | `tutoring` | Remain in normal tutoring |
| `tutoring` | `guard` | Activate Guard and lock progress |
| `guard` | `guard` | Keep Guard active and progress locked |
| `guard` | `tutoring` | Deactivate Guard and unlock progress |

The mode selector in the tutor composer supports all human actions:

- Accept the AI mode unchanged.
- Change `tutoring` to `guard`, manually activating Guard.
- Change `guard` to `tutoring`, manually deactivating Guard.
- Change wording independently of the mode.

Mode changes do not take effect until the reviewed response is sent.

## 4. Separate current state, per-message evidence, and transition history

Use three persistence layers with non-overlapping responsibilities:

- **Room row:** current authoritative mode, state version, and last transition metadata.
- **Message row:** raw AI decision, raw reason, raw suggested response, final reviewed mode, reviewer metadata, and final sent text in the existing content field.
- **Append-only transition record:** previous mode, next mode, source message, actor, source classification, and timestamp whenever room mode changes.

This prevents current room updates from erasing raw AI decisions or human rectification history.

The migration should use constrained text values for `tutoring` and `guard`, avoiding a database enum that makes future evolution unnecessarily rigid.

## 5. Atomic reviewed-send operation

Sending a reviewed tutor response, recording its AI evidence, applying the final mode, and recording a state transition must be one Supabase transaction, preferably through a narrowly scoped database function used by `RoomContext`.

The operation will:

1. Verify that the caller is an authorized tutor for the room.
2. Check an expected room state version to reject stale reviews.
3. Insert the final message and raw AI audit fields.
4. Update the room mode and increment its version.
5. Insert a transition record only when the mode changes.
6. Return the committed message and room state.

This avoids a sent Guard message without a lock, an unlocked room whose Tutor response failed to send, or competing tutor actions overwriting one another.

## 6. Progress locking is enforced at both layers

The React UI will visibly disable or hide student progression actions while the authoritative room mode is `guard`, but client-side disabling is not sufficient.

All Supabase-backed progression mutation paths must also reject advancement while the room is in `guard`. The implementation should extend the existing authoritative progression write path rather than create a parallel progress mechanism.

Posting the student’s corrective message remains allowed; otherwise the student could not satisfy Guard’s instruction.

## 7. Evaluation gates are blocking

The delivery thresholds are:

- 100% for structured-contract tests.
- 100% for critical transition cases.
- 100% for critical false-positive learning cases.
- 100% for critical valid-correction exit cases.
- No missing or non-applicable result for any case marked applicable.
- At least the repository’s existing 80% threshold for each new noncritical Promptfoo metric and each suite.
- Continued success of all eight existing tutoring metrics at their current per-metric and per-suite thresholds.
- Successful production-path Qwen and browser scenarios with complete evidence metadata.

A failure blocks completion. It does not trigger prompt weakening, provider substitution, configuration changes, skipped assertions, or guessed fallback behavior.

# Ordered Implementation Steps

## 1. Record the current evaluation baseline

Before changing runtime behavior:

1. Run the existing deterministic tutor tests, Promptfoo ecological suite, synthetic-holdout suite, live production-path behavior tests, and relevant browser tests.
2. Preserve the command, commit identifier, timestamp, suite name, provider/model/configuration, result counts, metric-level scores, and failures.
3. Confirm the eight existing tutoring metrics and their thresholds from the active configuration.
4. Record any pre-existing failure separately. Do not attribute it to Guard work or silently alter configuration to clear it.

This establishes the regression baseline and the exact configuration that later Guard evaluations must preserve.

## 2. Define the versioned evaluation contract

Create one versioned Guard behavior contract shared conceptually by deterministic and model evaluations. It must define:

- Allowed modes: `tutoring` and `guard`.
- Required fields: `mode`, `mode_reason`, and `suggested_response`.
- Invalid-output conditions.
- Semantic activation indicators.
- Protected learning behaviors that must not escalate.
- Persistence behavior after inadequate correction.
- Exit behavior after semantically correct correction.
- Guard response safety and actionability requirements.
- Tutor-authoritative rectification behavior.
- Student-visible and tutor-visible presentation rules.

Keep evaluation assertions focused on observable behavior. Do not assert hidden chain-of-thought or require exact response phrasing.

Version the contract so saved evaluation results identify the policy used.

## 3. Build ecological and synthetic holdout fixtures before runtime changes

Extend the Promptfoo evaluation data with distinct development and holdout cases.

The ecological suite should use realistic room histories and project checklist/guidance context. The synthetic holdout should contain independently worded cases that are not paraphrases of the development fixtures.

Include at least these behavior families:

1. Clear deliberate system-playing that activates Guard.
2. The four-consecutive-violation example.
3. The same number of mistakes accompanied by genuine effort, which remains tutoring.
4. Repeated confusion and clarification-seeking, which remains tutoring.
5. Partial improvement that still needs teaching but not Guard.
6. Guard followed by no meaningful correction, which remains Guard.
7. Guard followed by superficial keyword copying without semantic correction, which remains Guard.
8. Guard followed by a semantically correct paraphrase, which returns to tutoring.
9. Guard followed by correct action expressed in unexpected wording, which returns to tutoring.
10. Guard response missing the exact required correction.
11. Guard response missing a concrete next action.
12. Guard wording containing insult, threat, humiliation, or personal attack.
13. Tutoring responses exercising all eight existing quality metrics.
14. Ambiguous cases where the reason must explain why Guard was or was not selected.
15. Structurally invalid provider outputs.

Multi-turn fixtures must preserve full conversation order, active room mode, checklist/guidance context, expected mode, criticality, and the reason the expected result is correct.

## 4. Implement the evaluation parser, scorers, and blocking gate

Before changing `generateTutorSuggestion`:

1. Add a strict structured-output parser used by evaluation.
2. Make schema validity a prerequisite for behavioral scoring.
3. Add metrics for:
   - mode correctness;
   - false-positive avoidance;
   - Guard persistence;
   - correct Guard exit;
   - correction specificity;
   - concrete next-action quality;
   - Guard safety;
   - tutoring regression quality.
4. Treat missing applicable scores as failures.
5. Produce per-case evidence containing input context, raw provider output, parsed output or parser error, expected result, metric results, provider, model, prompt version/hash, configuration, timestamp, and suite.
6. Add a gate command that reports each critical case and metric separately rather than only an aggregate score.
7. Verify that the new cases fail for meaningful reasons against the unmodified text-only runtime path. Save this red evidence.

If cases appear ambiguous during this stage, correct the evaluation policy and fixture justification before implementing the prompt. Do not tune runtime behavior against an incoherent oracle.

## 5. Add deterministic red tests

Create purpose-commented tests covering the application contract independently of model quality:

- Strict acceptance of a complete valid object.
- Rejection of every missing required field.
- Rejection of unsupported mode values and wrong types.
- Rejection of blank reason or response.
- Rejection of surrounding prose or malformed JSON.
- Visible invalid-output state with no guessed mode.
- All four room-mode transition combinations.
- Human rectification in both directions.
- Independent wording edits without mode changes.
- Preservation of raw AI wording versus final message wording.
- Stale state-version rejection.
- Atomic rollback when message, state, or audit persistence fails.
- Real-time mode update handling.
- Student progression rejection while Guard is active.
- Corrective message posting while locked.
- Progress unlock after a reviewed Tutor response.
- Security Supervisor identity and absence of a student-visible `Guard Mode` label.
- Existing tutoring UI behavior outside Guard state.

These tests should be red because the production contract, schema, and UI do not yet implement the behavior.

## 6. Implement the shared TypeScript contract and strict validator

Introduce the smallest shared TypeScript definitions and validator needed by the service, context, and UI.

The validator must:

- Parse only the documented structured result.
- Return a typed `AISuggestion` only after complete validation.
- Preserve the provider’s raw output in error/evaluation evidence.
- Produce a specific failure suitable for the tutor UI and logs.
- Never derive a mode from the suggested response.
- Never substitute the current room mode when output is invalid.

Update `generateTutorSuggestion` to return the typed object plus the existing context/config metadata. Update callers so text-only results cannot enter the review flow.

## 7. Update the production prompt and context assembly

Extend the existing production prompt path rather than introducing a Guard-only provider path.

Supply the model with:

- Current conversation history.
- Relevant checklist and guidance context.
- Current room mode.
- The semantic activation, persistence, and exit policy.
- Protected indicators of confusion, effort, partial improvement, and clarification-seeking.
- Guard tone and safety constraints.
- The required structured output contract.
- A requirement to choose a mode anew from the current evidence every turn.
- A prohibition on using a fixed mistake or violation counter.

The four-violation scenario may appear as an example, paired with contrasting repeated-error examples showing why count alone is insufficient.

Retain the existing provider and generation configuration. Save a version or hash of the final prompt in evaluation evidence and available audit metadata.

Run schema and Promptfoo evaluations after this step. Do not start UI implementation until the contract cases and critical AI behavior cases pass.

## 8. Add the append-only Supabase migration

Add a new migration based on the existing schema and RLS conventions.

The room record should gain fields equivalent to:

- `active_response_mode`
- `guard_state_version`
- `guard_state_changed_at`
- `guard_state_changed_by`
- `guard_source_message_id`

The message record should gain fields equivalent to:

- `response_mode` for the final reviewed mode
- `ai_mode`
- `ai_mode_reason`
- `ai_suggested_response`
- `ai_contract_version`
- `ai_raw_output` or an equivalent lossless structured audit field
- `mode_reviewed_by`
- `mode_reviewed_at`
- `mode_was_rectified`

Student and historical messages may leave AI-review fields null. Reviewed AI tutor messages must satisfy database constraints requiring the raw and final fields.

Add an append-only transition table containing:

- room identifier;
- source message identifier;
- previous and next mode;
- source classification: accepted AI decision, human rectification, or human manual selection;
- tutor actor;
- contract/prompt metadata reference where available;
- creation timestamp.

Backfill existing rooms to `tutoring`, backfill historical tutor messages only where a safe final-mode interpretation exists, then enforce the new constraints. Do not fabricate raw AI reasons for old messages.

Apply RLS so students can read the current mode and relevant final messages but cannot write mode, raw AI audit fields, or transition records. Raw AI reasons and provider output should remain tutor/audit-visible, not student-visible.

## 9. Implement the atomic reviewed-send path

Add the transactional Supabase operation and update the service layer to call it.

Inputs should include:

- room identifier;
- expected state version;
- final edited text;
- final reviewed mode;
- raw AI mode, reason, response, and contract metadata;
- enough information to classify acceptance versus rectification.

The server must derive the authenticated reviewer rather than trusting a client-supplied user identifier.

Update `RoomContext` so it owns:

- the validated raw `AISuggestion`;
- editable response text;
- editable final mode;
- rectification state;
- loading, invalid-output, stale-review, and persistence-error states;
- regeneration and rejection behavior;
- the committed room mode received from Supabase.

Clear the draft only after the transaction succeeds. On stale state, retain the human’s edited text, refresh authoritative state, and require review before retrying.

## 10. Implement tutor review controls

Update `AISuggestionBox` and `CommentInput` as one review flow:

- Show the AI-proposed mode and raw `mode_reason` to the tutor.
- Initialize the final-mode control from the AI mode.
- Let the tutor switch between Tutor and Guard.
- Keep wording editing independent from mode selection.
- Preview the Security Supervisor identity and Guard presentation whenever the final draft mode is `guard`.
- Show `Guard Mode Activated` when the committed active room mode is `guard`.
- Clearly distinguish proposed mode from final selected mode.
- Preserve existing copy-to-input, regenerate, reject, and send behavior where compatible.
- Disable send for invalid AI output, empty final wording, stale review state, or an in-flight transaction.
- Keep regeneration from erasing a human-edited draft without an explicit user action.

The mode control serves manual activation, manual deactivation, and rectification. Sending applies the selected mode atomically.

## 11. Implement student-visible Guard presentation

Update `PostComment` and related styles so final messages with `response_mode = guard` render as Security Supervisor:

- Fixed display name.
- Fixed shield profile image.
- Distinct but accessible visual treatment.
- Firm response presentation.
- No `Guard Mode` label.
- No `mode_reason`, raw AI output, rectification marker, or internal audit metadata.

Tutor-mode responses must retain their current identity and appearance.

Historical rendering must use each message’s final persisted `response_mode`, not the room’s current state. Otherwise old Guard messages would incorrectly change appearance after the room returns to tutoring.

## 12. Enforce progress lock and real-time synchronization

Subscribe tutor and student room views to authoritative room-mode changes and message inserts.

While mode is `guard`:

- Disable student progression/completion controls with a concise explanation tied to the Security Supervisor’s requested correction.
- Continue allowing corrective student messages and normal room refresh/reconnect.
- Reject direct or stale progression writes in the Supabase-backed progression path.
- Keep the lock after inadequate corrections because student messages alone do not change mode.

When a semantically correct correction causes the AI to propose `tutoring` and the tutor sends that reviewed response:

- Atomically persist the Tutor message.
- Change room mode to `tutoring`.
- Publish the real-time room update.
- Re-enable progression without requiring a separate manual reset.

Handle reconnects by loading the persisted room mode before enabling progression; do not assume tutoring while the subscription initializes.

## 13. Close deterministic and database integration tests

Run the contract, transition, service, context, component, migration, RLS, real-time, and progression tests.

Add integration coverage for:

- Accepted AI Guard activation.
- Human activation after an AI tutoring proposal.
- Human deactivation after an AI Guard proposal.
- Guard persistence across multiple student messages.
- Correct exit and unlock.
- Two clients receiving the same committed state.
- Stale or concurrent tutor submissions.
- Unauthorized student attempts to mutate mode or progression.
- Message insert or state update failure rolling back the complete transaction.
- Old Guard messages retaining Security Supervisor presentation after the room unlocks.
- Existing rooms and tutoring messages continuing to work.

Critical contract and transition tests must pass at 100%.

## 14. Run the full Promptfoo gates

Run both ecological and synthetic-holdout suites using the unchanged provider configuration.

The gate must demonstrate:

- Every result has valid structured output.
- All critical system-playing cases activate Guard.
- All critical confusion, effort, partial-improvement, and clarification cases avoid Guard.
- All critical inadequate corrections remain Guard.
- All critical semantic corrections exit Guard.
- Guard responses identify the correction and concrete next action.
- Guard safety cases pass.
- Every new general metric meets at least the configured 80% threshold.
- All existing tutoring metrics continue meeting their current per-metric and per-suite thresholds.
- No applicable score is missing.

If a gate fails, record the failing input/output and whether the cause is the policy, fixture, prompt, parser, or provider behavior. Any evaluation-policy revision must remain justified by the product intent and be rerun on both suites.

## 15. Run live production-path Qwen validation

Exercise the actual application generation path with Qwen, not a mocked or evaluation-only prompt.

Cover at least:

- Normal tutoring.
- Protected repeated-error behavior.
- Deliberate activation.
- Multi-turn Guard persistence.
- Semantic correction and exit.
- Structurally invalid-output handling where the provider can be safely stubbed at the boundary.

Preserve full input/output/model/prompt/configuration/result metadata. Confirm that evaluation and production use the same prompt construction and structured parser.

## 16. Run browser-level end-to-end validation

Use separate tutor and student browser sessions against test rooms.

Validate:

1. A student sends deliberate system-playing content.
2. The tutor receives a structured Guard suggestion.
3. The tutor sees the reason, edits wording, and sends.
4. The student sees Security Supervisor styling without a `Guard Mode` label.
5. The tutor sees `Guard Mode Activated`.
6. Student progression is disabled, including after refresh or reconnect.
7. An inadequate correction produces another Guard suggestion and leaves the lock active.
8. A semantic correction produces a Tutor suggestion.
9. Sending the reviewed Tutor response changes both clients in real time and unlocks progress.
10. The tutor can rectify Tutor to Guard and Guard to Tutor.
11. Raw AI response, edited final response, raw mode, final mode, reviewer, and transition audit are persisted correctly.
12. Existing non-Guard tutor-room behavior still works.

Capture screenshots or browser artifacts for the main tutor and student states, plus identifiers linking the run to its test room and persisted audit records.

## 17. Update documentation and publish delivery evidence

Update the Promptfoo README and the nearest AI/testing documentation with:

- The structured response contract.
- How to add ecological and synthetic-holdout cases for future AI behaviors.
- How to mark critical cases.
- Required metadata for reproducibility.
- Gate thresholds and missing-result behavior.
- How to run deterministic, Promptfoo, live-Qwen, and browser validation.
- How to diagnose a schema, behavior, regression, or production-path failure.
- The rule that provider/model/configuration changes require explicit review rather than silent fallback.

Document the Security Supervisor identity, authoritative room state, human rectification behavior, progression locking, and audit model.

The final delivery record should include the baseline, red-test evidence, final test logs, Promptfoo metric results, production-path metadata, browser artifacts, migration result, and any changed factors that could affect the experiment: prompt text/version, output format, context construction, evaluation fixtures, scoring rules, thresholds, or model configuration.

# Risks and Mitigations

- **Evaluation policy encodes an incomplete or biased understanding of system-playing.**  
  Mitigation: justify each fixture, include contrasting cases with identical mistake counts but different intent, keep development and holdout suites distinct, and correct ambiguous policy before prompt tuning.

- **The model learns fixture wording instead of the intended semantics.**  
  Mitigation: use independently worded holdout cases, paraphrased valid corrections, unexpected wording, and equal-count contrast cases.

- **Guard produces false positives against struggling students.**  
  Mitigation: make confusion, effort, partial improvement, and clarification critical 100% cases rather than aggregate-only metrics.

- **Guard exits on superficial keyword copying.**  
  Mitigation: include negative correction cases that repeat expected words without performing the required semantic correction.

- **Structured output intermittently fails in production.**  
  Mitigation: use one strict parser in evaluation and runtime, surface failure visibly, preserve raw output, allow regeneration, and prohibit inferred fallback modes.

- **Human edits or rectification are lost.**  
  Mitigation: persist raw AI mode/reason/response separately from the final message content and reviewed mode; test both directions of rectification.

- **Message and room state diverge.**  
  Mitigation: commit message, room state, and transition audit in one server-side transaction with rollback tests.

- **Concurrent or stale reviews overwrite newer state.**  
  Mitigation: use a room state version and reject stale writes while retaining the tutor’s draft for renewed review.

- **Progress can be bypassed through direct requests.**  
  Mitigation: enforce the lock in the authoritative Supabase progression write path as well as the UI.

- **Students become unable to submit the correction needed to exit Guard.**  
  Mitigation: lock only progression/completion actions; continue allowing room messages.

- **Historical messages render using the wrong identity after a mode transition.**  
  Mitigation: render each message from its persisted final `response_mode`, never from current room mode.

- **Raw reasoning or audit data leaks to students.**  
  Mitigation: restrict fields through RLS/service projections and test that student clients receive only final student-visible data.

- **Real-time subscription delay temporarily enables progress.**  
  Mitigation: initialize from persisted room state and keep progression unavailable until authoritative state has loaded.

- **Existing tutoring quality regresses.**  
  Mitigation: preserve the eight existing metrics and run them in both ecological and synthetic-holdout suites as blocking gates.

- **Evaluation failures cause unreviewed configuration drift.**  
  Mitigation: record model/provider/prompt/configuration metadata and block silent fallback, threshold reduction, skipped assertions, or provider substitution.

- **Universal artwork creates accessibility or identity concerns.**  
  Mitigation: use a neutral shield emblem, accessible alt text, sufficient contrast, and no human demographic representation.

# Validation Criteria

Implementation is complete only when all of the following are evidenced:

## AI contract and behavior

- Every successful AI suggestion contains validated `mode`, `mode_reason`, and `suggested_response`.
- Every malformed response fails visibly and never receives a guessed mode.
- Decisions differ appropriately for equal mistake counts with different semantic intent.
- The deliberate four-violation example can activate Guard without implementing a four-count rule.
- Critical confusion, effort, partial-improvement, and clarification cases remain tutoring.
- Guard persists for every critical inadequate-correction case.
- Guard exits for every critical semantically correct correction case, including paraphrases.
- Guard responses identify the unresolved correction and one concrete next action.
- Guard responses pass all insult, threat, humiliation, and personal-attack exclusions.
- Existing tutoring quality metrics retain their current thresholds.

## Human review and persistence

- The tutor can accept or rectify either proposed mode and edit wording independently.
- Manual activation and deactivation work through the reviewed send flow.
- Raw AI response, raw mode, raw reason, final mode, final text, reviewer, timestamp, and rectification status are queryable for each reviewed message.
- Every room-mode change has an append-only transition record.
- The final message, room state, and transition history commit or roll back together.
- Stale concurrent review attempts are rejected without silently losing the tutor’s edits.

## UI, identity, and progression

- Guard messages display as Security Supervisor with the fixed shield asset and distinct accessible styling.
- Students never see an explicit `Guard Mode` label or raw decision reason.
- Tutors see `Guard Mode Activated` while the committed room state is Guard.
- Historical Tutor and Guard messages retain their persisted identities after later state changes.
- Progression is blocked in both the client and authoritative backend while Guard is active.
- Corrective messages remain available.
- Refresh, reconnect, and real-time updates preserve the correct lock state.
- A reviewed Tutor response after semantic correction unlocks progression without a separate reset.
- Existing tutor and student room behavior remains intact when the room is tutoring.

## Test and evaluation gates

- All critical schema, transition, persistence, authorization, and UI tests pass at 100%.
- Both ecological and synthetic-holdout Promptfoo suites meet every critical and general threshold.
- No applicable evaluation result is missing.
- All eight existing tutoring metrics continue to pass at their established per-metric and per-suite thresholds.
- Live-Qwen tests use the production prompt and parser path with unchanged reviewed provider configuration.
- Browser tests demonstrate activation, persistence, correction, exit, rectification, real-time synchronization, audit persistence, and progress lock/unlock.
- Saved evidence includes complete inputs, outputs, expected results, model/provider/configuration, prompt/contract version, timestamps, metric results, and browser/test-room identifiers.
- Documentation explains how future AI behaviors must add and pass corresponding evaluations before delivery.