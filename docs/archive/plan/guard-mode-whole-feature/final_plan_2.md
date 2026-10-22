# Guard Mode: whole-feature implementation plan

## Outcome

Add a second AI response role, Guard Mode, without replacing the existing tutor workflow:

```text
student turn
  -> AI returns one validated mode decision
  -> tutor reviews wording and mode
  -> one atomic send operation
       -> final message
       -> current room mode
       -> audit record
  -> tutor and student views synchronize
  -> student progress is locked only while current mode is guard
```

The implementation must preserve the existing tutoring behavior and make the new AI behavior unevaluable only if it passes the existing tutoring gates plus new Guard-specific gates. A malformed AI result, stale review, unauthorized state change, or incomplete persistence must fail visibly and block the operation.

No production code is changed by this plan. Implementation should begin only after this plan is accepted, using the repository’s required `$fast-multi-agent-tdd` workflow.

## Repository fit

The feature should extend the current flow rather than introduce a parallel chat system:

- `tutor-system/src/contexts/RoomContext.tsx` owns AI generation, suggestion state, message sending, and real-time room/message behavior.
- `tutor-system/src/components/AISuggestionBox.tsx` is the tutor’s AI review surface.
- `tutor-system/src/components/CommentInput.tsx` is the editable composer and send path.
- `tutor-system/src/components/PostComment.tsx` renders persisted message identity and presentation.
- `tutor-system/src/pages/RoomPagePost.tsx` is the active tutor/student room view, despite the broader `TutorView` dashboard name.
- `tutor-system/src/types/index.ts` owns the shared `Room`, `Message`, and AI-related TypeScript types.
- `tutor-system/supabase/migrations/` owns append-only database changes.
- `evals/promptfoo/README.md`, `tutor-system/claude_docs/aiService.md`, and `tutor-system/claude_docs/testing-strategy.md` document the current AI and testing gates.

The repository has historical schema variants and permissive policies in some consolidated SQL files. The new migration must target the active migration state, validate the actual database, and not treat `combined_schema.sql` or `final_schema.sql` as a second runtime source of truth.

## Product contract

### Modes and authority

There are exactly two modes:

```ts
type ResponseMode = 'tutoring' | 'guard';
```

AI chooses a mode on every generated suggestion. The decision is semantic, not a violation counter. “Four consecutive violations of the same explicit guidance” is an example activation signal and a critical evaluation case, not production logic.

The authority chain is:

1. AI raw decision: recommendation only.
2. Tutor review draft: editable wording and selectable final mode.
3. Persisted final message and room state: authoritative product outcome.

A wording edit does not change the selected mode. A mode change by the tutor is a rectification and is recorded separately from wording edits.

AI may recommend returning to tutoring after a semantically adequate correction. The tutor still reviews and sends that response. A human tutor may activate or deactivate Guard directly through an audited control; direct manual deactivation does not require inventing a student-visible message.

### AI decision contract

Every usable AI suggestion must contain exactly the validated semantic fields:

```ts
interface AISuggestionDecision {
  mode: ResponseMode;
  mode_reason: string;
  suggested_response: string;
}
```

`mode_reason` is tutor/audit-only. It must not be included in the student message, student view model, HTML attributes, or browser-visible diagnostic data.

The runtime boundary must reject malformed JSON, prose wrappers, unknown modes, missing fields, nulls, non-string fields, and empty or whitespace-only values. It must never infer a mode from the response text and must never silently default to tutoring or Guard.

### Guard behavior

The AI should recommend Guard when the student appears to be deliberately playing with the system, intentionally disregarding an explicit correction, manipulating the interaction, or refusing to perform the required learning behavior.

It should remain in tutoring for repeated genuine mistakes, confusion, partial improvement, visible effort, clarification-seeking, and ordinary learning difficulty.

While Guard is active:

