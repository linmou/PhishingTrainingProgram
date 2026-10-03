--!/usr/bin/env psql
-- Test responsibility: verify the dialogue returned by get_transfer_message_analysis_context_v1.

BEGIN;

DO $test$
DECLARE
  v_tutor uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_room uuid := gen_random_uuid();
  v_checklist uuid := gen_random_uuid();
  v_focus uuid := gen_random_uuid();
  v_later uuid := gen_random_uuid();
  v_result jsonb;
  v_history jsonb;
BEGIN
  INSERT INTO public.users(id, email, display_name, "current_role", status)
  VALUES
    (v_tutor, v_tutor::text || '@example.invalid', 'History tutor', 'tutor', 'active'),
    (v_student, v_student::text || '@example.invalid', 'Focus learner', 'student', 'active'),
    (v_other, v_other::text || '@example.invalid', 'Other learner', 'student', 'active');
  INSERT INTO public.rooms(id, tutor_id, title, transfer_learning_enabled, pre_populated_dialogue)
  VALUES (v_room, v_tutor, 'Status history test', true, jsonb_build_array(
    jsonb_build_object('user_name', 'Scenario poster', 'role', 'others', 'message', 'A link appeared.'),
    jsonb_build_object('user_name', 'Setup tutor', 'role', 'tutor', 'message', 'Check the sender.')
  ));
  INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
  VALUES (v_tutor, v_student, v_room, 'active');
  PERFORM set_config('app.transfer_operation', 'on', true);
  INSERT INTO public.session_checklists(id, room_id, student_id, template_name, progress_policy_version, is_active)
  VALUES (v_checklist, v_room, v_student, 'Status history test', 'transfer_v1', true);
  INSERT INTO public.checklist_items(id, checklist_id, area_text, item_type, priority, status, understanding_level)
  VALUES (gen_random_uuid(), v_checklist, 'Verify independently', 'verification_step', 'critical', 'pending', 'none');

  INSERT INTO public.messages(id, room_id, user_id, content, user_role, created_at)
  SELECT gen_random_uuid(), v_room, v_other, 'Earlier learner turn ' || n, 'student',
    now() - interval '20 minutes' + n * interval '1 second'
  FROM generate_series(1, 16) AS n;
  INSERT INTO public.messages(id, room_id, user_id, content, user_role, created_at)
  VALUES
    (gen_random_uuid(), v_room, v_student, 'I am unsure.', 'student', now() - interval '4 minutes'),
    (gen_random_uuid(), v_room, v_other, 'I clicked the link.', 'student', now() - interval '3 minutes'),
    (gen_random_uuid(), v_room, v_tutor, 'Use the official app.', 'tutor', now() - interval '2 minutes'),
    (v_focus, v_room, v_student, 'I would verify through the official app.', 'student', now() - interval '1 minute'),
    (v_later, v_room, v_tutor, 'Later feedback.', 'tutor', now());

  v_result := public.get_transfer_message_analysis_context_v1(v_room, v_focus, v_tutor);
  v_history := v_result->'dialogue_history';
  IF jsonb_typeof(v_history) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'dialogue_history missing';
  END IF;
  IF jsonb_array_length(v_history) <> 22 THEN
    RAISE EXCEPTION 'dialogue_history count: %', jsonb_array_length(v_history);
  END IF;
  IF v_history->0->>'source' <> 'room_setup' OR
     v_history->0->>'speaker_name' <> 'Scenario poster' OR
     v_history->0->>'user_role' <> 'others' OR
     v_history->0->>'user_id' IS NOT NULL OR
     v_history->1->>'speaker_name' <> 'Setup tutor' THEN
    RAISE EXCEPTION 'setup speaker identity or order changed';
  END IF;
  IF v_history->2->>'source' <> 'message' OR
     v_history->2->>'user_id' <> v_other::text OR
     v_history->18->>'user_id' <> v_student::text OR
     v_history->19->>'user_id' <> v_other::text OR
     v_history->20->>'user_role' <> 'tutor' OR
     v_history->20->>'user_id' <> v_tutor::text THEN
    RAISE EXCEPTION 'persisted speaker identity or order changed';
  END IF;
  IF v_history->21->>'id' <> v_focus::text OR
     v_history->21->>'content' <> v_result->'message'->>'content' OR
     v_history::text LIKE '%' || v_later::text || '%' THEN
    RAISE EXCEPTION 'history did not end at the focus message';
  END IF;
END;
$test$;

ROLLBACK;
