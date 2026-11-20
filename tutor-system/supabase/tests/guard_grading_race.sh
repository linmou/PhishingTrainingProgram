#!/bin/sh
# Purpose: #110 race. Session A (the owner) turns Guard on and holds the room row; session B (the edge,
# service_role) calls process_assessment_message_v2 with the grade it computed while Guard was off and
# blocks on the room lock. After A commits, B must defer the answer: no attempt, no result message.
# Run inside an owned disposable database (scripts/database/disposable-database.js) after
# guard_grading_and_owner_seat.fixture.sql and the candidate migration, as the postgres executor
# (guard_grading.sql and owner_seat.sql roll back, so they may run before or after this script).
set -eu
: "${MIGRATION_TEST_DB:?Use scripts/database/disposable-database.js}"
: "${PG_VALIDATION_LEASE_FILE:?Disposable database lease is required}"
PSQL="${PSQL:-psql}"
run() { "$PSQL" -X -q -v ON_ERROR_STOP=1 "$@"; }
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

run -c "SELECT 1 FROM public.rooms WHERE id='f1100000-0000-4000-8000-000000000011' AND NOT guard_mode" -At | grep -q 1 \
  || { echo 'fixture room must start with Guard off' >&2; exit 1; }

# Session A: owner turns Guard on and keeps the transaction open until B is observed waiting.
run >"$out/a.log" 2>&1 <<'SQL' &
SET application_name = 'guard_race_owner';
BEGIN;
UPDATE public.rooms SET guard_mode = TRUE WHERE id = 'f1100000-0000-4000-8000-000000000011';
SELECT pg_sleep(4);
COMMIT;
SQL
a_pid=$!

i=0
until run -At -c "SELECT 1 FROM pg_stat_activity WHERE application_name='guard_race_owner' AND query LIKE '%pg_sleep%'" | grep -q 1; do
  i=$((i+1)); [ "$i" -lt 100 ] || { echo 'session A did not take the room lock' >&2; exit 1; }; sleep 0.05
done

# Session B: the edge commits its stale grade (wrong option, attempt 1 -> retry).
run -At >"$out/b.log" 2>&1 <<'SQL' &
SET application_name = 'guard_race_edge';
SET request.headers = '{"x-practice-contract":"cyberbullying-v2"}';
SET ROLE service_role;
SELECT public.process_assessment_message_v2(f.assessment_id, f.answer_wrong, f.student_id, gen_random_uuid(),
  0, 'open', 'retry', ARRAY['A'], jsonb_build_object('status','partially_covered','understanding_level','basic'), NULL)
FROM public.guard_seat_fixture f;
SQL
b_pid=$!

waited=no
i=0
while kill -0 "$a_pid" 2>/dev/null; do
  if run -At -c "SELECT 1 FROM pg_stat_activity WHERE application_name='guard_race_edge' AND wait_event_type='Lock'" | grep -q 1; then
    waited=yes; break
  fi
  i=$((i+1)); [ "$i" -lt 200 ] || break; sleep 0.05
done
a_status=0; b_status=0
wait "$a_pid" || a_status=$?
wait "$b_pid" || b_status=$?
cat "$out/a.log" "$out/b.log"
[ "$a_status" -eq 0 ] && [ "$b_status" -eq 0 ] || { echo "session exit A=$a_status B=$b_status" >&2; exit 1; }
[ "$waited" = yes ] || { echo 'session B was never observed waiting on the room lock' >&2; exit 1; }
echo 'competing_session_waited_on_room_lock'

run <<'SQL'
DO $assert$
DECLARE f public.guard_seat_fixture%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.guard_seat_fixture;
  ASSERT (SELECT attempt_count FROM private.transfer_assessments WHERE id = f.assessment_id) = 0,
    '#110 race: an attempt was used after Guard turned on';
  ASSERT NOT EXISTS (SELECT 1 FROM private.transfer_assessment_attempts WHERE assessment_id = f.assessment_id),
    '#110 race: an attempt row was written after Guard turned on';
  ASSERT NOT EXISTS (SELECT 1 FROM public.messages WHERE assessment_event->>'kind' = 'result'
    AND assessment_event->>'answer_message_id' = f.answer_wrong::text), '#110 race: a result message was written under Guard';
  ASSERT (SELECT code FROM private.transfer_assessment_processing WHERE answer_message_id = f.answer_wrong) = 'guard_deferred',
    '#110 race: the held answer was not recorded as guard_deferred';
END;
$assert$;
SELECT 'guard_grading_race' AS case_id, TRUE AS ok;
SQL