- an inadequate or evasive correction keeps the room in Guard;
- a semantically adequate correction can return the next reviewed response to tutoring;
- the response identifies the required correction and gives a concrete next action;
- tone is firm and direct, never insulting, threatening, humiliating, or personally attacking;
- student communication remains available;
- only the existing progression/completion mutation is blocked.

### Human tutor behavior

The tutor reviews every usable AI suggestion. The review surface must make it possible to:

- see the raw AI mode and reason;
- edit the wording;
- select the final mode independently of wording;
- accept, regenerate, reject, or send;
- see whether the mode or wording was changed;
- manually activate or deactivate Guard.

When the final reviewed mode is Guard, the tutor interface shows exactly `Guard Mode Activated`.

There is no pending-review dashboard or teacher-availability behavior in this feature.

### Universal Guard identity

Use one application-owned identity everywhere Guard is rendered:

- display name: `Security Supervisor`;
- one static profile asset, not a user-created account or room setting;
- a distinctive dark navy/charcoal visual treatment with a high-contrast amber warning accent;
- a simple angular shield-and-check/lock mark that is recognizable at message size;
- accessible alt text and a stable test selector.

The identity should communicate authority at a glance without implying a real person. Students recognize Guard only through the changed name, profile, visual treatment, and response. Do not render a student-facing `Guard Mode` label or badge.

## Architecture decisions

### 1. Use one narrow pure state machine

Create a small domain module, separate from React, Supabase, and the model provider, with:

```ts
type GuardState = 'tutoring' | 'guard';

interface GuardTransitionInput {
  currentMode: GuardState;
  finalMode: ResponseMode;
  source: 'reviewed_response' | 'manual_override';
  actorId: string;
  expectedRevision: number;
}
```

Its responsibilities are limited to transition calculation, rectification/edit flags, and `canStudentProgress` derivation.

Invariants:

- drafts, regeneration, copying, editing, and rejection do not change room mode;
- sending final `guard` sets the room to Guard;
- sending final `tutoring` sets the room to tutoring;
- manual activation/deactivation changes the room only after authoritative persistence succeeds;
- Guard means progress locked; tutoring means progress allowed;
- repeated same-mode decisions do not corrupt the audit history;
- message presentation uses the message’s persisted final mode, never the room’s current mode.

### 2. Keep a single current room projection

Extend the existing `rooms` row because it already owns the room’s active state and tutor relationship. The room row is the single authoritative Guard projection; do not introduce a second room-state table or a Boolean representation. Add one constrained current mode and one monotonic revision, for example:

- `active_response_mode` constrained to `tutoring | guard`;
- `guard_state_revision` used for stale-write detection;
- last transition timestamp/actor/source;
- related message ID when a sent response caused the transition.

Before writing the migration, inventory every existing progression mutation and make each one consult the room row. Session-specific progression may continue to be stored in its existing owner, but Guard permission is always read from the joined room projection. Do not persist both a mode and an independent `guard_active` Boolean.

### Imported contribution crosswalk

The final plan deliberately combines bounded contributions from the judged candidates. The source and insertion point are explicit:

| Source | Imported contribution | Insertion point | Compatibility decision |
|---|---|---|---|
| `plan/guard-mode-whole-feature/candidates/plan_2.md` | baseline capture, versioned behavior contract, ecological/holdout separation, equal-error-count contrasts, critical gates, and failure classification | Phase 0 steps 2–4; Phase 7 steps 33–36; Evaluation design | Keep; strengthens release evidence without making stochastic results block deterministic implementation work. |
| `plan/guard-mode-whole-feature/candidates/plan_3.md` | existing suggestion/composer boundary, stable suggestion IDs, lifecycle dispositions, draft retention after send failure, regeneration/rejection edge cases | Phase 5 steps 22–26; Expected files and ownership; audit persistence design | Keep; raw evidence remains immutable and the final message/room row remain authoritative. |
| `plan/guard-mode-whole-feature/candidates/plan_4.md` | monotonic revision, stale-write rejection, stale realtime-event suppression, reconnect refetch, and cross-room/student privacy tests | Architecture decisions 4–6; Phase 3 steps 13–17; Phase 6 steps 28–31 | Keep only these bounded controls. Reject event sourcing, replay/rebuild infrastructure, a second event-store authority, and `correction_evaluated` as a separate fact. |

