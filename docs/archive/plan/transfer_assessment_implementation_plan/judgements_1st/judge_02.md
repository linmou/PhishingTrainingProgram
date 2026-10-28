## Full Ranking

1. [`plan_1.md`](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan/candidates/plan_1.md) — Traceability First — 28/30
2. [`plan_2.md`](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan/candidates/plan_2.md) — Vertical Slices — 27/30
3. [`plan_4.md`](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan/candidates/plan_4.md) — Database and Security First — 25/30
4. [`plan_3.md`](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan/candidates/plan_3.md) — Evaluation First — 23/30

## Rubric Scores

Scale: 1 is materially weak and 5 is excellent. Totals are unweighted sums. Scores use only the permitted files; execution projections are labeled as inference.

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 5 | 4 | 4 | 5 | 5 | 5 | 28 |
| `plan_2.md` | 5 | 4 | 4 | 5 | 5 | 4 | 27 |
| `plan_4.md` | 4 | 3 | 4 | 5 | 5 | 4 | 25 |
| `plan_3.md` | 4 | 3 | 3 | 4 | 4 | 5 | 23 |

## Ranking Reasons

- `plan_1.md` most directly operationalizes [`request.md`](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan/request.md): W0-W11, source hashing, the decomposed package, three-reviewer audit, explicit milestone ownership, separate evidence classes, blocked statuses, and release gating. Its `traceability_graph.md` maps requirements to files, tests, evidence, and status, while a single ledger avoids competing status systems. Inference: this gives it the lowest omission and false-acceptance risk, with documentation overhead as the main cost.

- `plan_2.md` provides the clearest implementation path for the learner-visible lifecycle. Each slice includes UI behavior, server authority, persistence, tests, and evidence, and it explicitly covers idempotency, recovery, duplicate tabs, privacy, and authorization attacks. Inference: this should expose integration defects earlier than a purely layer-oriented plan. It ranks below `plan_1.md` because its requirement traceability and Promptfoo validation criteria are less exact.

- `plan_4.md` is strongest on security-specific failure modes. It explicitly requires verified principals, room authorization, private assessment data, immutable keys, stale-revision checks, unique unresolved-question constraints, atomic writes, and rejection of legacy-RPC bypasses. It ranks third because the schema/security-first sequence may block downstream product work when hosted dependencies are unavailable, and it does not provide the same requirement-to-evidence index as `plan_1.md`.

- `plan_3.md` has the strongest AI-evaluation detail: frozen cases, semantic metrics, evaluator calibration, same-case baselines, preserved legacy assertions, and independent holdouts. However, its ordered steps perform evaluation definition and calibration before the plan audit, while [`request.md`](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan/request.md) requires implementation after the audit gate. Inference: it also risks over-investing in evaluation infrastructure before lifecycle, authorization, and persistence gaps are settled.

- [`diversity_check.md`](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan/approaches/diversity_check.md) confirms that all four approaches are materially distinct and pass the diversity gate. The ranking therefore reflects request fit and execution quality, not lack of strategic diversity.

## Risks and Tradeoffs

- `plan_1.md` trades implementation speed for auditability. Its exact requirement graph, seven work packages, and evidence directories could become maintenance work. Inference: the single authoritative ledger and explicit evidence links reduce that risk enough to justify the structure.

- `plan_2.md` trades architectural stability for early end-to-end feedback. Its rule that each slice be complete before the next may cause repeated shared-primitive changes, which the plan explicitly accepts. Inference: a missing hosted credential during an early slice could pause later slices even while independent deterministic work remains possible.

- `plan_4.md` minimizes security and privacy risk but front-loads database and authorization work. Its own stated major risk is that hosted environment or credential gaps may block downstream work. The request permits milestone-level blocking, so the plan should not turn one blocked hosted check into a claim that unrelated local verification is impossible.

- `plan_3.md` maximizes reproducibility for AI behavior but introduces the largest evaluation commitment. The allowed `request.md` requires preservation of evaluation requirements but does not list the specific semantic metrics, calibration, baselines, or holdouts. Inference: these should not become mandatory release gates unless the traceability audit confirms them against the preserved handoff.

- All plans correctly retain the non-negotiables from `request.md`: no local identity as trusted authorization, no unrecorded hosted or live-model claims, no Docker prerequisite when unavailable, explicit external-dependency blockers, and a disabled feature flag until the release gates pass.

## Recommended Backbone

**Recommendation (inference):** use `plan_1.md` as the primary backbone. Its W0-W3 sequence establishes the immutable baseline, navigable package, audit gate, and evidence controls before implementation. Its W4-W11 sequence already covers deterministic verification, persistence, authorization, application integration, Promptfoo, production-path checks, browser acceptance, and final release evidence.

After the audit gate, incorporate the security invariants from `plan_4.md` before client exposure, use the user-visible slices from `plan_2.md` to organize application integration, and add the evaluation rigor from `plan_3.md` within the Promptfoo milestone. The traceability graph and milestone ledger should remain the controlling requirement and status records.

## Reusable Contributions (source plan, exact advantage, insertion point)

| Source plan | Exact advantage | Insertion point |
|---|---|---|
| `plan_1.md` | The `traceability_graph.md` maps every U01-U15 item, D01-D16 default, non-goal, boundary, transition, privacy rule, migration requirement, evaluation requirement, browser scenario, rollback rule, and final-report requirement to owned files, tests, evidence, and status. | Use for W0-W3 and keep it authoritative through W4-W11. |
| `plan_2.md` | A slice is complete only when the learner path, server-authoritative state, persistence, UI, automated verification, and evidence agree; the slices also cover retries, reconnects, duplicate tabs, recovery, and privacy. | Use after W3 to structure application integration and lifecycle verification, especially W7. |
| `plan_3.md` | Frozen cases, semantic metrics, evaluator calibration, unchanged and contract-compatible baselines, preserved raw results, and independent holdouts provide reproducible AI-behavior evidence. | Insert into W8 after the audit and after the runtime response contract is traceable; use the holdout result at the release gate. |
| `plan_4.md` | Verified-principal checks, room authorization, private-data boundaries, immutable keys, stale revisions, unique unresolved-question constraints, atomic writes, and legacy-RPC rejection make security failures directly testable. | Insert into W5-W6 for schema, persistence, and authorization; repeat relevant negative checks in W9-W10. |

## Incompatibilities

- The evaluation-first ordering in `plan_3.md` places evaluation definition and calibration before its plan-audit step. That cannot be the governing sequence alongside the audit-before-implementation requirement in `request.md`. Evaluation contract drafting may occur early, but evaluator implementation and release-gate execution should follow the audit gate.

- The database-security-first sequence in `plan_4.md` and the persistence-complete first slice in `plan_2.md` can both become blocked by hosted credentials. Inference: they should gate the affected persistence or authorization milestones without preventing independent deterministic and documentation milestones from producing evidence.

- The semantic metrics, baselines, and holdouts proposed by `plan_3.md` are not enumerated in the permitted request file. They must be mapped to the preserved original requirements before being treated as acceptance criteria; otherwise they are additional scope rather than confirmed obligations.

- The traceability graph, slice evidence, evaluation harness results, and security attack results must feed the single milestone ledger. They cannot become separate competing definitions of completion.

- Security controls proposed by `plan_4.md` cannot replace source comparison and intent-drift review. They must be attached to the traceability structure so that stronger security detail does not silently alter product intent or omit non-security requirements.