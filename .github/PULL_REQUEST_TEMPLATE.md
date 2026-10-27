## Summary
- **Issue / requirement:** <!-- Link the issue or describe the requested change -->
- **Changed behavior and scope:** <!-- Brief explanation; identify SQL, Edge, frontend, or docs-only -->
- **Risk / reviewer attention:** <!-- Affected permissions, data, grading, contracts, or failure modes; N/A with reason -->

## Verification
- **Local verification:** <!-- Commands and observed outcomes, or N/A with reason -->
- **GitHub CI:** The [Verify PR (no hosted state)](https://github.com/linmou/PhishingTrainingProgram/blob/no_sign_up/.github/workflows/verify-pr.yml) workflow automatically reports `isolation-harness`, `frontend-jest`, and `frontend-build` in the PR **Checks** tab. Check the live statuses; do not self-certify a pass here.
- **Code review:** <!-- Pending / reviewer or tool / findings and disposition. CI above does not perform AI code review. -->
- **Risk assessment:** <!-- Codex assessment link for this head/base/policy; required pr-approval-policy check; automatic or human with concrete reason. -->
- **Staging acceptance:** <!-- Not applicable / Pending / Verified; include tested commit, project, evidence link when applicable -->
- **Unverified behavior or blockers:** <!-- None or specifics -->

## Release handoff
- **Change/release type:** <!-- Docs/tests only | frontend | SQL/RLS | Edge | combined -->
- **Batch / release owner:** <!-- N/A or link to the dated release record -->
- **Candidate artifacts and dependencies:** <!-- Commit and SQL/Edge/frontend hashes when required; otherwise N/A -->
- **Production compatibility and recovery:** <!-- Render auto-deploys from no_sign_up; note compatibility, rollout ordering and rollback/forward fix, or N/A -->
- **Merge authorization:** <!-- Automatic under .github/pr-approval-policy.md, or human PR approval link for the current risk assessment. Required CI, code review and applicable staging acceptance must pass in either case. -->
- **Repair ownership:** <!-- Named release owner; if a check fails, evidence/current deployed state and next repair action. Production failures use a linked corrective PR; ownership continues through acceptance, cleanup and archival. -->

<!-- See tutor-system/docs/supabase-release-workflow.md for Supabase release-agent procedures.
The PR template is evidence/handoff. The required policy check enforces PR risk approval, not Production acceptance. -->
