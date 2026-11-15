-- Issue 96: tracking is independent of assessment eligibility.
-- No historical rows are changed or rejudged.
BEGIN;
CREATE OR REPLACE FUNCTION public.initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_items jsonb, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_checklist_id uuid;
  v_item jsonb;
  v_setting text := COALESCE(current_setting('app.transfer_operation', true), '');
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') OR NOT EXISTS (
    SELECT 1 FROM public.rooms WHERE id = p_room_id AND tutor_id = p_actor_id
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

  PERFORM set_config('app.transfer_operation', 'on', true);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  SELECT id INTO v_checklist_id
  FROM public.session_checklists
  WHERE room_id = p_room_id AND student_id = p_student_id
    AND progress_policy_version = 'transfer_v1' AND is_active
  ORDER BY created_at, id
  LIMIT 1 FOR UPDATE;
  IF v_checklist_id IS NULL THEN
    INSERT INTO public.session_checklists(room_id, student_id, progress_policy_version, template_name, is_active)
    VALUES (p_room_id, p_student_id, 'transfer_v1', 'Room learning targets', true)
    RETURNING id INTO v_checklist_id;
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
  PERFORM set_config('app.transfer_operation', v_setting, true);
  RETURN jsonb_build_object('checklist_id', v_checklist_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_transfer_message_analysis_context_v1(p_room_id uuid, p_message_id uuid, p_actor_id uuid)
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
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) OR
     NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) AND
     p_actor_id <> v_message.user_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF EXISTS(SELECT 1 FROM rooms WHERE id=p_room_id AND practice_type='cyberbullying') THEN
    PERFORM public.initialize_cyberbullying_progress_v1(p_room_id,v_message.user_id);
  END IF;
  SELECT * INTO v_checklist FROM session_checklists
  WHERE room_id = p_room_id AND student_id = v_message.user_id
    AND progress_policy_version = 'transfer_v1' AND is_active;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM session_checklists WHERE room_id=p_room_id AND progress_policy_version='legacy_v1') THEN
      RETURN jsonb_build_object('analysis_complete',true,'historical_read_only',true);
    END IF;
    RAISE EXCEPTION 'TARGET_SETUP_REQUIRED';
  END IF;
  IF v_message.created_at < v_checklist.created_at AND EXISTS (
    SELECT 1 FROM session_checklists WHERE room_id=p_room_id AND progress_policy_version='legacy_v1'
  ) THEN
    RETURN jsonb_build_object('analysis_complete',true,'historical_read_only',true);
  END IF;
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
      'user_role', m.user_role, 'speaker_name',coalesce(m.persona_name,u.display_name), 'character',m.character, 'persona_id',m.persona_id, 'content',m.content
    ), 1, 0::bigint, m.created_at, m.id
    FROM messages m LEFT JOIN users u ON u.id=m.user_id
    WHERE m.room_id = p_room_id
      AND (m.created_at, m.id) <= (v_message.created_at, v_message.id)
  ) dialogue;

  SELECT * INTO v_marker FROM private.learning_event_inbox
  WHERE dedupe_key = 'analysis:' || p_message_id::text;
  RETURN jsonb_build_object(
    'room_id', p_room_id, 'practice_type',(SELECT practice_type FROM rooms WHERE id=p_room_id),
    'scenario',(SELECT scenario_config FROM rooms WHERE id=p_room_id), 'student_id', v_message.user_id,
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


-- Browsers retain read/export access. Manual edits use the verified actor API.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.session_checklists,
  public.checklist_items, public.coverage_evidence, public.checklist_updates
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_checklist_from_template(uuid,text),
  public.initialize_checklist_from_template(uuid,uuid,text),
  public.update_checklist_progress(uuid),
  public.extract_checklist_from_prompt(text,uuid,uuid),
  public.soft_delete_checklist_item(uuid) FROM PUBLIC, anon, authenticated;
COMMIT;
