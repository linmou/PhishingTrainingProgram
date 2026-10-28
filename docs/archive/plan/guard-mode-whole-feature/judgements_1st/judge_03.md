## Full Ranking

1. [plan_1.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md) — state-machine contract
2. [plan_2.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_2.md) — evaluation-first gate
3. [plan_3.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md) — minimal suggestion overlay
4. [plan_4.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md) — audit event sourcing

The permitted [diversity check](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/approaches/diversity_check.md) supports that these are materially different strategies. It was not treated as evidence that any strategy is better. No other judge outputs were read.

## Rubric Scores

Scores are out of 5; totals are out of 30.

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 5 | 5 | 4 | 5 | 5 | 5 | **29** |
| `plan_2.md` | 5 | 4 | 3 | 4 | 5 | 5 | **26** |
| `plan_3.md` | 4 | 4 | 5 | 4 | 3 | 5 | **25** |
| `plan_4.md` | 5 | 3 | 2 | 3 | 5 | 5 | **23** |

## Ranking Reasons

### 1. `plan_1.md`

This is the best-balanced response to the [request](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/request.md). Its narrow pure state machine directly captures the essential invariants without taking ownership of unrelated room, React, Supabase, or provider behavior. That boundary makes the implementation testable and fits the existing architecture.

Its strongest decisions are:

- Clear separation among immutable AI output, editable human review state, and the final sent record.
- Message-specific final mode for stable historical rendering, paired with an authoritative room-state projection for current locking.
- One atomic reviewed-send operation covering the final message, room state, and audit history.
- Backend as well as UI enforcement of the progression lock.
- A strict fail-closed parser before `RoomContext`.
- Explicit handling of manual activation and deactivation, including an audited operation independent of draft generation.
- Thorough deterministic, Promptfoo, production-Qwen, browser, regression, RLS, real-time, and documentation validation.

It is not perfectly minimal: a pure reducer, room projection, per-message fields, and append-only transition records create more schema than the smallest overlay would. However, each element serves a separate requirement. Unlike full event sourcing, reconstruction and replay infrastructure are not made central to ordinary feature operation.

### 2. `plan_2.md`

This plan best emphasizes the request’s unusual but explicit requirement that AI-behavior evaluation be a blocking delivery condition. Recording the existing configuration and results, defining justified ecological and holdout cases, capturing red evidence, and preventing ambiguous evaluation fixtures from becoming the oracle are all strong contributions.

It ranks below Plan 1 because it turns the evaluation program into the primary decomposition boundary and adds a versioned behavior contract, evaluation-specific parsing/scoring, three persistence layers, and a strict phase sequence before UI work. These are defensible, but they increase delivery overhead relative to a small state-machine core.

It also assumes that manual activation and deactivation should occur only by sending a reviewed response. That is a coherent product rule, but it is narrower than Plan 1’s explicit audited manual override.

**Inference:** The request’s statement that the tutor can “also activate, deactivate, or rectify the mode” likely favors a distinct manual control, especially for deactivation, although it does not explicitly require that the control operate without sending a message.

### 3. `plan_3.md`

This is the simplest implementation strategy. It extends the existing `generateTutorSuggestion → RoomContext → AISuggestionBox → CommentInput → message → PostComment` path, centralizes only the decoder, transition calculation, and persistence-payload construction, and minimizes unrelated refactoring. The diversity check correctly identifies this as the smallest-overlay option and notes the corresponding risk of adding branches near existing mixed responsibilities.

Its validation coverage is strong and substantially satisfies the required gates. It also offers particularly useful audit treatment for rejected and superseded suggestions through stable suggestion identifiers and disposition tracking.

It ranks third because several high-risk matters are less decisively designed:

- The authoritative persistence operation remains “a narrow database trigger or existing transactional server-side message operation,” rather than selecting and specifying one authenticated, version-aware boundary.
- The room state is represented as a Boolean with a source message but no clear monotonic revision or stale-write protocol.
- Its real-time mitigation relies on the persisted room row and source message without a concrete ordering rule.
- Manual activation and deactivation take effect only through sending another response.
- Extending and updating the existing feedback record for every generation is assumed feasible without evidence from the supplied repository context.

