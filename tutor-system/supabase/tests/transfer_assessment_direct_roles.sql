--!/usr/bin/env psql
-- Purpose: prove API roles cannot mutate transfer authority or invoke legacy grading RPCs.

BEGIN;
CREATE TEMP TABLE transfer_direct_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM private.transfer_assessment_attempts) AS attempts,
  (SELECT count(*) FROM private.learning_event_inbox) AS events,
  (SELECT count(*) FROM public.coverage_evidence) AS evidence,
  (SELECT count(*) FROM public.checklist_updates) AS updates;
CREATE TEMP TABLE transfer_direct_results(role_name TEXT, path TEXT, sqlstate TEXT) ON COMMIT DROP;

SET LOCAL ROLE anon;
DO $attack$
DECLARE v_rows INTEGER;
BEGIN
  BEGIN
    PERFORM public.process_assessment_message_v2(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      0, 'open', 'passed', ARRAY['B'], '{}'::JSONB, 'assessment_pass'
    );
    PERFORM set_config('app.transfer_direct_rpc_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_rpc_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM public.process_assessment_message_v1(gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
    PERFORM set_config('app.transfer_direct_legacy_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_legacy_result', SQLSTATE, true);
  END;
  BEGIN
    UPDATE private.learning_event_inbox SET processing_state = 'applied' WHERE FALSE;
    PERFORM set_config('app.transfer_direct_table_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_table_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM count(*) FROM private.transfer_assessments;
    PERFORM set_config('app.transfer_direct_read_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_read_result', SQLSTATE, true);
  END;
  BEGIN
    UPDATE public.checklist_items SET status = 'covered', understanding_level = 'good'
    WHERE id = 'f1020000-0000-4000-8000-000000000113';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM set_config('app.transfer_direct_progress_result',
      CASE WHEN v_rows = 0 THEN 'RLS_0' ELSE 'unexpected_success' END, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_progress_result', SQLSTATE, true);
  END;
END;
$attack$;
RESET ROLE;
INSERT INTO transfer_direct_results VALUES
  ('anon', 'v2_rpc', current_setting('app.transfer_direct_rpc_result', true)),
  ('anon', 'legacy_rpc', current_setting('app.transfer_direct_legacy_result', true)),
  ('anon', 'private_table', current_setting('app.transfer_direct_table_result', true)),
  ('anon', 'private_read', current_setting('app.transfer_direct_read_result', true)),
  ('anon', 'progress_write', current_setting('app.transfer_direct_progress_result', true));

SET LOCAL ROLE authenticated;
DO $attack$
DECLARE v_rows INTEGER;
BEGIN
  BEGIN
    PERFORM public.process_assessment_message_v2(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      0, 'open', 'passed', ARRAY['B'], '{}'::JSONB, 'assessment_pass'
    );
    PERFORM set_config('app.transfer_direct_rpc_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_rpc_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM public.process_assessment_message_v1(gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
    PERFORM set_config('app.transfer_direct_legacy_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_legacy_result', SQLSTATE, true);
  END;
  BEGIN
    UPDATE private.learning_event_inbox SET processing_state = 'applied' WHERE FALSE;
    PERFORM set_config('app.transfer_direct_table_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_table_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM count(*) FROM private.transfer_assessments;
    PERFORM set_config('app.transfer_direct_read_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_read_result', SQLSTATE, true);
  END;
  BEGIN
    UPDATE public.checklist_items SET status = 'covered', understanding_level = 'good'
    WHERE id = 'f1020000-0000-4000-8000-000000000113';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM set_config('app.transfer_direct_progress_result',
      CASE WHEN v_rows = 0 THEN 'RLS_0' ELSE 'unexpected_success' END, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_progress_result', SQLSTATE, true);
  END;
END;
$attack$;
RESET ROLE;
INSERT INTO transfer_direct_results VALUES
  ('authenticated', 'v2_rpc', current_setting('app.transfer_direct_rpc_result', true)),
  ('authenticated', 'legacy_rpc', current_setting('app.transfer_direct_legacy_result', true)),
  ('authenticated', 'private_table', current_setting('app.transfer_direct_table_result', true)),
  ('authenticated', 'private_read', current_setting('app.transfer_direct_read_result', true)),
  ('authenticated', 'progress_write', current_setting('app.transfer_direct_progress_result', true));

DO $assert$
BEGIN
  IF (SELECT count(*) FROM transfer_direct_results
      WHERE path <> 'progress_write' AND sqlstate = '42501') <> 8
     OR (SELECT count(*) FROM transfer_direct_results
      WHERE path = 'progress_write' AND sqlstate IN ('42501', 'RLS_0')) <> 2
     OR EXISTS (
       SELECT 1 FROM transfer_direct_before b
       WHERE b.attempts <> (SELECT count(*) FROM private.transfer_assessment_attempts)
          OR b.events <> (SELECT count(*) FROM private.learning_event_inbox)
          OR b.evidence <> (SELECT count(*) FROM public.coverage_evidence)
          OR b.updates <> (SELECT count(*) FROM public.checklist_updates)
     ) THEN
    RAISE EXCEPTION 'direct-role denial or zero-mutation check failed';
  END IF;
END;
$assert$;

SELECT * FROM transfer_direct_results ORDER BY role_name, path;
ROLLBACK;
