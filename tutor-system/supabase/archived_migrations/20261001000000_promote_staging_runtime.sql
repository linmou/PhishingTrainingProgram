--#!/usr/bin/env psql
-- Purpose: promote the live staging transfer runtime onto the inspected production schema.
-- Source: live production catalog zgbufaxooqxeabewktzd and live staging catalog ciubrzggdqesgvfkpolj, 2026-10-01.
BEGIN;

DO $$ BEGIN
  IF to_regclass('private.transfer_assessments') IS NULL
     OR to_regclass('private.transfer_assessment_attempts') IS NOT NULL
     OR to_regclass('private.transfer_provider_attempts') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'transfer_learning_enabled')
  THEN RAISE EXCEPTION 'Production schema changed; recheck the live diff before applying'; END IF;
END $$;

ALTER TABLE public.rooms ADD COLUMN transfer_learning_enabled boolean NOT NULL DEFAULT false;
UPDATE public.rooms r SET transfer_learning_enabled = true
WHERE EXISTS (SELECT 1 FROM public.session_checklists c
  WHERE c.room_id = r.id AND c.progress_policy_version = 'transfer_v1');
ALTER TABLE public.messages ADD COLUMN assessment_request_id uuid;
CREATE UNIQUE INDEX messages_assessment_request_id_uidx ON public.messages (assessment_request_id);
ALTER TABLE public.messages DROP CONSTRAINT messages_assessment_lifecycle_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_assessment_lifecycle_check
  CHECK (assessment_lifecycle IS NULL OR assessment_lifecycle IN
    ('delivered', 'answered', 'passed', 'failed', 'cancelled', 'invalidated', 'legacy_incomplete'));
ALTER TABLE private.transfer_assessments ADD COLUMN progress_snapshot_hash text;

CREATE TABLE private.transfer_assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES private.transfer_assessments(id),
  answer_message_id uuid NOT NULL UNIQUE REFERENCES public.messages(id),
  request_id uuid NOT NULL UNIQUE,
  attempt_number integer NOT NULL CHECK (attempt_number IN (1, 2)),
  selected_option_ids text[] NOT NULL,
  answer_outcome text NOT NULL CHECK (answer_outcome IN ('retry', 'passed', 'failed')),
  processing_state text NOT NULL CHECK (processing_state IN ('applied', 'deferred', 'rejected')),
  learning_event_id uuid,
  authoritative_result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, attempt_number)
);
CREATE TABLE private.transfer_provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id),
  student_id uuid NOT NULL REFERENCES public.users(id),
  checklist_id uuid NOT NULL REFERENCES public.session_checklists(id),
  focus_student_message_id uuid NOT NULL REFERENCES public.messages(id),
  attempt_ordinal integer NOT NULL CHECK (attempt_ordinal IN (1, 2)),
  provider_base_url text NOT NULL,
  provider_model text NOT NULL,
  max_tokens integer NOT NULL,
  request_hash text NOT NULL,
  request_payload jsonb NOT NULL,
  raw_response jsonb NOT NULL,
  finish_reason text,
  validation_outcome text NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, attempt_ordinal)
);
ALTER TABLE private.transfer_assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.transfer_provider_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.transfer_assessment_attempts, private.transfer_provider_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.transfer_assessment_attempts, private.transfer_provider_attempts TO service_role;

DROP FUNCTION public.initialize_transfer_checklist_v1(uuid, uuid, text, uuid);

