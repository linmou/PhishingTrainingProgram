# Document learning targets — issue #73

Intent: record the exact source, implementation, verification and remaining release work for the ten pilot templates.

Updated: 2026-11-12. Integrated release commit: `679c7b08d65a4c8ae41fa1438cf44f1efa79da1c` on `no_sign_up`.
Issue: https://github.com/linmou/PhishingTrainingProgram/issues/73
Release owner and repair owner: root Codex agent for issue #73.
Merged target PR: https://github.com/linmou/PhishingTrainingProgram/pull/74
Merged fourth-grade prompt PR: https://github.com/linmou/PhishingTrainingProgram/pull/77
Implementation commit: `330995c`.
Migration SHA-256: `2ac977b6c92b91acd05c6fa8c87e49c940a57a97845f70c071ac40789e2ae4ea`.

## Source and behavior

`General Learning Goals.docx` SHA-256: `fd0a0f49106e1b37795886dc39f974c3e99758e0007df5c2b0ba5d730dd6655b`.
`src/services/detectionTemplates.ts` directly contains all 33 distinct knowledge points, preserving their complete title, explanation, action text and document order.
The six phishing/privacy scenarios contain 5, 5, 5, 4, 4 and 5 points; all four cyberbullying templates use the same five document points.

The frontend scenario catalog supplies new room configurations. SQL migration `20261112000000_document_learning_targets.sql` replaces the six saved standard templates' detection inventories and corresponding system-prompt section. Existing prompt policy and template content remain intact. SQL rejects missing/ambiguous template inventories or malformed prompt boundaries atomically.

New cyberbullying checklists use `cyberbullying_doc_20261112`. Existing checklists keep their original version, target text, progress and evidence; validation resolves their version's catalog. The client displays revised cyberbullying targets in document order even when database timestamps tie. Existing room configurations and learner checklists are not rewritten by this template update.

## Verification

- Source-fidelity comparison: all 33 complete DOCX knowledge-point blocks match the directly embedded catalog exactly, including order; source hash matches.
- Catalog, template configuration, checklist context and cyberbullying export tests: 44 tests passed across four suites before the ordering fix.
- After the ordering fix: cyberbullying service/export and ChecklistPanel transfer integration tests passed, 34 tests across two suites. The added case returns records in reverse order with identical timestamps and verifies document order and preserved evidence after reading/export.
- Production build compiled successfully with existing warnings, including after the ordering fix (`main.35ad6000.js`). Strict `CI=true` build fails on warnings in unchanged ImageUpload, useChecklist, RoomPagePost, imageUpload and parameterConfig files. These warnings are not accepted as a waiver of CI requirements.
- Combined SQL integration passed on a disposable clone of `exit_baseline_20261031_2354`: real room joining, initialization, analysis application, evidence preservation, idempotence, version protection and anonymous static catalog reads. Six explicitly synthetic legacy prompt fixtures verify exact catalog installation, preservation of every unrelated template column/configuration field and prompt prefix/suffix, idempotence including timestamps, and atomic rollback of both catalog and earlier template updates when the final template has a malformed boundary. Evidence lease: `/Users/admin/.transfer-assessment-pg17/runs/scenario-dLCfqG/lease.json`. This is diagnostic evidence, not fresh hosted-baseline parity.

SQL verification command (repository root): `rtk proxy node scripts/database/disposable-database.js --template exit_baseline_20261031_2354 -- /opt/homebrew/opt/postgresql@17/bin/psql -X -v ON_ERROR_STOP=1 -f tutor-system/supabase/tests/document_learning_targets.sql` (exit 0).

Independent Codex reviewer `targets_review` found no blocking defect in the implementation and independently verified all 33 DOCX blocks and assessment-api consumption of persisted target text. Its nonblocking suggestion to use true historical text/order in the frontend legacy-version test was addressed; both version cases passed afterward. Required GitHub CI passed before merge.

## Hosted release history

PR #74 merged at `d8e1b1db96f575948eb35b65046be668c2e3936d`, identical in deployable artifacts to staging-tested `239267f`. Staging applied the exact migration, passed hosted rollback acceptance, and preserved checksums of all 32 existing checklists, 92 items and 55 evidence rows. All 11 template rows were compared field-for-field with the fresh baseline; only six intended target updates and their timestamps changed. Browser acceptance passed seven room journeys (all six phishing/privacy template settings plus cyberbullying target initialization/order); seven rooms and two users were cleaned. Evidence: `output/issue-73-browser/1794514663136/report.json` and `/Users/admin/.transfer-assessment-pg17/runs/baseline.cGZfmObA/issue-73-validation/`.

On 2026-11-12, the user explicitly selected adding the temporary fourth-grade instruction to the default prompt and deploying from `no_sign_up`. The exact live-branch prompt is copied without rewriting; its historical failed evaluation gates remain documented in `docs/ai-behaviors/temporary-fourth-grade-prompt.md`. PR #77 merged at `679c7b0`; deployable artifacts match staging-tested `229c928` exactly. Required GitHub checks passed (run `43300776601`).

All target definitions live directly in `detectionTemplates.ts`. All 33 point strings and their ordering were compared exactly with the previously source-verified catalog. Jest checks equality between the frontend targets and the migration's embedded inventories; SQL checks their installation and database behavior without loading TypeScript. Expected inventory counts are specified only in the catalog test; downstream tests assert complete array preservation. After this test simplification on 2026-11-12 (baseline `d00f94f`), all 44 tests in the three affected Jest suites passed. The combined SQL diagnostic passed with cleanup recorded at `/Users/admin/.transfer-assessment-pg17/runs/scenario-8Jt3ai/lease.json`. The deployable SQL migration is unchanged.

