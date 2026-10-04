--!/usr/bin/env psql
-- Test responsibility: verify transfer event kinds produce distinct persisted progress transitions.

BEGIN;

DO $test$
DECLARE
  v_tutor uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_room uuid := gen_random_uuid();
  v_checklist uuid := gen_random_uuid();
  v_direct uuid := gen_random_uuid();
  v_partial uuid := gen_random_uuid();
  v_transfer uuid := gen_random_uuid();
  v_message uuid;
  v_result jsonb;
  v_kind text;
  v_item uuid;
  v_text text;
  v_expected_status text;
  v_expected_level text;
  v_step integer;
BEGIN
  INSERT INTO public.users(id, email, display_name, "current_role", status)
  VALUES
    (v_tutor, v_tutor::text || '@example.invalid', 'Status tutor', 'tutor', 'active'),
    (v_student, v_student::text || '@example.invalid', 'Status learner', 'student', 'active');
  INSERT INTO public.rooms(id, tutor_id, title, transfer_learning_enabled, pre_populated_dialogue)
  VALUES (v_room, v_tutor, 'Status events test', true, '[{"role":"others","user_name":"Scenario","message":"An account warning contains a link."}]'::jsonb);
  INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
  VALUES (v_tutor, v_student, v_room, 'active');
  PERFORM set_config('app.transfer_operation', 'on', true);
  INSERT INTO public.session_checklists(id, room_id, student_id, template_name, progress_policy_version, is_active)
  VALUES (v_checklist, v_room, v_student, 'Status events test', 'transfer_v1', true);
  INSERT INTO public.checklist_items(id, checklist_id, area_text, item_type, priority, status, understanding_level)
  VALUES
    (v_direct, v_checklist, 'Check the warning in the official app', 'verification_step', 'critical', 'pending', 'none'),
    (v_partial, v_checklist, 'Explain why the alert link is unsafe', 'understanding', 'critical', 'pending', 'none'),
    (v_transfer, v_checklist, 'Verify a payment warning using saved contact details', 'verification_step', 'important', 'pending', 'none');

  FOR v_step IN 1..6 LOOP
    v_message := gen_random_uuid();
    CASE v_step
      WHEN 1 THEN v_kind := 'demonstrated_understanding'; v_item := v_direct;
        v_text := 'I will open the official app myself to check the account instead of using this warning link.';
        v_expected_status := 'covered'; v_expected_level := 'good';
      WHEN 2 THEN v_kind := 'initial_signal'; v_item := v_partial;
        v_text := 'The link looks suspicious.';
        v_expected_status := 'partially_covered'; v_expected_level := 'basic';
      WHEN 3 THEN v_kind := 'demonstrated_understanding'; v_item := v_partial;
        v_text := 'The link might collect my login, so I will leave it alone and open the official app instead.';
        v_expected_status := 'covered'; v_expected_level := 'good';
      WHEN 4 THEN v_kind := 'contradiction'; v_item := v_direct;
        v_text := 'The warning link is safe if the sender name looks familiar, so I will use it.';
        v_expected_status := 'needs_review'; v_expected_level := 'basic';
      WHEN 5 THEN v_kind := 'spontaneous_transfer'; v_item := v_transfer;
        v_text := 'For a payment warning, I would call the number saved on my bank card rather than the number in the message.';
        v_expected_status := 'covered'; v_expected_level := 'good';
      ELSE v_kind := NULL; v_item := NULL;
        v_text := 'I am not sure.';
        v_expected_status := 'covered'; v_expected_level := 'good';
    END CASE;
    INSERT INTO public.messages(id, room_id, user_id, content, user_role)
    VALUES (v_message, v_room, v_student, v_text, 'student');
    v_result := public.apply_transfer_message_analysis_v1(
      v_room, v_message, v_tutor, gen_random_uuid(),
      jsonb_build_object(
        'events', CASE WHEN v_kind IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
          'item_id', v_item, 'kind', v_kind, 'evidence_message_id', v_message,
          'evidence_quote', v_text, 'explanation', 'Learner evidence supports this event.'
        )) END,
        'requires_protection', false, 'requires_correction', false,
        'explanation', 'Current learner message evaluated.'
      )
    );
    IF v_kind IS NOT NULL AND (v_result->'applied'->0->>'status') IS DISTINCT FROM v_expected_status THEN
      RAISE EXCEPTION 'step % returned unexpected status: %', v_step, v_result;
    END IF;
    IF v_kind IS NULL AND jsonb_array_length(v_result->'applied') <> 0 THEN
      RAISE EXCEPTION 'no-evidence message changed status';
    END IF;
    IF v_kind IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.checklist_items
      WHERE id = v_item AND status = v_expected_status AND understanding_level = v_expected_level
    ) THEN
      RAISE EXCEPTION 'step % did not persist expected progress', v_step;
    END IF;
    IF v_kind IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM private.learning_event_inbox
      WHERE room_id = v_room AND source_message_id = v_message AND event_kind = v_kind
        AND processing_state = 'applied'
    ) THEN
      RAISE EXCEPTION 'step % did not persist event kind', v_step;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.checklist_items
      WHERE id = v_direct AND status = 'needs_review') THEN
    RAISE EXCEPTION 'contradiction result was lost';
  END IF;
END;
$test$;

ROLLBACK;
