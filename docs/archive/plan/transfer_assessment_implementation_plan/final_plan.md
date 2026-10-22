# Transfer Assessment Implementation Plan

## Intent

This is the navigable index for the decomposed transfer-assessment implementation package. It preserves the original handoff as the comparison baseline and converts its work packages into one traceable execution sequence.

## Source and status

- Original handoff: [`../transfer_assessment_implementation_plan.md`](../transfer_assessment_implementation_plan.md)
- Source comparison: [`source_baseline.md`](source_baseline.md)
- Source SHA-256: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`
- Current status: implementation is partial; W10 Promptfoo and W11 transfer browser/release evidence are still open.
- Activation status: the ordinary G8 path is incomplete; the owner has separately authorized the version named in `milestone_ledger.md` with open gates. The Edge Function defaults the flag to `true`.

## Backbone and selection

Backbone: [`candidates/plan_1.md`](candidates/plan_1.md), selected unanimously by five judges with rank-position sum 5. The original handoff remains normative; its traceability graph is the requirement-mapping authority and its single milestone ledger is the execution-status authority.

Accepted compatible contributions:

- [`candidates/plan_2.md`](candidates/plan_2.md): use complete learner-visible vertical slices as execution views within the single ledger.
- [`candidates/plan_3.md`](candidates/plan_3.md): add a frozen semantic evaluation contract before prompt/runtime edits, then run calibrated judges, comparable baselines, and independent holdouts after the audited runtime is ready.
- [`candidates/plan_4.md`](candidates/plan_4.md): add security and persistence invariants before client exposure.

Rejected constraints: no competing status ledgers, no live-evaluation prerequisite for unrelated deterministic work, no untraceable new product requirements, and no substitution of legacy browser evidence for transfer release evidence.

| Imported source | Insertion point | Compatibility rule |
|---|---|---|
| `candidates/plan_2.md` | W5-W8 runtime work and W11 browser scenarios | Slices are execution views only; completion status remains in `milestone_ledger.md`. |
| `candidates/plan_3.md` | W0-W2 contract freeze, then W9-W10 live evaluation | Metrics and holdouts must trace to the original §15 contract; they do not replace database, authorization, or browser gates. |
| `candidates/plan_4.md` | W3-W4 schema/authorization and W7/W11 privacy checks | Each invariant must map to the original §§8-12 requirements; it cannot introduce a new product state or auth product. |

## Package map

| File | Responsibility |
|---|---|
| [`request.md`](request.md) | Scope, constraints, acceptance, assumptions |
| [`traceability_graph.md`](traceability_graph.md) | U01-U15, D01-D16, cross-cutting requirement ownership |
| [`milestone_ledger.md`](milestone_ledger.md) | Single checkbox/status authority for W0-W11 and release |
| [`verification_gates.md`](verification_gates.md) | Pass/partial/blocked criteria and non-substitution rules |
| [`work_packages/01_requirements_and_traceability.md`](work_packages/01_requirements_and_traceability.md) | W0 specification and applicability |
| [`work_packages/02_plan_and_audit.md`](work_packages/02_plan_and_audit.md) | Package integrity and intent-drift audit |
| [`work_packages/03_transfer_runtime.md`](work_packages/03_transfer_runtime.md) | W1/W2/W5-W8 runtime and UI integration |
| [`work_packages/04_persistence_and_schema.md`](work_packages/04_persistence_and_schema.md) | W3 migration, transactions, RLS, compatibility |
| [`work_packages/05_authorization_and_provider.md`](work_packages/05_authorization_and_provider.md) | W4/W6 trusted principal and secret boundary |
| [`work_packages/06_evaluation.md`](work_packages/06_evaluation.md) | W9/W10 prompt and Promptfoo evidence |
| [`work_packages/07_browser_and_release.md`](work_packages/07_browser_and_release.md) | W11 product verification, activation, rollback |

## Ordered execution

1. **Plan integrity:** retain the source baseline, complete the package, and pass the artifact/diversity/judge gates.
2. **Intent audit:** run the three-reviewer audit against this draft. Correct only evidenced drift, then re-audit disputed criteria. Publish this index only after blocking criteria pass.
3. **W0-W2 and evaluation freeze:** complete T09/spec applicability, v3 schema/golden fixtures, pure runtime tests, and the transfer evaluation contract (cases, rubrics, metrics, thresholds, and manifest) before prompt/runtime edits. This is contract preparation, not live acceptance.
4. **W3-W4:** verify hosted migration state and implement/verify database, RLS, private key, trusted principal, idempotency, and authorization boundaries. Keep the capability disabled.
5. **W5-W8:** complete evidence ingestion, atomic progress transitions, v3 production request path, room integration, and structured teacher/learner UI. Use the vertical slices in the runtime work package; link every result to the single ledger.
6. **W9-W10:** update canonical prompts/adapters, calibrate semantic judges, run transfer Promptfoo baselines/candidates/holdouts, and register the blocking quality gates. Live evaluation cannot replace product checks.
7. **W11:** run the dedicated transfer browser flow and all privacy, authorization, stale, retry, reconnect, race, and rollback scenarios. Preserve run evidence.
8. **§19 closeout:** reconcile every milestone, command, result, migration/auth status, feature flag, rollback path, and remaining blocker. The ordinary automated approval requires all release gates to pass; the version-scoped owner exception is recorded separately in the ledger.

## Risk controls

- The original file and hash prevent silent intent drift.
- One ledger prevents contradictory completion claims.
- Server authority prevents client-side identity, key, and progress bypasses.
- Explicit evidence lanes prevent unit, legacy-browser, Promptfoo, and release results from being conflated.
- Missing credentials, verifier, hosted environment, or user decisions block the affected milestone; no fallback is silently invented.
- Rollback disables new assessment generation/delivery and preserves evidence; it does not drop tables or erase history.

## Traceability and validation

| Requirement | Plan location | Required evidence |
|---|---|---|
| Preserve original intent | `source_baseline.md`, `traceability_graph.md` | unchanged hash and audit |
| W0-W11 ownership | `milestone_ledger.md`, work-package files | checkbox plus command/artifact |
| Pure state/parser/grader behavior | `03_transfer_runtime.md` | §14 suites and golden fixtures |
| DB/privacy/auth boundaries | `04_persistence_and_schema.md`, `05_authorization_and_provider.md` | supported SQL/RLS and authorization evidence |
| AI behavior quality | `06_evaluation.md` | calibrated Promptfoo baseline/candidate/holdout evidence |
| Downstream product behavior | `07_browser_and_release.md` | dedicated browser run and release report |
| Activation/rollback | `verification_gates.md`, `07_browser_and_release.md` | G8 pass, flag state, rollback evidence |

## Gate decision

This draft is eligible for the required multi-debate intent audit. The backend controls the capability flag; a client flag cannot authorize the feature. This draft does not claim that the feature has passed §19. The owner release decision for the current version is recorded in the milestone ledger without changing that gate result.
