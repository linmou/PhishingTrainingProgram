--!/usr/bin/env psql
-- Purpose: regression assertions for #110: no answer is graded while Guard is on, and a held answer is
-- replayed once Guard is off. Run as postgres after guard_grading_and_owner_seat.fixture.sql; every
-- mutation is rolled back. Fails on the pre-fix baseline (Red) and passes after the migration (Green).

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL request.headers = '{"x-practice-contract":"cyberbullying-v2"}';

-- ---------------------------------------------------------------------------------------------
-- #110 Guard flip between the edge's context read and process_assessment_message_v2.
-- ---------------------------------------------------------------------------------------------
SET LOCAL ROLE service_role;
DO $guard$
DECLARE
  f public.guard_seat_fixture%ROWTYPE;
  v_ctx jsonb;
  v_result jsonb;
BEGIN
  SELECT * INTO f FROM public.guard_seat_fixture;
  -- 1. The edge reads the processing context while Guard is off.
  v_ctx := public.get_transfer_assessment_processing_context_v1(f.assessment_id, f.answer_wrong, f.student_id);
  ASSERT (v_ctx->'context'->>'guard_mode')::boolean IS FALSE, 'fixture must start with Guard off';
  ASSERT (v_ctx->'context'->'attempt_snapshot'->>'accepted_attempt_count')::int = 0, 'fixture must start with no attempts';
END;
$guard$;
RESET ROLE;

-- 2. The owner turns Guard on.
UPDATE public.rooms SET guard_mode = TRUE WHERE id = 'f1100000-0000-4000-8000-000000000011';

SET LOCAL ROLE service_role;
DO $guard$
DECLARE
  f public.guard_seat_fixture%ROWTYPE;
  v_result jsonb;
  v_ctx jsonb;
BEGIN
  SELECT * INTO f FROM public.guard_seat_fixture;
  -- 3. The edge commits the grade it computed from the stale context.
  v_result := public.process_assessment_message_v2(f.assessment_id, f.answer_wrong, f.student_id, gen_random_uuid(),
    0, 'open', 'retry', ARRAY['A'], jsonb_build_object('status','partially_covered','understanding_level','basic'), NULL);
  ASSERT v_result->>'processing_state' = 'deferred',
    format('#110: answer must be deferred while Guard is on, got %s', v_result);
  ASSERT v_result->>'code' = 'guard_deferred', format('#110: expected guard_deferred code, got %s', v_result->>'code');
  ASSERT v_result->>'answer_outcome' IS NULL AND v_result->>'attempt_number' IS NULL,
    '#110: a deferred answer has no outcome or attempt number';
  ASSERT (v_result->>'attempts_used')::int = 0 AND (v_result->>'attempts_remaining')::int = 2,
    '#110: a deferred answer must not use an attempt';
  ASSERT jsonb_typeof(v_result->'result_message') IS DISTINCT FROM 'object', '#110: no result message while Guard is on';
  ASSERT (SELECT attempt_count FROM private.transfer_assessments WHERE id = f.assessment_id) = 0,
    '#110: attempt count changed while Guard is on';
  ASSERT NOT EXISTS (SELECT 1 FROM private.transfer_assessment_attempts WHERE assessment_id = f.assessment_id),
    '#110: an attempt row was written while Guard is on';
  ASSERT NOT EXISTS (SELECT 1 FROM public.messages WHERE assessment_event->>'kind' = 'result'
      AND assessment_event->>'answer_message_id' = f.answer_wrong::text), '#110: a result message was written while Guard is on';
  ASSERT (SELECT code FROM private.transfer_assessment_processing WHERE answer_message_id = f.answer_wrong) = 'guard_deferred',
    '#110: the held answer must be recorded as guard_deferred';
  ASSERT (SELECT lifecycle FROM private.transfer_assessments WHERE id = f.assessment_id) = 'open', '#110: assessment must stay open';

  -- 4. A repeat while Guard is still on stays held (no attempt), and the context reports it as held.
  v_result := public.process_assessment_message_v2(f.assessment_id, f.answer_wrong, f.student_id, gen_random_uuid(),
    0, 'open', 'retry', ARRAY['A'], jsonb_build_object('status','partially_covered','understanding_level','basic'), NULL);
  ASSERT v_result->>'processing_state' = 'deferred', '#110: repeated processing under Guard must stay deferred';
  ASSERT (SELECT attempt_count FROM private.transfer_assessments WHERE id = f.assessment_id) = 0, '#110: repeat used an attempt';
  v_ctx := public.get_transfer_assessment_processing_context_v1(f.assessment_id, f.answer_wrong, f.student_id);
  ASSERT v_ctx->'authoritative_result'->>'code' = 'guard_deferred', '#110: context must report the held answer while Guard is on';

  -- 5. A terminal-looking (correct) answer is also held, not passed.
  v_result := public.process_assessment_message_v2(f.assessment_id, f.answer_right, f.student_id, gen_random_uuid(),
    0, 'open', 'passed', ARRAY['B'], jsonb_build_object('status','covered','understanding_level','good'), 'assessment_pass');
  ASSERT v_result->>'processing_state' = 'deferred', '#110: a correct answer must also be deferred while Guard is on';
  ASSERT (SELECT lifecycle FROM private.transfer_assessments WHERE id = f.assessment_id) = 'open', '#110: Guard pass closed the assessment';

  -- 6. Stale expectations still win over Guard (edge re-reads the context and retries).
  v_result := public.process_assessment_message_v2(f.assessment_id, f.answer_wrong, f.student_id, gen_random_uuid(),
    1, 'open', 'failed', ARRAY['A'], jsonb_build_object('status','needs_review','understanding_level','basic'), 'assessment_fail');
  ASSERT v_result->>'code' = 'CONCURRENT_MODIFICATION', '#110: stale attempt count must still report CONCURRENT_MODIFICATION';
