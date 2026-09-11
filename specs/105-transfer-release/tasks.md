---
description: "Release-planning task list for dedicated transfer browser, privacy, attack, activation, rollback, and final evidence"
---

# Tasks: Transfer Assessment Browser Release and Rollback Evidence

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/transfer-release-evidence.md](contracts/transfer-release-evidence.md), [quickstart.md](quickstart.md)
**Scope**: W11 plus original handoff sections 19-20. Planning only in this component; no tasks here modify production implementation, schema, provider prompts, Promptfoo rubrics, the integration worktree, or `coverage_manifest.json`.

## Phase 1: Setup

**Purpose**: Establish the non-secret release command, configuration boundary, and evidence directory without enabling the capability.

- [ ] T001 Add the non-secret release configuration example, required field documentation, redaction rules, and an ignore rule for the local secret-bearing copy in `tutor-system/scripts/transfer-assessment-release.config.example.json` and `tutor-system/.gitignore`.
- [ ] T002 Register the dedicated `eval:transfer:release` command in `tutor-system/package.json`, preserving existing evaluation commands and leaving `TRANSFER_ASSESSMENT_ENABLED` disabled by default.
- [ ] T003 Add evidence storage, retention, and immutability guidance in `evals/transfer-assessment/release/README.md`.

## Phase 2: Foundational

**Purpose**: Freeze the scenario/attack inventory and create the shared run/evidence primitives required by every user story.

**Checkpoint**: The runner can validate configuration, create a unique run directory, capture a redacted snapshot, and preserve non-pass results before any product flow runs.

- [ ] T004 Define the stable W11 scenario IDs and the forged-identity, cross-learner, cross-room, stale-question, direct-write, and legacy-RPC attack cases in `tutor-system/scripts/transfer-assessment-release-attack-matrix.json`.
- [ ] T005 [P] Add contract tests, beginning with a file-purpose comment, for status validation, required artifact names, immutable exclusive writes, redaction, and missing-result blocking in `tutor-system/scripts/transfer-assessment-release.test.js`.
- [ ] T006 Implement the release runner entry point with a shebang and purpose comment in `tutor-system/scripts/transfer-assessment-release.js`; validate configuration, record start commit/dirty-tree/configuration hashes, resolve the isolated target, and preserve `pass`, `fail`, `blocked`, `missing`, `error`, and `not_applicable` results.
- [ ] T007 Implement the shared evidence helpers in `tutor-system/scripts/transfer-assessment-release.js` for exclusive artifact writes, SHA-256 links, screenshot/network/console/storage/export registration, redacted errors, and final exit status.
- [ ] T008 Add the runner `--verify <run-id>` mode in `tutor-system/scripts/transfer-assessment-release.js` to validate the public evidence contract and recompute artifact hashes without modifying the bundle.

## Phase 3: User Story 1 - Prove the learner and teacher transfer workflow (Priority: P1)

**Goal**: Reproduce the complete transfer product flow, including normal lifecycle, recovery, race, reconnect, and duplicate-operation behavior.

**Independent Test**: Execute the dedicated browser command against an isolated migrated target with verified teacher and learner principals. The run creates a complete per-scenario record and exits non-zero for any required failure, missing evidence, or unrun scenario.

### Tests for User Story 1

- [ ] T009 [US1] Add browser-flow assertions, beginning with a file-purpose comment, for new learner-owned checklist creation, unchanged legacy data, bare contextual acknowledgment, one structured draft, teacher review/edit/reconfirm/send, four-option rendering, and tutoring-mode continuity in `tutor-system/scripts/transfer-assessment-release.test.js`.
- [ ] T010 [US1] Add browser-flow assertions, beginning with a file-purpose comment, for exact correct-label resolution, reload persistence, tutoring feedback, wrong-answer needs-review, repair, new learner evidence, new context, and later pass in `tutor-system/scripts/transfer-assessment-release.test.js`.
- [ ] T011 [US1] Add browser-flow assertions, beginning with a file-purpose comment, for Guard deferral/recovery, rejection/regeneration, dirty/stale drafts, reconnect/catch-up, commit timeout/retry, duplicate teacher tabs, and duplicate answers in `tutor-system/scripts/transfer-assessment-release.test.js`.

### Implementation for User Story 1

