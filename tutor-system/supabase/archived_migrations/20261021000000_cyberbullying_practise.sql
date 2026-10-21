-- Cyberbullying practise: shared scenarios, learner progress, Guard booleans and supervised role replies.
-- Source: live production/staging catalogs inspected 2026-10-21; apply as postgres in one transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $gate$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.practice_write_gate WHERE singleton AND closed) THEN
   RAISE EXCEPTION 'CUTOVER_GATE_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM public.messages WHERE response_mode::text='multiagent' OR content ~* '\\[agent:(riley|tutor)\\]')
   OR EXISTS(SELECT 1 FROM public.rooms WHERE ai_assistant_prompt ILIKE '%Riley%')
   OR EXISTS(SELECT 1 FROM public.ai_assistant_configs WHERE system_prompt ILIKE '%Riley%' OR prompt_config->>'interaction_mode'='multi_agent')
   OR EXISTS(SELECT 1 FROM public.room_templates WHERE template_name ILIKE '%Multi-agent%' OR ai_config_template::text LIKE '%multi_agent%')
   OR EXISTS(SELECT 1 FROM public.ai_suggestion_feedback WHERE raw_mode::text='multiagent' OR final_mode::text='multiagent') THEN
   RAISE EXCEPTION 'LEGACY_INVENTORY_CHANGED';
 END IF;
END;
$gate$;
ALTER TABLE public.rooms ADD COLUMN practice_type text NOT NULL DEFAULT 'phishing' CHECK (practice_type IN ('phishing','cyberbullying'));
ALTER TABLE public.rooms ADD COLUMN scenario_config jsonb;
ALTER TABLE public.room_templates ADD COLUMN practice_type text NOT NULL DEFAULT 'phishing' CHECK (practice_type IN ('phishing','cyberbullying'));
ALTER TABLE public.room_templates ADD COLUMN scenario_config jsonb;
DROP TRIGGER transfer_replay_guard ON public.rooms;
ALTER TABLE public.rooms RENAME COLUMN active_response_mode TO guard_mode;
ALTER TABLE public.rooms ALTER COLUMN guard_mode DROP DEFAULT;
ALTER TABLE public.rooms ALTER COLUMN guard_mode TYPE boolean USING (guard_mode::text = 'guard');
ALTER TABLE public.rooms ALTER COLUMN guard_mode SET DEFAULT false;
ALTER TABLE public.rooms RENAME COLUMN mode_changed_at TO guard_mode_changed_at;
ALTER TABLE public.rooms RENAME COLUMN mode_change_source TO guard_mode_change_source;
ALTER TABLE public.messages ADD COLUMN character text CHECK (character IN ('same_age_peer','older_peer','victim','bully','educator'));
ALTER TABLE public.messages ADD COLUMN persona_id text;
ALTER TABLE public.messages ADD COLUMN persona_name text;
ALTER TABLE public.messages ADD COLUMN persona_avatar text;
ALTER TABLE public.messages ADD COLUMN guard_mode boolean;
UPDATE public.messages SET guard_mode = CASE WHEN response_mode IS NULL THEN NULL ELSE response_mode::text='guard' END;
ALTER TABLE public.ai_suggestion_feedback RENAME COLUMN raw_mode TO raw_message_category;
ALTER TABLE public.ai_suggestion_feedback RENAME COLUMN final_mode TO final_message_category;
ALTER TABLE public.ai_suggestion_feedback ADD COLUMN raw_guard_mode boolean;
ALTER TABLE public.ai_suggestion_feedback ADD COLUMN final_guard_mode boolean;
ALTER TABLE public.ai_suggestion_feedback DROP CONSTRAINT ai_suggestion_feedback_raw_instruction_mode_check;
UPDATE public.ai_suggestion_feedback SET
 raw_guard_mode=CASE WHEN raw_message_category IS NULL THEN NULL ELSE raw_message_category::text='guard' END,
 final_guard_mode=CASE WHEN final_message_category IS NULL THEN NULL ELSE final_message_category::text='guard' END;
ALTER TABLE public.ai_suggestion_feedback RENAME COLUMN mode_reason TO guard_reason;
ALTER TABLE public.ai_suggestion_feedback RENAME COLUMN mode_rectified TO guard_rectified;
ALTER TABLE public.ai_suggestion_feedback ADD COLUMN raw_character text;
ALTER TABLE public.ai_suggestion_feedback ADD COLUMN final_character text;
ALTER TABLE public.ai_suggestion_feedback ADD COLUMN suggestion_id uuid;
ALTER TABLE public.ai_suggestion_feedback ADD COLUMN generation_provenance jsonb;
ALTER TABLE public.ai_suggestion_feedback ADD CONSTRAINT ai_suggestion_feedback_raw_instruction_guard_check CHECK (raw_guard_mode IS NULL OR raw_guard_mode OR raw_instruction IS NOT NULL OR contract_version='cyberbullying_v1') NOT VALID;
ALTER TABLE public.checklist_items ADD COLUMN target_key text;
ALTER TABLE public.session_checklists ADD COLUMN target_version text;
CREATE UNIQUE INDEX cyberbullying_target_key_unique ON public.checklist_items(checklist_id,target_key) WHERE target_key IS NOT NULL AND NOT deleted;

CREATE FUNCTION public.cyberbullying_learning_targets()
RETURNS TABLE(target_key text, area_text text, item_type text, priority text)
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 VALUES
 ('recognize_cyberbullying_impact','Recognize harmful online behavior and explain its impact on the person targeted.','understanding','important'),
 ('show_empathy_support','Acknowledge the targeted person’s feelings and offer a concrete supportive response.','behavior','important'),
 ('stand_up_constructively','Challenge bullying with a calm, respectful response that avoids escalating the conflict.','behavior','important'),
 ('avoid_reinforcing_bullying','Choose responses that avoid joining in, amplifying, or rewarding harmful behavior.','behavior','important'),
 ('choose_safe_next_step','Choose an appropriate next step such as supporting the person privately, saving evidence, reporting, blocking, or seeking trusted help.','behavior','important');
$$;

