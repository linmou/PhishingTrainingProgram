# Selected approach rationale

## Selection

Selected cards:

1. `state-machine-contract`
2. `evaluation-first-gate`
3. `minimal-suggestion-overlay`
4. `audit-event-sourcing`

## Rationale

`state-machine-contract` is the backbone because Guard Mode has several coupled states—raw AI decision, human rectification, final sent mode, active lock, correction evaluation, and return to tutoring. Explicit invariants prevent the tutor and student projections from inventing separate transition rules.

`evaluation-first-gate` is selected because the user requires every AI behavior change to pass relevant evaluation. It makes the mode contract, semantic false-positive cases, persistence/exit cases, regression metrics, and release gates first-class inputs to implementation.

`minimal-suggestion-overlay` supplies the repository-specific integration strategy. The current suggestion box, copy-to-input flow, composer, RoomContext, and message feedback path already implement the human wording layer. Reusing them keeps the feature aligned with the existing product and avoids a parallel tutor interface.

`audit-event-sourcing` is selected as a bounded contribution, not as a full replacement architecture. The implementation should preserve immutable raw/final mode decision data and derive the active state without requiring a broad event-sourcing rewrite. This directly supports the user's requirement to record raw AI decisions and human rectifications.

## Rejected as primary strategies

- `two-stage-policy-writer`: adds latency and a second model decision boundary, while the requirement is that mode be part of the same AI response consumed downstream.
- `database-authoritative-realtime`: useful for persistence details but too broad as the primary decomposition; it risks pushing transient review state into the database prematurely.
- `composer-first-human-control`: its UI-first boundary can leave non-UI AI/state paths under-specified; it is retained as an interaction detail within the overlay strategy.
- `vertical-slice-release`: useful sequencing guidance, but not a sufficiently distinct architectural backbone for the audit and transition requirements.
