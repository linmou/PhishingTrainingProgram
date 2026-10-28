Evaluation was limited to [request.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/request.md), the four candidate plans, and [diversity_check.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/approaches/diversity_check.md). No other judge output was read. “Evidence” below restates the input files; “Inference” marks my independent judgment.

## Full Ranking

1. [plan_1.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md) — typed, narrow state-machine contract
2. [plan_2.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_2.md) — evaluation-first delivery gate
3. [plan_3.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md) — minimal suggestion overlay
4. [plan_4.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md) — audit event sourcing

The diversity check supports treating these as genuinely different strategies; it does not determine the ranking.

## Rubric Scores

Scores are 1–5, with 5 being strongest. Totals are out of 30.

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 5 | 5 | 4 | 5 | 5 | 5 | **29** |
| `plan_2.md` | 5 | 5 | 4 | 4 | 5 | 5 | **28** |
| `plan_3.md` | 4 | 4 | 5 | 4 | 4 | 5 | **26** |
| `plan_4.md` | 5 | 3 | 2 | 4 | 5 | 5 | **24** |

## Ranking Reasons

### 1. `plan_1.md`

**Evidence:** The plan defines a pure two-state Guard transition model, separates raw AI output from the human review draft and sent record, makes reviewed message persistence and room-state changes atomic, requires server-side progression enforcement, centralizes the universal identity, and covers all requested deterministic, Promptfoo, live-Qwen, browser, regression, and documentation gates.

It also directly handles requirements that are easy to miss:

- Draft generation, editing, rejection, and regeneration do not change authoritative room state.
- Both manual activation and manual deactivation have audited state-transition paths.
- Historical message identity derives from each message’s final mode, rather than the current room state.
- Invalid structured output cannot enter the composer or cause a transition.
- Student comments remain available while progression is locked.
- Existing tutoring metrics remain blocking in both ecological and holdout suites.

**Inference:** This is the strongest backbone because it introduces a small domain boundary exactly where the feature needs one, without making React, Supabase, or the AI provider part of the transition logic. It is more robust than the minimal overlay while remaining materially simpler than event sourcing.

**Inference:** The main shortcoming is that its audit model is clearer for sent responses and state transitions than for valid suggestions that are later rejected or superseded. Step 9 says rejection records existing feedback, but it does not specify as precisely as `plan_3.md` that every generated structured decision receives a durable stable identifier and disposition. That is a repairable omission, not a reason to reject the backbone.

### 2. `plan_2.md`

**Evidence:** This plan establishes the existing tutoring baseline first, defines a versioned behavioral contract, builds ecological and independent synthetic-holdout fixtures before implementation, saves red evidence, and treats missing applicable scores as failures. It explicitly addresses ambiguous evaluation oracles before prompt tuning and preserves model, provider, prompt, threshold, input/output, and failure metadata.

Its runtime design is also sound: one authoritative room mode, separate room/message/transition persistence, an expected state version, transactional reviewed sends, tutor-authoritative rectification, RLS boundaries, and client-plus-server progression locking.

**Inference:** Its evaluation design is the best of the four and nearly makes it the winner. It ranks second because several implementation assumptions are more prescriptive than the request or known repository context supports:

- It assumes existing rooms should be backfilled to `tutoring`.
- It requires activation and deactivation to occur through a reviewed sent response.
- It imposes a strict global sequence in which UI work does not begin until critical live AI behavior passes.

Those choices can work, but they should be confirmed after inspecting the current schema and progression workflow. In particular, the request explicitly requires manual deactivation but does not say it must require sending another student-visible response.

**Inference:** The global “AI behavior must pass before UI work begins” gate is also stronger than necessary. AI evaluation must block completion, but deterministic UI and persistence work can still proceed under the required TDD workflow while live-model behavior is being corrected.

### 3. `plan_3.md`

**Evidence:** This plan stays close to the current `generateTutorSuggestion → RoomContext → AISuggestionBox → CommentInput → message insertion → PostComment` path. It centralizes the strict decoder, transition calculation, and persistence-payload builder, uses one explicit final mode, preserves raw and edited wording separately, adds a room-level `guard_active` projection, and requires atomic message/state persistence.

