# Issues #110 and #112: Guard grading and owner learner seat release

Intent: record the release of `20261119000000_guard_grading_and_owner_seat.sql` from local validation through production acceptance.

Updated: 2026-11-19. Base commit: `f5def40` (`origin/no_sign_up`).

| Field | Value |
| --- | --- |
| Release owner | Claude agent on branch `fix/110-112-guard-and-owner-seat` (worktree `agent-a14839e543eb429ff`). Owns staging and production SQL, verification, cleanup and archival for this batch. |
| Batch | #110 + #112, a single SQL migration. No Edge source or frontend runtime change. Other agents' concurrent #109/#111 PRs are frontend-only and deploy no server changes. |
| Migration | `tutor-system/supabase/migrations/20261119000000_guard_grading_and_owner_seat.sql`, SHA-256 `ad88f98e873e1496e61359eb0da1e4908774a32e24d2ce6e1c3fb3996b9759f7` |
| Status | `local tests passed` |

## Changed behavior and contracts

- **#110 (FR-38, AD-5):** `public.process_assessment_message_v2` reads `rooms.guard_mode` under the room row lock it already takes. If Guard is on (after the duplicate, CAS and terminal checks), it returns `public.record_transfer_assessment_processing_v1(..., 'guard_deferred')`. That is the existing held state: `processing_state='deferred'`, `code='guard_deferred'`, no attempt, no result message, assessment stays open. `get_transfer_assessment_processing_context_v1` already ignores `guard_deferred` rows once Guard is off, so the existing catch-up and `read_review` replay grade the answer later, exactly once.
- **#112 (FR-12, AD-8):** `public.join_room_v1` returns `room_role='observer'` and never inserts a session when `p_student_id = rooms.tutor_id`. A new `BEFORE INSERT OR UPDATE OF room_id, student_id, status` row trigger `prevent_owner_learner_seat` on `public.sessions` (function `private.prevent_owner_learner_seat()`, SECURITY DEFINER, owner `postgres`, no EXECUTE for `anon`/`authenticated`/`service_role`) refuses any write that moves a row *into* the "active learner is the room owner" state, with SQLSTATE `23514` `OWNER_CANNOT_BE_LEARNER`. This covers the `StudentView.tsx` legacy fallback insert and any direct table write. The frontend fallback is unchanged: it now receives an error instead of seating the owner.
- **Existing data:** rows that already hold an owner seat are not rewritten and may still be updated or ended. Re-activating them is refused.
- Function owners, SECURITY DEFINER, `search_path`, signatures and grants are preserved (`CREATE OR REPLACE`). The migration first checks the live definition hashes of the three affected functions (`82e8b794…`, `81199a30…`, `5b4dc2e2…`, identical on staging and production on 2026-11-19) and the absence of the new trigger. Any drift fails the whole transaction (`BASELINE_DRIFT`).
- **Edge:** `assessment-api` needs no change. `processMessage` already passes the `process_assessment_message_v2` result through `projectProcessed`, which accepts a deferred result with no outcome or result message (the same shape as the existing `guard_deferred` path). A Deno contract test was added for this path.

## Pre-existing owner-seat data (read-only, 2026-11-19)

| Project | Sessions where `student_id = rooms.tutor_id` |
| --- | --- |
| Staging `ciubrzggdqesgvfkpolj` | 0 (28 sessions, 28 active) |
| Production `zgbufaxooqxeabewktzd` | **1 active:** session `0564bc9a-a449-4da0-8961-599e9ca398d6`, room `74e8939a-424e-47f9-8d95-3fd794074418` (room active, created 2026-08-28, 3 messages, 1 session). Started 2026-09-02T02:25:02Z. The owner's profile role is now `tutor`. `sessions.tutor_id = rooms.tutor_id` for all rows on both projects. |

The production row was left in place. The trigger design (refusing only a transition into owner-as-learner) means it neither blocks the migration nor blocks ending that session. After the release, `join_room_v1` reports the owner of that room as an observer. Repairing or ending the row is a separate data decision for a maintainer.

## Verification scope