The selected backbone is `plan_1.md` because its pure two-state transition model is the only source-of-truth design. The imported items above are adapters, evaluation discipline, or concurrency controls; none creates a competing transition or persistence authority.

### 3. Separate immutable raw suggestion evidence from final outcome

For each valid generated suggestion, retain a stable suggestion ID and immutable generation data:

- raw validated mode, reason, and suggested response;
- provider/model/prompt/configuration metadata already available in the production path;
- generation timestamp, duration, and result status;
- room and triggering context identifiers.

Retain lifecycle evidence for accepted, wording-edited, mode-rectified, rejected, and superseded/regenerated suggestions. A disposition may be recorded in a constrained action/status field or separate append-only action rows, but it must not overwrite raw evidence.

For sent tutor messages, persist the student-safe final fields:

- final response content and final response mode;
- a source suggestion ID when AI-generated.

Keep raw AI mode, reason, suggested response, wording/edit and rectification flags, reviewer data, and provider/model/prompt/configuration metadata in a tutor-only suggestion audit record linked to the message. Do not put those fields on a student-readable `messages` projection.

Legacy and non-AI messages may retain a null response mode and continue to render as ordinary tutoring messages.

### 4. Make reviewed send atomic

Create one database transaction boundary/RPC for a reviewed send. It must:

1. authorize the tutor for the room;
2. validate the final mode, final content, raw fields, and source suggestion;
3. compare `expectedRevision` with the current room revision and reject stale reviews;
4. insert the student-safe final message;
5. insert the linked tutor-only suggestion audit record;
6. update the current room mode and increment the revision;
7. write a transition audit record when the mode changes and when policy requires a same-mode Guard decision record;
8. return the created message and authoritative room projection.

If any step fails, none of the message, room, or transition writes commit, and the tutor’s draft remains available for retry.

Manual activation and deactivation use a separate but equivalent audited operation with the same authorization and revision rules.

### 5. Enforce progress locking twice

The client derives the lock from the authoritative room mode and disables the existing progression/completion control with an accessible explanation. The authoritative progression mutation must also reject attempts while Guard is active. Comments, clarification, and correction submissions remain enabled.

This is a lock on further learning progress, not a lock on communication.

### 6. Keep real-time state monotonic

Every room-state payload carries the revision. Consumers ignore older revisions and refetch authoritative state after reload or reconnect. The successful write response is applied immediately, then real-time events reconcile it. No client-only Boolean is authoritative.

## Ordered implementation work

### Phase 0 — baseline and executable specification

1. Start the required `$fast-multi-agent-tdd` workflow and divide work by observable contract: domain/schema, persistence/security, React review/composer, student rendering/locking, and AI evaluation. During this setup, inventory the existing room/session progression mutations, realtime subscriptions, and active migration state. Settle the room row as the Guard authorization boundary before any contract or type freeze; every progression mutation must consult it.
2. Record the current tutoring baseline before changes: commit, provider, model, prompt/configuration, existing eight Promptfoo metrics, live-Qwen results, browser results, and known failures.
3. Map each product requirement to deterministic tests, Promptfoo ecological cases, synthetic holdouts, live-Qwen cases, and browser scenarios.
4. Freeze the structured output contract, mode transition table, identity contract, audit fields, privacy boundary, and evaluation thresholds before prompt tuning.

### Phase 1 — red tests for contracts

