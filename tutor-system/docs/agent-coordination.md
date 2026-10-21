# Shared Staging Coordination

Intent: prevent fixture interference and deployment races across machines while verifying the combined candidate.

Updated: 2026-10-21. Baseline commit: `72f1087`.

## One Owner per Shared Project

`scripts/staging-coordination.js` atomically creates `refs/tags/verification-locks/<project-ref>` in `linmou/PhishingTrainingProgram`. Its annotated tag records a random ownership token, candidate commit, operation, run ID, host fingerprint/PID and Actions run when applicable. All machines contend on the same GitHub reference. It requires authenticated `gh` with repository Contents write access. Missing access or an existing reference blocks the operation before fixture/deployment writes. Locks never expire automatically.

The browser runner retains its same-host lock and also acquires this shared lease through fixture cleanup and browser close. Staging fixture use is serialized across machines. The assessment deployment script, template refresh, transfer demo recorder, behavior evaluation and prompt capture use the same coordinator. An owned lease can be passed to child tools through `PTP_COORDINATION_LEASE`; the remote tag/token, project and exact commit are checked before borrowing. Children verify but never release the parent's lease.

## Deployment Entry Points

The manual deployment workflow takes the shared lease before secrets, SQL seed or Edge writes. Its Actions concurrency group also remains enabled. Contents write permission is confined to that deployment workflow; deterministic PR jobs remain read-only. The workflow retains the lease and uploads its JSON as a `staging-release-<commit>-<run>` artifact. The named release owner downloads the lease and checks out the exact recorded commit, then completes the affected staging acceptance checks under that lease before release. A canceled/failed runner leaves evidence for recovery.

For an ordinary local command, including a reviewed API deployment command:

```sh
rtk proxy node scripts/staging-coordination.js run -- <command> <arguments>
```

For direct Supabase MCP SQL/Edge operations, first claim the project from the same checkout and retain the printed lease path:

```sh
rtk proxy node scripts/staging-coordination.js acquire output/staging-release-<unique-run>
export PTP_COORDINATION_LEASE=<printed-lease-path>
```

Only that release owner may mutate Staging until its acceptance checks finish. Apply the tested SQL before dependent Edge code and preserve the exact artifact versions required by the release workflow. Direct Management API/MCP calls cannot be intercepted by a GitHub reference: every operator must use this protocol, and Staging write credentials must stay with the release owner. A tool with direct write credentials can bypass a cooperative coordinator. This PR does not revoke credentials or change hosted permissions.

## Combined Integration Verification

Commit the entire combined candidate and start the local app against Staging using the browser guide. Supply the same explicit Staging credentials and app URL, then run:

```sh
rtk proxy node scripts/verify-agent-integration.js --workflow=checklist-management
```

Select the affected browser journey using the release scope; the example covers harness/fixture changes. The verifier records the clean Git commit and SHA-256 hashes of tracked frontend, SQL, Edge, dependency and harness artifacts. It rejects multiple pending SQL candidates, runs the combined deterministic harness tests, real disposable-database integration and browser-runner tests, proves remote lock contention, and runs the selected Staging browser workflow under the same lease. Hosted function IDs/versions/timestamps must match before and after. Its evidence includes commands, exit statuses, stdout/stderr, artifact manifest, backend versions and the browser report/cleanup path.

For a deployed batch, set `PTP_COORDINATION_LEASE` to the downloaded release lease before verification; exact-commit validation prevents borrowing it from another candidate. Passing this harness verification does not replace affected behavior/lifecycle tests, source/schema preconditions, frontend required checks or production acceptance. The inherited frontend Jest failures remain a merge blocker tracked in PR #6.

## Release and Recovery

Successful standalone verification releases its own remote reference after cleanup. Browser cleanup/close failures, failed coordinated commands, and uncertain claim responses retain the lease. Preserve failed reports and inspect state before allowing a new owner. A lost claim response may have created the remote reference; its retained tag SHA identifies whether it actually owns the lease.

After verifying the original process/Actions run has stopped, all fixture cleanup passed and the affected staging checks are complete:

```sh
rtk proxy node scripts/staging-coordination.js release <owned-lease.json>
```

Release checks the exact remote tag SHA and token before deletion. Never remove another owner's reference or reclaim by age. If the reference changed, stop and identify its current owner. Production still follows the existing named release owner, exact-artifact promotion and selected acceptance gates.
