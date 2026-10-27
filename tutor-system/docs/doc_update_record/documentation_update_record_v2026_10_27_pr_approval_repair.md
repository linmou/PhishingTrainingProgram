# PR risk approval and release repair

Intent: record the requested separation of PR review, human decisions and automatic release repair ownership.

Updated: 2026-10-27. Implementation baseline: `dec7c27`. Owner: root Codex agent.

The base-branch PR policy assigns deterministic checks to Actions, code review/risk classification to the installed Codex GitHub connector, and fixes/live acceptance to the release agent. A required check validates connector identity, exact head/base/policy, current review result and collaborator approval when risk requires it. Approval-control changes require human review. Ordinary authorized repairs proceed through existing staging/merge/production gates; production failures use corrective PRs and remain owned until acceptance, cleanup and archival, or a concrete recorded blocker.

No Supabase source, schema or runtime configuration changes. Verification covers the decision engine and mocked GitHub integration, including spoofing, stale evidence, revocation, blocking findings and candidate drift. Activation requires this workflow on `no_sign_up`, then adding `pr-approval-policy` to branch protection while retaining existing required checks. The policy-changing PR itself needs human PR review; its final implementation, test and activation evidence belong in the PR handoff. Native connector classification depends on account access/allowance and a successful structured reply; missing output blocks rather than grants approval.
