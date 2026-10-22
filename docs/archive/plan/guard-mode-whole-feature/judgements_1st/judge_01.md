## Full Ranking

1. [Plan 1 — state-machine contract](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md)
2. [Plan 2 — evaluation-first gate](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_2.md)
3. [Plan 3 — minimal suggestion overlay](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md)
4. [Plan 4 — audit event sourcing](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md)

The [diversity check](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/approaches/diversity_check.md) supports treating these as genuinely different strategies. It does not establish their quality and was not used as a substitute for comparison against the [request](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/request.md).

## Rubric Scores

Scores are out of 5; totals are out of 30.

| Rank | Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Plan 1 | 5 | 5 | 4 | 5 | 5 | 5 | **29** |
| 2 | Plan 2 | 4 | 4 | 4 | 4 | 5 | 5 | **26** |
| 3 | Plan 3 | 4 | 4 | 5 | 3 | 4 | 5 | **25** |
| 4 | Plan 4 | 5 | 3 | 2 | 4 | 5 | 5 | **24** |

## Ranking Reasons

### 1. Plan 1

Plan 1 is the strongest backbone because it covers the complete request while keeping the behavioral core narrow: a pure, typed two-state machine surrounded by thin Qwen, Supabase, `RoomContext`, and UI adapters.

Its strongest grounded qualities are:

- The raw AI decision, editable human draft, and final sent record are explicitly separated.
- Invalid structured output is rejected before it reaches `RoomContext`; no mode is inferred or guessed.
- Final message persistence, room-state change, and transition auditing share an atomic Supabase boundary.
- Progress locking is enforced in both the UI and the authoritative mutation path.
- Historical message presentation derives from the message’s persisted final mode rather than current room state.
- It explicitly supports audited manual activation and deactivation independently of generating, editing, rejecting, or regenerating a draft.
- Its deterministic, Promptfoo, production-Qwen, browser, regression, build, coverage, RLS, and documentation gates directly trace to the request’s acceptance criteria.

Its only meaningful deduction is Simplicity. Twenty ordered steps, a room projection, per-message audit fields, a transition audit record, and a transactional RPC are substantial. However, the pure state machine keeps that complexity bounded and testable.

### 2. Plan 2

Plan 2 best satisfies the request’s unusually strong requirement that AI-behavior evaluation be a blocking part of delivery.

Its evaluation-first sequence is excellent:

- It records the existing tutoring baseline before runtime changes.
- It defines a versioned behavioral contract and justified fixtures before prompt work.
- It separates ecological development cases from independently worded synthetic holdouts.
- It requires meaningful red evidence against the original text-only behavior.
- It treats ambiguous evaluation cases as policy defects to resolve before prompt tuning.
- It preserves the eight tutoring metrics and blocks missing applicable results or silent configuration drift.

It ranks below Plan 1 because it assumes activation and deactivation require sending a reviewed response. The request separately says the human can activate and manually deactivate Guard, while Plan 1 provides a clearer standalone audited override path.

**Inference:** Requiring a new student-visible message for every manual deactivation could make emergency or mistaken-lock recovery less direct than the request appears to intend. The request does not explicitly require that restriction.

A second feasibility concern is that Plan 2 first creates an evaluation parser and later creates the application validator. It calls the contract shared “conceptually,” but does not clearly require one implementation.

**Inference:** Without an explicit single-schema or shared-validator rule, the evaluator and runtime parser could drift even while each passes its own tests.

### 3. Plan 3

Plan 3 has the best Simplicity score. It anchors the change to the actual existing path:

`generateTutorSuggestion` → `RoomContext` → `AISuggestionBox` → `CommentInput` → message insertion → `PostComment`

That is a sensible KISS boundary. It also retains most of the important safeguards:

- Strict structured-output validation.
- Explicit raw AI mode versus final human mode.
- Atomic message and room-state persistence.
- Backend and UI progress enforcement.
- Historical rendering from per-message mode.
- Comprehensive deterministic, Promptfoo, live-Qwen, browser, regression, and metadata validation.
- A stable suggestion ID and explicit dispositions for accepted, edited, rectified, rejected, and regenerated suggestions.

It loses ground on Assumption Discipline because it depends on several repository details not guaranteed by the request: that the existing feedback record can safely become the suggestion audit store, that it can be updated through the full lifecycle, and that existing room subscriptions and progression paths can be extended cleanly.