CREATE FUNCTION public.enforce_practice_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.practice_type IS DISTINCT FROM OLD.practice_type THEN
   RAISE EXCEPTION 'PRACTICE_TYPE_IMMUTABLE';
 END IF;
 IF NEW.practice_type='cyberbullying' AND (
   jsonb_typeof(NEW.scenario_config) IS DISTINCT FROM 'object'
   OR btrim(coalesce(NEW.scenario_config->>'id',''))=''
   OR btrim(coalesce(NEW.scenario_config->>'source_commit',''))=''
   OR jsonb_typeof(NEW.scenario_config->'post') IS DISTINCT FROM 'object'
   OR btrim(coalesce(NEW.scenario_config->'post'->>'text',''))=''
   OR btrim(coalesce(NEW.scenario_config->'post'->>'image',''))=''
   OR btrim(coalesce(NEW.scenario_config->'post'->'author'->>'id',''))=''
   OR btrim(coalesce(NEW.scenario_config->'post'->'author'->>'name',''))=''
   OR jsonb_typeof(NEW.scenario_config->'initial_comments') IS DISTINCT FROM 'array'
 ) THEN RAISE EXCEPTION 'SCENARIO_REQUIRED'; END IF;
 IF TG_TABLE_NAME='rooms' AND NEW.practice_type='cyberbullying' THEN
   NEW.transfer_learning_enabled := false;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_practice_identity BEFORE INSERT OR UPDATE ON public.rooms
 FOR EACH ROW EXECUTE FUNCTION public.enforce_practice_identity();
CREATE TRIGGER enforce_practice_identity BEFORE INSERT OR UPDATE ON public.room_templates
 FOR EACH ROW EXECUTE FUNCTION public.enforce_practice_identity();

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
  IF v_marker.processing_state = 'deferred_guard' AND v_room.guard_mode = false THEN
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
          AND feedback.assessment_event IS NULL AND feedback.response_mode = 'tutoring'
          AND feedback.parent_message_id = ta.terminal_answer_message_id
          AND feedback.created_at > ta.closed_at
      )
  ) INTO v_feedback;
  v_blocked := v_room.guard_mode = true OR v_open OR v_feedback;

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
      'prior_guard_mode', v_room.guard_mode,
      'checklist_items', v_items,
      'eligible_assessment_item_ids', v_eligible,
      'unresolved_assessment', NULL,
      'feedback_required', v_feedback,
      'progress_snapshot_hash', md5(v_items::text || v_message.id::text)
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_reviewed_transfer_assessment_v1(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_context jsonb;
  v_legacy_payload jsonb;
  v_result jsonb;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id
    AND transfer_learning_enabled AND guard_mode = false FOR UPDATE;
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
  UPDATE public.rooms SET guard_mode = (v_mode = 'guard'),
    guard_mode_changed_at = now(),guard_mode_change_source = 'reviewed_response' WHERE id = p_room_id RETURNING * INTO v_room;
  RETURN jsonb_build_object('message',private.transfer_public_message(v_message),'room',to_jsonb(v_room));
END $function$
;

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
  IF v_room.guard_mode = true THEN
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
$function$
;

CREATE OR REPLACE FUNCTION public.reject_guard_progress_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    active_guard_mode boolean;
    v_checklist_id uuid;
BEGIN
    IF current_setting('app.cyberbullying_initialization',true)='on' THEN RETURN COALESCE(NEW,OLD); END IF;
    -- Each table's columns are referenced only inside its own TG_TABLE_NAME block. The two
    -- early-returns compare NEW against OLD, so they are only meaningful on UPDATE, and they
    -- short-circuit the Guard check when a guarded field did not actually change.
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'session_checklists' THEN
        IF NEW.total_items IS NOT DISTINCT FROM OLD.total_items
           AND NEW.completed_items IS NOT DISTINCT FROM OLD.completed_items
           AND NEW.completion_percentage IS NOT DISTINCT FROM OLD.completion_percentage THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'checklist_items' THEN
        IF NEW.status IS NOT DISTINCT FROM OLD.status
           AND NEW.understanding_level IS NOT DISTINCT FROM OLD.understanding_level
           AND NEW.attempts_count IS NOT DISTINCT FROM OLD.attempts_count
           AND NEW.last_addressed IS NOT DISTINCT FROM OLD.last_addressed
           AND NEW.deleted IS NOT DISTINCT FROM OLD.deleted THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Resolve the owning checklist. Same rule: one table per branch, and the branch that reads
    -- checklist_items by item_id is entered only for the table that actually has item_id.
    IF TG_TABLE_NAME = 'session_checklists' THEN
        v_checklist_id := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'checklist_items' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'checklist_updates' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'coverage_evidence' THEN
        SELECT ci.checklist_id INTO v_checklist_id
        FROM checklist_items ci
        WHERE ci.id = COALESCE(NEW.item_id, OLD.item_id);
    END IF;

    IF v_checklist_id IS NOT NULL THEN
        SELECT rooms.guard_mode INTO active_guard_mode
        FROM rooms
        JOIN session_checklists ON session_checklists.room_id = rooms.id
        WHERE session_checklists.id = v_checklist_id;

        IF active_guard_mode THEN
            RAISE EXCEPTION 'Learning progression is locked while Guard Mode is active';
        END IF;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_reviewed_tutor_response_v3(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
    v_payload JSONB := p_reviewed_payload;
    v_decision JSONB;
    v_assessment JSONB;
    v_message messages%ROWTYPE;
    v_room rooms%ROWTYPE;
    v_mode TEXT;
    v_instruction TEXT;
    v_key TEXT[];
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object'
       OR jsonb_typeof(v_payload->'decision') <> 'object'
       OR v_payload->>'response' IS NULL THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
    IF v_room.practice_type<>'phishing' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

    v_decision := v_payload->'decision';
    v_mode := v_decision->>'mode';
    v_instruction := v_decision->>'instruction';
    IF v_mode NOT IN ('tutoring', 'guard', 'assessment') THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;

    IF v_mode = 'assessment' THEN
        v_assessment := v_payload->'assessment';
        IF jsonb_typeof(v_assessment) <> 'object'
           OR jsonb_typeof(v_assessment->'options') <> 'array'
           OR jsonb_typeof(v_assessment->'correct_option_ids') <> 'array'
           OR jsonb_array_length(v_assessment->'options') <> 4
           OR v_instruction <> 'transfer_assess'
           OR p_checklist_id IS NULL OR p_item_id IS NULL OR p_focus_student_message_id IS NULL THEN
            RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
        END IF;
        IF v_assessment->>'selection_type' NOT IN ('single', 'multiple') THEN
            RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM session_checklists
            WHERE id = p_checklist_id
              AND room_id = p_room_id
              AND student_id = p_student_id
              AND progress_policy_version = 'transfer_v1'
        ) THEN
            RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM messages
            WHERE id = p_focus_student_message_id
              AND room_id = p_room_id
              AND user_id = p_student_id
              AND user_role = 'student'
        ) THEN
            RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
        END IF;
        IF EXISTS (
            SELECT 1
            FROM messages m
            JOIN session_checklists sc ON sc.id = m.assessment_checklist_id
            WHERE m.room_id = p_room_id
              AND sc.student_id = p_student_id
              AND m.assessment_lifecycle = 'delivered'
        ) THEN
            RAISE EXCEPTION 'ASSESSMENT_ALREADY_OPEN' USING ERRCODE = 'P0001';
        END IF;
        v_key := ARRAY(SELECT jsonb_array_elements_text(v_assessment->'correct_option_ids'));
    END IF;

    INSERT INTO messages (
        room_id, user_id, content, user_role,
        parent_message_id, response_mode,
        assessment_options, assessment_key, assessment_lifecycle,
        assessment_checklist_id, assessment_item_id, assessment_selection_type
    ) VALUES (
        p_room_id, p_actor_id, btrim(v_payload->>'response'), 'tutor',
        p_focus_student_message_id,
        v_mode::tutor_turn_mode,
        CASE WHEN v_mode = 'assessment' THEN v_assessment->'options' ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN v_key ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN 'delivered' ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN p_checklist_id ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN p_item_id ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN v_assessment->>'selection_type' ELSE NULL END
    ) RETURNING * INTO v_message;

    UPDATE rooms
    SET guard_mode = (v_mode = 'guard'),
        guard_mode_changed_at = NOW(),
        guard_mode_change_source = 'reviewed_response'
    WHERE id = v_room.id;

    RETURN jsonb_build_object(
        'message', (to_jsonb(v_message) - 'assessment_key'),
        'room', to_jsonb(v_room)
    );
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
  SELECT guard_mode = true INTO v_guard FROM rooms WHERE id = p_room_id FOR UPDATE;
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
  v_saved jsonb;
  v_accepted boolean;
  v_guard_mode boolean;