It also contains a particularly useful audit feature: every successful generated suggestion is persisted immediately under a stable `suggestionId`, then receives a disposition such as accepted, edited, rectified, rejected, or superseded.

**Inference:** This is the simplest candidate and likely the fastest initial implementation. It ranks below `plan_2.md` because the minimal overlay leaves more correctness responsibility inside the already broad `RoomContext` and existing feedback system.

Specific weaknesses are:

- The room state has no explicit revision or sequence field, although the plan expects tests for stale clients and rapid regeneration.
- A source message ID helps correlate changes but is not sufficient by itself to order concurrent or out-of-order real-time updates.
- The atomic mechanism is left as “a narrow database trigger or existing transactional server-side operation,” which is less decisive than the RPC boundaries in plans 1 and 2.
- Audit dispositions are described as updates to an existing record; that can preserve immutable raw fields, but the immutability rule is not fully specified.
- Manual deactivation is tied to sending a reviewed Tutor response, rather than offering the clearly audited standalone action present in `plan_1.md`.

**Inference:** Its validation quality remains excellent. The lower ranking is architectural: the plan saves lines of new domain code by adding more branches and lifecycle obligations near mixed existing responsibilities.

### 4. `plan_4.md`

**Evidence:** This plan makes an immutable `guard_mode_events` stream the source of truth, gives each room a monotonic event sequence, maintains a rebuildable `room_guard_state` projection, records invalid outputs as events, uses transactional RPCs, protects audit data with RLS, rejects stale operations, and validates replay/projection equivalence.

It also gives the most explicit treatment of:

- Out-of-order real-time delivery.
- Concurrent tutor submissions.
- Append-only audit history.
- Projection reconstruction.
- Immediate manual deactivation.
- Cross-room and student audit-data isolation.

**Inference:** It ranks last because event sourcing is disproportionate to a two-state, one-room feature whose requested audit history can be satisfied with final message fields, a current room-state projection, and a small append-only transition table. The plan adds event schemas, sequence assignment, causation links, projection reducers, replay support, rebuild operations, and multiple RPC paths. All of those become new correctness and maintenance obligations.

**Inference:** The `correction_evaluated` event is also semantically too strong as described. It records an AI proposal of `tutoring` as “adequate” and `guard` as “inadequate” whenever Guard was active. A mode decision is evidence of the model’s assessment, but it is not independent proof that the correction was adequate—especially when the tutor may rectify that decision. Encoding that interpretation as a separate authoritative event risks overstating what occurred.

## Risks and Tradeoffs

| Plan | Main benefit | Main cost or risk | Judgment |
|---|---|---|---|
| `plan_1.md` | Clean transition boundary with atomic persistence and broad validation | More upfront modeling and potentially three related persistence representations | Best balance; keep the state machine narrow and choose the smallest schema after inspection |
| `plan_2.md` | Strongest protection against vague, biased, or drifting AI evaluation | Front-loads substantial fixture and evaluation work; some product semantics are assumed | Import its evaluation discipline, but do not make every implementation lane wait for stochastic model convergence |
| `plan_3.md` | Smallest change to the current application path; good generated-suggestion lifecycle audit | More Guard lifecycle branching inside `RoomContext`; weak explicit concurrency ordering | Valuable implementation tactics, but not sufficient as the architectural source of truth |
| `plan_4.md` | Maximum reconstruction, concurrency control, and auditability | Event-stream and projection machinery greatly expand the failure surface | Use only its revision/order controls; reject full event sourcing unless a broader audit requirement emerges |

Additional cross-cutting risks:

