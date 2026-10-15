# In-room assessment default-on release

Intent: record validation and staged release of the shared creation default used by every room template.

Date: 2026-10-14 America/New_York. Source baseline commit: `28706fe82eeda00c6cdac639fc2cd2195e0fdd07`. Hosted timestamps use UTC, 2026-10-15.

## Changed behavior and acceptance

Set `public.rooms.transfer_learning_enabled` default to `true`. Both normal and Test Rooms template creation omit this field and inherit the database default, as do future templates and room creation from scratch. Explicit false values and existing room choices retain their meaning.

Verification scope is a database-default migration: fresh-baseline Red/Green under actual roles, all-template insert scenarios, preservation of existing data and explicit opt-outs, unchanged permissions, atomic rollback, hosted assertions, and the affected template-create/settings/reload browser interaction. AI prompts, model requests and assessment scheduling are unchanged; existing lifecycle release evidence remains applicable to those dependencies.

Release acceptance: apply identical SQL to staging then production; verify saved default-on rooms and the checked settings control on each project's frontend; clean generated browser and SQL fixtures; archive exact SQL after both pass.

## Baseline and artifacts

| Project | Reference | PostgreSQL | Templates | Before default | Existing rooms |
| --- | --- | --- | --- | --- | --- |
| Staging | `ciubrzggdqesgvfkpolj` | 17.6 | 2 | false, NOT NULL | 48: 26 on, 22 off |
| Production | `zgbufaxooqxeabewktzd` | 17.4 | 19 | false, NOT NULL | 62: 10 on, 52 off |

Production inspection uses Supabase MCP. MCP is bound to the read-only production connection; the authenticated Management API targets staging and applies SQL with explicit project refs under `postgres`.

Private run directory: `/Users/admin/.transfer-assessment-pg17/runs/room_assessment_default_on/20261014/`. Fresh configured application and role exports are retained at `/Users/admin/.transfer-assessment-pg17/phishingtutor.dump` and `/Users/admin/.transfer-assessment-pg17/source-roles.sql`. The first snapshot saw an unrelated room timestamp change before comparison and was refreshed. The refreshed snapshot is consistent; one externally active room's `updated_at` and `mode_changed_at` continue changing after capture, while its assessment flag, active mode and all other fields match. This explicitly documented exception is immaterial to ALTER DEFAULT, which rewrites no existing rows. All other 61 room hashes and all live schema/configuration/template hashes match. Both attempts remain in the evidence; complete current live-row parity is not claimed.

Archived migration: `supabase/archived_migrations/20261014020000_room_assessment_default_on.sql`. Assertions: `supabase/tests/room_assessment_default_on.sql`.

## Verification progress

| Gate | Status | Evidence |
| --- | --- | --- |
| Focused application tests | Passed | AI settings and template management, 2 suites / 21 tests |
| Local Red/Green and parity | Passed | Fresh independent restores; expected Red exit 3; Green exit 0; all 57 template/role combinations |
| Staging deployment and verification | Passed | Applied 2026-10-15 01:39:13 UTC; hosted assertions PASS for both templates under all three roles; browser checkbox checked initially and after reload |
| Production deployment and verification | Passed | Applied 2026-10-15 01:40:48 UTC; exact same SQL; hosted assertions PASS for all 19 templates under all three roles; Render browser checked initially and after reload |
| Cleanup and archival | Complete | Both browser rooms removed, SQL fixtures rolled back, existing room counts restored; exact SQL archived after both passed |

Frontend test command: `rtk npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/components/__tests__/AIAssistantSettings.test.tsx src/__tests__/room_template_management.test.tsx`. Exit 0; full output in `frontend-tests.log`.

## Local database validation

Red database: `room_assessment_red_20261014_02`; Green: `room_assessment_green_20261014_02`; isolated PostgreSQL 17.11 at `/Users/admin/.transfer-assessment-pg17/migration-validation/socket`, port 55433. Fresh restores use `local_bootstrap`; exact SQL applies as `postgres` using its explicit BEGIN/COMMIT.

Database ACL/settings, relevant role attributes/settings/memberships and grant options, schema grants, RLS, defaults, constraints, indexes, trigger and Auth/UUID dependencies match the inspected source. Source is PostgreSQL 17.4 Linux and local is 17.11 Mac; both use the required PostgreSQL 17 default behavior and equivalent dependency definitions. Local/source locale is ICU `en-US`, collation/ctype `en_US.UTF-8`. Staging 17.6 and production 17.4 live assertions also pass.

