# Final assessment release

Intent: record the SQL, assessment-api deployment, and live browser verification for the option-gate and multi-target assessment journey.

Updated: 2026-10-14. Source baseline commit: `83690fe`; final browser baseline: `88b3ccd`.
Status: development, staging deployment/verification, and production deployment/verification complete at 23:06 UTC.

## Release artifacts and baseline

Released SQL: [20261014000000_final_assessment_after_understanding.sql](../../supabase/archived_migrations/20261014000000_final_assessment_after_understanding.sql), archived after both live journeys and final cleanup checks passed.
Exact release SQL SHA-256: `f1ea14f9aff18cf062293bb7666a25badbe48f71fd2f51e0758a6d7852083d6d`.
The migration includes the inherited final-understanding policy and analysis-flag removal. Release inspection additionally found four staging and two production questions still open under the old Partial policy. The migration cancels incompatible open questions in both private state and public projection, preserving rows, attempts, completed results and progress. Both projects had zero deferred Guard events.

Evidence directory: `/Users/admin/.transfer-assessment-pg17/runs/final_assessment/20261014_release/`. Browser evidence remains under repository `tmp/browser_demo_runs/` with complete requests/results and screenshots.

Fresh production export on 2026-10-14: `phishingtutor.dump`, SHA-256 `916572f81fb246ec53aa7238f1fc7887fc3bcc780513e29ecfeb60f241c5a770`; role export SHA-256 `d86686191198c549c079ceb1bf668a74f4682bf958cb737d3798ab80339b721c`.

Local restored database `final_release_baseline_20261014` matches production database ACLs/settings, required role attributes/memberships, schema owners/ACLs, function definitions/owners/ACLs, relation/column/constraint/index/trigger definitions, policies/default grants, relevant row counts and open lifecycle identities. Dropped-column ordinal gaps and ACL ordering were normalized without removing semantic fields. Local PostgreSQL 17.11 and hosted 17.4 use the same tested SQL/PLpgSQL features; uuid-ossp and pgcrypto versions match. Hosted GraphQL/statistics/vault extensions are outside this migration's dependencies. Hosted application checks remain required.

Staging and production function definitions and named columns match. Differences are confined to unchanged legacy RPC ACLs, platform role membership/preload settings, and staging database CREATE grants to platform admins. Current affected RPC permissions match. Management API write executor is `postgres`; local migration/tests use the source-equivalent non-superuser `postgres` role with BYPASSRLS. The migration owns its transaction.

## Local validation

- Original final-policy regression fails against the fresh unmodified baseline: initial Partial evidence incorrectly makes assessment due.
- New existing-row release regression fails against the inherited candidate: old open questions remain ungradable.
- Corrected candidate passes existing-row cancellation, history/progress preservation, and idempotent reapplication on `final_release_green_20261014` cloned from the fresh baseline. Both scenario databases had source database ACLs/settings reapplied.
- All 17 final-assessment lifecycle scenarios and anon/authenticated permission checks pass. Status-event and dialogue-history SQL suites pass; their fixtures roll back.
- Deno Edge/domain integration: initially 38 tests passed; 39 pass after the live format-repair regression fix, including Edge module type checking.
- Jest progress/orchestrator/BDD: 68 tests passed.
- Staging bundle-only check passed before deployment.
- Final frontend regression: 199 tests in 15 suites passed; browser harness: 20 checks passed. Final Edge handler rerun: 34 passed, including its subprocess type check. The earlier complete Edge/domain run passed 39 tests. Whole-repository TypeScript retains unrelated baseline diagnostics.

Local logs and catalogs: `red-final-policy.log`, `red-legacy-cleanup.log`, `green-sql.log`, `local-before.json`, `local-after.json`, and hosted before/after catalogs in the evidence directory. Local setup/query/compare helpers are retained under `tmp/final-assessment-release-20261014/`.

## Live findings and corrections

