--!/usr/bin/env psql
-- Purpose: accept learner-demonstrated understanding as direct evidence of covered progress.

CREATE OR REPLACE FUNCTION public.apply_learning_event_v1(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
    v_event_id UUID := (p_event->>'event_id')::UUID;
    v_dedupe_key TEXT := p_event->>'dedupe_key';
    v_kind TEXT := p_event->>'kind';
    v_item checklist_items%ROWTYPE;
    v_room rooms%ROWTYPE;
    v_old_status TEXT;
    v_old_level TEXT;
    v_next_status TEXT;
    v_next_level TEXT;
    v_student_id UUID;
    v_evidence_id UUID;
    v_update_id UUID;
    v_existing private.learning_event_inbox%ROWTYPE;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_existing FROM private.learning_event_inbox WHERE dedupe_key = v_dedupe_key;
    IF FOUND THEN
        RETURN jsonb_build_object('event_id', v_existing.event_id, 'processing_state', v_existing.processing_state, 'status', v_existing.error_code);
    END IF;

    SELECT * INTO v_item FROM checklist_items WHERE id = (p_event->>'item_id')::UUID FOR UPDATE;
    SELECT r.* INTO v_room FROM rooms r JOIN session_checklists sc ON sc.room_id = r.id WHERE sc.id = v_item.checklist_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = '23503'; END IF;
    IF (SELECT progress_policy_version FROM session_checklists WHERE id = v_item.checklist_id) <> 'transfer_v1' THEN
        RAISE EXCEPTION 'LEGACY_CHECKLIST' USING ERRCODE = 'P0001';
    END IF;
    SELECT student_id INTO v_student_id
    FROM session_checklists
    WHERE id = v_item.checklist_id;
    IF (p_event->>'room_id')::UUID <> v_room.id
       OR (p_event->>'student_id')::UUID <> v_student_id
       OR btrim(COALESCE(p_event->>'evidence_text', '')) = ''
       OR jsonb_typeof(p_event->'source_evidence_message_ids') <> 'array'
       OR jsonb_array_length(p_event->'source_evidence_message_ids') = 0 THEN
        RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
    END IF;

    IF v_kind NOT IN (
        'initial_signal', 'demonstrated_understanding', 'post_repair_signal', 'spontaneous_transfer',
        'contradiction', 'assessment_pass', 'assessment_fail'
    ) THEN
        RAISE EXCEPTION 'UNKNOWN_EVENT_KIND' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(p_event->'source_evidence_message_ids') AS source_evidence(message_id)
        LEFT JOIN messages m ON m.id = source_evidence.message_id::UUID
        WHERE m.id IS NULL
           OR NOT (
                m.room_id = v_room.id
                AND m.user_id = v_student_id
                AND m.user_role = 'student'
           )
    ) THEN
        RAISE EXCEPTION 'INVALID_SOURCE_EVIDENCE' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO private.learning_event_inbox(event_id, dedupe_key, room_id, student_id, checklist_id, item_id, source_message_id, event_kind, event_payload, classified_by)
    VALUES (v_event_id, v_dedupe_key, (p_event->>'room_id')::UUID, (p_event->>'student_id')::UUID, v_item.checklist_id, v_item.id, NULLIF(p_event->>'source_message_id', '')::UUID, v_kind, p_event, COALESCE(p_event->>'classified_by', 'trusted_backend'));

    IF v_room.active_response_mode = 'guard' THEN
        UPDATE private.learning_event_inbox SET processing_state = 'deferred_guard' WHERE event_id = v_event_id;
        RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'deferred_guard', 'error_code', 'PROGRESSION_LOCKED');
    END IF;

    v_old_status := v_item.status;
    v_old_level := v_item.understanding_level;
    v_next_status := v_old_status;
    v_next_level := v_old_level;
    IF v_kind = 'initial_signal' AND v_old_status = 'pending' THEN v_next_status := 'partially_covered'; v_next_level := 'basic';
    ELSIF v_kind = 'post_repair_signal' AND v_old_status = 'needs_review' THEN v_next_status := 'partially_covered'; v_next_level := 'basic';
    ELSIF v_kind = 'demonstrated_understanding' AND v_old_status IN ('pending', 'partially_covered') THEN v_next_status := 'covered'; v_next_level := 'good';
    ELSIF v_kind = 'spontaneous_transfer' AND v_old_status <> 'covered' THEN v_next_status := 'covered'; v_next_level := 'good';
    ELSIF v_kind = 'contradiction' AND v_old_status IN ('partially_covered', 'covered') THEN v_next_status := 'needs_review'; v_next_level := 'basic';
    ELSIF v_kind = 'assessment_pass' AND v_old_status = 'partially_covered' THEN v_next_status := 'covered'; v_next_level := 'good';
    ELSIF v_kind = 'assessment_fail' AND v_old_status = 'partially_covered' THEN v_next_status := 'needs_review'; v_next_level := 'basic';
    ELSIF v_kind IN ('assessment_pass', 'assessment_fail') THEN
        UPDATE private.learning_event_inbox SET processing_state = 'rejected', error_code = 'INVALID_TRANSITION' WHERE event_id = v_event_id;
        RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'rejected', 'error_code', 'INVALID_TRANSITION');
    END IF;

    IF v_next_status = v_old_status AND v_next_level = v_old_level THEN
        UPDATE private.learning_event_inbox SET processing_state = 'no_change', applied_at = NOW() WHERE event_id = v_event_id;
        RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'no_change');
    END IF;

    PERFORM set_config('app.transfer_operation', 'on', true);
    INSERT INTO coverage_evidence(item_id, evidence_text, analysis, confidence_score, detection_method, message_id, event_id, assessment_id)
    VALUES (v_item.id, COALESCE(p_event->>'evidence_text', ''), COALESCE(p_event->>'explanation', 'Transfer event applied by trusted operation'), 100, CASE WHEN p_event->>'classified_by' = 'tutor' THEN 'tutor_manual' ELSE 'ai_analysis' END, NULLIF(p_event->>'source_message_id', '')::UUID, v_event_id, NULLIF(p_event->>'assessment_id', '')::UUID)
    RETURNING id INTO v_evidence_id;
    UPDATE checklist_items SET status = v_next_status, understanding_level = v_next_level, last_addressed = NOW(), attempts_count = attempts_count + CASE WHEN v_kind IN ('assessment_pass', 'assessment_fail', 'spontaneous_transfer') THEN 1 ELSE 0 END, updated_at = NOW() WHERE id = v_item.id;
    INSERT INTO checklist_updates(checklist_id, item_id, previous_status, new_status, previous_understanding, new_understanding, evidence_id, event_id, assessment_id, updated_by)
    VALUES (v_item.checklist_id, v_item.id, v_old_status, v_next_status, v_old_level, v_next_level, v_evidence_id, v_event_id, NULLIF(p_event->>'assessment_id', '')::UUID, CASE WHEN p_event->>'classified_by' = 'tutor' THEN 'tutor' ELSE 'ai' END)
    RETURNING id INTO v_update_id;
    UPDATE private.learning_event_inbox SET processing_state = 'applied', linked_update_id = v_update_id, linked_evidence_id = v_evidence_id, applied_at = NOW() WHERE event_id = v_event_id;
    RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'applied', 'evidence_id', v_evidence_id, 'update_id', v_update_id, 'status', v_next_status, 'understanding_level', v_next_level);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_transfer_message_analysis_v1(p_room_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_analysis jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
      'initial_signal', 'demonstrated_understanding', 'post_repair_signal', 'spontaneous_transfer', 'contradiction'
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
      'dedupe_key', 'message:' || p_message_id::text || ':' ||
        (v_event->>'item_id') || ':' || (v_event->>'kind'),
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
$function$
;

REVOKE ALL ON FUNCTION public.apply_learning_event_v1(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_learning_event_v1(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.apply_transfer_message_analysis_v1(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_transfer_message_analysis_v1(uuid,uuid,uuid,uuid,jsonb) TO service_role;
