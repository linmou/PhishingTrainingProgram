# Mandatory server delivery

Intent: preserve the user's requirement that server development continues through deployment and live verification.

Updated: 2026-10-14. Baseline commit: `83690fe`.

## Decision

The user instructed: “please make the development - deploy - verification flow compulsory , dont stop at development next time”. The user selected repository instructions and local workflow documents as the enforcement surface.

## Changes

- Root `AGENTS.md` defines mandatory delivery for deployed server behavior, standing release authorization for configured staging/production projects, explicit user overrides, inherited dependencies, completion evidence, and incomplete-task handling.
- `tutor-system/AGENTS.md` loads that requirement for application work.
- `supabase-release-workflow.md` adds a completion gate covering local validation, staging deployment/verification, and production deployment/verification before the task can be marked complete. Existing migration, permission, provider, and cleanup checks remain applicable.

The requirement applies to future server delivery work. The subsequent [assessment release](documentation_update_record_v2026_10_14_final_assessment_release.md) completed this flow separately and records its deployed artifacts and live checks.

## Validation

Reviewed both instruction scopes and the release workflow for a consistent completion endpoint. Checked local Markdown link targets and `git diff --check`. No runtime code changed; application tests and deployment are not applicable to this documentation task. These are agent instructions, not an automatic CI deployment or a programmatic guarantee that an agent will follow them.