5. Add failing schema tests for valid modes and all malformed-output cases. These are critical 100% checks.
6. Add failing pure state-machine tests for:

   | Current mode | Final reviewed action | Next mode | Progress |
   |---|---|---|---|
   | tutoring | tutoring response | tutoring | unlocked |
   | tutoring | Guard response | guard | locked |
   | guard | Guard response | guard | locked |
   | guard | tutoring response | tutoring | unlocked |
   | tutoring | manual activation | guard | locked |
   | guard | manual deactivation | tutoring | unlocked |

7. Add edge cases for both rectification directions, independent wording edits, no-transition draft actions, invalid decisions, inadequate versus adequate correction, same-mode decisions, stale revisions, unauthorized actors, legacy messages, and historical Guard presentation.
8. Add failing persistence/RLS tests for atomic rollback, raw-field immutability, final-mode authority, duplicate sends, stale review rejection, manual audit, cross-room access, student mutation attempts, and real-time revision ordering.

### Phase 2 — shared runtime contracts

9. Add shared `ResponseMode`, AI decision, review draft, sent-message audit, room projection, and transition types in the existing type layer.
10. Add one runtime validator at the provider boundary. Evaluation code must consume the same contract or shared conformance fixtures; it must not implement a competing parser.
11. Change the AI service result from text-only to validated decision plus existing production metadata. Preserve raw provider diagnostics for audit/debugging, but do not expose prompts or internal reasons to students.
12. Implement the pure Guard transition module and run its targeted unit suite before integrating React or Supabase.

### Phase 3 — database and persistence

13. Add an append-only migration using the project’s current migration numbering. Add the constrained room mode/revision, student-safe message final fields, tutor-only suggestion audit storage, suggestion lifecycle storage, and compact tutor-only transition audit storage.
14. Add indexes and foreign keys for room, message, tutor, suggestion, and chronological audit access. Preserve nullable fields for legacy records.
15. Add one explicit student-safe read boundary: create a `student_messages` database view and route every student message read through it. The view returns only message content, sender-safe identity, timestamps, and final response mode. Revoke direct access to base-table raw audit columns/tables for student roles, grant student read access only to the view, and test direct attempts to read raw reason, raw response, prompt/configuration data, reviewer data, and transition audit data. Add RLS/grants so only an authorized tutor or trusted server operation can change mode/audit fields.
16. Add the atomic reviewed-send RPC and manual override operation. Use one transition implementation and one source of truth; do not add hidden triggers that independently derive mode.
17. Add the TypeScript service adapter and integration tests. On stale revision or persistence error, preserve the review draft and show an actionable error.

### Phase 4 — AI decision and prompt behavior

18. Update the existing production prompt to request only the structured contract and provide current room mode, recent dialogue, explicit guidance, and active Guard correction context.
19. Encode semantic policy in the prompt: deliberate system play/refusal can activate Guard; confusion, effort, partial improvement, and clarification must not; inadequate correction persists Guard; semantically adequate correction can exit; no fixed violation count.
20. Require Guard responses to state the correction and next action in a firm, safe tone. Preserve all existing tutoring rubric instructions.
21. Run deterministic prompt-contract tests and an initial red Promptfoo/live-Qwen evaluation before treating prompt work as complete. Classify failures as contract, policy, fixture/oracle, prompt, provider, or integration failures; never silently change model, provider, prompt inputs, temperature, fixtures, or thresholds.

### Phase 5 — tutor review and composer

22. Extend `RoomContext` to hold validated raw decision, human review draft, loading/error state, suggestion ID, final mode, and lifecycle disposition. Do not add a second independent Guard Boolean.
23. Update generate/regenerate/reject/copy/send behavior:

   - generation creates a fresh suggestion ID and review draft;
   - regeneration supersedes the old draft without merging raw audit data;
   - copying carries wording and final mode;
   - wording edits alter only final response content;
   - mode selection alters only final mode and marks rectification when applicable;
   - reject records disposition without changing room state;
   - send calls the atomic reviewed-send operation;
   - failed send retains the draft;
   - success adopts the returned room state and message.

