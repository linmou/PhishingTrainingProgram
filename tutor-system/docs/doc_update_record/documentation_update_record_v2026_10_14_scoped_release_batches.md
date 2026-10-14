# Scoped verification and production batches

Intent: reduce repeated release-test cost while preserving staging deployment, production verification and honest completion status.

Updated: 2026-10-14. Baseline commit: `2bd3143`.

## Adopted workflow

The user approved behavior-based verification and coherent production batches. This supersedes the earlier requirement to promote every individual server feature immediately after staging checks.

- `AGENTS.md` and `tutor-system/AGENTS.md` require scoped local checks and staging deployment/verification, permit a recorded production batch, and retain production verification as the completion gate.
- `docs/supabase-release-workflow.md` owns the scope matrix, intermediate status, batch evidence and promotion rules. Batch records identify members, owner, exact artifacts, remaining checks and concrete release trigger. The default trigger is the listed changes and dependencies being verified together on staging; incident/security fixes and explicit releases proceed promptly.
- `docs/browser-e2e-testing.md` maps behavior changes to existing selectable workflows. Deterministic checks cover routine branching; real-provider and full-inventory journeys run when their behavioral scope requires them. No runtime script or deployment automation changes.

SQL-before-dependent-Edge order, migration Red/Green and permission/data checks, exact source promotion, dedicated fixtures and cleanup remain required. One fresh verified baseline serves a migration-validation cycle; Edge-only changes do not require export/restore. Keep at most one pending SQL migration and archive only after production verification.

## Completion and evidence

`staging verified — awaiting production release` is an intermediate status with production acceptance open. A release record's production results close the included features. Changed artifacts, dependencies, configuration or relevant database preconditions invalidate affected evidence. Batch scope follows combined behavior and dependencies rather than a feature-count threshold; unrelated passing suites can be reused.

Historical release records retain their original evidence. The completed assessment release remains complete; this workflow revision is documentation-only and makes no hosted change.

## Validation

Reviewed root/application instructions, release workflow and browser guidance together. Checked these representative decisions against the matrix: an isolated option-control edit selects component tests and `assessment-answer`; scheduling across targets selects the full delivery journey; an Edge-only transport change selects focused handler/integration and affected live checks without database restore; a migration retains fresh-baseline and permission/data validation before promotion. Verified batch waiting preserves open production acceptance, incident fixes bypass accumulation, and artifact changes invalidate affected evidence.

Validation passed: all 10 added local Markdown link targets/anchors resolve, and `git diff --check` reports no errors. Application tests and hosted deployments are not required for these documentation changes. The policy guides agent execution; it does not add an automatic release scheduler or test-selection engine.
