--!/usr/bin/env psql
-- Purpose: restore private assessment storage and atomically persist server-authoritative attempts.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS assessment_student_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS assessment_request_id UUID,
  ADD COLUMN IF NOT EXISTS assessment_selected_option_ids TEXT[];

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_assessment_lifecycle_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_assessment_lifecycle_check CHECK (
    assessment_lifecycle IS NULL
    OR assessment_lifecycle IN (
      'delivered', 'passed', 'failed', 'cancelled', 'legacy_incomplete',
      'answered', 'invalidated'
    )
  );

CREATE TABLE IF NOT EXISTS private.transfer_assessments (
  id UUID PRIMARY KEY,
  question_message_id UUID NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  checklist_id UUID NOT NULL REFERENCES public.session_checklists(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE RESTRICT,
  focus_student_message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE RESTRICT,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')),
  correct_option_ids TEXT[] NOT NULL,
  learner_safe_explanation TEXT,
  transfer_basis JSONB,
  reviewed_private_payload JSONB,
  progress_snapshot_hash TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'open'
    CHECK (lifecycle IN ('open', 'passed', 'failed', 'cancelled', 'legacy_incomplete')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 2),
  terminal_answer_message_id UUID UNIQUE REFERENCES public.messages(id) ON DELETE RESTRICT,
  terminal_result TEXT CHECK (terminal_result IS NULL OR terminal_result IN ('passed', 'failed')),
  delivery_request_id UUID NOT NULL UNIQUE,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transfer_assessment_key_shape CHECK (
    lifecycle = 'legacy_incomplete'
    OR (
      cardinality(correct_option_ids) BETWEEN 1 AND 3
      AND learner_safe_explanation IS NOT NULL
      AND btrim(learner_safe_explanation) <> ''
    )
  ),
  CONSTRAINT transfer_assessment_terminal_shape CHECK (
    (lifecycle = 'open' AND terminal_result IS NULL AND terminal_answer_message_id IS NULL AND closed_at IS NULL)
    OR (lifecycle IN ('passed', 'failed') AND terminal_result = lifecycle AND terminal_answer_message_id IS NOT NULL AND closed_at IS NOT NULL)
    OR lifecycle IN ('cancelled', 'legacy_incomplete')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_transfer_assessment_per_learner
  ON private.transfer_assessments(room_id, student_id)
  WHERE lifecycle = 'open';
CREATE INDEX IF NOT EXISTS transfer_assessments_scope_idx
  ON private.transfer_assessments(room_id, student_id, lifecycle, created_at DESC);

CREATE TABLE IF NOT EXISTS private.transfer_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES private.transfer_assessments(id) ON DELETE RESTRICT,
  answer_message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal IN (1, 2)),
  selected_option_ids TEXT[] NOT NULL CHECK (cardinality(selected_option_ids) BETWEEN 1 AND 3),
  answer_outcome TEXT NOT NULL CHECK (answer_outcome IN ('retry', 'passed', 'failed')),
  processing_state TEXT NOT NULL CHECK (processing_state IN ('applied', 'deferred')),
  learning_event_id UUID,
  transition JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, ordinal),
  UNIQUE (answer_message_id),
  UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS transfer_assessment_attempts_assessment_idx
  ON private.transfer_assessment_attempts(assessment_id, ordinal);

CREATE TABLE IF NOT EXISTS private.transfer_provider_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  checklist_id UUID NOT NULL REFERENCES public.session_checklists(id) ON DELETE RESTRICT,
  focus_student_message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE RESTRICT,
  attempt_ordinal INTEGER NOT NULL CHECK (attempt_ordinal IN (1, 2)),
  provider_base_url TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  max_tokens INTEGER NOT NULL CHECK (max_tokens = 1200),
  request_hash TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  raw_response JSONB,
  finish_reason TEXT,
  validation_outcome TEXT NOT NULL
    CHECK (validation_outcome IN ('valid', 'invalid', 'truncated', 'http_error', 'network_error')),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, attempt_ordinal)
);

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON private.transfer_assessments,
  private.transfer_assessment_attempts,
  private.transfer_provider_attempts
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT, INSERT, UPDATE ON private.transfer_assessments TO service_role;
GRANT SELECT, INSERT ON private.transfer_assessment_attempts,
  private.transfer_provider_attempts TO service_role;