The same `psql -X -v ON_ERROR_STOP=1 -f tutor-system/supabase/tests/room_assessment_default_on.sql` assertions fail before the migration with `Assessment default disabled for role anon template ...` and pass afterward. Each actual role (`anon`, `authenticated`, `service_role`) creates rooms from all 19 shared templates, then verifies that AI initialization updates preserve the assessment flag. Plain creation, explicit false insert/update, null insert/update rejection, existing-room hashes and fixture rollback also pass.

Post-migration catalog comparison changes only the target column default from false to true. All 62 baseline room hashes remain unchanged, including 52 saved false and 10 saved true values; all 19 template hashes and ACL/policies remain unchanged. A separate ACCESS SHARE lock holder causes the exact candidate to fail with a 100 ms lock timeout; the complete baseline catalog and data remain unchanged afterward.

Evidence: `scenario-setup.json`, `final-red-green-results.json`, `parity-summary.json`, `post-migration-catalog.json`, `migration-lock-timeout.json`, and `README.md` contain full commands, outputs, setup corrections and comparisons.

## Hosted verification and browser results

The private `hosted-release.cjs` helper targets an explicit project through the Management API. For each project, `apply <ref> <exact-sql-file>` returned HTTP 201; `assert <ref> tutor-system/supabase/tests/room_assessment_default_on.sql` returned HTTP 201 and the PASS result. Assertions execute all templates under all three roles and verify rollback cleanup. Fresh production preconditions compared equal before application. Final production MCP inspection confirms default true and zero SQL/browser fixture rows.

Created a teaching-template room using the actual tutor UI, without changing the assessment checkbox, on each target:

| Target | Generated room | Stored assessment / AI flags | Settings before and after reload | Cleanup |
| --- | --- | --- | --- | --- |
| Staging localhost 3101 | `3b4eb9d0-5484-4a77-b9e9-d887740e9366` | true / true | Checked / checked | Removed; remaining rows 0 |
| Production Render | `f8ba5907-4020-4952-984e-4fd7954c603a` | true / true | Checked / checked | Removed; remaining rows 0 |

Template: `Nintendo Switch Deal Scam`, ID `636247de-a6bc-4606-9ec5-5ebb00603f2f`; existing tutor identity `DemoTutor_213782`. Staging bundle was verified to use `ciubrzggdqesgvfkpolj`. Browser inputs and outputs: `output/playwright/assessment-default-browser-evidence.json`; screenshots: `output/playwright/assessment-default-staging-on.png` and `output/playwright/assessment-default-production-on.png`.

Browser empty-single-row probes produce expected HTTP 406 responses when no AI config or legacy checklist exists yet; room creation and persisted assessment verification both complete successfully. Provider calls are unnecessary for this default-only change and were not part of the selected check.

Hosted artifacts in the private run directory: `staging-apply.json`, `staging-assert.json`, `staging-browser-room.json`, `staging-browser-cleanup.json`, `staging-browser-cleaned.json`, `staging-after.json`, and matching `production-*` files including `production-preapply.json`. Browser cleanup is restricted to the exact generated room ID, known tutor ID, and test-title prefix. SQL fixtures roll back and assert absence. Final room counts match their pre-release totals of 48 staging and 62 production.

## Artifact hashes and review

- Exact SQL applied to both projects and archived: `2aefd4279d274b89d7a7369de85aa60323a4220c83b14f4ea10b496ef455e861`.
- Exact local and hosted assertion file: `96fd82f17540c1470084ca7603f21394500bd91cfca357e6ea8c2a76f2b8fab0`.
- Fresh snapshot: `a041605f8e2ec618e81545298a1823f8d088be69069b9030ee55b99939465482`.
- Role export: `28f5dbd26edf31315e76e5677073144ff7e1bb7b93284b3d89ccc5bc1abd164c`.

Independent blind, edge-case and acceptance reviews found no actionable introduced issues. The blind review's caller-override limitation is covered by source traces showing both template paths omit the field, all-template role tests, and actual browser creation. The release records observed Management API execution and live default state; no new CLI migration-history entry is asserted.
