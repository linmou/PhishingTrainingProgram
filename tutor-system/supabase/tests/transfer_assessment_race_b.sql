--!/usr/bin/env psql
-- Purpose: submit the distinct competing answer while session A holds the room lock.

\set ON_ERROR_STOP on
SET application_name = 'transfer_assessment_race_b';
BEGIN;

SELECT public.process_assessment_message_v2(
  a.id, m.id, a.student_id, gen_random_uuid(), 0, 'open', 'retry', ARRAY['A'],
  jsonb_build_object('status', 'partially_covered', 'understanding_level', 'basic'), NULL
)->>'code' = 'CONCURRENT_MODIFICATION' AS cas_conflict
FROM private.transfer_assessments a
JOIN public.messages m ON m.assessment_id = a.id
WHERE a.delivery_request_id = CASE :'scenario'
    WHEN 'wrong_wrong' THEN 'f1020000-0000-4000-8000-000000000115'::UUID
    WHEN 'correct_wrong' THEN 'f1020000-0000-4000-8000-000000000125'::UUID END
  AND m.assessment_request_id = CASE :'scenario'
    WHEN 'wrong_wrong' THEN 'f1020000-0000-4000-8000-000000000117'::UUID
    WHEN 'correct_wrong' THEN 'f1020000-0000-4000-8000-000000000127'::UUID END
\gset

\if :cas_conflict
\else
  DO $fail$ BEGIN RAISE EXCEPTION 'session B did not receive CAS conflict'; END; $fail$;
\endif

COMMIT;
