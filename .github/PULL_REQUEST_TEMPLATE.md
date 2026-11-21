<!-- Intent: record PR evidence, risk-based merge authorization and release ownership.
Updated: 2026-10-27. Baseline commit: dec7c27. -->

## Summary
- **Issue / requirement:** <!-- Link the issue or describe the requested change -->
- **Changed behavior and scope:** <!-- Brief explanation; identify SQL, Edge, frontend, or docs-only -->

## Risk assessment and review

- **Risk assessment:** <!-- Describe affected contracts, risks and verification limits. -->
- **Review:** <!-- After CI, record reviewer feedback and disposition when applicable. -->

Review is a separate activity after deterministic CI. Codex reviews, structured risk JSON, authorization issues, signed-commit provenance and human approval are not enforced by a review-policy CI gate. Use appropriate review tools for the change; Codex is optional. Record material risks and unresolved findings for the maintainer's merge decision. Agents must not submit human approval on a person's behalf.

## Verification
- **Local verification:** <!-- Commands and observed outcomes, or N/A with reason -->
- **GitHub CI:** The [Verify PR (no hosted state)](https://github.com/linmou/PhishingTrainingProgram/blob/no_sign_up/.github/workflows/verify-pr.yml) workflow automatically reports `isolation-harness`, `frontend-jest`, and `frontend-build` in the PR **Checks** tab. Check the live statuses; do not self-certify a pass here.
- **Code review:** <!-- Pending / reviewer or tool / findings and disposition. CI above does not perform AI code review. -->
- **Staging acceptance:** <!-- Not applicable / Pending / Verified; include tested commit, project, evidence link when applicable -->
- **Unverified behavior or blockers:** <!-- None or specifics -->

## Release handoff
- **Change/release type:** <!-- Docs/tests only | frontend | SQL/RLS | Edge | combined -->
- **Batch / release owner:** <!-- N/A or link to the dated release record -->
- **Candidate artifacts and dependencies:** <!-- Commit and SQL/Edge/frontend hashes when required; otherwise N/A -->
- **Production compatibility and recovery:** <!-- Render auto-deploys from no_sign_up; note compatibility, rollout ordering and rollback/forward fix, or N/A -->
- **Repair ownership:** <!-- Named release owner; if a check fails, evidence/current deployed state and next repair action. Production failures use a linked corrective PR; ownership continues through acceptance, cleanup and archival. -->

<!-- See tutor-system/docs/supabase-release-workflow.md for Supabase release-agent procedures.
This template guides review and merge decisions; GitHub CI reports test results separately. Production acceptance requires live release verification. -->