- [ ] T012 [US1] Implement isolated teacher and learner browser contexts, verified-principal setup, fresh room/checklist setup, and legacy-data comparison in `tutor-system/scripts/transfer-assessment-release.js`.
- [ ] T013 [US1] Implement the correct and wrong lifecycle scenarios with explicit waits for delivery/realtime catch-up and per-step screenshots in `tutor-system/scripts/transfer-assessment-release.js`.
- [ ] T014 [US1] Implement repair/new-evidence/new-context, Guard deferral/recovery, and rejection/regeneration scenarios while recording the existing progress and feedback contracts in `tutor-system/scripts/transfer-assessment-release.js`.
- [ ] T015 [US1] Implement dirty/stale draft, reconnect/catch-up, timeout/retry, duplicate-tab, and duplicate-answer scenarios with protected-state and history comparisons in `tutor-system/scripts/transfer-assessment-release.js`.
- [ ] T016 [US1] Write scenario records and screenshots, console/network/realtime evidence, and per-scenario statuses to `evals/transfer-assessment/release/<run-id>/` without exposing private fields to learner-scoped artifacts.

**Checkpoint**: The dedicated run proves the normal and edge product flows, preserves all actual outcomes, and remains separate from the seven-room legacy browser run.

## Phase 4: User Story 2 - Prove privacy and resistance to release-boundary attacks (Priority: P1)

**Goal**: Prove that private assessment data stays server-side and unauthorized or stale operations cannot mutate protected state.

**Independent Test**: Run the privacy inspection and attack matrix against the same isolated run environment and verify `privacy.json` and `attacks.json` contain complete, redacted, immutable results with unchanged protected-state hashes for mutation attempts.

### Tests for User Story 2

- [ ] T017 [US2] Add privacy assertions, beginning with a file-purpose comment, for learner network requests, realtime payloads, exports, browser storage, and visible/captured errors in `tutor-system/scripts/transfer-assessment-release.test.js`.
- [ ] T018 [US2] Add attack assertions, beginning with a file-purpose comment, for forged identity, cross-learner, cross-room, stale-question, direct-write, and legacy-RPC rejection plus unchanged protected state in `tutor-system/scripts/transfer-assessment-release.test.js`.
- [ ] T019 [US2] Add redaction regression assertions, beginning with a file-purpose comment, for answer keys, transfer basis, private rationale, raw model output, credentials, and internal-error leakage in `tutor-system/scripts/transfer-assessment-release.test.js`.

### Implementation for User Story 2

- [ ] T020 [US2] Implement learner-scoped network, realtime, export, storage, and error capture with secret/private-field redaction and evidence hashes in `tutor-system/scripts/transfer-assessment-release.js`.
- [ ] T021 [US2] Implement supported direct-request attack attempts from `tutor-system/scripts/transfer-assessment-release.js`, using the attack inventory in `tutor-system/scripts/transfer-assessment-release-attack-matrix.json` and recording expected versus observed denial.
- [ ] T022 [US2] Implement protected-state before/after comparisons and `attacks.json` writing in `tutor-system/scripts/transfer-assessment-release.js`; fail the case when an unauthorized operation changes state or creates history.
- [ ] T023 [US2] Implement `privacy.json` writing and release blocking for any private key, transfer basis, raw model output, rationale, credential, or error leakage in `tutor-system/scripts/transfer-assessment-release.js`.

**Checkpoint**: Privacy and attack evidence demonstrates the real server boundary and contains no client-only authorization claim or secret-bearing learner artifact.

## Phase 5: User Story 3 - Authorize activation, rollback, and final release closeout (Priority: P1)

**Goal**: Produce a complete release verdict and prove reversible feature-flag behavior without destroying assessment evidence or changing legacy semantics.

**Independent Test**: Reconcile upstream gate links, browser/privacy/attack records, exact configuration, linked AI run IDs, activation state, and rollback before/after hashes into one report; the verifier can reproduce the verdict from the recorded commands and links.

### Tests for User Story 3

- [ ] T024 [US3] Add activation/rollback assertions, beginning with a file-purpose comment, for disabled-by-default state, blocked activation on any non-pass gate, authorized backend enablement metadata, and non-destructive rollback in `tutor-system/scripts/transfer-assessment-release.test.js`.
- [ ] T025 [US3] Add final-report assertions, beginning with a file-purpose comment, for starting/ending commits, migration/auth/key status references, command exit statuses, linked AI/browser run IDs, feature flag, rollback path, and remaining gaps in `tutor-system/scripts/transfer-assessment-release.test.js`.

### Implementation for User Story 3

- [ ] T026 [US3] Implement upstream evidence-link validation and separate product, privacy, attack, activation, rollback, and legacy-regression gate reconciliation in `tutor-system/scripts/transfer-assessment-release.js`.
- [ ] T027 [US3] Implement `activation.json` generation and backend capability eligibility checks in `tutor-system/scripts/transfer-assessment-release.js`; do not enable the flag as an incidental runner side effect.
- [ ] T028 [US3] Implement `rollback.json` rehearsal evidence in `tutor-system/scripts/transfer-assessment-release.js`, including already-delivered question handling, capability disablement, assessment/history/evidence hashes, and unchanged legacy semantics.
- [ ] T029 [US3] Implement `report.json` and `verdict.json` generation in `tutor-system/scripts/transfer-assessment-release.js` with explicit blockers, missing stages, linked AI run IDs, exact commands, statuses, and evidence paths.
- [ ] T030 [US3] Add the release documentation update record for the final browser, privacy, attack, activation, and rollback contract in `tutor-system/claude_docs/doc_update_record/documentation_update_record_v2026_09_11_transfer_release.md` after implementation evidence exists.

