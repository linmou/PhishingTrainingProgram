I independently evaluated only the request, the four candidate plans, and the diversity check. I did not inspect other judge outputs. The diversity check confirms that the candidates represent materially different strategies, but the ranking below is based on the candidate contents and the request itself—not on the diversity check’s keep decisions. See [request.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/request.md:5) and [diversity_check.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/approaches/diversity_check.md:3).

## Full Ranking

1. `plan_1.md` — typed state-machine contract
2. `plan_2.md` — evaluation-first delivery gate
3. `plan_3.md` — minimal suggestion overlay
4. `plan_4.md` — audit event sourcing

There are no ties.

## Rubric Scores

Scores are 1–5, with a maximum total of 30.

| Rank | Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | `plan_1.md` | 5 | 5 | 4 | 5 | 5 | 5 | **29** |
| 2 | `plan_2.md` | 4 | 4 | 4 | 3 | 5 | 5 | **25** |
| 3 | `plan_3.md` | 4 | 4 | 5 | 3 | 4 | 5 | **25** |
| 4 | `plan_4.md` | 5 | 3 | 1 | 3 | 5 | 5 | **22** |

The equal totals for plans 2 and 3 are not a ranking tie. Plan 2 ranks higher because its evaluation-first contract better serves the request’s explicit requirement that AI-behavior evaluation be blocking, whereas plan 3’s primary advantage is implementation simplicity.

## Ranking Reasons

### 1. `plan_1.md`

Plan 1 is the best backbone because it puts the most error-prone product rule—a human-reviewed, state-changing AI mode decision—behind a small typed transition boundary without turning the entire room architecture into a new framework.

Its strongest decision is the narrow two-state machine and explicit invariants: drafts, regeneration, rejection, and editing cannot change room state; only a successfully persisted reviewed response or manual override can do so. It also separates message presentation from current room state, preventing historical Guard messages from changing identity after the room returns to tutoring. These decisions are explicit in [plan_1.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md:49).

It handles the request’s persistence and authority requirements cleanly through three non-overlapping concepts:

- Raw AI decision.
- Human-reviewed draft and final response.
- Current room state plus append-only transition history.

The append-only audit accommodates manual activation or deactivation even when there is no associated message, which is a direct and flexible interpretation of the requirement that the human can activate or deactivate the mode. See [plan_1.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md:122) and the underlying requirement in [request.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/request.md:81).

Atomic reviewed-send persistence is unusually well specified: authorization, message insertion, room-state transition, audit insertion, and returned authoritative state are one operation. That directly addresses the most consequential failure mode—a Guard message being delivered without a lock, or an unlock occurring without the reviewed tutoring response. See [plan_1.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md:134).

Its validation coverage is also complete: schema tests, full transition matrix, persistence rollback, RLS, real-time convergence, Promptfoo ecological and holdout suites, unchanged tutoring gates, production Qwen, and browser E2E.

Why it does not receive 5 for Simplicity: it proposes both per-message audit fields, a current-state projection, and a separate transition audit. That is justified, but still more infrastructure than the minimal overlay. The plan must keep the transition table genuinely small to preserve its intended simplicity.

### 2. `plan_2.md`

Plan 2 most directly responds to the request’s instruction that AI behavior evaluation be blocking. It records the baseline, versions the behavior contract, creates ecological and independent synthetic-holdout fixtures before prompt implementation, and requires meaningful red evidence from the current text-only path. See [plan_2.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_2.md:144), [plan_2.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_2.md:157), and [plan_2.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_2.md:174).

That approach has two important advantages:

- It makes the distinction between deliberate system-playing and genuine learning difficulty measurable before prompt tuning.
- It reduces the chance that fixtures, thresholds, or expected answers will be retrofitted to whatever behavior the model happens to produce.

The runtime plan is otherwise strong: one authoritative room mode, optimistic concurrency through a state version, atomic reviewed send, raw/final separation, RLS, server-side progression enforcement, real-time recovery, and full browser validation.

It ranks below plan 1 for two reasons.

