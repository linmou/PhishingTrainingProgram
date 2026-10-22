## Full Ranking

1. [Inference] `plan_1.md` — Traceability First
2. [Inference] `plan_2.md` — Vertical Slices
3. [Inference] `plan_4.md` — Database and Security First
4. [Inference] `plan_3.md` — Evaluation First

[Direct: `diversity_check.md`] The diversity gate passed: all four plans follow their assigned approaches, have materially distinct core strategies, and have no unresolved overlap. The ranking therefore evaluates execution quality and requirement coverage rather than penalizing strategic similarity.

## Rubric Scores

[Inference] Scores are ordinal judgments from 1 to 5 against the request and the diversity check. Totals are used to make the required ranking explicit.

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 5 | 4 | 4 | 5 | 5 | 5 | 28 |
| `plan_2.md` | 4 | 4 | 5 | 5 | 5 | 4 | 27 |
| `plan_4.md` | 4 | 4 | 4 | 5 | 5 | 4 | 26 |
| `plan_3.md` | 4 | 4 | 3 | 4 | 4 | 4 | 23 |

## Ranking Reasons

- **`plan_1.md`**
  - [Direct: `plan_1.md`] It explicitly maps every W0-W11 milestone to a source requirement, owned files, tests or checks, and an evidence artifact.
  - [Direct: `plan_1.md`] Its traceability graph covers U01-U15, D01-D16, non-goals, ownership boundaries, state transitions, privacy, migrations, evaluation, browser scenarios, rollback, and final-report requirements.
  - [Direct: `plan_1.md`] It separates deterministic, integration/database, authorization, Promptfoo, production-path, and browser/release evidence, and treats blocked dependencies as `blocked` rather than `passed`.
  - [Inference] This is the closest match to the request’s “navigable, evidence-driven execution package” and gives the strongest protection against silent intent drift.
  - [Inference] The main weakness is operational weight: seven work packages, a detailed graph, independent audit reports, and per-milestone evidence create meaningful setup and maintenance cost.

- **`plan_2.md`**
  - [Direct: `plan_2.md`] Each vertical slice is intended to include the learner-visible path, server behavior, persistence, automated verification, and recorded evidence.
  - [Direct: `plan_2.md`] The slices explicitly cover initialization, question delivery, grading, repair, recovery, Guard deferral, stale drafts, retries, reconnects, duplicate tabs, privacy, and authorization attacks.
  - [Inference] This is the clearest execution model for discovering cross-layer integration problems early and is simpler to operate than a purely document-driven plan.
  - [Direct: `plan_2.md`] It does not define the same per-requirement source-file, test, and evidence mapping as Plan 1, and its Promptfoo step does not explicitly require frozen cases, evaluator calibration, baseline comparison, or holdouts.
  - [Inference] It is a strong implementation plan but needs Plan 1’s traceability controls to make completion auditable at the level required by the acceptance criteria.

- **`plan_4.md`**
  - [Direct: `plan_4.md`] It gives concrete security gates for verified principals, room authorization, immutable answer keys, stale revisions, unique unresolved questions, atomic progress/history writes, and rejection of legacy-RPC bypasses.
  - [Direct: `plan_4.md`] It explicitly protects public question data and learner-owned answers while keeping answer keys, transfer basis, raw model output, and private rationale server-side.
  - [Inference] This is the strongest plan for preventing authorization bypasses, privacy leakage, and inconsistent persistence state.
  - [Direct: `plan_4.md`] Its deterministic verification step does not explicitly name golden fixtures, and its Promptfoo requirement is stated at a higher level than Plan 3’s frozen-case, calibration, baseline, and holdout process.
  - [Inference] Its security-first sequence can also delay visible implementation when hosted infrastructure or credentials are unavailable, although the plan correctly requires the feature to remain disabled in that situation.

- **`plan_3.md`**
  - [Direct: `plan_3.md`] It provides the strongest evaluation design: frozen cases, semantic metrics, evaluator calibration, unchanged and contract-compatible baselines, preserved legacy assertions, and independent holdouts.
  - [Direct: `plan_3.md`] It also calls for golden fixtures, Promptfoo evidence, integration/database checks, authorization checks, production-path verification, and dedicated browser acceptance.
  - [Direct: `plan_3.md`] Its ordered steps define the evaluation contract and calibration in steps 5-7, before the three-reviewer plan audit in step 8.
  - [Inference] That ordering creates a sequencing concern because the request requires the reorganized plan to be audited before implementation proceeds. Evaluation specification may be preparatory, but prompt/runtime changes must not begin before the audit gate.
  - [Inference] It is less useful as the overall backbone because it gives limited operational detail for the application lifecycle, schema invariants, ownership isolation, and concrete authorization flows.

## Risks and Tradeoffs

