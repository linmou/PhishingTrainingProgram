## Assigned Approach

**Database and Security First**

- Core strategy: prove ownership, key confidentiality, transactions, and authorization before UI exposure.
- Primary optimization target: avoid unsafe data release or authorization bypasses.
- Decomposition boundary: migration, RLS, private schema, trusted operations, and attack tests.
- Sequencing principle: establish schema invariants first, then server calls, then clients.
- Main tradeoff: visible product progress is slower.
- Major risk: the hosted environment and required credentials may block all downstream work.

## Assumptions

- Existing simplified local identity remains valid for legacy behavior but is not a trusted principal for transfer assessment.
- Transfer assessment requires a real verified principal and server-side provider configuration.
- Supabase Dashboard or MCP may be used for hosted checks.
- Destructive database resets and production migration pushes are not allowed as test steps.
- Docker-based database testing is unavailable on the machine.
- Supabase migration execution has already been performed by the user.
- If required credentials or an unanswered product decision is absent, stop at that exact milestone and ask the user rather than inventing a substitute.
- The original handoff remains the comparison baseline and must not be deleted or silently rewritten.
- Legacy checklist data must not be reinterpreted as transfer verification.
- Local name or role selection must not be treated as trusted authorization.
- The feature remains disabled until all release gates pass.

## Major Decisions

- Reorganize the existing transfer-assessment handoff into small, navigable files organized by work package and verification gate.
- Preserve all U01-U15 decisions, D01-D16 defaults, non-goals, ownership boundaries, state transitions, privacy rules, migration requirements, evaluation requirements, browser scenarios, rollback rules, and final-report requirements.
- Use `final_plan.md` as the index for the reorganized package.
- Record the original handoff’s SHA-256 for comparison.
- Preserve the original handoff as the comparison baseline.
- Treat transfer checklists as explicitly student-owned.
- Expose learners only to public question data and their own answers.
- Keep answer keys, transfer basis, raw model output, and private rationale server-side.
- Require the following as release gates:
  - A verified principal.
  - Room authorization.
  - Immutable answer keys.
  - Stale-revision checks.
  - Unique unresolved-question constraints.
  - Atomic progress and history writes.
  - Rejection of legacy-RPC bypasses.
- Complete implementation in dependency order, beginning with migration and security boundaries, followed by trusted server operations and then client exposure.
- Add deterministic, integration, Promptfoo, authorization, and browser/release verification artifacts.
- Maintain a checkbox milestone ledger and update it only from actual evidence.
- Keep the capability disabled when the trusted verifier or hosted test environment is unavailable.
- Do not add a new sign-in product.
- Do not claim hosted database, live model, or browser acceptance without recorded evidence.
- Do not rewrite unrelated worktree changes.

## Ordered Implementation Steps

1. Preserve the original handoff and record its SHA-256 for comparison.

2. Split the handoff into the reorganized plan package without changing its product intent or omitting any required decisions, defaults, boundaries, transitions, privacy rules, migrations, evaluations, browser scenarios, rollback rules, or final-report requirements.

3. Create or update `final_plan.md` as a concise index of all decomposed plan files. State the current implementation status and the feature-activation and release-gate rules.

4. Create and maintain a checkbox milestone ledger covering W0-W11, each required test and evaluation artifact, release activation, and rollback.

5. Run the plan reorganization gate and have three independent reviewers audit the reorganized plan for intent drift against the original handoff.

6. Apply targeted corrections for any material drift identified by the audit. Do not begin implementation until the audit passes or the exact correction is recorded.

7. Establish database and schema invariants first:
   - Preserve student ownership boundaries.
   - Apply the required migration and private-schema structure.
   - Enforce RLS and authorization constraints.
   - Protect immutable answer keys and private assessment data.
   - Enforce stale-revision and unique-unresolved-question constraints.
   - Ensure progress and history writes are atomic.

8. Implement trusted server operations and the Edge Function facade using a verified principal and server-side provider configuration.

9. Reject legacy-RPC and other authorization bypass paths.

10. Add the required deterministic and unit verification artifacts for the transfer types, reducer, parser, grader, rendering, response-contract support, migration behavior, and trusted operations that are present or incomplete in the worktree.

11. Add full integration and database verification, including persistence, authorization, transaction behavior, ownership isolation, stale revisions, uniqueness constraints, and private-data protection.