CREATE OR REPLACE FUNCTION private.transfer_item_hash(p_item_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
  SELECT md5(jsonb_build_object('id',id,'status',status,'understanding_level',understanding_level,
    'attempts_count',attempts_count)::text) FROM public.checklist_items WHERE id = p_item_id
$function$;

CREATE OR REPLACE FUNCTION private.transfer_public_message(p_message_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
  SELECT jsonb_build_object('id',m.id,'room_id',m.room_id,'user_id',m.user_id,'content',m.content,
    'user_role',m.user_role,'parent_message_id',m.parent_message_id,'response_mode',m.response_mode,
    'created_at',m.created_at,'assessment',CASE WHEN a.id IS NULL THEN NULL ELSE
      jsonb_build_object('id',a.id,'student_id',a.student_id,'selection_type',a.selection_type,
        'stem',m.content,'options',m.assessment_options) END)
  FROM public.messages m LEFT JOIN private.transfer_assessments a ON a.question_message_id = m.id
  WHERE m.id = p_message_id
$function$;

CREATE OR REPLACE FUNCTION private.transfer_immutable_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF TG_TABLE_SCHEMA = 'public' THEN
    IF NEW.assessment_student_id IS DISTINCT FROM OLD.assessment_student_id AND OLD.assessment_student_id IS NOT NULL THEN
      RAISE EXCEPTION 'IMMUTABLE_ASSESSMENT_STUDENT_ID';
    END IF;
  ELSIF ROW(NEW.question_message_id,NEW.room_id,NEW.student_id,NEW.checklist_id,NEW.item_id,
      NEW.selection_type,NEW.correct_option_ids,NEW.learner_safe_explanation,NEW.transfer_basis,
      NEW.reviewed_private_payload,NEW.progress_snapshot_hash,NEW.delivery_request_id)
    IS DISTINCT FROM ROW(OLD.question_message_id,OLD.room_id,OLD.student_id,OLD.checklist_id,OLD.item_id,
      OLD.selection_type,OLD.correct_option_ids,OLD.learner_safe_explanation,OLD.transfer_basis,
      OLD.reviewed_private_payload,OLD.progress_snapshot_hash,OLD.delivery_request_id) THEN
    RAISE EXCEPTION 'IMMUTABLE_ASSESSMENT_PRIVATE_FIELDS';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_items jsonb, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_checklist_id uuid;
  v_item jsonb;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') OR NOT EXISTS (
    SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id AND transfer_learning_enabled
  ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM sessions WHERE room_id = p_room_id AND student_id = p_student_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'WRONG_LEARNER'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ITEM_VALIDATION_FAILED';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object' OR
       (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v_item) key) <>
         ARRAY['area_text', 'item_type', 'priority'] OR
       btrim(COALESCE(v_item->>'area_text', '')) = '' OR
       v_item->>'item_type' NOT IN ('detection_area', 'verification_step', 'understanding', 'behavior') OR
       v_item->>'priority' NOT IN ('critical', 'important', 'optional') THEN
      RAISE EXCEPTION 'ITEM_VALIDATION_FAILED';
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_room_id::text || ':' || p_student_id::text, 0));
  SELECT id INTO v_checklist_id FROM session_checklists
  WHERE room_id = p_room_id AND student_id = p_student_id
    AND progress_policy_version = 'transfer_v1' AND is_active
  FOR UPDATE;
  IF v_checklist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM checklist_items WHERE checklist_id = v_checklist_id AND NOT deleted
  ) THEN RETURN jsonb_build_object('checklist_id', v_checklist_id); END IF;

  PERFORM set_config('app.transfer_operation', 'on', true);
  IF v_checklist_id IS NULL THEN
    INSERT INTO session_checklists(room_id, student_id, progress_policy_version, template_name)
    VALUES (p_room_id, p_student_id, 'transfer_v1', 'Room learning targets')
    RETURNING id INTO v_checklist_id;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO checklist_items(
      checklist_id, area_text, item_type, priority, status, understanding_level,
      tutor_notes, attempts_count, original_template_area
    ) VALUES (
      v_checklist_id, btrim(v_item->>'area_text'), v_item->>'item_type', v_item->>'priority',
      'pending', 'none', '', 0, false
    );
  END LOOP;
  UPDATE session_checklists SET total_items = (
    SELECT count(*) FROM checklist_items WHERE checklist_id = v_checklist_id AND NOT deleted
  ), updated_at = now() WHERE id = v_checklist_id;
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
  SELECT * INTO v_marker FROM private.learning_event_inbox
  WHERE dedupe_key = 'analysis:' || p_message_id::text;
  RETURN jsonb_build_object(
    'room_id', p_room_id, 'student_id', v_message.user_id,
    'checklist_id', v_checklist.id,
    'message', jsonb_build_object('id', v_message.id, 'room_id', v_message.room_id,
      'user_id', v_message.user_id, 'user_role', v_message.user_role, 'content', v_message.content),
    'items', v_items,
    'analysis_complete', COALESCE(v_marker.processing_state IN ('applied', 'no_change'), false),
    'analysis_deferred', COALESCE(v_marker.processing_state = 'deferred_guard', false)
  );
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
  v_blocked := v_room.active_response_mode = 'guard' OR v_open OR v_feedback OR
    COALESCE((v_marker.event_payload->'analysis'->>'requires_protection')::boolean, false) OR
    COALESCE((v_marker.event_payload->'analysis'->>'requires_correction')::boolean, false);

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
    AND ci.status = 'partially_covered' AND ci.understanding_level = 'basic'
    AND EXISTS (
      SELECT 1 FROM coverage_evidence ce JOIN messages m ON m.id = ce.message_id
      WHERE ce.item_id = ci.id AND m.room_id = p_room_id
        AND m.user_id = v_message.user_id AND m.user_role = 'student'
    ) AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        COALESCE(v_marker.event_payload->'analysis'->'events', '[]'::jsonb)
      ) focus_event
      WHERE focus_event->>'item_id' = ci.id::text
        AND focus_event->>'kind' IN ('initial_signal', 'post_repair_signal')
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
    IF NOT FOUND OR v_item.status <> 'partially_covered' OR v_item.understanding_level <> 'basic'
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
    AND transfer_learning_enabled AND active_response_mode <> 'guard' FOR UPDATE;
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
$function$;

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
    IF v_selected IS NULL OR NOT v_selected <@ ARRAY['A','B','C','D'] OR
      (v_assessment.selection_type = 'single' AND cardinality(v_selected) <> 1) THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED'; END IF;
  END IF;
  INSERT INTO public.messages(room_id,user_id,user_role,content,parent_message_id,assessment_id,
    assessment_selected_option_ids,assessment_request_id)
  VALUES(p_room_id,p_actor_id,v_role,p_content,p_parent_message_id,p_assessment_id,v_selected,p_request_id) RETURNING * INTO v_message;
  RETURN jsonb_build_object('message',to_jsonb(v_message));
