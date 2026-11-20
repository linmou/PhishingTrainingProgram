# Issues #110 and #112: Guard grading and owner learner seat release

Intent: record the release of `20261119000000_guard_grading_and_owner_seat.sql` from local validation through production acceptance.

Updated: 2026-11-19. Base commit: `f5def40` (`origin/no_sign_up`). PR: #114.

| Field | Value |
| --- | --- |
| Release owner | Claude agent on branch `fix/110-112-guard-and-owner-seat` (worktree `agent-a14839e543eb429ff`). Owns staging and production SQL, verification, cleanup and archival for this batch. |
| Batch | #110 + #112. Members: one SQL migration plus a small frontend handler in `StudentView.tsx`. No Edge source change. Other agents' concurrent #109/#111 PRs are frontend-only and deploy no server changes. |
| Migration | `tutor-system/supabase/migrations/20261119000000_guard_grading_and_owner_seat.sql`, SHA-256 `c9ac43628de4b9768f345c5773dd44bfdcc3b4a802be9a2e7ed4be2bc34a6f0a`. Supersedes the initial candidate `ad88f98e…`, which was never deployed. |
| Status | `local tests passed` |

## Changed behavior and contracts

- **#110 (FR-38, AD-5):** every trusted write that resolves a learner answer reads `rooms.guard_mode` under the room row lock. This matters because the edge's processing context, and the Guard flag in it, may be stale by commit time.
  - `process_assessment_message_v2` (grading) runs the Guard check after the duplicate, CAS, terminal, transition and selection-validation checks. If Guard is on, it returns `record_transfer_assessment_processing_v1(..., 'guard_deferred')`.
  - `cancel_transfer_assessment_v1` (assisted closure) does the same for a non-duplicate cancel of an open assessment when Guard is on.
  - `record_transfer_assessment_processing_v1` stores `AMBIGUOUS_SELECTION`, `SELECTION_NOT_RECOGNIZED`, `SINGLE_SELECTION_CARDINALITY` and `unresolved` as `guard_deferred` when Guard is on. These are the codes the resolver ranks below Guard; `stale`, `duplicate` and `not_delivered` rank above it and are unchanged.
  - The held state is the existing one: `processing_state='deferred'`, `code='guard_deferred'`, no attempt, no result or closure message, and the assessment stays open. `get_transfer_assessment_processing_context_v1` already ignores `guard_deferred` rows once Guard is off, so the existing catch-up and `read_review` replay process the answer later, exactly once.
- **#112 (FR-12, AD-8):** `public.join_room_v1` returns early with `room_role='observer'` (and the current `learner_id`) when `p_student_id = rooms.tutor_id`, and never inserts a session for the owner.
  - A new `BEFORE INSERT OR UPDATE OF room_id, student_id, status` row trigger `prevent_owner_learner_seat` on `public.sessions` refuses any write that moves a row *into* the "active learner is the room owner" state, with SQLSTATE `23514` `OWNER_CANNOT_BE_LEARNER`. Its function `private.prevent_owner_learner_seat()` is SECURITY DEFINER, owned by `postgres`, uses `search_path` `public, private`, and grants no EXECUTE to `anon`, `authenticated` or `service_role`.
  - The trigger covers the `StudentView.tsx` legacy fallback insert and any direct table write.
  - `StudentView` now treats that error as "open the room read-only" (observer flag, navigate) instead of showing a raw error.
- **Existing data:** rows that already hold an owner seat are not rewritten and may still be updated or ended. Re-activating them is refused.
- **Preserved and guarded:** function owners, SECURITY DEFINER, `search_path`, signatures and grants are preserved (`CREATE OR REPLACE`). The migration first checks the live definition hashes of the four replaced functions and the absence of the new trigger function and trigger; any drift fails the whole transaction (`BASELINE_DRIFT`). The hashes were identical on staging and production on 2026-11-19:
  - `process_assessment_message_v2` `82e8b794…`
  - `join_room_v1` `81199a30…`
  - `record_transfer_assessment_processing_v1` `5b4dc2e2…`
  - `cancel_transfer_assessment_v1` `80420172…`