CREATE OR REPLACE FUNCTION private.reject_transfer_assessment_private_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  IF OLD.correct_option_ids IS DISTINCT FROM NEW.correct_option_ids
     OR OLD.learner_safe_explanation IS DISTINCT FROM NEW.learner_safe_explanation
     OR OLD.transfer_basis IS DISTINCT FROM NEW.transfer_basis
     OR OLD.reviewed_private_payload IS DISTINCT FROM NEW.reviewed_private_payload
     OR OLD.student_id IS DISTINCT FROM NEW.student_id
     OR OLD.room_id IS DISTINCT FROM NEW.room_id
     OR OLD.checklist_id IS DISTINCT FROM NEW.checklist_id
     OR OLD.item_id IS DISTINCT FROM NEW.item_id THEN
    RAISE EXCEPTION 'IMMUTABLE_ASSESSMENT_PRIVATE_FIELDS' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transfer_assessment_private_fields_immutable ON private.transfer_assessments;
CREATE TRIGGER transfer_assessment_private_fields_immutable
BEFORE UPDATE ON private.transfer_assessments
FOR EACH ROW EXECUTE FUNCTION private.reject_transfer_assessment_private_mutation();

CREATE OR REPLACE FUNCTION private.guard_public_transfer_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') AND (
    NEW.assessment_student_id IS NOT NULL
    OR NEW.assessment_options IS NOT NULL
    OR NEW.assessment_selection_type IS NOT NULL
    OR NEW.assessment_lifecycle IS NOT NULL
    OR NEW.assessment_selected_option_ids IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assessment_student_id IS DISTINCT FROM NEW.assessment_student_id THEN
    RAISE EXCEPTION 'IMMUTABLE_ASSESSMENT_STUDENT_ID' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_public_transfer_columns ON public.messages;
CREATE TRIGGER guard_public_transfer_columns
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.guard_public_transfer_columns();

INSERT INTO private.transfer_assessments (
  id, question_message_id, room_id, student_id, checklist_id, item_id,
  focus_student_message_id, selection_type, correct_option_ids,
  learner_safe_explanation, transfer_basis, reviewed_private_payload,
  progress_snapshot_hash, lifecycle, attempt_count, delivery_request_id
)
SELECT
  COALESCE(m.assessment_id, m.id),
  m.id,
  m.room_id,
  sc.student_id,
  sc.id,
  m.assessment_item_id,
  m.parent_message_id,
  COALESCE(m.assessment_selection_type, 'single'),
  m.assessment_key,
  NULL,
  NULL,
  NULL,
  'legacy-incomplete',
  'legacy_incomplete',
  0,
  gen_random_uuid()
FROM public.messages m
JOIN public.session_checklists sc
  ON sc.id = m.assessment_checklist_id
 AND sc.progress_policy_version = 'transfer_v1'
WHERE m.assessment_key IS NOT NULL
  AND cardinality(m.assessment_key) > 0
  AND m.assessment_item_id IS NOT NULL
  AND m.parent_message_id IS NOT NULL
ON CONFLICT (question_message_id) DO NOTHING;

UPDATE public.messages m
SET assessment_id = a.id,
    assessment_student_id = a.student_id,
    assessment_lifecycle = 'legacy_incomplete'
FROM private.transfer_assessments a
WHERE a.question_message_id = m.id
  AND a.lifecycle = 'legacy_incomplete';

DROP INDEX IF EXISTS public.one_open_assessment_per_student;
ALTER TABLE public.messages DROP COLUMN IF EXISTS assessment_key;