END $function$;

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
  RETURN jsonb_build_object('context',jsonb_build_object(
      'progress',jsonb_build_object('status',i.status,'understanding_level',i.understanding_level),
      'participation_mode',v_mode,'progress_snapshot_hash',private.transfer_item_hash(i.id),
      'feedback_required',a.lifecycle IN ('passed','failed'),'eligible_assessment_item_ids',jsonb_build_array(i.id),
      'unresolved_assessment',CASE WHEN a.lifecycle = 'open' THEN private.transfer_public_message(q.id)->'assessment' ELSE NULL END,
      'pending_repair_message_id',NULL,'attempt_snapshot',jsonb_build_object('assessment_id',a.id,
        'accepted_attempt_count',a.attempt_count,'resolution',a.lifecycle,'processed_answer_message_ids',v_processed)),
    'assessment',jsonb_build_object('id',a.id,'item_id',a.item_id,'selection_type',a.selection_type,'options',q.assessment_options,
      'correct_option_ids',a.correct_option_ids,'learner_safe_explanation',a.learner_safe_explanation,'progress_snapshot_hash',a.progress_snapshot_hash),
    'answer',jsonb_build_object('selected_option_ids',m.assessment_selected_option_ids,'references_message_id',m.parent_message_id),
    'authoritative_result',v_result);
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
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_selected FROM unnest(m.assessment_selected_option_ids) x;
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