24. Update `AISuggestionBox` to show raw mode, tutor-only reason, suggested wording, final-mode control, rectification/edit indicators, regeneration, rejection, and structured-output errors. Show `Guard Mode Activated` whenever the reviewed final response is Guard.
25. Update `CommentInput` so the tutor previews the final sender identity and response style. Guard mode previews the universal `Security Supervisor` profile and keeps the text editable. Disable send when there is no validated decision, empty final content, invalid mode, or an in-flight request.
26. Add explicit tutor controls for manual Guard activation/deactivation. Both operations require confirmation where appropriate, carry expected revision, and write an audit record. A manual override must not alter old messages.

### Phase 6 — student rendering and lock

27. Update `PostComment` and message view models to render from each message’s persisted final mode:

   - Guard: `Security Supervisor`, universal image, and distinct style;
   - tutoring: existing tutor identity/style;
   - legacy tutor with null mode: existing tutoring presentation;
   - student/other messages: unchanged.

28. Verify the database read boundary and student view model exclude raw reason, raw response, rectification flag, provider metadata, prompt/configuration data, reviewer data, and internal audit fields from student reads, content, and DOM.
29. In `RoomPagePost`, subscribe tutor and student views to the authoritative room projection. Show the tutor status text; do not show a mode label to students.
30. Locate every existing student progression/completion mutation and enforce `active_response_mode !== 'guard'` at the service/database boundary. Disable only those controls in the UI; leave chat/correction available.
31. Implement revision-aware realtime reconciliation and reload/reconnect refetch for both views.

### Phase 7 — full validation and documentation

32. Add deterministic end-to-end integration tests for provider output → validator → tutor review → atomic send → room transition → message rendering → lock.
33. Extend Promptfoo while preserving all existing tutoring metrics. Add schema validity, semantic activation, false-positive avoidance, Guard persistence, semantic exit, correction specificity, next-action quality, safe tone, and no-counter-dependence metrics.
34. Use both ecological conversations and independent synthetic holdouts. Include deliberate play, manipulation, refusal, repeated confusion, effort, partial improvement, clarification, inadequate correction, evasive correction, paraphrased valid correction, and equal-error-count contrasts.
35. Require 100% for schema validity and designated critical activation/false-positive/persistence/exit cases. Retain the existing 80% per-metric/per-suite gate for general metrics unless a reviewed evaluation artifact sets a stricter threshold. Missing applicable results fail.
36. Run live Qwen through the existing production path with unchanged configured provider/model behavior. Retain full input/output/model/prompt/configuration/result metadata.
37. Run browser E2E for tutor review, wording edit, both mode rectifications, Guard identity, absence of student-facing mode label, lock, continued correction chat, inadequate correction persistence, semantic exit, manual overrides, realtime convergence, reload, reconnect, and invalid-output blocking.
38. Run focused tests, existing regression suites, BDD, Promptfoo gates, live-Qwen evaluation, browser tests, TypeScript checks, production build, coverage, migration/RLS validation, and Cloud Functions build if shared types affect it. Run `mypy` for changed Python evaluation/support code; record not applicable if no Python is touched.
39. Add `evals/promptfoo/AI_BEHAVIOR_EVALUATION_GUIDE.md` as the canonical guide for future AI behavior evaluations. Update `evals/promptfoo/README.md`, `tutor-system/claude_docs/aiService.md`, and `tutor-system/claude_docs/testing-strategy.md` only where responsibilities or commands change.
40. Before any commit, review the nearest documentation, update dates/commit identifiers as required by repository policy, and create the required documentation update record for complex documentation folders.
41. Produce the final evidence bundle: requirement-to-test traceability, transition/schema/persistence/RLS results, Promptfoo metric results with missing-result checks, live-Qwen metadata, browser evidence, build/type/coverage output, migration validation, and residual-risk notes.

