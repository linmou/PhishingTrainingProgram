--!/usr/bin/env psql
-- Purpose: unify room learning progress, arbitrate one learner seat, and preserve judgment history.

BEGIN;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY room_id ORDER BY started_at, id) AS position
  FROM public.sessions
  WHERE status = 'active' AND student_id IS NOT NULL
)
UPDATE public.sessions s
SET status = 'cancelled', ended_at = now()
FROM ranked r
WHERE s.id = r.id AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_learner_per_room
  ON public.sessions(room_id)
  WHERE status = 'active' AND student_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.join_room_v1(p_room_id uuid, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_learner uuid;
  v_role text;
  v_status text;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id AND is_active FOR UPDATE;
  IF NOT FOUND OR p_student_id IS NULL THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT u.current_role::text, u.status::text INTO v_role, v_status
  FROM public.users AS u
  WHERE u.id = p_student_id;
  IF v_role <> 'student' OR v_status <> 'active' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT student_id INTO v_learner FROM public.sessions
  WHERE room_id = p_room_id AND status = 'active' AND student_id IS NOT NULL
  ORDER BY started_at, id LIMIT 1;
  IF v_learner IS NULL THEN
    INSERT INTO public.sessions(room_id, tutor_id, student_id, status)
    VALUES (p_room_id, v_room.tutor_id, p_student_id, 'active')
    ON CONFLICT DO NOTHING;
    SELECT student_id INTO v_learner FROM public.sessions
    WHERE room_id = p_room_id AND status = 'active' AND student_id IS NOT NULL
    ORDER BY started_at, id LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'learner_id', v_learner,
    'room_role', CASE WHEN v_learner = p_student_id THEN 'student' ELSE 'observer' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_room_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_room_v1(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.initialize_transfer_checklist_v1(
  p_room_id uuid, p_student_id uuid, p_items jsonb, p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_checklist_id uuid;
  v_item jsonb;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') OR NOT EXISTS (
    SELECT 1 FROM public.rooms WHERE id = p_room_id AND tutor_id = p_actor_id AND transfer_learning_enabled
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE room_id = p_room_id AND student_id = p_student_id AND status = 'active')
    THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR btrim(COALESCE(v_item->>'area_text', '')) = ''
      OR v_item->>'item_type' NOT IN ('detection_area', 'verification_step', 'understanding', 'behavior')
      OR v_item->>'priority' NOT IN ('critical', 'important', 'optional')
    THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  SELECT id INTO v_checklist_id
  FROM public.session_checklists
  WHERE room_id = p_room_id AND is_active
  ORDER BY CASE WHEN progress_policy_version = 'transfer_v1' THEN 0 ELSE 1 END, created_at, id
  LIMIT 1 FOR UPDATE;
  IF v_checklist_id IS NULL THEN
    INSERT INTO public.session_checklists(room_id, student_id, progress_policy_version, template_name, is_active)
    VALUES (p_room_id, p_student_id, 'transfer_v1', 'Room learning targets', true)
    RETURNING id INTO v_checklist_id;
  ELSE
    UPDATE public.session_checklists
    SET student_id = p_student_id, progress_policy_version = 'transfer_v1', updated_at = now()
    WHERE id = v_checklist_id;
    UPDATE public.session_checklists SET is_active = false, updated_at = now()
    WHERE room_id = p_room_id AND is_active AND id <> v_checklist_id;
  END IF;

  PERFORM set_config('app.transfer_operation', 'on', true);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.checklist_items
      WHERE checklist_id = v_checklist_id AND NOT deleted
        AND lower(btrim(area_text)) = lower(btrim(v_item->>'area_text'))
        AND item_type = v_item->>'item_type'
    ) THEN
      INSERT INTO public.checklist_items(
        checklist_id, area_text, item_type, priority, status, understanding_level,
        tutor_notes, attempts_count, original_template_area, deleted
      ) VALUES (
        v_checklist_id, btrim(v_item->>'area_text'), v_item->>'item_type', v_item->>'priority',
        'pending', 'none', '', 0, false, false
      );
    END IF;
  END LOOP;
  UPDATE public.session_checklists SET total_items = (
    SELECT count(*) FROM public.checklist_items WHERE checklist_id = v_checklist_id AND NOT deleted
  ), updated_at = now() WHERE id = v_checklist_id;
  RETURN jsonb_build_object('checklist_id', v_checklist_id);
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_transfer_checklist_v1(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_transfer_checklist_v1(uuid, uuid, jsonb, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.edit_room_checklist_v1(
  p_room_id uuid, p_actor_id uuid, p_request_id uuid, p_action text, p_item_id uuid, p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_checklist public.session_checklists%ROWTYPE;
  v_item public.checklist_items%ROWTYPE;
  v_old_status text;
  v_old_level text;
  v_new_status text;
  v_new_level text;
  v_area text;
  v_priority text;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.checklist_updates
    WHERE event_id = p_request_id AND updated_by = 'tutor'
  ) THEN
    RETURN jsonb_build_object('request_id', p_request_id, 'processing_state', 'duplicate');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room_id AND tutor_id = p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT sc.* INTO v_checklist FROM public.session_checklists sc
  JOIN public.rooms r ON r.id = sc.room_id
  WHERE sc.room_id = p_room_id AND sc.is_active AND r.tutor_id = p_actor_id
  ORDER BY CASE WHEN sc.progress_policy_version = 'transfer_v1' THEN 0 ELSE 1 END, sc.created_at, sc.id
  LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_SETUP_REQUIRED'; END IF;
  PERFORM set_config('app.transfer_operation', 'on', true);

  IF p_action = 'add_item' THEN
    v_area := btrim(COALESCE(p_payload->>'area_text', ''));
    v_priority := COALESCE(p_payload->>'priority', 'important');
    IF v_area = '' OR p_payload->>'item_type' NOT IN ('detection_area', 'verification_step', 'understanding', 'behavior')
      OR v_priority NOT IN ('critical', 'important', 'optional') THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    INSERT INTO public.checklist_items(id, checklist_id, area_text, item_type, priority, status, understanding_level, tutor_notes, deleted)
    VALUES (p_item_id, v_checklist.id, v_area, p_payload->>'item_type', v_priority, 'pending', 'none', '', false);
    INSERT INTO public.checklist_updates(
      checklist_id, item_id, previous_status, new_status, previous_understanding, new_understanding,
      evidence_id, event_id, assessment_id, updated_by
    ) VALUES (v_checklist.id, p_item_id, 'pending', 'pending', 'none', 'none', NULL, p_request_id, NULL, 'tutor');
    UPDATE public.session_checklists SET total_items = total_items + 1, updated_at = now() WHERE id = v_checklist.id;
    RETURN jsonb_build_object('item_id', p_item_id, 'status', 'pending');
  END IF;

  SELECT * INTO v_item FROM public.checklist_items WHERE id = p_item_id AND checklist_id = v_checklist.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  v_old_status := v_item.status;
  v_old_level := v_item.understanding_level;
  v_new_status := v_old_status;
  v_new_level := v_old_level;

  IF p_action = 'set_status' THEN
    v_new_status := p_payload->>'status';
    IF v_new_status NOT IN ('pending', 'partially_covered', 'covered', 'needs_review') THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    UPDATE public.checklist_items SET status = v_new_status, tutor_notes = COALESCE(p_payload->>'note', tutor_notes), updated_at = now() WHERE id = p_item_id;
  ELSIF p_action = 'set_understanding' THEN
    v_new_level := p_payload->>'understanding_level';
    IF v_new_level NOT IN ('none', 'basic', 'good', 'excellent') THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    UPDATE public.checklist_items SET understanding_level = v_new_level, updated_at = now() WHERE id = p_item_id;
  ELSIF p_action = 'edit_item' THEN
    v_area := btrim(COALESCE(p_payload->>'area_text', ''));
    IF v_area = '' THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    UPDATE public.checklist_items SET area_text = v_area, updated_at = now() WHERE id = p_item_id;
  ELSIF p_action = 'set_priority' THEN
    v_priority := p_payload->>'priority';
    IF v_priority NOT IN ('critical', 'important', 'optional') THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    UPDATE public.checklist_items SET priority = v_priority, updated_at = now() WHERE id = p_item_id;
  ELSIF p_action = 'remove_item' THEN
    UPDATE public.checklist_items SET deleted = true, updated_at = now() WHERE id = p_item_id;
    UPDATE private.transfer_assessments SET lifecycle = 'cancelled', closed_at = now(), updated_at = now()
    WHERE item_id = p_item_id AND lifecycle = 'open';
    UPDATE public.session_checklists SET total_items = GREATEST(total_items - 1, 0), updated_at = now() WHERE id = v_checklist.id;
  ELSE
    RAISE EXCEPTION 'ITEM_VALIDATION_FAILED';
  END IF;

  IF v_new_status IS DISTINCT FROM v_old_status OR v_new_level IS DISTINCT FROM v_old_level
    OR p_action IN ('edit_item', 'set_priority', 'remove_item') THEN
    INSERT INTO public.checklist_updates(
      checklist_id, item_id, previous_status, new_status, previous_understanding, new_understanding,
      evidence_id, event_id, assessment_id, updated_by
    ) VALUES (
      v_checklist.id, p_item_id, v_old_status, v_new_status, v_old_level, v_new_level,
      NULL, p_request_id, NULL, 'tutor'
    );
  END IF;
  SELECT status, understanding_level INTO v_new_status, v_new_level FROM public.checklist_items WHERE id = p_item_id;
  RETURN jsonb_build_object('item_id', p_item_id, 'status', v_new_status, 'understanding_level', v_new_level);
END;
$$;

REVOKE ALL ON FUNCTION public.edit_room_checklist_v1(uuid, uuid, uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_room_checklist_v1(uuid, uuid, uuid, text, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_learning_event_v1(p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_event_id uuid := (p_event->>'event_id')::uuid;
  v_dedupe_key text := p_event->>'dedupe_key';
  v_kind text := p_event->>'kind';
  v_item public.checklist_items%ROWTYPE;
  v_checklist public.session_checklists%ROWTYPE;
  v_room public.rooms%ROWTYPE;
  v_old_status text;
  v_old_level text;
  v_next_status text;
  v_next_level text;
  v_evidence_id uuid;
  v_update_id uuid;
  v_event_student uuid := (p_event->>'student_id')::uuid;
  v_existing private.learning_event_inbox%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_event_id IS NULL OR btrim(COALESCE(v_dedupe_key, '')) = '' OR v_event_student IS NULL
    OR btrim(COALESCE(p_event->>'item_id', '')) = '' THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_dedupe_key, 0));
  SELECT * INTO v_existing FROM private.learning_event_inbox WHERE dedupe_key = v_dedupe_key;
  IF FOUND THEN RETURN jsonb_build_object('event_id', v_existing.event_id, 'processing_state', v_existing.processing_state); END IF;
  SELECT ci.* INTO v_item FROM public.checklist_items ci
  WHERE ci.id = (p_event->>'item_id')::uuid AND NOT ci.deleted FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT sc.* INTO v_checklist FROM public.session_checklists sc
  WHERE sc.id = v_item.checklist_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT * INTO v_room FROM public.rooms WHERE id = v_checklist.room_id FOR UPDATE;
  IF (p_event->>'room_id')::uuid <> v_room.id OR (v_checklist.student_id IS NOT NULL AND v_event_student IS DISTINCT FROM v_checklist.student_id)
    OR btrim(COALESCE(p_event->>'evidence_text', '')) = '' THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF jsonb_typeof(p_event->'source_evidence_message_ids') <> 'array'
    OR jsonb_array_length(p_event->'source_evidence_message_ids') = 0 THEN RAISE EXCEPTION 'INVALID_SOURCE_EVIDENCE'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_event->'source_evidence_message_ids') AS source_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = source_id::uuid AND m.room_id = v_room.id AND m.user_role = 'student'
        AND (v_checklist.student_id IS NULL OR m.user_id = v_checklist.student_id)
    )
  ) THEN RAISE EXCEPTION 'INVALID_SOURCE_EVIDENCE'; END IF;
  IF NULLIF(p_event->>'source_message_id', '') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_event->'source_evidence_message_ids') ids WHERE ids = p_event->>'source_message_id')
  THEN RAISE EXCEPTION 'INVALID_SOURCE_EVIDENCE'; END IF;
  IF v_kind NOT IN ('initial_signal', 'demonstrated_understanding', 'post_repair_signal', 'spontaneous_transfer', 'contradiction', 'assessment_pass', 'assessment_fail')
    THEN RAISE EXCEPTION 'UNKNOWN_EVENT_KIND'; END IF;

  INSERT INTO private.learning_event_inbox(event_id, dedupe_key, room_id, student_id, checklist_id, item_id, source_message_id, event_kind, event_payload, classified_by)
  VALUES (v_event_id, v_dedupe_key, v_room.id, v_event_student, v_checklist.id, v_item.id,
    NULLIF(p_event->>'source_message_id', '')::uuid, v_kind, p_event, COALESCE(p_event->>'classified_by', 'trusted_backend'));
  IF v_room.active_response_mode = 'guard' THEN
    UPDATE private.learning_event_inbox SET processing_state = 'deferred_guard' WHERE event_id = v_event_id;
    RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'deferred_guard', 'error_code', 'PROGRESSION_LOCKED');
  END IF;
  v_old_status := v_item.status;
  v_old_level := v_item.understanding_level;
  v_next_status := v_old_status;
  v_next_level := v_old_level;
  IF v_kind IN ('initial_signal', 'post_repair_signal') AND v_old_status IN ('pending', 'needs_review') THEN v_next_status := 'partially_covered'; v_next_level := 'basic';
  ELSIF v_kind IN ('demonstrated_understanding', 'spontaneous_transfer', 'assessment_pass') AND v_old_status <> 'covered' THEN v_next_status := 'covered'; v_next_level := 'good';
  ELSIF v_kind IN ('contradiction', 'assessment_fail') AND v_old_status IN ('partially_covered', 'covered') THEN v_next_status := 'needs_review'; v_next_level := 'basic';
  END IF;
  IF v_next_status = v_old_status AND v_next_level = v_old_level THEN
    UPDATE private.learning_event_inbox SET processing_state = 'no_change', applied_at = now() WHERE event_id = v_event_id;
    RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'no_change', 'status', v_old_status);
  END IF;
  PERFORM set_config('app.transfer_operation', 'on', true);
  INSERT INTO public.coverage_evidence(item_id, evidence_text, analysis, confidence_score, detection_method, message_id, event_id, assessment_id)
  VALUES (v_item.id, p_event->>'evidence_text', COALESCE(p_event->>'explanation', 'Learning event applied'), 100,
    CASE WHEN p_event->>'classified_by' = 'tutor' THEN 'tutor_manual' ELSE 'ai_analysis' END,
    NULLIF(p_event->>'source_message_id', '')::uuid, v_event_id, NULLIF(p_event->>'assessment_id', '')::uuid)
  RETURNING id INTO v_evidence_id;
  UPDATE public.checklist_items SET status = v_next_status, understanding_level = v_next_level, last_addressed = now(), updated_at = now() WHERE id = v_item.id;
  INSERT INTO public.checklist_updates(checklist_id, item_id, previous_status, new_status, previous_understanding, new_understanding, evidence_id, event_id, assessment_id, updated_by)
  VALUES (v_checklist.id, v_item.id, v_old_status, v_next_status, v_old_level, v_next_level, v_evidence_id, v_event_id,
    NULLIF(p_event->>'assessment_id', '')::uuid, CASE WHEN p_event->>'classified_by' = 'tutor' THEN 'tutor' ELSE 'ai' END)
  RETURNING id INTO v_update_id;
  UPDATE private.learning_event_inbox SET processing_state = 'applied', linked_update_id = v_update_id, linked_evidence_id = v_evidence_id, applied_at = now() WHERE event_id = v_event_id;
  RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'applied', 'status', v_next_status, 'understanding_level', v_next_level);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_learning_event_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_learning_event_v1(jsonb) TO service_role;

COMMIT;
