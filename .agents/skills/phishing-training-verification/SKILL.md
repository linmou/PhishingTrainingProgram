---
name: phishing-training-verification
description: "Safely verify frontend, Supabase SQL, Edge and browser behavior across concurrent agent worktrees without Docker."
---

# PhishingTrainingProgram Verification

This is a project-local companion skill for agent verification. It does not replace the release requirements in tutor-system/docs/supabase-release-workflow.md or root AGENTS.md. Never use Docker. A PR verification request is not authorization for a staging or production deployment.

## Feature map

| Change | Test selection | Resource requirement |
| --- | --- | --- |
| Docs or harness | Static checks and focused Node tests | No database |
| React UI | Focused Jest/RTL and build, selected browser journey if authorized | Optional shared E2E fixture lock |
| Edge, AI or provider | Deterministic contract/failure tests and affected live staging journey if authorized | Shared staging code: exclusive release owner |
| SQL / RPC / RLS | Fresh hosted snapshot, role/ACL parity, Red/Green migration tests and unaffected assertions | Unique disposable DB in existing PG validation cluster |
| Interacting features | Tests on the actual combined PR/migration artifacts | Shared staging verification serialized as needed |

## Doctor

Read root AGENTS.md, tutor-system/AGENTS.md, the release workflow and browser-e2e-testing.md before acting. Record the intended endpoint (local/staging/production), exact worktree, commit, changed contracts, verification scope and any shared resources. Never assume the checked-in .env points to staging; it may point to production. If parity requirements or permissions cannot be satisfied, report BLOCKED rather than passing.

## Launch and drive

For cheap concurrent regression, use focused Jest tests. For harness isolation, from repository root run:

    node --test tutor-system/scripts/browser-e2e/fixture-lock.test.js
    node --test scripts/database/export_validation_baseline.test.js

For a migration, obtain a per-run source export without overwriting anyone else's snapshot:

    SNAPSHOT_DIR="$(sh scripts/database/export_validation_baseline.sh)"

Preserve that directory path and SHA256SUMS. An exported dump is not a validated or restorable baseline. Complete the existing documented role/ACL/extension setup, fresh per-run test database, restore, baseline comparison, Red/Green, and cleanup stages before claiming SQL verification.

For authorized live browser E2E, use the documented environment setup and selected workflow. The runner locks fixed test rooms across setup/test/cleanup on the same host. This does not coordinate multiple machines. Use a shared coordinator or separately provisioned fixtures rather than allowing conflicting live tests. Never override a lock.

Only the named release owner may deploy SQL or Edge source to shared staging, and only under the existing serial release gates. PR verification itself never deploys production.

## Evidence and cleanup

Record run ID, commit SHA, source hashes, project ref, test commands and exit statuses, affected behavior, relevant persisted/provider evidence, fixture owner, and cleanup results. Preserve failed results even if a retry passes. Report PASS, FAILED, BLOCKED or NOT RUN per selected check. Stop only processes launched by this run, remove only data owned by this run, and never delete a lock without verifying the original process has ended. Keep credentials and hosted data snapshots outside Git.