## Evaluation design

The Guard evaluator must measure decisions and transitions, not merely whether a response sounds strict.

### Critical behavior matrix

| Case | Required AI decision | Gate |
|---|---|---:|
| Deliberate system play/refusal | guard | 100% on designated cases |
| Four deliberate violations of one explicit guidance | guard is permitted/expected by fixture | critical case, not a counter rule |
| Four genuine confused mistakes | tutoring | 100% false-positive avoidance |
| Repeated visible effort/partial improvement | tutoring | 100% false-positive avoidance |
| Clarification-seeking | tutoring | 100% false-positive avoidance |
| Guard + absent/inadequate correction | guard | 100% persistence |
| Guard + evasive/keyword-only correction | guard | 100% persistence |
| Guard + semantically adequate paraphrased correction | tutoring | 100% valid exit |
| Guard response | correction-specific, concrete next action, safe firm tone | critical quality checks |
| Ordinary tutoring turn | existing tutoring behavior | existing gate preserved |

The four-violation example must be paired with equal-count non-activation cases. This is the evidence that the model uses behavior and learning context rather than a hidden hardcoded counter.

### Evaluation records

Each case stores enough metadata to reproduce and diagnose the result:

- case ID, suite, fixture rationale, and oracle version;
- complete conversation/context input;
- provider, model, prompt/configuration version, and run timestamp;
- raw provider output and validated parsed decision;
- metric assertions, scores, missing-result status, and failure classification;
- implementation commit and test command.

The evaluator should fail closed on invalid structured output before scoring semantic behavior. It should not award a behavioral pass to a prose response that cannot be safely consumed by runtime code.

### Future evaluation guide

The new guide should explain how to add a behavior without weakening the gate:

1. Define the observable action contract and forbidden shortcuts.
2. Add deterministic schema/transition tests first.
3. Add justified ecological examples.
4. Add independently worded holdouts and contrast cases.
5. Define critical cases and thresholds before seeing results.
6. Capture raw/parsed outputs and complete configuration metadata.
7. Run existing regression metrics as well as the new behavior metrics.
8. Classify failures and fix the relevant implementation layer.
9. Never silently change provider, model, prompt, fixture, threshold, or fallback behavior to make a failing evaluation green.

## Expected files and ownership

These are likely change points; exact names should follow existing local conventions after the TDD red phase:

| Area | Likely files/artifacts | Responsibility |
|---|---|---|
| Shared types | `tutor-system/src/types/index.ts` or adjacent type module | Mode, decision, review, room projection, audit types |
| Pure domain | new `src/utils`/domain module and unit test | State transitions, flags, progress permission |
| AI adapter | existing AI service and tests | Structured prompt/result parsing and metadata |
| Room lifecycle | `tutor-system/src/contexts/RoomContext.tsx` and tests | Suggestion lifecycle, review state, send/realtime adapter |
| Tutor review | `AISuggestionBox.tsx`, `CommentInput.tsx`, component tests | Reason/mode review, wording edit, Guard preview |
| Rendering | `PostComment.tsx` and message tests | Stable historical identity and privacy boundary |
| Room page | `RoomPagePost.tsx` and integration/browser tests | Status, override controls, progress lock, reconciliation |
| Identity | new app-owned identity config and static asset | Universal Guard presentation |
| Database | next append-only migration under `supabase/migrations/` | Mode projection, audit, constraints, RPC, RLS/realtime |
| AI evaluation | `evals/promptfoo/`, gate scripts, live-Qwen/browser fixtures | New behavior metrics and blocking gates |
| Documentation | Promptfoo guide plus nearest AI/testing docs | Contract, implementation boundary, future eval authoring |

Every new executable script requires the repository shebang and purpose comment. Every new test begins with a comment stating the file and behavior it covers.

## Risks and controls