- **Manual deactivation semantics:** Plans 2 and 3 require a reviewed Tutor response to deactivate Guard. Plan 1 provides an audited standalone override; plan 4 provides immediate manual deactivation. **Inference:** Plan 1 better satisfies the unqualified acceptance criterion that the human can manually deactivate Guard.
- **Suggestion audit completeness:** Plan 1 is strongest for sent-message and state-transition audit, while plan 3 is strongest for rejected and superseded suggestions. **Inference:** The final plan should combine these without allowing mutable overwrites of raw model evidence.
- **Concurrency:** Plans 1 and 2 use revision/version checks; plan 4 uses room event sequences; plan 3 does not provide an equally explicit ordering mechanism. **Inference:** A monotonic room-state revision is sufficient; a full event sequence is unnecessary.
- **Evaluation sequencing:** Plan 2 minimizes the risk of building against a bad behavioral oracle. Plan 3 reaches UI integration earlier. **Inference:** Define fixtures, thresholds, and red evaluation evidence first, but allow independent deterministic UI/database TDD work once the observable contract is frozen.
- **Stochastic gate stability:** All plans make critical AI cases 100% gates. This is required by the request for designated critical cases, but model nondeterminism can still create operational instability. The plans correctly prohibit responding by silently changing the model, configuration, fixtures, or thresholds.

## Recommended Backbone

Use `plan_1.md` as the backbone.

Its core should remain:

1. Strictly validate the structured Qwen decision at the provider boundary.
2. Keep raw AI decision, editable human review state, and final sent response separate.
3. Use one pure two-state transition function.
4. Persist the final message, audit data, and resulting room state atomically.
5. Derive progress permission from authoritative persisted state and enforce it in both UI and backend writes.
6. Render historical messages from their persisted final mode.
7. Block completion on deterministic, Promptfoo, existing tutoring, production-path Qwen, and browser gates.

Before implementation, make two refinements:

- Resolve the plan’s “room row or one-to-one state table” choice by inspecting the current schema and progression mutation path. Prefer extending the room row if it fits existing RLS and real-time patterns; use a one-to-one table only if room-row access would expose tutor-only audit fields or complicate authorization.
- Require a monotonic Guard-state revision in the atomic write result and real-time payload. Do not leave concurrency protection conditional on whether the existing send path “permits” it.

**Inference:** This backbone provides the simplest architecture that still makes malformed AI output, message/state divergence, unauthorized progression, real-time ordering, and evaluation regression explicit blocking failures.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in the recommended backbone |
|---|---|---|
| `plan_2.md` | Record the unchanged tutoring baseline—including commit, provider/model/configuration, metric-level scores, and pre-existing failures—before Guard changes. This prevents Guard work from being blamed for existing failures and exposes later configuration drift. | Insert at the beginning of `plan_1.md` Step 1, before assigning TDD responsibilities or modifying prompts. |
| `plan_2.md` | Define a versioned observable behavior contract and justify ecological versus independently worded holdout fixtures before prompt tuning. This reduces evaluator ambiguity and prompt overfitting. | Insert between `plan_1.md` Steps 1 and 2; use it to drive schema, transition, Promptfoo, live, and browser cases. |
| `plan_2.md` | Save meaningful red evaluation evidence and make schema validity a prerequisite for behavioral scoring. This proves the new gate can detect the old text-only behavior and prevents malformed output from receiving content scores. | Add to `plan_1.md` Step 15 before production prompt tuning, while still allowing independent deterministic implementation lanes to continue. |
| `plan_3.md` | Give every successful AI generation a stable suggestion identifier and durable disposition: accepted, wording-edited, mode-rectified, rejected, or superseded. This closes the audit gap for suggestions that never become sent messages. | Add to `plan_1.md` Steps 3, 7, and 9: create the immutable generation record after validation, carry its ID through `RoomContext`, and append or record the final disposition on reject, regeneration, or send. |
| `plan_3.md` | Centralize one strict decoder, one transition function, and one reviewed-message payload builder. This prevents components from reconstructing modes or audit fields independently. | Add as an explicit implementation constraint in `plan_1.md` Steps 3, 5, and 9. |
| `plan_3.md` | Retain the human-edited draft after a failed send and clear it only after the atomic transaction succeeds. This prevents user work from being lost during persistence failures. | Strengthen `plan_1.md` Steps 7 and 9, and add an integration test to Step 14. |
| `plan_4.md` | Use a monotonic room-state revision, reject stale reviewed sends, ignore older real-time updates, and refetch after reconnect. This handles concurrency and subscription reordering without adopting event sourcing. | Add the revision column and expected-revision check in `plan_1.md` Steps 6–7; add reconciliation behavior in Steps 9 and 13; validate in Steps 14 and 17. |
| `plan_4.md` | Test that students cannot read raw reasons, provider output, prompt data, or audit metadata across both RLS and rendered DOM boundaries. This is stronger than UI-only privacy testing. | Add to `plan_1.md` Steps 6–7 for RLS tests and Steps 10–12 for student-rendering tests. |
| `plan_4.md` | Preserve the source decision identifier through review and atomic send. This gives an unambiguous link between immutable AI evidence and the final reviewed message. | Add to the `ReviewedTutorResponse` contract in `plan_1.md` Major Decision 1 and carry it through Steps 7, 9, and 11. |

