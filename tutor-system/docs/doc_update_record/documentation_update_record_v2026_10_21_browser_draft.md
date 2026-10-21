# Cyberbullying browser-draft simplification

Intent: record implementation and release evidence for final_plan.md amendment R13.

Updated: 2026-10-21. Starting commit: `da87b36`. Integrated release: `9c7364c`. Release owner: Codex /root. Batch: `cyberbullying-browser-draft`.

Status: production verified. All selected staging and production journeys, state checks and fixture cleanup passed. R13 acceptance is closed.

## Scope and acceptance

Replace persisted Cyberbullying proposals with browser-held original/edited text, character and Guard values. Generation reads authorized saved context without writes. Shared reviewed send atomically publishes one message and feedback. Rejection, replacement and regeneration record the existing phishing actions without publication. Retire proposal storage/operations and conversation revisions through a forward migration; preserve existing published messages, feedback and historical identifiers/provenance.

Changed factors: draft persistence, review payload, review action classification and coordinated client contract. Prompt, role strategy, model, learner targets and analysis remain unchanged.

Local acceptance: focused frontend/Edge tests; fresh hosted-baseline SQL Red/Green covering preservation, room/profile/learner scope, malformed metadata, atomic rollback, actual-role maintenance/stale-client gates and inherited send behavior; TypeScript and production build. Mypy is inapplicable to this TypeScript/SQL change.

Staging and production acceptance: complete Cyberbullying learner/tutor/observer review, regeneration, rejection, replacement, reload/discard, character publication, rating/export and Guard journey; ordinary phishing tutor-response and Guard checks; affected assessment review/delivery regression. Record provider input/output, persisted state, exact artifacts and cleanup. SQL precedes dependent Edge/frontend under the write gate. Stale callers must reload. Integrate into `no_sign_up` and compare exact staging artifacts before production.

Dependencies owned by this release owner: live shared send/feedback tables and Guard replay; ai-api; assessment-api contract header only; frontend; existing browser harness and pinned assets. Capture exact hashes before release.

## Baseline

Production inspected directly through Supabase MCP: existing begin/finish/review functions and proposal-dependent shared send confirmed; zero proposal rows; gate open with `cyberbullying-v1`. MCP is read-only and bound to production. Project-specific staging inspection and mutations therefore require the configured Management API fallback. Live catalog and restorable snapshots are prerequisites before hosted mutation.

## Local validation

Tool versions: Node v22.12.0 for explicit Node commands, npm 11.5.2, Deno 2.9.7 (TypeScript 6.0.3), PostgreSQL client 17.11. npm's CRA child process resolved the installed Homebrew Node executable; hosted CI independently uses Node 22/npm 10.9.2.

Fresh production export: `/Users/admin/.transfer-assessment-pg17/runs/baseline.8R4Dj3ya/` (application dump, password-free role export and hash manifest). External schemas restored from the previously inspected dependency archive. The fresh restored baseline `cyberbullying_browser_draft_baseline_20261021` matches all ten catalog sections after canonical ACL ordering. Effective memberships match; their local grantor is `local_bootstrap` instead of `supabase_admin`, as in the earlier validated cluster. Database owner/ACL/settings match the inspected production values. Staging application objects/functions/permissions match production; inherited role settings differ only in authenticator preload libraries and the admin statement timeout.

`scripts/database/disposable-database.js --template cyberbullying_browser_draft_baseline_20261021 -- node tutor-system/scripts/database/browser-draft.integration.test.js` passed. Owned scenario `agent_scenario_ed71e416b7e7f2e15e1cc954` was cleaned. Its record proves the missing-behavior Red, exact migration Green, both SQL suites, permission/gate checks, transaction rollback and existing-data hashes. Concurrent independent sends serialize and each produce one message/review, matching ordinary phishing submission semantics. Gate installation waits for an in-flight write and blocks the next application write. Evidence: `tutor-system/output/browser-draft/local-agent_scenario_ed71e416b7e7f2e15e1cc954.json` and `/Users/admin/.transfer-assessment-pg17/runs/scenario-heCgaI/lease.json`.

The initial SQL candidate had a CASE-expression syntax error, then an ambiguous alias; both were corrected before the fresh disposable Red/Green run. Neither was applied remotely.

Frontend: nine affected suites passed 57 tests; two export suites initially lacked environment settings and passed all 20 tests with inert test URL/key. After adding service metadata cases, the three changed suites passed 16 tests. These overlapping runs cover 79 distinct tests in 11 suites. Reports: `output/browser-draft/jest*.json`.

