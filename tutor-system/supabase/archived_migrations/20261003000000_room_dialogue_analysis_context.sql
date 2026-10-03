--!/usr/bin/env psql
-- Purpose: give the transfer status judge the room dialogue through its focus learner message.
-- Apply on staging and verify before production; deploy the matching Edge function after SQL in each project.

CREATE OR REPLACE FUNCTION public.get_transfer_message_analysis_context_v1(
  p_room_id uuid, p_message_id uuid, p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_message messages%ROWTYPE;
  v_checklist session_checklists%ROWTYPE;
  v_marker private.learning_event_inbox%ROWTYPE;
  v_items jsonb;
  v_dialogue jsonb;
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

  SELECT COALESCE(jsonb_agg(turn ORDER BY source_order, setup_order, turn_at, message_order), '[]'::jsonb)
  INTO v_dialogue
  FROM (
    SELECT jsonb_build_object(
      'id', 'prepop-' || p_room_id::text || '-' || (setup.ordinal - 1)::text,
      'source', 'room_setup', 'user_id', NULL, 'user_role', setup.entry->>'role',
      'speaker_name', setup.entry->>'user_name', 'content', setup.entry->>'message'
    ) AS turn, 0 AS source_order, setup.ordinal AS setup_order,
      NULL::timestamptz AS turn_at, NULL::uuid AS message_order
    FROM rooms r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.pre_populated_dialogue) = 'array'
        THEN r.pre_populated_dialogue ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS setup(entry, ordinal)
    WHERE r.id = p_room_id
    UNION ALL
    SELECT jsonb_build_object(
      'id', m.id, 'source', 'message', 'user_id', m.user_id,
      'user_role', m.user_role, 'speaker_name', NULL, 'content', m.content
    ), 1, 0::bigint, m.created_at, m.id
    FROM messages m
    WHERE m.room_id = p_room_id
      AND (m.created_at, m.id) <= (v_message.created_at, v_message.id)
  ) dialogue;

  SELECT * INTO v_marker FROM private.learning_event_inbox
  WHERE dedupe_key = 'analysis:' || p_message_id::text;
  RETURN jsonb_build_object(
    'room_id', p_room_id, 'student_id', v_message.user_id,
    'checklist_id', v_checklist.id,
    'message', jsonb_build_object('id', v_message.id, 'room_id', v_message.room_id,
      'user_id', v_message.user_id, 'user_role', v_message.user_role, 'content', v_message.content),
    'items', v_items,
    'dialogue_history', v_dialogue,
    'analysis_complete', COALESCE(v_marker.processing_state IN ('applied', 'no_change'), false),
    'analysis_deferred', COALESCE(v_marker.processing_state = 'deferred_guard', false)
  );
END;
$function$;
