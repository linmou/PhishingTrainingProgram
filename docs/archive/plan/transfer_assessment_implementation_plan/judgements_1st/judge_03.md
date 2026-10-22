## Full Ranking

1. `plan_1.md` — 27/30
2. `plan_2.md` — 25/30
3. `plan_4.md` — 24/30
4. `plan_3.md` — 21/30

[Direct: `diversity_check.md`] The diversity gate passes: all four approaches are materially distinct and no substantive duplicate remains. [Inference] This supports combining complementary contributions, but does not by itself establish requirement fit or execution quality.

## Rubric Scores

[Inference: all numeric scores are independent judgments on a 1–5 scale; totals are out of 30.]

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 5 | 4 | 3 | 5 | 5 | 5 | 27 |
| `plan_2.md` | 4 | 4 | 4 | 5 | 4 | 4 | 25 |
| `plan_4.md` | 4 | 3 | 4 | 4 | 5 | 4 | 24 |
| `plan_3.md` | 3 | 3 | 3 | 4 | 4 | 4 | 21 |

## Ranking Reasons

- `plan_1.md`: [Direct] It most explicitly operationalizes the request: source SHA-256 baseline, decomposed work packages, a traceability graph, W0–W11 milestones, three-reviewer audit, separate evidence classes, explicit blocked statuses, full application-path verification, and gated activation. [Direct] Each milestone names a source requirement, owned files, checks, and evidence artifact. [Inference] Its main weakness is administrative weight: the graph, seven work-package files, evidence directories, and repeated status updates create a meaningful maintenance burden.

- `plan_2.md`: [Direct] Its five vertical slices cover the learner-facing lifecycle, including initialization, question delivery, grading, recovery, retries, stale drafts, duplicate tabs, privacy, and authorization attacks. [Direct] It preserves server authority, idempotency, external-dependency blocking, dedicated browser evidence, and the release gate. [Inference] It is less precise than the top-ranked plan about one-to-one requirement traceability, source-baseline verification details, per-milestone evidence structure, and migration/schema verification timing.

- `plan_4.md`: [Direct] It gives the strongest concrete treatment of privacy and authorization: verified principals, room authorization, immutable answer keys, stale-revision checks, unique unresolved-question constraints, atomic writes, private server-side data, and legacy-RPC bypass tests. [Direct] It also preserves the audit, evidence, feature-flag, and release requirements. [Inference] It ranks below the vertical-slice plan because its user-visible lifecycle and evidence-package mechanics are less developed, while its “apply the required migration” wording is ambiguous against the request’s known user-executed migration and prohibition on production migration pushes.

- `plan_3.md`: [Direct] It provides the strongest AI-evaluation design through frozen cases, semantic metrics, deterministic fixtures, evaluator calibration, unchanged and contract-compatible baselines, metadata capture, and independent holdouts. [Direct] It preserves the required security, legacy-boundary, migration, browser, and feature-flag constraints. [Inference] It ranks last because evaluation setup and baseline work precede the intent-drift audit, implementation sequencing is broad rather than dependency-specific, and the plan gives less operational detail for the complete runtime, persistence, authorization, and user-flow work.

## Risks and Tradeoffs

- [Direct: `plan_1.md`] The traceability-first approach explicitly accepts slower setup and identifies stale documentation as its major risk. [Inference] It is the safest plan for preserving intent, but only if the graph and ledger are updated from actual evidence rather than treated as paperwork.

- [Direct: `plan_2.md`] Vertical slices may revisit shared primitives as integration issues appear. [Inference] This improves early end-to-end feedback but can create rework and temporarily blur ownership unless every change updates the central requirement and evidence mapping.

- [Direct: `plan_4.md`] Database-security-first work may be blocked by hosted access or credentials before client-visible progress is possible. [Inference] The sequence is appropriate for protecting assessment data, but independent deterministic and documentation work should continue where it does not depend on the blocked environment.

- [Direct: `plan_3.md`] The plan acknowledges that evaluator scope can become overbuilt before product integration stabilizes and that live work may wait for evaluation decisions. [Inference] Freezing metrics too early can encode an unsupported interpretation of product intent; evaluation gates should remain traceable to the preserved requirements.

- [Direct: `request.md`] No approach may treat local name/role selection as authorization, reuse the legacy seven-room browser run as transfer evidence, claim live acceptance without recorded evidence, use Docker when unavailable, or enable the feature before the release gates and definition of done pass.

## Recommended Backbone

