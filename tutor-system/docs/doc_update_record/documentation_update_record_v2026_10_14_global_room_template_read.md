# Shared room template read policy release

Intent: record the permission fix that restores template selection for ordinary tutor sessions and preserve its local and hosted validation evidence.

Date: 2026-10-14. Source baseline: `ecee681a9856b46e924bb9c9c61d4adf5c348826`.

## Release scope

Add a SELECT policy for global room templates owned by `00000000-0000-0000-0000-000000000000`, available to `anon` and `authenticated`. Keep the existing owner policy intact. The application already loads these templates and shows its picker when the query returns rows.

## Baseline

| Project | Reference | PostgreSQL | Global templates | Anonymous loader response |
| --- | --- | --- | --- | --- |
| Staging | `ciubrzggdqesgvfkpolj` | 17.6 | 1 demo template | HTTP 200 `[]` |
| Production | `zgbufaxooqxeabewktzd` | 17.4 | 19 | HTTP 200 `[]` |

Both projects have RLS enabled, table owner `postgres`, and the sole original policy `Tutors can manage their own templates`, for ALL operations with `((tutor_id = auth.uid()) OR (tutor_id IS NULL))`. The global rows have a non-null system owner, so this predicate excludes them for ordinary application sessions.

Production was inspected directly with Supabase MCP. MCP is bound to production with a read-only executor; staging inspection and hosted deployment use the authenticated Management API with explicit project references. Both API and MCP catalog evidence are compared before application.

Private evidence directory: `/Users/admin/.transfer-assessment-pg17/runs/global_room_template_read/20261014/`. Fresh application snapshot: `/Users/admin/.transfer-assessment-pg17/phishingtutor.dump`; current role export: `/Users/admin/.transfer-assessment-pg17/source-roles.sql`. The configured exporters succeeded for this run.

## Verification progress

| Gate | Status | Evidence |
| --- | --- | --- |
| Browser reproduction | Confirmed | Render and staging localhost both have the create form but no `#template-select`. |
| Local baseline and Red/Green | Passed | Fresh independent restores; Red exit 3 for missing global reads, Green exit 0. |
| Staging application | Applied, 21:39:01 UTC | Management API HTTP 201; exact tested SQL hash. |
| Staging verification | Passed | Permission assertions HTTP 201 PASS; anonymous REST returns both templates after teaching fixture copy; browser selects and prefills. |
| Production application | Applied, 21:39:56 UTC | Fresh preconditions comparison has zero changed keys; Management API HTTP 201 with identical SQL hash. |
| Production verification | Passed | Live MCP confirms additive SELECT policy and intact original policy; permission assertions PASS; anonymous REST returns 19 templates; Render shows six teaching options and selection prefills. |
| Archival | Complete | `supabase/archived_migrations/20261014010000_global_room_template_read.sql`. |

## Browser evidence

Before the change, both browsers returned `{"templateSelectorPresent":false,"createFormPresent":true}` after opening Create a new Room. The existing `DemoTutor_213782` identity is used for inspection; room submission is unnecessary to verify selection and prefilling.

Production before screenshot: `output/playwright/global-template-prod-before.png`.

After screenshots: `output/playwright/global-template-staging-after.png` and `output/playwright/global-template-prod-after.png`. Full browser inputs and observed form values: `output/playwright/global-template-browser-evidence.json`.

On both projects, selecting template `636247de-a6bc-4606-9ec5-5ebb00603f2f` sets the title to `Nintendo Switch Deal Scam` and fills the matching training description. Production now exposes six teaching options plus Create from scratch. Browser checks stop after selection; no rooms are submitted.

## Staging teaching fixture

Staging's sole original global template is `Demo: Click Impulse (Correct Safe Action)`, intentionally excluded from normal room creation. Copied the existing production `Nintendo Switch Deal Scam` template, preserving ID and content, to staging as a reusable teaching fixture. This data addition is separate from the policy migration. ID: `636247de-a6bc-4606-9ec5-5ebb00603f2f`; source record SHA256: `ee30d121b44944c6116a3475a54c1f8d1293f27c32f28d68831e015bc2da3d98`. Copy evidence: `staging-teaching-fixture.json` in the private run directory.

