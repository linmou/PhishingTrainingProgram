## Full Ranking

1. `plan_1.md` — strongest balance of correctness, architectural fit, implementation clarity, and validation.
2. `plan_2.md` — strongest evaluation strategy, with slightly more delivery sequencing risk.
3. `plan_3.md` — simplest implementation, but weaker concurrency and audit-state guarantees.
4. `plan_4.md` — excellent auditability, but materially over-engineered for the requested feature.

The [diversity check](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/approaches/diversity_check.md) was used only to confirm that the plans represent distinct strategies. It was not treated as evidence that any plan is higher quality.

## Rubric Scores

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 5 | 5 | 4 | 5 | 5 | 5 | **29/30** |
| `plan_2.md` | 5 | 4 | 4 | 4 | 5 | 5 | **27/30** |
| `plan_3.md` | 4 | 5 | 5 | 4 | 3 | 5 | **26/30** |
| `plan_4.md` | 5 | 3 | 2 | 4 | 5 | 5 | **24/30** |

## Ranking Reasons

### 1. `plan_1.md`

[Plan 1](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_1.md) is the best backbone because it gives Guard Mode one narrow, testable abstraction without replacing the existing room architecture.

Its strongest decisions are:

- A pure two-state transition module isolated from React, Supabase, and the AI provider.
- Clear separation among immutable raw AI output, the human review draft, and the final sent record.
- An atomic reviewed-send operation that persists the final message and authoritative room transition together.
- Message-local `response_mode` for stable historical rendering and separate room-level state for current locking.
- Explicit handling of malformed AI output, human rectification, manual activation/deactivation, real-time synchronization, server-side progress enforcement, and legacy messages.
- Complete deterministic, Promptfoo, live-Qwen, browser, regression, build, and documentation gates.

This directly answers almost every acceptance criterion in the request. The pure transition table also makes the most safety-critical behavior—activation, persistence, exit, rectification, and locking—easy to test at 100%.

It loses one Simplicity point because twenty implementation steps, a room projection, message audit fields, and a transition audit table are more machinery than the minimum. Even so, each major structure answers a stated persistence, audit, concurrency, or locking requirement.

### 2. `plan_2.md`

[Plan 2](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_2.md) is strongest where the request is unusually demanding: AI behavior evaluation must block delivery.

Its particularly strong contributions are:

- Capturing the existing tutoring evaluation baseline before changing behavior.
- Defining a versioned behavior contract and justified fixtures before prompt tuning.
- Separating ecological development cases from independently worded synthetic holdouts.
- Treating schema validity as a prerequisite for behavioral scoring.
- Requiring per-case metadata, explicit failure classification, no missing applicable scores, and preserved existing tutoring gates.
- Using equal-mistake-count contrast cases to distinguish intent from repetition.

The runtime design is also sound: one authoritative room mode, atomic reviewed sends, state-version conflict detection, raw/final separation, server-side locking, and stable per-message rendering.

It ranks below Plan 1 because it makes model-evaluation success an intermediate prerequisite for later UI work: “Do not start UI implementation until the contract cases and critical AI behavior cases pass.” **Inference:** because live-model behavior is probabilistic, this serial dependency could delay deterministic UI and persistence work that could otherwise proceed independently under TDD.

Its manual activation and deactivation are also constrained to sending a reviewed response. That technically supplies human control, but it is less flexible than Plan 1’s explicit audited override operation.

### 3. `plan_3.md`

[Plan 3](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_3.md) is the cleanest minimal-change approach. It preserves the existing:

`generateTutorSuggestion → RoomContext → AISuggestionBox → CommentInput → message insertion → PostComment`

and adds only the structured decision, final mode, raw/final audit data, room state, presentation branches, and shared lock check.

That is highly feasible and gives it the best Simplicity score. Its centralization of the decoder, transition calculation, and persistence-payload builder limits the risk of components inventing different mode rules. Its validation coverage is also comprehensive.

It ranks below Plan 2 because several high-risk persistence choices remain less definite:

- The atomic implementation may be “a narrow database trigger or existing transactional server-side message operation,” leaving the authoritative mechanism unresolved.
- The room state has `guard_active`, timestamp, and source message, but no required revision or sequence for rejecting stale concurrent writes.
- Real-time convergence is tested, but there is no explicit ordering rule for out-of-order subscription updates.
- Manual deactivation requires sending a Tutor response.
- Existing manually composed tutor messages are “normally `tutoring`.” **Inference:** unless the UI forces an explicit decision while Guard is active, an ordinary manual message could accidentally clear Guard.
- Every successful generation is persisted immediately and later updated with its disposition. **Inference:** rapid regeneration or multi-client use creates audit-update races unless those records are immutable or versioned.

These issues are repairable, but Plan 1 already resolves them more clearly.

