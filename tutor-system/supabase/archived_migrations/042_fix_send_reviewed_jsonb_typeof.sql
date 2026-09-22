-- Purpose: fix a type error in the payload guard of send_reviewed_tutor_response_v3, which migration 038 introduced. `jsonb_typeof` takes `jsonb`, but `->>` returns `text`, so `jsonb_typeof(v_payload->>'response')` raises `42883 function jsonb_typeof(text) does not exist` the first time the function runs. Every delivery therefore failed before writing anything.
--
-- Fix: compare text for the string member. `->>` already yields text, so requiring it to be non-null is the same assertion without the impossible function call. The two object checks keep `jsonb_typeof`, which is correct because `->` returns jsonb.
--
-- Boundary: function-only. Same eight-argument signature, same guards, same security posture. Behaviour is identical apart from no longer raising a type error. No table, column, trigger, index, or grant change.

CREATE OR REPLACE FUNCTION send_reviewed_tutor_response_v3(
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
    -- `->` yields jsonb so jsonb_typeof applies; `->>` yields text so it is tested for null.
    IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object'
       OR jsonb_typeof(v_payload->'decision') <> 'object'
       OR v_payload->>'response' IS NULL THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

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
        IF NOT EXISTS (
               SELECT 1 FROM session_checklists
               WHERE id = p_checklist_id AND room_id = p_room_id
                 AND student_id = p_student_id AND progress_policy_version = 'transfer_v1'
           ) THEN
            RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
        END IF;
        IF NOT EXISTS (
               SELECT 1 FROM messages
               WHERE id = p_focus_student_message_id
                 AND room_id = p_room_id AND user_id = p_student_id AND user_role = 'student'
           ) THEN
            RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
        END IF;
        IF EXISTS (
               SELECT 1 FROM messages
               WHERE room_id = p_room_id AND user_id = p_student_id
                 AND assessment_lifecycle = 'delivered'
           ) THEN
            RAISE EXCEPTION 'ASSESSMENT_ALREADY_OPEN' USING ERRCODE = 'P0001';
        END IF;
        v_key := ARRAY(SELECT jsonb_array_elements_text(v_assessment->'correct_option_ids'));
    END IF;

    SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;

    INSERT INTO messages (
        room_id, user_id, content, user_role, is_ai_generated,
        parent_message_id, response_mode,
        assessment_options, assessment_key, assessment_lifecycle,
        assessment_checklist_id, assessment_item_id
    ) VALUES (
        p_room_id, p_actor_id, btrim(v_payload->>'response'), 'tutor', true,
        p_focus_student_message_id,
        v_mode::tutor_turn_mode,
        CASE WHEN v_mode = 'assessment' THEN v_assessment->'options' ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN v_key ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN 'delivered' ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN p_checklist_id ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN p_item_id ELSE NULL END
    ) RETURNING * INTO v_message;

    UPDATE rooms
    SET active_response_mode = CASE WHEN v_mode = 'guard' THEN 'guard'::tutor_response_mode ELSE 'tutoring'::tutor_response_mode END,
        mode_changed_at = NOW(), mode_change_source = 'reviewed_response'
    WHERE id = v_room.id;

    -- The public projection is an allowlist; assessment_key is excluded so the normal UI path
    -- never receives it, even though the row is readable by participants.
    RETURN jsonb_build_object(
        'message', (to_jsonb(v_message) - 'assessment_key'),
        'room', to_jsonb(v_room)
    );
END;
$$;

REVOKE ALL ON FUNCTION send_reviewed_tutor_response_v3(JSONB, UUID, UUID, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION send_reviewed_tutor_response_v3(JSONB, UUID, UUID, UUID, UUID, UUID, UUID, UUID) TO service_role;
