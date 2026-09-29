-- #!/usr/bin/env psql
-- Purpose: make room-approved transfer targets, learner evidence, and assessment eligibility server-owned.
-- Applied to staging on 2026-09-29 after the assessment RPC branch; retained as deployment history.

ALTER TABLE public.rooms
  ADD COLUMN transfer_learning_enabled boolean NOT NULL DEFAULT false;

UPDATE public.rooms r SET transfer_learning_enabled = true
WHERE EXISTS (
  SELECT 1 FROM public.session_checklists sc
  WHERE sc.room_id = r.id AND sc.progress_policy_version = 'transfer_v1'
);

DROP FUNCTION IF EXISTS public.initialize_transfer_checklist_v1(uuid, uuid, text, uuid);

CREATE FUNCTION public.initialize_transfer_checklist_v1(
  p_room_id uuid, p_student_id uuid, p_items jsonb, p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_checklist_id uuid;
  v_item jsonb;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') OR NOT EXISTS (
    SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id AND transfer_learning_enabled
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM sessions WHERE room_id = p_room_id AND student_id = p_student_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ITEM_VALIDATION_FAILED';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object' OR
       (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v_item) key) <>
         ARRAY['area_text', 'item_type', 'priority'] OR
       btrim(COALESCE(v_item->>'area_text', '')) = '' OR
       v_item->>'item_type' NOT IN ('detection_area', 'verification_step', 'understanding', 'behavior') OR
       v_item->>'priority' NOT IN ('critical', 'important', 'optional') THEN
      RAISE EXCEPTION 'ITEM_VALIDATION_FAILED';
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_room_id::text || ':' || p_student_id::text, 0));
  SELECT id INTO v_checklist_id FROM session_checklists
  WHERE room_id = p_room_id AND student_id = p_student_id
    AND progress_policy_version = 'transfer_v1' AND is_active
  FOR UPDATE;
  IF v_checklist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM checklist_items WHERE checklist_id = v_checklist_id AND NOT deleted
  ) THEN RETURN jsonb_build_object('checklist_id', v_checklist_id); END IF;

  PERFORM set_config('app.transfer_operation', 'on', true);
  IF v_checklist_id IS NULL THEN
    INSERT INTO session_checklists(room_id, student_id, progress_policy_version, template_name)
    VALUES (p_room_id, p_student_id, 'transfer_v1', 'Room learning targets')
    RETURNING id INTO v_checklist_id;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO checklist_items(
      checklist_id, area_text, item_type, priority, status, understanding_level,
      tutor_notes, attempts_count, original_template_area
    ) VALUES (
      v_checklist_id, btrim(v_item->>'area_text'), v_item->>'item_type', v_item->>'priority',
      'pending', 'none', '', 0, false
    );
  END LOOP;
  UPDATE session_checklists SET total_items = (
    SELECT count(*) FROM checklist_items WHERE checklist_id = v_checklist_id AND NOT deleted
  ), updated_at = now() WHERE id = v_checklist_id;
  RETURN jsonb_build_object('checklist_id', v_checklist_id);
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_transfer_checklist_v1(uuid, uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_transfer_checklist_v1(uuid, uuid, jsonb, uuid)
  TO service_role;

CREATE FUNCTION public.get_transfer_message_analysis_context_v1(
  p_room_id uuid, p_message_id uuid, p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_message messages%ROWTYPE;
  v_checklist session_checklists%ROWTYPE;
  v_marker private.learning_event_inbox%ROWTYPE;
  v_items jsonb;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_message FROM messages WHERE id = p_message_id AND room_id = p_room_id;
  IF NOT FOUND OR v_message.user_role <> 'student' OR v_message.assessment_id IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_SCOPE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND transfer_learning_enabled) OR
     NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) AND
     p_actor_id <> v_message.user_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_checklist FROM session_checklists
  WHERE room_id = p_room_id AND student_id = v_message.user_id
    AND progress_policy_version = 'transfer_v1' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'TARGET_SETUP_REQUIRED'; END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'area_text', area_text, 'item_type', item_type,
    'priority', priority, 'status', status, 'understanding_level', understanding_level
  ) ORDER BY id) INTO v_items FROM checklist_items
  WHERE checklist_id = v_checklist.id AND NOT deleted;
  IF v_items IS NULL THEN RAISE EXCEPTION 'TARGET_SETUP_REQUIRED'; END IF;
  SELECT * INTO v_marker FROM private.learning_event_inbox
  WHERE dedupe_key = 'analysis:' || p_message_id::text;
  RETURN jsonb_build_object(
    'room_id', p_room_id, 'student_id', v_message.user_id,
    'checklist_id', v_checklist.id,
    'message', jsonb_build_object('id', v_message.id, 'room_id', v_message.room_id,
      'user_id', v_message.user_id, 'user_role', v_message.user_role, 'content', v_message.content),
    'items', v_items,
    'analysis_complete', COALESCE(v_marker.processing_state IN ('applied', 'no_change'), false),
    'analysis_deferred', COALESCE(v_marker.processing_state = 'deferred_guard', false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_transfer_message_analysis_context_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_transfer_message_analysis_context_v1(uuid, uuid, uuid)
  TO service_role;

CREATE FUNCTION public.apply_transfer_message_analysis_v1(
  p_room_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_analysis jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_scope jsonb;
  v_message jsonb;
  v_item jsonb;
  v_event jsonb;
  v_result jsonb;
  v_applied jsonb := '[]'::jsonb;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_marker private.learning_event_inbox%ROWTYPE;
  v_guard boolean;
  v_prior private.learning_event_inbox%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_message_id::text, 0));
  v_scope := public.get_transfer_message_analysis_context_v1(p_room_id, p_message_id, p_actor_id);
  v_message := v_scope->'message';
  SELECT * INTO v_marker FROM private.learning_event_inbox
  WHERE dedupe_key = 'analysis:' || p_message_id::text FOR UPDATE;
  IF FOUND AND v_marker.processing_state IN ('applied', 'no_change') THEN
    RETURN jsonb_build_object('applied', '[]'::jsonb, 'already_processed', true);
  END IF;
  SELECT active_response_mode = 'guard' INTO v_guard FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF v_marker.processing_state = 'deferred_guard' AND v_guard THEN
    RETURN jsonb_build_object('applied', '[]'::jsonb, 'deferred', true);
  END IF;
  IF v_marker.processing_state = 'deferred_guard' AND NOT v_guard THEN
    p_analysis := v_marker.event_payload->'analysis';
    DELETE FROM private.learning_event_inbox
      WHERE source_message_id = p_message_id AND processing_state = 'deferred_guard';
    DELETE FROM private.learning_event_inbox WHERE event_id = v_marker.event_id;
  END IF;
  IF jsonb_typeof(p_analysis->'events') <> 'array' OR
     jsonb_typeof(p_analysis->'requires_protection') <> 'boolean' OR
     jsonb_typeof(p_analysis->'requires_correction') <> 'boolean' THEN
    RAISE EXCEPTION 'AI_OUTPUT_INVALID';
  END IF;

  FOR v_event IN SELECT value FROM jsonb_array_elements(p_analysis->'events') LOOP
    IF COALESCE(v_event->>'kind', '') NOT IN (
      'initial_signal', 'post_repair_signal', 'spontaneous_transfer', 'contradiction'
    ) OR btrim(COALESCE(v_event->>'explanation', '')) = '' OR
       NOT EXISTS (
         SELECT 1 FROM checklist_items
         WHERE id = (v_event->>'item_id')::uuid
           AND checklist_id = (v_scope->>'checklist_id')::uuid AND NOT deleted
       ) OR (v_event->>'item_id')::uuid = ANY(v_seen) THEN
      RAISE EXCEPTION 'AI_OUTPUT_INVALID';
    END IF;
    v_seen := array_append(v_seen, (v_event->>'item_id')::uuid);
    v_result := public.apply_learning_event_v1(jsonb_build_object(
      'event_id', gen_random_uuid(),
      'dedupe_key', 'message:' || p_message_id::text || ':' || v_event->>'item_id' || ':' || v_event->>'kind',
      'room_id', p_room_id, 'student_id', v_scope->>'student_id',
      'item_id', v_event->>'item_id', 'source_message_id', p_message_id,
      'source_evidence_message_ids', jsonb_build_array(p_message_id),
      'kind', v_event->>'kind', 'evidence_text', v_message->>'content',
      'explanation', v_event->>'explanation', 'classified_by', 'model'
    ));
    v_applied := v_applied || jsonb_build_array(v_result);
  END LOOP;

  SELECT to_jsonb(ci) INTO v_item FROM checklist_items ci
  WHERE ci.checklist_id = (v_scope->>'checklist_id')::uuid AND NOT ci.deleted ORDER BY ci.id LIMIT 1;
  INSERT INTO private.learning_event_inbox(
    event_id, dedupe_key, room_id, student_id, checklist_id, item_id,
    source_message_id, event_kind, event_payload, classified_by, processing_state, applied_at
  ) VALUES (
    gen_random_uuid(), 'analysis:' || p_message_id::text, p_room_id,
    (v_scope->>'student_id')::uuid, (v_scope->>'checklist_id')::uuid,
    (v_item->>'id')::uuid, p_message_id, 'analysis_complete',
    jsonb_build_object('analysis', p_analysis, 'applied', v_applied, 'request_id', p_request_id),
    'model', CASE WHEN v_guard THEN 'deferred_guard' ELSE 'applied' END,
    CASE WHEN v_guard THEN NULL ELSE now() END
  ) ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN jsonb_build_object('applied', v_applied, 'already_processed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_transfer_message_analysis_v1(uuid, uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_transfer_message_analysis_v1(uuid, uuid, uuid, uuid, jsonb)
  TO service_role;

CREATE FUNCTION public.prepare_transfer_assessment_context_v1(
  p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid,
  p_actor_id uuid, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_message messages%ROWTYPE;
  v_checklist session_checklists%ROWTYPE;
  v_room rooms%ROWTYPE;
  v_marker private.learning_event_inbox%ROWTYPE;
  v_items jsonb;
  v_eligible jsonb;
  v_selected uuid;
  v_open boolean;
  v_feedback boolean;
  v_blocked boolean;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id;
  IF NOT FOUND OR NOT v_room.transfer_learning_enabled THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_message FROM messages
  WHERE id = p_focus_student_message_id AND room_id = p_room_id AND user_role = 'student'
    AND assessment_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT * INTO v_checklist FROM session_checklists WHERE id = p_checklist_id
    AND room_id = p_room_id AND student_id = v_message.user_id
    AND progress_policy_version = 'transfer_v1' AND is_active;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM checklist_items WHERE checklist_id = v_checklist.id AND NOT deleted
  ) THEN RAISE EXCEPTION 'TARGET_SETUP_REQUIRED'; END IF;
  SELECT * INTO v_marker FROM private.learning_event_inbox
  WHERE dedupe_key = 'analysis:' || p_focus_student_message_id::text;
  IF NOT FOUND OR v_marker.processing_state NOT IN ('applied', 'no_change', 'deferred_guard') THEN
    RAISE EXCEPTION 'ANALYSIS_INCOMPLETE';
  END IF;
  IF v_marker.processing_state = 'deferred_guard' AND v_room.active_response_mode <> 'guard' THEN
    RAISE EXCEPTION 'ANALYSIS_INCOMPLETE';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM private.transfer_assessments ta
    WHERE ta.room_id = p_room_id AND ta.student_id = v_message.user_id
      AND ta.lifecycle = 'open'
  ) INTO v_open;
  SELECT EXISTS (
    SELECT 1 FROM private.transfer_assessments ta WHERE ta.room_id = p_room_id
      AND ta.student_id = v_message.user_id AND ta.lifecycle IN ('passed', 'failed')
      AND NOT EXISTS (
        SELECT 1 FROM messages feedback WHERE feedback.room_id = p_room_id
          AND feedback.user_id = v_room.tutor_id AND feedback.user_role = 'tutor'
          AND feedback.response_mode = 'tutoring'
          AND feedback.parent_message_id = ta.terminal_answer_message_id
          AND feedback.created_at > ta.closed_at
      )
  ) INTO v_feedback;
  v_blocked := v_room.active_response_mode = 'guard' OR v_open OR v_feedback OR
    COALESCE((v_marker.event_payload->'analysis'->>'requires_protection')::boolean, false) OR
    COALESCE((v_marker.event_payload->'analysis'->>'requires_correction')::boolean, false);

  SELECT jsonb_agg(jsonb_build_object(
    'id', ci.id, 'area_text', ci.area_text, 'priority', ci.priority,
    'status', ci.status, 'understanding_level', ci.understanding_level,
    'relevant_evidence_message_ids', COALESCE((
      SELECT jsonb_agg(DISTINCT ce.message_id) FROM coverage_evidence ce
      WHERE ce.item_id = ci.id AND ce.message_id IS NOT NULL
    ), '[]'::jsonb),
    'repair_message_id', (
      SELECT le.source_message_id FROM private.learning_event_inbox le
      WHERE le.item_id = ci.id AND le.event_kind = 'post_repair_signal'
        AND le.processing_state = 'applied' ORDER BY le.applied_at DESC LIMIT 1
    )
  ) ORDER BY ci.id) INTO v_items FROM checklist_items ci
  WHERE ci.checklist_id = v_checklist.id AND NOT ci.deleted;

  SELECT COALESCE(jsonb_agg(ci.id ORDER BY
    CASE ci.priority WHEN 'critical' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
    ci.id), '[]'::jsonb) INTO v_eligible FROM checklist_items ci
  WHERE ci.checklist_id = v_checklist.id AND NOT ci.deleted
    AND ci.status = 'partially_covered' AND ci.understanding_level = 'basic'
    AND EXISTS (
      SELECT 1 FROM coverage_evidence ce JOIN messages m ON m.id = ce.message_id
      WHERE ce.item_id = ci.id AND m.room_id = p_room_id
        AND m.user_id = v_message.user_id AND m.user_role = 'student'
    ) AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        COALESCE(v_marker.event_payload->'analysis'->'events', '[]'::jsonb)
      ) focus_event
      WHERE focus_event->>'item_id' = ci.id::text
        AND focus_event->>'kind' IN ('initial_signal', 'post_repair_signal')
    ) AND NOT v_blocked;
  SELECT (value #>> '{}')::uuid INTO v_selected
  FROM jsonb_array_elements(v_eligible) value LIMIT 1;

  RETURN jsonb_build_object(
    'room_id', p_room_id, 'student_id', v_message.user_id,
    'checklist_id', v_checklist.id,
    'focus_student_message_id', v_message.id,
    'selected_target_item_id', v_selected,
    'no_assessment_due', v_selected IS NULL,
    'context', jsonb_build_object(
      'room_id', p_room_id, 'checklist_id', v_checklist.id,
      'focus_student_id', v_message.user_id,
      'focus_student_message', jsonb_build_object('id', v_message.id,
        'room_id', p_room_id, 'user_id', v_message.user_id,
        'user_role', 'student', 'content', v_message.content),
      'prior_participation_mode', v_room.active_response_mode,
      'checklist_items', v_items,
      'eligible_assessment_item_ids', v_eligible,
      'unresolved_assessment', NULL,
      'feedback_required', v_feedback,
      'progress_snapshot_hash', md5(v_items::text || v_message.id::text)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_transfer_assessment_context_v1(uuid, uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_transfer_assessment_context_v1(uuid, uuid, uuid, uuid, uuid)
  TO service_role;

CREATE FUNCTION public.send_reviewed_transfer_assessment_v1(
  p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid,
  p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  v_context jsonb;
  v_legacy_payload jsonb;
  v_result jsonb;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id
    AND transfer_learning_enabled AND active_response_mode <> 'guard' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSESSMENT_NOT_ELIGIBLE'; END IF;
  PERFORM 1 FROM checklist_items WHERE id = p_item_id AND checklist_id = p_checklist_id
    AND NOT deleted FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  v_context := public.prepare_transfer_assessment_context_v1(
    p_room_id, p_focus_student_message_id, p_checklist_id, p_actor_id, p_request_id
  );
  IF (v_context->>'selected_target_item_id')::uuid IS DISTINCT FROM p_item_id OR
     (v_context->>'student_id')::uuid IS DISTINCT FROM p_student_id OR
     p_reviewed_payload->>'target_item_id' IS DISTINCT FROM p_item_id::text OR
     btrim(COALESCE(p_reviewed_payload->>'reason', '')) = '' OR
     btrim(COALESCE(p_reviewed_payload->'assessment'->>'stem', '')) = '' THEN
    RAISE EXCEPTION 'ASSESSMENT_NOT_ELIGIBLE';
  END IF;
  IF jsonb_typeof(p_reviewed_payload->'assessment'->'transfer_basis'->'source_evidence_message_ids') <> 'array' OR
     jsonb_array_length(p_reviewed_payload->'assessment'->'transfer_basis'->'source_evidence_message_ids') = 0 OR
     EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(
         p_reviewed_payload->'assessment'->'transfer_basis'->'source_evidence_message_ids'
       ) evidence_id
       LEFT JOIN messages m ON m.id = evidence_id::uuid
       WHERE m.id IS NULL OR m.room_id <> p_room_id OR
         m.user_id <> p_student_id OR m.user_role <> 'student' OR
         NOT EXISTS (
           SELECT 1 FROM coverage_evidence ce
           WHERE ce.item_id = p_item_id AND ce.message_id = m.id
         )
     ) THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  IF EXISTS (
    SELECT 1 FROM private.transfer_assessments ta
    WHERE ta.room_id = p_room_id AND ta.student_id = p_student_id
      AND ta.item_id = p_item_id AND ta.lifecycle = 'failed'
      AND lower(btrim(ta.transfer_basis->>'changed_context')) =
        lower(btrim(p_reviewed_payload->'assessment'->'transfer_basis'->>'changed_context'))
  ) THEN RAISE EXCEPTION 'ASSESSMENT_NOT_ELIGIBLE'; END IF;
  v_legacy_payload := jsonb_build_object(
    'reason', p_reviewed_payload->>'reason',
    'learning_evidence', '[]'::jsonb,
    'decision', jsonb_build_object('mode', 'assessment',
      'instruction', 'transfer_assess', 'target_item_id', p_item_id),
    'response', p_reviewed_payload->'assessment'->>'stem',
    'assessment', p_reviewed_payload->'assessment'
  );
  v_result := public.send_reviewed_tutor_response_v4(
    v_legacy_payload, p_room_id, p_student_id, p_checklist_id,
    p_item_id, p_focus_student_message_id, p_actor_id, p_request_id
  );
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.send_reviewed_transfer_assessment_v1(
  jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_reviewed_transfer_assessment_v1(
  jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) TO service_role;