These are solvable implementation details, but they are precisely where locking, audit consistency, and simultaneous tutor/student state can fail.

### 4. `plan_4.md`

This plan is exceptionally strong for forensic auditability. Immutable events, room-local sequence numbers, transactional projection updates, stale-write rejection, replay equivalence, reconnect recovery, and RLS isolation produce the strongest reconstruction story of any candidate.

It ranks last because event sourcing is disproportionate to the requested two-state feature. The plan introduces an event vocabulary, per-event payload schemas, causation identifiers, sequence assignment, an event reducer, a rebuildable projection, replay tooling, multiple RPCs, and event/projection equivalence testing. The plan itself recognizes this as its primary complexity risk, and the diversity check identifies “more persistence/projection complexity” as its main tradeoff.

There is also a semantic audit concern: `correction_evaluated(adequate|inadequate)` is derived from the AI’s proposed mode. Because the tutor may rectify that mode, the event name can overstate a model proposal as an authoritative evaluation result.

**Inference:** A rebuildable event stream would become justified if the product required regulatory-grade reconstruction, cross-version replay, or later analytical projections. None of those requirements appears in the supplied request.

## Risks and Tradeoffs

| Plan | Principal benefit | Principal risk or cost |
|---|---|---|
| `plan_1.md` | Strong invariants and transactional correctness with a bounded architectural addition | More upfront contract and persistence modeling than a direct overlay |
| `plan_2.md` | Strongest protection against evaluator ambiguity, prompt overfitting, and silent configuration drift | Evaluation infrastructure and sequencing can dominate the feature and slow integrated feedback |
| `plan_3.md` | Smallest source change and closest fit to the current component flow | Guard branches may accumulate in `RoomContext`; concurrency and real-time ordering remain underspecified |
| `plan_4.md` | Best immutable audit, sequencing, replay, and reconstruction guarantees | Highest schema, RPC, migration, operational, testing, and maintenance burden |

Cross-cutting risks that the final plan must retain explicitly are:

- The model may confuse repeated learning difficulty with deliberate system-playing.
- A superficial or keyword-only response may be mistaken for a meaningful correction.
- A final message and room lock may diverge without a single transaction.
- A stale real-time client may briefly show progression as available.
- Raw `mode_reason`, prompt details, or provider output may leak to students.
- Historical Guard messages may change appearance if rendered from current room state instead of their own final mode.
- Prompt or structured-output changes may degrade the eight existing tutoring metrics.
- Failed AI evaluations may invite silent changes to the model, prompt configuration, fixtures, or thresholds.

## Recommended Backbone

Use `plan_1.md` as the backbone.

Its pure transition contract is the right center of gravity: it formalizes the small amount of genuinely new domain behavior while leaving `RoomContext`, Supabase, Qwen integration, and rendering as adapters. It satisfies the full request without committing the system to event sourcing or embedding transition logic throughout existing UI components.

I would retain these Plan 1 decisions unchanged:

- `tutoring | guard` as the shared domain state rather than a separate persisted lock Boolean.
- Raw AI decision, human review draft, and sent record as distinct representations.
- Final message mode for historical identity and room state for current progress control.
- Atomic reviewed-send and audited manual-override operations.
- Strict provider-boundary validation with no guessed fallback.
- UI and server-side progression enforcement.
- Critical 100% behavior gates plus preservation of the existing tutoring thresholds.

Two refinements should be made to the backbone:

1. Make the room revision/version mandatory rather than conditional on whether the existing path “permits” it. The reviewed-send RPC should compare the expected revision and reject stale reviews.

2. Record each generated suggestion under a stable identifier, including rejected and superseded suggestions, while keeping raw decision data immutable. This better supports the request’s per-suggestion review and audit intent.