First, it introduces an unnecessary product constraint: activation or deactivation “requires sending a reviewed tutor response.” See [plan_2.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_2.md:24). The request requires manual deactivation but does not require a new message as a prerequisite. Plan 1’s separate audited override is more flexible and fits the unresolved product semantics without inventing that restriction.

Second, the strict sequencing—AI evaluation gates must pass before UI implementation—may create avoidable blocking between largely independent deterministic/UI work and stochastic prompt behavior.

**Inference:** This sequencing could lengthen the feedback cycle because UI, persistence, and model evaluation will expose integration issues together eventually, while the plan intentionally delays part of that work. The evaluation artifacts should be created early, but not every unrelated implementation activity needs to wait for live-model convergence.

### 3. `plan_3.md`

Plan 3 is the simplest implementation strategy. It extends the known path—

`generateTutorSuggestion → RoomContext → AISuggestionBox → CommentInput → message insertion → PostComment`

—and centralizes only the decoder, transition calculation, and persistence-payload builder. This is closely aligned with the repository’s KISS/YAGNI preference and the request’s named components. See [plan_3.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md:3).

Its simple state rule is easy to understand and test: a committed final Guard response activates the lock; a committed final tutoring response clears it. See [plan_3.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md:76). The plan also preserves legacy rendering, keeps raw and final wording separate, enforces progression in both UI and backend, and includes comprehensive deterministic, Promptfoo, production-path, and browser validation.

Its particularly useful addition is a stable suggestion identifier with immediate persistence of every successful generation, including later rejection or regeneration disposition. See [plan_3.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md:192). This gives better evidence for “every AI suggestion” than storing raw AI fields only when a suggestion is sent.

It ranks below plan 2 because more of its architecture depends on repository assumptions that are not established in the allowed evidence:

- It assumes the existing feedback/audit persistence can become the authoritative store for every generated suggestion. See [plan_3.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md:29).
- It leaves the exact transaction implementation as a trigger or existing transactional operation rather than selecting a single explicit boundary.
- It places additional lifecycle branches in `RoomContext`, a risk the diversity check itself identifies as the strategy’s main tradeoff. See [diversity_check.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/approaches/diversity_check.md:9).
- Manual deactivation occurs only when a reviewed tutoring response is sent. See [plan_3.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md:242).

**Inference:** Immediate suggestion persistence plus later disposition updates also needs a precise failure protocol. For example, the plan should state what the tutor sees when Qwen succeeds but the suggestion-audit write fails, and whether the raw record is immutable while disposition is stored separately. Without that clarification, the “immutable raw evidence” and “updates that audit record” language can lead to mixed write responsibilities.

### 4. `plan_4.md`

Plan 4 has excellent requirement coverage, risk analysis, concurrency protection, auditability, and validation. Its monotonically increasing room sequence, stale-write rejection, projection replay test, append-only event authorization, and real-time ordering rules are all technically sound. See [plan_4.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md:39) and [plan_4.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md:67).

It also supports immediate audited manual deactivation, which fits the request more naturally than requiring a new response. See [plan_4.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md:264).

The decisive problem is architectural proportionality. The request needs:

- Per-message raw and final audit data.
- Current room Guard state.
- Human rectification history.
- Real-time synchronization.
- Atomic state changes.

It does not require a general event-sourced room domain, replay tooling, versioned event payloads, causation links, correction-evaluation events, sequence allocation, or a projection rebuild operation. Plan 4 explicitly makes the event stream the source of truth and the room state a rebuildable projection. See [plan_4.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md:3). The plan itself acknowledges that this may be excessive for a one-to-one room. See [plan_4.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md:365).

There is also an audit-semantics problem around `correction_evaluated`. The plan maps a tutoring proposal to “adequate” and a Guard proposal to “inadequate.” See [plan_4.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md:219).

**Inference:** That event name presents a model judgment as if it were an independently established fact. The human can rectify the mode, so the raw AI proposal and the final reviewed conclusion may differ. Recording the raw decision is sufficient; a separate `correction_evaluated` event risks either duplicating the decision or creating contradictory audit facts.

## Risks and Tradeoffs

### `plan_1.md`

