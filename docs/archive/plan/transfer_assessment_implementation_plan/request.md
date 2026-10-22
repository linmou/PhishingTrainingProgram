# Transfer Assessment Plan Reorganization and Execution Request

## Intent

Turn the existing transfer-assessment handoff into a navigable, evidence-driven execution package without changing its product intent. Then use the reorganized plan to complete the missing implementation and verification work, stopping only for an external dependency or an unanswered product decision.

## Source of truth

- Original handoff: `plan/transfer_assessment_implementation_plan.md`
- The original file is preserved and remains the comparison baseline. It must not be deleted or silently rewritten.
- The reorganized package is indexed by `final_plan.md` in this directory.

## In scope

- Split the handoff into small files organized by work package and verification gate.
- Preserve all U01-U15 decisions, D01-D16 defaults, non-goals, ownership boundaries, state transitions, privacy rules, migration requirements, evaluation requirements, browser scenarios, rollback rules, and final-report requirements.
- Audit the reorganized plan for intent drift with three independent reviewers and targeted follow-up when needed.
- Implement the missing transfer-assessment work in dependency order after the plan audit passes.
- Add the required deterministic, integration, Promptfoo, authorization, and browser/release verification artifacts.
- Maintain a checkbox milestone ledger and update it from actual evidence.
- Keep the feature disabled until the release gates pass.

## Out of scope

- Deleting or replacing the original handoff.
- Reinterpreting legacy checklist data as transfer verification.
- Adding a new sign-in product or treating local name/role selection as trusted authorization.
- Using Docker when the machine cannot run Docker.
- Claiming hosted database, live model, or browser acceptance without recorded evidence.
- Rewriting unrelated worktree changes.

## Known repository state

- Pure transfer types, reducer, parser, grader, rendering, response-contract support, migration files, Edge Function facade, and draft editor are present in the worktree.
- The existing seven-room browser run covers legacy tutor/Guard behavior and is not transfer-assessment evidence.
- Transfer-specific Promptfoo evaluation, dedicated transfer browser acceptance, full authorization/persistence integration suites, golden fixtures, and the v3 schema artifact are not yet evidenced.
- Supabase migration execution has been performed by the user; local Docker-based database testing is unavailable.

## Acceptance criteria

1. The original handoff remains present and its SHA-256 is recorded for comparison.
2. `final_plan.md` is a concise index to all decomposed plan files and explicitly states the current implementation status and gate rules.
3. A checkbox milestone file covers W0-W11, each required test/evaluation artifact, and release activation/rollback.
4. Multi-debate review finds no material intent drift between the decomposed plan and the original handoff, or records the exact correction before implementation.
5. Every implementable milestone is either completed with command/evidence links, or marked blocked with the missing external dependency; no partial pass is presented as release acceptance.
6. The implementation reaches the plan's §19 definition of done before the feature flag is enabled.

## Constraints and assumptions

- Existing simplified local identity remains valid for legacy behavior but is not a trusted principal for transfer assessment.
- A real verified principal and server-side provider configuration are required for live transfer assessment.
- Supabase Dashboard/MCP may be used for hosted checks; no destructive reset or production migration push is allowed as a test step.
- If required credentials or an unanswered product decision are absent, stop at that exact milestone and ask the user rather than inventing a substitute.

## Required final evidence

- Plan reorganization gate and intent-drift audit files.
- Updated milestone ledger.
- Deterministic/unit, integration/database, authorization, Promptfoo, production-path, and browser/release evidence.
- Final report naming migration status, auth/key protection, tests, evaluation runs, browser evidence, feature flag state, rollback path, and remaining gaps.
