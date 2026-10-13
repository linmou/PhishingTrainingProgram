-- Repair transfer QA persistence and authorized review using the inspected 2026-10-13 hosted definitions.
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

  PERFORM set_config('app.transfer_operation', 'on', true);
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
  PERFORM set_config('app.transfer_operation', v_setting, true);
  RETURN jsonb_build_object('checklist_id', v_checklist_id);
END;
$function$

;
CREATE OR REPLACE FUNCTION public.edit_room_checklist_v1(p_room_id uuid, p_actor_id uuid, p_request_id uuid, p_action text, p_item_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_checklist public.session_checklists%ROWTYPE;
  v_item public.checklist_items%ROWTYPE;
  v_old_status text;
  v_old_level text;
  v_new_status text;
  v_new_level text;
  v_area text;
  v_priority text;
  v_setting text := COALESCE(current_setting('app.transfer_operation', true), '');
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = p_room_id AND tutor_id = p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.checklist_updates WHERE event_id = p_request_id AND updated_by = 'tutor') THEN
    IF NOT EXISTS (SELECT 1 FROM public.checklist_updates u JOIN public.session_checklists sc ON sc.id = u.checklist_id
      WHERE u.event_id = p_request_id AND u.item_id = p_item_id AND sc.room_id = p_room_id) THEN
      RAISE EXCEPTION 'INVALID_SCOPE';
    END IF;
    RETURN (SELECT jsonb_build_object('request_id', p_request_id, 'processing_state', 'duplicate',
      'item_id', id, 'status', status, 'understanding_level', understanding_level)
      FROM public.checklist_items WHERE id = p_item_id);
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
    PERFORM set_config('app.transfer_operation', v_setting, true);
    RETURN jsonb_build_object('item_id', p_item_id, 'status', 'pending', 'understanding_level', 'none');
  END IF;

  SELECT * INTO v_item FROM public.checklist_items WHERE id = p_item_id AND checklist_id = v_checklist.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  v_old_status := v_item.status;
  v_old_level := v_item.understanding_level;
  v_new_status := v_old_status;
  v_new_level := v_old_level;

  IF p_action = 'set_status' THEN
    v_new_status := p_payload->>'status';
    IF v_new_status IS NULL OR v_new_status NOT IN ('pending', 'partially_covered', 'covered', 'needs_review') THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    IF v_checklist.progress_policy_version = 'transfer_v1' THEN
      v_new_level := CASE v_new_status WHEN 'pending' THEN 'none' WHEN 'covered' THEN 'good' ELSE 'basic' END;
    END IF;
    UPDATE public.checklist_items SET status = v_new_status, understanding_level = v_new_level, tutor_notes = COALESCE(p_payload->>'note', tutor_notes), updated_at = now() WHERE id = p_item_id;
  ELSIF p_action = 'set_understanding' THEN
    v_new_level := p_payload->>'understanding_level';
    IF v_new_level IS NULL OR v_new_level NOT IN ('none', 'basic', 'good', 'excellent') THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    IF v_checklist.progress_policy_version = 'transfer_v1' THEN
      IF v_new_level = 'excellent' THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
      v_new_status := CASE v_new_level WHEN 'none' THEN 'pending' WHEN 'good' THEN 'covered'
        ELSE CASE WHEN v_old_status = 'needs_review' THEN 'needs_review' ELSE 'partially_covered' END END;
    END IF;
    UPDATE public.checklist_items SET status = v_new_status, understanding_level = v_new_level, updated_at = now() WHERE id = p_item_id;
  ELSIF p_action = 'edit_item' THEN
    IF NOT (p_payload ? 'area_text' OR p_payload ? 'tutor_notes')
      OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('area_text','tutor_notes'))
      OR (p_payload ? 'area_text' AND (jsonb_typeof(p_payload->'area_text') <> 'string' OR btrim(p_payload->>'area_text') = ''))
      OR (p_payload ? 'tutor_notes' AND jsonb_typeof(p_payload->'tutor_notes') <> 'string')
    THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    UPDATE public.checklist_items SET
      area_text = CASE WHEN p_payload ? 'area_text' THEN btrim(p_payload->>'area_text') ELSE area_text END,
      tutor_notes = CASE WHEN p_payload ? 'tutor_notes' THEN p_payload->>'tutor_notes' ELSE tutor_notes END,
      updated_at = now() WHERE id = p_item_id;
  ELSIF p_action = 'set_priority' THEN
    v_priority := p_payload->>'priority';
    IF v_priority NOT IN ('critical', 'important', 'optional') THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
    UPDATE public.checklist_items SET priority = v_priority, updated_at = now() WHERE id = p_item_id;
  ELSIF p_action = 'remove_item' THEN
    UPDATE public.checklist_items SET deleted = true, updated_at = now() WHERE id = p_item_id;
    UPDATE private.transfer_assessments SET lifecycle = 'cancelled', closed_at = now(), updated_at = now()
    WHERE item_id = p_item_id AND lifecycle = 'open';
    UPDATE public.messages SET assessment_lifecycle = 'cancelled', assessment_closed_at = now()
    WHERE id IN (SELECT question_message_id FROM private.transfer_assessments WHERE item_id = p_item_id AND lifecycle = 'cancelled');
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
  PERFORM set_config('app.transfer_operation', v_setting, true);
  RETURN jsonb_build_object('item_id', p_item_id, 'status', v_new_status, 'understanding_level', v_new_level);
