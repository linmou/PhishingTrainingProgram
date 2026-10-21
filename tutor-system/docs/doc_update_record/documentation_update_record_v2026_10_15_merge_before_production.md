# Merge before production

Intent: make the production release reproducible from the integrated branch and coordinate deployments from multiple worktrees.

Updated: 2026-10-15. Baseline commit: `18981cc`.

## Workflow change

`AGENTS.md`, `tutor-system/AGENTS.md` and `docs/supabase-release-workflow.md`
now require deployable changes and dependencies to be committed and merged into
`no_sign_up` before production mutations. Worktree candidates may still deploy to
staging. The release record identifies the integrated commit, frozen artifacts,
merge status and one owner coordinating shared deployments through verification
and cleanup.

After integration, compare SQL, function source and imported dependencies,
required frontend artifacts, configuration and relevant target preconditions
against staging evidence. Identical artifacts may reuse valid evidence; conflict
resolutions and other integration changes require affected local and staging
checks. Production receives the exact integrated artifacts in dependency order.
Incident and security fixes use the same gates promptly.

The gate is included in the release evidence table, batch trigger, database
upgrade sequence, Edge release sequence, acceptance gates, hosted application
instructions and migration progress fields. Existing release evidence remains
historical; this revision changes documentation only.

## Validation

Reviewed these release decisions against both repository instruction files and
the complete workflow:

| Scenario | Required decision |
| --- | --- |
| Unmerged worktree passes staging | Record pending integration; production acceptance stays open |
| Fast-forward preserves tested artifacts and preconditions | Record integrated commit and reuse staging evidence |
| Merge changes source or imported dependencies | Run affected local checks and stage/verify integrated artifacts |
| Merge changes SQL or its baseline | Repeat applicable migration validation and staging verification |
| Production advances while the batch waits | Include current affected changes and recheck target preconditions |
| Another worktree needs a shared deployment during active checks | Coordinate with the owner; wait or record a handoff |
| An intervening deployment changes a tested dependency | Compare current state and invalidate affected evidence |
| Incident fix needs prompt release | Complete integration and verification gates without batch accumulation |

Validation passed: all 11 local Markdown links and anchors resolve across the four
changed documents; `git diff --check` reports no errors. The eight release decisions
above are consistent with both instruction files and the SQL/Edge paths.
Application tests and hosted deployment are not required for this documentation
revision.