Earlier staging authentication failures through MCP and Management API are retained below as history. Access recovered on 2026-11-12 during renewed diagnosis; direct PostgreSQL and MCP queries succeeded without password reset or infrastructure mutation. Detailed database/REST/Auth health had been unhealthy despite top-level ACTIVE_HEALTHY; logs subsequently showed PostgreSQL 17.11 startup. Fresh export: `/Users/admin/.transfer-assessment-pg17/runs/baseline.cGZfmObA`. Restoration/catalog parity and all 25 table digests matched; expected Red, exact-migration Green and hosted SQL acceptance passed. Disposable scenario databases were cleaned. All three GitHub checks for `84d7a50` passed (run `43278281549`).

The browser harness was aligned with the saved-target contract: template readiness compares blank-line-separated points and cyberbullying checks expect the revised target version. Live verification covers all six phishing/privacy template configurations and new cyberbullying progress. No new behavioral evaluation is claimed.

Earlier on 2026-11-12, staging `SELECT 1` failed with SQLSTATE 28P01. GitHub run `43273841462` passed isolation and build but failed three AI settings tests. These exposed a real multiline-target serialization bug: the settings textarea split each knowledge point at every newline. Loading and saving now use blank lines between detection targets, with matching visible instructions. All 16 settings tests passed, including multiline edit/save/reopen for all six teaching scenarios. Independent review found no blocking issue in this fix. Full local regression passed: 152 suites, 1,579 tests and one snapshot; five suites and 93 tests skipped by the existing configuration (`CI=true npm run test:regression -- --runInBand --silent`, placeholder local Supabase settings).

Combined staging browser acceptance passed seven journeys, including a real tutor request with the exact fourth-grade policy and all five complete Nintendo target blocks. HTTP 200 for analyze_message, prepare_turn and ai-api, valid response contract and visible suggestion were verified. Seven rooms and two users were cleaned. Evidence: `output/issue-73-browser/1794515516808/`. Earlier harness failures `1794514556334` and `1794515434298` were retained and cleaned; readiness waiting and a renamed button selector were corrected. Browser harness unit tests passed 33/33; focused prompt transport/contract tests passed 35/35.

## Production release

The exact migration was applied to `zgbufaxooqxeabewktzd` after staging acceptance and merge. Hosted rollback acceptance passed: real join, initialization, idempotence, reducer/evidence updates, integrity, historical rejoin and anonymous catalog reads. Production PostgreSQL is 17.4 versus staging 17.11; the migration uses core SQL supported by both versions.

Existing data checksums remained unchanged: 49 checklists `bc379dcafd13ff1ddf2172f126894727`, 561 items `107888c2b5a357d16f61c5fd1fb3aaf8`, 78 evidence rows `73a31856471e004dd476b08300422efb`. All 23 production templates were compared with the pre-release snapshot: only six intended target arrays, prompt target sections and timestamps changed. Prompt prefixes/suffixes and all other fields matched; the other 17 rows were unchanged. Evidence: `/Users/admin/.transfer-assessment-pg17/runs/issue73-production-20261112/preservation-result.json` and `output/issue-73-release/`.

Render service `srv-d1pjtjnfte5s73ce0opg` now follows `no_sign_up`, auto-deploy enabled. Deploy `dep-dbr2607f3r2c7381ea2g` became live at 2026-11-12 20:36:32 UTC for exact commit `679c7b0`. URL: https://phishingtrainingprogram.onrender.com. Bundle `main.4c646572.js` SHA-256: `bdce7ebea72d94ff9e212d8b1c5175327624fcbdf2ab8559bbd5c9733081e499`.

Production browser acceptance passed **7/7** at exact release commit `679c7b0`: all six settings save/reopen journeys, new cyberbullying target version/order, and a real tutor request containing the exact fourth-grade policy and all five complete Nintendo targets. The response was HTTP 200, valid JSON and visibly rendered. Evidence: `output/issue-73-browser/1794516153827/report.json`, `tutor-request-response.json`, `tutor-delivery.png` and traces. Seven rooms and two users were cleaned; the production lease was released afterward.

The first production attempt loaded stale CDN HTML referencing `main.f7745f75.js`, failed the editor assertion and cleaned its room and two users (`output/issue-73-browser/1794515881473/`). A second attempt exposed a harness race between learner joining and tutor discovery; its fixtures were cleaned and the harness now waits for the active learner before generating persisted targets. The successful run explicitly records its `/index.html` no-cache entry override and verifies the loaded asset. Separately, an ordinary GET `/` without override or headers returned `main.4c646572.js` at 20:43:19 UTC after CDN expiry, confirming the normal public entry point converged.

Release acceptance and cleanup are complete. The unchanged migration is archived at `supabase/archived_migrations/20261112000000_document_learning_targets.sql`; both test references use that path. This archival follow-up changes no application runtime artifact.

Archive validation: SHA-256 unchanged; catalog Jest tests passed 10/10. Full SQL integration using the archived path passed against a disposable clone of fresh baseline `issue73_baseline_20261112_fresh`; cleanup confirmed at `/Users/admin/.transfer-assessment-pg17/runs/scenario-Dz0Y8J/lease.json`.
