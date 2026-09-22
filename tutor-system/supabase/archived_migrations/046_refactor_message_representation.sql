-- Purpose: make message response mode authoritative and remove the redundant AI-generation flag.

BEGIN;

ALTER TYPE tutor_turn_mode ADD VALUE IF NOT EXISTS 'multiagent';

DROP INDEX IF EXISTS idx_messages_is_ai_generated;
ALTER TABLE messages DROP COLUMN IF EXISTS is_ai_generated;

CREATE OR REPLACE FUNCTION public.post_assessment_message_v1(
    p_room_id UUID,
    p_content TEXT,
    p_parent_message_id UUID,
    p_assessment_id UUID,
    p_actor_id UUID,
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_message messages%ROWTYPE;
    v_role user_role;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_content IS NULL OR btrim(p_content) = '' THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) THEN
        RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_user FROM users WHERE id = p_actor_id;
    IF NOT FOUND OR v_user.current_role IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    v_role := v_user.current_role;

    IF p_assessment_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM messages q
        JOIN session_checklists sc ON sc.id = q.assessment_checklist_id
        WHERE q.id = p_assessment_id
          AND q.room_id = p_room_id
          AND q.assessment_lifecycle = 'delivered'
          AND sc.student_id = p_actor_id
    ) THEN
        RAISE EXCEPTION 'WRONG_LEARNER' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO messages (
        room_id, user_id, content, user_role,
        parent_message_id, response_mode, assessment_id
    ) VALUES (
        p_room_id, p_actor_id, btrim(p_content), v_role,
        p_parent_message_id, NULL, p_assessment_id
    ) RETURNING * INTO v_message;

    RETURN jsonb_build_object(
        'message', to_jsonb(v_message),
        'analysis_pending', (v_role = 'student'),
        'request_id', p_request_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.send_reviewed_tutor_response_v3(
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
    SET active_response_mode = CASE
            WHEN v_mode = 'guard' THEN 'guard'::tutor_response_mode
            ELSE 'tutoring'::tutor_response_mode
        END,
        mode_changed_at = NOW(),
        mode_change_source = 'reviewed_response'
    WHERE id = v_room.id;

    RETURN jsonb_build_object(
        'message', (to_jsonb(v_message) - 'assessment_key'),
        'room', to_jsonb(v_room)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.send_reviewed_tutor_response_v3(JSONB, UUID, UUID, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_reviewed_tutor_response_v3(JSONB, UUID, UUID, UUID, UUID, UUID, UUID, UUID) TO service_role;

COMMIT;
