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

## Authoritative Dependencies

- `101 -> 102`: backend persistence and DTOs require the canonical two-attempt and explanation contracts.
- `101 -> 103`: the UI consumes shared assessment types and lifecycle results.
- `101 -> 104`: evaluation fixtures require canonical lifecycle outcomes.
- `102 -> 103`: the UI requires server-authoritative retry/terminal responses, target routing metadata, and stem-only content.
- `102 -> 104`: evaluation requires the production explanation/request contract and server outcome semantics.

The post-planning reconciliation confirmed this acyclic graph without changing approved scope, ownership, contracts, or implementation waves.

## Capacity Waves

- Planning wave: all four stable owners may plan concurrently; no implementation is allowed.
- Implementation wave 1: 101.
- Implementation wave 2: 102 after a green 101 promotion SHA.
- Implementation wave 3: 103 and 104 after green 101 and 102 promotion SHAs, scheduled within TDD monitor/reviewer capacity.

## Reconciled Contracts

- 101 owns `TransferAttemptSnapshot`, result variants, and private `TransferTerminalFeedback`. A passed result retains feedback only for server/audit handling and fixes `learner_feedback_authorized: false`; only a failed second attempt authorizes learner projection.
- 102 owns the browser boundary. `PublicAssessmentDTO` is exactly `{ id, student_id, selection_type, stem, options }`; `student_id` is routing metadata, never authorization, and `rendered_text` is excluded. Its `ProcessedMessageDTO` is canonical: `message_id`, `assessment_id`, `processing_state`, `answer_outcome`, `attempt_number`, `attempts_used`, `attempts_remaining`, `selected_option_ids`, `terminal`, `transition`, `feedback_required`, `code`, `already_processed`, and `terminal_failure_feedback`.
- 103 maps 102's exact DTO fields into React-only view state. It creates no local attempt/lifecycle authority and exposes `terminal_failure_feedback` only for an authorized failed outcome.
- 104 pins the promoted 101/102 contracts, evaluates the teacher-reviewed explanation, and checks that pass, retry, and delivery projections contain no key or explanation.
- Target and judge configuration is server-only `OAI_API_KEY`, `OAI_BASE_URL`, and required `OAI_MODEL=qwen3.5-flash`, using the approved DashScope-compatible provider with no fallback.

## Edge Work Packets

### E01: 101 -> 102 Domain Lifecycle To Trusted Persistence

- Producer output / consumer input: real `PrivateAssessment`, `TransferAttemptSnapshot`, and discriminated domain result pass directly to 102's validation and trusted RPC/service boundary.
- Invariants: only a valid selection consumes an attempt; first wrong is open/1 with no transition; pass is terminal without learner disclosure; second wrong is terminal failed with one transition and eligible terminal feedback.
- Integration glue: 102 maps the producer result without recreating grading/lifecycle logic and atomically locks/persists the private assessment and append-only attempt.
- Handoff test: `tests/integration/transfer-domain-backend-two-attempt.test.mjs` creates 101 results and supplies those same values to the 102 test boundary in one run.
- E2E/smoke: teacher delivery, wrong-correct, wrong-wrong, duplicate, and third-attempt flow.
- Producer gate (101): domain lifecycle, explanation, and fixture tests pass without 102 code. Consumer gate (102): actual-output handoff, 101 and 102 focused suites, SQL/RPC contract suite, and smoke pass on one integration SHA.

### E02: 101 -> 103 Domain Contract To UI Mapping

- Producer output / consumer input: promoted 101 attempt/result types feed 103's adapter mapping through the promoted 102 DTO, never a copied lifecycle fixture.
- Invariants: UI state is display-only; retry has no terminal feedback; pass/failure terminal behavior is distinguishable without local grading.
- Integration glue: none beyond 103 imports of promoted types and the adapter's exhaustiveness checks.
- Handoff test: covered through E03 using a real 101 result carried by 102's output; no separate synthetic adapter fixture is accepted.
- E2E/smoke: learner selection and terminal display from persisted server outcome.
- Producer gate (101): canonical attempt/result types and lifecycle tests pass. Consumer gate (103): a real 101 result carried through 102 output reaches the UI mapping in the same run; E03 may share this run only when that 101 provenance is asserted.