END;
$guard$;
RESET ROLE;

-- 7. Guard off: the held answer is replayable and is graded exactly once.
UPDATE public.rooms SET guard_mode = FALSE WHERE id = 'f1100000-0000-4000-8000-000000000011';
SET LOCAL ROLE service_role;
DO $replay$
DECLARE
  f public.guard_seat_fixture%ROWTYPE;
  v_result jsonb;
  v_ctx jsonb;
BEGIN
  SELECT * INTO f FROM public.guard_seat_fixture;
  v_ctx := public.get_transfer_assessment_processing_context_v1(f.assessment_id, f.answer_wrong, f.student_id);
  ASSERT v_ctx->'authoritative_result' IS NULL OR jsonb_typeof(v_ctx->'authoritative_result') = 'null',
    '#110: after Guard the held answer must be offered for replay';
  v_result := public.process_assessment_message_v2(f.assessment_id, f.answer_wrong, f.student_id, gen_random_uuid(),
    0, 'open', 'retry', ARRAY['A'], jsonb_build_object('status','partially_covered','understanding_level','basic'), NULL);
  ASSERT v_result->>'processing_state' = 'applied' AND v_result->>'answer_outcome' = 'retry'
    AND (v_result->>'attempt_number')::int = 1, format('#110: replay must grade attempt 1, got %s', v_result);
  ASSERT jsonb_typeof(v_result->'result_message') = 'object', '#110: replay must write the result message';
  ASSERT (SELECT attempt_count FROM private.transfer_assessments WHERE id = f.assessment_id) = 1, '#110: replay attempt count';
  v_result := public.process_assessment_message_v2(f.assessment_id, f.answer_wrong, f.student_id, gen_random_uuid(),
    0, 'open', 'retry', ARRAY['A'], jsonb_build_object('status','partially_covered','understanding_level','basic'), NULL);
  ASSERT v_result->>'processing_state' = 'duplicate', '#110: replaying a graded answer must be a duplicate';
  ASSERT (SELECT attempt_count FROM private.transfer_assessments WHERE id = f.assessment_id) = 1, '#110: duplicate used an attempt';
END;
$replay$;
RESET ROLE;

-- 8. Permission boundary unchanged: browser roles cannot call the trusted functions.
SET LOCAL ROLE anon;
DO $perm$
BEGIN
  BEGIN
    PERFORM public.process_assessment_message_v2(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      0, 'open', 'retry', ARRAY['A'], '{}'::jsonb, NULL);
    RAISE EXCEPTION 'anon executed process_assessment_message_v2';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.join_room_v1(gen_random_uuid(), gen_random_uuid());
    RAISE EXCEPTION 'anon executed join_room_v1';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$perm$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $perm$
BEGIN
  BEGIN
    PERFORM public.join_room_v1(gen_random_uuid(), gen_random_uuid());
    RAISE EXCEPTION 'authenticated executed join_room_v1';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$perm$;
RESET ROLE;

SELECT 'guard_grading' AS case_id, TRUE AS ok;
ROLLBACK;
