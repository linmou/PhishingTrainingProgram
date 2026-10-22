# Approach Pool

## 1. traceability-first

- Core strategy: build a requirement-to-file-to-test traceability graph before implementation.
- Primary optimization target: prevent intent drift and make progress auditable.
- Decomposition boundary: one file per authority boundary and one gate ledger.
- Sequencing principle: source comparison, then artifacts, then code, then verification.
- Main tradeoff: slower initial setup.
- Major risk: documentation can become stale unless milestones require evidence links.

## 2. release-gate-first

- Core strategy: organize around the release blockers and work backward to implementation tasks.
- Primary optimization target: avoid false claims of readiness.
- Decomposition boundary: security, database, evaluation, browser, and activation gates.
- Sequencing principle: block activation until each high-risk gate has evidence.
- Main tradeoff: lower-risk domain work is discussed after security gates.
- Major risk: isolated gate files may obscure implementation ownership.

## 3. vertical-slices

- Core strategy: implement complete user-visible slices from learner signal through persistence and UI.
- Primary optimization target: early end-to-end feedback.
- Decomposition boundary: happy path, fail/recover path, privacy path, concurrency path.
- Sequencing principle: each slice gets code, test, and evidence before the next.
- Main tradeoff: shared primitives may be revisited across slices.
- Major risk: cross-slice duplication or inconsistent state authority.

## 4. domain-boundaries

- Core strategy: separate pure state, parsing, grading, server authority, and UI consumers.
- Primary optimization target: simple ownership and low coupling.
- Decomposition boundary: reducer, parser/grader, storage, trusted API, room/UI.
- Sequencing principle: establish contracts before consumers.
- Main tradeoff: integration evidence arrives later.
- Major risk: correct local contracts can still fail at runtime boundaries.

## 5. evaluation-first

- Core strategy: freeze cases, rubrics, semantic metrics, and gates before prompt/runtime edits.
- Primary optimization target: measurable AI behavior and reproducibility.
- Decomposition boundary: spec, fixtures, harness, baseline/candidate, holdout, product checks.
- Sequencing principle: define expected behavior, validate evaluators, then implement and compare.
- Main tradeoff: live feature work waits for evaluation decisions.
- Major risk: evaluator scope can be overbuilt before product integration stabilizes.

## 6. database-security-first

- Core strategy: prove ownership, key confidentiality, transactions, and authorization before UI exposure.
- Primary optimization target: avoid unsafe data release or bypasses.
- Decomposition boundary: migration, RLS, private schema, trusted operations, attack tests.
- Sequencing principle: schema invariants first, then server calls, then clients.
- Main tradeoff: visible product progress is slower.
- Major risk: hosted environment and credentials can block all downstream work.

## 7. state-machine-first

- Core strategy: model every progress/question lifecycle transition and failure path as an explicit matrix.
- Primary optimization target: deterministic recovery and idempotency.
- Decomposition boundary: state events, question lifecycle, message lifecycle, retries/races.
- Sequencing principle: enumerate transitions, implement reducer, enforce transaction, exercise UI.
- Main tradeoff: significant upfront case authoring.
- Major risk: semantic AI quality may be under-specified.

## 8. migration-compatible-incremental

- Core strategy: preserve legacy behavior through additive schema and dual-policy boundaries.
- Primary optimization target: reversible rollout with minimal regression.
- Decomposition boundary: legacy compatibility, transfer policy, activation, rollback.
- Sequencing principle: additive storage, trusted operations, prompt/UI, evaluation, enablement.
- Main tradeoff: two policy paths increase test matrix size.
- Major risk: compatibility shims can hide incomplete transfer behavior.