### E03: 102 -> 103 Trusted DTO To Room UI

- Producer output / consumer input: `PublicAssessmentDTO` and `ProcessedMessageDTO` from the real 102 facade feed `transferAssessmentUiAdapter.ts`, `RoomContext.tsx`, and question components.
- Invariants: DTO field names are unchanged; `student_id` routes controls but never authorizes; stem/options render once; `terminal_failure_feedback` appears only for failed second attempts.
- Integration glue: integration owner resolves only import/export or merge wiring; component-local adapter changes remain 103-owned.
- Handoff test: `tests/integration/transfer-backend-room-ui-two-attempt.test.mjs` passes a real 102 response from the same run into the actual 103 adapter and rendered room state.
- E2E/smoke: radio/checkbox submission, reload, duplicate tab race, fold persistence, and teacher editor flow.
- Producer gate (102): trusted public DTO and process-result contract tests pass without 103 code. Consumer gate (103): the handoff, UI focused suite, type check, and browser smoke pass on one integration SHA.

### E04: 101 -> 104 Domain Contract To Evaluation

- Producer output / consumer input: 101 golden attempt sequences and result discriminants feed 104 deterministic checks and immutable case evidence.
- Invariants: two-attempt semantics are consumed, not reimplemented; historical first-valid results cannot satisfy upgraded evidence.
- Integration glue: a thin evaluation bridge only.
- Handoff test: `tests/integration/transfer-domain-evaluation-two-attempt.test.mjs` sends real 101 sequence outputs to the 104 check in the same process.
- E2E/smoke: deterministic transfer suite and manifest gate.
- Producer gate (101): deterministic two-attempt and disclosure tests pass. Consumer gate (104): real 101 sequence outputs feed 104 checks; exact lifecycle and disclosure rows pass with the promoted contract hash.

### E05: 102 -> 104 Production/Disclosure Contract To Evaluation

- Producer output / consumer input: 102's request-builder identity, provider configuration reference, DTO projection, and reviewed explanation provenance feed 104 parity, disclosure, and quality checks.
- Invariants: no copied prompt or provider secret; target/judge configuration matches the approved required values; only failed second-attempt projection has key/explanation.
- Integration glue: 104's thin adapter consumes the real 102 export and records hashes.
- Handoff test: `tests/integration/transfer-backend-evaluation-two-attempt.test.mjs` uses 102 output from the same run as 104 input.
- E2E/smoke: parity, deterministic disclosure, and manifest validation; live calibration remains a separately recorded gate.
- Producer gate (102): production request, provider configuration, and disclosure contracts pass. Consumer gate (104): real-output handoff and deterministic evaluation tests pass; missing live evidence remains blocking rather than passed.

## Integration Test Plan

- Integration tests are integration-owned under `tests/integration/`; each handoff must create upstream output and pass that exact object to the consumer without a synthetic replacement.
- End-to-end coverage is integration-owned under `tests/e2e/transfer-assessment-two-attempt.test.mjs` and drives teacher review, both learner attempt paths, reload, replay, and target routing through the integrated application.
- Smoke command and exact test commands will be added after the component quickstarts are promoted; all results, exit codes, paths, and tested SHAs are recorded in `integration-review.md`.

## Integration Ownership

The main integration agent owns reconciliation, the authoritative post-planning DAG, edge work packets, integration glue, `tests/integration/**`, `tests/e2e/**`, coverage manifests, serial merges, and promotion records. The dirty `105-transfer-release` worktree is outside this initiative and remains untouched.

## Current Wave Status

- Historical waves 101-104 are integrated at `c84743b`; component 102 has two later unmerged commits. The 2026-09-26 correction cycle and its owner-routed queue are in `integration-review.md`.
- The current schema-v2 manifest records only three of five declared edges. Its synthetic boundaries and the missing 101->103 and 101->104 handoffs prevent a new green promotion claim. The expanded 103 quickstart gate currently fails one stale test import. No new downstream broadcast is authorized until the reopened gates pass.
- Component 105 remains outside this initiative.
