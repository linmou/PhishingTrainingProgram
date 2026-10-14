--!/usr/bin/env psql
-- Purpose: assess only full understanding developed from Partial; retain deferred readiness and record terminal results from Covered.
-- Baseline: production/staging catalogs rechecked on 2026-10-14; fresh production snapshot validated locally.
-- Release: cancel incompatible old open questions while preserving attempts, completed results, and progress.
BEGIN;

-- The most recent effective progress row identifies the current learning cycle.
-- Notes and priority edits preserve readiness; changing the target invalidates its evidence.
ALTER TABLE public.checklist_updates ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE private.learning_event_inbox ALTER COLUMN created_at SET DEFAULT clock_timestamp();

CREATE OR REPLACE FUNCTION private.transfer_assessment_due_event(p_item_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $function$
  SELECT e.event_id
  FROM public.checklist_items ci
  JOIN LATERAL (
    SELECT u.* FROM public.checklist_updates u WHERE u.item_id = ci.id
      AND (u.previous_status IS DISTINCT FROM u.new_status
        OR u.previous_understanding IS DISTINCT FROM u.new_understanding
        OR u.assessment_id IS NOT NULL)
    ORDER BY u.created_at DESC, u.id DESC LIMIT 1
  ) latest ON true
  JOIN private.learning_event_inbox e ON e.event_id = latest.event_id
  WHERE ci.id = p_item_id AND NOT ci.deleted
    AND ci.status = 'covered' AND ci.understanding_level = 'good'
    AND latest.previous_status = 'partially_covered' AND latest.previous_understanding = 'basic'
    AND latest.new_status = 'covered' AND latest.new_understanding = 'good'
    AND e.event_kind = 'demonstrated_understanding' AND e.processing_state = 'applied'
    AND e.item_id = ci.id AND e.checklist_id = ci.checklist_id
    AND e.event_payload->>'target_area_text' = ci.area_text
$function$;
REVOKE ALL ON FUNCTION private.transfer_assessment_due_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.transfer_assessment_due_event(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_learning_event_v1(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
  v_assessment_setting text := COALESCE(current_setting('app.applying_transfer_assessment', true), '');
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
    NULLIF(p_event->>'source_message_id', '')::uuid, v_kind,
    p_event || jsonb_build_object('target_area_text', v_item.area_text),
    COALESCE(p_event->>'classified_by', 'trusted_backend'));
  IF v_room.active_response_mode = 'guard' THEN
    UPDATE private.learning_event_inbox SET processing_state = 'deferred_guard' WHERE event_id = v_event_id;
    RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'deferred_guard', 'error_code', 'PROGRESSION_LOCKED');
  END IF;
  v_old_status := v_item.status;
  v_old_level := v_item.understanding_level;
  v_next_status := v_old_status;
  v_next_level := v_old_level;
  IF v_kind IN ('assessment_pass', 'assessment_fail') AND
     (v_old_status <> 'covered' OR v_old_level <> 'good') THEN
    UPDATE private.learning_event_inbox SET processing_state = 'rejected',
      error_code = 'INVALID_TRANSITION', applied_at = clock_timestamp() WHERE event_id = v_event_id;
    RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'rejected', 'error_code', 'INVALID_TRANSITION');
  END IF;
  IF (v_kind = 'initial_signal' AND v_old_status = 'pending') OR
     (v_kind = 'post_repair_signal' AND v_old_status = 'needs_review') THEN
    v_next_status := 'partially_covered'; v_next_level := 'basic';
  ELSIF (v_kind = 'demonstrated_understanding' AND v_old_status IN ('pending', 'partially_covered')) OR
        (v_kind = 'spontaneous_transfer' AND v_old_status <> 'covered') OR v_kind = 'assessment_pass' THEN
    v_next_status := 'covered'; v_next_level := 'good';
  ELSIF (v_kind = 'contradiction' AND v_old_status IN ('partially_covered', 'covered')) OR v_kind = 'assessment_fail' THEN
    v_next_status := 'needs_review'; v_next_level := 'basic';
  END IF;
  IF v_next_status = v_old_status AND v_next_level = v_old_level AND v_kind <> 'assessment_pass' THEN
    UPDATE private.learning_event_inbox SET processing_state = 'no_change', applied_at = now() WHERE event_id = v_event_id;
    RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'no_change', 'status', v_old_status);
  END IF;
  PERFORM set_config('app.transfer_operation', 'on', true);
  INSERT INTO public.coverage_evidence(item_id, evidence_text, analysis, confidence_score, detection_method, message_id, event_id, assessment_id)
  VALUES (v_item.id, p_event->>'evidence_text', COALESCE(p_event->>'explanation', 'Learning event applied'), 100,
    CASE WHEN p_event->>'classified_by' = 'tutor' THEN 'tutor_manual' ELSE 'ai_analysis' END,
    NULLIF(p_event->>'source_message_id', '')::uuid, v_event_id, NULLIF(p_event->>'assessment_id', '')::uuid)
  RETURNING id INTO v_evidence_id;
  PERFORM set_config('app.applying_transfer_assessment', COALESCE(p_event->>'assessment_id', ''), true);
  UPDATE public.checklist_items SET status = v_next_status, understanding_level = v_next_level, last_addressed = now(), updated_at = now() WHERE id = v_item.id;
  PERFORM set_config('app.applying_transfer_assessment', v_assessment_setting, true);
  INSERT INTO public.checklist_updates(checklist_id, item_id, previous_status, new_status, previous_understanding, new_understanding, evidence_id, event_id, assessment_id, updated_by)
  VALUES (v_checklist.id, v_item.id, v_old_status, v_next_status, v_old_level, v_next_level, v_evidence_id, v_event_id,
    NULLIF(p_event->>'assessment_id', '')::uuid, CASE WHEN p_event->>'classified_by' = 'tutor' THEN 'tutor' ELSE 'ai' END)
  RETURNING id INTO v_update_id;
  UPDATE private.learning_event_inbox SET processing_state = 'applied', linked_update_id = v_update_id, linked_evidence_id = v_evidence_id, applied_at = now() WHERE event_id = v_event_id;
  RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'applied', 'status', v_next_status, 'understanding_level', v_next_level);