- **Edge:** `assessment-api` source is unchanged. `processMessage` passes the results of `process_assessment_message_v2` and `cancel_transfer_assessment_v1` through `projectProcessed`, which accepts a deferred result with no outcome or result message. Two Deno contract tests were added for those paths.
- **Expected post-application fingerprints** (`md5(pg_get_functiondef)`, from a local Green clone):

  | Function | Hash |
  | --- | --- |
  | `process_assessment_message_v2` | `1e234e08708f596485cf939a22600bb2` |
  | `join_room_v1` | `411c8835b21be202b272e72af2cc3dba` |
  | `record_transfer_assessment_processing_v1` | `2df6eb8b6059adb216f715aaef9780e0` |
  | `cancel_transfer_assessment_v1` | `edc389b9fe0b6a8ccf48deac6f7cea8d` |
  | `private.prevent_owner_learner_seat()` | `94f3d70452927d047a488c1eb3800f00` |

## Pre-existing owner-seat data (read-only, 2026-11-19)

| Project | Sessions where `student_id = rooms.tutor_id` |
| --- | --- |
| Staging `ciubrzggdqesgvfkpolj` | 0 (28 sessions, 28 active) |
| Production `zgbufaxooqxeabewktzd` | **1 active:** session `0564bc9a-a449-4da0-8961-599e9ca398d6`, room `74e8939a-424e-47f9-8d95-3fd794074418` (room active, created 2026-08-28, 3 messages, 1 session). Started 2026-09-02T02:25:02Z. The owner's profile role is now `tutor`. `sessions.tutor_id = rooms.tutor_id` for all rows on both projects. |

The production row was left in place. The trigger only refuses a transition *into* owner-as-learner, so the row neither blocks the migration nor blocks ending that session. After the release, `join_room_v1` reports the owner of that room as an observer. Until the row is ended, it still occupies that room's only learner seat, so other students also join as observers. Repairing or ending the row is a separate data decision for a maintainer.

## Code review

Codex on GitHub could not run on `671858e` (usage limit reached). The `code-review` skill (high effort) reviewed PR #114 at `671858e` and reported 10 findings.

| Finding | Disposition |
| --- | --- |
| 1. Assisted closure has the same Guard race | Fixed: `cancel_transfer_assessment_v1` re-checks Guard |
| 2. Clarification codes have the same Guard race | Fixed: `record_transfer_assessment_processing_v1` holds them under Guard |
| 3. Guard deferral ran before input validation | Fixed: the Guard check now follows the transition and selection checks |
| 4. StudentView showed the owner a raw 23514 error | Fixed: opens the room read-only; Jest test added (Red, then Green) |
| 7. Owner exclusion threaded through three conditions | Fixed: one early return |
| 9. `pg_catalog` listed last in the trigger function's `search_path` | Fixed: uses `public, private`, so the implicit `pg_catalog` comes first |
| 10. Race-script header named a missing file | Fixed |
| 5. The production owner-seat row still occupies the seat | Not changed: the row is reported, not repaired (see above) |
| 6. The `PROGRESSION_LOCKED` branch is now unreachable | Kept as unchanged, defensive live code to minimise the diff |
| 8. Extra queries when delegating to `record_transfer_assessment_processing_v1` | Accepted: reuse guarantees the identical held state; it only runs under Guard |

## Verification scope

