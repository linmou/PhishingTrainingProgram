-- Purpose: fix #110 (an assessment answer graded while Guard is on) and #112 (the room owner
-- taking their own room's learner seat).
--
-- #110: process_assessment_message_v2 re-reads rooms.guard_mode under the room lock. When Guard is
--   on it records the answer through the existing guard_deferred path
--   (record_transfer_assessment_processing_v1): no attempt is used and no result message is written.
--   The deferred row is ignored by the processing context once Guard is off, so catch-up/review
--   replay grades the answer later.
-- #112: join_room_v1 never seats the room owner (they join as observer), and a row trigger on
--   public.sessions refuses any insert or update that makes the room owner the active learner.
--   Existing rows are not rewritten: an already-active owner seat may still be updated or ended.
--
-- Preconditions: the three replaced functions must match the definitions inspected on staging
-- (ciubrzggdqesgvfkpolj) and production (zgbufaxooqxeabewktzd) on 2026-11-19; otherwise the
-- migration fails atomically. Owners, SECURITY DEFINER, search_path and grants are preserved.

DO $precondition$
DECLARE
  v_expected CONSTANT jsonb := jsonb_build_object(
    'public.process_assessment_message_v2(uuid,uuid,uuid,uuid,integer,text,text,text[],jsonb,text)', '82e8b7943f82ea53042d325ba23c6bff',
    'public.join_room_v1(uuid,uuid)', '81199a303e5e380486e20f8573511243',
    'public.record_transfer_assessment_processing_v1(uuid,uuid,uuid,uuid,integer,text,text)', '5b4dc2e2250d3169a5a4d4eaab65afba');
  v_key text;
  v_actual text;
BEGIN
  FOR v_key IN SELECT jsonb_object_keys(v_expected) LOOP
    SELECT md5(pg_get_functiondef(to_regprocedure(v_key))) INTO v_actual;
    IF v_actual IS DISTINCT FROM v_expected->>v_key THEN
      RAISE EXCEPTION 'BASELINE_DRIFT: % has definition hash %, expected %', v_key, v_actual, v_expected->>v_key;
    END IF;
  END LOOP;
  IF to_regprocedure('private.prevent_owner_learner_seat()') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.sessions'::regclass AND tgname = 'prevent_owner_learner_seat') THEN
    RAISE EXCEPTION 'BASELINE_DRIFT: owner-seat guard already exists';
  END IF;
END;
$precondition$;

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
  v_guard_mode boolean;
