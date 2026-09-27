--!/usr/bin/env psql
-- Purpose: confirm session B is blocked on a PostgreSQL lock before session A commits.

DO $observe$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_stat_activity
    WHERE application_name = 'transfer_assessment_race_b'
      AND wait_event_type = 'Lock'
  ) THEN
    RAISE EXCEPTION 'competing session is not waiting on a lock';
  END IF;
END;
$observe$;

SELECT 'competing_session_waiting_on_lock' AS case_id, TRUE AS ok;