BEGIN
  SELECT * INTO a FROM private.transfer_assessments WHERE id=p_assessment_id;
  IF NOT FOUND OR a.student_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  SELECT * INTO m FROM public.messages WHERE id=p_message_id;
  IF NOT FOUND OR m.user_id IS DISTINCT FROM p_actor_id OR m.room_id IS DISTINCT FROM a.room_id
    OR m.assessment_id IS DISTINCT FROM a.id OR m.parent_message_id IS DISTINCT FROM a.question_message_id THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  IF a.lifecycle='legacy_incomplete' THEN RAISE EXCEPTION 'LEGACY_ASSESSMENT_INCOMPLETE'; END IF;
  SELECT * INTO i FROM public.checklist_items WHERE id=a.item_id;
  SELECT * INTO q FROM public.messages WHERE id=a.question_message_id;
  SELECT guard_mode INTO v_guard_mode FROM public.rooms WHERE id=a.room_id;
  SELECT COALESCE(jsonb_agg(answer_message_id ORDER BY attempt_number),'[]'::jsonb) INTO v_processed
    FROM private.transfer_assessment_attempts WHERE assessment_id=a.id;
  SELECT authoritative_result INTO v_result FROM private.transfer_assessment_attempts WHERE answer_message_id=m.id;
  v_accepted:=FOUND;
  IF NOT v_accepted THEN
    SELECT authoritative_result INTO v_result FROM private.transfer_assessment_processing
      WHERE answer_message_id=m.id AND (code<>'guard_deferred' OR v_guard_mode);
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
      'guard_mode',v_guard_mode,'progress_snapshot_hash',private.transfer_item_hash(i.id),
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
$function$
;

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
  IF OLD.guard_mode = false OR NEW.guard_mode = true THEN RETURN NEW; END IF;
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
END $function$
;