**Inference:** Persisting every generation immediately and later updating its disposition creates an additional multi-write lifecycle beside the atomic final-message transaction. Unless one authoritative writer and failure policy are defined, the suggestion disposition could disagree with the final message or room state.

It also restricts manual deactivation to sending a reviewed tutoring response and uses `guard_active` as a Boolean rather than the more explicit shared `tutoring | guard` vocabulary.

### 4. Plan 4

Plan 4 is thorough and highly auditable. Its immutable events, per-room sequence, transactional projection update, replay-equivalence testing, stale-write handling, student-facing privacy boundary, and immediate manual-deactivation operation all fit the request.

It ranks last because the event-sourcing architecture is disproportionate to a two-state, one-room feature. The plan introduces:

- A multi-event vocabulary.
- Event-specific JSON schemas.
- Per-room sequencing.
- Causation and correlation identifiers.
- A projection table.
- Projection replay and rebuild support.
- Multiple event-appending RPCs.
- Event-stream RLS and immutability rules.
- Client reconciliation by sequence.

The plan itself acknowledges excessive event-sourcing complexity as its first risk.

**Inference:** The added schema, replay, authorization, and reconciliation surface would probably consume more implementation and operational effort than the Guard behavior, while creating more ways for otherwise ordinary message delivery to fail.

The separate `correction_evaluated` event also interprets a raw AI mode as correction adequacy even though the tutor may later rectify that mode. That interpretation is redundant with the raw mode, reason, current state, and final reviewed result.

## Risks and Tradeoffs

| Plan | Grounded tradeoff | Inference / likely consequence |
|---|---|---|
| Plan 1 | More upfront state and persistence modeling, plus an explicit transition audit. | The larger plan may extend delivery time, but its pure reducer and transactional boundary should keep defects localized. |
| Plan 2 | Evaluation artifacts and gates precede visible product implementation. Manual state changes occur through reviewed sends. | Early UI progress will be slower, and mandatory response-based deactivation may add friction; the behavioral contract should be unusually resistant to prompt overfitting and regression. |
| Plan 3 | Minimizes source changes by adding branches to existing mixed responsibilities. Suggestion records are persisted and later assigned dispositions. | `RoomContext` and the feedback/audit lifecycle could become the long-term complexity hotspot, particularly around regeneration, stale drafts, and partial persistence failures. |
| Plan 4 | Maximizes reconstruction and accountability through immutable events and a rebuildable projection. | It creates the greatest migration, RLS, concurrency, maintenance, and debugging burden, with limited additional product value over Plan 1’s message history plus transition audit. |

Cross-plan risks that the final implementation must retain are:

- False-positive Guard activation against confused or improving students.
- Superficial or keyword-only correction causing an early Guard exit.
- AI output that is plausible prose but violates the structured contract.
- Divergence between the final message and the active room state.
- Client-only progress locking that can be bypassed.
- Raw reasons or audit metadata leaking into the student view or DOM.
- Out-of-order or missed real-time updates.
- Existing tutoring quality regressing after the prompt/output-format change.
- Silent model, prompt, fixture, threshold, or provider changes after evaluation failure.
- Historical Guard messages changing identity after the room returns to tutoring.

## Recommended Backbone

Use [Plan 1](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md) as the backbone.

Its core should remain:

1. One strict structured AI contract.
2. One pure two-state Guard transition module.
3. Raw AI decision, human review draft, and final sent state kept separate.
4. One authoritative typed room-mode projection.
5. One atomic reviewed-send operation.
6. One append-only transition audit for actual state changes and manual overrides.
7. Message-level final mode for stable historical rendering.
8. UI and database enforcement of the progress lock.
9. Blocking deterministic, Promptfoo, live-Qwen, browser, regression, and metadata gates.