Rows from the [verification scope](../supabase-release-workflow.md#verification-scope): database migration, plus grading/lifecycle/identity/permissions.

- Local: fresh-baseline Red/Green on both projects' exports; existing-data, permission, atomic-failure, re-application and concurrency (room-lock race) checks; Edge Deno suite; formal model and real-code harness.
- Staging: apply exact SQL under lease, then catalog and grant checks. Run the same SQL assertions transactionally (rolled back) against the live project. Run a live Edge `process_message` with Guard turned on after posting, and a live `join_room` as an owner in the student role. Run the `assessment-answer` browser journey (covers Guard hold/replay, retry and grading), then clean up fixtures.
- Production: recheck preconditions (function hashes, owner-seat rows), apply the same SQL, run catalog checks and the rolled-back SQL assertions, run the live Edge Guard and owner-join checks on dedicated fixtures, then clean up.

## Local validation evidence

Private run package (outside Git, contains exported rows): `/Users/admin/.transfer-assessment-pg17/runs/guard-owner-seat-20261119/`.

- **Baseline:** fresh read-only Management API logical exports (`export.cjs`, `supplement.cjs`) at 2026-11-20T04:26Z.
  - Staging: 25 tables, 70 functions, 1,149 rows. Snapshot SHA-256 `4dbe99f9…a8f03f8a1`.
  - Production: 25 tables, 70 functions, 3,493 rows. Snapshot SHA-256 `05dd8d4a…2db2ff73`.
  - Hosted PostgreSQL 17.11 (staging) / 17.4 (production). Local validation cluster: PostgreSQL 17.12, socket port 55433.
  - Restored as `guard_seat_staging_baseline_20261119` and `guard_seat_production_baseline_20261119`. Each used source owner, encoding and locale (`postgres`, UTF8, en_US.UTF-8), database ACLs and `app.settings.jwt_exp`. Roles matched, with no flag differences.
  - `restore.py` catalog comparison found no differences in tables, constraints, indexes, triggers, policies, table, function or schema grants, or row counts. The only finding is representational: two unrelated trigger functions (`private.enforce_practice_message`, `private.protect_cyberbullying_targets`) have NULL (default) ACL at the source and the explicit equivalent `{postgres=X,=X}` locally. Effective grants are identical, and the candidate does not touch them.
- **Executor:** `postgres` (non-superuser, as hosted), one transaction (`psql --single-transaction`). Each scenario ran in its own `scripts/database/disposable-database.js` clone. Clone ACL and settings parity passed, and every clone was cleaned (leases under `runs/scenario-*`).
- **Red** (unmodified baselines, both projects; `red-staging.log`, `red-production.log`):
  - `guard_grading.sql` failed: graded "Incorrect. One attempt remaining." with Guard on.
  - `owner_seat.sql` failed: `join_room_v1` returned `room_role='student'` for the owner.
  - `guard_grading_race.sh` failed: an attempt was used after Guard turned on, with the competing session observed waiting on the room lock.
- **Green** (both projects; `green-*.log`):
  - The fixture ran before the migration (including a pre-existing owner seat), then the exact SQL was applied.
  - Owner-seat rows were identical before and after: staging fixture 1; production fixture plus the real `0564bc9a…` row, 2.
  - Catalog: owners, SECURITY DEFINER, `search_path` and ACLs preserved. The trigger function is not executable by `anon`, `authenticated` or `service_role`.
  - `guard_grading.sql`, `owner_seat.sql` and `guard_grading_race.sh` all passed.
  - A second application failed with `BASELINE_DRIFT` and left functions, triggers and sessions unchanged.
- **Atomic drift:** after the precondition `join_room_v1` was changed (`ALTER FUNCTION … SET work_mem`), the migration failed with `BASELINE_DRIFT: public.join_room_v1` and state was unchanged (`atomic-*.log`).
- **Edge:** `deno test --allow-env --allow-net --allow-run --allow-read --no-check supabase/functions/assessment-api/index.test.ts` with Deno 2.5.6 (npm `deno`, scratch install): 62 passed, 0 failed. This includes the new Guard-deferral projection test and the Edge type check. Deno tests are not part of PR CI.
- **Formal verification:** a copy of the assessment-integrity skill has its "current" configs aligned to the fixed code, the SQL port updated and old behavior kept as `mutant-*` configs. Run as `REPO=<worktree> run.sh all`; result `ALL CHECKS AS RECORDED`.
  - Pass: `current-guard`, `current-owner`, `current-safety*`.
  - Fail as expected: `mutant-no-guard-recheck`, `mutant-owner-unchecked`, `partial-fix-rpc-only`, and `current-duplicate` (#111, still open in another PR).
  - Real-code harness: `guard` holds, `guardControl` holds, and `duplicate` is broken as expected (#111).

## Hosted state

Not yet changed. Next: open PR → CI and review → acquire the staging lease → apply SQL and run the staging checks above → merge → integrated manifest comparison → production.