### 4. `plan_4.md`

[Plan 4](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/guard-mode-whole-feature/candidates/plan_4.md) provides the strongest forensic audit model:

- Immutable room-sequenced events.
- Explicit causation and correlation identifiers.
- Transactional message/event/projection writes.
- Projection replay and equivalence testing.
- Stale-sequence rejection.
- Immediate audited manual deactivation.
- Strong RLS separation between audit data and student-visible state.

Its requirement coverage and validation are excellent. It ranks last because event sourcing is not required to satisfy the request. The request calls for final message mode, current room state, raw AI decision, rectification, and audit metadata; Plan 1 satisfies those with ordinary message records, a room projection, and a small transition audit.

Plan 4 additionally requires:

- A general event table and payload schemas.
- A room-specific sequence allocator.
- Multiple event types per reviewed response.
- A rebuildable projection.
- Replay/rebuild support.
- Event/projection equivalence testing.
- Multiple specialized RPC write paths.
- Event-level privacy and authorization policies.

**Inference:** this substantially increases migration, RLS, debugging, and operational burden for a feature with only two authoritative states. Plan 4 acknowledges the same risk under “Event sourcing introduces excessive complexity for a one-to-one room,” and its mitigation limits the event framework but does not remove that fundamental cost.

There is also a semantic concern: `correction_evaluated(adequate|inadequate)` is inferred from the AI’s selected mode while Guard is active. The model contract returns a mode and reason, not a separately validated correction classification. Recording that as an independent factual event could overstate what the model actually established.

## Risks and Tradeoffs

### `plan_1.md`

- The transition module must remain narrow. If it starts duplicating general `RoomContext` or message behavior, the primary simplicity advantage disappears.
- Its room revision is described conditionally—“if the existing send path permits concurrent writes.” That should become mandatory as either an expected revision, row lock, or equivalent conflict check.
- The implementation must locate every authoritative student-progression mutation; protecting only known UI controls would not satisfy the lock requirement.
- A transition audit table plus message audit fields creates some duplication, although their responsibilities are reasonably separated.
- The long implementation sequence could encourage unnecessary refactoring unless the “thin adapters” boundary is enforced.

### `plan_2.md`

- Evaluation-first sequencing gives excellent release safety but can put probabilistic AI behavior on the critical path before deterministic persistence and UI work.
- Building an evaluation parser before the production validator creates a possible two-parser problem. The final design should use one shared structured-output contract and parser.
- Requiring a sent response for every manual activation/deactivation gives clean message-linked history but reduces operational flexibility.
- Backfilling all existing rooms to tutoring is reasonable, but the migration must ensure an active legacy room is not incorrectly inferred from unavailable history.
- The versioned evaluation policy can become a second product specification unless it remains traceable to the request.

### `plan_3.md`

- Its unspecified choice among trigger, existing transaction, or another server operation may lead to inconsistent implementation across environments.
- No explicit room revision/sequence leaves stale concurrent reviews insufficiently controlled.
- Immediate suggestion persistence is good for auditability but increases database traffic and requires robust immutable disposition handling.
- Manual messages carrying an explicitly supplied mode are a potential accidental-transition path.
- A single `guard_active` Boolean is simple, but it needs sufficient version and transition metadata to support reliable real-time reconciliation.
- The plan lacks Plan 1’s explicit append-only record for manual state changes that do not naturally belong to an AI-backed message.

### `plan_4.md`

- Event-store, sequence, projection, replay, and RPC correctness become new critical subsystems.
- Every additional event payload schema increases migration and validation surface.
- Persisting rejected raw provider output may create disproportionate storage and privacy exposure; access controls reduce but do not eliminate that burden.
- Projection-rebuild support is operationally meaningful only if it is maintained and exercised after future schema versions.
- The distinction among AI decision, correction evaluation, human review, rectification, response sent, and projection state may make ordinary debugging harder.
- **Inference:** developers may bypass the event path for unrelated room-message changes, creating precisely the dual-write problem event sourcing is intended to prevent.

## Recommended Backbone

Use `plan_1.md` as the backbone.

Before implementation, make four targeted refinements:

1. Make stale-write protection mandatory.

   Require the reviewed-send and manual-override operations to use an expected room revision, a row lock, or an equivalent conflict mechanism. Do not leave this conditional on the existing send path.

2. Import Plan 2’s evaluation baseline and fixture discipline.

   Record the existing tutoring baseline first, define justified ecological and independent holdout cases, and capture a version/hash for the behavior policy and prompt. These strengthen Plan 1 without changing its architecture.

3. Keep one runtime/evaluation schema validator.

   Evaluation may wrap the validator to score behavior, but it should not implement a separate parser that can disagree with production.

