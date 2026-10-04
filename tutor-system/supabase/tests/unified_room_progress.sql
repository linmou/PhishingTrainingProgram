--#!/usr/bin/env psql
-- Test responsibility: verify permanent room ownership and shared tutor/assessment progress in the database.

BEGIN;

DO $test$
DECLARE
  v_tutor uuid := gen_random_uuid();
  v_learner uuid := gen_random_uuid();
  v_observer uuid := gen_random_uuid();
  v_competitor uuid := gen_random_uuid();
  v_room uuid := gen_random_uuid();
  v_race_room uuid := gen_random_uuid();
  v_checklist uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_second_item uuid := gen_random_uuid();
  v_message uuid := gen_random_uuid();
  v_join jsonb;
  v_edit jsonb;
  v_event jsonb;
  v_status text;
  v_updates integer;
  v_join_count integer;
BEGIN
  INSERT INTO public.users(id, email, display_name, "current_role", status)
  VALUES (v_tutor, v_tutor::text || '@example.invalid', 'Tutor', 'tutor', 'active'),
    (v_learner, v_learner::text || '@example.invalid', 'Learner', 'student', 'active'),
    (v_observer, v_observer::text || '@example.invalid', 'Observer', 'student', 'active'),
    (v_competitor, v_competitor::text || '@example.invalid', 'Competitor', 'student', 'active');
  INSERT INTO public.rooms(id, tutor_id, title, transfer_learning_enabled)
  VALUES (v_room, v_tutor, 'Unified progress test', false);
  INSERT INTO public.rooms(id, tutor_id, title, transfer_learning_enabled)
  VALUES (v_race_room, v_tutor, 'Concurrent room join test', false);
  INSERT INTO public.session_checklists(id, room_id, template_name, progress_policy_version, is_active)
  VALUES (v_checklist, v_room, 'Shared learning targets', 'legacy_v1', true);
  INSERT INTO public.checklist_items(id, checklist_id, area_text, item_type, priority, status, understanding_level)
  VALUES (v_item, v_checklist, 'Verify in the official app', 'verification_step', 'important', 'partially_covered', 'basic');

  v_join := public.join_room_v1(v_room, v_learner);
  IF v_join->>'room_role' <> 'student' OR (v_join->>'learner_id')::uuid <> v_learner THEN
    RAISE EXCEPTION 'First entrant did not claim the learner seat';
  END IF;
  v_join := public.join_room_v1(v_room, v_observer);
  IF v_join->>'room_role' <> 'observer' THEN
    RAISE EXCEPTION 'Later student did not become an observer';
  END IF;
  v_join := public.join_room_v1(v_room, v_learner);
  IF v_join->>'room_role' <> 'student' THEN
    RAISE EXCEPTION 'Learner re-entry lost the room seat';
  END IF;
  IF (SELECT count(*) FROM public.session_checklists WHERE room_id = v_room AND is_active) <> 1 THEN
    RAISE EXCEPTION 'Room has more than one active progress checklist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'sessions'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%room_id%'
  ) THEN
    RAISE EXCEPTION 'Learner-seat arbitration is missing a unique room boundary';
  END IF;

  -- A single statement attempts both first joins. The unique room seat boundary must
  -- commit one learner row atomically; the losing request is then represented as an observer.
  WITH concurrent_join AS (
    INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
    VALUES (v_tutor, v_learner, v_race_room, 'active'),
      (v_tutor, v_competitor, v_race_room, 'active')
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_join_count FROM concurrent_join;
  IF v_join_count <> 1 THEN
    RAISE EXCEPTION 'Concurrent first joins did not arbitrate to one learner seat';
  END IF;
  v_join := public.join_room_v1(v_race_room, v_competitor);
  IF v_join->>'room_role' <> 'observer' THEN
    RAISE EXCEPTION 'Concurrent losing join was not downgraded to observer';
  END IF;

  v_edit := public.edit_room_checklist_v1(v_room, v_tutor, gen_random_uuid(),
    'set_status', v_item, '{"status":"covered","note":"Tutor verified"}'::jsonb);
  IF v_edit->>'status' <> 'covered' THEN RAISE EXCEPTION 'Tutor judgment was not applied'; END IF;
  SELECT status INTO v_status FROM public.checklist_items WHERE id = v_item;
  IF v_status <> 'covered' THEN RAISE EXCEPTION 'Tutor status not persisted'; END IF;
  SELECT count(*) INTO v_updates FROM public.checklist_updates WHERE item_id = v_item AND updated_by = 'tutor';
  IF v_updates <> 1 THEN RAISE EXCEPTION 'Tutor judgment history was not recorded'; END IF;

  INSERT INTO public.messages(id, room_id, user_id, content, user_role)
  VALUES (v_message, v_room, v_learner, 'I selected the unsafe link.', 'student');
  v_event := public.apply_learning_event_v1(jsonb_build_object(
    'event_id', gen_random_uuid(), 'dedupe_key', 'unified-test:' || v_message::text,
    'kind', 'assessment_fail', 'room_id', v_room, 'student_id', v_learner,
    'item_id', v_item, 'source_message_id', v_message,
    'source_evidence_message_ids', jsonb_build_array(v_message),
    'evidence_text', 'Learner selected the unsafe link', 'classified_by', 'trusted_backend'
  ));
  IF v_event->>'processing_state' <> 'applied' OR v_event->>'status' <> 'needs_review' THEN
    RAISE EXCEPTION 'Assessment judgment did not supersede the tutor judgment';
  END IF;
  v_edit := public.edit_room_checklist_v1(v_room, v_tutor, gen_random_uuid(),
    'set_status', v_item, '{"status":"covered","note":"Tutor reconsidered"}'::jsonb);
  IF v_edit->>'status' <> 'covered' THEN RAISE EXCEPTION 'Later tutor judgment did not apply'; END IF;
  SELECT count(*) INTO v_updates FROM public.checklist_updates WHERE item_id = v_item;
  IF v_updates <> 3 THEN RAISE EXCEPTION 'Judgment history lost an assessment or tutor change'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.checklist_updates WHERE item_id = v_item AND updated_by = 'tutor' AND new_status = 'covered')
     OR NOT EXISTS (SELECT 1 FROM public.checklist_updates WHERE item_id = v_item AND updated_by = 'ai' AND new_status = 'needs_review') THEN
    RAISE EXCEPTION 'Judgment history attribution is incomplete';
  END IF;

  BEGIN
    PERFORM public.edit_room_checklist_v1(v_room, v_observer, gen_random_uuid(),
      'set_status', v_item, '{"status":"pending"}'::jsonb);
    RAISE EXCEPTION 'Observer edited progress';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.post_assessment_message_v2(
      p_room_id := v_room, p_content := 'observer message', p_parent_message_id := NULL,
      p_assessment_id := NULL, p_selected_option_ids := NULL,
      p_actor_id := v_observer, p_request_id := gen_random_uuid());
    RAISE EXCEPTION 'Observer posted a message';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.process_assessment_message_v2(
      p_assessment_id := gen_random_uuid(), p_message_id := gen_random_uuid(),
      p_actor_id := v_observer, p_request_id := gen_random_uuid(),
      p_expected_attempt_count := 0, p_expected_resolution := 'open',
      p_answer_outcome := 'passed', p_selected_option_ids := ARRAY[]::text[],
      p_next_progress := '{}'::jsonb, p_applied_transition := 'assessment_pass');
    RAISE EXCEPTION 'Observer submitted an answer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  v_edit := public.edit_room_checklist_v1(v_room, v_tutor, gen_random_uuid(),
    'add_item', v_second_item,
    '{"area_text":"Confirm the sender domain","item_type":"verification_step","priority":"optional"}'::jsonb);
  v_edit := public.edit_room_checklist_v1(v_room, v_tutor, gen_random_uuid(),
    'edit_item', v_second_item, '{"area_text":"Confirm the sender domain independently"}'::jsonb);
  v_edit := public.edit_room_checklist_v1(v_room, v_tutor, gen_random_uuid(),
    'set_priority', v_second_item, '{"priority":"critical"}'::jsonb);
  IF (SELECT priority FROM public.checklist_items WHERE id = v_second_item) <> 'critical' THEN
    RAISE EXCEPTION 'Tutor priority edit was not persisted';
  END IF;
  v_edit := public.edit_room_checklist_v1(v_room, v_tutor, gen_random_uuid(),
    'remove_item', v_second_item, '{}'::jsonb);
  IF NOT (SELECT deleted FROM public.checklist_items WHERE id = v_second_item) THEN
    RAISE EXCEPTION 'Tutor target removal did not cancel the open target';
  END IF;

  UPDATE public.rooms SET transfer_learning_enabled = false WHERE id = v_room;
  v_event := public.apply_learning_event_v1(jsonb_build_object(
    'event_id', gen_random_uuid(), 'dedupe_key', 'assessment-off:' || v_message::text,
    'kind', 'assessment_fail', 'room_id', v_room, 'student_id', v_learner,
    'item_id', v_item, 'source_message_id', v_message,
    'source_evidence_message_ids', jsonb_build_array(v_message),
    'evidence_text', 'Evidence is recorded even when assessment delivery is off',
    'classified_by', 'trusted_backend'
  ));
  IF v_event->>'processing_state' <> 'applied' THEN
    RAISE EXCEPTION 'Assessment-off evidence was discarded';
  END IF;

  UPDATE public.rooms SET transfer_learning_enabled = true WHERE id = v_room;
  v_edit := public.initialize_transfer_checklist_v1(v_room, v_learner,
    '[{"area_text":"Verify in the official app","item_type":"verification_step","priority":"important"}]'::jsonb,
    v_tutor);
  IF (v_edit->>'checklist_id')::uuid <> v_checklist THEN
    RAISE EXCEPTION 'Assessment initialization created another checklist';
  END IF;
  IF (SELECT id FROM public.session_checklists WHERE room_id = v_room AND is_active) <> v_checklist THEN
    RAISE EXCEPTION 'Enabling assessment replaced progress';
  END IF;
  IF (SELECT status FROM public.checklist_items WHERE id = v_item) <> 'needs_review' THEN
    RAISE EXCEPTION 'Existing-room migration replaced learner progress';
  END IF;
  v_edit := public.initialize_transfer_checklist_v1(v_room, v_learner,
    '[{"area_text":"Verify in the official app","item_type":"verification_step","priority":"important"}]'::jsonb,
    v_tutor);
  IF (SELECT count(*) FROM public.session_checklists WHERE room_id = v_room AND is_active) <> 1
     OR (SELECT count(*) FROM public.checklist_items WHERE checklist_id = v_checklist AND NOT deleted) <> 1 THEN
    RAISE EXCEPTION 'Checklist initialization was not idempotent';
  END IF;
END;
$test$;

ROLLBACK;
