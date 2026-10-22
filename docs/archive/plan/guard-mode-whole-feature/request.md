# Guard Mode implementation request

## Intent

Create an executable implementation plan for adding a second AI role, Guard Mode, to the existing phishing-training tutor system. The plan must make AI behavior evaluation a blocking part of delivery and must fit the current React + TypeScript + Supabase architecture.

## Goal and intended outcome

For every AI tutor suggestion, the AI returns a machine-consumable mode decision: `tutoring` or `guard`, together with the raw decision reason and suggested response. The human tutor reviews the AI draft, may edit wording, and may rectify the mode. The final response is delivered through the existing tutor room interface.

Guard Mode must visibly use one universal, prebuilt Guard identity for students, lock student progress until meaningful correction, persist while the AI continues selecting Guard, and automatically return to tutoring when the student demonstrates correction. The human tutor can also activate, deactivate, or rectify the mode.

## In scope

- Structured AI response contract for per-turn mode decision, decision reason, and suggested response.
- Prompt/context changes for semantic Guard activation, persistence, and exit.
- Universal Guard identity: fixed display name, profile image, and response presentation.
- Existing tutor-room UI changes in `tutor-system/src/pages/RoomPagePost.tsx`, `src/components/AISuggestionBox.tsx`, `src/components/CommentInput.tsx`, `src/components/PostComment.tsx`, and related styles.
- Human review of every AI suggestion, wording edits, and human mode rectification.
- Student-visible Guard persona and progress lock/unlock behavior.
- Supabase persistence for final message mode, active room Guard state, raw AI decision, human rectification, and audit metadata.
- Real-time state synchronization for tutor and student views.
- Promptfoo ecological and synthetic-holdout evaluation for new Guard behavior.
- Deterministic schema, transition, persistence, and UI tests.
- Live production-path Qwen evaluation and browser-level end-to-end validation.
- Documentation for how to add evaluations for future AI behaviors and updates to nearby AI/testing documentation.

## Out of scope

- A separate teacher review dashboard or dashboard pending-review indicator.
- Teacher availability/offline handling; the tutor is assumed to be present.
- A configurable Guard profile per room; the profile is universal.
- Hardcoded violation counters or a hardcoded four-violation production trigger.
- Automatic runtime fallback from invalid AI mode output to a guessed mode.
- Replacing the existing tutoring response behavior or existing tutoring metrics.

## Known repository context

- The active room UI is `tutor-system/src/pages/RoomPagePost.tsx`.
- `AISuggestionBox` currently displays a suggestion and supports copy-to-input, regenerate, and reject.
- `CommentInput` is the existing human editing and send path.
- `RoomContext` owns AI suggestion state, message sending, and feedback recording.
- Messages currently have `user_role` and AI fields but no final Tutor/Guard response-mode field.
- Current AI suggestion generation is text-only and `generateTutorSuggestion` returns a string suggestion plus context/config metadata.
- Current Promptfoo evaluation is documented in `evals/promptfoo/README.md`; the active gate covers eight tutoring metrics at 80% per metric and per suite.
- Existing live tutor behavior tests use the production prompt path and Qwen3.5 Flash.
- Existing browser demos create test rooms and evaluate the current AI suggestion UI.

## Constraints

- Use the existing React + TypeScript + Supabase architecture and current Qwen provider path.
- Preserve the current tutoring behavior and regression gates.
- Mode decisions must be structured and validated before downstream use.
- Do not silently change experiment/model configuration when evaluation fails.
- Every AI behavior change must pass the relevant evaluation before feature completion.
- The human tutor edits wording and can rectify mode; the AI/system evaluates student correction and proposes the next mode.
- Guard wording is firm, direct, and action-focused, but must not insult, threaten, humiliate, or attack the student personally.
- The student should recognize Guard only from its universal name/profile/appearance and response style, not from an explicit `Guard Mode` label.
- The teacher interface should display `Guard Mode Activated` when the final reviewed response is Guard.
- If code is changed, implementation must use the repository-required fast multi-agent TDD workflow.
- New tests need purpose comments and edge-case coverage; refactoring requires mypy validation where applicable.

## Acceptance and validation criteria

### AI contract and behavior

- Every AI suggestion has valid structured `mode`, `mode_reason`, and `suggested_response` fields.
- Mode is chosen independently on every turn and is not derived from a hardcoded counter.
- Deliberate system-playing behavior can activate Guard, including the four-consecutive-violation example.
- Genuine confusion, effort, partial improvement, or clarification-seeking does not trigger Guard merely because the student has made repeated mistakes.
- Guard persists through inadequate corrections and exits after semantically correct correction.
- Guard responses explicitly identify the required correction and give a concrete next action.
- Tutoring responses retain existing tutoring rubric quality.

### Human review and persistence

- Tutor can keep or rectify each AI mode decision before sending.
- Wording edits are preserved separately from the raw AI suggestion.
- Raw AI mode/reason/response and final human mode/response are auditable.
- Final sent messages preserve whether they were Tutor or Guard responses.
- Human can manually deactivate Guard Mode.
- Invalid structured AI output fails visibly and does not silently guess a mode.

### UI and student progression

- Existing tutor composer previews the universal Guard profile and response when final mode is Guard.
- Tutor view shows `Guard Mode Activated` for an active Guard response.
- Student sees the universal Guard identity and distinct response presentation.
- Student progression is locked while Guard is active.
- Inadequate correction keeps the student locked and Guard active.
- Correct correction returns the student to tutoring and unlocks progress.
- Existing tutor and student room behavior remains intact outside Guard Mode.

### Evaluation gates

- Deterministic schema/transition/persistence/UI tests pass at 100% for critical state behavior.
- Critical false-positive learning cases do not escalate to Guard.
- Critical valid-correction cases exit Guard.
- New Promptfoo metrics meet the repository quality threshold, with no missing applicable results.
- Existing tutoring metrics continue to meet their current threshold in ecological and synthetic-holdout suites.
- Production-path live tests and browser tests preserve full input/output/model/prompt/result metadata.

## Assumptions

- `mode_reason` is stored for audit and teacher review but is not shown to the student.
- The final mode applied to the room is the human-reviewed mode, not the raw AI mode, so human rectification is authoritative for that turn.
- The AI evaluates correction from the conversation and checklist/guidance context; exact wording is not required.
- The universal Guard identity can be implemented as a static application asset/configuration rather than user-created data.
- Existing Supabase migrations are append-only; current schema files/migration history are the source of truth for a new migration.
- Existing Promptfoo evaluation infrastructure can be extended to parse and score structured output without changing provider credentials.
- The default critical behavior threshold will be 100% for schema and critical transition/false-positive cases, with the existing 80% general metric gate retained unless a reviewed evaluation artifact establishes a stricter metric-specific threshold.

## Unresolved questions

- Exact universal Guard display name and artwork are delegated to the implementation/design plan; working name: `Security Supervisor`.
- Exact database shape for active Guard room state versus per-message audit is an implementation decision; it must avoid losing raw/final mode history.
