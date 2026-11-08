# Exit assessment delivery record

Intent: track implementation and release evidence for issue #46 and the approved PR #47 design.

Date: 2026-10-31. Baseline: `d3bb45b`. Release owner: Codex (main implementation agent).

## Scope and acceptance

Changes: learner-owned routes to Covered become assessment eligible; one open question per target; server-recorded idempotent page visits control reassessment; learners answer hidden questions in an exit pop-up; ordinary chat and rating resume remain available; AI history and focus exclude unfinished assessments.

Inherited dependencies: `assessment-api` and its shared TypeScript imports, including `ecologicalTutorCall.ts`; release owner is Codex. Existing grading, Guard handling, cancellation, result persistence and authorization must continue working.

Verification scope: affected assessment, eligibility, visit identity and Guard lifecycle journeys. SQL requires a fresh restored baseline, source parity and Red/Green checks. Focused React/service tests, tutor behavior contract, TypeScript/build checks and controlled-provider browser journeys precede release. A real-model staging journey is required.

Staging acceptance: verify the new frontend against the previous backend first; then SQL and Edge; two targets, ordinary chat with hidden questions, exit pass and two-attempt failure, held Guard answer then release, same-visit suppression and next-visit reassessment, persisted ended results on re-entry, browser Back and unload prompt, unchanged tutor/observer views, and AI requests without hidden questions. Record persisted rows and fixture cleanup.

Production acceptance: integrated committed artifacts on `no_sign_up`, staging manifest match, frontend-first promotion followed by exact SQL and Edge, live schema/permissions check and learner exit journey with persisted results, re-entry and tutor view; fixture cleanup required.

## Progress

Implementation in isolated branch `feat/exit-assessment`, based on local `no_sign_up` including the pre-existing documentation commit. Issue #46 remains open. No shared staging or production writes have occurred.

Artifact hashes, test results, merge status, deployed versions and cleanup evidence will be recorded as each gate completes. Production acceptance remains open.

## Initial local evidence

- Focused assessment/context regression run: 11 suites passed, 157 tests passed, one benchmark skipped. Separate tutor behavior contract: four tests passed with explicit offline Supabase configuration. The first contract invocation lacked configuration and failed before running; it did not exercise hosted state.
- Production frontend build passed. Existing lint warnings remain, including the room join effect dependency.
- Runtime TypeScript check (excluding test files): zero diagnostics. Full repository `tsc --noEmit` remains blocked by existing test typing errors; this is not reported as a passing full type check.
- Read-only Management API inspection confirms staging and production have identical definitions for the four affected hash/eligibility/delivery functions. MCP is configured for production only. Staging reports PostgreSQL 17.6. The new visit table is absent before implementation deployment.
- Fresh export and restored-baseline validation are being performed by the backend implementation agent; no deployment acceptance is claimed by the frontend build or unit tests.

## Database validation evidence

Fresh production snapshot: `/Users/admin/.transfer-assessment-pg17/runs/baseline.ByvuYLL0`; restored baseline `exit_baseline_20261031_2354`. Export metadata, parity query and normalized `source-parity.json` / `local-parity.json` retain matching scoped tables, indexes, schemas, policies, functions, constraints and default grants. Local PostgreSQL 17.11 differs from production 17.4 and staging 17.6 by patch version; exact migration/behavior tests exercise the relevant semantics. Relevant extensions match (`uuid-ossp` 1.1 and `pgcrypto` 1.3).

Red: executing `exit_assessment.sql` against the untouched restored baseline as `postgres` fails with exit 3 because `start_learner_visit_v1(uuid,uuid,uuid)` does not exist. Green: the exact candidate migration succeeds as `postgres` (matching source NOSUPERUSER/BYPASSRLS attributes); application role calls and privilege assertions reject anonymous/authenticated visit access.

Migration SHA-256: `2870af69e0617eed4df7cc3c36d5fd334ce10de254ea55770f83aaae5347a2a1`. Disposable scenario `scenario-TJ97WL` passes Covered routes, Partial/manual/failed exclusions, multiple target questions, duplicate same-target refusal, same-visit and cross-visit resolution suppression, cancellation replacement, Guard hold/recovery, idempotent visits and role checks. Scenario `scenario-zkQeUK` creates a pre-migration open question, applies the migration, confirms existing rows remain unchanged, starts a later visit and successfully grades that question. Both disposable leases record successful cleanup.