Edge: `deno test --sloppy-imports --allow-env --allow-net --allow-run` passed all 59 ai-api/assessment-api tests. The initial command lacked Deno run permission for the existing adapter typecheck; the complete rerun passed. Browser harness: 20 Node tests passed.

TypeScript reports 442 existing test diagnostics in both candidate and starting implementation, with zero runtime-source diagnostics. Normal production build passes with existing lint warnings. `CI=true` treats those inherited warnings as errors and fails; the normal build and explicit runtime typecheck passed. No Python changes; mypy is inapplicable.

Candidate ai-api bundle-only validation passed without changing staging v6. Source manifest hash: `3731b62f5357622305a65e5ce5e016ff35e16bd394ff13fbb46015911d096661`. SQL SHA-256: `04185e7eca1a2d5bde3404e65c63b8eab43c68b40c36ef4e268b4e91ba0ecb25`.

## Staging deployment and acceptance

Candidate runtime commit: `ee6c0c3`. Staging lease: `output/browser-draft/staging-lease/coordination-lease.json`. Starting deployed assessment-api v74 and production v16 both matched baseline `da87b36` source. Added `scripts/verify-edge-source.js` to retrieve deployed bundles and compare their embedded original sources with a local/committed artifact.

Staging migration and live SQL suite passed through the project-specific Management API. The migration's published message/review preservation assertions passed. Gate reopened with required contract `cyberbullying-v2`. Missing/outdated/version 1 headers fail direct REST writes and both Edge entry points; a no-row version 2 REST write succeeds. Evidence: `output/browser-draft/staging-{gate,migration,sql-tests,reopen}.json` and `client-contract-staging.json`.

Staging ai-api v7 (bundle `3bd3415490bed08a5992b2fff8db135b897bd1f02c45f5fd249de3bb1f4ab519`) and assessment-api v75 (bundle `c2d1c3ef1d0127853c2048dff006101e4a371eab474b9e5a50282f24f5bd6347`) are deployed. All embedded runtime source files match the candidate exactly: three ai-api files and eleven assessment-api files. Deployment input manifest for assessment-api, including type dependencies: `3abb5e5d3c62a4a61cb1f5563f792c7acf69ee35206ecf0ac55eef3920a6369f`.

Staging browser acceptance so far (each fixture cleanup passed):

- `staging-template-20261021215443-d042492f`: complete Cyberbullying journey, including browser reload/discard, ignored replacement, modified regeneration, rejected review, original/final text/character publication, tutor/message linkage, observer/rating/export and Guard deferral/replay.
- `staging-template-20261021215557-b7a5cd80`: ordinary phishing tutor-response and persisted review.
- `staging-template-20261021215641-aa0ab92b`: phishing Guard entry/recovery and review.
- `staging-template-20261021215736-c4f20371`: assessment-answer pass, retry/failure, terminal recovery and the remaining affected lifecycle checks; all four fixture uses cleaned.

Initial multi-workflow CLI invocation was rejected before fixtures; the runner accepts one selected workflow per invocation. Remaining selected journeys run serially under the owned lease.

Quick Adjust persistence/regeneration regression also passes (three tests), bringing focused coverage to 82 distinct tests in 12 suites.

Explicit production URL/anon key and `REACT_APP_ENVIRONMENT=production` produce local validation build `main.563f0c22.js`, SHA-256 `e915f13760c34c7e64cc62daaafa74106e7a7e10315b11b5bf55785808f2b08f`. The earlier build left that environment variable unset and produced a different bundle; its production/debug selector still chose production. Render deployment provenance uses the integrated commit and exact source-map comparison below. Frozen manifest: `output/browser-draft/release-manifest.json` (candidate `ee6c0c3`, 286 source/build artifacts).

The first full assessment-delivery run, `staging-template-20261021215937-923327cd`, completed three cycles then rejected two provider outputs. Deterministic replay of its saved responses found an altered target UUID on attempt 1 and a three-sentence stem on attempt 2. The unchanged baseline validator correctly rejects both. Inputs, outputs and provider metadata remain beside the report; fixture cleanup passed. No prompt, parser, model or configuration was changed to obtain a retry.

The documentation/verification-helper commit advanced HEAD to `23d92cc`; a retry with the old candidate lease failed before fixtures (`staging-template-20261021220407-ac123b36`). The old lease was released after cleanup and reacquired for the new commit as `output/browser-draft/staging-lease23/coordination-lease.json`. Its runtime artifacts are byte-identical to tested `ee6c0c3`.