CREATE UNIQUE INDEX IF NOT EXISTS transfer_answer_request_id_unique
  ON public.messages(assessment_request_id)
  WHERE assessment_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prepare_transfer_turn_v1(
  p_room_id UUID,
  p_focus_student_message_id UUID,
  p_checklist_id UUID,
  p_actor_id UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_checklist public.session_checklists%ROWTYPE;
  v_focus public.messages%ROWTYPE;
  v_room public.rooms%ROWTYPE;
  v_items JSONB;
  v_eligible JSONB;
  v_unresolved JSONB;
  v_snapshot TEXT;
  v_context JSONB;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id AND tutor_id = p_actor_id;
  SELECT * INTO v_checklist FROM public.session_checklists
  WHERE id = p_checklist_id AND room_id = p_room_id
    AND progress_policy_version = 'transfer_v1' AND is_active = TRUE;
  SELECT * INTO v_focus FROM public.messages
  WHERE id = p_focus_student_message_id AND room_id = p_room_id AND user_role = 'student';
  IF v_room.id IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF v_checklist.id IS NULL THEN RAISE EXCEPTION 'LEGACY_CHECKLIST' USING ERRCODE = 'P0001'; END IF;
  IF v_focus.id IS NULL OR v_focus.user_id <> v_checklist.student_id THEN
    RAISE EXCEPTION 'WRONG_LEARNER' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ci.id, 'area_text', ci.area_text, 'priority', ci.priority,
    'status', ci.status, 'understanding_level', ci.understanding_level,
    'relevant_evidence_message_ids', COALESCE((
      SELECT jsonb_agg(ce.message_id ORDER BY ce.message_id)
      FROM public.coverage_evidence ce WHERE ce.item_id = ci.id AND ce.message_id IS NOT NULL
    ), '[]'::jsonb),
    'repair_message_id', NULL
  ) ORDER BY ci.id), '[]'::jsonb)
  INTO v_items
  FROM public.checklist_items ci WHERE ci.checklist_id = v_checklist.id;

  SELECT COALESCE(jsonb_agg(ci.id ORDER BY ci.id), '[]'::jsonb)
  INTO v_eligible
  FROM public.checklist_items ci
  WHERE ci.checklist_id = v_checklist.id
    AND ci.status = 'partially_covered' AND ci.understanding_level = 'basic'
    AND EXISTS (SELECT 1 FROM public.coverage_evidence ce WHERE ce.item_id = ci.id AND ce.message_id IS NOT NULL);

  SELECT jsonb_build_object(
    'id', a.id, 'selection_type', a.selection_type, 'stem', m.content,
    'rendered_text', m.content, 'options', m.assessment_options
  ) INTO v_unresolved
  FROM private.transfer_assessments a
  JOIN public.messages m ON m.id = a.question_message_id
  WHERE a.room_id = p_room_id AND a.student_id = v_checklist.student_id AND a.lifecycle = 'open'
  ORDER BY a.created_at DESC LIMIT 1;

  v_snapshot := md5(jsonb_build_object(
    'checklist_id', v_checklist.id, 'student_id', v_checklist.student_id,
    'focus_message_id', v_focus.id, 'items', v_items
  )::TEXT);
  v_context := jsonb_build_object(
    'room_id', p_room_id,
    'checklist_id', v_checklist.id,
    'focus_student_id', v_checklist.student_id,
    'focus_student_message', jsonb_build_object(
      'id', v_focus.id, 'room_id', v_focus.room_id, 'user_id', v_focus.user_id,
      'user_role', 'student', 'content', v_focus.content
    ),
    'prior_participation_mode', v_room.active_response_mode,
    'checklist_items', v_items,
    'eligible_assessment_item_ids', CASE WHEN v_unresolved IS NULL THEN v_eligible ELSE '[]'::jsonb END,
    'unresolved_assessment', v_unresolved,
    'feedback_required', FALSE,
    'progress_snapshot_hash', v_snapshot
  );
  RETURN jsonb_build_object(
    'room_id', p_room_id, 'student_id', v_checklist.student_id,
    'checklist_id', v_checklist.id, 'focus_student_message_id', v_focus.id,
    'request_id', p_request_id, 'context', v_context
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.analyze_transfer_message_v1(
  p_room_id UUID,
  p_message_id UUID,
  p_actor_id UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = p_message_id AND m.room_id = p_room_id AND m.user_id = p_actor_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.rooms r WHERE r.id = p_room_id AND r.tutor_id = p_actor_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'analyzed_message_id', p_message_id,
    'request_id', p_request_id,
    'applied', '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.send_reviewed_tutor_response_v4(
  p_reviewed_payload JSONB,
  p_room_id UUID,
  p_student_id UUID,
  p_checklist_id UUID,
  p_item_id UUID,
  p_focus_student_message_id UUID,
  p_actor_id UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_existing private.transfer_assessments%ROWTYPE;
  v_room public.rooms%ROWTYPE;
  v_message public.messages%ROWTYPE;
  v_assessment JSONB;
  v_assessment_id UUID := gen_random_uuid();
  v_key TEXT[];
  v_selection_type TEXT;
  v_mode TEXT;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM private.transfer_assessments
  WHERE delivery_request_id = p_request_id;
  IF FOUND THEN
    SELECT * INTO v_message FROM public.messages WHERE id = v_existing.question_message_id;
    SELECT * INTO v_room FROM public.rooms WHERE id = v_existing.room_id;
    IF v_existing.room_id <> p_room_id OR v_existing.student_id <> p_student_id
       OR v_room.tutor_id <> p_actor_id THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
      'message', jsonb_build_object(
        'id', v_message.id, 'room_id', v_message.room_id, 'user_id', v_message.user_id,
        'content', v_message.content, 'user_role', v_message.user_role,
        'ai_model_used', v_message.ai_model_used, 'ai_response_time_ms', v_message.ai_response_time_ms,
        'parent_message_id', v_message.parent_message_id, 'response_mode', v_message.response_mode,
        'assessment', jsonb_build_object(
          'id', v_existing.id, 'student_id', v_existing.student_id,
          'selection_type', v_existing.selection_type, 'stem', v_message.content,
          'options', v_message.assessment_options
        ), 'created_at', v_message.created_at
      ),
      'room', to_jsonb(v_room)
    );
  END IF;

  SELECT * INTO v_message FROM public.messages
  WHERE assessment_request_id = p_request_id AND room_id = p_room_id AND user_id = p_actor_id;
  IF FOUND THEN
    SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
    RETURN jsonb_build_object(
      'message', jsonb_build_object(
        'id', v_message.id, 'room_id', v_message.room_id, 'user_id', v_message.user_id,
        'content', v_message.content, 'user_role', v_message.user_role,
        'ai_model_used', v_message.ai_model_used, 'ai_response_time_ms', v_message.ai_response_time_ms,
        'parent_message_id', v_message.parent_message_id, 'response_mode', v_message.response_mode,
        'assessment', NULL, 'created_at', v_message.created_at
      ), 'room', to_jsonb(v_room)
    );
  END IF;

  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR v_room.tutor_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  v_mode := p_reviewed_payload->'decision'->>'mode';
  IF v_mode NOT IN ('tutoring', 'guard', 'assessment')
     OR NULLIF(btrim(p_reviewed_payload->>'response'), '') IS NULL THEN
    RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.session_checklists sc
    WHERE sc.id = p_checklist_id AND sc.room_id = p_room_id
      AND sc.student_id = p_student_id AND sc.progress_policy_version = 'transfer_v1'
      AND sc.is_active = TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE id = p_focus_student_message_id AND room_id = p_room_id
      AND user_id = p_student_id AND user_role = 'student'
  ) THEN
    RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
  END IF;
  IF v_mode <> 'assessment' THEN
    IF p_reviewed_payload->'assessment' IS DISTINCT FROM 'null'::JSONB
       OR p_reviewed_payload->'decision'->'target_item_id' IS DISTINCT FROM 'null'::JSONB
       OR p_reviewed_payload->'decision'->>'instruction' = 'transfer_assess' THEN
      RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.messages (
      room_id, user_id, content, user_role, parent_message_id, response_mode, assessment_request_id
    ) VALUES (
      p_room_id, p_actor_id, btrim(p_reviewed_payload->>'response'), 'tutor',
      p_focus_student_message_id, v_mode::tutor_turn_mode, p_request_id
    ) RETURNING * INTO v_message;
    UPDATE public.rooms
    SET active_response_mode = CASE
          WHEN v_mode = 'guard' THEN 'guard'::tutor_response_mode
          ELSE 'tutoring'::tutor_response_mode
        END,
        mode_changed_at = NOW(), mode_change_source = 'reviewed_response'
    WHERE id = p_room_id RETURNING * INTO v_room;
    RETURN jsonb_build_object(
      'message', jsonb_build_object(
        'id', v_message.id, 'room_id', v_message.room_id, 'user_id', v_message.user_id,
        'content', v_message.content, 'user_role', v_message.user_role,
        'ai_model_used', v_message.ai_model_used, 'ai_response_time_ms', v_message.ai_response_time_ms,
        'parent_message_id', v_message.parent_message_id, 'response_mode', v_message.response_mode,
        'assessment', NULL, 'created_at', v_message.created_at
      ), 'room', to_jsonb(v_room)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.session_checklists sc
    JOIN public.checklist_items ci ON ci.checklist_id = sc.id
    WHERE sc.id = p_checklist_id AND ci.id = p_item_id
      AND sc.room_id = p_room_id AND sc.student_id = p_student_id
      AND sc.progress_policy_version = 'transfer_v1' AND sc.is_active = TRUE
  ) OR NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE id = p_focus_student_message_id AND room_id = p_room_id
      AND user_id = p_student_id AND user_role = 'student'
  ) THEN
    RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.transfer_assessments
    WHERE room_id = p_room_id AND student_id = p_student_id AND lifecycle = 'open'
  ) THEN
    RAISE EXCEPTION 'ASSESSMENT_ALREADY_OPEN' USING ERRCODE = 'P0001';
  END IF;

  IF p_reviewed_payload->'decision'->>'instruction' <> 'transfer_assess'
     OR p_reviewed_payload->'decision'->>'target_item_id' IS DISTINCT FROM p_item_id::TEXT
     OR jsonb_typeof(p_reviewed_payload->'assessment') <> 'object' THEN
    RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;
  v_assessment := p_reviewed_payload->'assessment';
  v_selection_type := v_assessment->>'selection_type';
  v_key := ARRAY(SELECT jsonb_array_elements_text(v_assessment->'correct_option_ids'));
  IF v_selection_type NOT IN ('single', 'multiple')
     OR jsonb_array_length(v_assessment->'options') <> 4
     OR cardinality(v_key) NOT BETWEEN 1 AND 3
     OR NULLIF(btrim(v_assessment->>'stem'), '') IS NULL
     OR NULLIF(btrim(v_assessment->>'learner_safe_explanation'), '') IS NULL THEN
    RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.messages (
    room_id, user_id, content, user_role, parent_message_id, response_mode,
    assessment_id, assessment_student_id, assessment_request_id, assessment_options,
    assessment_selection_type, assessment_lifecycle
  ) VALUES (
    p_room_id, p_actor_id, btrim(v_assessment->>'stem'), 'tutor',
    p_focus_student_message_id, 'assessment', v_assessment_id, p_student_id, p_request_id,
    v_assessment->'options', v_selection_type, 'delivered'
  ) RETURNING * INTO v_message;

  INSERT INTO private.transfer_assessments (
    id, question_message_id, room_id, student_id, checklist_id, item_id,
    focus_student_message_id, selection_type, correct_option_ids,
    learner_safe_explanation, transfer_basis, reviewed_private_payload,
    progress_snapshot_hash, delivery_request_id
  ) VALUES (
    v_assessment_id, v_message.id, p_room_id, p_student_id, p_checklist_id, p_item_id,
    p_focus_student_message_id, v_selection_type, v_key,
    btrim(v_assessment->>'learner_safe_explanation'), v_assessment->'transfer_basis',
    v_assessment, COALESCE(NULLIF(p_reviewed_payload->>'progress_snapshot_hash', ''), 'reviewed'),
    p_request_id
  );

  UPDATE public.rooms
  SET active_response_mode = 'tutoring', mode_changed_at = NOW(), mode_change_source = 'reviewed_response'
  WHERE id = p_room_id
  RETURNING * INTO v_room;

  RETURN jsonb_build_object(
    'message', jsonb_build_object(
      'id', v_message.id, 'room_id', v_message.room_id, 'user_id', v_message.user_id,
      'content', v_message.content, 'user_role', v_message.user_role,
      'ai_model_used', v_message.ai_model_used, 'ai_response_time_ms', v_message.ai_response_time_ms,
      'parent_message_id', v_message.parent_message_id, 'response_mode', v_message.response_mode,
      'assessment', jsonb_build_object(
        'id', v_assessment_id, 'student_id', p_student_id,
        'selection_type', v_selection_type, 'stem', v_message.content,
        'options', v_message.assessment_options
      ), 'created_at', v_message.created_at
    ),
    'room', to_jsonb(v_room)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_assessment_message_v2(
  p_room_id UUID,
  p_content TEXT,
  p_parent_message_id UUID,
  p_assessment_id UUID,
  p_selected_option_ids TEXT[],
  p_actor_id UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_existing public.messages%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_assessment private.transfer_assessments%ROWTYPE;
  v_question public.messages%ROWTYPE;
  v_message public.messages%ROWTYPE;
  v_selected TEXT[];
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.messages
  WHERE assessment_request_id = p_request_id AND room_id = p_room_id AND user_id = p_actor_id;
  IF FOUND THEN
    RETURN jsonb_build_object('message', to_jsonb(v_existing), 'analysis_pending', TRUE, 'request_id', p_request_id);
  END IF;
  SELECT * INTO v_user FROM public.users WHERE id = p_actor_id;
  IF v_user.id IS NULL OR v_user.current_role IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.rooms WHERE id = p_room_id AND tutor_id = p_actor_id
    UNION ALL
    SELECT 1 FROM public.sessions
    WHERE room_id = p_room_id AND student_id = p_actor_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_assessment_id IS NULL THEN
    IF NULLIF(btrim(p_content), '') IS NULL THEN
      RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.messages (
      room_id, user_id, content, user_role, parent_message_id, assessment_request_id
    ) VALUES (
      p_room_id, p_actor_id, btrim(p_content), v_user.current_role,
      p_parent_message_id, p_request_id
    ) RETURNING * INTO v_message;
    RETURN jsonb_build_object(
      'message', to_jsonb(v_message),
      'analysis_pending', v_user.current_role = 'student',
      'request_id', p_request_id
    );
  END IF;
  SELECT * INTO v_assessment FROM private.transfer_assessments WHERE id = p_assessment_id;
  SELECT * INTO v_question FROM public.messages WHERE id = v_assessment.question_message_id;
  IF NOT FOUND OR v_assessment.lifecycle <> 'open' OR v_assessment.room_id <> p_room_id
     OR v_assessment.student_id <> p_actor_id OR v_question.id <> p_parent_message_id THEN
    RAISE EXCEPTION 'WRONG_LEARNER' USING ERRCODE = '42501';
  END IF;
  SELECT ARRAY(SELECT DISTINCT upper(value) FROM unnest(p_selected_option_ids) value ORDER BY upper(value))
    INTO v_selected;
  IF p_selected_option_ids IS NULL OR cardinality(v_selected) = 0
     OR EXISTS (SELECT 1 FROM unnest(v_selected) value WHERE value NOT IN ('A', 'B', 'C', 'D'))
     OR EXISTS (
       SELECT 1 FROM unnest(v_selected) value
       WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_question.assessment_options) option WHERE option->>'id' = value)
     ) THEN
    RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.messages (
    room_id, user_id, content, user_role, parent_message_id,
    assessment_id, assessment_request_id, assessment_selected_option_ids
  ) VALUES (
    p_room_id, p_actor_id, COALESCE(NULLIF(btrim(p_content), ''), array_to_string(v_selected, ',')),
    'student', p_parent_message_id, p_assessment_id, p_request_id, v_selected
  ) RETURNING * INTO v_message;
  RETURN jsonb_build_object('message', to_jsonb(v_message), 'analysis_pending', TRUE, 'request_id', p_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_transfer_assessment_processing_context_v1(
  p_assessment_id UUID,
  p_message_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_assessment private.transfer_assessments%ROWTYPE;
  v_question public.messages%ROWTYPE;
  v_answer public.messages%ROWTYPE;
  v_item public.checklist_items%ROWTYPE;
  v_room public.rooms%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_assessment FROM private.transfer_assessments WHERE id = p_assessment_id;
  SELECT * INTO v_question FROM public.messages WHERE id = v_assessment.question_message_id;
  SELECT * INTO v_answer FROM public.messages WHERE id = p_message_id;
  SELECT * INTO v_item FROM public.checklist_items WHERE id = v_assessment.item_id;
  SELECT * INTO v_room FROM public.rooms WHERE id = v_assessment.room_id;
  IF v_assessment.id IS NULL OR v_assessment.lifecycle = 'legacy_incomplete' THEN
    RAISE EXCEPTION 'LEGACY_ASSESSMENT_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;
  IF v_assessment.student_id <> p_actor_id OR v_answer.user_id <> p_actor_id
     OR v_answer.assessment_id <> p_assessment_id OR v_answer.parent_message_id <> v_question.id
     OR v_answer.room_id <> v_assessment.room_id THEN
    RAISE EXCEPTION 'WRONG_LEARNER' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'assessment', jsonb_build_object(
      'id', v_assessment.id, 'item_id', v_assessment.item_id,
      'selection_type', v_assessment.selection_type, 'options', v_question.assessment_options,
      'correct_option_ids', v_assessment.correct_option_ids,
      'learner_safe_explanation', v_assessment.learner_safe_explanation,
      'progress_snapshot_hash', v_assessment.progress_snapshot_hash
    ),
    'answer', jsonb_build_object(
      'message_id', v_answer.id, 'selected_option_ids', v_answer.assessment_selected_option_ids,
      'references_message_id', v_answer.parent_message_id
    ),
    'authoritative_result', (
      SELECT response_payload
      FROM private.transfer_assessment_attempts
      WHERE assessment_id = v_assessment.id
      ORDER BY ordinal DESC
      LIMIT 1
    ),
    'context', jsonb_build_object(
      'progress', jsonb_build_object('status', v_item.status, 'understanding_level', v_item.understanding_level),
      'participation_mode', v_room.active_response_mode,
      'progress_snapshot_hash', v_assessment.progress_snapshot_hash,
      'feedback_required', v_assessment.lifecycle IN ('passed', 'failed'),
      'eligible_assessment_item_ids', jsonb_build_array(v_assessment.item_id),
      'unresolved_assessment', jsonb_build_object(
        'id', v_assessment.id, 'selection_type', v_assessment.selection_type,
        'stem', v_question.content, 'rendered_text', v_question.content,
        'options', v_question.assessment_options
      ),
      'pending_repair_message_id', NULL,
      'attempt_snapshot', jsonb_build_object(
        'assessment_id', v_assessment.id,
        'accepted_attempt_count', v_assessment.attempt_count,
        'resolution', v_assessment.lifecycle,
        'processed_answer_message_ids', COALESCE((
          SELECT jsonb_agg(answer_message_id ORDER BY ordinal)
          FROM private.transfer_assessment_attempts WHERE assessment_id = v_assessment.id
        ), '[]'::jsonb)
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_assessment_message_v2(
  p_assessment_id UUID,
  p_message_id UUID,
  p_actor_id UUID,
  p_request_id UUID,
  p_expected_attempt_count INTEGER,
  p_expected_resolution TEXT,
  p_answer_outcome TEXT,
  p_selected_option_ids TEXT[],
  p_next_progress JSONB,
  p_applied_transition TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_assessment private.transfer_assessments%ROWTYPE;
  v_existing private.transfer_assessment_attempts%ROWTYPE;
  v_answer public.messages%ROWTYPE;
  v_ordinal INTEGER;
  v_transition JSONB := NULL;
  v_processing_state TEXT := 'applied';
  v_response JSONB;
  v_event_id UUID := gen_random_uuid();
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT attempt.* INTO v_existing
  FROM private.transfer_assessment_attempts attempt
  JOIN private.transfer_assessments assessment ON assessment.id = attempt.assessment_id
  WHERE attempt.assessment_id = p_assessment_id
    AND assessment.student_id = p_actor_id
    AND (attempt.request_id = p_request_id OR attempt.answer_message_id = p_message_id)
  ORDER BY created_at LIMIT 1;
  IF FOUND THEN
    RETURN v_existing.response_payload || jsonb_build_object(
      'processing_state', 'duplicate', 'already_processed', TRUE
    );
  END IF;

  PERFORM 1 FROM public.rooms r
  JOIN private.transfer_assessments a ON a.room_id = r.id
  WHERE a.id = p_assessment_id FOR UPDATE OF r;
  PERFORM 1 FROM public.session_checklists sc
  JOIN private.transfer_assessments a ON a.checklist_id = sc.id
  WHERE a.id = p_assessment_id FOR UPDATE OF sc;
  PERFORM 1 FROM public.checklist_items ci
  JOIN private.transfer_assessments a ON a.item_id = ci.id
  WHERE a.id = p_assessment_id FOR UPDATE OF ci;
  SELECT * INTO v_assessment FROM private.transfer_assessments
  WHERE id = p_assessment_id FOR UPDATE;

  IF v_assessment.id IS NULL OR v_assessment.student_id <> p_actor_id THEN
    RAISE EXCEPTION 'WRONG_LEARNER' USING ERRCODE = '42501';
  END IF;
  IF v_assessment.attempt_count <> p_expected_attempt_count
     OR v_assessment.lifecycle <> p_expected_resolution THEN
    RETURN jsonb_build_object(
      'internal_state', 'conflict', 'code', 'CONCURRENT_MODIFICATION',
      'attempts_used', v_assessment.attempt_count, 'resolution', v_assessment.lifecycle
    );
  END IF;
  SELECT * INTO v_answer FROM public.messages WHERE id = p_message_id;
  IF v_answer.assessment_id <> p_assessment_id OR v_answer.user_id <> p_actor_id
     OR v_answer.assessment_selected_option_ids IS DISTINCT FROM p_selected_option_ids THEN
    RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
  END IF;

  v_ordinal := p_expected_attempt_count + 1;
  IF p_answer_outcome = 'retry' AND p_expected_attempt_count <> 0 THEN
    RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION' USING ERRCODE = 'P0001';
  ELSIF p_answer_outcome = 'failed' AND p_expected_attempt_count <> 1 THEN
    RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION' USING ERRCODE = 'P0001';
  ELSIF p_answer_outcome IN ('passed', 'failed') AND p_applied_transition IS NULL THEN
    RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION' USING ERRCODE = 'P0001';
  ELSIF p_answer_outcome NOT IN ('retry', 'passed', 'failed') OR v_ordinal NOT IN (1, 2) THEN
    RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  IF p_answer_outcome IN ('passed', 'failed') THEN
    v_transition := public.apply_learning_event_v1(jsonb_build_object(
      'event_id', v_event_id,
      'dedupe_key', 'assessment:' || p_assessment_id::TEXT || ':' || p_message_id::TEXT,
      'room_id', v_assessment.room_id,
      'student_id', v_assessment.student_id,
      'checklist_id', v_assessment.checklist_id,
      'item_id', v_assessment.item_id,
      'source_message_id', p_message_id,
      'kind', CASE WHEN p_answer_outcome = 'passed' THEN 'assessment_pass' ELSE 'assessment_fail' END,
      'evidence_text', v_answer.content,
      'source_evidence_message_ids', jsonb_build_array(v_assessment.focus_student_message_id),
      'assessment_id', v_assessment.id,
      'classified_by', 'deterministic_grader',
      'expected_next_progress', p_next_progress
    ));
    IF v_transition->>'disposition' = 'deferred' THEN v_processing_state := 'deferred'; END IF;
  END IF;

  UPDATE private.transfer_assessments
  SET attempt_count = v_ordinal,
      lifecycle = CASE WHEN p_answer_outcome = 'retry' THEN 'open' ELSE p_answer_outcome END,
      terminal_answer_message_id = CASE WHEN p_answer_outcome = 'retry' THEN NULL ELSE p_message_id END,
      terminal_result = CASE WHEN p_answer_outcome = 'retry' THEN NULL ELSE p_answer_outcome END,
      closed_at = CASE WHEN p_answer_outcome = 'retry' THEN NULL ELSE NOW() END,
      updated_at = NOW()
  WHERE id = p_assessment_id;

  UPDATE public.messages
  SET assessment_lifecycle = CASE
        WHEN p_answer_outcome = 'retry' THEN 'delivered' ELSE p_answer_outcome
      END,
      assessment_answer_message_id = CASE WHEN p_answer_outcome = 'retry' THEN NULL ELSE p_message_id END,
      assessment_result = CASE
        WHEN p_answer_outcome = 'passed' THEN 'pass'
        WHEN p_answer_outcome = 'failed' THEN 'fail'
        ELSE NULL
      END,
      assessment_closed_at = CASE WHEN p_answer_outcome = 'retry' THEN NULL ELSE NOW() END
  WHERE id = v_assessment.question_message_id;

  v_response := jsonb_build_object(
    'message_id', p_message_id,
    'assessment_id', p_assessment_id,
    'processing_state', v_processing_state,
    'answer_outcome', p_answer_outcome,
    'attempt_number', v_ordinal,
    'attempts_used', v_ordinal,
    'attempts_remaining', CASE WHEN p_answer_outcome = 'retry' THEN 1 ELSE 0 END,
    'selected_option_ids', p_selected_option_ids,
    'terminal', p_answer_outcome <> 'retry',
    'transition', v_transition,
    'feedback_required', p_answer_outcome <> 'retry',
    'code', CASE WHEN v_processing_state = 'deferred' THEN 'PROGRESSION_LOCKED' ELSE NULL END,
    'already_processed', FALSE,
    'terminal_failure_feedback', CASE WHEN p_answer_outcome = 'failed' THEN jsonb_build_object(
      'correct_option_ids', v_assessment.correct_option_ids,
      'learner_safe_explanation', v_assessment.learner_safe_explanation
    ) ELSE NULL END
  );

  INSERT INTO private.transfer_assessment_attempts (
    assessment_id, answer_message_id, request_id, ordinal, selected_option_ids,
    answer_outcome, processing_state, learning_event_id, transition, response_payload
  ) VALUES (
    p_assessment_id, p_message_id, p_request_id, v_ordinal, p_selected_option_ids,
    p_answer_outcome, v_processing_state,
    CASE WHEN p_answer_outcome = 'retry' THEN NULL ELSE v_event_id END,
    v_transition, v_response
  );
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_transfer_provider_attempt_v1(
  p_request_id UUID,
  p_room_id UUID,
  p_student_id UUID,
  p_checklist_id UUID,
  p_focus_student_message_id UUID,
  p_attempt_ordinal INTEGER,
  p_provider_base_url TEXT,
  p_provider_model TEXT,
  p_max_tokens INTEGER,
  p_request_hash TEXT,
  p_request_payload JSONB,
  p_raw_response JSONB,
  p_finish_reason TEXT,
  p_validation_outcome TEXT,
  p_error_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE v_id UUID;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  INSERT INTO private.transfer_provider_attempts (
    request_id, room_id, student_id, checklist_id, focus_student_message_id,
    attempt_ordinal, provider_base_url, provider_model, max_tokens,
    request_hash, request_payload, raw_response, finish_reason,
    validation_outcome, error_code
  ) VALUES (
    p_request_id, p_room_id, p_student_id, p_checklist_id, p_focus_student_message_id,
    p_attempt_ordinal, p_provider_base_url, p_provider_model, p_max_tokens,
    p_request_hash, p_request_payload, p_raw_response, p_finish_reason,
    p_validation_outcome, p_error_code
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_reviewed_tutor_response_v4(JSONB, UUID, UUID, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_transfer_turn_v1(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.analyze_transfer_message_v1(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_assessment_message_v2(UUID, TEXT, UUID, UUID, TEXT[], UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_transfer_assessment_processing_context_v1(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_assessment_message_v2(UUID, UUID, UUID, UUID, INTEGER, TEXT, TEXT, TEXT[], JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_transfer_provider_attempt_v1(UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.send_reviewed_tutor_response_v4(JSONB, UUID, UUID, UUID, UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_transfer_turn_v1(UUID, UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.analyze_transfer_message_v1(UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_assessment_message_v2(UUID, TEXT, UUID, UUID, TEXT[], UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_transfer_assessment_processing_context_v1(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_assessment_message_v2(UUID, UUID, UUID, UUID, INTEGER, TEXT, TEXT, TEXT[], JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_transfer_provider_attempt_v1(UUID, UUID, UUID, UUID, UUID, INTEGER, TEXT, TEXT, INTEGER, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT) TO service_role;

DO $$
DECLARE v_signature REGPROCEDURE;
BEGIN
  FOR v_signature IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('post_assessment_message_v1', 'process_assessment_message_v1', 'send_reviewed_tutor_response_v3')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
  END LOOP;
END;
$$;

COMMIT;
