# Transfer Assessment Dependency Graph

Intent: control component ownership, contracts, dependencies, integration work, and promotion conditions for completing transfer assessment.

## Baseline

- Target branch: `no_sign_up`
- Immutable baseline commit: `19d729e76922d9e4f4c25dff6d2c4ceb78b00a32`
- Local normative plan: `plan/transfer_assessment_implementation_plan/final_plan.md`
- Original-plan SHA-256: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`
- Numbering mode: sequential
- Graph status: authoritative; reconciliation passed and the approved provisional topology is unchanged

## Components

| Prefix | Branch | Worktree | Owner | Responsibility | Public contracts | Shared-file ownership | Exclusions |
|---|---|---|---|---|---|---|---|
| 101 | `101-transfer-domain` | `transfer-domain` | Kant (`01a09282-73c4-7323-b6ea-020a96c88368`) | W2 deterministic transfer behavior and golden fixtures | `TutorDecisionV3`, `TransferTurnContext`, parser, exact-set grader, renderer, progress reducer | Owns assessment/progress types and pure transfer services | No Supabase, React, provider calls, Promptfoo, or browser release work |
| 102 | `102-transfer-backend` | `transfer-backend` | Dirac (`01a09282-77d6-7ba2-9450-e9ce6925b4db`) | W3-W6 storage, RLS, RPCs, authorization, provider boundary, evidence application, and production prompt | assessment API operations, allowlisted public DTOs, versioned RPC payloads and lifecycle | Owns migrations 025/026, `assessment-api`, transfer API facade, and generated database types | No React room UI, Promptfoo cases, or browser release evidence |
| 103 | `103-transfer-room-ui` | `transfer-room-ui` | Hypatia (`01a09282-7962-7f82-8728-f02998238c8e`) | W7-W8 room lifecycle and teacher/learner UI integration | consumes public assessment DTOs and room/realtime lifecycle; emits no direct progress writes | Owns room context/pages and assessment-facing React components/tests | No SQL/RLS, provider implementation, production prompt, or Promptfoo work |
| 104 | `104-transfer-evaluation` | `transfer-evaluation` | Franklin (`01a0928f-1970-7533-8ddc-f6f6fd734648`) | W9-W10 frozen semantic contract and Promptfoo evaluation | transfer case schema, rubric IDs, partitions, thresholds, run manifest, quality-gate result | Owns transfer-specific `evals/promptfoo` cases, rubrics, fixtures, holdouts, scripts, and results metadata | No production database, auth, room UI, or release-browser implementation |
| 105 | `105-transfer-release` | `transfer-release` | Aristotle (`01a09282-762c-7193-b898-7aad8ec15483`) | W11 and sections 19-20 browser, privacy, attack, activation, rollback, and final evidence | browser run record, release verdict, flag and rollback evidence | Owns transfer browser tests and release evidence; integration agent owns cross-component coverage manifest | No feature implementation, schema changes, provider prompt changes, or Promptfoo rubric changes |

## Authoritative Dependencies

| Edge | Reason | Promotion condition |
|---|---|---|
| `101-transfer-domain -> 102-transfer-backend` | Backend validation and RPC payloads consume the canonical domain contracts. | Domain contracts and golden behavior pass integration checks. |
| `101-transfer-domain -> 104-transfer-evaluation` | Deterministic supporting checks require the canonical parser, grader, reducer, and v3 response contract. | Domain artifacts are promoted and consumable by evaluation tests. |
| `102-transfer-backend -> 103-transfer-room-ui` | Room UI consumes authenticated API operations, public DTOs, and persistence lifecycle. | Backend handoff, authorization, and public/private boundary tests pass. |
| `102-transfer-backend -> 104-transfer-evaluation` | Evaluation must exercise the same production request and prompt path. | Production adapter and prompt are promoted without a synthetic replacement. |
| `102-transfer-backend -> 105-transfer-release` | Release attacks require the real authorization, RLS, transaction, and rollback boundary. | Hosted backend and privacy gates pass. |
| `103-transfer-room-ui -> 105-transfer-release` | Browser acceptance requires the integrated teacher and learner room flows. | Room/UI handoff and browser-facing integration tests pass. |
| `104-transfer-evaluation -> 105-transfer-release` | Release acceptance requires frozen, calibrated, complete semantic evidence. | Promptfoo baseline, candidate, holdout, pair, and quality gates pass. |

The authoritative graph is identical to allocation packet version 1. It is acyclic, changes no approved scope, owner, contract boundary, or wave, and therefore requires no renewed allocation decision.

## Implementation Waves

1. `101-transfer-domain`
2. `102-transfer-backend`
3. `103-transfer-room-ui` and `104-transfer-evaluation`
4. `105-transfer-release`

## Wave And Edge Status

| Wave | Component | Status | Evidence |
|---|---|---|---|
| 1 | `101-transfer-domain` | integration-green for its own scope; merged at `c2224c7`/`7ecfce5`/`3d39bd6` | E01 `6/6` pass on integration; regression `29 failed / 128 failed tests` identical to `pre_red` baseline with passing tests `578 -> 719`; promotion restricted as recorded in `integration-review.md` |
| 2 | `102-transfer-backend` | open; hosted schema/privilege lane evidenced, behavioural lane pending; branch not yet merged | Migrations 025/027/028 applied on hosted by the owner; RLS fix applied. T009 PART 1 `13/15` pass on hosted with the two failures naming exactly the functions migration 029 fixes (`integration-review.md`, 2026-09-12). RPC signatures `8 of 8` matched; all private transfer tables `rls=true` with no API-role access; all eight transfer RPCs service_role-only. Migration 029 authored at `e690d55` and unapplied; T009 PART 2 (P1-P19) and the Edge Function deploy require service_role. |
| 3 | `103-transfer-room-ui`, `104-transfer-evaluation` | closed | incoming edges `102 -> 103` and `102 -> 104` unsatisfied |
| 4 | `105-transfer-release` | closed | incoming edges from 102, 103, and 104 unsatisfied |

`integration_coverage_passed` and `integration_passed` remain unsubmitted: the coverage manifest needs both a new passed `tests/integration/` test and the new passed `tests/e2e/transfer-assessment.test.js` aggregate, and the aggregate belongs to the release edge that component 105 owns. Component 101's downstream consumers now exist as branches (`102-transfer-backend` at `488de3e`, `104-transfer-evaluation`), so the earlier statement that neither exists is superseded; 102 is not yet merged, so no promotion SHA has been written to it.

## Integration Ownership

The main integration agent exclusively owns this file, `integration-review.md`, merge resolution, edge work packets, cross-component handoff tests, the coverage manifest, serial integration verification, and promotion records.

## Reconciliation

Passed after component-local remediation. No material product decision remains unresolved.

| ID | Conflict | Canonical resolution | Owner | Disposition |
|---|---|---|---|---|
| R01 | Component 101 required Guard instruction `guard`, while the canonical response contract also permits a real teaching instruction. | Guard accepts `guard` or a real teaching instruction, with null target and assessment. | 101 | Corrected at `d64b4bed13f57c3fb03442b9d6c757f868d17129`; reanalysis has zero CRITICAL/HIGH. |
| R02 | Component 102 prescribed Supabase Auth/bearer identity although the application has simplified local identity and the source forbids inventing auth. | Inject `AssessmentPrincipalVerifier`; production supplies a deployment-trusted adapter, tests inject a verifier, and a missing adapter fails closed with `AUTHORIZATION_NOT_CONFIGURED`. Supabase Auth and `auth.uid()` are not the application identity contract. | 102 | Corrected at `40f10775b9d6e1d1454b7c703ce5b1613cb7e13a`; reanalysis is clean. |
| R03 | Product and evaluation planned independent transfer request construction. | 102 owns versioned v3 context/request builders in `ecologicalTutorCall.ts`; 104 consumes them through a thin adapter and records prompt/builder hashes and the 1,200-token setting. | 102/104 | Corrected at `40f10775` and `faf46fe4f4fa69210d62db3f0a48a0fe3f64b09a`; both reanalyzed clean. |
| R04 | Reject/regenerate UI behavior had no backend operation contract. | Add idempotent `reject_draft` and `regenerate_draft` API operations plus service-role-only atomic RPCs, same-trigger suppression, stale/race handling, and no delivery/progress side effect. | 102 | Corrected at `40f10775`; consumed by 103 and 105. |
| R05 | Private draft DTO names differed. | `TeacherAssessmentDraftDTO` is the sole browser-facing private DTO; storage row names remain internal. | 102/103 | Corrected at `40f10775` and `4003510ef446d2fc3cd0eacdb87246126087743e`. |
| R06 | Components 101 and 103 planned edits to the 102-owned service facade. | 101 owns pure domain types/logic; 102 alone owns `transferAssessmentService.ts`, API DTOs, and service tests; 103 consumes typed exports through its UI adapter. | 101/103 | Corrected at `d64b4bed` and `4003510e`; no facade edit remains outside 102. |
| R07 | Release rows used a six-value status contract but later admitted `pending` and `partial`. | Release status remains closed; present upstream pending/partial maps to `blocked`, absent evidence to `missing`, with the source status retained as metadata. | 105 | Corrected at `04ccdad`; reanalysis has zero CRITICAL/HIGH. |
| R08 | Component 103 placed React-only state in the 101-owned shared type barrel. | Shared assessment/progress exports stay with 101; 103 keeps view state in `transferAssessmentUiAdapter.ts` and imports upstream types unchanged. | 103 | Corrected at `d8628cc30fd8005c00cfde2caec986155aa5bc55`; reanalysis has zero CRITICAL/HIGH. |

Shared-file ownership after reconciliation:

- 101: `src/types/assessment.ts`, `src/types/learningProgress.ts`, pure parser/grader/renderer/validator/reducer/orchestrator, and golden fixtures.
- 102: migrations 025/026, hosted SQL suite, `assessment-api`, `ecologicalTutorCall.ts` v3 exports, `transferAssessmentService.ts`, generated database types, and service/backend contract tests.
- 103: room context/pages/components, `transferAssessmentUiAdapter.ts`, role-scoped export builder, and React tests; it consumes 101/102 exports unchanged.
- 104: transfer cases, rubrics, thin evaluation adapter, deterministic evaluation checks, manifests, gates, and immutable AI evidence.
- 105: release runner, attack inventory, browser/privacy/rollback tests, and immutable release evidence.
- Integration owner: orchestration records, cross-component handoff tests, E2E aggregation, and coverage manifest.

## Edge Work Packets

### E01: 101 -> 102 Domain Decision To Persistence

- Producer/output: validated `TutorDecisionV3`, deterministic answer disposition, and progress transition from 101 pure functions.
- Consumer/input: 102 draft validation, API DTO projection, and atomic RPC event/delivery inputs.
- Invariants: identical mode matrix and progress table; known IDs retained; no private field enters learner output; no persistence occurs for rejected/undelivered/stale results.
- Glue: 102 maps the 101 types without redefining them; no integration adapter is expected.
- Handoff test: `tests/integration/transfer-domain-backend.test.js` invokes the real 101 validator/orchestrator and passes that same result to the 102 API/persistence test harness.
- E2E/smoke: correct, wrong, undelivered, assisted, stale, and Guard-deferred flows; focused W2 plus backend contract suites.
- Promotion: 101 local and integration suites pass, its real output is consumed without replacement, and the integrated SHA is promoted to 102.

### E02: 101 -> 104 Domain Contract To Evaluation

- Producer/output: 101 golden cases, parser/grader/reducer outcomes, and v3 validation categories.
- Consumer/input: 104 `t09_contract_and_progress` and `assessment_followup` checks.
- Invariants: evaluator expectations use the same contract versions/categories and never substitute semantic judging for deterministic behavior.
- Glue: 104 imports or executes the promoted domain contract through a thin test bridge; it does not copy reducer/parser logic.
- Handoff test: `tests/integration/transfer-domain-evaluation.test.js` produces results with 101 logic and passes those same records into 104 checks.
- E2E/smoke: manifest validation and deterministic gate fixtures; no live model required for handoff acceptance.
- Promotion: domain handoff test passes on integration and 104 receives the recorded 101 promotion SHA.

### E03: 102 -> 103 Backend DTO To Room UI

- Producer/output: typed envelopes, `TeacherAssessmentDraftDTO`, `PublicAssessmentDTO`, persisted message identity, and reject/regenerate/send/process lifecycle results.
- Consumer/input: 103 UI adapter and room state.
- Invariants: fail-closed DTO validation; learner projection excludes private data; `assessment_id` and real parent ID survive; retries merge by persisted identity; assessment remains a tutor turn.
- Glue: 103 UI adapter narrows backend exports into view state without remapping operations or grading.
- Handoff test: `tests/integration/transfer-backend-room-ui.test.js` obtains real 102 facade results and passes those same envelopes through the 103 adapter/state consumer.
- E2E/smoke: teacher review/edit/reconfirm/reject/regenerate/send and learner answer/reconnect paths; UI focused suite and build.
- Promotion: hosted-independent facade handoff passes, backend security lanes are recorded, and the promoted 102 integration SHA is merged into 103.

### E04: 102 -> 104 Production Request To Evaluation

- Producer/output: `TransferTutorRequestV3` builders, contract identity, production prompt reference/hash, and effective 1,200-token target setting.
- Consumer/input: 104 thin transfer adapter, immutable manifest, and runner.
- Invariants: byte-equivalent canonical target message/context for equal inputs; no evaluator labels, copied prompt, alternate budget, endpoint, or credential enters the adapter.
- Glue: 104 projection supplies target-visible fields to the 102 builder; integration records normalized parity.
- Handoff test: `tests/integration/transfer-backend-evaluation.test.js` builds one request through the production export and passes that same request to the evaluation adapter and manifest recorder.
- E2E/smoke: parity test, baseline/candidate/holdout execution, raw evidence, and quality gate.
- Promotion: shared-builder parity passes and 104 receives the recorded 102 promotion SHA; live evaluation remains blocked if model/judge configuration is absent.

### E05: 102 -> 105 Backend Boundary To Release

- Producer/output: migrated schema evidence, verifier/capability result, authorization attacks, immutable key/privacy results, RPC transaction evidence, and rollback-safe feature flag behavior.
- Consumer/input: 105 release snapshot, attack/privacy records, activation and rollback verdicts.
- Invariants: source outcomes are retained; absent verifier keeps capability disabled; no mock or legacy run closes hosted/security gates; rollback preserves data.
- Glue: release runner validates and hashes upstream evidence links without rewriting them.
- Handoff test: `tests/integration/transfer-backend-release.test.js` emits a real 102 gate record and passes that exact record to 105 normalization/verdict logic.
- E2E/smoke: direct attacks, privacy inspection, capability disabled path, and rollback rehearsal.
- Promotion: all required 102 hosted/security evidence passes; any blocked lane prevents promotion and keeps 105 closed.

### E06: 103 -> 105 Room UI To Release

- Producer/output: integrated teacher/learner UI with stable persisted identities and role-scoped projections.
- Consumer/input: dedicated transfer browser runner and evidence capture.
- Invariants: the runner drives real UI controls in independent browser contexts; no private field leakage; no phantom/duplicate effects; legacy seven-room evidence is supplemental only.
- Glue: 105 selectors/configuration use stable accessible UI contracts; product behavior is not reconstructed through direct API calls.
- Handoff test: `tests/integration/transfer-room-ui-release.test.js` launches the integrated UI fixture and passes its observed state/evidence references into 105 scenario recording.
- E2E/smoke: `tests/e2e/transfer-assessment.test.js` covers normal, recovery, Guard, stale, retry, reconnect, and duplicate flows.
- Promotion: UI integration and browser smoke pass, then the recorded 103 promotion SHA is merged into 105.

### E07: 104 -> 105 Evaluation Verdict To Release

- Producer/output: immutable Promptfoo manifest, raw case evidence, calibration, baseline/candidate/holdout results, and quality-gate verdict.
- Consumer/input: 105 upstream AI gate row and final verdict.
- Invariants: hashes/run IDs match; incomplete/failed stays blocking; a Promptfoo pass cannot satisfy product/security/browser gates.
- Glue: 105 validates references and normalizes source status without recomputing AI scores.
- Handoff test: `tests/integration/transfer-evaluation-release.test.js` creates a real 104 gate verdict from fixture evidence and passes that same artifact to 105 verdict logic.
- E2E/smoke: final release aggregation links the live AI run and dedicated browser bundle.
- Promotion: 104 deterministic and live quality gates pass with immutable evidence, then the recorded 104 promotion SHA is merged into 105.

## Integration Test Plan

- Integration command: `node --test tests/integration/*.test.js`; every edge test must create or invoke the producer output and pass that same object/file/reference to the consumer in the same run.
- E2E command: `node --test tests/e2e/transfer-assessment.test.js`; it orchestrates the dedicated release runner against the integrated application and isolated hosted target.
- Component commands remain those recorded in each `quickstart.md`; integration reruns the affected component suites after each serial merge.
- `tests/integration/` and `tests/e2e/` are integration-owned paths. Wrappers may invoke repository-native Jest/Node/browser commands, but cannot replace a boundary artifact with a hand-authored fixture.
- The coverage manifest will be written only after these new tests execute successfully on one recorded integration SHA and will list all seven edge IDs.