CREATE OR REPLACE FUNCTION public.record_transfer_assessment_processing_v1(p_assessment_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_expected_attempt_count integer, p_expected_resolution text, p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  a private.transfer_assessments%ROWTYPE;
  m public.messages%ROWTYPE;
  v_result jsonb;
  v_guard_mode boolean;
BEGIN
  IF p_request_id IS NULL OR p_code NOT IN ('AMBIGUOUS_SELECTION','SELECTION_NOT_RECOGNIZED',
    'SINGLE_SELECTION_CARDINALITY','guard_deferred','stale','unresolved','duplicate','not_delivered') THEN
    RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  SELECT guard_mode INTO v_guard_mode FROM public.rooms
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
    OR (p_code='guard_deferred' AND NOT v_guard_mode) THEN RETURN jsonb_build_object('code','CONCURRENT_MODIFICATION'); END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION private.assessment_history_readiness(p_room_id uuid, p_student_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  WITH relevant AS (
    SELECT m.id answer_id,m.created_at answer_created_at,a.id assessment_id,a.lifecycle,t.answer_message_id accepted_id,
      result.id result_id,closure.id closure_id,handled.answer_message_id handled_id
    FROM public.messages m
    LEFT JOIN private.transfer_assessments a ON a.id=m.assessment_id AND a.room_id=m.room_id AND a.student_id=m.user_id
    LEFT JOIN private.transfer_assessment_attempts t ON t.answer_message_id=m.id
    LEFT JOIN private.transfer_assessment_processing handled ON handled.answer_message_id=m.id
      AND (handled.code<>'guard_deferred' OR EXISTS(SELECT 1 FROM public.rooms r WHERE r.id=p_room_id AND r.guard_mode = true))
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
$function$
;

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
        AND t.assessment_event IS NULL AND t.created_at > a.closed_at)) INTO v_feedback;
  v_hash := md5(v_items::text);
  RETURN jsonb_build_object('room_id',r.id,'student_id',m.user_id,'checklist_id',c.id,
    'focus_student_message_id',m.id,'context',jsonb_build_object('room_id',r.id,'checklist_id',c.id,
      'focus_student_id',m.user_id,'focus_student_message',to_jsonb(m),'prior_guard_mode',r.guard_mode,
      'checklist_items',v_items,'eligible_assessment_item_ids',v_eligible,'unresolved_assessment',v_open,
      'feedback_required',v_feedback,'progress_snapshot_hash',v_hash));
END $function$
;

CREATE TRIGGER transfer_replay_guard AFTER UPDATE OF guard_mode ON public.rooms FOR EACH ROW EXECUTE FUNCTION private.replay_transfer_guard_events();

-- Match the existing production boundary for retired assessment entry points.
-- Staging retained broader grants on these functions before this batch.
REVOKE EXECUTE ON FUNCTION public.post_assessment_message_v1(uuid,text,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.process_assessment_message_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.send_reviewed_tutor_response_v3(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.clear_room_chat_history_v1(p_room_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  r public.rooms%ROWTYPE;
  v_setting text:=COALESCE(current_setting('app.transfer_operation',true),'');
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND OR r.tutor_id IS DISTINCT FROM p_actor_id OR NOT EXISTS(
    SELECT 1 FROM public.users WHERE id=p_actor_id AND "current_role"='tutor'
  ) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF r.practice_type='cyberbullying' THEN RAISE EXCEPTION 'UNSUPPORTED_PRACTICE_OPERATION'; END IF;
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
$function$

;

CREATE FUNCTION public.initialize_cyberbullying_progress_v1(p_room_id uuid,p_student_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE
 c uuid;
 old_operation text := coalesce(current_setting('app.transfer_operation',true),'');
 old_initialization text := coalesce(current_setting('app.cyberbullying_initialization',true),'');
BEGIN
 PERFORM 1 FROM rooms WHERE id=p_room_id AND practice_type='cyberbullying' AND is_active FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM sessions WHERE room_id=p_room_id AND student_id=p_student_id AND status='active')
 THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
 PERFORM set_config('app.transfer_operation','on',true);
 PERFORM set_config('app.cyberbullying_initialization','on',true);
 SELECT id INTO c FROM session_checklists WHERE room_id=p_room_id AND student_id=p_student_id
   AND is_active AND progress_policy_version='transfer_v1' FOR UPDATE;
 IF c IS NULL THEN
   INSERT INTO session_checklists(room_id,student_id,progress_policy_version,template_name,is_active,target_version)
   VALUES(p_room_id,p_student_id,'transfer_v1','Cyberbullying learning targets',true,'cyberbullying_v1') RETURNING id INTO c;
 END IF;
 INSERT INTO checklist_items(checklist_id,target_key,area_text,item_type,priority,status,understanding_level,tutor_notes,attempts_count,original_template_area,deleted)
 SELECT c,t.target_key,t.area_text,t.item_type,t.priority,'pending','none','',0,true,false FROM cyberbullying_learning_targets() t
 ON CONFLICT(checklist_id,target_key) WHERE target_key IS NOT NULL AND NOT deleted DO NOTHING;
 UPDATE session_checklists SET target_version='cyberbullying_v1',total_items=5,updated_at=now() WHERE id=c;
 PERFORM set_config('app.transfer_operation',old_operation,true);
 PERFORM set_config('app.cyberbullying_initialization',old_initialization,true);
 RETURN c;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_cyberbullying_progress_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.initialize_cyberbullying_progress_v1(uuid,uuid) TO service_role;

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
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id AND is_active FOR UPDATE;
  IF NOT FOUND OR p_student_id IS NULL THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  SELECT u.current_role::text, u.status::text INTO v_role, v_status
  FROM public.users AS u
  WHERE u.id = p_student_id;
  IF v_role <> 'student' OR v_status <> 'active' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT student_id INTO v_learner FROM public.sessions
  WHERE room_id = p_room_id AND status = 'active' AND student_id IS NOT NULL
  ORDER BY started_at, id LIMIT 1;
  IF v_learner IS NULL THEN
    INSERT INTO public.sessions(room_id, tutor_id, student_id, status)
    VALUES (p_room_id, v_room.tutor_id, p_student_id, 'active')
    ON CONFLICT DO NOTHING;
    SELECT student_id INTO v_learner FROM public.sessions
    WHERE room_id = p_room_id AND status = 'active' AND student_id IS NOT NULL
    ORDER BY started_at, id LIMIT 1;
  END IF;
  IF v_learner = p_student_id AND v_room.practice_type='cyberbullying' THEN
    PERFORM public.initialize_cyberbullying_progress_v1(p_room_id,p_student_id);
  END IF;
  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'learner_id', v_learner,
    'room_role', CASE WHEN v_learner = p_student_id THEN 'student' ELSE 'observer' END
  );
END;
$function$
;
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
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND (transfer_learning_enabled OR practice_type='cyberbullying')) OR
     NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) AND
     p_actor_id <> v_message.user_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF EXISTS(SELECT 1 FROM rooms WHERE id=p_room_id AND practice_type='cyberbullying') THEN
    PERFORM public.initialize_cyberbullying_progress_v1(p_room_id,v_message.user_id);
  END IF;
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
$function$
;
-- A proposal is unpublished until the shared reviewed-send transaction accepts it.
ALTER TABLE public.rooms ADD COLUMN conversation_revision bigint NOT NULL DEFAULT 0;
CREATE TABLE private.cyberbullying_suggestions (
 id uuid PRIMARY KEY,
 room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
 tutor_id uuid NOT NULL REFERENCES public.users(id),
 parent_message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
 previous_suggestion_id uuid REFERENCES private.cyberbullying_suggestions(id) ON DELETE SET NULL,
 context_revision bigint NOT NULL,
 input_context jsonb NOT NULL,
 requested_character text CHECK (requested_character IN ('same_age_peer','older_peer','victim','bully','educator')),
 status text NOT NULL CHECK (status IN ('generating','ready','failed','rejected','superseded','approved')),
 raw_character text CHECK (raw_character IN ('same_age_peer','older_peer','victim','bully','educator')),
 raw_response text,
 raw_guard_mode boolean NOT NULL,
 reason text,
 provenance jsonb,
 message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.cyberbullying_suggestions FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.cyberbullying_suggestions TO service_role;
CREATE INDEX cyberbullying_suggestions_room ON private.cyberbullying_suggestions(room_id,created_at);
CREATE UNIQUE INDEX reviewed_suggestion_once ON public.ai_suggestion_feedback(suggestion_id) WHERE suggestion_id IS NOT NULL;

CREATE FUNCTION public.cyberbullying_characters()
RETURNS TABLE("character" text,persona_id text,persona_name text,persona_avatar text)
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 VALUES
 ('same_age_peer','copilot:jerry','Jerry','/images/bystander_profile.png'),
 ('older_peer','copilot:tom','Tom','/images/profile_2.png'),
 ('victim','copilot:dylan','Dylan','/images/victim_profile.jpeg'),
 ('bully','copilot:sarah','Sarah','/images/profile_1.png'),
 ('educator','copilot:ms-smith','Ms. Smith','/images/educator_profile.jpeg');
$$;

CREATE FUNCTION private.advance_conversation_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF TG_TABLE_NAME='rooms' THEN
   IF NEW.guard_mode IS DISTINCT FROM OLD.guard_mode
     OR NEW.scenario_config IS DISTINCT FROM OLD.scenario_config
     OR NEW.tutor_id IS DISTINCT FROM OLD.tutor_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.ai_assistant_enabled IS DISTINCT FROM OLD.ai_assistant_enabled THEN
     NEW.conversation_revision:=OLD.conversation_revision+1;
   END IF;
   RETURN NEW;
 END IF;
 -- Serializes comment writes with generation/approval at the room boundary.
 IF TG_OP='UPDATE' THEN
   IF NEW.room_id IS DISTINCT FROM OLD.room_id THEN RAISE EXCEPTION 'MESSAGE_ROOM_IMMUTABLE'; END IF;
   IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 END IF;
 UPDATE public.rooms SET conversation_revision=conversation_revision+1
 WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.room_id ELSE NEW.room_id END;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER advance_conversation_revision BEFORE UPDATE ON public.rooms
 FOR EACH ROW EXECUTE FUNCTION private.advance_conversation_revision();
CREATE TRIGGER advance_conversation_revision BEFORE INSERT OR UPDATE OR DELETE ON public.messages
 FOR EACH ROW EXECUTE FUNCTION private.advance_conversation_revision();

CREATE FUNCTION public.begin_cyberbullying_suggestion_v1(
 p_room_id uuid,p_actor_id uuid,p_request_id uuid,
 p_previous_suggestion_id uuid DEFAULT NULL,p_character text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE
 r rooms%ROWTYPE;
 s private.cyberbullying_suggestions%ROWTYPE;
 previous private.cyberbullying_suggestions%ROWTYPE;
 parent_id uuid;
 dialogue jsonb;
 context jsonb;
BEGIN
 SELECT * INTO r FROM rooms WHERE id=p_room_id AND tutor_id=p_actor_id AND is_active FOR UPDATE;
 IF NOT FOUND OR r.practice_type<>'cyberbullying' OR NOT EXISTS (
   SELECT 1 FROM users WHERE id=p_actor_id AND "current_role"='tutor' AND status='active'
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT r.ai_assistant_enabled THEN RAISE EXCEPTION 'AI_DISABLED'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 IF p_character IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM cyberbullying_characters() c WHERE c.character=p_character
 ) THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
 SELECT * INTO s FROM private.cyberbullying_suggestions WHERE id=p_request_id;
 IF FOUND THEN
   IF s.room_id<>p_room_id OR s.tutor_id<>p_actor_id
     OR s.requested_character IS DISTINCT FROM p_character
     OR s.previous_suggestion_id IS DISTINCT FROM p_previous_suggestion_id THEN
     RAISE EXCEPTION 'REQUEST_CONFLICT';
   END IF;
   RETURN to_jsonb(s);
 END IF;
 IF p_previous_suggestion_id IS NOT NULL THEN
   SELECT * INTO previous FROM private.cyberbullying_suggestions
   WHERE id=p_previous_suggestion_id AND room_id=p_room_id AND tutor_id=p_actor_id FOR UPDATE;
   IF NOT FOUND OR previous.status NOT IN ('ready','failed','generating') THEN RAISE EXCEPTION 'PROPOSAL_CONFLICT'; END IF;
   IF previous.context_revision<>r.conversation_revision THEN RAISE EXCEPTION 'STALE_PROPOSAL'; END IF;
 END IF;
 SELECT m.id INTO parent_id FROM messages m JOIN sessions se
 ON se.room_id=m.room_id AND se.student_id=m.user_id AND se.status='active'
 WHERE m.room_id=p_room_id AND m.user_role='student'
 ORDER BY m.created_at DESC,m.id DESC LIMIT 1;
 IF parent_id IS NULL THEN RAISE EXCEPTION 'LEARNER_MESSAGE_REQUIRED'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',m.id,'user_id',m.user_id,'user_role',m.user_role,
   'display_name',u.display_name,'content',m.content,'created_at',m.created_at,
   'character',m.character,'persona_id',m.persona_id,'persona_name',m.persona_name,
   'guard_mode',m.guard_mode
 ) ORDER BY m.created_at,m.id),'[]'::jsonb) INTO dialogue
 FROM messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=p_room_id;
 context:=jsonb_build_object('practice_type',r.practice_type,'scenario',r.scenario_config,
   'dialogue',dialogue,'guard_mode',r.guard_mode,'parent_message_id',parent_id);
 UPDATE private.cyberbullying_suggestions SET status='superseded',updated_at=now()
 WHERE room_id=p_room_id AND status IN ('generating','ready','failed');
 INSERT INTO private.cyberbullying_suggestions(
   id,room_id,tutor_id,parent_message_id,previous_suggestion_id,context_revision,input_context,
   requested_character,status,raw_guard_mode
 ) VALUES(p_request_id,p_room_id,p_actor_id,parent_id,p_previous_suggestion_id,r.conversation_revision,
   context,p_character,'generating',r.guard_mode) RETURNING * INTO s;
 RETURN to_jsonb(s);
