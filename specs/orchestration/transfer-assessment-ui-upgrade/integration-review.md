Intent: Preserve the chronological decisions, Git provenance, verification evidence, failures, and promotion history for the transfer-assessment UI upgrade.

# Transfer Assessment UI Upgrade Integration Review

## 2026-09-22 - Preflight And Allocation

- User request: clarify and implement the upgraded transfer-room UI with dependencies on other component branches.
- Initial blocker: uncommitted `specs/103-transfer-room-ui/spec.md` and an untracked assessment report.
- User resolved the blocker by committing the UI spec as `94f0dce2f950ba2fde2e9be16c3816f61c071009` and moving the assessment report outside the worktree.
- Approved target baseline: `research/lean-transfer@d6e1a589893e72862955404c277f5eb65b6edc4f`.
- Human allocation decision: packet V2 approved explicitly with server-authoritative attempts across reloads and tabs.
- Product decision: local UI state may display attempts, but persisted backend state decides remaining attempts, terminal failure, progress transitions, and correct-answer disclosure.
- Allocation transition validation: `initial -> preflight -> decomposing -> allocation_review -> allocating` accepted by `validate_orchestration_state.py`.
- Integration branch/worktree created from the immutable baseline: `integration/transfer-assessment-ui-upgrade` at `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/transfer-assessment-ui-upgrade/integration`.
- `101-transfer-domain`, `102-transfer-backend`, and `104-transfer-evaluation` fast-forwarded from `732dbcdeb54796593d2e50e8e38d46258952ffa8` to the baseline.
- `103-transfer-room-ui` preserved `94f0dce` and merged the baseline as `81e404c2e416b022caf3d6ff46e24f045e361d96`.
- Existing `105-transfer-release` untracked files were not changed.
- Allocation control commit: `8a8da66`.
- Planning owners activated for `specify -> clarify -> plan -> tasks -> analyze`: `/root/owner_101_domain`, `/root/owner_102_backend`, `/root/owner_103_ui`, and `/root/owner_104_evaluation`.

## Planning Status

| Component | Owner | Artifacts | Analysis | Commit |
|---|---|---|---|---|
| 101 | `/root/owner_101_domain` | Complete | PASS; 0 CRITICAL/HIGH | `ccdf695` |
| 102 | `/root/owner_102_backend` | Complete; package restored | PASS; 0 CRITICAL/HIGH | `a43c143` |
| 103 | `/root/owner_103_ui` | Complete | PASS; 0 CRITICAL/HIGH | `f114362` |
| 104 | `/root/owner_104_evaluation` | Complete | PASS; 0 CRITICAL/HIGH | `c796576` |

## Clarification Batch 1

- Status: answered 2026-09-22.
- Affected components: 102, 104, and integration/release configuration evidence.
- Question: choose the authoritative target-generation model and evaluation-judge model/provider configuration.
- Evidence: `tutor-system/.env.example` defines `REACT_APP_OAI_API_KEY` and `REACT_APP_OAI_BASE_URL` but no model. The current browser call silently defaults to `qwen3.5-flash`; checked-in evaluation settings are historical and cannot establish the upgraded run's authority.
- Constraint: implementation must use required configuration with no runtime model fallback. A missing value fails closed; pattern matching cannot replace the LLM call or judge.
- Canonical answer: Option A. Target generation and evaluation judging use `qwen3.5-flash` through the existing DashScope-compatible provider. The server-side target model and evaluation judge model must be explicit required configuration values, not browser defaults.

## Reconciliation

All component planning packages passed their local artifact gates. Reconciliation passed after the following component-local corrections:

| ID | Conflict | Canonical resolution | Owner | Corrective commit |
|---|---|---|---|---|
| R01 | 101 described pass and failure terminal feedback alike while the approved learner behavior discloses feedback only after the second incorrect attempt. | Passed domain feedback remains private/server-only with `learner_feedback_authorized: false`; only failed second attempts authorize learner key/explanation projection. | 101 | `ccdf695` |
| R02 | 102 excluded learner target routing metadata while 103 required it to select which participant receives controls. | `PublicAssessmentDTO` is `{ id, student_id, selection_type, stem, options }`; `student_id` is immutable routing metadata, never authorization. | 102 | `a43c143` |
| R03 | 103 proposed renamed DTO fields and retained `rendered_text`, conflicting with the 102-owned facade and exact-once option rendering. | 103 consumes the exact 102 `ProcessedMessageDTO`; public assessment excludes `rendered_text`; adapter-local names exist only after mapping. | 103 | `f114362` |
| R04 | 104 did not pin the exact reconciled DTO fields and initially referred to browser-prefixed provider authority. | 104 pins the exact 102 DTO and server-only `OAI_API_KEY`, `OAI_BASE_URL`, `OAI_MODEL=qwen3.5-flash` configuration. | 104 | `c796576` |

All reanalyzed packages report zero CRITICAL/HIGH findings and clean worktrees. The authoritative DAG and five edge work packets are recorded in `dependency-graph.md`; implementation is now dependency-ready for 101 only.

## Integration And Promotion

### Wave 1 - 101 Transfer Domain

- Activation: `start_implementation_wave` validated from `implementation_ready` to `implementing`.
- Owner: `/root/owner_101_domain`.
- Preconditions: planning commit `ccdf695`, clean worktree, reconciliation passed, and E01 packet defined.
- Required workflow: `speckit-implement` with the repository-required `fast-multi-agent-tdd` controller before permanent test or production edits.
- Promotion condition: local TDD evidence and component verification, followed by an integration merge, real E01 handoff test, affected regression/integration/E2E/smoke commands, and a machine-validated coverage manifest.
