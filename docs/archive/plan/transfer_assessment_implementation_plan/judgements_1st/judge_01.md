## Full Ranking

1. `plan_1.md` — 27/30
2. `plan_4.md` — 25/30
3. `plan_2.md` — 24/30
4. `plan_3.md` — 23/30

## Rubric Scores

Scores are [Inference] judgments on a 1–5 scale, where 5 is strongest.

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 5 | 4 | 3 | 5 | 5 | 5 | 27 |
| `plan_4.md` | 5 | 3 | 4 | 4 | 5 | 4 | 25 |
| `plan_2.md` | 4 | 4 | 4 | 4 | 4 | 4 | 24 |
| `plan_3.md` | 4 | 3 | 3 | 4 | 4 | 5 | 23 |

## Ranking Reasons

- **`plan_1.md`**: [Direct: `plan_1.md`] It maps W0–W11 to source requirements, owned files, tests or checks, and evidence artifacts. It explicitly covers the SHA-256 baseline, navigable package, three-reviewer audit, targeted correction, deterministic tests, persistence, authorization, Promptfoo, production-path checks, browser acceptance, final reporting, rollback, and feature activation. [Inference] This is the closest match to `request.md` because it treats both plan reorganization and implementation verification as first-class, auditable work. Its main weakness is the amount of documentation and traceability maintenance it introduces.

- **`plan_4.md`**: [Direct: `plan_4.md`] It directly addresses the request’s authorization, privacy, migration, hosted-check, feature-flag, and evidence constraints. Its validation criteria include student ownership, private server-side data, verified principals, immutable keys, stale-revision checks, unique unresolved-question constraints, atomic progress/history writes, and legacy-RPC rejection. [Inference] It ranks second because its security-first sequence is strong for the transfer-assessment risk profile, but it gives less explicit structure for requirement-to-file traceability and less detail for the complete user-visible lifecycle than `plan_1.md`.

- **`plan_2.md`**: [Direct: `plan_2.md`] Its five vertical slices connect learner behavior to server authority, persistence, UI behavior, tests, and evidence. It covers retries, reconnects, duplicate tabs, stale drafts, recovery, privacy, authorization attacks, Promptfoo, production-path checks, and dedicated browser acceptance. [Inference] It is operationally clear and likely easier to execute than the documentation-heavy plans, but it does not define each W0–W11 milestone with the explicit source, ownership, test, and evidence mapping required for maximum auditability.

- **`plan_3.md`**: [Direct: `plan_3.md`] It provides the strongest evaluation-specific controls: frozen cases, semantic metrics, evaluator calibration, unchanged and contract-compatible baselines, raw results, metadata, and independent holdouts. [Inference] It is the weakest overall backbone because it makes evaluation decisions a prerequisite for runtime work, adds substantial evaluator machinery before implementation, and gives less detailed sequencing for persistence, application integration, and authorization than the other candidates. Its step order also places evaluator setup before the plan intent-drift audit, creating ambiguity with the request’s audit-before-implementation gate.

[Direct: `diversity_check.md`] The diversity check reports that all four plans follow their assigned approaches, have materially distinct core strategies, and pass the diversity gate. Therefore, the ranking is based on requirement fit and execution quality rather than penalizing duplicated approaches.

## Risks and Tradeoffs

| Plan | Directly stated risk or tradeoff | Judging implication |
|---|---|---|
| `plan_1.md` | [Direct: `plan_1.md`] The main tradeoff is slower initial setup, with stale documentation identified as a major risk. | [Inference] The graph, work-package boundaries, and evidence links provide the strongest control against intent drift, but they can become maintenance overhead unless the ledger remains the sole status authority. |
| `plan_4.md` | [Direct: `plan_4.md`] Visible product progress is slower, and missing hosted infrastructure or credentials may block downstream work. | [Inference] The sequence minimizes security and privacy exposure, but it may delay deterministic application work that could proceed while hosted checks are unavailable. |
| `plan_2.md` | [Direct: `plan_2.md`] Shared primitives may be revisited as slices expose integration issues; the plan also treats duplicate requests, concurrency, privacy, and provider availability as risks. | [Inference] Its user-centered slices make progress easy to observe, but requiring a complete UI/server/persistence/evidence slice before advancing can create large blocked units and make cross-slice refactoring more likely. |
| `plan_3.md` | [Direct: `plan_3.md`] Evaluator scope may be overbuilt, live feature work may wait for evaluation decisions, and missing credentials may block live validation. | [Inference] The evaluation discipline is valuable for Promptfoo and release claims, but making it the global first dependency risks delaying non-model work and freezing interpretations before the decomposed plan has passed its audit. |

[Direct: `request.md`] All candidates preserve the feature-disabled rule, distinguish legacy browser coverage from transfer evidence, prohibit unsafe migration testing, and require exact blockers instead of partial release claims. [Inference] `plan_1.md` handles these cross-cutting rules most consistently because it assigns them to explicit milestones and evidence locations.

