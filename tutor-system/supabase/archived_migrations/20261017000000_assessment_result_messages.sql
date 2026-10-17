--!/usr/bin/env psql
-- Purpose: publish deterministic assessment outcomes in dialogue while preserving private grading and human feedback gates.
BEGIN;

-- Non-consuming outcomes are processing authority, separate from accepted grading attempts.
CREATE TABLE IF NOT EXISTS private.transfer_assessment_processing (
  answer_message_id uuid PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES private.transfer_assessments(id) ON DELETE CASCADE,
  code text NOT NULL,
  authoritative_result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.transfer_assessment_processing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.transfer_assessment_processing FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE private.transfer_assessment_processing TO service_role;

CREATE OR REPLACE FUNCTION public.record_transfer_assessment_processing_v1(
  p_assessment_id uuid,p_message_id uuid,p_actor_id uuid,p_request_id uuid,
  p_expected_attempt_count integer,p_expected_resolution text,p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  m public.messages%ROWTYPE;
  v_result jsonb;
  v_mode text;
BEGIN
  IF p_request_id IS NULL OR p_code NOT IN ('AMBIGUOUS_SELECTION','SELECTION_NOT_RECOGNIZED',
    'SINGLE_SELECTION_CARDINALITY','guard_deferred','stale','unresolved','duplicate','not_delivered') THEN
    RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  SELECT active_response_mode::text INTO v_mode FROM public.rooms
    WHERE id=(SELECT room_id FROM private.transfer_assessments WHERE id=p_assessment_id) FOR UPDATE;
  SELECT * INTO a FROM private.transfer_assessments WHERE id=p_assessment_id FOR UPDATE;
  IF NOT FOUND OR a.student_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  SELECT * INTO m FROM public.messages WHERE id=p_message_id;
  IF NOT FOUND OR m.room_id IS DISTINCT FROM a.room_id OR m.user_id IS DISTINCT FROM a.student_id
    OR m.user_role<>'student' OR m.assessment_id IS DISTINCT FROM a.id
    OR m.parent_message_id IS DISTINCT FROM a.question_message_id THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF EXISTS(SELECT 1 FROM private.transfer_assessment_attempts WHERE answer_message_id=m.id) THEN
    RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION'; END IF;
  IF a.lifecycle IS DISTINCT FROM p_expected_resolution OR a.attempt_count IS DISTINCT FROM p_expected_attempt_count
    OR (p_code='guard_deferred' AND v_mode<>'guard') THEN RETURN jsonb_build_object('code','CONCURRENT_MODIFICATION'); END IF;
  v_result:=jsonb_build_object('message_id',m.id,'assessment_id',a.id,
    'processing_state',CASE WHEN p_code='guard_deferred' THEN 'deferred' ELSE 'rejected' END,
    'answer_outcome',NULL,'attempt_number',NULL,'attempts_used',a.attempt_count,
    'attempts_remaining',CASE WHEN a.lifecycle='open' THEN 2-a.attempt_count ELSE 0 END,
    'selected_option_ids',NULL,'terminal',a.lifecycle<>'open','transition',NULL,'feedback_required',false,
    'code',p_code,'already_processed',false,'terminal_failure_feedback',NULL,'result_message',NULL);
  INSERT INTO private.transfer_assessment_processing(answer_message_id,assessment_id,code,authoritative_result)
  VALUES(m.id,a.id,p_code,v_result)
  ON CONFLICT(answer_message_id) DO UPDATE SET code=EXCLUDED.code,authoritative_result=EXCLUDED.authoritative_result
    WHERE transfer_assessment_processing.code='guard_deferred' AND EXCLUDED.code<>'guard_deferred';
  SELECT authoritative_result INTO v_result FROM private.transfer_assessment_processing WHERE answer_message_id=m.id;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.record_transfer_assessment_processing_v1(uuid,uuid,uuid,uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_transfer_assessment_processing_v1(uuid,uuid,uuid,uuid,integer,text,text) TO service_role;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS assessment_event jsonb;
COMMENT ON COLUMN public.messages.assessment_event IS
  'Immutable trusted-backend result/closure provenance. Correct answers and reviewed explanations are published only in terminal-failure content.';
CREATE UNIQUE INDEX IF NOT EXISTS messages_assessment_event_key_unique
  ON public.messages ((assessment_event->>'event_key')) WHERE assessment_event IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS messages_assessment_result_answer_unique
  ON public.messages ((assessment_event->>'answer_message_id'))
  WHERE assessment_event->>'kind' = 'result';
CREATE UNIQUE INDEX IF NOT EXISTS messages_assessment_closure_question_unique
  ON public.messages ((assessment_event->>'question_message_id'))
  WHERE assessment_event->>'kind' = 'closure';

CREATE OR REPLACE FUNCTION private.protect_assessment_event_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, private AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assessment_event IS NOT NULL AND current_user <> 'postgres' THEN
      RAISE EXCEPTION 'ASSESSMENT_EVENT_BACKEND_ONLY' USING ERRCODE = '42501'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.assessment_event IS DISTINCT FROM OLD.assessment_event
      OR (OLD.assessment_event IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
      RAISE EXCEPTION 'IMMUTABLE_ASSESSMENT_EVENT' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  -- Permit source/room cascades; a legacy message-delete RPC cannot erase a live result.
  IF OLD.assessment_event IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.rooms WHERE id = OLD.room_id)
      AND EXISTS (SELECT 1 FROM private.transfer_assessments WHERE id::text = OLD.assessment_event->>'assessment_id') THEN
      RAISE EXCEPTION 'IMMUTABLE_ASSESSMENT_EVENT' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION private.protect_assessment_event_message() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER protect_assessment_event_message
BEFORE INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.protect_assessment_event_message();

CREATE OR REPLACE FUNCTION private.transfer_public_message(p_message_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, private AS $function$
  SELECT jsonb_build_object('id',m.id,'room_id',m.room_id,'user_id',m.user_id,'content',m.content,
    'user_role',m.user_role,'parent_message_id',m.parent_message_id,'response_mode',m.response_mode,
    'created_at',m.created_at,'assessment_lifecycle',m.assessment_lifecycle,
    'assessment_event',m.assessment_event,'assessment_id',m.assessment_id,
    'assessment_selected_option_ids',m.assessment_selected_option_ids,
    'assessment',CASE WHEN a.id IS NULL THEN NULL ELSE
      jsonb_build_object('id',a.id,'student_id',a.student_id,'selection_type',a.selection_type,
        'stem',m.content,'options',m.assessment_options) END)
  FROM public.messages m LEFT JOIN private.transfer_assessments a ON a.question_message_id = m.id
  WHERE m.id = p_message_id
$function$;

-- The writer accepts identifiers only. All published facts come from committed private authority.
CREATE OR REPLACE FUNCTION private.write_assessment_result_message(p_answer_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
DECLARE
  t private.transfer_assessment_attempts%ROWTYPE;
  a private.transfer_assessments%ROWTYPE;
  q public.messages%ROWTYPE;
  answer public.messages%ROWTYPE;
  v_id uuid;
  v_content text;
  v_event jsonb;
BEGIN
  SELECT * INTO t FROM private.transfer_assessment_attempts WHERE answer_message_id = p_answer_message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSESSMENT_RESULT_UNAVAILABLE'; END IF;
  SELECT * INTO a FROM private.transfer_assessments WHERE id = t.assessment_id;
  SELECT * INTO q FROM public.messages WHERE id = a.question_message_id;
  SELECT * INTO answer FROM public.messages WHERE id = t.answer_message_id;
  IF a.id IS NULL OR q.id IS NULL OR answer.id IS NULL
    OR answer.room_id IS DISTINCT FROM a.room_id OR answer.user_id IS DISTINCT FROM a.student_id
    OR answer.parent_message_id IS DISTINCT FROM q.id OR answer.assessment_id IS DISTINCT FROM a.id
    OR t.attempt_number NOT IN (1,2) OR t.answer_outcome NOT IN ('retry','passed','failed')
    OR (t.answer_outcome = 'retry' AND t.attempt_number <> 1)
    OR (t.answer_outcome = 'failed' AND t.attempt_number <> 2)
    OR t.processing_state NOT IN ('applied','deferred','rejected')
    OR t.authoritative_result->>'attempt_number' IS DISTINCT FROM t.attempt_number::text
  THEN RAISE EXCEPTION 'ASSESSMENT_RESULT_UNAVAILABLE'; END IF;
  SELECT id INTO v_id FROM public.messages
    WHERE assessment_event->>'event_key' = 'assessment-result:' || t.answer_message_id::text;
  IF FOUND THEN RETURN private.transfer_public_message(v_id); END IF;
  IF t.answer_outcome = 'failed' AND (
    a.correct_option_ids IS NULL OR btrim(COALESCE(a.learner_safe_explanation,'')) = ''
  ) THEN RAISE EXCEPTION 'ASSESSMENT_RESULT_UNAVAILABLE'; END IF;
  v_content := CASE t.answer_outcome
    WHEN 'passed' THEN 'Correct.'
    WHEN 'retry' THEN 'Incorrect. One attempt remaining.'
    ELSE 'Incorrect. No attempts remaining. Correct option(s): ' || array_to_string(a.correct_option_ids, ', ')
      || E'.\n' || a.learner_safe_explanation END;
  v_event := jsonb_build_object('event_key','assessment-result:' || t.answer_message_id::text,
    'kind','result','assessment_id',a.id,'question_message_id',q.id,'student_id',a.student_id,
    'answer_message_id',answer.id,'attempt_number',t.attempt_number,'outcome',t.answer_outcome,
    'attempts_used',t.attempt_number,'attempts_remaining',CASE WHEN t.answer_outcome='retry' THEN 1 ELSE 0 END,
    'terminal',t.answer_outcome<>'retry','lifecycle',CASE WHEN t.answer_outcome='retry' THEN 'open' ELSE t.answer_outcome END,
    'progress_deferred',t.processing_state='deferred','closure_reason',NULL);
  INSERT INTO public.messages(room_id,user_id,user_role,content,parent_message_id,response_mode,created_at,assessment_event)
  VALUES(a.room_id,q.user_id,'tutor',v_content,answer.id,NULL,t.created_at,v_event)
  ON CONFLICT ((assessment_event->>'event_key')) WHERE assessment_event IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO STRICT v_id FROM public.messages WHERE assessment_event->>'event_key' = v_event->>'event_key';
  END IF;
  RETURN private.transfer_public_message(v_id);
END;
$function$;
REVOKE ALL ON FUNCTION private.write_assessment_result_message(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.write_assessment_closure_message(p_assessment_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  q public.messages%ROWTYPE;
  v_id uuid;
  v_event jsonb;
BEGIN
  SELECT * INTO a FROM private.transfer_assessments WHERE id=p_assessment_id;
  SELECT * INTO q FROM public.messages WHERE id=a.question_message_id;
  IF a.id IS NULL OR q.id IS NULL OR a.lifecycle <> 'cancelled' OR a.closed_at IS NULL
    OR p_reason NOT IN ('assisted','target_changed','progress_invalidated','cancelled')
    THEN RAISE EXCEPTION 'ASSESSMENT_RESULT_UNAVAILABLE'; END IF;
  SELECT id INTO v_id FROM public.messages
    WHERE assessment_event->>'event_key'='assessment-closure:' || q.id::text;
  IF FOUND THEN RETURN private.transfer_public_message(v_id); END IF;
  v_event := jsonb_build_object('event_key','assessment-closure:' || q.id::text,
    'kind','closure','assessment_id',a.id,'question_message_id',q.id,'student_id',a.student_id,
    'answer_message_id',a.terminal_answer_message_id,'attempt_number',NULL,'outcome',NULL,
    'attempts_used',a.attempt_count,'attempts_remaining',0,'terminal',true,'lifecycle','cancelled',
    'progress_deferred',false,'closure_reason',p_reason);
  INSERT INTO public.messages(room_id,user_id,user_role,content,parent_message_id,response_mode,created_at,assessment_event)
  VALUES(a.room_id,q.user_id,'tutor',CASE p_reason
    WHEN 'assisted' THEN 'Assessment cancelled because assistance was requested. No additional attempt was used.'
    WHEN 'target_changed' THEN 'Assessment cancelled because the learning target changed.'
    WHEN 'progress_invalidated' THEN 'Assessment cancelled because the learning target changed while progress was deferred. The recorded answer result is preserved.'
    ELSE 'Assessment cancelled. This assessment is closed.' END,
    COALESCE(a.terminal_answer_message_id,q.id),NULL,a.closed_at,v_event)
  ON CONFLICT ((assessment_event->>'event_key')) WHERE assessment_event IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO STRICT v_id FROM public.messages WHERE assessment_event->>'event_key'=v_event->>'event_key';
  END IF;
  RETURN private.transfer_public_message(v_id);
END;
$function$;
REVOKE ALL ON FUNCTION private.write_assessment_closure_message(uuid,text) FROM PUBLIC, anon, authenticated, service_role;

-- Catch every trusted cancellation, including checklist edits and invalidated Guard replay.
CREATE OR REPLACE FUNCTION private.publish_assessment_cancellation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
BEGIN
  IF NEW.lifecycle='cancelled' AND OLD.lifecycle IS DISTINCT FROM NEW.lifecycle THEN
    PERFORM private.write_assessment_closure_message(NEW.id,CASE
      WHEN OLD.lifecycle IN ('passed','failed') THEN 'progress_invalidated'
      WHEN NEW.terminal_answer_message_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM private.transfer_assessment_attempts WHERE answer_message_id=NEW.terminal_answer_message_id
      ) THEN 'assisted' ELSE 'target_changed' END);
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.publish_assessment_cancellation() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER publish_assessment_cancellation
AFTER UPDATE OF lifecycle ON private.transfer_assessments
FOR EACH ROW EXECUTE FUNCTION private.publish_assessment_cancellation();

CREATE OR REPLACE FUNCTION public.process_assessment_message_v2(p_assessment_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_expected_attempt_count integer, p_expected_resolution text, p_answer_outcome text, p_selected_option_ids text[], p_next_progress jsonb, p_applied_transition text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
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
  PERFORM 1 FROM public.rooms WHERE id=(SELECT room_id FROM private.transfer_assessments WHERE id=p_assessment_id) FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.cancel_transfer_assessment_v1(p_assessment_id uuid,p_message_id uuid,p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
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
  IF NOT FOUND OR m.user_id IS DISTINCT FROM p_actor_id OR m.user_role<>'student'
    OR m.room_id IS DISTINCT FROM a.room_id OR m.assessment_id IS DISTINCT FROM a.id
    OR m.parent_message_id IS DISTINCT FROM a.question_message_id OR m.assessment_selected_option_ids IS NOT NULL
    THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  v_duplicate := COALESCE(a.lifecycle='cancelled' AND a.terminal_answer_message_id=p_message_id,false);
  IF NOT v_duplicate AND a.lifecycle<>'open' THEN RETURN jsonb_build_object('code','CONCURRENT_MODIFICATION'); END IF;
  IF NOT v_duplicate THEN
    UPDATE private.transfer_assessments SET lifecycle='cancelled',terminal_answer_message_id=m.id,
      closed_at=now(),updated_at=now() WHERE id=a.id;
    UPDATE public.messages SET assessment_lifecycle='cancelled',assessment_closed_at=now() WHERE id=a.question_message_id;
  END IF;
  RETURN jsonb_build_object('message_id',m.id,'assessment_id',a.id,
    'processing_state',CASE WHEN v_duplicate THEN 'duplicate' ELSE 'applied' END,
    'answer_outcome',NULL,'attempt_number',NULL,'attempts_used',a.attempt_count,'attempts_remaining',0,
    'selected_option_ids',NULL,'terminal',true,'transition',NULL,'feedback_required',false,
    'code','assisted','already_processed',v_duplicate,'terminal_failure_feedback',NULL,
    'result_message',private.write_assessment_closure_message(a.id,'assisted'));
END;
$function$;

-- Preserve existing processing payloads while attaching authoritative saved result/closure rows on replay.
CREATE OR REPLACE FUNCTION public.get_transfer_assessment_processing_context_v1(p_assessment_id uuid,p_message_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  m public.messages%ROWTYPE;
  i public.checklist_items%ROWTYPE;
  q public.messages%ROWTYPE;
  v_processed jsonb;
  v_result jsonb;
  v_saved jsonb;
  v_accepted boolean;
  v_mode text;
BEGIN
  SELECT * INTO a FROM private.transfer_assessments WHERE id=p_assessment_id;
  IF NOT FOUND OR a.student_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  SELECT * INTO m FROM public.messages WHERE id=p_message_id;
  IF NOT FOUND OR m.user_id IS DISTINCT FROM p_actor_id OR m.room_id IS DISTINCT FROM a.room_id
    OR m.assessment_id IS DISTINCT FROM a.id OR m.parent_message_id IS DISTINCT FROM a.question_message_id THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF a.lifecycle='legacy_incomplete' THEN RAISE EXCEPTION 'LEGACY_ASSESSMENT_INCOMPLETE'; END IF;
  SELECT * INTO i FROM public.checklist_items WHERE id=a.item_id;
  SELECT * INTO q FROM public.messages WHERE id=a.question_message_id;
  SELECT active_response_mode::text INTO v_mode FROM public.rooms WHERE id=a.room_id;
  SELECT COALESCE(jsonb_agg(answer_message_id ORDER BY attempt_number),'[]'::jsonb) INTO v_processed
    FROM private.transfer_assessment_attempts WHERE assessment_id=a.id;
  SELECT authoritative_result INTO v_result FROM private.transfer_assessment_attempts WHERE answer_message_id=m.id;
  v_accepted:=FOUND;
  IF NOT v_accepted THEN
    SELECT authoritative_result INTO v_result FROM private.transfer_assessment_processing
      WHERE answer_message_id=m.id AND (code<>'guard_deferred' OR v_mode='guard');
  END IF;
  IF v_accepted THEN
    SELECT private.transfer_public_message(id) INTO v_saved FROM public.messages
      WHERE assessment_event->>'kind'='result' AND assessment_event->>'answer_message_id'=m.id::text;
    IF v_saved IS NULL THEN RAISE EXCEPTION 'ASSESSMENT_RESULT_UNAVAILABLE'; END IF;
    v_result := v_result || jsonb_build_object('result_message',v_saved);
  ELSIF a.lifecycle='cancelled' AND v_result IS NULL THEN
    SELECT private.transfer_public_message(id) INTO v_saved FROM public.messages
      WHERE assessment_event->>'kind'='closure' AND assessment_event->>'assessment_id'=a.id::text;
    IF v_saved IS NULL THEN RAISE EXCEPTION 'ASSESSMENT_RESULT_UNAVAILABLE'; END IF;
    v_result := jsonb_build_object('message_id',m.id,'assessment_id',a.id,'processing_state','duplicate',
      'answer_outcome',NULL,'attempt_number',NULL,'attempts_used',a.attempt_count,'attempts_remaining',0,
      'selected_option_ids',NULL,'terminal',true,'transition',NULL,'feedback_required',false,
      'code',CASE WHEN a.terminal_answer_message_id=m.id THEN 'assisted' ELSE 'cancelled' END,
      'already_processed',true,'terminal_failure_feedback',NULL,'result_message',v_saved);
  END IF;
  RETURN jsonb_build_object('lifecycle',a.lifecycle,'context',jsonb_build_object(
      'progress',jsonb_build_object('status',i.status,'understanding_level',i.understanding_level),
      'participation_mode',v_mode,'progress_snapshot_hash',private.transfer_item_hash(i.id),
      'feedback_required',a.lifecycle IN ('passed','failed'),'eligible_assessment_item_ids',jsonb_build_array(i.id),
      'unresolved_assessment',CASE WHEN a.lifecycle='open' THEN private.transfer_public_message(q.id)->'assessment' ELSE NULL END,
      'pending_repair_message_id',NULL,'attempt_snapshot',jsonb_build_object('assessment_id',a.id,
        'accepted_attempt_count',a.attempt_count,'resolution',CASE WHEN a.lifecycle='cancelled' THEN 'open' ELSE a.lifecycle END,
        'processed_answer_message_ids',v_processed)),
    'assessment',jsonb_build_object('id',a.id,'item_id',a.item_id,'selection_type',a.selection_type,'options',q.assessment_options,
      'correct_option_ids',a.correct_option_ids,'learner_safe_explanation',a.learner_safe_explanation,'progress_snapshot_hash',a.progress_snapshot_hash),
    'answer',jsonb_build_object('content',m.content,'selected_option_ids',m.assessment_selected_option_ids,'references_message_id',m.parent_message_id),
    'authoritative_result',v_result);
END;
$function$;

CREATE OR REPLACE FUNCTION private.assessment_history_readiness(p_room_id uuid,p_student_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $function$
  WITH relevant AS (
    SELECT m.id answer_id,m.created_at answer_created_at,a.id assessment_id,a.lifecycle,t.answer_message_id accepted_id,
      result.id result_id,closure.id closure_id,handled.answer_message_id handled_id
    FROM public.messages m
    LEFT JOIN private.transfer_assessments a ON a.id=m.assessment_id AND a.room_id=m.room_id AND a.student_id=m.user_id
    LEFT JOIN private.transfer_assessment_attempts t ON t.answer_message_id=m.id
    LEFT JOIN private.transfer_assessment_processing handled ON handled.answer_message_id=m.id
      AND (handled.code<>'guard_deferred' OR EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=p_room_id AND r.active_response_mode='guard'))
    LEFT JOIN public.messages result ON result.assessment_event->>'kind'='result'
      AND result.assessment_event->>'answer_message_id'=m.id::text
    LEFT JOIN public.messages closure ON closure.assessment_event->>'kind'='closure'
      AND closure.assessment_event->>'assessment_id'=a.id::text
    WHERE m.room_id=p_room_id AND m.user_id=p_student_id AND m.user_role='student' AND m.assessment_id IS NOT NULL
  ), missing AS (
    SELECT * FROM relevant WHERE assessment_id IS NULL OR lifecycle='legacy_incomplete'
      OR (accepted_id IS NOT NULL AND result_id IS NULL)
      OR (accepted_id IS NULL AND handled_id IS NULL AND (lifecycle<>'cancelled' OR closure_id IS NULL))
  ), missing_assessments AS (
    SELECT a.id FROM private.transfer_assessments a
    WHERE a.room_id=p_room_id AND a.student_id=p_student_id AND (
      a.lifecycle='legacy_incomplete'
      OR a.attempt_count<>(SELECT count(*) FROM private.transfer_assessment_attempts t WHERE t.assessment_id=a.id)
      OR (a.lifecycle='cancelled' AND NOT EXISTS (SELECT 1 FROM public.messages m
        WHERE m.assessment_event->>'kind'='closure' AND m.assessment_event->>'assessment_id'=a.id::text))
    )
  ), required_results AS (
    SELECT m.id FROM public.messages m WHERE m.room_id=p_room_id
      AND m.assessment_event->>'student_id'=p_student_id::text
  )
  SELECT jsonb_build_object('ready',NOT EXISTS(SELECT 1 FROM missing) AND NOT EXISTS(SELECT 1 FROM missing_assessments),
    'result_message_ids',COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM required_results),'[]'::jsonb),
    'pending_answer_message_ids',COALESCE((SELECT jsonb_agg(answer_id ORDER BY answer_id) FROM missing),'[]'::jsonb),
    'pending_answers',COALESCE((SELECT jsonb_agg(jsonb_build_object('message_id',answer_id,'assessment_id',assessment_id) ORDER BY answer_created_at,answer_id) FROM missing),'[]'::jsonb),
    'handled_answer_message_ids',COALESCE((SELECT jsonb_agg(answer_id ORDER BY answer_id) FROM relevant WHERE handled_id IS NOT NULL AND accepted_id IS NULL),'[]'::jsonb),
    'unavailable_assessment_ids',COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM missing_assessments),'[]'::jsonb))
$function$;
REVOKE ALL ON FUNCTION private.assessment_history_readiness(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_transfer_assessment_review_v1(p_room_id uuid,p_assessment_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  q public.messages%ROWTYPE;
  v_label text;
  v_feedback boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id=p_room_id AND tutor_id=p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO a FROM private.transfer_assessments WHERE id=p_assessment_id AND room_id=p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF a.lifecycle='legacy_incomplete' THEN RAISE EXCEPTION 'LEGACY_ASSESSMENT_INCOMPLETE'; END IF;
  SELECT * INTO q FROM public.messages WHERE id=a.question_message_id AND room_id=p_room_id;
  SELECT area_text INTO v_label FROM public.checklist_items WHERE id=a.item_id;
  v_feedback := a.lifecycle IN ('passed','failed') AND NOT EXISTS (
    SELECT 1 FROM public.messages feedback
    WHERE feedback.room_id=p_room_id AND feedback.user_id=p_actor_id AND feedback.user_role='tutor'
      AND feedback.assessment_event IS NULL AND feedback.response_mode='tutoring'
      AND feedback.parent_message_id=a.terminal_answer_message_id AND feedback.created_at>a.closed_at);
  RETURN jsonb_build_object('item_label',v_label,'student_id',a.student_id,
    'resolution',CASE WHEN a.lifecycle IN ('passed','failed') THEN a.lifecycle ELSE 'open' END,
    'lifecycle',CASE WHEN a.lifecycle='open' THEN 'delivered' ELSE a.lifecycle END,
    'attempt_count',a.attempt_count,'feedback_required',v_feedback,
    'history_readiness',private.assessment_history_readiness(p_room_id,a.student_id),
    'assessment',jsonb_build_object('selection_type',a.selection_type,'stem',q.content,'rendered_text',q.content,
      'options',q.assessment_options,'correct_option_ids',a.correct_option_ids,
      'learner_safe_explanation',a.learner_safe_explanation,'transfer_basis',a.transfer_basis));
END;
$function$;

-- These two inspected functions retain their source/ACLs and add only an explicit automatic-event exclusion.
DO $feedback_predicates$
DECLARE
  v_oid regprocedure;
  v_source text;
  v_old text;
  v_new text;
BEGIN
  FOR v_oid,v_old,v_new IN SELECT * FROM (VALUES
    ('public.prepare_transfer_assessment_context_v1(uuid,uuid,uuid,uuid,uuid)'::regprocedure,
      'AND feedback.response_mode = ''tutoring''',
      'AND feedback.assessment_event IS NULL AND feedback.response_mode = ''tutoring'''),
    ('public.prepare_transfer_turn_v1(uuid,uuid,uuid,uuid,uuid)'::regprocedure,
      'AND t.created_at > a.closed_at',
      'AND t.assessment_event IS NULL AND t.created_at > a.closed_at')
  ) changes LOOP
    v_source := pg_get_functiondef(v_oid);
    IF position(v_new IN v_source)>0 THEN CONTINUE; END IF;
    IF position(v_old IN v_source)=0 THEN RAISE EXCEPTION 'ASSESSMENT_FEEDBACK_BASELINE_CHANGED: %',v_oid; END IF;
    EXECUTE replace(v_source,v_old,v_new);
  END LOOP;
END;
$feedback_predicates$;

-- Backfill only from persisted attempts and lifecycle authority. No grades are inferred from dialogue.
CREATE OR REPLACE FUNCTION private.backfill_assessment_event_messages()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  t private.transfer_assessment_attempts%ROWTYPE;
  v_before bigint;
  v_after bigint;
  v_unavailable jsonb := '[]'::jsonb;
BEGIN
  SELECT count(*) INTO v_before FROM public.messages WHERE assessment_event IS NOT NULL;
  FOR a IN SELECT * FROM private.transfer_assessments ORDER BY room_id,id LOOP
    PERFORM 1 FROM public.rooms WHERE id=a.room_id FOR UPDATE;
    PERFORM 1 FROM private.transfer_assessments WHERE id=a.id FOR UPDATE;
    IF a.lifecycle='legacy_incomplete' THEN
      v_unavailable := v_unavailable || jsonb_build_array(a.id);
      CONTINUE;
    END IF;
    FOR t IN SELECT * FROM private.transfer_assessment_attempts WHERE assessment_id=a.id ORDER BY attempt_number LOOP
      BEGIN
        PERFORM private.write_assessment_result_message(t.answer_message_id);
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM<>'ASSESSMENT_RESULT_UNAVAILABLE' THEN RAISE; END IF;
        v_unavailable := v_unavailable || jsonb_build_array(a.id);
      END;
    END LOOP;
    IF a.lifecycle='cancelled' THEN
      PERFORM private.write_assessment_closure_message(a.id,CASE
        WHEN a.terminal_answer_message_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM private.transfer_assessment_attempts WHERE answer_message_id=a.terminal_answer_message_id
        ) THEN 'assisted' ELSE 'cancelled' END);
    END IF;
    IF a.attempt_count<>(SELECT count(*) FROM private.transfer_assessment_attempts WHERE assessment_id=a.id) THEN
      v_unavailable := v_unavailable || jsonb_build_array(a.id);
    END IF;
  END LOOP;
  SELECT count(*) INTO v_after FROM public.messages WHERE assessment_event IS NOT NULL;
  RETURN jsonb_build_object('before',v_before,'after',v_after,'inserted',v_after-v_before,
    'unavailable_assessment_ids',v_unavailable,'audience','authorized_room_participants_and_exports');
END;
$function$;
REVOKE ALL ON FUNCTION private.backfill_assessment_event_messages() FROM PUBLIC, anon, authenticated, service_role;
SELECT private.backfill_assessment_event_messages() AS assessment_event_backfill;

CREATE OR REPLACE FUNCTION public.clear_room_chat_history_v1(p_room_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $function$
DECLARE
  r public.rooms%ROWTYPE;
  v_setting text:=COALESCE(current_setting('app.transfer_operation',true),'');
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND OR r.tutor_id IS DISTINCT FROM p_actor_id OR NOT EXISTS(
    SELECT 1 FROM public.users WHERE id=p_actor_id AND "current_role"='tutor'
  ) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM set_config('app.transfer_operation','on',true);
  DELETE FROM private.transfer_assessment_attempts WHERE assessment_id IN (SELECT id FROM private.transfer_assessments WHERE room_id=r.id);
  DELETE FROM private.transfer_assessment_processing WHERE assessment_id IN (SELECT id FROM private.transfer_assessments WHERE room_id=r.id);
  DELETE FROM private.transfer_provider_attempts WHERE room_id=r.id;
  DELETE FROM private.transfer_assessments WHERE room_id=r.id;
  DELETE FROM public.message_feedback WHERE room_id=r.id;
  DELETE FROM public.messages WHERE room_id=r.id AND assessment_event IS NOT NULL;
  DELETE FROM public.messages WHERE room_id=r.id;
  PERFORM set_config('app.transfer_operation',v_setting,true);
  RETURN jsonb_build_object('success',true,'title',r.title,'prePopulatedMessagesPreserved',r.pre_populated_dialogue IS NOT NULL);
END;
$function$;
REVOKE ALL ON FUNCTION public.clear_room_chat_history_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clear_room_chat_history_v1(uuid,uuid) TO service_role;

COMMIT;