12. Add transfer-specific Promptfoo evaluation and production-path verification. Do not substitute legacy tutor or Guard evaluation for transfer-assessment evidence.

13. Add dedicated transfer browser acceptance and release verification. The existing seven-room browser run is evidence for legacy tutor/Guard behavior only and does not satisfy transfer-assessment acceptance.

14. Update the milestone ledger from command results and recorded evidence. Mark milestones as blocked when an external dependency is missing; do not present a partial pass as release acceptance.

15. Produce the final report with migration status, authentication and key protection, test results, evaluation runs, browser evidence, feature-flag state, rollback path, and remaining gaps.

16. Enable the feature only after the plan audit, implementation work, all required verification evidence, and the plan’s §19 definition of done are complete. Otherwise, keep it disabled and record the blocker.

## Risks and Mitigations

- **Unsafe data release**: Answer keys, transfer basis, raw model output, or private rationale could reach learners.  
  **Mitigation:** Keep these values server-side and expose only public question data and the authenticated learner’s own answers.

- **Unauthorized access through weak identity**: Local name or role selection could be mistaken for authorization.  
  **Mitigation:** Require a real verified principal and enforce room authorization server-side.

- **Legacy-RPC bypass**: Existing legacy operations could bypass the transfer-assessment security model.  
  **Mitigation:** Add authorization attack tests and explicitly reject legacy-RPC bypasses.

- **Non-atomic progress or history updates**: Partial writes could produce inconsistent assessment state.  
  **Mitigation:** Require atomic progress and history writes and verify them through integration/database tests.

- **Stale or conflicting assessment state**: Concurrent updates could overwrite newer answers or leave multiple unresolved questions.  
  **Mitigation:** Enforce stale-revision checks and unique unresolved-question constraints.

- **Mutable or exposed answer keys**: Assessment integrity could be compromised.  
  **Mitigation:** Make keys immutable and keep them in the private server-side boundary.

- **Missing hosted environment or credentials**: Downstream implementation or verification may be impossible.  
  **Mitigation:** Stop at the exact blocked milestone, record the missing external dependency, ask for the required input, and keep the feature disabled.

- **False acceptance claims**: Legacy browser runs or partial tests could be presented as transfer-assessment evidence.  
  **Mitigation:** Require dedicated transfer Promptfoo, integration, authorization, production-path, and browser/release evidence.

- **Plan intent drift**: Reorganization could omit or reinterpret requirements.  
  **Mitigation:** Preserve the original handoff, record its SHA-256, run a three-reviewer multi-debate audit, and record targeted corrections.

- **Unsafe test environment changes**: Testing could alter production state or rely on unavailable Docker infrastructure.  
  **Mitigation:** Do not use destructive resets or production migration pushes, and do not claim local database coverage when Docker is unavailable.

## Validation Criteria

- The original handoff remains present and its SHA-256 is recorded.
- `final_plan.md` indexes all decomposed plan files and explicitly states current implementation status and gate rules.
- The checkbox milestone ledger covers W0-W11, every required test and evaluation artifact, release activation, and rollback.
- The multi-debate plan audit finds no material intent drift, or records the exact correction before implementation proceeds.
- Every implementable milestone is either completed with command and evidence references or marked blocked with the missing external dependency.
- No partial pass is presented as release acceptance.
- Database and RLS checks demonstrate student ownership and prevent unauthorized access.
- Learners can access only public question data and their own answers.
- Answer keys, transfer basis, raw model output, and private rationale remain server-side.
- Verified-principal and room-authorization checks pass.
- Immutable-key, stale-revision, unique-unresolved-question, and atomic progress/history checks pass.
- Legacy-RPC bypass attempts are rejected.
- Deterministic and unit verification artifacts are present and passing for the required transfer-assessment behavior.
- Integration and database verification artifacts cover persistence, ownership, authorization, and transaction behavior.
- Transfer-specific Promptfoo evaluation is recorded.
- Production-path verification is recorded with server-side provider configuration.
- Dedicated transfer browser acceptance and release evidence are recorded.
- The seven-room legacy tutor/Guard browser run is not counted as transfer-assessment evidence.
- The final report names migration status, authentication and key protection, test results, evaluation runs, browser evidence, feature-flag state, rollback path, and remaining gaps.
- The implementation reaches the plan’s §19 definition of done before the feature flag is enabled.
- If the trusted verifier, hosted test environment, required credentials, or an unanswered product decision is unavailable, the capability remains disabled and the blocker is recorded.