Edge tests: 51 passed with Deno. Service/API contract Jest: 17 passed. Local headless Chromium browser harness: 30 passed, including exit question binding and navigation plus visit fixture cleanup. These are local checks, not hosted acceptance.

## Review and resumed verification (2026-11-01)

The implementation session was interrupted by an upstream agent-service HTTP 503. Worktree files and database evidence were preserved; no shared deployment occurred. Resumed focused checks pass 81 tests across four suites. Assessment audit checks pass 22 tests. Isolation checks pass all 13 tests after rerunning the export tests with `LC_ALL=C LANG=C`; the initial failure was the host's unsupported `C.UTF-8` Perl locale, not an export-isolation defect.

Independent implementation reviews found and fixed result-before-question delivery leaving an exit question open, and ended learner questions retaining disabled submission controls. Regression tests cover both. The room's real HashRouter Back path, multiple questions, retry, Guard waiting, and rating auto-send are exercised in React tests. Backend review found no additional implementation defect. Final full Jest/build checks remain in progress before opening the implementation PR.

Additional Green validation (`scenario-x90Omy`) passes 17 existing assessment lifecycle scenarios and role checks plus 16 result-message cases; the old eligibility expectations were updated to the approved exit contract. Disposable cleanup passed. Historical evaluator `followup.test.js` passes 10 tests but still describes archived in-dialogue sequencing; it does not establish conformance to exit scheduling or AI wording. Hosted assessment delivery remains required for real-model acceptance.

Final local candidate: full Jest passes 148 suites / 1,510 tests / one snapshot; five suites and 93 tests are skipped by existing opt-ins. Optimized frontend build passes with existing warnings. Runtime TypeScript has zero diagnostics. Browser harness plus cleanup tests pass 33 tests. `git diff --check` passes. No hosted state has been modified. The next gate is implementation PR CI/review, followed by leased staging compatibility and deployment acceptance.

## PR and staging deployment

PR #54 candidate `7d7ab5d6ed4b5785f57ecdccd1350064ba1afc31` passed all three GitHub CI checks. GitHub Codex code/security review could not start because its account was out of credits. The maintainer explicitly approved substituting the completed independent local Codex reviews on 2026-11-01. The pre-existing documentation baseline commit remains included; runtime artifacts are owned by this feature commit.

Staging lease: `output/exit-assessment-20261101/coordination-lease.json`. Frontend against old backend passed retry→pass, saved results, unload confirmation, ordinary AI focus and read-only re-entry, with fixture cleanup: `tmp/browser_demo_runs/staging-template-20261101052651-55d05636/report.json`.

Exact SQL applied at 2026-11-01 05:27:44 UTC; live transactional SQL assertions passed at 05:28:00 UTC and rolled back their fixtures. Staging `assessment-api` advanced from version 80 to 81; source manifest `c07ffe3d0b0d722a874ac569620faf992c9c3918cde5ea77e74dcee09cd78871`, bundle `5606a12230742ed7cf5cf275e4ab31c934c5250bd8eda00358e4426a3c0d439f`. Required secret names were confirmed without recording values. Candidate artifact manifest (325 files): `599353e14a41f7bfa8a965085663f2e932fbd44f18dd6c0192907012c7697aca` in `output/exit-assessment-20261101/candidate-artifacts.json`.

First full hosted answer run `staging-template-20261101052824-6b25d90a` passed grading and then failed a browser oracle requiring every evidence-analysis request to reference the latest focus. Captured requests showed an earlier ordinary learner message being legitimately replayed on tutor entry; the assessment answer was not analyzed and preparation/provider focus remained the ordinary learner message. The oracle now rejects assessment-answer identities and separately checks preparation focus, allowing ordinary history replay. Fixture cleanup passed. This harness-only correction changes no deployed artifact. Staging acceptance and production acceptance remain open; owner Codex continues the rerun.

Run `staging-template-20261101053314-86559879` passed pass/fail/retry-pass and Guard recovery, then timed out because the cancellation harness expected an ordinary suggestion. Captured preparation correctly offered the cancelled target again under the approved same-visit exception. The harness now requires that replacement draft, its exact identities and ordinary focus, no assessment-answer analysis, no automatic delivery, and the original cancelled row with zero attempts. All three fixture rooms were cleaned; a read-only check confirmed zero fixture visits. The revised browser harness passes 32 tests. A staging-only two-target workflow additionally covers actual browser Back, hidden questions, Guard waiting, queue progression and visit-based reassessment. These harness changes do not alter the deployed SQL or Edge artifacts. Staging and production acceptance remain open.