- The state machine, current-state projection, per-message audit fields, and transition audit must remain sharply separated. Otherwise the plan could create multiple representations of the same state.
- The candidate leaves the exact database shape as “room fields or a one-to-one state record.” That is reasonable at planning time, but implementation must resolve it by inspecting current schema and RLS rather than supporting both.
- A manual override must remain an audited state-changing operation and must not bypass the same authorization and concurrency checks as reviewed sends.
- **Inference:** The main implementation risk is not transition logic—it is integrating that logic into existing message/progression paths without accidentally leaving an older direct-write path active.

### `plan_2.md`

- Evaluation-first design can make stochastic model behavior block unrelated deterministic implementation work earlier than necessary.
- Requiring a response for every activation/deactivation may make emergency or corrective manual deactivation unnecessarily cumbersome.
- Versioned contracts and fixtures require governance so that “versioning” does not become a way to change expected behavior after failures.
- Backfilling all existing rooms to tutoring is probably safe because Guard does not yet exist, but that remains an implementation-time schema assumption rather than evidence from the request.
- **Inference:** The plan’s release safety is excellent, but its sequencing should be softened into “evaluation contract first, all evaluation gates before completion,” rather than “no UI implementation before AI cases pass.”

### `plan_3.md`

- New mode, generation, disposition, persistence, and real-time branches accumulate near an already mixed `RoomContext`.
- The proposed reuse of feedback/audit persistence is not proven by the permitted repository evidence.
- Immediate persistence of successful generations improves auditability but adds a new failure boundary before a suggestion becomes usable.
- A Boolean `guard_active` is simple, but the persisted final mode and Boolean must not become independently writable.
- Manual deactivation is coupled to sending a tutoring response.
- **Inference:** This plan is the fastest likely route to a demo but has the greatest risk of leaving Guard-specific branching embedded across existing responsibilities.

### `plan_4.md`

- Event schemas, sequence assignment, append RPCs, projection updates, replay, rebuild, RLS, real-time ordering, and event/message correlation materially expand implementation and operational surface.
- Both the event reducer and database payload validators must evolve consistently.
- A projection-rebuild capability becomes production infrastructure that must itself be authorized, documented, tested, and maintained.
- Storing invalid raw provider output and prompt/context material as events increases privacy and retention scope.
- `correction_evaluated` can duplicate or overstate the semantic status of an AI proposal.
- **Inference:** The architecture could be justified if Guard were the first of many independently audited room-state behaviors. No such roadmap appears in the request, so using it now would be speculative architecture.

## Recommended Backbone

Use [plan_1.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md:1) as the backbone.

Its architecture should remain:

1. One strict runtime-validated AI decision contract.
2. One small pure transition module for reviewed final mode and manual overrides.
3. One authoritative persisted room mode or one-to-one room-state row.
4. Final response mode and immutable raw/final audit data on reviewed messages.
5. One append-only transition audit for actual room-state changes.
6. One atomic reviewed-send operation and one audited manual-override operation.
7. Server-enforced progress locking.
8. Existing RoomContext and UI components acting as adapters and views.
9. Deterministic, Promptfoo, live-Qwen, and browser gates blocking completion.

Before implementation, make two details explicit:

