# Unified learning target inventory

Intent: record the revised target contract, validation artifacts and exact release state.

Updated: 2026-10-15. Baseline commit: `7c2c068`.

## Change and selected checks

Batch: `unified-learning-targets-20261015`; owner: implementing Codex agent. This
batch contains the earlier five-target consolidation and its revised unified
inventory, with the pending SQL replacing the earlier unreleased candidate.
The existing assessment API and database lifecycle RPCs are backend dependencies.

Six teaching templates store five targets in `detection_areas`. Prompt extraction
returns that same single list and checklist generation creates `detection_area`
items. The rendered prompt contains one target section. Assessment judges the
learner's evidence against target text through the existing progress lifecycle.

Changed factors: target grouping, rendered knowledge sections, extraction prompt
and JSON contract, exact-duplicate normalization, and target-type evidence gating.
Source target text remains the approved five-goal inventory. Model selection,
assessment scheduling, answer grading, identity and permissions retain their
existing implementation. Existing learner room inventories are not migrated.

Required local scope: deterministic extraction, packaging, context and failure
tests; Edge analysis/lifecycle tests; fresh restored hosted SQL baselines with
permissions, preservation, atomicity and unaffected rows. Required live scope:
template readback, real Smart Generate persistence, a room created from the
five-target template, and a safe-action target's assessment journey, with cleanup
in staging and production. Promotion trigger: this combined staging scope passes
for the frozen SQL and Edge source, then the exact artifacts are promoted.

## Local evidence

| Check | Result |
| --- | --- |
| Combined Jest acceptance | 11 suites; 105 passed, 29 opt-in skipped |
| Duplicate normalization follow-up | 23 passed, 29 skipped |
| Assessment API and Deno type check | 34 passed |
| Browser runner plus privacy seeder fixtures | 24 passed; later runner-only check 20 passed |
| Production build | Passed with existing warnings |
| TypeScript comparison | Baseline 454, current 453, zero new diagnostics |
| Extraction/direct-consumer lint | Passed |
| BDD baseline comparison | Three remaining failures reproduce in original baseline |

Full extraction evidence: `output/unified-learning-targets/local-validation-evidence.json`.
Root's combined test/build/type and bundle results are saved alongside it.

The first Deno command lacked its import-resolution option; a second lacked
permission for its subprocess type-check test. With the required existing options,
all 34 tests passed. Initial mocked Jest imports lacked frontend environment
values; explicit test-only values resolved those setup failures. No real provider
acceptance is inferred from deterministic mocks.

## Hosted baseline and candidate

Supabase MCP is now connected to production `zgbufaxooqxeabewktzd`, with a
read-only executor. Production live catalog/source inspection used MCP. Staging
`ciubrzggdqesgvfkpolj` cannot be selected through that bound tool; live inspection
used the workflow's authenticated Management API fallback. Management executor is
`postgres` in both environments.

Fresh configured application exports, roles, scoped `room_templates`/`users`
archives, dependency setup, source catalogs and exact table fingerprints were
captured for both environments. Hosted PostgreSQL versions are 17.4/17.6;
native is 17.11. Catalog equivalence and justified immaterial environment
differences are recorded in the native run package.

SQL: `supabase/archived_migrations/20261015000000_five_learning_targets.sql`.
SHA-256: `e292129edff76a65dd05340bcbf5ca7898a016bb049a7e9922986301385dc63b`.
Both restored baselines passed expected Red/Green, five-target contract,
content/configuration/policy preservation, duplicate/malformed/drift/null-demo
rejection with atomic rollback, actual application role permissions, and exact
idempotence.

Edge source manifest SHA-256:
`d73dfd20bf095e29529007f0dab60f26438a7fff209265b65ed8d9df8d59f73d`.
The production v11 source files matched the local baseline, and nine unchanged
dependencies match byte for byte. API-only bundling on staging returned HTTP 201
with `bundleOnly=1`, bundle SHA-256
`d8413b221bfb3793972a72fdfe9ce17619b06f1cacd31bb071fc57490ac74f76`.
The bundle response's prospective version is not a deployment claim.