END;
$$;
REVOKE ALL ON FUNCTION public.begin_cyberbullying_suggestion_v1(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_cyberbullying_suggestion_v1(uuid,uuid,uuid,uuid,text) TO service_role;

CREATE FUNCTION public.finish_cyberbullying_suggestion_v1(
 p_room_id uuid,p_actor_id uuid,p_suggestion_id uuid,p_result jsonb,p_provenance jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE r rooms%ROWTYPE; s private.cyberbullying_suggestions%ROWTYPE;
BEGIN
 SELECT * INTO r FROM rooms WHERE id=p_room_id AND tutor_id=p_actor_id AND is_active FOR UPDATE;
 IF NOT FOUND OR r.practice_type<>'cyberbullying' OR NOT EXISTS (
   SELECT 1 FROM users WHERE id=p_actor_id AND "current_role"='tutor' AND status='active'
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO s FROM private.cyberbullying_suggestions
 WHERE id=p_suggestion_id AND room_id=p_room_id AND tutor_id=p_actor_id FOR UPDATE;
 IF NOT FOUND OR s.status<>'generating' THEN RAISE EXCEPTION 'PROPOSAL_CONFLICT'; END IF;
 IF s.context_revision<>r.conversation_revision THEN
   UPDATE private.cyberbullying_suggestions SET status='superseded',provenance=p_provenance,updated_at=now()
   WHERE id=s.id RETURNING * INTO s;
   RETURN to_jsonb(s)||jsonb_build_object('error_code','STALE_PROPOSAL');
 END IF;
 IF p_result IS NULL THEN
   UPDATE private.cyberbullying_suggestions SET status='failed',provenance=p_provenance,updated_at=now()
   WHERE id=s.id RETURNING * INTO s;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM cyberbullying_characters() c WHERE c.character=p_result->>'character')
     OR btrim(coalesce(p_result->>'response',''))=''
     OR btrim(coalesce(p_result->>'reason',''))=''
     OR (s.requested_character IS NOT NULL AND s.requested_character IS DISTINCT FROM p_result->>'character')
     OR jsonb_typeof(p_provenance) IS DISTINCT FROM 'object'
     OR btrim(coalesce(p_provenance->>'model',''))=''
     OR btrim(coalesce(p_provenance->>'prompt_version',''))='' THEN
     RAISE EXCEPTION 'AI_OUTPUT_INVALID';
   END IF;
   UPDATE private.cyberbullying_suggestions SET status='ready',
     raw_character=p_result->>'character',raw_response=btrim(p_result->>'response'),
     reason=btrim(p_result->>'reason'),provenance=p_provenance,updated_at=now()
   WHERE id=s.id RETURNING * INTO s;
 END IF;
 RETURN to_jsonb(s);
END;
$$;
REVOKE ALL ON FUNCTION public.finish_cyberbullying_suggestion_v1(uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_cyberbullying_suggestion_v1(uuid,uuid,uuid,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.review_cyberbullying_suggestion_v1(p_room_id uuid,p_actor_id uuid,p_suggestion_id uuid,p_reject boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE s private.cyberbullying_suggestions%ROWTYPE;
BEGIN
 PERFORM 1 FROM rooms r JOIN users u ON u.id=r.tutor_id
 WHERE r.id=p_room_id AND r.tutor_id=p_actor_id AND r.practice_type='cyberbullying'
 AND u."current_role"='tutor' AND u.status='active' FOR UPDATE OF r;
 IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO s FROM private.cyberbullying_suggestions
 WHERE id=p_suggestion_id AND room_id=p_room_id AND tutor_id=p_actor_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_NOT_FOUND'; END IF;
 IF p_reject THEN
   IF s.status NOT IN ('generating','ready','failed','rejected') THEN RAISE EXCEPTION 'PROPOSAL_CONFLICT'; END IF;
   UPDATE private.cyberbullying_suggestions SET status='rejected',updated_at=now()
   WHERE id=s.id RETURNING * INTO s;
 END IF;
 RETURN to_jsonb(s);
END;
$$;
REVOKE ALL ON FUNCTION public.review_cyberbullying_suggestion_v1(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_cyberbullying_suggestion_v1(uuid,uuid,uuid,boolean) TO service_role;

DROP FUNCTION public.send_reviewed_tutor_response(uuid,uuid,uuid,text,public.tutor_response_mode,text,text,public.tutor_response_mode,text,text,integer,jsonb);
CREATE FUNCTION public.send_reviewed_tutor_response(
 p_room_id uuid,p_tutor_id uuid,p_parent_message_id uuid,p_content text,
 p_raw_guard_mode boolean,p_raw_instruction text,p_guard_reason text,
 p_final_guard_mode boolean,p_ai_suggestion text,p_tutor_action text,p_response_time_ms integer,
 p_context_messages jsonb,p_suggestion_id uuid DEFAULT NULL,p_final_character text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE
 r rooms%ROWTYPE; m messages%ROWTYPE; f ai_suggestion_feedback%ROWTYPE;
 s private.cyberbullying_suggestions%ROWTYPE; persona record;
 raw_guard boolean; raw_text text; raw_reason text; raw_instruction text; raw_character text;
 provenance jsonb; contract text;
BEGIN
 SELECT * INTO r FROM rooms WHERE id=p_room_id AND tutor_id=p_tutor_id AND is_active FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (
   SELECT 1 FROM users WHERE id=p_tutor_id AND "current_role"='tutor' AND status='active'
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF btrim(coalesce(p_content,''))='' OR p_final_guard_mode IS NULL
   OR p_tutor_action IS NULL OR p_tutor_action NOT IN ('accepted','modified') THEN
   RAISE EXCEPTION 'INVALID_REVIEW';
 END IF;
 SELECT * INTO f FROM ai_suggestion_feedback WHERE suggestion_id=p_suggestion_id;
 IF FOUND THEN
   IF f.room_id<>p_room_id OR f.tutor_id<>p_tutor_id
     OR f.tutor_final_response IS DISTINCT FROM btrim(p_content)
     OR f.final_character IS DISTINCT FROM p_final_character
     OR f.final_guard_mode IS DISTINCT FROM p_final_guard_mode THEN
     RAISE EXCEPTION 'PROPOSAL_CONFLICT';
   END IF;
   SELECT * INTO m FROM messages WHERE id=f.tutor_message_id;
   RETURN jsonb_build_object('message',to_jsonb(m),'room',to_jsonb(r),'feedback',to_jsonb(f));
 END IF;
 IF p_parent_message_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM messages WHERE id=p_parent_message_id AND room_id=p_room_id
 ) THEN RAISE EXCEPTION 'INVALID_PARENT'; END IF;
 SELECT * INTO persona FROM cyberbullying_characters() c WHERE c.character=p_final_character;
 IF r.practice_type='cyberbullying' THEN
   SELECT * INTO s FROM private.cyberbullying_suggestions
   WHERE id=p_suggestion_id AND room_id=p_room_id AND tutor_id=p_tutor_id FOR UPDATE;
   IF NOT FOUND OR s.status<>'ready' THEN RAISE EXCEPTION 'PROPOSAL_CONFLICT'; END IF;
   IF s.context_revision<>r.conversation_revision OR s.parent_message_id IS DISTINCT FROM p_parent_message_id THEN
     RAISE EXCEPTION 'STALE_PROPOSAL';
   END IF;
   IF persona.character IS NULL THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
   raw_guard:=s.raw_guard_mode; raw_text:=s.raw_response; raw_reason:=s.reason;
   raw_instruction:=NULL; raw_character:=s.raw_character;
   provenance:=s.provenance; contract:='cyberbullying_v1';
 ELSE
   IF p_final_character IS NOT NULL THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
   IF p_raw_guard_mode IS NULL OR btrim(coalesce(p_guard_reason,''))=''
     OR btrim(coalesce(p_ai_suggestion,''))=''
     OR (NOT p_raw_guard_mode AND p_raw_instruction IS NULL)
     OR (p_raw_instruction IS NOT NULL AND p_raw_instruction NOT IN (
       'protective_instruction','correction','scaffolding','explanation','consolidation','guard'
     )) THEN RAISE EXCEPTION 'INVALID_REVIEW'; END IF;
   raw_guard:=p_raw_guard_mode; raw_text:=p_ai_suggestion; raw_reason:=p_guard_reason;
   raw_instruction:=p_raw_instruction; raw_character:=NULL; provenance:=NULL; contract:='guard_v1';
 END IF;
 INSERT INTO messages(room_id,user_id,content,user_role,response_mode,parent_message_id,guard_mode,
   character,persona_id,persona_name,persona_avatar,ai_model_used)
 VALUES(p_room_id,p_tutor_id,btrim(p_content),'tutor',
   (CASE WHEN p_final_guard_mode THEN 'guard' ELSE 'tutoring' END)::tutor_turn_mode,
   p_parent_message_id,p_final_guard_mode,p_final_character,
   CASE WHEN r.practice_type='cyberbullying' THEN persona.persona_id ELSE NULL END,
   CASE WHEN r.practice_type='cyberbullying' THEN persona.persona_name ELSE NULL END,
   CASE WHEN r.practice_type='cyberbullying' THEN persona.persona_avatar ELSE NULL END,
   provenance->>'model') RETURNING * INTO m;
 INSERT INTO ai_suggestion_feedback(room_id,tutor_id,parent_message_id,ai_suggestion,tutor_action,
   tutor_final_response,tutor_message_id,response_time_ms,context_messages,
   raw_guard_mode,raw_instruction,guard_reason,final_guard_mode,guard_rectified,
   contract_version,final_instruction,raw_character,final_character,suggestion_id,generation_provenance)
 VALUES(p_room_id,p_tutor_id,p_parent_message_id,raw_text,p_tutor_action,btrim(p_content),m.id,
   p_response_time_ms,CASE WHEN r.practice_type='cyberbullying' THEN s.input_context->'dialogue' ELSE p_context_messages END,
   raw_guard,raw_instruction,raw_reason,p_final_guard_mode,raw_guard IS DISTINCT FROM p_final_guard_mode,
   contract,raw_instruction,raw_character,p_final_character,p_suggestion_id,provenance) RETURNING * INTO f;
 UPDATE rooms SET guard_mode=p_final_guard_mode,guard_mode_changed_at=now(),
   guard_mode_change_source='reviewed_response' WHERE id=p_room_id RETURNING * INTO r;
 IF r.practice_type='cyberbullying' THEN
   UPDATE private.cyberbullying_suggestions SET status='approved',message_id=m.id,updated_at=now() WHERE id=s.id;
 END IF;
 RETURN jsonb_build_object('message',to_jsonb(m),'room',to_jsonb(r),'feedback',to_jsonb(f));
END;
$$;
REVOKE ALL ON FUNCTION public.send_reviewed_tutor_response(uuid,uuid,uuid,text,boolean,text,text,boolean,text,text,integer,jsonb,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_reviewed_tutor_response(uuid,uuid,uuid,text,boolean,text,text,boolean,text,text,integer,jsonb,uuid,text) TO anon,authenticated,service_role;
-- Every cyberbullying learner uses the same canonical target set.
CREATE FUNCTION private.protect_cyberbullying_targets() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,private AS $$
DECLARE cid uuid; rid uuid; subject text;
BEGIN
 IF TG_TABLE_NAME='session_checklists' THEN
   rid:=CASE WHEN TG_OP='DELETE' THEN OLD.room_id ELSE NEW.room_id END;
 ELSE
   cid:=CASE WHEN TG_OP='DELETE' THEN OLD.checklist_id ELSE NEW.checklist_id END;
   SELECT room_id INTO rid FROM session_checklists WHERE id=cid;
 END IF;
 SELECT practice_type INTO subject FROM rooms WHERE id=rid;
 IF subject IS DISTINCT FROM 'cyberbullying' THEN
   RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'SHARED_TARGETS_REQUIRED'; END IF;
 IF TG_TABLE_NAME='session_checklists' THEN
   IF NEW.target_version IS DISTINCT FROM 'cyberbullying_v1'
     OR NEW.progress_policy_version IS DISTINCT FROM 'transfer_v1'
     OR NEW.student_id IS NULL THEN RAISE EXCEPTION 'SHARED_TARGETS_REQUIRED'; END IF;
   IF TG_OP='UPDATE' AND (
     NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.room_id IS DISTINCT FROM OLD.room_id
   ) THEN RAISE EXCEPTION 'LEARNER_SCOPE_IMMUTABLE'; END IF;
 ELSE
   IF NEW.deleted OR NOT EXISTS(SELECT 1 FROM cyberbullying_learning_targets() t
     WHERE t.target_key=NEW.target_key AND t.area_text=NEW.area_text
     AND t.item_type=NEW.item_type AND t.priority=NEW.priority
   ) THEN RAISE EXCEPTION 'SHARED_TARGETS_REQUIRED'; END IF;
   IF TG_OP='UPDATE' AND (
     NEW.checklist_id IS DISTINCT FROM OLD.checklist_id OR NEW.target_key IS DISTINCT FROM OLD.target_key
   ) THEN RAISE EXCEPTION 'LEARNER_SCOPE_IMMUTABLE'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER protect_cyberbullying_targets BEFORE INSERT OR UPDATE OR DELETE ON public.session_checklists
 FOR EACH ROW EXECUTE FUNCTION private.protect_cyberbullying_targets();
CREATE TRIGGER protect_cyberbullying_targets BEFORE INSERT OR UPDATE OR DELETE ON public.checklist_items
 FOR EACH ROW EXECUTE FUNCTION private.protect_cyberbullying_targets();

CREATE FUNCTION private.enforce_practice_message() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,private AS $$
DECLARE subject text;
BEGIN
 SELECT practice_type INTO subject FROM rooms WHERE id=NEW.room_id;
 IF subject='cyberbullying' THEN
   IF TG_OP='UPDATE' AND current_user<>'postgres' THEN RAISE EXCEPTION 'APPROVED_MESSAGE_IMMUTABLE'; END IF;
   IF NEW.assessment_id IS NOT NULL OR NEW.assessment_options IS NOT NULL
     OR NEW.assessment_event IS NOT NULL OR NEW.assessment_selected_option_ids IS NOT NULL
     OR NEW.response_mode::text='assessment' THEN RAISE EXCEPTION 'UNSUPPORTED_PRACTICE_OPERATION'; END IF;
   IF NEW.user_role='tutor' AND (NEW.character IS NULL OR current_user<>'postgres') THEN
     RAISE EXCEPTION 'REVIEWED_RESPONSE_REQUIRED';
   END IF;
   IF NEW.user_role<>'tutor' AND NEW.character IS NOT NULL THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
   IF NEW.user_role<>'tutor' AND NOT EXISTS (
     SELECT 1 FROM sessions s JOIN users u ON u.id=s.student_id
     WHERE s.room_id=NEW.room_id AND s.student_id=NEW.user_id AND s.status='active'
       AND u."current_role"='student' AND u.status='active'
   ) THEN RAISE EXCEPTION 'OBSERVER_READ_ONLY'; END IF;
 END IF;
 IF TG_OP='INSERT' AND NEW.guard_mode IS NULL AND NEW.response_mode IS NOT NULL THEN
   NEW.guard_mode:=NEW.response_mode::text='guard';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_practice_message BEFORE INSERT OR UPDATE ON public.messages
 FOR EACH ROW EXECUTE FUNCTION private.enforce_practice_message();
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
  IF EXISTS(SELECT 1 FROM public.rooms WHERE id=p_room_id AND practice_type='cyberbullying') THEN RAISE EXCEPTION 'UNSUPPORTED_PRACTICE_OPERATION'; END IF;
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
CREATE TRIGGER practice_write_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON private.cyberbullying_suggestions
 FOR EACH STATEMENT EXECUTE FUNCTION private.check_practice_write_gate();
UPDATE private.practice_write_gate SET required_contract='cyberbullying-v1',changed_at=now() WHERE singleton;
COMMIT;

-- Audited staging repair: provider evidence follows deletion of its Cyberbullying room.
-- The write gate remains closed across both deployment transactions.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.reject_guard_progress_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    active_guard_mode boolean;
    active_guard_room uuid;
    v_checklist_id uuid;
BEGIN
    IF current_setting('app.cyberbullying_initialization',true)='on' THEN RETURN COALESCE(NEW,OLD); END IF;
    -- Each table's columns are referenced only inside its own TG_TABLE_NAME block. The two
    -- early-returns compare NEW against OLD, so they are only meaningful on UPDATE, and they
    -- short-circuit the Guard check when a guarded field did not actually change.
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'session_checklists' THEN
        IF NEW.total_items IS NOT DISTINCT FROM OLD.total_items
           AND NEW.completed_items IS NOT DISTINCT FROM OLD.completed_items
           AND NEW.completion_percentage IS NOT DISTINCT FROM OLD.completion_percentage THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'checklist_items' THEN
        IF NEW.status IS NOT DISTINCT FROM OLD.status
           AND NEW.understanding_level IS NOT DISTINCT FROM OLD.understanding_level
           AND NEW.attempts_count IS NOT DISTINCT FROM OLD.attempts_count
           AND NEW.last_addressed IS NOT DISTINCT FROM OLD.last_addressed
           AND NEW.deleted IS NOT DISTINCT FROM OLD.deleted THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Resolve the owning checklist. Same rule: one table per branch, and the branch that reads
    -- checklist_items by item_id is entered only for the table that actually has item_id.
    IF TG_TABLE_NAME = 'session_checklists' THEN
        v_checklist_id := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'checklist_items' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'checklist_updates' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'coverage_evidence' THEN
        SELECT ci.checklist_id INTO v_checklist_id
        FROM checklist_items ci
        WHERE ci.id = COALESCE(NEW.item_id, OLD.item_id);
    END IF;

    IF v_checklist_id IS NOT NULL THEN
        SELECT rooms.guard_mode,rooms.id INTO active_guard_mode,active_guard_room
        FROM rooms
        JOIN session_checklists ON session_checklists.room_id = rooms.id
        WHERE session_checklists.id = v_checklist_id;

        IF active_guard_mode AND NOT (
            TG_OP='DELETE' AND current_user='postgres'
            AND coalesce(current_setting('app.cyberbullying_room_deletion',true),'')=active_guard_room::text
        ) THEN
            RAISE EXCEPTION 'Learning progression is locked while Guard Mode is active';
        END IF;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$
;

CREATE FUNCTION private.cleanup_cyberbullying_room() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
BEGIN
 IF OLD.practice_type='cyberbullying' THEN
   PERFORM set_config('app.transfer_operation','on',true);
   PERFORM set_config('app.cyberbullying_room_deletion',OLD.id::text,true);
   DELETE FROM private.transfer_provider_attempts WHERE room_id=OLD.id;
   DELETE FROM public.checklist_updates u USING public.session_checklists c
   WHERE u.checklist_id=c.id AND c.room_id=OLD.id;
   DELETE FROM public.coverage_evidence e USING public.checklist_items i,public.session_checklists c
   WHERE e.item_id=i.id AND i.checklist_id=c.id AND c.room_id=OLD.id;
 END IF;
 RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.cleanup_cyberbullying_room() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER cleanup_cyberbullying_room BEFORE DELETE ON public.rooms
 FOR EACH ROW EXECUTE FUNCTION private.cleanup_cyberbullying_room();
COMMIT;
