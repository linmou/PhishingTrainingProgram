# Selected Approach 2: Vertical Slices

- Core strategy: implement complete user-visible slices from learner signal through persistence and UI.
- Primary optimization target: early end-to-end feedback.
- Decomposition boundary: happy path, fail/recover path, privacy path, concurrency path.
- Sequencing principle: each slice gets code, test, and evidence before the next.
- Main tradeoff: shared primitives may be revisited across slices.
- Major risk: cross-slice duplication or inconsistent state authority.

## Required slices

1. Initialize a learner-owned transfer checklist and record an eligible signal.
2. Prepare, review, edit, confirm, and deliver one public four-option question.
3. Grade correct and wrong answers deterministically, including repair and new-context recovery.
4. Exercise Guard deferral, stale drafts, retries, reconnects, duplicate tabs, and privacy/authorization attacks.
5. Compare AI behavior with Promptfoo and then run browser release verification.

Each slice must use the server as the authority for identity, keys, idempotency, and progress transitions.