END;
$function$;

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
  IF jsonb_typeof(p_analysis->'events') IS DISTINCT FROM 'array' THEN
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
REVOKE ALL ON FUNCTION public.apply_transfer_message_analysis_v1(uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_transfer_message_analysis_v1(uuid,uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION private.cancel_changed_target_assessments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.understanding_level IS NOT DISTINCT FROM OLD.understanding_level
    AND NEW.area_text IS NOT DISTINCT FROM OLD.area_text
    AND NEW.deleted IS NOT DISTINCT FROM OLD.deleted THEN
    RETURN NEW;
  END IF;
  WITH cancelled AS (
    UPDATE private.transfer_assessments
    SET lifecycle = 'cancelled', closed_at = clock_timestamp(), updated_at = clock_timestamp()
    WHERE item_id = NEW.id AND lifecycle = 'open'
      AND id IS DISTINCT FROM NULLIF(current_setting('app.applying_transfer_assessment', true), '')::uuid
    RETURNING question_message_id, closed_at
  )
  UPDATE public.messages m SET assessment_lifecycle = 'cancelled', assessment_closed_at = c.closed_at
  FROM cancelled c WHERE m.id = c.question_message_id;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.cancel_changed_target_assessments() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER cancel_changed_target_assessments
AFTER UPDATE OF status, understanding_level, area_text, deleted ON public.checklist_items
FOR EACH ROW EXECUTE FUNCTION private.cancel_changed_target_assessments();

CREATE OR REPLACE FUNCTION private.transfer_item_hash(p_item_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public, private AS $function$
  SELECT md5(jsonb_build_object('id', ci.id, 'status', ci.status,
    'understanding_level', ci.understanding_level, 'attempts_count', ci.attempts_count,
    'area_text', ci.area_text, 'deleted', ci.deleted,
    'readiness_event', private.transfer_assessment_due_event(ci.id))::text)
  FROM public.checklist_items ci WHERE ci.id = p_item_id
$function$;

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
  v_blocked := v_room.active_response_mode = 'guard' OR v_open OR v_feedback;

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
$function$;

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
  IF NOT FOUND OR v_room.tutor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
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
    IF EXISTS (SELECT 1 FROM private.transfer_assessments WHERE room_id = p_room_id AND student_id = p_student_id AND lifecycle = 'open')
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
  UPDATE public.rooms SET active_response_mode = CASE WHEN v_mode = 'guard' THEN 'guard' ELSE 'tutoring' END::public.tutor_response_mode,
    mode_changed_at = now(),mode_change_source = 'reviewed_response' WHERE id = p_room_id RETURNING * INTO v_room;
  RETURN jsonb_build_object('message',private.transfer_public_message(v_message),'room',to_jsonb(v_room));
END $function$;

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
  IF NOT EXISTS (SELECT 1 FROM public.checklist_items ci
      WHERE ci.id = a.item_id AND NOT ci.deleted AND ci.status = 'covered' AND ci.understanding_level = 'good')
     OR private.transfer_item_hash(a.item_id) IS DISTINCT FROM a.progress_snapshot_hash THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.prepare_transfer_turn_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  r public.rooms%ROWTYPE;
  m public.messages%ROWTYPE;
  c public.session_checklists%ROWTYPE;
  v_items jsonb;
  v_eligible jsonb;
  v_open jsonb;
  v_feedback boolean;
  v_hash text;
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id = p_room_id;
  IF NOT FOUND OR r.tutor_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO m FROM public.messages WHERE id = p_focus_student_message_id AND room_id = p_room_id AND user_role = 'student';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT * INTO c FROM public.session_checklists WHERE id = p_checklist_id AND room_id = p_room_id AND student_id = m.user_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF c.progress_policy_version <> 'transfer_v1' THEN RAISE EXCEPTION 'LEGACY_CHECKLIST'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'area_text',i.area_text,'priority',i.priority,
    'status',i.status,'understanding_level',i.understanding_level,'relevant_evidence_message_ids',
      COALESCE((SELECT jsonb_agg(DISTINCT e.message_id) FROM public.coverage_evidence e WHERE e.item_id = i.id AND e.message_id IS NOT NULL),'[]'::jsonb),
    'repair_message_id',NULL) ORDER BY i.id),'[]'::jsonb) INTO v_items
    FROM public.checklist_items i WHERE i.checklist_id = c.id AND NOT i.deleted;
  SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]'::jsonb) INTO v_eligible FROM public.checklist_items
    WHERE checklist_id = c.id AND NOT deleted AND status = 'covered' AND understanding_level = 'good'
      AND private.transfer_assessment_due_event(id) IS NOT NULL;
  SELECT private.transfer_public_message(a.question_message_id)->'assessment' INTO v_open
    FROM private.transfer_assessments a WHERE a.checklist_id = c.id AND a.lifecycle = 'open' ORDER BY created_at DESC LIMIT 1;
  SELECT EXISTS(SELECT 1 FROM private.transfer_assessments a JOIN public.messages q ON q.id = a.question_message_id
    WHERE a.checklist_id = c.id AND a.lifecycle IN ('passed','failed') AND NOT EXISTS(
      SELECT 1 FROM public.messages t WHERE t.room_id = r.id AND t.user_role = 'tutor'
        AND t.created_at > a.closed_at)) INTO v_feedback;
  v_hash := md5(v_items::text);
  RETURN jsonb_build_object('room_id',r.id,'student_id',m.user_id,'checklist_id',c.id,
    'focus_student_message_id',m.id,'context',jsonb_build_object('room_id',r.id,'checklist_id',c.id,
      'focus_student_id',m.user_id,'focus_student_message',to_jsonb(m),'prior_participation_mode',r.active_response_mode,
      'checklist_items',v_items,'eligible_assessment_item_ids',v_eligible,'unresolved_assessment',v_open,
      'feedback_required',v_feedback,'progress_snapshot_hash',v_hash));
