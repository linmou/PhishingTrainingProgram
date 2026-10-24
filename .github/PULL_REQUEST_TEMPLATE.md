## Intent and scope
- **Issue / requirement:** Closes #...
- **Problem and expected behavior:** 
- **Changed components and out-of-scope work:** 

## Risk and review
- **Risk:** [ ] Low (docs/tests)  [ ] Medium (localized behavior)  [ ] High (permissions, grading, SQL/Edge, CI/release, broad contracts)
- **Failure mode / reviewer attention:** 
- **Fresh-context review:** Link, Important findings and how they were resolved, or explicitly not run
- **Security / permissions / cross-room effects:** None / describe

## Verification (paste actual commands/results)
- **Required GitHub CI:** `isolation-harness` / `frontend-jest` / `frontend-build` — result or link
- **Focused unit/contract/E2E checks:** Commands, outcomes, links
- **Negative/edge cases:** 
- **Skipped/unverified checks and reason:** 

## Release and recovery
- **Staging:** Not applicable / pending / verified (evidence link)
- **Production:** Not applicable / awaiting release / verified (evidence link)
- **Affected SQL / Edge / frontend artifacts and release record:** 
- **Render impact:** `no_sign_up` triggers frontend auto-deploy; note compatibility/readiness even for docs-only merges
- **Rollback / forward recovery plan:** 

## Merge handoff
- **Current PR head SHA:** 
- **Owner merge decision:** **Pending** — agent must not merge automatically. Explicit human authorization for this head is required after review and passing applicable checks.
- **Outstanding blockers / required owner actions:** 

> See [REVIEW.md](../REVIEW.md), [AGENTS.md](../AGENTS.md), and [Supabase release workflow](../tutor-system/docs/supabase-release-workflow.md). CI passing is not authorization to merge; merging and verifying production are different states.
