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

Pending staging deployment/acceptance, integration and production acceptance.