Resumed 2026-11-03: candidate `c439229` passed all three CI jobs. Independent review found the new Guard workflow could clear Guard before the submission reached the server. The check now requires the bound persisted answer and authoritative `guard_deferred` processing record with zero attempts before clearing Guard, and recovery must grade the same answer. Local harness passes 33 tests. No additional hosted writes occurred during this repair; live acceptance remains pending.

Candidate `976b0b1` passed all three CI jobs and independent re-review. Its 325-file runtime manifest remains `599353e14a41f7bfa8a965085663f2e932fbd44f18dd6c0192907012c7697aca`; all 11 downloaded staging Edge modules match. Read-only catalog evidence is in `output/exit-assessment-20261103/`: staging retains the expected migrated definitions, and production matches the restored baseline with no visit table.

Staging two-target exit journey passed (`staging-template-20261103191432-87cf483d`), including actual Back, hidden questions/unlocked chat, idempotent joins, persisted Guard-deferred answer with zero attempts, same-answer recovery/pass, second-target two-attempt failure, resumed navigation, read-only re-entry and next-visit eligibility. Cleanup passed. Full answer lifecycle passed (`staging-template-20261103191519-6ece7304`), including pass/fail/retry-pass, Guard recovery, cancellation replacement and tutor ordinary-focus checks; all three fixture-room cleanups passed.

Full-inventory real-model delivery run `staging-template-20261103191752-bd665c58` generated and delivered eight first-topic questions but failed in the ordinary support reply helper. Its failure screenshot shows the intended learner reply already posted once after a four-star rating, with the composer cleared; the helper attempted an extra Send click on the now-empty disabled button. Fixture cleanup passed. The real-model acceptance remains open while this harness race is repaired and rerun; prior successful exit/answer evidence remains valid for unchanged runtime artifacts.

The repaired send helper waits after a rating for auto-send completion, another required rating, or a composer ready for manual submission. Chromium regression cases model asynchronous auto-send with one and consecutive ratings and assert one send. Independent review confirmed the helper matches the real rating handler; all 33 harness tests pass. Runtime source remains unchanged.

Candidate `d6f6be7` passed CI. Its real-model rerun `staging-template-20261103192812-679b5329` successfully passed the formerly failing support rating/send step, delivered the support question and graded the first exit answer, then hit an undefined `target` in the extracted answer-verification helper. The assertion now references the delivered assessment's recorded target. ESLint `no-undef` passes for the runner, support and three affected workflows with Node/browser environments; the initial Node-only invocation reported expected browser globals. Cleanup passed. This additional harness repair leaves runtime artifacts unchanged and full-inventory acceptance open for rerun.

## Staging verified — awaiting production release (2026-11-03)

Batch: exit assessment / issue #46. Owner: Codex. Candidate `9c0ba885e5c0f8d7d12933e7a8e867435bb8fb77` passed all three CI jobs and independent local re-review. Real-model delivery passed in `staging-template-20261103193556-ddd0d2b1`: the complete due queue contained six target-specific assessments across domain and support learning, every answer closed as passed, progress remained Covered/good, and ended questions/results restored on re-entry. Fixture cleanup passed. Room setup passed in `staging-template-20261103193915-5c738182`, including observer access, existing checklist preservation and the exit answer; the created fixture room was deleted successfully.

Together with the two-target exit and complete answer runs above, these checks complete staging acceptance. Staging SQL remains the exact tested SHA-256 `2870af69e0617eed4df7cc3c36d5fd334ce10de254ea55770f83aaae5347a2a1`; assessment-api is v81 with all 11 downloaded modules matching the candidate. Runtime manifest remains `599353e14a41f7bfa8a965085663f2e932fbd44f18dd6c0192907012c7697aca`. The final staging lease is `output/exit-assessment-20261103-delivery/coordination-lease.json`, released after acceptance and cleanup.