END $function$;

CREATE OR REPLACE FUNCTION private.replay_transfer_guard_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  e private.learning_event_inbox%ROWTYPE;
  v_result jsonb;
  v_setting text := COALESCE(current_setting('app.transfer_operation',true),'');
BEGIN
  IF OLD.active_response_mode <> 'guard' OR NEW.active_response_mode = 'guard' THEN RETURN NEW; END IF;
  FOR e IN SELECT * FROM private.learning_event_inbox WHERE room_id = NEW.id AND processing_state = 'deferred_guard'
    ORDER BY created_at,event_id FOR UPDATE LOOP
    IF e.event_kind = 'analysis_complete' THEN
      UPDATE private.learning_event_inbox SET processing_state = 'applied', applied_at = clock_timestamp()
      WHERE event_id = e.event_id;
      CONTINUE;
    END IF;
    IF e.event_kind NOT IN ('assessment_pass','assessment_fail') AND NOT EXISTS (
      SELECT 1 FROM public.checklist_items ci
      WHERE ci.id = e.item_id AND NOT ci.deleted
        AND ci.area_text = e.event_payload->>'target_area_text'
    ) THEN
      UPDATE private.learning_event_inbox SET processing_state = 'rejected',
        error_code = 'INVALID_TRANSITION', applied_at = NULL WHERE event_id = e.event_id;
      CONTINUE;
    END IF;
    IF e.event_kind IN ('assessment_pass','assessment_fail') AND NOT EXISTS (
      SELECT 1 FROM private.transfer_assessment_attempts t JOIN private.transfer_assessments a ON a.id = t.assessment_id
      WHERE t.learning_event_id = e.event_id AND a.id::text = e.event_payload->>'assessment_id'
        AND a.item_id = e.item_id AND a.student_id = e.student_id AND a.room_id = e.room_id
        AND a.terminal_answer_message_id = e.source_message_id
    ) THEN
      UPDATE private.learning_event_inbox SET processing_state = 'rejected',error_code = 'INVALID_SCOPE' WHERE event_id = e.event_id;
      UPDATE private.transfer_assessment_attempts SET processing_state = 'rejected' WHERE learning_event_id = e.event_id;
      CONTINUE;
    END IF;
    IF e.event_kind IN ('assessment_pass','assessment_fail') AND EXISTS (
      SELECT 1 FROM private.transfer_assessments a
      WHERE a.id::text = e.event_payload->>'assessment_id'
        AND a.progress_snapshot_hash IS DISTINCT FROM private.transfer_item_hash(e.item_id)
    ) THEN
      UPDATE private.learning_event_inbox SET processing_state = 'rejected', error_code = 'INVALID_TRANSITION', applied_at = NULL
      WHERE event_id = e.event_id;
      UPDATE private.transfer_assessment_attempts SET processing_state = 'rejected',
        authoritative_result = authoritative_result || jsonb_build_object(
          'processing_state', 'rejected', 'code', 'INVALID_TRANSITION', 'feedback_required', false,
          'answer_outcome', NULL, 'transition', NULL, 'terminal_failure_feedback', NULL)
      WHERE learning_event_id = e.event_id;
      UPDATE private.transfer_assessments SET lifecycle = 'cancelled', terminal_result = NULL,
        closed_at = clock_timestamp(), updated_at = clock_timestamp()
      WHERE id::text = e.event_payload->>'assessment_id';
      UPDATE public.messages SET assessment_lifecycle = 'cancelled', assessment_result = NULL,
        assessment_closed_at = clock_timestamp()
      WHERE id = (SELECT question_message_id FROM private.transfer_assessments
        WHERE id::text = e.event_payload->>'assessment_id');
      CONTINUE;
    END IF;
    -- Reapply the original immutable payload and event ID in this same transaction.
    DELETE FROM private.learning_event_inbox WHERE event_id = e.event_id;
    v_result := public.apply_learning_event_v1(e.event_payload);
    UPDATE private.transfer_assessment_attempts SET processing_state = CASE WHEN v_result->>'processing_state' = 'applied' THEN 'applied' ELSE 'rejected' END,
      authoritative_result = authoritative_result || jsonb_build_object('processing_state',
        CASE WHEN v_result->>'processing_state' = 'applied' THEN 'applied' ELSE 'rejected' END,'code',v_result->>'error_code')
      WHERE learning_event_id = e.event_id AND processing_state = 'deferred';
  END LOOP;
  PERFORM set_config('app.transfer_operation',v_setting,true);
  RETURN NEW;
END $function$;

-- Existing Partial-policy questions cannot be graded under the new readiness/hash contract.
-- Close only incompatible open lifecycles; preserve every question, answer, attempt and target state.
WITH cancelled AS (
  UPDATE private.transfer_assessments a
  SET lifecycle = 'cancelled', closed_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE a.lifecycle = 'open'
    AND (private.transfer_assessment_due_event(a.item_id) IS NULL
      OR a.progress_snapshot_hash IS DISTINCT FROM private.transfer_item_hash(a.item_id))
  RETURNING question_message_id, closed_at
)
UPDATE public.messages m
SET assessment_lifecycle = 'cancelled', assessment_closed_at = c.closed_at
FROM cancelled c WHERE m.id = c.question_message_id;

COMMIT;