- Run `20261014223155-aa1ee377` completed the first assessment but timed out at consecutive rating prompts before the next topic. The browser send helper now handles successive prompts within its timeout. Chromium regression cases cover zero, one, and two prompts with exactly one persisted send.
- Run `20261014223548-e42cae7a` assumed URL Domain Check must be selected first, while several accepted targets were ready and a higher-priority target was legitimately selected. The full-inventory journey now follows the ready queue, still requiring URL Domain Check and Official Support to complete, with terminal feedback for every additional assessment.
- Run `20261014223947-c3384cca` recorded two invalid provider attempts: a three-sentence stem violated the existing two-sentence bound. The single format-repair attempt now includes the actual validator error as structured feedback. Validation limits, attempt count, model settings and grading remain unchanged. A new handler regression failed before that change and passes afterward; it checks feedback transport and invalid/valid audit outcomes rather than model wording.
- Answer-fixture runs exposed stale test data, a duplicate manually inserted session, and cleanup racing realtime session recreation. Saved the stale dedicated-fixture rows before bounded cleanup; the fixture now waits for the browser-created learner session, and the runner detaches both room pages before cleanup.
- Staging answer run `20261014224401-e4f54ae1` passes correct-first and retry/terminal-failure paths, selected-option bindings, active/retry/terminal reload gates, and cleanup of both rooms.
- Staging delivery run `20261014224444-4e53e17a` passes with the full 18-target inventory and seven completed assessments, including URL Domain Check and Official Support. Each assessment has an authoritative pass, correctly bound option answer, terminal feedback, closed lifecycle, target-local progress and gate/reload evidence. Cleanup passed. Run source commit is `88b3ccd`; the inherited chat UI fixes do not change the tested backend source manifest.
- Production pre-application catalogs exactly match the captured baseline, including counts and open questions. SQL application preserves all relevant row counts and cancels only the two incompatible open questions. Hosted lifecycle, status, and dialogue suites pass; all ten changed functions match the locally tested result.
- Production answer run `20261014225100-d3bb89a7` passes both paths and cleanup. Initial delivery run `20261014225059-b58321be` rejected stale dedicated-fixture state from an older run. Preserved its five messages/session/mode metadata before bounded cleanup; subsequent reruns and the final passing result are recorded below.
- Chrome DevTools manually verified the original learner room after release: the historical assessment is cancelled, all four option controls are disabled, the composer and all 24 Reply buttons are enabled, and no answer was submitted. MCP confirms attempt_count remains zero and public/private closure timestamps agree. DOM evidence: `tmp/final-assessment-release-20261014/original-room-after.json`.
- Production delivery run `20261014225205-bf3d5b13` completed six assessments but failed while writing a full-page PNG with `ENOSPC`; cleanup passed. The shared APFS volume had approximately 184 MiB available with 32 GiB used by VM. Stopped the completed staging dev server and changed future workflow screenshots to full-page JPEG quality 75; retained prior evidence. A complete production rerun is required, rather than treating the partial run as passing.
- Final staging policy/fixture verification passes under the Management API `postgres` executor. The initial read-only inspection was denied execution of the private helper, as expected from its service-only ACL; that failed inspection is retained separately.
- Production runs `20261014225642-94934670` and `20261014225745-d7b45b62` failed closed with `AI_OUTPUT_INVALID` on learner-message analysis; cleanup passed. Those runs did not preserve the raw analysis-provider output, so the precise invalid field is unknown. Added RPC analysis-context capture before assertions and cleanup for future diagnosis; analysis parsing and evidence validation remain unchanged. A later passing run establishes this release's workflow acceptance, not elimination of intermittent model-format failures or semantic benchmark acceptance.
- Production delivery run `20261014230113-b2b8172e` passed from 23:01:13 to 23:05:57 UTC: 18 targets, eight distinct passed assessments, all terminal feedback, bound attempts, active/retry/terminal gates and reload checks, and cleanup. The assessed targets were URL Domain Check, Platform Verification, Professional Design, Suspicious URL, Generic Source, Panic-Inducing Language, No Specific Account Information, and Official Support. URL Domain Check and Official Support each include actual Partial tutoring before later full learner evidence and assessment.
- At 23:06 UTC, final verification returned HTTP 201 on both projects: final-policy helper present, incompatible open questions zero, helper execution restricted to service roles, and all three dedicated assessment fixtures empty. Evidence: `staging-completion-verification.json` and `production-completion-verification.json`. Production MCP independently confirms assessment-api version 10 and the original room's cancelled assessment with attempt_count zero.

The repair changes the provider's second-attempt input only; all raw requests/responses and failed runs are retained. Backend semantic-classification benchmark acceptance is not inferred from browser workflow success.

## Hosted delivery

| Environment | SQL | Edge | Live workflow |
| --- | --- | --- | --- |
| Staging `ciubrzggdqesgvfkpolj` | Applied with HTTP 201; lifecycle, status, and dialogue suites return HTTP 201; all ten affected function definitions/owners/ACLs match the tested local result; four incompatible old open questions cancelled, row counts unchanged at application | assessment-api 52 → 53 initially, then 54 for format-repair feedback; final source manifest `5c462a588752c9d0cad27ea13de736833c7b3075def4c2d2c2bb45c8cfcd05ab`; final bundle `fe60b6db17eb07a1aff618036f357482fed84b80068559126059a49ee7a667ff` | Multi-target delivery and answer/retry/failure passed; cleanup passed |
| Production `zgbufaxooqxeabewktzd` | Applied with HTTP 201 at 22:50 UTC after staging passed; hosted SQL suites pass and changed functions match local; two incompatible open questions cancelled, row counts unchanged at application | assessment-api 9 → 10; same source manifest as staging; bundle `d56830586e0996ce4731f6420c1709ae44ae47f690a11b9c617734867061d888` | Answer/retry/failure and eight-assessment delivery passed; cleanup and final verification passed |

SQL application used the explicit-project Management API because the configured Supabase MCP targets production with a read-only role. No migration-history entry is claimed from raw SQL application. Both environments received the same tested SQL and Edge source. The archived SQL hash matches the deployed artifact; the pending migration directory is empty.

Browser evidence uses Playwright Chromium against local CRA pages connected to each real hosted backend and provider. Chrome DevTools manually checked the original production-backed room. No public frontend hosting release is claimed by these checks.

Reproduction commands from the repository root (helpers load credentials in memory): `rtk proxy node tmp/final-assessment-release-20261014/browser.mjs staging assessment-delivery http://localhost:3101` and the corresponding production command with `production` and port `3100`; substitute `assessment-answer` for both answer paths. Frontend and database setup prerequisites are in [browser-e2e-testing.md](../browser-e2e-testing.md) and [supabase-release-workflow.md](../supabase-release-workflow.md). Durable harness commands from `tutor-system/`: `rtk proxy node --test scripts/browser-e2e.test.js` and `rtk proxy /Users/admin/.deno/bin/deno test --allow-env --allow-net --allow-run supabase/functions/assessment-api/index.test.ts`.