- False-positive Guard activation: critical confusion/effort/clarification holdouts at 100%.
- Superficial Guard exit: semantic, paraphrase, partial, and evasive correction cases at 100%.
- Fixed threshold leakage: no violation counter in runtime code or prompt policy; equal-count contrast cases.
- Invalid model output: one strict validator, visible blocking error, no fallback mode.
- Message/state divergence: one atomic RPC and rollback tests.
- Stale tutor review: mandatory revision check; retain draft on rejection.
- UI/backend lock bypass: client lock plus authoritative progression rejection.
- Realtime reordering/gaps: monotonic revision, ignore stale events, refetch after reconnect.
- Student privacy leak: keep raw/final audit data in tutor-only records, expose only a student-safe message projection, enforce grants/RLS, and add direct-read plus DOM assertions for every protected field.
- Historical identity drift: message-local final mode, not current room mode.
- Audit incompleteness: immutable raw suggestion ID/data plus disposition and transition records.
- Existing tutoring regression: preserve all current metrics and run before/after baselines.
- Overengineering: no review dashboard, teacher-unavailable path, room-specific Guard profiles, event-sourcing replay system, second Guard Boolean, or unrelated tutoring refactor.

## Acceptance and release gate

The feature is ready only when all of the following are demonstrated:

- valid AI suggestions contain validated mode, reason, and response;
- malformed output blocks review/send/transition without guessing;
- the pure transition matrix and critical correction cases pass at 100%;
- activation is semantic and not a hardcoded violation count;
- deliberate system play can activate Guard while confusion and effort do not;
- inadequate correction keeps Guard and the progress lock;
- adequate correction returns to tutoring and unlocks after reviewed persistence;
- the tutor can edit wording, rectify mode in both directions, and manually activate/deactivate;
- the tutor sees raw reason and `Guard Mode Activated` while students do not see internal reason or an explicit mode label;
- Guard messages use the universal `Security Supervisor` identity and retain it historically;
- current room mode, final message, raw AI evidence, review action, and transitions are auditable;
- reviewed send is atomic, stale writes are rejected, and unauthorized writes are blocked;
- tutor and student views converge after realtime events, reload, and reconnect;
- student progress is blocked authoritatively while comments/corrections remain available;
- new evaluation metrics meet their thresholds with no missing applicable result;
- all existing tutoring metrics remain at or above their current gate;
- live-Qwen and browser validation use the configured production path and preserve metadata;
- tests, coverage, type checks, build, migration/RLS checks, and affected functions checks pass;
- documentation explains how this behavior works and how future AI behavior evaluations are added.

## Traceability

| Requirement | Design location | Evidence required |
|---|---|---|
| Two per-turn AI roles | decision contract, pure transition module | schema and transition tests; Promptfoo mode cases |
| Semantic rather than hardcoded activation | prompt policy and contrast fixtures | static counter search; equal-count live/holdout cases |
| Human wording responsibility | review draft/final message separation | component and persistence tests |
| Human mode control | final-mode selector and manual override RPC | both rectification directions and manual audit tests |
| AI return to tutoring | Guard correction context and final tutoring transition | valid correction exit at 100% |
| Guard persistence | current room projection and transition function | inadequate correction case at 100% |
| Tutor-facing activation status | `AISuggestionBox`/composer/status UI | browser assertion for exact text |
| Universal serious identity | centralized `Security Supervisor` config | tutor/student rendering and asset tests |
| Student sees identity, not label | message-local final mode and student view model | browser/DOM absence assertion |
| Progress block | room state plus server-side mutation guard | integration/RLS/progression bypass tests |
| Raw decision and human rectification audit | immutable tutor-only suggestion/message audit fields | database, authorization, and metadata evidence |
| Existing tutoring preservation | unchanged current metrics and baseline | Promptfoo/live/regression comparison |
| Evaluation for all AI behavior changes | canonical guide and blocking suites | guide, gate logs, full metadata |