The full event-sourcing architecture should not be imported.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in the Plan 1 backbone |
|---|---|---|
| `plan_2.md` | Record the current deterministic, Promptfoo, live-Qwen, and browser baseline with exact provider/model/configuration and pre-existing failures before changing behavior. This provides credible regression evidence and prevents Guard work from being blamed for earlier failures. | Expand Plan 1, Ordered Step 1, before writing the first red contract test. |
| `plan_2.md` | Define and justify the ecological and synthetic-holdout behavior matrix before prompt tuning, including equal-count contrasts where deliberate violations activate Guard but genuine effort does not. This tests semantic intent rather than mistake count. | Add after Plan 1, Ordered Step 1; use the fixtures in Steps 15 and 16. The fixtures may be red initially but remain blocking at delivery. |
| `plan_3.md` | Give each successful generation a stable suggestion ID and retain immutable raw output plus a separate disposition such as accepted, edited, rectified, rejected, or superseded. This preserves review history across regeneration instead of auditing only the finally sent draft. | Add the storage contract during Plan 1 Steps 6–7 and carry the identifier through `RoomContext` in Step 9. |
| `plan_4.md` | Use a mandatory monotonic room-state revision, ignore older real-time state updates, and refetch authoritative state after reconnect. This prevents a delayed update from incorrectly unlocking or relocking the student. | Add the revision constraint and compare-and-set behavior in Plan 1 Steps 6–7; add ordering and reconnect behavior in Step 13. |
| `plan_4.md` | Explicitly test that students cannot read raw reasons, provider output, prompt data, or audit metadata across both RLS and frontend rendering boundaries. | Expand Plan 1 Steps 6, 12, and 14 and the browser validation in Step 17. |

**Inference:** Auditing rejected and superseded generations is stronger than the request’s explicit final-message persistence criterion, but it follows naturally from the requirement that every AI suggestion receive human review and that raw decisions and review actions be auditable.

## Incompatibilities

- **Source of truth:** Plan 1 uses a current room projection plus per-message evidence and a narrow transition audit. Plan 4 makes the event stream the source of truth and the room state rebuildable from it. Importing both would create redundant representations and force event replay semantics into an otherwise small feature. Choose Plan 1’s model.

- **Persistence mechanism:** Plan 3 leaves open a database trigger or an existing transactional operation. Plan 1 specifies a narrow authenticated RPC that can validate authorization, raw/final consistency, expected room revision, message insertion, transition audit, and room update together. Mixing trigger-driven and RPC-driven transitions risks dual writers.

- **State representation:** Plan 3 proposes `guard_active: boolean`, while Plans 1 and 2 use the same `tutoring | guard` domain as AI and message modes. Maintaining both forms would invite conversion errors or redundant fields. Use the constrained response-mode value and derive `canStudentProgress`.

- **Manual-deactivation semantics:** Plans 2 and 3 require another reviewed Tutor response before deactivation. Plans 1 and 4 allow an immediate audited tutor deactivation. These behaviors cannot both define the authoritative transition rule. The recommended backbone should retain immediate audited manual deactivation, while semantic automatic exit still occurs only after the AI proposes tutoring and the tutor sends the reviewed response.

- **Evaluation sequencing:** Plan 2 says not to begin UI work until critical model-behavior cases pass. Plan 1 decomposes contracts, persistence, AI, UI, and evaluation work around TDD responsibilities. Import Plan 2’s baseline, fixtures, and delivery gates, but not its hard prohibition on parallel UI implementation. The request makes evaluation blocking for completion, not necessarily a prerequisite for starting every deterministic UI slice.

- **Correction-event semantics:** Plan 4 records `correction_evaluated(adequate|inadequate)` from the AI-proposed mode. That conflicts with the request’s human-authoritative final mode and risks presenting a rectifiable model proposal as an established fact. Preserve the raw mode and reason instead; derive state only from the reviewed final action.

- **Audit mutability:** Plan 3 describes updating an existing suggestion audit record with later disposition. If the adopted audit model treats raw generations as immutable, dispositions should be separate linked records or append-only fields/events rather than mutations that can overwrite original evidence.