Deployment uses the [Management API multipart source-file endpoint](https://supabase.com/changelog/33720-deploy-and-update-edge-functions-using-the-management-api).
Source files and metadata are uploaded directly after SQL verification; no local
container bundling is part of this workflow.

## Release state and resume

Status: **production verified**. User-authorized cleanup inspected 28 worktrees and
removed seven rebuildable cache directories (479 MiB), preserving the active
shared Node cache. The isolated PostgreSQL cluster recovered. Its final role,
preservation, idempotence and atomicity assertions passed on both restored
baselines after correcting UUID fixture casts and extension function ACL parity.
The final checkpoint passed. Later disk inspection reported 16 GiB available.

Final migration gate and exact reproducible commands:
`/Users/admin/.transfer-assessment-pg17/runs/unified_learning_targets/20261015T195221Z/FINAL-GATE.md`.
Live staging and production catalogs and template fingerprints were rechecked
without drift before release. Cache evidence is in
`output/unified-learning-targets/cache-cleanup.json`.

All three independent reviews completed. Their acceptance findings were resolved:
the live room workflow now verifies five persisted template targets and uses real
learner analysis; ordinary coverage judges evidence against each target's wording.
The targeted acceptance recheck found no remaining actionable defects. Latest
focused Jest follow-up passed 49 tests (29 opt-in skipped); CRA compilation and
its type check passed after using ES5-compatible exact-duplicate normalization.

Staging SQL applied at `2026-10-15T20:48:43Z`, HTTP 201. Readback passed the exact
contract and matched all seven restored Green template rows, excluding generated
IDs/timestamps. Schema, roles, permissions and users were unchanged. Assessment
API deployed as v57, HTTP 201, with the exact source manifest and bundle hashes
above. Evidence: `staging-sql-apply.json`, `staging-sql-verification.json`, and
`staging-edge-deploy.json` under the local evidence directory.

Live extraction passed in run `20261015204946-db7dc54a`. Ordinary safe-choice
coverage passed in `20261015205121-7bf8c6a5`, both with cleanup. Its earlier run
`20261015205023-6a476d5b` failed because the assertion required exactly `good`
while the provider credited `excellent`; the corrected assertion accepts both
sufficient levels. The first new-room run `20261015205139-055f88d8` stopped at
an ordinary-mode button because the template enables assessment by default.
The revised fixture explicitly uses the UI to disable assessment before target
generation, preserving the existing-target promotion journey. All failed evidence
and successful fixture cleanup are retained under `tmp/browser_demo_runs/`.

Run `20261015205303-a05ad9c2` then exposed settings initialization racing the
fixture checkbox click; waiting for the saved enabled state resolves that fixture
race. The new-room journey passed in `20261015205415-e829e424`: five exact inherited
targets, all `detection_area`; real `analyze_message` returned applied covered/good
evidence; real `prepare_turn` returned HTTP 200; the delivered assessment answer
persisted a pass; observer mode and fixture cleanup passed. Combined staging
acceptance is closed for the frozen artifacts. Production API v11 was rechecked
and its source/bundle remain identical to the captured baseline.

Production SQL applied at `2026-10-15T20:55:51Z`, HTTP 201. All 19 global templates
passed the unified five-target contract and matched the restored Green rows;
schema, permissions and users remained unchanged. Assessment API deployed as v12
at `2026-10-15T20:56:16Z`, HTTP 201. Production MCP confirmed all ten deployed files
match the staged source byte for byte. Its project bundle SHA-256 is
`5c93f37caddda628de0e3dae4b90214a87eeb71d4b35b5ab9ae6c475412060af`;
the source manifest is the same staged manifest above.

| Production check | Passing run |
| --- | --- |
| Real LLM extraction and persisted single-list targets | `20261015205645-f385ad4c` |
| Ordinary safe-choice coverage and next tutor context | `20261015205658-c049e98c` |
| Five inherited targets, actual analysis, preparation, assessment answer and observer | `20261015205713-3ab4429e` |

All production runs passed on their first attempt. Final independent cleanup
queries for every successful and failed run in both environments found zero
remaining created rooms, messages, sessions, checklists, assessments, provider
attempts and learning events. Per-run requests, responses, stored targets and
screenshots are retained in `tmp/browser_demo_runs/`; summary evidence is in
`staging-live-acceptance.json` and `production-live-acceptance.json`.

Final optimized frontend build passed with existing warnings and produced
`build/static/js/main.a4553d6a.js`. Production browser checks served this build
locally with explicit production public configuration. Hosted server/template
release is complete; this task has not published a hosted frontend build.

SQL was archived only after both environments passed, retaining its tested SHA-256
unchanged. Fixture include paths now reference that archive. Production acceptance
is closed for this batch. No pending migration remains.

The archived include paths were smoke-tested with `psql -X -v ON_ERROR_STOP=1 -f
tutor-system/supabase/tests/five_learning_targets.fixture.sql` in the new empty
isolated database `unified_archive_fixture_20261015_2059`: exit 0, all Red/Green,
preservation, idempotence and rejection/rollback assertions passed. Its final
transaction rolled back. Both temporary application servers were stopped.

Native run and exact resume commands:
`/Users/admin/.transfer-assessment-pg17/runs/unified_learning_targets/20261015T195221Z/RUN.md`
and `RESUME.md`. Preserve successful and failed evidence when resuming.