[Inference] Use `plan_1.md` as the structural backbone. Its traceability graph and W0–W11 sequence best match the request’s emphasis on a navigable package, intent-drift auditing, evidence-linked milestones, explicit blockers, and release gating.

[Direct: `plan_1.md`] Preserve its order through source baseline, package construction, intent-drift audit, correction gate, implementation, verification, final report, and activation decision. Add the following focused material:

- [Direct: `plan_2.md`] Use the five vertical slices to organize the runtime work inside the traceability-controlled milestones, especially deterministic domain work, application integration, recovery, concurrency, and browser flow.
- [Direct: `plan_4.md`] Insert its ownership, privacy, transaction, stale-revision, immutable-key, and legacy-bypass checks into persistence and authorization gates before client exposure.
- [Direct: `plan_3.md`] Insert its frozen fixtures, semantic metrics, evaluator calibration, baseline comparison, holdouts, and run metadata into the evaluation gate, provided each addition is mapped to an existing requirement.
- [Direct: `request.md`] Keep the feature disabled until every required artifact is evidenced and no milestone is represented as passed on partial results.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point |
|---|---|---|
| `plan_1.md` | [Direct] A single traceability graph maps every U01–U15 decision, D01–D16 default, boundary, transition, privacy rule, migration requirement, evaluation requirement, browser scenario, rollback rule, and report requirement to files, tests, evidence, and status. | Use as the authoritative mapping during W1 package construction and W3 audit correction. |
| `plan_1.md` | [Direct] Every W0–W11 milestone specifies its source requirement, owned files, checks, and evidence artifact. | Use to define the milestone ledger and W11 release-readiness review. |
| `plan_2.md` | [Direct] Complete user-visible slices cover checklist initialization, one public four-option question, grading and repair, recovery, retries, reconnects, duplicate tabs, privacy, and authorization attacks. | Insert into W4–W7 implementation and integration verification. |
| `plan_2.md` | [Direct] Server authority and idempotency are treated as cross-slice invariants rather than UI behavior. | Add to the runtime, persistence, and authorization traceability rows before slice execution. |
| `plan_3.md` | [Direct] Semantic metrics cover trigger/target, medium transfer, item validity, follow-up, and verification evidence while retaining exact grading, IDs, authorization, transactions, response shape, and legacy assertions. | Insert into W4 fixtures and W8 Promptfoo evaluation, subject to requirement mapping. |
| `plan_3.md` | [Direct] Evaluator calibration, unchanged and contract-compatible baselines, independent holdouts, hashes, and run metadata improve reproducibility. | Add to W8 evaluation evidence and W11 final-report requirements; do not use them as substitutes for integration or browser evidence. |
| `plan_4.md` | [Direct] Explicit security invariants address verified principals, room authorization, immutable keys, stale revisions, unique unresolved questions, atomic progress/history writes, and legacy-RPC bypasses. | Insert into W5 persistence and W6 authorization tests before client-path acceptance. |
| `plan_4.md` | [Direct] The public/private data boundary distinguishes learner-visible question and answer data from server-only keys, transfer basis, raw model output, and private rationale. | Add to persistence, response-contract, application, and browser privacy checks. |

## Incompatibilities

- [Direct: `plan_3.md`; Inference] Evaluation contract construction and baseline calibration occur before its intent-drift audit. The recommended backbone should complete the plan reorganization and audit gate first, then add evaluation work unless the work is explicitly classified as pre-implementation planning.

- [Direct: `plan_1.md`] The milestone ledger is intended to be the single status ledger. Per-slice completion, evaluation gates, and security gates should link evidence into that ledger rather than create competing status systems.

- [Direct: `plan_4.md`; `request.md`] “Apply the required migration” must not be interpreted as an unauthorized production migration push or destructive test action. With the known user-executed migration, the default insertion should be schema and migration verification unless an explicitly permitted environment is available.

- [Direct: `plan_3.md`] Semantic metrics and independent holdouts are useful evaluation mechanisms, but [Inference] they must not become new product requirements or release gates unless they can be traced to the preserved evaluation requirements.

- [Direct: `plan_2.md`] Slice-local revisions to shared primitives cannot bypass the traceability graph, ownership boundaries, or audit corrections. Shared code changes need to update the central mapping and corresponding evidence.

- [Direct: `request.md`] No plan-specific optimization can override the boundaries between legacy checklist data and transfer verification, local identity and trusted authorization, deterministic tests and live acceptance, or blocked milestones and release acceptance.