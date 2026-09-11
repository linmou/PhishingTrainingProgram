# Transfer Assessment Dependency Graph

Intent: control component ownership, contracts, dependencies, integration work, and promotion conditions for completing transfer assessment.

## Baseline

- Target branch: `no_sign_up`
- Immutable baseline commit: `19d729e76922d9e4f4c25dff6d2c4ceb78b00a32`
- Local normative plan: `plan/transfer_assessment_implementation_plan/final_plan.md`
- Original-plan SHA-256: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`
- Numbering mode: sequential
- Graph status: provisional until every component passes planning, analysis, and cross-component reconciliation

## Components

| Prefix | Branch | Worktree | Owner | Responsibility | Public contracts | Shared-file ownership | Exclusions |
|---|---|---|---|---|---|---|---|
| 101 | `101-transfer-domain` | `transfer-domain` | pending stable assignment | W2 deterministic transfer behavior and golden fixtures | `TutorDecisionV3`, `TransferTurnContext`, parser, exact-set grader, renderer, progress reducer | Owns assessment/progress types and pure transfer services | No Supabase, React, provider calls, Promptfoo, or browser release work |
| 102 | `102-transfer-backend` | `transfer-backend` | pending stable assignment | W3-W6 storage, RLS, RPCs, authorization, provider boundary, evidence application, and production prompt | assessment API operations, allowlisted public DTOs, versioned RPC payloads and lifecycle | Owns migrations 025/026, `assessment-api`, transfer API facade, and generated database types | No React room UI, Promptfoo cases, or browser release evidence |
| 103 | `103-transfer-room-ui` | `transfer-room-ui` | pending stable assignment | W7-W8 room lifecycle and teacher/learner UI integration | consumes public assessment DTOs and room/realtime lifecycle; emits no direct progress writes | Owns room context/pages and assessment-facing React components/tests | No SQL/RLS, provider implementation, production prompt, or Promptfoo work |
| 104 | `104-transfer-evaluation` | `transfer-evaluation` | pending stable assignment | W9-W10 frozen semantic contract and Promptfoo evaluation | transfer case schema, rubric IDs, partitions, thresholds, run manifest, quality-gate result | Owns transfer-specific `evals/promptfoo` cases, rubrics, fixtures, holdouts, scripts, and results metadata | No production database, auth, room UI, or release-browser implementation |
| 105 | `105-transfer-release` | `transfer-release` | pending stable assignment | W11 and sections 19-20 browser, privacy, attack, activation, rollback, and final evidence | browser run record, release verdict, flag and rollback evidence | Owns transfer browser tests and release evidence; integration agent owns cross-component coverage manifest | No feature implementation, schema changes, provider prompt changes, or Promptfoo rubric changes |

## Provisional Dependencies

| Edge | Reason | Promotion condition |
|---|---|---|
| `101-transfer-domain -> 102-transfer-backend` | Backend validation and RPC payloads consume the canonical domain contracts. | Domain contracts and golden behavior pass integration checks. |
| `101-transfer-domain -> 104-transfer-evaluation` | Deterministic supporting checks require the canonical parser, grader, reducer, and v3 response contract. | Domain artifacts are promoted and consumable by evaluation tests. |
| `102-transfer-backend -> 103-transfer-room-ui` | Room UI consumes authenticated API operations, public DTOs, and persistence lifecycle. | Backend handoff, authorization, and public/private boundary tests pass. |
| `102-transfer-backend -> 104-transfer-evaluation` | Evaluation must exercise the same production request and prompt path. | Production adapter and prompt are promoted without a synthetic replacement. |
| `102-transfer-backend -> 105-transfer-release` | Release attacks require the real authorization, RLS, transaction, and rollback boundary. | Hosted backend and privacy gates pass. |
| `103-transfer-room-ui -> 105-transfer-release` | Browser acceptance requires the integrated teacher and learner room flows. | Room/UI handoff and browser-facing integration tests pass. |
| `104-transfer-evaluation -> 105-transfer-release` | Release acceptance requires frozen, calibrated, complete semantic evidence. | Promptfoo baseline, candidate, holdout, pair, and quality gates pass. |

## Provisional Waves

1. `101-transfer-domain`
2. `102-transfer-backend`
3. `103-transfer-room-ui` and `104-transfer-evaluation`
4. `105-transfer-release`

## Integration Ownership

The main integration agent exclusively owns this file, `integration-review.md`, merge resolution, edge work packets, cross-component handoff tests, the coverage manifest, serial integration verification, and promotion records.

## Reconciliation

Pending completion and analysis of all component planning packages.

## Edge Work Packets

Pending the post-planning authoritative DAG gate.