**Checkpoint**: The final report is reproducible, activation is authorized only after all gates pass, and rollback preserves data, evidence, history, and legacy semantics.

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Validate the complete component package and prepare integration handoff without changing integration-owned status artifacts.

- [ ] T031 [P] Reconcile the runner, configuration example, attack matrix, evidence README, public contract, and quickstart paths in `specs/105-transfer-release/contracts/transfer-release-evidence.md` and `evals/transfer-assessment/release/README.md`.
- [ ] T032 Run the exact verification sequence in `specs/105-transfer-release/quickstart.md`, preserve the generated run bundle, and record command exit statuses and missing prerequisites in the final report.
- [ ] T033 Provide the integration owner with the component evidence links and the deferred root-context update note; do not edit `plan/transfer_assessment_implementation_plan/milestone_ledger.md`, `coverage_manifest.json`, `AGENTS.md`, or the integration worktree from this component.

## Requirement and Success-Criteria Traceability

Every functional requirement and buildable success criterion has at least one task. Post-launch outcome claims are not used as substitute tasks.

| Requirement or criterion | Tasks |
|---|---|
| FR-001 | T006, T012 |
| FR-002 | T004, T013-T015 |
| FR-003 | T009, T013 |
| FR-004 | T010, T015 |
| FR-005 | T017, T020, T023 |
| FR-006 | T018, T021-T022 |
| FR-007 | T026, T033 |
| FR-008 | T005, T007, T016, T022, T029 |
| FR-009 | T025, T029-T030 |
| FR-010 | T002, T027 |
| FR-011 | T026-T027, T029 |
| FR-012 | T024, T028 |
| FR-013 | T006, T008, T029, T032 |
| FR-014 | T031, T033 |
| SC-001 | T004, T006, T016 |
| SC-002 | T009-T016 |
| SC-003 | T017-T023 |
| SC-004 | T018-T022 |
| SC-005 | T025, T029 |
| SC-006 | T024, T027 |
| SC-007 | T024, T028 |
| SC-008 | T008, T029, T032-T033 |

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no implementation dependency; establishes the command/config/output boundary.
- **Foundational (Phase 2)**: depends on Setup and blocks all user stories because every scenario uses the same immutable run/evidence primitives.
- **User Story 1 (Phase 3)**: depends on Foundational and produces the browser product evidence consumed by the final verdict.
- **User Story 2 (Phase 4)**: depends on Foundational and the isolated target; it may run beside US1 once the target is prepared, but its records must use the same run snapshot when combined.
- **User Story 3 (Phase 5)**: depends on completed US1 and US2 plus linked upstream gate results; activation and rollback are last-mile release actions.
- **Polish (Phase 6)**: depends on all user stories and preserves the component/integration ownership boundary.

### User Story Dependencies

- **US1 (P1)**: requires the foundational runner and verified isolated environment.
- **US2 (P1)**: requires the same foundational runner and server target; it is independent of the learner-flow assertions but shares the run snapshot.
- **US3 (P1)**: requires US1 and US2 results and upstream 102/103/104 evidence; it cannot be completed from Promptfoo or legacy browser evidence alone.

### Parallel Opportunities

- T005 and T004 can be prepared in parallel because they touch separate foundational files.
- T009-T011 can be authored in parallel as separate scenario assertion groups before runner implementation.
- T017-T019 can be authored in parallel as separate privacy/attack assertion groups.
- T024-T025 can be authored in parallel as separate activation/report assertion groups.
- US1 and US2 execution can run in separate isolated contexts after foundational setup, then be reconciled into one release bundle only when their environment/configuration snapshots match.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1 normal correct/wrong flow with immutable evidence.
3. Stop and validate the dedicated browser runner independently; this is the smallest useful product evidence slice but is not release approval.

### Incremental Delivery

1. Add US1 recovery, Guard, draft, reconnect, retry, duplicate, and legacy-preservation scenarios.
2. Add US2 privacy inspection and attack matrix; keep any failure visible and activation disabled.
3. Add US3 gate reconciliation, final report, activation eligibility, and rollback rehearsal.
4. Run the complete quickstart and hand evidence to the integration owner for ledger reconciliation.

### Release Rule

No task in this component enables `TRANSFER_ASSESSMENT_ENABLED`. The capability may be enabled only after the integration owner confirms all upstream and component gates with immutable evidence. Any missing credential, environment, provider, browser, or verifier prerequisite becomes a named blocker.
