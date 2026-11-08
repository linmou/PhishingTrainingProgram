--!/usr/bin/env psql
-- Purpose: offer learner-owned Covered targets once per visit and preserve exit questions across visits.
-- Baseline: live production catalogs inspected 2026-10-31 (staging MCP unavailable).
BEGIN;

CREATE TABLE private.learner_visits (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visit_key uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (room_id, student_id, visit_key)
);
CREATE INDEX learner_visits_latest ON private.learner_visits(room_id, student_id, started_at DESC);
ALTER TABLE private.learner_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.learner_visits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_learner_visit_v1(p_room_id uuid, p_student_id uuid, p_visit_key uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_visit_key IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.sessions s JOIN public.rooms r ON r.id = s.room_id
    WHERE s.room_id = p_room_id AND s.student_id = p_student_id AND s.status = 'active' AND r.is_active
      AND s.id = (SELECT first_session.id FROM public.sessions first_session
        WHERE first_session.room_id = p_room_id AND first_session.status = 'active'
          AND first_session.student_id IS NOT NULL ORDER BY first_session.started_at, first_session.id LIMIT 1)
  ) THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  INSERT INTO private.learner_visits(room_id, student_id, visit_key)
  VALUES(p_room_id, p_student_id, p_visit_key) ON CONFLICT DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.start_learner_visit_v1(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_learner_visit_v1(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.transfer_assessment_due_event(p_item_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT e.event_id
  FROM public.checklist_items ci
  JOIN LATERAL (
    SELECT u.* FROM public.checklist_updates u WHERE u.item_id = ci.id
      AND u.assessment_id IS NULL
      AND (u.previous_status IS DISTINCT FROM u.new_status
        OR u.previous_understanding IS DISTINCT FROM u.new_understanding)
    ORDER BY u.created_at DESC, u.id DESC LIMIT 1
  ) latest ON true
  JOIN private.learning_event_inbox e ON e.event_id = latest.event_id
  WHERE ci.id = p_item_id AND NOT ci.deleted
    AND ci.status = 'covered' AND ci.understanding_level = 'good'
    AND latest.new_status = 'covered' AND latest.new_understanding = 'good'
    AND e.event_kind IN ('demonstrated_understanding', 'spontaneous_transfer') AND e.processing_state = 'applied'
    AND e.item_id = ci.id AND e.checklist_id = ci.checklist_id
    AND e.event_payload->>'target_area_text' = ci.area_text
    AND EXISTS (SELECT 1 FROM public.session_checklists sc
      JOIN public.messages m ON m.id = e.source_message_id
      WHERE sc.id = ci.checklist_id AND sc.room_id = e.room_id AND sc.student_id = e.student_id
        AND m.room_id = e.room_id AND m.user_id = e.student_id AND m.user_role = 'student')
$function$
;

CREATE OR REPLACE FUNCTION public.prepare_transfer_assessment_context_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_message messages%ROWTYPE;
  v_checklist session_checklists%ROWTYPE;
  v_room rooms%ROWTYPE;
  v_marker private.learning_event_inbox%ROWTYPE;
  v_items jsonb;
  v_eligible jsonb;
  v_selected uuid;
  v_visit_start timestamptz;
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
  IF v_marker.processing_state = 'deferred_guard' AND v_room.guard_mode = false THEN
    RAISE EXCEPTION 'ANALYSIS_INCOMPLETE';
  END IF;

  SELECT max(started_at) INTO v_visit_start FROM private.learner_visits
    WHERE room_id = p_room_id AND student_id = v_message.user_id;
  v_blocked := v_room.guard_mode = true;

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
    AND ci.status = 'covered' AND ci.understanding_level = 'good'
    AND EXISTS (
      SELECT 1 FROM coverage_evidence ce JOIN messages m ON m.id = ce.message_id
      WHERE ce.item_id = ci.id AND m.room_id = p_room_id
        AND m.user_id = v_message.user_id AND m.user_role = 'student'
    ) AND EXISTS (
      SELECT 1 FROM private.learning_event_inbox due
      JOIN public.messages evidence ON evidence.id = due.source_message_id
      WHERE due.event_id = private.transfer_assessment_due_event(ci.id)
        AND evidence.room_id = p_room_id AND evidence.user_id = v_message.user_id
        AND (evidence.created_at, evidence.id) <= (v_message.created_at, v_message.id)
    ) AND NOT v_blocked
    AND NOT EXISTS (
      SELECT 1 FROM private.transfer_assessments ta
      WHERE ta.room_id = p_room_id AND ta.student_id = v_message.user_id AND ta.item_id = ci.id
        AND (ta.lifecycle = 'open'
          OR (ta.lifecycle <> 'cancelled' AND ta.created_at >= COALESCE(v_visit_start, '-infinity'::timestamptz))
          OR (ta.lifecycle IN ('passed', 'failed') AND ta.closed_at >= COALESCE(v_visit_start, '-infinity'::timestamptz)))
    );
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
      'prior_guard_mode', v_room.guard_mode,
      'checklist_items', v_items,
      'eligible_assessment_item_ids', v_eligible,
      'unresolved_assessment', NULL,
      'feedback_required', false,
      'progress_snapshot_hash', md5(v_items::text || v_message.id::text)
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_reviewed_tutor_response_v4(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_item public.checklist_items%ROWTYPE;
  v_message uuid;
  v_assessment uuid := gen_random_uuid();
  v_payload jsonb := p_reviewed_payload->'assessment';
  v_mode text := p_reviewed_payload->'decision'->>'mode';
  v_key text[];
  v_options jsonb;
  v_student uuid;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR v_room.tutor_id IS DISTINCT FROM p_actor_id OR v_room.practice_type<>'phishing' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND "current_role" = 'tutor') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.session_checklists WHERE id = p_checklist_id
      AND room_id = p_room_id AND student_id = p_student_id AND is_active AND progress_policy_version = 'transfer_v1')
    OR NOT EXISTS (SELECT 1 FROM public.sessions WHERE room_id = p_room_id AND student_id = p_student_id AND status = 'active')
    OR NOT EXISTS (SELECT 1 FROM public.messages WHERE id = p_focus_student_message_id AND room_id = p_room_id
      AND user_id = p_student_id AND user_role = 'student') THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT id,user_id INTO v_message,v_student FROM public.messages WHERE assessment_request_id = p_request_id;
  IF FOUND THEN
    IF v_student IS DISTINCT FROM p_actor_id OR NOT EXISTS (SELECT 1 FROM public.messages WHERE id = v_message AND room_id = p_room_id)
      THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
    RETURN jsonb_build_object('message',private.transfer_public_message(v_message),'room',to_jsonb(v_room));
  END IF;
  IF v_mode IS NULL OR v_mode NOT IN ('assessment','tutoring','guard') OR btrim(COALESCE(p_reviewed_payload->>'response','')) = ''
    THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  IF v_mode = 'assessment' THEN
    SELECT * INTO v_item FROM public.checklist_items WHERE id = p_item_id AND checklist_id = p_checklist_id AND NOT deleted FOR UPDATE;
    IF NOT FOUND OR v_item.status <> 'covered' OR v_item.understanding_level <> 'good'
      OR private.transfer_assessment_due_event(p_item_id) IS NULL
      OR p_reviewed_payload->'decision'->>'instruction' IS DISTINCT FROM 'transfer_assess'
      OR p_reviewed_payload->'decision'->>'target_item_id' IS DISTINCT FROM p_item_id::text
      OR v_payload->>'selection_type' IS NULL OR v_payload->>'selection_type' NOT IN ('single','multiple')
      OR btrim(COALESCE(v_payload->>'stem','')) = ''
      OR btrim(COALESCE(v_payload->>'learner_safe_explanation','')) = ''
      OR jsonb_typeof(v_payload->'options') IS DISTINCT FROM 'array'
      OR jsonb_array_length(v_payload->'options') <> 4
      OR jsonb_typeof(v_payload->'correct_option_ids') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_payload->'transfer_basis') IS DISTINCT FROM 'object'
      THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    SELECT array_agg(DISTINCT k ORDER BY k) INTO v_key FROM jsonb_array_elements_text(v_payload->'correct_option_ids') k;
    IF v_key IS NULL OR NOT v_key <@ ARRAY['A','B','C','D'] OR
      (v_payload->>'selection_type' = 'single' AND cardinality(v_key) <> 1) OR
      (v_payload->>'selection_type' = 'multiple' AND cardinality(v_key) NOT IN (2,3)) OR
      (SELECT array_agg(o->>'id' ORDER BY o->>'id') FROM jsonb_array_elements(v_payload->'options') o) IS DISTINCT FROM ARRAY['A','B','C','D'] OR
      EXISTS (SELECT 1 FROM jsonb_array_elements(v_payload->'options') o WHERE btrim(COALESCE(o->>'text','')) = '')
      THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    IF EXISTS (SELECT 1 FROM private.transfer_assessments WHERE room_id = p_room_id AND student_id = p_student_id AND item_id = p_item_id AND lifecycle = 'open')
      THEN RAISE EXCEPTION 'ASSESSMENT_ALREADY_OPEN'; END IF;
    SELECT jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text') ORDER BY o->>'id') INTO v_options
      FROM jsonb_array_elements(v_payload->'options') o;
  ELSIF p_item_id IS NOT NULL OR p_reviewed_payload->'assessment' IS DISTINCT FROM 'null'::jsonb
    OR p_reviewed_payload->'decision'->>'target_item_id' IS NOT NULL THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  INSERT INTO public.messages(room_id,user_id,user_role,content,parent_message_id,response_mode,
    assessment_id,assessment_options,assessment_selection_type,assessment_student_id,assessment_lifecycle,
    assessment_checklist_id,assessment_item_id,assessment_request_id)
  VALUES(p_room_id,p_actor_id,'tutor',CASE WHEN v_mode = 'assessment' THEN v_payload->>'stem' ELSE p_reviewed_payload->>'response' END,
    p_focus_student_message_id,v_mode::public.tutor_turn_mode,
    CASE WHEN v_mode = 'assessment' THEN v_assessment END,v_options,
    CASE WHEN v_mode = 'assessment' THEN v_payload->>'selection_type' END,
    CASE WHEN v_mode = 'assessment' THEN p_student_id END,CASE WHEN v_mode = 'assessment' THEN 'delivered' END,
    CASE WHEN v_mode = 'assessment' THEN p_checklist_id END,p_item_id,p_request_id) RETURNING id INTO v_message;
  IF v_mode = 'assessment' THEN
    INSERT INTO private.transfer_assessments(id,question_message_id,room_id,student_id,checklist_id,item_id,
      focus_student_message_id,selection_type,correct_option_ids,learner_safe_explanation,transfer_basis,
      reviewed_private_payload,lifecycle,delivery_request_id,progress_snapshot_hash)
    VALUES(v_assessment,v_message,p_room_id,p_student_id,p_checklist_id,p_item_id,p_focus_student_message_id,
      v_payload->>'selection_type',v_key,v_payload->>'learner_safe_explanation',v_payload->'transfer_basis',
      v_payload,'open',p_request_id,private.transfer_item_hash(p_item_id));
  END IF;
  UPDATE public.rooms SET guard_mode = (v_mode = 'guard'),
    guard_mode_changed_at = now(),guard_mode_change_source = 'reviewed_response' WHERE id = p_room_id RETURNING * INTO v_room;
  RETURN jsonb_build_object('message',private.transfer_public_message(v_message),'room',to_jsonb(v_room));
END $function$
;

COMMIT;