For the `plan_3.md` audit contribution, the raw generation payload must remain immutable. A later disposition may be an append-only action record or a separately constrained status field; it must not overwrite the raw mode, reason, response, output, or generation metadata.

## Incompatibilities

1. **`plan_1.md` state-machine authority versus `plan_4.md` event-stream authority**

   `plan_1.md` treats a pure transition function plus persisted room state as the domain authority, with messages and a small transition audit preserving history. `plan_4.md` treats replay of the event stream as the ultimate source of truth.

   **Inference:** These should not be combined. Doing so would create two competing reconstruction models and require every state change to remain consistent across messages, transition records, events, and a projection. Import revision ordering from plan 4, not its event-sourcing architecture.

2. **Standalone manual override versus send-only mode changes**

   `plan_1.md` supports audited manual activation and deactivation operations. Plans 2 and 3 state that mode changes become authoritative only when a reviewed response is sent.

   **Inference:** The final plan must choose one semantic contract. Keep `plan_1.md`’s standalone audited manual deactivation because the request explicitly requires manual deactivation without saying another response is required. If manual activation is exposed independently, route it through the same audited operation. Do not simultaneously claim that every state change must have a corresponding sent message.

3. **Typed authoritative status/revision versus `guard_active` plus trigger-only updates**

   `plan_3.md` proposes a small room Boolean and allows a trigger or an existing transactional operation to update it. `plan_1.md` proposes an explicit typed state and transactional reviewed-send operation with audit facts.

   **Inference:** Do not implement both a trigger and an RPC that can independently derive state. Use one reviewed-send RPC as the only state-changing path. The database may enforce invariants with constraints, but it should not contain a second hidden transition implementation.

4. **Immutable audit history versus mutable disposition updates**

   `plan_3.md` says later actions update the generated suggestion’s audit record. Plans 1 and 4 emphasize append-only transition or event evidence.

   **Inference:** Updating only a constrained disposition may be acceptable, but updating raw evidence is incompatible with the audit requirement. The imported design must freeze raw AI fields and preserve a separate action history or append-only disposition record.

5. **Parallel TDD lanes versus a global live-AI gate before UI implementation**

   `plan_1.md` divides schema/state, persistence, UI, and evaluation work around observable contracts. `plan_2.md` says not to start UI implementation until structured and critical AI behavior cases pass.

   **Inference:** Do not import that strict global sequencing. Freeze the behavior contract and build red evaluation artifacts first, but allow deterministic UI, persistence, and transition work to proceed independently. Live-model success remains a blocking release gate.

6. **Human-reviewed final mode versus `correction_evaluated` as an authoritative semantic fact**

   `plan_4.md` maps an active-room AI result of `tutoring` to `correction_evaluated(adequate)` and `guard` to `correction_evaluated(inadequate)` before human review.

   **Inference:** Do not import this event. Persist the raw `mode_reason` and relevant generation context as the AI’s assessment. Calling the correction definitively adequate or inadequate before review overstates the model output and becomes especially inconsistent when the tutor rectifies the mode.

7. **Message-history audit versus duplicating final wording in multiple authoritative records**

   Plans 1–3 keep final message content in the existing message record. Plan 4 also places final wording in `response_sent` event payloads.

   **Inference:** Avoid two authoritative copies of final text. The final message should own the delivered wording and final mode; audit records should link to the message and preserve raw AI evidence, reviewer action, and transition metadata.