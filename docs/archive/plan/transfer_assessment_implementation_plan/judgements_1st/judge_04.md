## Full Ranking

1. `plan_1.md` — 27/30 — Traceability First
2. `plan_4.md` — 26/30 — Database and Security First
3. `plan_2.md` — 24/30 — Vertical Slices
4. `plan_3.md` — 23/30 — Evaluation First

## Rubric Scores

Scores use a 1-to-5 scale, where 5 is strongest. Totals are out of 30.

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 5 | 4 | 3 | 5 | 5 | 5 | 27 |
| `plan_4.md` | 5 | 4 | 4 | 4 | 5 | 4 | 26 |
| `plan_2.md` | 4 | 4 | 4 | 4 | 4 | 4 | 24 |
| `plan_3.md` | 4 | 3 | 3 | 4 | 4 | 5 | 23 |

## Ranking Reasons

The diversity check reports low core-strategy overlap for every pair, no substantive duplicates, and a passed diversity gate. Inference: the ranking should reflect execution fitness rather than penalizing plans for being similar.

`plan_1.md` ranks first because it most directly mirrors the request’s governing structure. It preserves the original handoff, records its SHA-256, creates a concise `final_plan.md`, defines work-package ownership, creates a traceability graph for every U01-U15 decision and D01-D16 default, and gives every W0-W11 milestone a source requirement, owned files, checks, and evidence artifact. It also makes the three-reviewer audit a hard gate before implementation and distinguishes `passed` from `blocked`. Inference: this is the strongest control against omission, intent drift, and false completion. Its main weakness is process overhead: the graph, work packages, verification gates, ledger, and evidence directories require disciplined maintenance.

`plan_4.md` ranks second because it is the strongest security and persistence plan. It explicitly protects public question data, learner-owned answers, answer keys, transfer basis, raw model output, and private rationale. It also names verified-principal authorization, room authorization, immutable keys, stale-revision checks, unique unresolved-question constraints, atomic writes, and rejection of legacy-RPC bypasses. These details address the request’s authorization, privacy, migration, and integration requirements more concretely than the other candidates. Its main weakness is that it does not provide Plan 1’s detailed requirement-to-file-to-test mapping. Inference: the phrase “apply the required migration” also needs reinterpretation because the request says the migration was already executed by the user and prohibits production migration pushes as test steps.

`plan_2.md` ranks third because its vertical slices provide a practical user-visible execution model. Each slice is intended to include UI behavior, server authority, persistence, automated verification, and recorded evidence. The sequence covers checklist initialization, question delivery, grading and repair, recovery, concurrency, privacy, authorization, Promptfoo, production-path checks, and browser acceptance. This is strong for discovering integration defects early. It is weaker on package navigation and evidence ownership: it does not define a concrete traceability graph or detailed work-package inventory, and the v3 schema artifact is only explicitly confirmed during closing gates. Its Promptfoo validation is also less specific than Plan 3’s.

`plan_3.md` ranks fourth despite having the best AI-evaluation design. Its frozen cases, semantic metrics, evaluator calibration, unchanged and contract-compatible baselines, and independent holdouts materially improve reproducibility. However, the implementation plan is comparatively generic after the evaluation setup. It does not specify concrete authority boundaries, security invariants, persistence sequencing, or source-to-file ownership. It also places evaluator definition and calibration before the plan audit in its ordered steps. Inference: this creates a risk that evaluation decisions become a self-created prerequisite or that measurement work proceeds without a sufficiently detailed implementation map.

## Risks and Tradeoffs

| Plan | Main Tradeoff | Primary Risk | Required Handling |
|---|---|---|---|
| `plan_1.md` | Highest auditability, but the slowest setup | The traceability package can become stale or over-engineered | Keep one status ledger, require evidence links for every status change, and avoid duplicating authoritative requirement text |
| `plan_4.md` | Strongest security posture, but slower visible product progress | Hosted access, credentials, or migration ambiguity can block downstream work | Verify the user-executed migration and hosted state without applying or pushing migrations; block only the affected milestone |
| `plan_2.md` | Fast user-visible feedback, but shared primitives may be revisited | Schema and security invariants may be discovered too late | Establish database, authorization, privacy, and key-protection gates before exposing the learner-facing slices |
| `plan_3.md` | Strongest AI measurement, but evaluation work may delay implementation | Metrics, calibration, baselines, and holdouts may overbuild the evaluation before product behavior stabilizes | Limit evaluation requirements to source-backed behavior and keep the audit gate ahead of runtime implementation |