- [Inference] Plan 1’s traceability graph can become a second documentation system if it duplicates requirement prose rather than mapping requirements to authoritative files, tests, and evidence. Its single-ledger rule should remain strict.
- [Inference] Plan 2’s slice model can encourage premature end-to-end completion if security and persistence invariants are treated as implementation details inside a slice instead of explicit prerequisites.
- [Inference] Plan 4 may make the whole effort appear blocked by hosted infrastructure even when deterministic domain work, fixture creation, and plan-audit work can continue with the feature disabled. Blocks should apply to the exact affected milestone.
- [Inference] Plan 3’s frozen evaluator can encode an incorrect interpretation if its metrics are not first traced to the preserved handoff requirements. Evaluation criteria should not silently become new product requirements.
- [Direct: `request.md`] All plans must stop for missing credentials or unanswered product decisions, must not claim hosted or browser acceptance without evidence, and must keep the feature disabled until the definition-of-done gates pass.
- [Inference] Combining all four plans wholesale would violate the simplicity objective by duplicating ledgers, gates, and evidence structures. The selected contributions should be inserted into one authoritative package.

## Recommended Backbone

[Inference] Use `plan_1.md` as the backbone, with its W0-W11 sequence, traceability graph, single milestone ledger, explicit status values, and evidence directories.

[Direct: `plan_1.md`] It is the only candidate that makes every milestone auditable through the same four-part structure: source requirement, owned files, checks, and evidence artifact. That structure directly supports the request’s acceptance criteria.

[Inference] Apply the combined sequence below:

1. Preserve Plan 1’s W0-W3 source baseline, package construction, three-reviewer audit, and correction gate before implementation.
2. Insert Plan 4’s schema, RLS, verified-principal, private-data, atomic-write, stale-revision, and legacy-RPC checks before exposing user-facing transfer operations.
3. Use Plan 2’s vertical slices as execution units within the audited work packages. Require each slice to link its results to the single Plan 1 ledger rather than creating a second status system.
4. Add Plan 3’s frozen fixtures, semantic metrics, evaluator calibration, compatible baselines, and independent holdouts to the evaluation work package after the plan audit and before prompt/runtime changes.
5. Retain Plan 1’s final release gate: every milestone is `passed` with evidence or explicitly `blocked`, and the feature remains disabled unless the complete definition of done is evidenced.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point |
|---|---|---|
| `plan_1.md` | Requirement-to-file-to-test traceability, explicit W0-W11 ownership, one status ledger, and evidence-based gate decisions. | Use as the package-wide backbone from source baseline through final release reporting. |
| `plan_2.md` | Complete learner-visible slices expose cross-layer failures involving UI, server authority, persistence, retries, recovery, and concurrency. | Use for runtime implementation and integration execution after the W3 plan-audit gate. |
| `plan_3.md` | Frozen cases, semantic metrics, evaluator calibration, unchanged/compatible baselines, and independent holdouts improve reproducibility of AI-behavior claims. | Insert into the evaluation work package before Promptfoo and runtime comparison; link all results to the Plan 1 ledger. |
| `plan_4.md` | Concrete security invariants and attack tests cover ownership, privacy, immutable keys, stale state, atomic writes, and legacy authorization bypasses. | Insert before client exposure in persistence and authorization milestones, and reuse as release-gate checks. |

## Incompatibilities

- [Direct: `plan_3.md`; Direct: `request.md`] Plan 3 places evaluation setup and calibration before its plan-audit step, while the request requires the reorganized plan to be audited before implementation proceeds. [Inference] Keep evaluation design preparatory if necessary, but move all prompt/runtime implementation and release-significant evaluation work after the W3 audit gate.
- [Direct: `plan_2.md`; Direct: `plan_4.md`] Plan 2 defines a slice as a complete user-visible path, while Plan 4 requires schema and security invariants before client exposure. [Inference] A vertical slice cannot be marked complete until the relevant Plan 4 ownership, authorization, and persistence gates pass.
- [Direct: `plan_1.md`; Direct: `plan_2.md`] Plan 1 requires one authoritative milestone ledger, while Plan 2 expects evidence updates after every slice. [Inference] Slice reports should be evidence linked from the single ledger, not parallel status authorities.
- [Direct: `plan_3.md`; Direct: `request.md`] Plan 3 introduces specific semantic metrics and holdout comparisons, while the request requires preservation of the existing product intent. [Inference] Those metrics must be traceable to the handoff and treated as evaluation instrumentation, not silently expanded product scope.
- [Direct: `plan_4.md`; Direct: `request.md`] Plan 4 names several concrete release gates that are not enumerated in the request’s acceptance-criteria section. [Inference] They should be retained only where they map to the preserved handoff’s U01-U15 decisions, D01-D16 defaults, privacy rules, state transitions, or security requirements.
- [Inference] The four strategies cannot each retain independent ledgers, audit packages, and release checklists without adding unnecessary administrative complexity. Plan 1’s package and ledger should own status, while the other plans contribute bounded checks and execution methods.