4. Preserve suggestion lifecycle evidence without creating another source of truth.

   Use the existing feedback/audit mechanism for rejected and regenerated suggestion dispositions if it can be extended cleanly. The sent message remains authoritative for final content/mode; the room projection remains authoritative for current state; the transition audit remains authoritative for manual and state-change history.

This yields the most coherent design:

```text
Qwen raw output
    → one strict validator
    → immutable AI decision
    → editable human review draft
    → atomic reviewed-send RPC
        ├── final message with final response mode and raw/final audit
        ├── authoritative room Guard state with revision
        └── append-only transition audit when appropriate
    → real-time tutor/student reconciliation
    → client and server progression enforcement
```

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in the Plan 1 backbone |
|---|---|---|
| `plan_2.md` | Captures the pre-change tutoring baseline with commit, model, provider, prompt/configuration, metric scores, and existing failures. This makes regression attribution defensible. | Insert at the beginning of Plan 1, Ordered Step 1, before writing Guard red tests. |
| `plan_2.md` | Defines a versioned, observable behavior contract and requires fixture justification before prompt tuning. This reduces ambiguous AI evaluation oracles. | Insert between Plan 1 Steps 1 and 2; use it to derive schema tests, critical behavior cases, and Promptfoo fixtures. |
| `plan_2.md` | Uses equal-count contrast cases—deliberate violations versus genuine effort—to prove that activation is semantic rather than counter-based. | Insert into Plan 1 Step 15’s ecological and synthetic-holdout datasets. |
| `plan_2.md` | Explicitly classifies evaluation failures as policy, fixture, prompt, parser, or provider failures. This makes a blocking gate actionable without configuration drift. | Insert into Plan 1 Steps 15–16 and final delivery evidence. |
| `plan_3.md` | Gives every generated suggestion a stable identifier and disposition such as accepted, edited, rectified, rejected, or superseded. This preserves regeneration/rejection evidence. | Insert into Plan 1 Step 9’s `RoomContext` lifecycle and the existing feedback/audit persistence adapter; do not create a second final-message authority. |
| `plan_3.md` | Defines one persistence-payload builder carrying raw AI data, reviewed data, and metadata together. This reduces accidental omission at the send boundary. | Insert immediately before Plan 1 Step 7’s atomic reviewed-send service adapter. |
| `plan_3.md` | Explicitly tests rapid regeneration, duplicate sends, stale suggestions, and retention of an edited draft after send failure. | Insert into Plan 1 Steps 7, 9, and 14. |
| `plan_4.md` | Uses a mandatory monotonic revision/sequence and ignores older real-time updates. This closes stale-send and out-of-order subscription risks. | Insert into Plan 1’s room projection schema, atomic reviewed-send RPC, and Step 13’s real-time reconciliation. |
| `plan_4.md` | Refetches authoritative state after reconnect instead of trusting subscription continuity. | Insert into Plan 1 Step 13’s tutor/student real-time behavior. |
| `plan_4.md` | Provides immediate, separately audited manual deactivation without modifying historical messages. | Retain and sharpen Plan 1’s manual-override operation in Steps 7 and 13. Do not import the full event-sourcing model. |
| `plan_4.md` | Explicitly tests cross-room and student access to raw reasons, prompt data, and audit metadata. | Insert into Plan 1’s migration/RLS tests in Steps 6–7 and integrated validation in Step 14. |

## Incompatibilities

- Do not combine Plan 1’s message/room/transition model with Plan 4’s event stream as an additional equal source of truth. The two designs use different authoritative boundaries. Importing the entire event stream would require rewriting Plan 1’s persistence model rather than improving it.

- Do not import Plan 4’s `correction_evaluated` event as currently defined. It derives an independent correction classification from the proposed mode, although the required AI contract does not expose a separately validated correction result.

- Do not retain both Plan 2’s evaluation parser and Plan 1’s runtime validator as independent implementations. One shared schema validator should be used by production and evaluation.

- Do not import Plan 2’s rule that manual deactivation must always accompany a sent Tutor response. Plan 1’s audited immediate override better satisfies the general human-control requirement while leaving historical messages intact.

- Do not combine Plan 3’s optional database-trigger approach with Plan 1’s explicit reviewed-send RPC. State-changing writes need one authoritative transaction path.

- Do not let Plan 3’s immediate suggestion audit and Plan 1’s message audit become mutable duplicate records for final mode or final wording. Suggestion audit should retain immutable raw generation data and disposition; the final message should remain authoritative for what was sent.

- Do not preserve Plan 3’s “manual messages normally tutoring” behavior without an explicit mode review when the room is active. **Inference:** an implicit tutoring selection could unintentionally deactivate Guard.

- Do not import Plan 4’s full projection-rebuild machinery unless a concrete operational requirement for replay is added. A versioned current-state projection plus append-only transition history is sufficient for the stated feature.