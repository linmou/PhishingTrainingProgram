--#!/usr/bin/env psql
-- Test responsibility: initialize_transfer_checklist_v1 and edit_room_checklist_v1 must support separate rooms and tutor progress edits.
-- Run on a disposable database restored from the inspected hosted baseline; all fixtures roll back.

BEGIN;

DO $test$
DECLARE
  v_tutor uuid := gen_random_uuid();
  v_learner uuid := gen_random_uuid();
  v_observer uuid := gen_random_uuid();
  v_rooms uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid()];
  v_room uuid;
  v_first_checklist uuid;
  v_checklist uuid;
  v_item uuid;
  v_result jsonb;
  v_denied boolean;
  v_targets jsonb := '[{"area_text":"Verify payment requests through a trusted independent channel.","item_type":"verification_step","priority":"important"}]'::jsonb;
BEGIN
  INSERT INTO public.users(id, email, display_name, "current_role", status)
  VALUES
    (v_tutor, v_tutor::text || '@example.invalid', 'QA tutor', 'tutor', 'active'),
    (v_learner, v_learner::text || '@example.invalid', 'QA learner', 'student', 'active'),
    (v_observer, v_observer::text || '@example.invalid', 'QA observer', 'student', 'active');

  FOREACH v_room IN ARRAY v_rooms LOOP
    INSERT INTO public.rooms(id, tutor_id, title, transfer_learning_enabled)
    VALUES (v_room, v_tutor, 'QA pre-join local target synchronization', true);
    v_result := public.join_room_v1(v_room, v_learner);
    IF v_result->>'room_role' IS DISTINCT FROM 'student' THEN
      RAISE EXCEPTION 'Same learner could not join a second room: %', v_result;
    END IF;

    -- No persisted checklist exists yet: the browser target was created locally before join.
    -- A pooled PostgreSQL connection retains an empty custom-setting placeholder after a transaction.
    PERFORM set_config('app.transfer_operation', '', true);
    v_result := public.initialize_transfer_checklist_v1(v_room, v_learner, v_targets, v_tutor);
    v_checklist := (v_result->>'checklist_id')::uuid;
    IF v_checklist IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.session_checklists
      WHERE id = v_checklist AND room_id = v_room AND student_id = v_learner AND is_active
    ) THEN
      RAISE EXCEPTION 'Initialization did not persist room-scoped learner targets: %', v_result;
    END IF;
    IF v_first_checklist IS NULL THEN
      v_first_checklist := v_checklist;
    ELSIF v_first_checklist = v_checklist THEN
      RAISE EXCEPTION 'Second room reused first room checklist';
    END IF;
    v_result := public.initialize_transfer_checklist_v1(v_room, v_learner, v_targets, v_tutor);
    IF (v_result->>'checklist_id')::uuid IS DISTINCT FROM v_checklist OR
       (SELECT count(*) FROM public.checklist_items WHERE checklist_id = v_checklist AND NOT deleted) <> 1 THEN
      RAISE EXCEPTION 'Retry duplicated or replaced targets';
    END IF;
    SELECT id INTO STRICT v_item FROM public.checklist_items
    WHERE checklist_id = v_checklist AND NOT deleted;

    PERFORM public.edit_room_checklist_v1(v_room, v_tutor, gen_random_uuid(),
      'set_status', v_item, '{"status":"covered"}'::jsonb);
    PERFORM public.edit_room_checklist_v1(v_room, v_tutor, gen_random_uuid(),
      'set_status', v_item, '{"status":"partially_covered"}'::jsonb);
    IF NOT EXISTS (SELECT 1 FROM public.checklist_items
      WHERE id = v_item AND status = 'partially_covered' AND understanding_level = 'basic') THEN
      RAISE EXCEPTION 'Tutor could not change covered to partially covered with consistent level';
    END IF;

    v_denied := false;
    BEGIN
      PERFORM public.edit_room_checklist_v1(v_room, v_observer, gen_random_uuid(),
        'set_status', v_item, '{"status":"covered"}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      v_denied := true;
    END;
    IF NOT v_denied OR NOT EXISTS (SELECT 1 FROM public.checklist_items
      WHERE id = v_item AND status = 'partially_covered' AND understanding_level = 'basic') THEN
      RAISE EXCEPTION 'Rejected observer edit changed learner progress';
    END IF;
  END LOOP;
END;
$test$;

ROLLBACK;