END;
$function$

;
CREATE OR REPLACE FUNCTION public.post_assessment_message_v2(p_room_id uuid, p_content text, p_parent_message_id uuid, p_assessment_id uuid, p_selected_option_ids text[], p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_assessment private.transfer_assessments%ROWTYPE;
  v_message public.messages%ROWTYPE;
  v_role public.user_role;
  v_selected text[];
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  SELECT "current_role" INTO v_role FROM public.users WHERE id = p_actor_id;
  IF v_room.id IS NULL OR v_role IS NULL OR NOT (v_room.tutor_id = p_actor_id OR EXISTS (SELECT 1 FROM public.sessions
      WHERE room_id = p_room_id AND student_id = p_actor_id AND status = 'active')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_message FROM public.messages WHERE assessment_request_id = p_request_id;
  IF FOUND THEN
    IF v_message.user_id IS DISTINCT FROM p_actor_id OR v_message.room_id IS DISTINCT FROM p_room_id THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
    RETURN jsonb_build_object('message',to_jsonb(v_message));
  END IF;
  IF btrim(COALESCE(p_content,'')) = '' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  IF p_parent_message_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.messages WHERE id = p_parent_message_id AND room_id = p_room_id)
    THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF p_assessment_id IS NOT NULL THEN
    SELECT * INTO v_assessment FROM private.transfer_assessments WHERE id = p_assessment_id FOR UPDATE;
    IF NOT FOUND OR v_assessment.room_id IS DISTINCT FROM p_room_id OR v_assessment.student_id IS DISTINCT FROM p_actor_id
      OR v_assessment.lifecycle <> 'open' OR v_role <> 'student' THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
    IF p_parent_message_id IS DISTINCT FROM v_assessment.question_message_id THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
    SELECT array_agg(DISTINCT x ORDER BY x) INTO v_selected FROM unnest(p_selected_option_ids) x;
    IF p_selected_option_ids IS NOT NULL AND (v_selected IS NULL OR NOT v_selected <@ ARRAY['A','B','C','D'] OR
      (v_assessment.selection_type = 'single' AND cardinality(v_selected) <> 1)) THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  END IF;
  INSERT INTO public.messages(room_id,user_id,user_role,content,parent_message_id,assessment_id,
    assessment_selected_option_ids,assessment_request_id)
  VALUES(p_room_id,p_actor_id,v_role,p_content,p_parent_message_id,p_assessment_id,v_selected,p_request_id) RETURNING * INTO v_message;
  RETURN jsonb_build_object('message',to_jsonb(v_message));
END $function$

;
CREATE OR REPLACE FUNCTION public.process_assessment_message_v2(p_assessment_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_expected_attempt_count integer, p_expected_resolution text, p_answer_outcome text, p_selected_option_ids text[], p_next_progress jsonb, p_applied_transition text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  m public.messages%ROWTYPE;
  v_result jsonb;
  v_event jsonb;
  v_transition jsonb;
  v_outcome text;
  v_selected text[];
  v_count integer;
  v_terminal boolean;
  v_state text := 'applied';
BEGIN
  -- Match delivery's lock order: room first, then private assessment.
  PERFORM 1 FROM public.rooms WHERE id = (SELECT room_id FROM private.transfer_assessments WHERE id = p_assessment_id) FOR UPDATE;
  SELECT * INTO a FROM private.transfer_assessments WHERE id = p_assessment_id FOR UPDATE;
  IF NOT FOUND OR a.student_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  SELECT * INTO m FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND OR m.user_id IS DISTINCT FROM p_actor_id OR m.room_id IS DISTINCT FROM a.room_id
    OR m.assessment_id IS DISTINCT FROM a.id OR m.parent_message_id IS DISTINCT FROM a.question_message_id THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT authoritative_result INTO v_result FROM private.transfer_assessment_attempts WHERE answer_message_id = p_message_id;
  IF FOUND THEN RETURN v_result || jsonb_build_object('processing_state','duplicate','already_processed',true); END IF;
  IF a.lifecycle IS DISTINCT FROM p_expected_resolution OR a.attempt_count IS DISTINCT FROM p_expected_attempt_count THEN
    RETURN jsonb_build_object('code','CONCURRENT_MODIFICATION'); END IF;
  IF a.lifecycle <> 'open' THEN RAISE EXCEPTION 'ASSESSMENT_TERMINAL'; END IF;
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_selected FROM unnest(COALESCE(m.assessment_selected_option_ids, p_selected_option_ids)) x;
  IF v_selected IS NULL OR NOT v_selected <@ ARRAY['A','B','C','D']
    OR (a.selection_type = 'single' AND cardinality(v_selected) <> 1)
    OR v_selected IS DISTINCT FROM p_selected_option_ids THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  v_count := a.attempt_count + 1;
  v_outcome := CASE WHEN v_selected = a.correct_option_ids THEN 'passed' WHEN v_count = 1 THEN 'retry' ELSE 'failed' END;
  IF p_answer_outcome IS DISTINCT FROM v_outcome OR p_applied_transition IS DISTINCT FROM
      (CASE WHEN v_outcome = 'passed' THEN 'assessment_pass' WHEN v_outcome = 'failed' THEN 'assessment_fail' END)
    THEN RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION'; END IF;
  v_terminal := v_outcome <> 'retry';
  IF v_terminal THEN
    IF p_next_progress->>'status' IS DISTINCT FROM (CASE WHEN v_outcome = 'passed' THEN 'covered' ELSE 'needs_review' END)
      OR p_next_progress->>'understanding_level' IS DISTINCT FROM (CASE WHEN v_outcome = 'passed' THEN 'good' ELSE 'basic' END)
      THEN RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION'; END IF;
    v_event := jsonb_build_object('event_id',gen_random_uuid(),'dedupe_key','assessment:'||a.id::text,
      'kind',p_applied_transition,'room_id',a.room_id,'student_id',a.student_id,'item_id',a.item_id,'assessment_id',a.id,
      'source_message_id',m.id,'source_evidence_message_ids',jsonb_build_array(m.id),'evidence_text',m.content,'classified_by','trusted_backend');
    v_transition := public.apply_learning_event_v1(v_event);
    IF v_transition->>'processing_state' = 'rejected' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
    IF v_transition->>'processing_state' = 'deferred_guard' THEN v_state := 'deferred'; END IF;
    UPDATE private.transfer_assessments SET lifecycle = v_outcome,terminal_result = v_outcome,
      terminal_answer_message_id = m.id,closed_at = now() WHERE id = a.id;
    UPDATE public.messages SET assessment_lifecycle = v_outcome,assessment_answer_message_id = m.id,
      assessment_result = CASE WHEN v_outcome = 'passed' THEN 'pass' ELSE 'fail' END,assessment_closed_at = now()
      WHERE id = a.question_message_id;
  END IF;
  UPDATE private.transfer_assessments SET attempt_count = v_count,updated_at = now() WHERE id = a.id;
  v_result := jsonb_build_object('message_id',m.id,'assessment_id',a.id,'processing_state',v_state,
    'answer_outcome',v_outcome,'attempt_number',v_count,'attempts_used',v_count,
    'attempts_remaining',CASE WHEN v_terminal THEN 0 ELSE 2-v_count END,'selected_option_ids',v_selected,
    'terminal',v_terminal,'transition',p_applied_transition,'feedback_required',v_terminal,
    'already_processed',false,'code',CASE WHEN v_state = 'deferred' THEN 'PROGRESSION_LOCKED' END,
    'terminal_failure_feedback',CASE WHEN v_outcome = 'failed' THEN jsonb_build_object(
      'correct_option_ids',a.correct_option_ids,'learner_safe_explanation',a.learner_safe_explanation) END);
  INSERT INTO private.transfer_assessment_attempts(assessment_id,answer_message_id,request_id,attempt_number,
    selected_option_ids,answer_outcome,processing_state,authoritative_result,learning_event_id)
    VALUES(a.id,m.id,p_request_id,v_count,v_selected,v_outcome,v_state,v_result,(v_event->>'event_id')::uuid);
  RETURN v_result;
END $function$

;
CREATE OR REPLACE FUNCTION public.get_transfer_assessment_processing_context_v1(p_assessment_id uuid, p_message_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  m public.messages%ROWTYPE;
  i public.checklist_items%ROWTYPE;
  q public.messages%ROWTYPE;
  v_processed jsonb;
  v_result jsonb;
  v_mode text;
BEGIN
  SELECT * INTO a FROM private.transfer_assessments WHERE id = p_assessment_id;
  IF NOT FOUND OR a.student_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  SELECT * INTO m FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND OR m.user_id IS DISTINCT FROM p_actor_id OR m.room_id IS DISTINCT FROM a.room_id
    OR m.assessment_id IS DISTINCT FROM a.id OR m.parent_message_id IS DISTINCT FROM a.question_message_id THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF a.lifecycle = 'legacy_incomplete' THEN RAISE EXCEPTION 'LEGACY_ASSESSMENT_INCOMPLETE'; END IF;
  SELECT * INTO i FROM public.checklist_items WHERE id = a.item_id;
  SELECT * INTO q FROM public.messages WHERE id = a.question_message_id;
  SELECT active_response_mode::text INTO v_mode FROM public.rooms WHERE id = a.room_id;
  SELECT COALESCE(jsonb_agg(answer_message_id ORDER BY attempt_number),'[]'::jsonb) INTO v_processed
    FROM private.transfer_assessment_attempts WHERE assessment_id = a.id;
  SELECT authoritative_result INTO v_result FROM private.transfer_assessment_attempts WHERE answer_message_id = m.id;
  IF a.lifecycle = 'cancelled' AND v_result IS NULL THEN
    v_result := jsonb_build_object('message_id',m.id,'assessment_id',a.id,'processing_state','duplicate',
      'answer_outcome',NULL,'attempt_number',NULL,'attempts_used',a.attempt_count,'attempts_remaining',0,
      'selected_option_ids',NULL,'terminal',true,'transition',NULL,'feedback_required',false,
      'code',CASE WHEN a.terminal_answer_message_id = m.id THEN 'assisted' ELSE 'cancelled' END,
      'already_processed',true,'terminal_failure_feedback',NULL);
  END IF;
  RETURN jsonb_build_object('lifecycle',a.lifecycle,'context',jsonb_build_object(
      'progress',jsonb_build_object('status',i.status,'understanding_level',i.understanding_level),
      'participation_mode',v_mode,'progress_snapshot_hash',private.transfer_item_hash(i.id),
      'feedback_required',a.lifecycle IN ('passed','failed'),'eligible_assessment_item_ids',jsonb_build_array(i.id),
      'unresolved_assessment',CASE WHEN a.lifecycle = 'open' THEN private.transfer_public_message(q.id)->'assessment' ELSE NULL END,
      'pending_repair_message_id',NULL,'attempt_snapshot',jsonb_build_object('assessment_id',a.id,
        'accepted_attempt_count',a.attempt_count,'resolution',CASE WHEN a.lifecycle = 'cancelled' THEN 'open' ELSE a.lifecycle END,'processed_answer_message_ids',v_processed)),
    'assessment',jsonb_build_object('id',a.id,'item_id',a.item_id,'selection_type',a.selection_type,'options',q.assessment_options,
      'correct_option_ids',a.correct_option_ids,'learner_safe_explanation',a.learner_safe_explanation,'progress_snapshot_hash',a.progress_snapshot_hash),
    'answer',jsonb_build_object('content',m.content,'selected_option_ids',m.assessment_selected_option_ids,'references_message_id',m.parent_message_id),
    'authoritative_result',v_result);
END $function$

;
CREATE OR REPLACE FUNCTION private.transfer_public_message(p_message_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
  SELECT jsonb_build_object('id',m.id,'room_id',m.room_id,'user_id',m.user_id,'content',m.content,
    'user_role',m.user_role,'parent_message_id',m.parent_message_id,'response_mode',m.response_mode,
    'created_at',m.created_at,'assessment_lifecycle',m.assessment_lifecycle,'assessment',CASE WHEN a.id IS NULL THEN NULL ELSE
      jsonb_build_object('id',a.id,'student_id',a.student_id,'selection_type',a.selection_type,
        'stem',m.content,'options',m.assessment_options) END)
  FROM public.messages m LEFT JOIN private.transfer_assessments a ON a.question_message_id = m.id
  WHERE m.id = p_message_id
$function$

;

CREATE OR REPLACE FUNCTION public.get_transfer_assessment_review_v1(p_room_id uuid, p_assessment_id uuid, p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, private AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  q public.messages%ROWTYPE;
  v_label text;
  v_feedback boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id=p_room_id AND tutor_id=p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM private.transfer_assessments WHERE id=p_assessment_id AND room_id=p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF a.lifecycle='legacy_incomplete' THEN RAISE EXCEPTION 'LEGACY_ASSESSMENT_INCOMPLETE'; END IF;
  SELECT * INTO q FROM public.messages WHERE id=a.question_message_id AND room_id=p_room_id;
  SELECT area_text INTO v_label FROM public.checklist_items WHERE id=a.item_id;
  v_feedback := a.lifecycle IN ('passed','failed') AND NOT EXISTS (
    SELECT 1 FROM public.messages feedback
    WHERE feedback.room_id=p_room_id AND feedback.user_id=p_actor_id AND feedback.user_role='tutor'
      AND feedback.response_mode='tutoring' AND feedback.parent_message_id=a.terminal_answer_message_id
      AND feedback.created_at>a.closed_at
  );
  RETURN jsonb_build_object('item_label',v_label,
    'resolution',CASE WHEN a.lifecycle IN ('passed','failed') THEN a.lifecycle ELSE 'open' END,
    'lifecycle',CASE WHEN a.lifecycle='open' THEN 'delivered' ELSE a.lifecycle END,
    'attempt_count',a.attempt_count,'feedback_required',v_feedback,
    'assessment',jsonb_build_object('selection_type',a.selection_type,'stem',q.content,'rendered_text',q.content,
      'options',q.assessment_options,'correct_option_ids',a.correct_option_ids,
      'learner_safe_explanation',a.learner_safe_explanation,'transfer_basis',a.transfer_basis));
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_transfer_assessment_v1(
  p_assessment_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, private AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  m public.messages%ROWTYPE;
  v_duplicate boolean;
BEGIN
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  PERFORM 1 FROM public.rooms WHERE id=(SELECT room_id FROM private.transfer_assessments WHERE id=p_assessment_id) FOR UPDATE;
  SELECT * INTO a FROM private.transfer_assessments WHERE id=p_assessment_id FOR UPDATE;
  IF NOT FOUND OR a.student_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  SELECT * INTO m FROM public.messages WHERE id=p_message_id;
  IF NOT FOUND OR m.user_id IS DISTINCT FROM p_actor_id OR m.user_role <> 'student'
    OR m.room_id IS DISTINCT FROM a.room_id OR m.assessment_id IS DISTINCT FROM a.id
    OR m.parent_message_id IS DISTINCT FROM a.question_message_id OR m.assessment_selected_option_ids IS NOT NULL
    THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  v_duplicate := COALESCE(a.lifecycle='cancelled' AND a.terminal_answer_message_id=p_message_id, false);
  IF NOT v_duplicate AND a.lifecycle<>'open' THEN RETURN jsonb_build_object('code','CONCURRENT_MODIFICATION'); END IF;
  IF NOT v_duplicate THEN
    UPDATE private.transfer_assessments SET lifecycle='cancelled',terminal_answer_message_id=m.id,
      closed_at=now(),updated_at=now() WHERE id=a.id;
    UPDATE public.messages SET assessment_lifecycle='cancelled',assessment_closed_at=now()
      WHERE id=a.question_message_id;
  END IF;
  RETURN jsonb_build_object('message_id',m.id,'assessment_id',a.id,
    'processing_state',CASE WHEN v_duplicate THEN 'duplicate' ELSE 'applied' END,
    'answer_outcome',NULL,'attempt_number',NULL,'attempts_used',a.attempt_count,'attempts_remaining',0,
    'selected_option_ids',NULL,'terminal',true,'transition',NULL,'feedback_required',false,
    'code','assisted','already_processed',v_duplicate,'terminal_failure_feedback',NULL);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_transfer_assessment_review_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_transfer_assessment_review_v1(uuid,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_transfer_assessment_v1(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_transfer_assessment_v1(uuid,uuid,uuid,uuid) TO service_role;

COMMIT;

