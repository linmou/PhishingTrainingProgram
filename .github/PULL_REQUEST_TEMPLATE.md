## Summary
- **Issue / requirement:** <!-- Link the issue or describe the requested change -->
- **Changed behavior and scope:** <!-- Brief explanation; identify SQL, Edge, frontend, or docs-only -->
- **Risk / reviewer attention:** <!-- Affected permissions, data, grading, contracts, or failure modes; N/A with reason -->

## Verification
- **Local verification:** <!-- Commands and observed outcomes, or N/A with reason -->
- **GitHub CI:** The [Verify PR (no hosted state)](../../.github/workflows/verify-pr.yml) workflow automatically reports `isolation-harness`, `frontend-jest`, and `frontend-build` in the PR **Checks** tab. Check the live statuses; do not self-certify a pass here.
- **Code review:** <!-- Pending / reviewer or tool / findings and disposition. CI above does not perform AI code review. -->
- **Staging acceptance:** <!-- Not applicable / Pending / Verified; include tested commit, project, evidence link when applicable -->
- **Unverified behavior or blockers:** <!-- None or specifics -->

## Release handoff
- **Change/release type:** <!-- Docs/tests only | frontend | SQL/RLS | Edge | combined -->
- **Batch / release owner:** <!-- N/A or link to the dated release record -->
- **Candidate artifacts and dependencies:** <!-- Commit and SQL/Edge/frontend hashes when required; otherwise N/A -->
- **Production compatibility and recovery:** <!-- Render auto-deploys from no_sign_up; note compatibility, rollout ordering and rollback/forward fix, or N/A -->
- **Merge authorization:** **Pending** until the owner reviews the current PR head, required CI/review results, and applicable Staging evidence. Agents must not merge automatically.

<!-- See tutor-system/docs/supabase-release-workflow.md for Supabase release-agent procedures.
The PR template is evidence/handoff, not an automated CI result or Production approval. -->
