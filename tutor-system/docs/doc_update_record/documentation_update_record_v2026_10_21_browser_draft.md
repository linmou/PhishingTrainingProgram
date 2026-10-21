# Cyberbullying browser-draft simplification

Intent: record implementation and release evidence for final_plan.md amendment R13.

Updated: 2026-10-21. Starting commit: `da87b36`. Release owner: current Codex session in `feat/cyberbullying-practise`. Batch: `cyberbullying-browser-draft`.

Status: implementation in progress. Production acceptance remains open.

## Scope and acceptance

Replace persisted Cyberbullying proposals with browser-held original/edited text, character and Guard values. Generation reads authorized saved context without writes. Shared reviewed send atomically publishes one message and feedback. Rejection, replacement and regeneration record the existing phishing actions without publication. Retire proposal storage/operations and conversation revisions through a forward migration; preserve existing published messages, feedback and historical identifiers/provenance.

Changed factors: draft persistence, review payload, review action classification and coordinated client contract. Prompt, role strategy, model, learner targets and analysis remain unchanged.

Local acceptance: focused frontend/Edge tests; fresh hosted-baseline SQL Red/Green covering preservation, room/profile/learner scope, malformed metadata, atomic rollback, actual-role maintenance/stale-client gates and inherited send behavior; TypeScript and production build. Mypy is inapplicable to this TypeScript/SQL change.

Staging and production acceptance: complete Cyberbullying learner/tutor/observer review, regeneration, rejection, replacement, reload/discard, character publication, rating/export and Guard journey; ordinary phishing tutor-response and Guard checks; affected assessment review/delivery regression. Record provider input/output, persisted state, exact artifacts and cleanup. SQL precedes dependent Edge/frontend under the write gate. Stale callers must reload. Integrate into `no_sign_up` and compare exact staging artifacts before production.

Dependencies owned by this release owner: live shared send/feedback tables and Guard replay; ai-api; assessment-api contract header only; frontend; existing browser harness and pinned assets. Capture exact hashes before release.

## Baseline

Production inspected directly through Supabase MCP: existing begin/finish/review functions and proposal-dependent shared send confirmed; zero proposal rows; gate open with `cyberbullying-v1`. MCP is read-only and bound to production. Project-specific staging inspection and mutations therefore require the configured Management API fallback. Live catalog and restorable snapshots are prerequisites before hosted mutation.

## Local validation

Fresh production export: `/Users/admin/.transfer-assessment-pg17/runs/baseline.8R4Dj3ya/` (application dump, password-free role export and hash manifest). External schemas restored from the previously inspected dependency archive. The fresh restored baseline `cyberbullying_browser_draft_baseline_20261021` matches all ten catalog sections after canonical ACL ordering. Effective memberships match; their local grantor is `local_bootstrap` instead of `supabase_admin`, as in the earlier validated cluster. Database owner/ACL/settings match the inspected production values. Staging application objects/functions/permissions match production; inherited role settings differ only in authenticator preload libraries and the admin statement timeout.

`scripts/database/disposable-database.js --template cyberbullying_browser_draft_baseline_20261021 -- node tutor-system/scripts/database/browser-draft.integration.test.js` passed. Owned scenario `agent_scenario_ed71e416b7e7f2e15e1cc954` was cleaned. Its record proves the missing-behavior Red, exact migration Green, both SQL suites, permission/gate checks, transaction rollback and existing-data hashes. Concurrent independent sends serialize and each produce one message/review, matching ordinary phishing submission semantics. Gate installation waits for an in-flight write and blocks the next application write. Evidence: `tutor-system/output/browser-draft/local-agent_scenario_ed71e416b7e7f2e15e1cc954.json` and `/Users/admin/.transfer-assessment-pg17/runs/scenario-heCgaI/lease.json`.

The initial SQL candidate had a CASE-expression syntax error, then an ambiguous alias; both were corrected before the fresh disposable Red/Green run. Neither was applied remotely.

Frontend: nine affected suites passed 57 tests; two export suites initially lacked environment settings and passed all 20 tests with inert test URL/key. After adding service metadata cases, the three changed suites passed 16 tests. These overlapping runs cover 79 distinct tests in 11 suites. Reports: `output/browser-draft/jest*.json`.

Edge: `deno test --sloppy-imports --allow-env --allow-net --allow-run` passed all 59 ai-api/assessment-api tests. The initial command lacked Deno run permission for the existing adapter typecheck; the complete rerun passed. Browser harness: 20 Node tests passed.

TypeScript reports 442 existing test diagnostics in both candidate and starting implementation, with zero runtime-source diagnostics. Normal production build passes with existing lint warnings. `CI=true` treats those inherited warnings as errors and fails; the normal build and explicit runtime typecheck passed. No Python changes; mypy is inapplicable.

Candidate ai-api bundle-only validation passed without changing staging v6. Source manifest hash: `3731b62f5357622305a65e5ce5e016ff35e16bd394ff13fbb46015911d096661`. SQL SHA-256: `04185e7eca1a2d5bde3404e65c63b8eab43c68b40c36ef4e268b4e91ba0ecb25`.

## Release

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

Explicit Render-matching production build inputs (`REACT_APP_ENVIRONMENT=production` and matching production URL/anon key) produce `main.563f0c22.js`, SHA-256 `e915f13760c34c7e64cc62daaafa74106e7a7e10315b11b5bf55785808f2b08f`. The earlier build left that environment variable unset and produced a different bundle; its production/debug selector still chose production, but the explicit build is the promotion artifact. Frozen manifest: `output/browser-draft/release-manifest.json` (candidate `ee6c0c3`, 286 source/build artifacts). Integration and production acceptance remain open.
