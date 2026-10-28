## Assigned Approach

**Approach 3: Evaluation First**

- Freeze cases, rubrics, semantic metrics, and release gates before prompt or runtime edits.
- Optimize for measurable AI behavior and reproducibility.
- Decompose work into specification, fixtures, evaluation harness, baseline/candidate comparison, holdout evaluation, and product checks.
- Define expected behavior, validate evaluators, then implement and compare.
- Accept that live feature work waits for evaluation decisions.
- Use independent holdouts before making any release claim.

## Assumptions

- Existing simplified local identity remains valid for legacy behavior but is not a trusted principal for transfer assessment.
- Live transfer assessment requires a real verified principal and server-side provider configuration.
- Supabase Dashboard/MCP may be used for hosted checks.
- Local Docker-based database testing is unavailable.
- Supabase migration execution has already been performed by the user.
- Required credentials and unanswered product decisions may block implementation. The work must stop at the exact blocked milestone rather than inventing a substitute.
- The original handoff remains the comparison baseline and must not be deleted or silently rewritten.
- Existing legacy tutor/Guard browser coverage is not evidence for transfer assessment.
- Legacy checklist data must not be reinterpreted as transfer verification.

## Major Decisions

- Preserve all U01-U15 decisions, D01-D16 defaults, non-goals, ownership boundaries, state transitions, privacy rules, migration requirements, evaluation requirements, browser scenarios, rollback rules, and final-report requirements.
- Reorganize the handoff into small files while preserving the original file unchanged.
- Use `final_plan.md` as the index for the reorganized package.
- Freeze transfer-specific deterministic fixtures and semantic metrics before changing prompts or runtime behavior.
- Cover semantic evaluation for:
  - Trigger and target
  - Medium transfer
  - Item validity
  - Follow-up
  - Verification evidence
- Retain exact grading, IDs, authorization, transactions, and response shape as supporting checks.
- Preserve legacy assertions.
- Calibrate evaluators before comparing implementation candidates.
- Run unchanged and contract-compatible baselines on the same frozen cases.
- Use independent holdouts before any release claim.
- Keep the feature disabled until all release gates pass.
- Do not use Docker when the machine cannot run Docker.
- Do not perform a destructive reset or production migration push as a test step.
- Do not add a new sign-in product or treat local name/role selection as trusted authorization.
- Record blocked milestones with their precise missing external dependency instead of presenting partial completion as release acceptance.

## Ordered Implementation Steps

1. Preserve the original handoff and record its SHA-256 for comparison.

2. Split the handoff into small files organized by work package and verification gate.

3. Create `final_plan.md` as a concise index of all decomposed plan files. State the current implementation status and feature-gate rules explicitly.

4. Create a checkbox milestone ledger covering W0-W11, every required test and evaluation artifact, release activation, and rollback.

5. Define the transfer-specific evaluation contract before prompt or runtime edits. Add deterministic fixtures and semantic metrics for trigger/target, medium transfer, item validity, follow-up, and verification evidence.

6. Retain supporting checks for exact grading, IDs, authorization, transactions, and response shape, while preserving legacy assertions.

7. Calibrate the evaluators and run the unchanged and contract-compatible baselines against the same frozen cases.

8. Audit the reorganized plan with three independent reviewers. Run targeted follow-up where needed, and correct any material intent drift before implementation proceeds.

9. Implement the missing transfer-assessment work in dependency order, including the missing deterministic, integration/database, authorization, Promptfoo, production-path, and browser/release verification artifacts.

10. Add or verify the transfer-specific Promptfoo evaluation, dedicated transfer browser acceptance, full authorization and persistence integration suites, golden fixtures, and the v3 schema artifact.

11. Run the required validation against the frozen cases, candidate implementation, and independent holdouts. Use hosted checks where available and record unavailable checks caused by missing credentials or infrastructure.

12. Update the milestone ledger from actual command and test evidence. Mark each milestone either completed with evidence or blocked with the exact external dependency.

13. Confirm the plan’s §19 definition of done, release gates, migration status, authorization and key protection, tests, evaluation runs, browser evidence, feature-flag state, rollback path, and remaining gaps.

14. Enable the feature only after all release gates and the definition of done pass. Keep it disabled otherwise.

## Risks and Mitigations

- **Evaluator scope may be overbuilt before product integration stabilizes.**  
  Keep the evaluation contract limited to the required transfer behaviors and supporting product checks, then implement against the frozen contract.

- **Live feature work may wait on evaluation decisions.**  
  Complete fixture, rubric, metric, baseline, calibration, and gate decisions before prompt or runtime implementation.

- **Missing credentials or provider configuration may block live validation.**  
  Stop at the affected milestone, record the missing external dependency, and do not substitute an untrusted local identity or silent fallback.

- **Local identity could be mistaken for authorization.**  
  Require a real verified principal and server-side provider configuration for live transfer assessment.

- **Legacy browser coverage could be misreported as transfer evidence.**  
  Treat the existing seven-room tutor/Guard run as legacy coverage only and add dedicated transfer browser acceptance.

- **Legacy checklist data could be misinterpreted as transfer verification.**  
  Preserve the boundary between legacy checklist behavior and transfer-assessment verification.

- **Plan reorganization could introduce intent drift.**  
  Preserve the original handoff, compare against its SHA-256, use three independent reviewers, and record exact corrections before implementation.

- **Database validation may be overstated when Docker is unavailable.**  
  Use permitted hosted checks, record migration status and evidence, and identify unavailable local checks explicitly.

- **Partial tests could be presented as release acceptance.**  
  Require evidence for every implementable milestone and keep the feature flag disabled until all release gates pass.

- **Unsafe migration testing could affect production state.**  
  Do not perform destructive resets or production migration pushes as test steps.

## Validation Criteria

- The original handoff remains present and its SHA-256 is recorded.
- `final_plan.md` indexes all decomposed plan files and states the current implementation status and gate rules.
- The checkbox milestone ledger covers W0-W11, every required test and evaluation artifact, release activation, and rollback.
- The multi-debate review finds no material intent drift, or the exact correction is recorded before implementation.
- Every implementable milestone is either completed with command or evidence links, or marked blocked with the missing external dependency.
- No partial pass is presented as release acceptance.
- Deterministic fixtures and semantic metrics cover trigger/target, medium transfer, item validity, follow-up, and verification evidence.
- Exact grading, IDs, authorization, transactions, and response shape are validated as supporting checks.
- Legacy assertions remain preserved.
- Evaluators are calibrated.
- Unchanged and contract-compatible baselines are compared with candidates on the same frozen cases.
- Independent holdouts are evaluated before any release claim.
- Required deterministic/unit, integration/database, authorization, Promptfoo, production-path, and browser/release evidence is recorded.
- The final report names migration status, authentication and key protection, tests, evaluation runs, browser evidence, feature-flag state, rollback path, and remaining gaps.
- The implementation reaches the plan’s §19 definition of done before the feature flag is enabled.