## Local validation

Fresh snapshot SHA256: `c4e0e9f046fbf7c03ee5f945068ac5de26351c4a5d8eb63ab351cde610571e61`. Role export SHA256: `7a2789ff600aebbf34f18d9201446190b0e9b3fe51107d0f0ad447d112ce0d91`.

Disposable databases: `global_room_template_red_20261014_02` and `global_room_template_green_20261014_01`, isolated socket `/Users/admin/.transfer-assessment-pg17/migration-validation/socket`, port 55433. Bootstrap restores use `local_bootstrap`; SQL applies under the hosted-equivalent `postgres` executor, using the migration's explicit BEGIN/COMMIT.

Baseline comparisons have zero differing keys after equivalent grants/settings are established. Compared database owner, encoding, ICU locale, ACL and database settings; relevant role attributes, settings, memberships and grant options; schema/table ownership and grants; RLS policies; defaults, constraints and indexes; `auth.uid()`, UUID/default and trigger dependencies; default ACLs; and all 19 template row hashes. The source/local locale is ICU `en-US`, with `en_US.UTF-8` collation/ctype.

Source PostgreSQL 17.4 and local 17.11 differ in minor version and host platform. The candidate uses unchanged PostgreSQL 17 SELECT-policy behavior; required dependency definitions and permissions match, local role tests pass, and both hosted PostgreSQL 17.4/17.6 permission tests pass. The candidate changes no extension or collation behavior.

`psql -X -v ON_ERROR_STOP=1 -f tutor-system/supabase/tests/global_room_template_read.sql` fails before the migration with `Anon cannot read all global room templates` and passes after it. Assertions cover anonymous/authenticated global reads, unrelated private visibility, denied shared INSERT, zero-row shared UPDATE/DELETE, owner CRUD, denied ownership reassignment, service-role reads, null-owner rejection, unchanged global contents, and fixture rollback. A duplicate migration application fails atomically with the policy already existing; the catalog remains unchanged.

All setup commands, initial setup errors and corrected setup, full restore logs, catalog comparisons, assertion outputs and duplicate-application failure are retained in the private run directory. Start with `README.md`, `green-setup.json`, `parity-summary.json`, `final-red-green-and-hashes.json`, and `duplicate-migration-failure.json`.

## Hosted commands and results

The private `hosted-release.cjs` helper reads the configured management token in memory and takes an explicit project ref. Commands use `rtk proxy node <run-directory>/hosted-release.cjs` with:

- `inspect <project-ref>`: baseline, fresh production preconditions, and final catalog snapshots.
- `apply <project-ref> <exact-migration-file>`: staging then production, HTTP 201 on both.
- `assert <project-ref> tutor-system/supabase/tests/global_room_template_read.sql`: actual hosted role assertions, HTTP 201 PASS on both; all generated fixtures roll back and their absence is asserted.
- `rest <project-ref>`: public anon loader filter, HTTP 200 with two staging rows and 19 production rows after release.

Identical migration SHA256 on both applications and archive: `f511e53277c4e6721f7afa3e247e03135b0356cff064a73922c14dc1c524cb9c`.

The assertion file's responsibility comment was clarified during this run and updated to the archived path afterward; assertion logic was unchanged. Logs retain the exact executed hashes. Hosted verification is recorded in `staging-apply.json`, `staging-assert.json`, `staging-after.json`, `staging-rest-after.json`, `production-preapply.json`, `production-apply.json`, `production-assert.json`, `production-after.json`, and `production-rest-after.json`.

This release records observed Management API application and catalog state. A new CLI migration-history entry was not asserted.

## Application regression and review

`rtk npm test -- --watchAll=false --runInBand --runTestsByPath src/__tests__/room_template_management.test.tsx`: 13 tests passed. Existing React test warnings remain; all assertions pass.

Independent blind, edge-case and acceptance reviews found no actionable policy/test issues. Acceptance release-evidence items were completed by the hosted and browser checks above.