CREATE OR REPLACE FUNCTION public.record_transfer_provider_attempt_v1(p_request_id uuid, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_focus_student_message_id uuid, p_attempt_ordinal integer, p_provider_base_url text, p_provider_model text, p_max_tokens integer, p_request_hash text, p_request_payload jsonb, p_raw_response jsonb, p_finish_reason text, p_validation_outcome text, p_error_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.session_checklists c JOIN public.messages m ON m.id = p_focus_student_message_id
    WHERE c.id = p_checklist_id AND c.room_id = p_room_id AND c.student_id = p_student_id
      AND m.room_id = p_room_id AND m.user_id = p_student_id AND m.user_role = 'student') THEN RAISE EXCEPTION 'INVALID_SCOPE'; END IF;
  INSERT INTO private.transfer_provider_attempts(request_id,room_id,student_id,checklist_id,focus_student_message_id,
    attempt_ordinal,provider_base_url,provider_model,max_tokens,request_hash,request_payload,raw_response,
    finish_reason,validation_outcome,error_code) VALUES(p_request_id,p_room_id,p_student_id,p_checklist_id,
    p_focus_student_message_id,p_attempt_ordinal,p_provider_base_url,p_provider_model,p_max_tokens,p_request_hash,
    p_request_payload,p_raw_response,p_finish_reason,p_validation_outcome,p_error_code)
    ON CONFLICT(request_id,attempt_ordinal) DO UPDATE SET request_id = EXCLUDED.request_id RETURNING id INTO v_id;
  RETURN v_id;
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
    WHERE checklist_id = c.id AND NOT deleted AND status = 'partially_covered' AND understanding_level = 'basic';
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

CREATE TRIGGER transfer_private_fields_immutable BEFORE UPDATE ON private.transfer_assessments FOR EACH ROW EXECUTE FUNCTION private.transfer_immutable_fields();
CREATE TRIGGER transfer_public_target_immutable BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION private.transfer_immutable_fields();
CREATE TRIGGER transfer_replay_guard AFTER UPDATE OF active_response_mode ON public.rooms FOR EACH ROW EXECUTE FUNCTION private.replay_transfer_guard_events();

REVOKE ALL ON FUNCTION private.transfer_item_hash(p_item_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.transfer_public_message(p_message_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.transfer_immutable_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_items jsonb, p_actor_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_items jsonb, p_actor_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_transfer_message_analysis_context_v1(p_room_id uuid, p_message_id uuid, p_actor_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_transfer_message_analysis_context_v1(p_room_id uuid, p_message_id uuid, p_actor_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.apply_transfer_message_analysis_v1(p_room_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_analysis jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_transfer_message_analysis_v1(p_room_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_analysis jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.prepare_transfer_assessment_context_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_transfer_assessment_context_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.send_reviewed_tutor_response_v4(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_reviewed_tutor_response_v4(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.send_reviewed_transfer_assessment_v1(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_reviewed_transfer_assessment_v1(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.post_assessment_message_v2(p_room_id uuid, p_content text, p_parent_message_id uuid, p_assessment_id uuid, p_selected_option_ids text[], p_actor_id uuid, p_request_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_assessment_message_v2(p_room_id uuid, p_content text, p_parent_message_id uuid, p_assessment_id uuid, p_selected_option_ids text[], p_actor_id uuid, p_request_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_transfer_assessment_processing_context_v1(p_assessment_id uuid, p_message_id uuid, p_actor_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_transfer_assessment_processing_context_v1(p_assessment_id uuid, p_message_id uuid, p_actor_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.process_assessment_message_v2(p_assessment_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_expected_attempt_count integer, p_expected_resolution text, p_answer_outcome text, p_selected_option_ids text[], p_next_progress jsonb, p_applied_transition text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_assessment_message_v2(p_assessment_id uuid, p_message_id uuid, p_actor_id uuid, p_request_id uuid, p_expected_attempt_count integer, p_expected_resolution text, p_answer_outcome text, p_selected_option_ids text[], p_next_progress jsonb, p_applied_transition text) TO service_role;
REVOKE ALL ON FUNCTION public.record_transfer_provider_attempt_v1(p_request_id uuid, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_focus_student_message_id uuid, p_attempt_ordinal integer, p_provider_base_url text, p_provider_model text, p_max_tokens integer, p_request_hash text, p_request_payload jsonb, p_raw_response jsonb, p_finish_reason text, p_validation_outcome text, p_error_code text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_transfer_provider_attempt_v1(p_request_id uuid, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_focus_student_message_id uuid, p_attempt_ordinal integer, p_provider_base_url text, p_provider_model text, p_max_tokens integer, p_request_hash text, p_request_payload jsonb, p_raw_response jsonb, p_finish_reason text, p_validation_outcome text, p_error_code text) TO service_role;
REVOKE ALL ON FUNCTION public.prepare_transfer_turn_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_transfer_turn_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid) TO service_role;
REVOKE ALL ON FUNCTION private.replay_transfer_guard_events() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