BEGIN
  -- Guard may have been turned on after the caller read the processing context; read it under the room lock.
  SELECT guard_mode INTO v_guard_mode FROM public.rooms
    WHERE id=(SELECT room_id FROM private.transfer_assessments WHERE id=p_assessment_id) FOR UPDATE;
  SELECT * INTO a FROM private.transfer_assessments WHERE id=p_assessment_id FOR UPDATE;
  IF NOT FOUND OR a.student_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  SELECT * INTO m FROM public.messages WHERE id=p_message_id;
  IF NOT FOUND OR m.user_id IS DISTINCT FROM p_actor_id OR m.user_role<>'student' OR m.room_id IS DISTINCT FROM a.room_id
    OR m.assessment_id IS DISTINCT FROM a.id OR m.parent_message_id IS DISTINCT FROM a.question_message_id THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT authoritative_result INTO v_result FROM private.transfer_assessment_attempts WHERE answer_message_id=p_message_id;
  IF FOUND THEN
    RETURN v_result || jsonb_build_object('processing_state','duplicate','already_processed',true,
      'result_message',private.write_assessment_result_message(p_message_id));
  END IF;
  IF a.lifecycle IS DISTINCT FROM p_expected_resolution OR a.attempt_count IS DISTINCT FROM p_expected_attempt_count THEN
    RETURN jsonb_build_object('code','CONCURRENT_MODIFICATION'); END IF;
  IF a.lifecycle<>'open' THEN RAISE EXCEPTION 'ASSESSMENT_TERMINAL'; END IF;
  IF v_guard_mode IS TRUE THEN
    -- Same held state as the edge's guard_deferred path: no attempt, no result message, replayed after Guard.
    RETURN public.record_transfer_assessment_processing_v1(p_assessment_id,p_message_id,p_actor_id,p_request_id,
      p_expected_attempt_count,p_expected_resolution,'guard_deferred');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.checklist_items ci
      WHERE ci.id=a.item_id AND NOT ci.deleted AND ci.status='covered' AND ci.understanding_level='good')
    OR private.transfer_item_hash(a.item_id) IS DISTINCT FROM a.progress_snapshot_hash THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_selected FROM unnest(COALESCE(m.assessment_selected_option_ids,p_selected_option_ids)) x;
  IF v_selected IS NULL OR NOT v_selected <@ ARRAY['A','B','C','D']
    OR (a.selection_type='single' AND cardinality(v_selected)<>1)
    OR v_selected IS DISTINCT FROM p_selected_option_ids THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  v_count := a.attempt_count+1;
  v_outcome := CASE WHEN v_selected=a.correct_option_ids THEN 'passed' WHEN v_count=1 THEN 'retry' ELSE 'failed' END;
  IF p_answer_outcome IS DISTINCT FROM v_outcome OR p_applied_transition IS DISTINCT FROM
    (CASE WHEN v_outcome='passed' THEN 'assessment_pass' WHEN v_outcome='failed' THEN 'assessment_fail' END)
    THEN RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION'; END IF;
  v_terminal := v_outcome<>'retry';
  IF v_terminal THEN
    IF p_next_progress->>'status' IS DISTINCT FROM (CASE WHEN v_outcome='passed' THEN 'covered' ELSE 'needs_review' END)
      OR p_next_progress->>'understanding_level' IS DISTINCT FROM (CASE WHEN v_outcome='passed' THEN 'good' ELSE 'basic' END)
      THEN RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION'; END IF;
    v_event := jsonb_build_object('event_id',gen_random_uuid(),'dedupe_key','assessment:'||a.id::text,
      'kind',p_applied_transition,'room_id',a.room_id,'student_id',a.student_id,'item_id',a.item_id,'assessment_id',a.id,
      'source_message_id',m.id,'source_evidence_message_ids',jsonb_build_array(m.id),'evidence_text',m.content,'classified_by','trusted_backend');
    v_transition := public.apply_learning_event_v1(v_event);
    IF v_transition->>'processing_state'='rejected' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
    IF v_transition->>'processing_state'='deferred_guard' THEN v_state := 'deferred'; END IF;
    UPDATE private.transfer_assessments SET lifecycle=v_outcome,terminal_result=v_outcome,
      terminal_answer_message_id=m.id,closed_at=now() WHERE id=a.id;
    UPDATE public.messages SET assessment_lifecycle=v_outcome,assessment_answer_message_id=m.id,
      assessment_result=CASE WHEN v_outcome='passed' THEN 'pass' ELSE 'fail' END,assessment_closed_at=now()
      WHERE id=a.question_message_id;
  END IF;
  UPDATE private.transfer_assessments SET attempt_count=v_count,updated_at=now() WHERE id=a.id;
  v_result := jsonb_build_object('message_id',m.id,'assessment_id',a.id,'processing_state',v_state,
    'answer_outcome',v_outcome,'attempt_number',v_count,'attempts_used',v_count,
    'attempts_remaining',CASE WHEN v_terminal THEN 0 ELSE 2-v_count END,'selected_option_ids',v_selected,
    'terminal',v_terminal,'transition',p_applied_transition,'feedback_required',v_terminal,
    'already_processed',false,'code',CASE WHEN v_state='deferred' THEN 'PROGRESSION_LOCKED' END,
    'terminal_failure_feedback',CASE WHEN v_outcome='failed' THEN jsonb_build_object(
      'correct_option_ids',a.correct_option_ids,'learner_safe_explanation',a.learner_safe_explanation) END);
  INSERT INTO private.transfer_assessment_attempts(assessment_id,answer_message_id,request_id,attempt_number,
    selected_option_ids,answer_outcome,processing_state,authoritative_result,learning_event_id)
  VALUES(a.id,m.id,p_request_id,v_count,v_selected,v_outcome,v_state,v_result,(v_event->>'event_id')::uuid);
  v_result := v_result || jsonb_build_object('result_message',private.write_assessment_result_message(m.id));
  UPDATE private.transfer_assessment_attempts SET authoritative_result=v_result WHERE answer_message_id=m.id;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_room_v1(p_room_id uuid, p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_learner uuid;
  v_role text;
  v_status text;
  v_owner boolean;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id AND is_active FOR UPDATE;
  IF NOT FOUND OR p_student_id IS NULL THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT u.current_role::text, u.status::text INTO v_role, v_status
  FROM public.users AS u
  WHERE u.id = p_student_id;
  IF v_role <> 'student' OR v_status <> 'active' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  -- The owner is never the room's learner, whatever role their profile shows.
  v_owner := p_student_id = v_room.tutor_id;
  SELECT student_id INTO v_learner FROM public.sessions
  WHERE room_id = p_room_id AND status = 'active' AND student_id IS NOT NULL
  ORDER BY started_at, id LIMIT 1;
  IF v_learner IS NULL AND NOT v_owner THEN
    INSERT INTO public.sessions(room_id, tutor_id, student_id, status)
    VALUES (p_room_id, v_room.tutor_id, p_student_id, 'active')
    ON CONFLICT DO NOTHING;
    SELECT student_id INTO v_learner FROM public.sessions
    WHERE room_id = p_room_id AND status = 'active' AND student_id IS NOT NULL
    ORDER BY started_at, id LIMIT 1;
  END IF;
  IF v_learner = p_student_id AND NOT v_owner AND v_room.practice_type='cyberbullying' THEN
    PERFORM public.initialize_cyberbullying_progress_v1(p_room_id,p_student_id);
  END IF;
  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'learner_id', v_learner,
    'room_role', CASE WHEN v_learner = p_student_id AND NOT v_owner THEN 'student' ELSE 'observer' END
  );
END;
$function$;

-- Table-level guarantee for every write path (including the StudentView legacy insert): a write may
-- not make the room owner the active learner. Rows that already hold that state are left as they are
-- and may still be updated or ended; only a transition into the owner-as-learner state is refused.
CREATE FUNCTION private.prevent_owner_learner_seat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.status = 'active' AND NEW.student_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.student_id IS DISTINCT FROM NEW.student_id OR OLD.room_id IS DISTINCT FROM NEW.room_id)
    AND EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = NEW.room_id AND r.tutor_id = NEW.student_id) THEN
    RAISE EXCEPTION 'OWNER_CANNOT_BE_LEARNER' USING ERRCODE = '23514',
      DETAIL = 'The room owner cannot take the room''s learner seat.';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION private.prevent_owner_learner_seat() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.prevent_owner_learner_seat() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER prevent_owner_learner_seat
  BEFORE INSERT OR UPDATE OF room_id, student_id, status ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION private.prevent_owner_learner_seat();
