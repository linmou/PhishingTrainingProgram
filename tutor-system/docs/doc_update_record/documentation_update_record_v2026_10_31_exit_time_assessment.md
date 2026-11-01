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