Rows from the [verification scope](../supabase-release-workflow.md#verification-scope): database migration, plus grading/lifecycle/identity/permissions.

- **Local:** fresh-baseline Red/Green on both projects' exports; existing-data, permission, atomic-failure, re-application and concurrency (room-lock race) checks; Edge Deno suite; focused Jest; formal model and real-code harness.
- **Staging:**
  - Apply the exact SQL under the lease, then run the catalog fingerprint and grant checks.
  - Run the SQL assertion batch (fixture plus `guard_grading.sql` plus `owner_seat.sql`, in one transaction ending with a sentinel exception, so nothing is committed) against the live project.
  - Make a live PostgREST insert as the anon client for the owner (the StudentView fallback path).
  - Run the `assessment-answer` and `exit-assessment` browser journeys (grading, retry, Guard hold/replay); clean up fixtures.
- **Production:**
  - Recheck preconditions (function hashes, owner-seat rows), apply the same SQL, then run the fingerprint and grant checks.
  - Run the same rolled-back SQL assertion batch and the live owner PostgREST insert check on dedicated fixtures.
  - Run the `assessment-answer` journey; clean up.

## Local validation evidence

Private run package (outside Git, contains exported rows): `/Users/admin/.transfer-assessment-pg17/runs/guard-owner-seat-20261119/`.

- **Baseline:** fresh read-only Management API logical exports (`export.cjs`, `supplement.cjs`) at 2026-11-20T04:26Z.
  - Staging: 25 tables, 70 functions, 1,149 rows. Snapshot SHA-256 `4dbe99f9…a8f03f8a1`.
  - Production: 25 tables, 70 functions, 3,493 rows. Snapshot SHA-256 `05dd8d4a…2db2ff73`.
  - Hosted PostgreSQL 17.11 (staging) / 17.4 (production). Local validation cluster: PostgreSQL 17.12, socket port 55433.
  - Restored as `guard_seat_staging_baseline_20261119` and `guard_seat_production_baseline_20261119`. Each used source owner, encoding and locale (`postgres`, UTF8, en_US.UTF-8), database ACLs and `app.settings.jwt_exp`. Roles matched, with no flag differences.
  - `restore.py` catalog comparison found no differences in tables, constraints, indexes, triggers, policies, table, function or schema grants, or row counts. The only finding is representational: two unrelated trigger functions (`private.enforce_practice_message`, `private.protect_cyberbullying_targets`) have NULL (default) ACL at the source and the explicit equivalent `{postgres=X,=X}` locally. Effective grants are identical, and the candidate does not touch them.
- **Executor:** `postgres` (non-superuser, as hosted), one transaction (`psql --single-transaction`). Each scenario ran in its own `scripts/database/disposable-database.js` clone. Clone ACL and settings parity passed, and every clone was cleaned (leases under `runs/scenario-*`).
- **Red** (unmodified baselines, both projects; `red-staging.log`, `red-production.log`, `red-paths.log`):
  - `guard_grading.sql` failed: graded "Incorrect. One attempt remaining." with Guard on.
  - `owner_seat.sql` failed: `join_room_v1` returned `room_role='student'` for the owner.
  - `guard_grading_race.sh` failed: an attempt was used after Guard turned on, with the competing session observed waiting on the room lock.
  - `red-paths.sql` with Guard on: a clarification was stored as `rejected` and an assisted cancel applied `assisted`. With the candidate, both return `guard_deferred` and the assessment stays open.
- **Green** (both projects; `green-*.log`):
  - The fixture ran before the migration (including a pre-existing owner seat), then the exact SQL was applied.
  - Owner-seat rows were identical before and after: staging fixture 1; production fixture plus the real `0564bc9a…` row, 2.
  - Catalog: owners, SECURITY DEFINER, `search_path` and ACLs preserved. The trigger function is not executable by `anon`, `authenticated` or `service_role`.
  - `guard_grading.sql` passed: hold, repeat and correct-answer hold; CAS precedence; invalid selection still rejected; clarification and assisted holds; replay grading, duplicate and assisted replay; browser-role denial.
  - `owner_seat.sql` passed: owner observer; anon, authenticated, service_role and forged-tutor inserts refused; reactivation and seat-move refused; a real student still seated; the legacy row kept, updatable and endable.
  - `guard_grading_race.sh` passed.
  - A second application failed with `BASELINE_DRIFT` and left functions, triggers and sessions unchanged.
- **Atomic drift:** after the precondition `join_room_v1` was changed (`ALTER FUNCTION … SET work_mem`), the migration failed with `BASELINE_DRIFT: public.join_room_v1` and state was unchanged (`atomic-*.log`).
- **Live batch rehearsal:** `live-assertions.sql` (built by `bundle.py` from the committed test files) ended on `ALL_ASSERTIONS_PASSED_ROLLED_BACK` against Green clones of both baselines. No fixture users were left behind and the trigger was still enabled.
- **Edge:** `deno test --allow-env --allow-net --allow-run --allow-read --no-check supabase/functions/assessment-api/index.test.ts` with Deno 2.5.6 (npm `deno`, scratch install): 63 passed, 0 failed. This includes both Guard-deferral projection tests and the Edge type check. Deno tests are not part of PR CI.
- **Jest:** `react-scripts test src/pages/__tests__/StudentView*`: 3 suites, 15 tests passed. The new owner-fallback test fails against the pre-fix `StudentView.tsx`.
- **Formal verification:** a copy of the assessment-integrity skill has its "current" configs aligned to the fixed code, the SQL port updated and old behavior kept as `mutant-*` configs. Run as `REPO=<worktree> run.sh all`; result `ALL CHECKS AS RECORDED`.
  - Pass: `current-guard`, `current-owner`, `current-safety*`.
  - Fail as expected: `mutant-no-guard-recheck`, `mutant-owner-unchecked`, `partial-fix-rpc-only`, and `current-duplicate` (#111, still open in another PR).
  - Real-code harness: `guard` holds, `guardControl` holds, and `duplicate` is broken as expected (#111).
  - The model does not cover the clarification and assisted paths ("Not covered" in the skill). They are covered by the SQL tests above.

## Staging (ciubrzggdqesgvfkpolj): staging verified

- **Candidate:** `f2bf67aaebb5b58adbf6dc245106220c91a52435` (PR #114 head; CI `isolation-harness`, `frontend-jest` and `frontend-build` passed).
- **Lease:** `refs/tags/verification-locks/ciubrzggdqesgvfkpolj`, tag `f24ec20155d37a0496f7048ba119fce336aebec9`, run `bc549b1c-9ed3-44eb-b1da-e69db589b86f`, acquired 2026-11-20T05:00:40Z for the exact candidate. No other lease existed.
- **Preconditions (05:01Z):** the four function hashes matched the expected values. The trigger and its function were absent. 0 owner seats, 0 fixture rows. Latest migration was `20261115213658`.
- **Application:** Supabase MCP `apply_migration` `guard_grading_and_owner_seat` with the exact file content, SHA-256 `c9ac4362…a6f0a`. Result: success; history entry `20261120050152 guard_grading_and_owner_seat`.
- **Catalog:** all five function `md5(pg_get_functiondef)` values equal the local Green fingerprint (`1e234e08…`, `2df6eb8b…`, `edc389b9…`, `411c8835…`, `94f3d704…`). Owners, SECURITY DEFINER, `search_path` and ACLs are unchanged from before. The trigger is enabled (`O`), and its function is not executable by `anon`, `authenticated` or `service_role`.
- **Live SQL assertions:** the `live-assertions.sql` batch (SHA-256 `bbf21c20…b0470`, from the committed fixture, `guard_grading.sql` and `owner_seat.sql`) ran through MCP in one transaction. It ended with `P0001 ALL_ASSERTIONS_PASSED_ROLLED_BACK`, so every #110 and #112 assertion passed against the hosted functions. Follow-up check: 0 fixture users, rooms or sessions; no helper table; trigger still enabled; no idle-in-transaction sessions.
- **Live StudentView fallback path (PostgREST, anon key, `x-practice-contract`):** inserting an active session for the room owner returned HTTP 400 `23514 OWNER_CANNOT_BE_LEARNER`. The non-owner control insert returned 201 (`staging-live-owner-insert.json`).
- **Browser journeys** (candidate app against staging, runner borrowing the lease):
  - `assessment-answer`: pass (`staging-template-20261120050430-51c285bf`). Cleanup passed for rooms `d6b6b8f0…`, `79be49a2…` and `286de02f…`.
  - `exit-assessment`: pass (`staging-template-20261120050700-e50753c0`). This includes the Guard-held answer (`deferred/guard_deferred`, zero attempts) and its recovery. Cleanup passed for room `d6b6b8f0…`.
- **Cleanup exception (open):** the committed fixture for the PostgREST check is still on staging, because the cleanup `DELETE` through MCP was declined by the operator permission system. The leftover rows are tagged and inert:
  - users `f1120000-0000-4000-8000-000000000001` and `…0002`;
  - room `f1120000-0000-4000-8000-000000000011` ("owner seat live check (#112, temporary)");
  - one active session in that room for `…0002`.

  To remove them, run `DELETE FROM public.sessions WHERE room_id='f1120000-0000-4000-8000-000000000011'; DELETE FROM public.rooms WHERE id='f1120000-0000-4000-8000-000000000011'; DELETE FROM public.users WHERE id IN ('f1120000-0000-4000-8000-000000000001','f1120000-0000-4000-8000-000000000002');` under an approved operator session. Production checks therefore use only rolled-back fixtures.

## Hosted state

- **Staging:** migration applied and verified, with the cleanup exception above.
- **Production:** unchanged.
- **Next:** merge PR #114 → integrated manifest comparison → production preconditions → apply the same SQL → fingerprint, rolled-back live assertions and the `assessment-answer` journey.
