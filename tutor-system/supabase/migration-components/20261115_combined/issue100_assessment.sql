-- Issue #100: preserve existing choices; new rooms default assessment on.
ALTER TABLE public.rooms ADD COLUMN in_room_assessment_enabled boolean NOT NULL DEFAULT true;
UPDATE public.rooms SET in_room_assessment_enabled = false
WHERE transfer_learning_enabled IS DISTINCT FROM true;
COMMENT ON COLUMN public.rooms.in_room_assessment_enabled IS 'Controls only preparation and delivery of new in-room assessments; never learning-target tracing.';

CREATE OR REPLACE FUNCTION public.enforce_practice_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
   NEW.in_room_assessment_enabled := false;
 END IF;
 RETURN NEW;
END;
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
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT v_room.in_room_assessment_enabled THEN RAISE EXCEPTION 'IN_ROOM_ASSESSMENT_DISABLED'; END IF;
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
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT (SELECT in_room_assessment_enabled FROM rooms WHERE id = p_room_id) THEN
    RAISE EXCEPTION 'IN_ROOM_ASSESSMENT_DISABLED';
  END IF;
  PERFORM 1 FROM rooms WHERE id = p_room_id AND guard_mode = false;
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


-- Keep the new server gate behind the existing trusted tutor boundary. Table-level
-- privileges override column grants, so retain ordinary writes through explicit
-- grants for every existing room column while excluding the assessment switch.
REVOKE INSERT, UPDATE ON public.rooms FROM PUBLIC, anon, authenticated;
DO $$
DECLARE writable_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO writable_columns
  FROM pg_attribute WHERE attrelid='public.rooms'::regclass AND attnum>0
    AND NOT attisdropped AND attname<>'in_room_assessment_enabled';
  EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON public.rooms TO anon, authenticated',
    writable_columns, writable_columns);
END $$;

CREATE OR REPLACE FUNCTION public.set_in_room_assessment_enabled_v1(
  p_room_id uuid, p_enabled boolean, p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, private
AS $$
DECLARE updated public.rooms%ROWTYPE;
BEGIN
  IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  UPDATE public.rooms SET in_room_assessment_enabled=p_enabled
  WHERE id=p_room_id AND tutor_id=p_actor_id AND EXISTS (
    SELECT 1 FROM public.users WHERE id=p_actor_id AND "current_role"='tutor'
  ) RETURNING * INTO updated;
  IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN jsonb_build_object('room',to_jsonb(updated));
END $$;
REVOKE ALL ON FUNCTION public.set_in_room_assessment_enabled_v1(uuid,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_in_room_assessment_enabled_v1(uuid,boolean,uuid) TO service_role;

-- The inspected production baseline retains two old tracing/setup predicates
-- already absent on staging. Remove only those predicates, preserving each
-- project's other checklist/history behavior, ownership, OIDs and grants.
DO $$
DECLARE fn record; definition text; expected_hashes text[];
BEGIN
  FOR fn IN SELECT oid,proname FROM pg_proc WHERE oid IN (
    'public.initialize_transfer_checklist_v1(uuid,uuid,jsonb,uuid)'::regprocedure,
    'public.get_transfer_message_analysis_context_v1(uuid,uuid,uuid)'::regprocedure
  ) LOOP
    definition:=pg_get_functiondef(fn.oid);
    IF fn.proname='initialize_transfer_checklist_v1' THEN
      expected_hashes:=ARRAY['e4f8b8eff23f074554f3a87e155c7306','a5109cfc94b1d3635db0303c72133503'];
      IF md5(definition)<>ALL(expected_hashes) THEN RAISE EXCEPTION 'CHECKLIST_INITIALIZATION_BASELINE_CHANGED'; END IF;
      definition:=replace(definition,
        'WHERE id = p_room_id AND tutor_id = p_actor_id AND transfer_learning_enabled',
        'WHERE id = p_room_id AND tutor_id = p_actor_id');
    ELSE
      expected_hashes:=ARRAY['84a532b11f2d5b09e6ce755e3814fe9d','3f81ae509e5c3c734af9e769e4d52015'];
      IF md5(definition)<>ALL(expected_hashes) THEN RAISE EXCEPTION 'MESSAGE_ANALYSIS_BASELINE_CHANGED'; END IF;
      definition:=replace(definition,
        'WHERE id = p_room_id AND (transfer_learning_enabled OR practice_type=''cyberbullying'')',
        'WHERE id = p_room_id');
    END IF;
    EXECUTE definition;
  END LOOP;
END $$;
