--!/usr/bin/env psql
-- Purpose: hold the first terminal or retry processing transaction until the competing session blocks.

\set ON_ERROR_STOP on
SET application_name = 'transfer_assessment_race_a';
BEGIN;

SELECT public.process_assessment_message_v2(
  a.id, m.id, a.student_id, gen_random_uuid(), 0, 'open',
  CASE WHEN :'scenario' = 'correct_wrong' THEN 'passed' ELSE 'retry' END,
  CASE WHEN :'scenario' = 'correct_wrong' THEN ARRAY['B'] ELSE ARRAY['A'] END,
  CASE WHEN :'scenario' = 'correct_wrong'
    THEN jsonb_build_object('status', 'covered', 'understanding_level', 'good')
    ELSE jsonb_build_object('status', 'partially_covered', 'understanding_level', 'basic') END,
  CASE WHEN :'scenario' = 'correct_wrong' THEN 'assessment_pass' ELSE NULL END
)->>'answer_outcome' = CASE WHEN :'scenario' = 'correct_wrong' THEN 'passed' ELSE 'retry' END
  AS first_ok
FROM private.transfer_assessments a
JOIN public.messages m ON m.assessment_id = a.id
WHERE a.delivery_request_id = CASE :'scenario'
    WHEN 'wrong_wrong' THEN 'f1020000-0000-4000-8000-000000000115'::UUID
    WHEN 'correct_wrong' THEN 'f1020000-0000-4000-8000-000000000125'::UUID
    WHEN 'wrong_correct' THEN 'f1020000-0000-4000-8000-000000000135'::UUID END
  AND m.assessment_request_id = CASE :'scenario'
    WHEN 'wrong_wrong' THEN 'f1020000-0000-4000-8000-000000000116'::UUID
    WHEN 'correct_wrong' THEN 'f1020000-0000-4000-8000-000000000126'::UUID
    WHEN 'wrong_correct' THEN 'f1020000-0000-4000-8000-000000000136'::UUID END
\gset

\if :first_ok
\else
  DO $fail$ BEGIN RAISE EXCEPTION 'session A did not commit expected answer outcome'; END; $fail$;
\endif

\prompt 'Start session B, confirm its Lock wait with race_observer.sql, then press Enter to commit A: ' race_barrier
COMMIT;