## Recommended Backbone

[Inference] Use `plan_1.md` as the backbone. Its W0–W3 sequence directly establishes the immutable baseline, decomposed package, independent audit, and correction gate required by `request.md`. Its W4–W11 sequence then separates deterministic, persistence, authorization, application, Promptfoo, production-path, browser, and release evidence without allowing partial results to become acceptance.

Keep `traceability_graph.md` and `milestone_ledger.md` as the authoritative planning and status controls described by `plan_1.md`. Use `plan_4.md` to strengthen the persistence and authorization gates, `plan_2.md` to make application completion observable through user-visible slices, and `plan_3.md` to improve the Promptfoo evaluation and release-comparison gates. [Inference] This preserves one coherent source of status while borrowing the strongest domain-specific controls from the other approaches.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point |
|---|---|---|
| `plan_1.md` | [Direct] Each W0–W11 milestone names its source requirement, owned files, tests or checks, and evidence artifact; statuses distinguish `passed` from `blocked`. | Use as the backbone for `final_plan.md`, `traceability_graph.md`, `milestone_ledger.md`, `verification_gates.md`, and the full execution sequence. |
| `plan_2.md` | [Direct] A slice is complete only when UI behavior, server authority, persistence, automated verification, and recorded evidence agree; it explicitly exercises retries, reconnects, duplicate tabs, stale drafts, recovery, and authorization attacks. | Add slice-level completion checklists to the application and browser portions of W4–W7 and W10 in `plan_1.md`. |
| `plan_3.md` | [Direct] Frozen evaluation cases, semantic metrics, evaluator calibration, unchanged and contract-compatible baselines, independent holdouts, and complete run metadata improve reproducibility. | Add to W8 Promptfoo and W11 release validation, after confirming each metric and gate is traceable to the preserved handoff requirements. |
| `plan_4.md` | [Direct] Its security checks cover ownership, public-versus-private data, RLS, verified principals, immutable answer keys, stale revisions, unique unresolved questions, atomic progress/history writes, and legacy-RPC bypasses. | Add to W5 persistence, W6 authorization, and W7 application integration; map each invariant through the traceability graph before treating it as a release gate. |

## Incompatibilities

| Incompatible combination | Why it cannot be adopted literally | Resolution |
|---|---|---|
| `plan_1.md` authority-based work packages and `plan_2.md` vertical slices as two authoritative decompositions | [Direct: `plan_1.md`] It requires non-overlapping authority work packages and a single status ledger, while [Direct: `plan_2.md`] it uses user-visible slices as the primary boundary. [Inference] Maintaining both as competing sources would duplicate ownership and status. | Keep `plan_1.md` as the authoritative package and ledger structure; use `plan_2.md` slices as execution views and acceptance checklists. |
| `plan_3.md` evaluation-first sequencing and a strict security-first or audit-first global sequence | [Direct: `plan_3.md`] It places evaluation-contract, calibration, and baseline work before implementation and before its audit step. [Direct: `request.md`] Implementation must follow the plan audit. [Inference] All of these cannot be the single first implementation dependency. | Run the reorganization and intent-drift gate first. Permit offline fixture or contract preparation only when it is clearly plan work; do not make live evaluation a prerequisite for unrelated deterministic implementation. |
| `plan_4.md`’s concrete security invariants as automatic release requirements | [Direct: `plan_4.md`] It names specific invariants such as immutable keys, stale revisions, and legacy-RPC rejection. [Direct: `request.md`] The allowed request requires preservation of the original detailed requirements but does not enumerate those invariants. [Inference] They must not become unverified additional scope without source mapping. | Trace each invariant to the original preserved requirement through `traceability_graph.md`; otherwise retain it as a proposed check rather than an unconditional gate. |
| `plan_2.md`’s complete-slice-before-next rule and unconditional forward progression | [Direct: `request.md`] Every implementable milestone must be completed with evidence or marked blocked by an exact external dependency. [Direct: `plan_2.md`] Its slices depend on verified principals, persistence, hosted checks, and provider configuration. [Inference] A blocked slice cannot be treated as complete merely because its local tests pass. | Give each slice explicit `blocked` and `not_started` states in the shared milestone ledger and prevent release activation until all required evidence passes. |
| `plan_3.md`’s semantic metrics and holdout gates as replacements for product verification | [Direct: `plan_3.md`] It treats semantic evaluation as the primary optimization target while retaining exact grading, IDs, authorization, transactions, and response-shape checks as supporting checks. [Direct: `request.md`] Deterministic, integration/database, authorization, Promptfoo, production-path, and browser/release evidence are all required. | Use the evaluation controls to strengthen Promptfoo evidence, but retain the independent persistence, authorization, production-path, and browser gates required by the request. |