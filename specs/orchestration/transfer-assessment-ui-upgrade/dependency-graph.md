Intent: Control component ownership, contracts, dependencies, integration edges, and promotion conditions for the transfer-assessment UI upgrade.

# Transfer Assessment UI Upgrade Dependency Graph

## Baseline

- Target branch: `research/lean-transfer`
- Immutable baseline: `d6e1a589893e72862955404c277f5eb65b6edc4f`
- Integration branch: `integration/transfer-assessment-ui-upgrade`
- Integration worktree: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment-ui-upgrade/integration`
- Allocation packet: V2, approved 2026-09-22 with server-authoritative attempts.
- Requirement input: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/assessment_ui_change.md`, SHA-256 `5d913b4647ab15b2a98ca23c956199f1d265a99d9803cf768586a7bbbde051d3`.
- Revised UI specification source: `94f0dce2f950ba2fde2e9be16c3816f61c071009`.

## Components

### 101 Transfer Domain

- Branch/worktree: `101-transfer-domain`; `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-domain`
- Stable owner: `owner-101-domain`
- Responsibility: two-attempt lifecycle, terminal/retry outcomes, learner-safe explanation contract, deterministic progress transitions.
- Public contracts: private assessment explanation; attempt-aware answer outcome; server-consumable grading/orchestrator results.
- Shared ownership: assessment types and barrel exports, pure grading/orchestrator logic, golden fixtures.
- Expected tests: first incorrect remains open; correct on either attempt passes; second incorrect fails; duplicates and third attempts cause no transition; explanation validation and private/public separation.
- Exclusions: persistence, transport, React, evaluation.
- Artifact path: `specs/101-transfer-domain/`.

### 102 Transfer Backend

- Branch/worktree: `102-transfer-backend`; `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-backend`
- Stable owner: `owner-102-backend`
- Responsibility: server-authoritative grading and attempts, private-key boundary, explanation generation/storage, retry/terminal DTOs, stem-only message content.
- Public contracts: persisted attempt state; role-safe retry/terminal response; correct answer and learner-safe explanation revealed only at terminal failure.
- Shared ownership: transfer service/API DTOs, production prompt, server/RPC boundary, migrations and backend tests.
- Expected tests: reload/tab concurrency, idempotency, authorization, terminal disclosure, no early key leakage, and exact-once option rendering input.
- Exclusions: React rendering and evaluation policy.
- Artifact path: `specs/102-transfer-backend/` (restore after its deliberate deletion in `5a7f2a2`).

### 103 Transfer Room UI

- Branch/worktree: `103-transfer-room-ui`; `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-room-ui`
- Stable owner: `owner-103-ui`
- Responsibility: radio/checkbox submission, disabled submit state, server-result feedback, teacher explanation editor, exact-once option rendering, and participant-local folding.
- Public contracts: consume 101/102 exports unchanged; emit selected option IDs and assessment identity; retain only presentation state locally.
- Shared ownership: transfer React components, room UI adapter/context/pages, UI fixtures and React tests.
- Expected tests: control semantics, submit gating, retry/terminal rendering, confirmation reset, folding isolation, reconnect, accessibility, and privacy.
- Exclusions: grading, attempt authority, storage schema, and evaluator behavior.
- Artifact path: `specs/103-transfer-room-ui/`.

### 104 Transfer Evaluation

- Branch/worktree: `104-transfer-evaluation`; `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment/transfer-evaluation`
- Stable owner: `owner-104-evaluation`
- Responsibility: two-attempt deterministic cases and learner-explanation correctness/safety evaluation.
- Public contracts: consume the promoted domain lifecycle and backend request/explanation contract without copying product logic.
- Shared ownership: `evals/promptfoo/v1/transfer/**` and transfer rubrics.
- Expected tests: two-attempt sequences, explanation omission/leakage/incorrectness, manifest coverage, request parity, and quality-gate regression.
- Exclusions: production prompt ownership, domain logic, UI, and persistence.
- Artifact path: `specs/104-transfer-evaluation/`.

## Provisional Dependencies

- `101 -> 102`: backend persistence and DTOs require the canonical two-attempt and explanation contracts.
- `101 -> 103`: the UI consumes shared assessment types and lifecycle results.
- `101 -> 104`: evaluation fixtures require canonical lifecycle outcomes.
- `102 -> 103`: the UI requires server-authoritative retry/terminal responses and stem-only content.
- `102 -> 104`: evaluation requires the production explanation/request contract and server outcome semantics.

This graph remains provisional until all component planning packages pass analysis and cross-component reconciliation.

## Capacity Waves

- Planning wave: all four stable owners may plan concurrently; no implementation is allowed.
- Implementation wave 1: 101.
- Implementation wave 2: 102 after a green 101 promotion SHA.
- Implementation wave 3: 103 and 104 after green 101 and 102 promotion SHAs, scheduled within TDD monitor/reviewer capacity.

## Integration Ownership

The main integration agent owns reconciliation, the authoritative post-planning DAG, edge work packets, integration glue, `tests/integration/**`, `tests/e2e/**`, coverage manifests, serial merges, and promotion records. The dirty `105-transfer-release` worktree is outside this initiative and remains untouched.