Full retry `staging-template-20261021220435-bf0b7665` passed all five assessment cycles and fixture cleanup. This establishes lifecycle acceptance while retaining the inherited possibility of invalid provider output; it does not claim that the intermittent provider failure was eliminated. All five selected staging journeys and cleanup passed. Consolidated evidence: `output/browser-draft/staging-acceptance.json`.

## Integration

PR #13 passed all protected checks: isolation-harness, frontend-jest and frontend-build. It merged into `no_sign_up` as `9c7364c5d84fdeceda48d53a0dc1990a65f1cb6c`. Exact source comparison with the staged candidate passed before production mutation. Root `no_sign_up` and this worktree were fast-forwarded without changing unrelated user files. The frozen manifest records the integrated release commit.

## Production deployment

Fresh pre-release backup: `/Users/admin/.transfer-assessment-pg17/runs/baseline.KX6j9RAh/`. Production MCP reinspection confirmed the original four proposal/send function hashes, zero proposals and the version 1 gate before integration. Production lease: `output/browser-draft/production-lease/coordination-lease.json`.

The gate closed at 22:10:13 UTC. The exact SQL and live browser-draft SQL suite passed; published message/review count and hash assertions passed. Both environments record migration history version `20261021215300`, name `cyberbullying_browser_draft`, retaining the exact SQL statements. Source artifact identity remains `20261021010000_cyberbullying_browser_draft.sql`, SHA-256 `04185e7eca1a2d5bde3404e65c63b8eab43c68b40c36ef4e268b4e91ba0ecb25`.

Production ai-api v5 (bundle `fb06f78eec921db96331338dff404b7f02938e99503c49fd2c03ad21383c3150`) and assessment-api v17 (bundle `5788550140d9e060727ad194baeaedf624a35c3c375a430f17650769fa1d7077`) have the same source manifests as staging v7/v75. Retrieved embedded original sources match integrated commit `9c7364c` exactly.

Render deployment `dep-dbcjg9jncjis73au34p0` is live from that integrated commit. Initial canonical HTML still referenced the previous cached asset briefly after Render reported live; the gate stayed closed. Subsequent canonical requests serve `main.37659f38.js`, SHA-256 `f68cd77c1388e041839e07d4d63258ccbca07d1df209247ad56492a670c35fe3`. Render's compiled bytes differ from the local build; all 74 embedded first-party frontend sources match the integrated release exactly, including the draft, review, Guard and Supabase client modules. Evidence: `production-frontend-initial-observation.json`, `production-frontend.json` and `production-frontend-source.json` under `output/browser-draft/`.

The gate reopened at 22:12:02 UTC, within two minutes, after schema/Edge/frontend verification. Direct database writes and both Edge entry points reject missing/outdated/version 1 contracts; version 2 no-row writes succeed. Live production browser acceptance ran against `https://phishingtrainingprogram.onrender.com`.

## Production acceptance

All selected journeys passed, each with fixture cleanup:

- `production-template-20261021221211-f20a3811`: complete Cyberbullying journey, browser discard/reload, shared ignored/modified/rejected feedback, original/final publication metadata, ratings, observer/export and Guard replay.
- `production-template-20261021221320-3b532b42`: ordinary phishing tutor generation and reviewed send.
- `production-template-20261021221408-69a59e80`: shared phishing Guard entry/recovery and review.
- `production-template-20261021221549-c9ea2860`: assessment-answer pass, retry/failure and terminal recovery; all four fixture uses cleaned.
- `production-template-20261021221818-b3abfd15`: full assessment-delivery journey, five completed cycles and cleanup.

Consolidated production evidence: `output/browser-draft/production-acceptance.json`. The integrated `no_sign_up` CI run `39684431342` also passed all three required jobs. Production MCP final state confirms the gate open for version 2, no proposal table or dedicated proposal operations, context RPC inaccessible to anon, and the exact recorded SQL hash in migration history.

The exact SQL is archived under `supabase/archived_migrations/20261021010000_cyberbullying_browser_draft.sql`; there are no pending migrations. The integration driver now uses that archived path. Both project leases were released after accepted checks and cleanup. The temporary staging app and its CRA child process were stopped; unrelated local servers were preserved. No production acceptance criteria remain open.

The archived artifact's SHA-256 is unchanged. The complete disposable Red/Green, permission, concurrency and drain suite passed again using the archived path in scenario `agent_scenario_c21c77b9f2e9d5f0878c5389`; cleanup passed. Evidence: `output/browser-draft/local-agent_scenario_c21c77b9f2e9d5f0878c5389.json` and `/Users/admin/.transfer-assessment-pg17/runs/scenario-EU7Qkn/lease.json`.
