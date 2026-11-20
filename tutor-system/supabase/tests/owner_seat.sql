--!/usr/bin/env psql
-- Purpose: regression assertions for #112: the room owner is never the room's learner, whatever role
-- their profile shows; pre-existing owner seats are left in place. Run as postgres after
-- guard_grading_and_owner_seat.fixture.sql; every mutation is rolled back. Fails on the pre-fix
-- baseline (Red) and passes after the migration (Green).

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL request.headers = '{"x-practice-contract":"cyberbullying-v2"}';

-- ---------------------------------------------------------------------------------------------
-- #112 The owner switches their profile role to student and opens their own room.
-- ---------------------------------------------------------------------------------------------
UPDATE public.users SET "current_role" = 'student' WHERE id = 'f1100000-0000-4000-8000-000000000001';

SET LOCAL ROLE service_role;
DO $seat$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.join_room_v1('f1100000-0000-4000-8000-000000000021', 'f1100000-0000-4000-8000-000000000001');
  ASSERT v_result->>'room_role' = 'observer', format('#112: owner must join their own room as observer, got %s', v_result);
  ASSERT v_result->>'learner_id' IS NULL, '#112: owner must not be reported as learner';
  ASSERT NOT EXISTS (SELECT 1 FROM public.sessions WHERE room_id = 'f1100000-0000-4000-8000-000000000021'),
    '#112: join_room_v1 created an owner session';
  -- The owner of a room with a pre-existing owner seat is still not reported as the learner.
  v_result := public.join_room_v1('f1100000-0000-4000-8000-000000000031', 'f1100000-0000-4000-8000-000000000001');
  ASSERT v_result->>'room_role' = 'observer', '#112: owner with a legacy owner seat must be an observer';
END;
$seat$;
RESET ROLE;

-- The StudentView legacy fallback insert, under each browser role and the service role.
SET LOCAL ROLE anon;
DO $seat$
BEGIN
  BEGIN
    INSERT INTO public.sessions(room_id, tutor_id, student_id, status) VALUES ('f1100000-0000-4000-8000-000000000021',
      'f1100000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000001', 'active');
    RAISE EXCEPTION '#112: anon fallback insert seated the owner';
  EXCEPTION WHEN check_violation THEN
    ASSERT SQLERRM = 'OWNER_CANNOT_BE_LEARNER', 'unexpected check violation: ' || SQLERRM;
  END;
END;
$seat$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $seat$
BEGIN
  BEGIN
    INSERT INTO public.sessions(room_id, tutor_id, student_id, status) VALUES ('f1100000-0000-4000-8000-000000000021',
      'f1100000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000001', 'active');
    RAISE EXCEPTION '#112: authenticated fallback insert seated the owner';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- A forged tutor_id does not bypass the room-owner comparison.
  BEGIN
    INSERT INTO public.sessions(room_id, tutor_id, student_id, status) VALUES ('f1100000-0000-4000-8000-000000000021',
      'f1100000-0000-4000-8000-000000000002', 'f1100000-0000-4000-8000-000000000001', 'active');
    RAISE EXCEPTION '#112: forged tutor_id seated the owner';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$seat$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $seat$
DECLARE
  v_inactive uuid;
  v_learner uuid;
BEGIN
  BEGIN
    INSERT INTO public.sessions(room_id, tutor_id, student_id, status) VALUES ('f1100000-0000-4000-8000-000000000021',
      'f1100000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000001', 'active');
    RAISE EXCEPTION '#112: service_role insert seated the owner';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- Update paths: reactivating an owner's ended session, or moving the seat to the owner.
  INSERT INTO public.sessions(room_id, tutor_id, student_id, status) VALUES ('f1100000-0000-4000-8000-000000000021',
    'f1100000-0000-4000-8000-000000000001', 'f1100000-0000-4000-8000-000000000001', 'completed') RETURNING id INTO v_inactive;
  BEGIN
    UPDATE public.sessions SET status = 'active' WHERE id = v_inactive;
    RAISE EXCEPTION '#112: reactivation seated the owner';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.sessions SET student_id = 'f1100000-0000-4000-8000-000000000001'
      WHERE room_id = 'f1100000-0000-4000-8000-000000000011' AND status = 'active';
    RAISE EXCEPTION '#112: moving the seat seated the owner';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- A real student still takes the empty seat through join_room_v1.
  ASSERT public.join_room_v1('f1100000-0000-4000-8000-000000000021', 'f1100000-0000-4000-8000-000000000003')->>'room_role' = 'student',
    '#112: a non-owner student must still take the empty seat';
  SELECT student_id INTO v_learner FROM public.sessions WHERE room_id = 'f1100000-0000-4000-8000-000000000021' AND status = 'active';
  ASSERT v_learner = 'f1100000-0000-4000-8000-000000000003', '#112: wrong learner seated';
  -- The pre-existing owner seat is not rewritten, can still be updated, and can be ended.
  ASSERT EXISTS (SELECT 1 FROM public.sessions WHERE id = 'f1100000-0000-4000-8000-000000000032' AND status = 'active'),
    '#112: the pre-existing owner seat must be left in place';
  UPDATE public.sessions SET started_at = started_at WHERE id = 'f1100000-0000-4000-8000-000000000032';
  UPDATE public.sessions SET status = 'completed', ended_at = now() WHERE id = 'f1100000-0000-4000-8000-000000000032';
  BEGIN
    UPDATE public.sessions SET status = 'active' WHERE id = 'f1100000-0000-4000-8000-000000000032';
    RAISE EXCEPTION '#112: an ended owner seat was reactivated';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$seat$;
RESET ROLE;

SELECT 'owner_seat' AS case_id, TRUE AS ok;
ROLLBACK;
