# Five learning targets per teaching scenario

Intent: record the approved target consolidation, exact artifacts, verification evidence and staging/production release gates.

Updated: 2026-10-15. Baseline commit: `8441f11eba0331e2481265f3807fe51732218764`.

## Scope and acceptance

Batch: `five-learning-targets-20261015`. Release owner: implementing Codex agent.
No inherited backend changes are included. Existing deployed checklist and tutor
services are dependencies whose behavior must be verified against the new inventories.

The six teaching scenarios use exactly five total targets across `detection_areas`
and `verification_steps`. Account-alert demos inherit that inventory. Privacy
teaching definitions preserve the existing production posts, dialogue and OP settings.
Custom target inventories and existing learner rooms retain their current behavior.

Changed factors that can affect tutoring or evaluation:

- Target wording and grouping combine overlapping concepts into broader observable goals.
- Inventory size becomes five per teaching scenario, changing the units of progress and assessment for newly initialized rooms.
- Rendered prompt knowledge sections match the consolidated inventory, including comparison variants.
- Three privacy templates acquire an explicit AI configuration where production currently stores null.

Tutor policy, model selection, assessment scheduling and historical evaluation
datasets are separate controls. Consolidated recognition targets may require
evidence across several related details; semantic and live verification remains
necessary before claiming release acceptance.

Selected scope: catalog and packaging tests; seed-to-checklist context integration;
native PostgreSQL migration checks for existing data, atomicity, idempotence and
unaffected rows; staging and production template readback; affected live room
initialization and checklist/tutor journeys with real-provider evidence because
the supplied knowledge changes. Eligibility and scheduling code is unchanged.

Release trigger: local gates and the complete affected staging workflow pass for
the frozen SQL and source artifacts, followed by promotion of that exact SQL and
production verification.

## Observed environment

Read-only template-data access was verified on 2026-10-15 through the Supabase REST
API using anon keys obtained through the authenticated Management API. Credentials
were held in memory and were not written to this record.

| Environment | Project | Observed global templates | Relevant preconditions |
| --- | --- | --- | --- |
| Staging | `ciubrzggdqesgvfkpolj` | 2 | Nintendo Switch Deal Scam and Demo: Click Impulse (Correct Safe Action) |
| Production | `zgbufaxooqxeabewktzd` | 19 | All six teaching templates and thirteen demos; three privacy configs null |

The privacy source rows were read directly from production. Their post text,
images, original dialogue timestamps (`2025-08-20T06:21:49.877Z`) and author settings
provide the provenance for the maintained definitions.

## Release status

Status: **local setup blocked** for release. Implementation, focused application
checks and native SQL fixture checks are complete; hosted release gates remain open.

No Supabase MCP tool is available in this session. Repository instructions require
live schema inspection through Supabase MCP before migration validation and release.
The user was asked to connect it while local implementation continued. Management
API authentication and template-data reads succeed, but do not satisfy that required
schema inspection. No hosted template, schema, room or checklist mutation has been
attempted. Six read-only staging AI endpoint calls used the local new configurations.

Required next release actions: inspect both live schemas, policies and relevant
dependencies through MCP; capture a fresh export and role baseline; validate the
candidate SQL against fresh disposable restored databases; apply and verify staging;
promote the exact artifact and verify production; archive SQL only after both pass.

## Local evidence

| Check | Observed result |
| --- | --- |
| Catalog, template packaging, seed-to-checklist context, room-template UI | Four Jest suites, 56 tests passed |
| Final import-only checklist test cleanup | Its ten tests passed again |
| Privacy seeder CLI fixture | Four tests passed: null initialization, changed-config rejection, matching config, missing-row insertion |
| Native PostgreSQL 17.11 SQL fixture | Red/Green, preserved content/settings, missing teaching insertion, multi-agent conversion, idempotence, duplicate/malformed/drift/null rejection, rollback passed |
| Production build | Passed with existing warnings outside changed files |
| Changed-file ESLint and seeder syntax | Passed |
| TypeScript | 454 baseline and 454 current diagnostics; zero added diagnostics |
| Expanded comparison integration | Existing temperature assertion fails (`0.17` expected, `0.3` received), reproduced in original checkout |
| Diff whitespace | Passed |

