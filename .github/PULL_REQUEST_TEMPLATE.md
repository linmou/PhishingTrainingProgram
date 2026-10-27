<!-- Intent: record PR evidence, risk-based merge authorization and release ownership.
Updated: 2026-10-27. Baseline commit: dec7c27. -->

## Summary
- **Issue / requirement:** <!-- Link the issue or describe the requested change -->
- **Changed behavior and scope:** <!-- Brief explanation; identify SQL, Edge, frontend, or docs-only -->

## Risk-based merge gate

- **Risk assessment:** <!-- Pending / routine authorized change / human decision required. Explain the affected contracts and decision, and link Codex review evidence for the current candidate. -->
- **Merge authorization:** <!-- Pending / routine path with required checks and review complete / human approval link for the current candidate. -->

Codex on GitHub reviews the actual diff and risk assessment. The coding/release agent fixes findings, maintains evidence and checks authorization before merging. Humans decide material risks on this PR.

Require human approval for new material decisions beyond recorded authorization: product behavior or acceptance changes, security or permission changes, data-loss risk, spending commitments, changes to approval rules, or accepting defects or weaker verification. Uncertain authorization also requires a human decision. A routine fix that restores an agreed contract does not require approval merely because it touches security-related code.

Routine authorized changes may merge automatically after required CI, code review and applicable staging acceptance pass. Human decisions require explicit approval on this PR for the current candidate; agents must not submit that approval on a person's behalf. Reassess after changes affecting risk or evidence. A missing assessment, pending review, unresolved blocking finding or missing required approval prevents merging; a clean code review alone does not establish merge authorization.

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