All four plans correctly identify the common external blockers: missing verified-principal credentials, unavailable provider configuration, hosted database access, and unanswered product decisions. The request requires those blockers to be recorded precisely, with the feature disabled; none of them may be replaced by local identity, legacy browser evidence, or an unrecorded live-model claim.

## Recommended Backbone

Use `plan_1.md` as the governing backbone. It is the only candidate that gives the request’s reorganization and evidence requirements a concrete control structure before implementation begins.

Preserve its W0-W3 sequence for source baselining, package construction, independent intent-drift review, targeted correction, and implementation authorization. Use its single milestone ledger as the only status authority. Keep its W9-W11 production-path, browser/release, final-report, and activation gates unchanged.

Strengthen the backbone with the following sequence:

1. Insert Plan 4’s security invariants after the audit gate and before client exposure: ownership, RLS, verified principals, private assessment data, immutable keys, stale revisions, uniqueness, atomic writes, and legacy-RPC rejection.
2. Use Plan 2’s vertical slices for the application-integration milestone, while requiring each slice to pass the security and persistence gates before it is considered complete.
3. Use Plan 3’s frozen evaluation cases, evaluator calibration, baseline comparison, and independent holdouts in the Promptfoo milestone.
4. Keep Plan 3’s additional semantic metrics conditional on confirmation that they are required by the preserved handoff. Inference: the request requires preservation of evaluation requirements, not automatic expansion of them.
5. Maintain Plan 1’s rule that every milestone is either evidenced as passed or explicitly blocked, and that the feature remains disabled until the complete definition of done passes.

## Reusable Contributions

| Source Plan | Exact Advantage | Insertion Point |
|---|---|---|
| `plan_1.md` | The SHA-256 source baseline, authority-bounded work packages, traceability graph, and per-milestone source/file/check/evidence mapping | Use for W0-W3 and W11; it should govern package navigation, status, audit closure, and final release accounting |
| `plan_4.md` | Explicit security invariants: public questions and own answers only, private answer keys and rationale, verified principal and room authorization, immutable keys, stale revisions, unique unresolved questions, atomic writes, and legacy-RPC rejection | Add to the persistence and authorization gates after the plan audit and before application exposure |
| `plan_2.md` | Complete user-visible slices covering initialization, one public four-option question, grading and repair, recovery, retries, duplicate tabs, privacy, and authorization | Use inside the application-integration milestone, with slice-level evidence linked back to the single milestone ledger |
| `plan_3.md` | Frozen cases, semantic metrics, evaluator calibration, unchanged and contract-compatible baselines, and independent holdouts | Add to the Promptfoo evaluation milestone, subject to source verification and without making evaluation preparation a substitute for the plan audit |
| `plan_1.md` | Separate evidence lanes for deterministic, database, authorization, Promptfoo, production-path, and browser/release verification | Preserve across W4-W10 so legacy seven-room browser evidence cannot satisfy transfer-assessment acceptance |

## Incompatibilities

- Plan 1’s audit-first sequencing and Plan 3’s evaluation-first sequencing cannot both be binding. Plan 3 permits evaluator definition and calibration before the intent-drift audit, while Plan 1 makes the audit the authorization gate for implementation. Recommended resolution: allow bounded deterministic evaluation-contract drafting before the audit only if it does not alter runtime behavior or create an unverified release requirement; keep implementation after the audit.

- Plan 4’s schema/security-first sequence conflicts with Plan 2’s learner-facing vertical-slice sequence. Plan 4 establishes database and authorization invariants before client exposure, while Plan 2 begins with learner-facing initialization. Recommended resolution: establish Plan 4’s trust boundaries first, then execute Plan 2’s slices against those boundaries.

- Plan 4’s wording to “apply” the migration is incompatible with the request’s known state and restriction against production migration pushes as test steps. The compatible operation is to inspect, compare, and record the user-executed migration and hosted status.

- Plan 3’s trigger/target, medium transfer, item validity, follow-up, and verification-evidence metrics cannot automatically become new product or release requirements. Inference: adopting them without confirming that they derive from the preserved handoff could change product intent.

- Plan 2’s “hosted or integration path” cannot make local integration evidence equivalent to hosted production acceptance. The request explicitly separates integration/database evidence from production-path and browser/release evidence, so those evidence classes must remain distinct.

- Plan 1 requires one milestone ledger as the status authority. Slice-specific records, evaluation results, and security reports can remain evidence artifacts, but parallel status systems would conflict with the single-ledger design and increase the risk of contradictory completion claims.