- Choose one concrete room-state representation after inspecting the current schema; do not implement both a room column and a one-to-one projection.
- Define whether every generated valid suggestion must be persisted before review. The request’s “every AI tutor suggestion” and audit requirements favor doing so, but it should be implemented with one immutable suggestion record and append-only disposition facts rather than mutable raw evidence.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in the recommended backbone |
|---|---|---|
| `plan_2.md` | Record the current deterministic, Promptfoo, live-Qwen, and browser baseline—including model/provider/configuration and any pre-existing failures—before changing behavior. This makes later regression claims attributable. | Insert at the beginning of plan 1’s Step 1, before writing new failing tests. |
| `plan_2.md` | Create a versioned observable behavior contract and justify ecological versus independently worded holdout fixtures before prompt tuning. This reduces target drift and exposes ambiguous evaluation oracles early. | Insert after plan 1’s requirement-to-test mapping and before its structured-contract tests. |
| `plan_2.md` | Save red evidence showing why the current text-only path fails the new contract. This proves that later green results are caused by the implementation rather than tests that already passed. | Insert after the initial evaluation parser/fixture work and before modifying `generateTutorSuggestion`. |
| `plan_3.md` | Give every valid generated suggestion a stable ID and persist immutable raw output plus generation metadata before review. Rejection, regeneration, editing, and acceptance then remain auditable, not only final sent messages. | Insert between plan 1’s structured provider validation and `RoomContext` review-state adaptation. Link the suggestion record to the final reviewed-send transaction. |
| `plan_3.md` | Record explicit dispositions such as accepted, wording-edited, mode-rectified, rejected, and superseded. This makes human review of every suggestion demonstrable. | Insert in plan 1’s audit schema and suggestion lifecycle tests. Store dispositions separately from immutable raw fields. |
| `plan_4.md` | Add a monotonic room-state revision and require reviewed sends to supply the expected revision. This prevents stale concurrent reviews from silently overwriting newer Guard state. | Insert in plan 1’s migration and atomic persistence steps. A full event stream is unnecessary. |
| `plan_4.md` | Ignore older real-time state updates and refetch authoritative state after reconnect. This closes out-of-order and subscription-gap failure modes. | Insert in plan 1’s `RoomContext`/`RoomPagePost` real-time synchronization step and browser reconnect tests. |
| `plan_4.md` | Preserve a source message or transition identifier on the current room state. This helps diagnose why the current lock exists without replaying all messages. | Insert in plan 1’s current-state projection fields and persistence-return payload. |

## Incompatibilities

### Event stream source of truth versus narrow state projection

Plan 4’s event stream as the source of truth is incompatible with plan 1’s simpler model of authoritative current room state plus per-message history and a transition audit. Importing both would create redundant authorities and require replay/rebuild semantics throughout the system.

Use plan 4’s revision and ordering controls, but reject:

- General event sourcing.
- Projection replay/rebuild infrastructure.
- Event-specific JSON payload schemas.
- `correction_evaluated` as a separate domain fact.
- Causation graphs and event correlation beyond the identifiers needed for suggestion/message audit.

### Boolean room state versus typed mode state

Plan 3’s `guard_active` Boolean should not coexist with an independently persisted `tutoring | guard` room mode. That would create two representations of the lock.

Choose one persisted room value. A constrained `response_mode`/`active_mode` value is preferable because it uses the same vocabulary as the AI and final messages. Derive `isProgressLocked` from `active_mode === 'guard'`.

### Message-required deactivation versus immediate audited override

Plans 2 and 3 require deactivation to occur through a sent tutoring response. Plans 1 and 4 support a separate audited manual operation. These cannot both be the authoritative transition rule.

Use plan 1’s separate manual override because it satisfies manual activation/deactivation directly and does not force a potentially artificial student-visible message. If product design later requires all transitions to be accompanied by a message, that should be an explicit requirement change.

### Mutable suggestion records versus immutable raw evidence

Plan 3 says raw suggestions are immutable but also says later actions update the audit record with disposition and final-message linkage. A single mutable row can blur those responsibilities.

Import the stable suggestion ID and full-generation audit, but keep:

- Raw model output and parsed fields immutable.
- Disposition/review actions append-only or stored in clearly separate review fields with constrained write paths.
- Final message and room transition committed atomically.

### Full evaluation-first sequencing versus incremental contract-first implementation

Plan 2’s baseline, behavior contract, fixtures, and red evidence are compatible with plan 1 and should be imported. Its stronger rule that UI work cannot begin until critical AI behavior passes should not be imported wholesale.

The compatible sequence is:

1. Freeze baseline, behavior contract, fixtures, and deterministic red tests.
2. Implement the typed contract and state/persistence boundary.
3. Iterate prompt behavior and deterministic/UI integration in bounded parallel tracks.
4. Require every deterministic, Promptfoo, live-Qwen, and browser gate to pass before completion.

This preserves the request’s blocking evaluation requirement without creating an unnecessary waterfall.