Native SQL checks used an explicitly authored minimal table in the new empty
database `five_targets_fixture_20261015_1420` on the isolated local cluster,
port `55433`, as `local_bootstrap`. The transaction rolled back, leaving that
database empty. This validates SQL behavior against the fixture, not ownership,
permissions, dependencies or equivalence to the live schema. A fresh restored
hosted baseline remains required. The first fixture run failed on a test-expression
operator-precedence error; the corrected run and the expanded review cases passed.

Review found and resolved four preservation gaps: privacy seeder full-row updates,
missing optional legacy multi-agent mapping, unexpected null demo configs, and
authored text inside a nominal knowledge block. Three independent reviewers
reported no remaining defects on targeted rechecks. The migration now checks
the current knowledge block against persisted arrays before replacing it; the
privacy seeder initializes null or matching configurations and rejects drift.

The unchanged comparison integration failure and baseline compiler diagnostics
are recorded in [deferred work](../../../_bmad-output/implementation-artifacts/deferred-work.md).
No Python files changed; mypy does not check the TypeScript implementation.

## Read-only hosted evidence

All configured template prompts currently match their saved inventory blocks:
2/2 on staging and 16/16 on production. Production's three privacy configs remain
null. This data preflight passed after the stricter SQL drift guard was added.
It is separate from the still-missing MCP schema inspection.

Six staging `ai-api` calls supplied the local consolidated configurations through
the product's ecological request builder at temperature `0.3`, max tokens `100`,
JSON response format and thinking disabled. All returned HTTP 200, model
`qwen3.5-flash`, finish reason `stop`, and complete decision JSON. The responses
addressed the lock misconception, urgent payment, misleading photos, public home
address, stranger familiarity and verification-code sharing. Manual inspection
found the Nintendo response overstated offer implausibility as impossibility;
the full raw response is retained. These smoke calls do not establish complete
semantic benchmark acceptance or persisted-room workflow acceptance.

Observed endpoint versions: staging `ai-api` v3; production `ai-api` v2.
Neither endpoint was changed or deployed by this task. No database fixtures were
created remotely; native fixture mutations were rolled back.

Full commands, requests, responses, inventories, hashes, timestamps, resolved
failures and reviewer input are retained in the worktree's ignored
`output/five-learning-targets/` directory:

- `local-validation-evidence.md`
- `post-review-checks.json`
- `sql-fixture-evidence.md`
- `staging-ai-smoke.json`
- `hosted-data-preflight.json`
- `review.diff` (the initial reviewed artifact, before the recorded safety fixes)

## Frozen candidate artifacts

| Artifact | SHA-256 |
| --- | --- |
| `src/services/detectionTemplates.ts` | `d4dfa64bf3543b4eaeac097d7f49256fb30773005b68f0408c66336bb005a0f1` |
| `src/services/demoRoomTemplates.ts` | `9ea95bf5057492787b18e6bd4989eca2c4dadae567249a1a50f7521943918e8b` |
| `scripts/seed-behavior-demo-templates.js` | `59d056c4759d6fbad08c7d11c275b7e3bbf01594d5818eb984a16a5b98c08b2e` |
| `supabase/migrations/20261015000000_five_learning_targets.sql` | `be6e5eeac6a855fb7c96b61165f0c58d2dc985e8d183aa3cf8ff3be924f2e56b` |
| `supabase/tests/five_learning_targets.fixture.sql` | `b7fcfb74862b7c857f1d6d0036ae2fa4306c422b8436886221da3149c9e7e90f` |

The SQL inserts absent teaching templates and updates exact supported global
template identities, including an optional legacy multi-agent row. It preserves
existing posts, dialogue, OP fields, model/style settings, policy and examples.
Only approved null privacy configs receive defaults. Its local fixture passes,
but the candidate remains pending until the required MCP inspection and fresh
restored-baseline gates pass. Staging and production deployed artifacts remain
unchanged, and production acceptance is open.
