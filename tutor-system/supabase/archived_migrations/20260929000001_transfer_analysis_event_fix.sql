-- #!/usr/bin/env psql
-- Purpose: correct the dedupe-key expression used when semantic learner evidence is applied.

CREATE OR REPLACE FUNCTION public.apply_transfer_message_analysis_v1(
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
$$;

REVOKE ALL ON FUNCTION public.apply_transfer_message_analysis_v1(uuid, uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_transfer_message_analysis_v1(uuid, uuid, uuid, uuid, jsonb)
  TO service_role;
