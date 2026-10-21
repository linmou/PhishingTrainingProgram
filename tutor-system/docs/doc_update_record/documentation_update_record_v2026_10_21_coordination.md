# Cross-machine coordination and combined verification

Intent: record shared-project lease coverage and evidence for the combined candidate.

Date: 2026-10-21. Baseline: `72f1087`, stacked on allocator PR #7 and CI PR #6.

Current status: the former client/Jest blockers below are resolved on the refreshed candidate. See the [coordination refresh record](documentation_update_record_v2026_10_21_coordination_refresh.md) for passing combined Staging acceptance and current CI. The original failures and interference evidence below are retained.

Added an atomic GitHub-reference coordinator shared by browser fixtures and Staging deployment entrypoints. Existing fixed fixtures are serialized across machines. The manual deployment workflow retains its lease through the release owner's acceptance checks and exports it as an artifact. Direct MCP/API operators must acquire the same lease; possession of direct write credentials remains a cooperative-protocol boundary. No hosted runtime/schema behavior changes are part of this PR.

Root AGENTS.md now explicitly requires the lease for Staging SQL, Edge, secret and fixture mutations, including direct MCP/Management API actions. The release owner holds it through acceptance and children must use the same candidate commit.

The combined verifier hashes the committed frontend/SQL/Edge/dependency/harness artifact set, runs offline harness tests and real database allocation integration, tests shared-reference contention, and runs one affected Staging browser workflow while checking that hosted function versions remain stable. Matching release/lifecycle and production checks remain governed by the existing policy.

Validation of candidate `dae6792b712194c038044684cb52181000f62015` on 2026-10-21:

- 13 combined offline coordinator/allocator/export/fixture-lock tests: PASS.
- 5 real PostgreSQL integration tests: PASS, including parallel allocation and hard-kill recovery.
- 20 browser-runner tests: PASS.
- Real GitHub-reference contention probe: PASS. A second independent client could not claim the held Staging reference; the original SHA/token remained valid.
- Eight modified scripts passed Node syntax checks; both Actions workflows parsed successfully.
- Live Staging `checklist-management`: FAILED before any fixture room was touched. Browser login timed out; a browser diagnostic identified HTTP 500 / SQLSTATE 55000, `CLIENT_RELOAD_REQUIRED`, on the existing tutor's user update. A project-scoped read-only Supabase MCP inspection confirmed `private.check_practice_write_gate` requires the configured `x-practice-contract` header. The matching `cyberbullying-v1` client header exists in the uncommitted `cyberbullying-practise` worktree, not this committed candidate. This is an inherited Staging cutover dependency.

Evidence: `output/coordination/0bc165e5-b00d-4fa9-8d75-553aae20aff9/integration-report.json` and its stdout/stderr logs. Browser evidence: `tmp/browser_demo_runs/staging-template-20261021092958-6df54591/report.json` (zero user IDs and room IDs registered, browser closed, local lock released). Browser console diagnostic: `output/playwright/staging-login-diagnostic.log`. The combined runtime was Node v22.23.3; before-test Staging function versions were `ai-api` v5 and `assessment-api` v65. The failure and original artifacts are retained.

After confirming the original verifier PID had stopped and no room cleanup was needed, released only its remote tag `80146c0e222c119561e1bfe099cac514b9a344d2`. GitHub returned 404 for that reference afterward, confirming cleanup. No Staging guard/configuration was changed. Report persistence now uses a unique subdirectory for every attempt, including borrowed release leases, and saves each completed stage before advancing.

A later inventory read also showed `assessment-api` v66 (updated at 2026-10-21 09:30:34.375 UTC), replacing v65 **during the held lease**; `ai-api` remained v5. The Staging gate now reports `closed=false`, `required_contract=cyberbullying-v1`, changed at 09:31:03.260161 UTC. Raw evidence is in `output/playwright/staging-functions-after-failure.json` and `staging-guard-inspection.json`. The separate cutover has not adopted this unmerged coordination protocol, so its raw deployment bypassed the new cooperative lease. The verifier now captures the ending function inventory on failures as well as successes and records backend stability explicitly.

**Open acceptance:** the `cyberbullying-practise` cutover owner must commit the compatible frontend and identify the intended Staging artifacts. Form a clean combined candidate containing that dependency and rerun the selected Staging journey under the shared lease. Source/schema preconditions changed since PR #4's successful 08:53–08:54 UTC smoke; that earlier result cannot establish acceptance for this new cutover. Full frontend Jest also remains blocked by the inherited baseline regressions, as explicitly kept outside #5 by the user. No production release is required for these harness-only changes.