The backbone should import Plan 2’s evaluation-first baseline and fixture design, Plan 3’s complete suggestion-disposition lifecycle, and Plan 4’s narrow concurrency/reconnect controls. It should not import Plan 4’s event-sourced source of truth.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in Plan 1 |
|---|---|---|
| Plan 2 | Record the current deterministic, ecological, holdout, live-Qwen, and browser baseline—with commit, model, prompt, configuration, scores, and pre-existing failures—before any runtime change. This gives tutoring regression claims a real before/after reference. | Expand Plan 1 Step 1, before writing the first new test or changing the prompt. |
| Plan 2 | Define justified ecological and independently worded synthetic-holdout fixtures before prompt implementation; require red evidence and resolve ambiguous oracle cases before tuning. This makes AI evaluation a genuine implementation contract. | Split the fixture/oracle portion out of Plan 1 Step 15 and perform it between Plan 1 Steps 1 and 2; run the completed suites again at Step 15. |
| Plan 2 | Contrast cases with equal mistake counts but different intent. This directly tests semantic selection and guards against accidentally encoding the four-violation example as a counter. | Add to Plan 1 Step 15’s critical false-positive and activation fixtures. |
| Plan 3 | Give every successful generated suggestion a stable ID and retain explicit lifecycle disposition: accepted unchanged, wording-edited, mode-rectified, rejected, or superseded by regeneration. This preserves audit evidence for suggestions that never become messages. | Add to Plan 1 Step 7’s audit persistence adapter and Step 9’s generate/regenerate/reject/send actions. Keep final message/state changes within Plan 1’s atomic transaction. |
| Plan 3 | Keep the implementation explicitly on the existing suggestion-to-render pipeline. This is a useful scope-control check against unrelated refactoring. | Add as a boundary statement before Plan 1 Steps 8–13. |
| Plan 4 | Require an expected state revision on reviewed sends, reject stale reviews while preserving the draft, and accept real-time state only when its revision is newer. This is a precise solution to concurrent sends and out-of-order updates. | Strengthen Plan 1 Step 7’s RPC and Step 13’s real-time/reconnect logic. |
| Plan 4 | Refetch authoritative state after reconnect instead of relying exclusively on subscription delivery. This closes missed-event gaps without requiring event replay. | Add to Plan 1 Step 13 and its browser/reconnect validation. |

## Incompatibilities

1. **Plan 1 state machine versus Plan 4 event stream as source of truth**

   Plan 1 makes the typed transition function and transactional room projection authoritative, with messages and a transition audit preserving history. Plan 4 makes the full event stream authoritative and the room state rebuildable from it. Using both would create two competing definitions of authoritative transition history.

   Keep Plan 1’s state machine and compact audit. Import Plan 4’s revision/conflict handling, not its event-sourcing architecture.

2. **Typed room mode versus `guard_active` Boolean**

   Plan 1 and Plan 2 use the same `tutoring | guard` vocabulary across the AI contract, transition logic, and room state. Plan 3 uses a room-level `guard_active` Boolean. Persisting both would permit contradictory states.

   Use one typed room mode and derive `isGuardActive` or `canStudentProgress`; do not store a second Boolean.

3. **Immediate manual override versus response-bound override**

   Plan 1 and Plan 4 support a standalone audited manual deactivation. Plans 2 and 3 require a reviewed tutoring response to be sent before deactivation takes effect. These are incompatible user-flow and transition semantics.

   Choose the standalone audited override for the backbone. Continue requiring reviewed sends for AI-proposed semantic exits, but do not require a new message for an explicit human emergency/manual deactivation.

4. **Mutable suggestion disposition versus an immutable event ledger**

   Plan 3 proposes updating a persisted suggestion audit record as it is accepted, edited, rectified, rejected, or regenerated. Plan 4 represents these as separate immutable events. Implementing both would duplicate audit history and require reconciliation.

   Under Plan 1, use a single suggestion record with immutable raw fields and a carefully controlled disposition/linkage update, plus the separate transition audit only when authoritative room state changes.

5. **Evaluation-only parser versus one authoritative schema**

   Plan 2’s evaluation-first sequence risks producing an evaluator parser before the runtime validator, while Plan 1 calls for one documented runtime schema.

   Reuse the same schema definition or shared conformance corpus in evaluation and production. Do not maintain two independently interpreted versions of `mode`, `mode_reason`, and `suggested_response`.

6. **`correction_evaluated` event versus raw/final decision separation**

   Plan 4 derives a separate adequacy event from the raw AI mode while Guard is active. Plan 1 already retains the prior state, raw mode, raw reason, final human mode, and transition. Adding a separate adequacy assertion can become inconsistent after rectification.

   Do not import this event. Test semantic correction quality in deterministic and AI-behavior evaluations, and retain the raw decision/reason as audit evidence.