PR #54 is awaiting merge into `no_sign_up`; production acceptance remains open. Release trigger: merge after current CI/local-review gates, confirm the integrated runtime manifest matches staging, verify Render's frontend release, recheck production preconditions, then promote the exact SQL followed by Edge. Required production checks: migrated object/role assertions, complete answer lifecycle, real-model target delivery/re-entry and fixture cleanup. The maintainer approved local independent reviews in place of unavailable GitHub Codex review; no additional approval is pending.

## Integrated production release in progress (2026-11-03)

PR #54 merged at 19:43:47 UTC. Integrated release: `4bb5b1b211c1c718dcb59b192cc9c5bd6681b40d`. Frozen integrated runtime manifest matches all 325 staging-tested files exactly, aggregate `599353e14a41f7bfa8a965085663f2e932fbd44f18dd6c0192907012c7697aca`; downloaded staging Edge matches all 11 integrated source modules. Evidence: `output/exit-assessment-20261103-delivery/integrated-artifacts.json` and `tutor-system/output/browser-draft/ciubrzggdqesgvfkpolj-assessment-api-4bb5b1b.json`. No conflict resolution or runtime drift occurred, so staging acceptance remains valid. An initial source comparison ran before fetch completed and could not resolve the new merge; it made no hosted changes and was rerun successfully after fetch.

Render deployment `dep-dbl3itl6e07s73dil8hg` builds the integrated frontend for `https://phishingtrainingprogram.onrender.com`. Production target: `zgbufaxooqxeabewktzd`; release owner: Codex. Planned mutation order remains frontend, exact migration, assessment-api. Selected production checks: live schema/role assertions through the transactional exit SQL test, full `assessment-answer` lifecycle and real-model `assessment-delivery`, persisted results/re-entry/tutor views and cleanup. Issue #46 stays open until those checks pass.

Render became live at 19:45:34 UTC. Published asset hashes: JS `a4834722c84bab2d040ed37d160668977956bd79ebc084f8800c6780bef3e819`, CSS `54b09011e4cc70ef228614e508f5be2be94f3e0f977105002438b26fa8d1f715`; report `production-web-artifacts.json` in the integrated evidence directory. Production MCP immediately before SQL confirmed all four affected definitions still matched the restored baseline and the visit table was absent.

Production SQL applied at 19:46:06 UTC with the exact staged migration hash. Transactional `exit_assessment.sql` passed at 19:46:16 UTC and rolled back all fixtures. Direct MCP confirms service_role can start visits while anon/authenticated cannot execute the RPC or access visit rows. Production assessment-api advanced v20→v21 at 19:46:41 UTC, source manifest `c07ffe3d0b0d722a874ac569620faf992c9c3918cde5ea77e74dcee09cd78871`, bundle `3421ec777c8316f3e3fca32e847f4e6159ba0c6e7d39dde685c5f9e493a9b037`; verify_jwt remains false. Downloaded production source matches all 11 integrated modules. Production application/permission checks have passed; browser acceptance is running against the actual Render site and remains open.

## Production verified (2026-11-03)

Production `assessment-answer` passed on the actual Render site in `production-template-20261103194710-456eb746`: pass, retry→pass, terminal failure, Guard recovery, cancellation/replacement review, saved result disclosure, re-entry and ordinary tutor focus. All three fixture-room cleanups passed. Production full-inventory real-model `assessment-delivery` passed in `production-template-20261103195002-491f5268`: seven assessments across the complete due queue, including domain and official support targets, each graded/persisted with one accepted attempt, terminal progress and read-only re-entry. Its cleanup passed. These runs used integrated release `4bb5b1b` and production Edge v21.

Independent readbacks at 19:53:16/18 UTC show zero fixture messages, sessions, checklists, assessments, learner visits, provider attempts and Guard-enabled rooms on production and staging. Reports: `output/exit-assessment-20261103-delivery/{production,staging}-cleanup.json`. Staging and production function definitions, ownership, ACLs, security-definer settings and search paths match. The owned staging leases and standalone production browser leases were released after cleanup; the local staging CRA server was stopped.

All release acceptance criteria are complete. Exact SQL is archived at `supabase/archived_migrations/20261031000000_exit_assessment.sql`, preserving SHA-256 `2870af69e0617eed4df7cc3c36d5fd334ce10de254ea55770f83aaae5347a2a1`; no pending exit migration remains. Gap G-78 is closed, and issue #46 can close. Final documentation/archival changes add no runtime behavior. Failed harness runs remain preserved above with their causes, repairs and passing affected reruns.
