-- Preserve the model's raw instructional decision in tutor-only audit records.

ALTER TABLE ai_suggestion_feedback
    ADD COLUMN IF NOT EXISTS raw_instruction TEXT;

ALTER TABLE ai_suggestion_feedback
    DROP CONSTRAINT IF EXISTS ai_suggestion_feedback_raw_instruction_value_check,
    ADD CONSTRAINT ai_suggestion_feedback_raw_instruction_value_check CHECK (
        raw_instruction IS NULL OR raw_instruction IN (
            'protective_instruction',
            'correction',
            'scaffolding',
            'explanation',
            'consolidation'
        )
    );

-- Existing audit rows cannot be reconstructed. NOT VALID leaves them untouched while
-- enforcing the Guard/null relationship for every new or updated row.
ALTER TABLE ai_suggestion_feedback
    DROP CONSTRAINT IF EXISTS ai_suggestion_feedback_raw_instruction_mode_check,
    ADD CONSTRAINT ai_suggestion_feedback_raw_instruction_mode_check CHECK (
        raw_mode IS NOT NULL
        AND (raw_instruction IS NOT NULL OR raw_mode = 'guard')
    ) NOT VALID;

DROP FUNCTION IF EXISTS send_reviewed_tutor_response(
    UUID, UUID, UUID, TEXT, tutor_response_mode, TEXT, tutor_response_mode,
    TEXT, TEXT, INTEGER, JSONB
);

CREATE FUNCTION send_reviewed_tutor_response(
    p_room_id UUID,
    p_tutor_id UUID,
    p_parent_message_id UUID,
    p_content TEXT,
    p_raw_mode tutor_response_mode,
    p_raw_instruction TEXT,
    p_mode_reason TEXT,
    p_final_mode tutor_response_mode,
    p_ai_suggestion TEXT,
    p_tutor_action TEXT,
    p_response_time_ms INTEGER,
    p_context_messages JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    room_row rooms%ROWTYPE;
    message_row messages%ROWTYPE;
    feedback_row ai_suggestion_feedback%ROWTYPE;
BEGIN
    IF p_content IS NULL OR btrim(p_content) = '' THEN
        RAISE EXCEPTION 'Tutor response cannot be empty';
    END IF;
    IF p_mode_reason IS NULL OR btrim(p_mode_reason) = '' THEN
        RAISE EXCEPTION 'AI mode reason cannot be empty';
    END IF;
    IF p_ai_suggestion IS NULL OR btrim(p_ai_suggestion) = '' THEN
        RAISE EXCEPTION 'AI suggested response cannot be empty';
    END IF;
    IF p_tutor_action NOT IN ('accepted', 'modified') THEN
        RAISE EXCEPTION 'Reviewed send requires accepted or modified tutor action';
    END IF;
    IF p_raw_mode IS NULL THEN
        RAISE EXCEPTION 'Raw mode is required';
    END IF;
    IF p_raw_mode = 'tutoring' AND p_raw_instruction IS NULL THEN
        RAISE EXCEPTION 'Null raw instruction is allowed only for Guard decisions';
    END IF;
    IF p_raw_instruction IS NOT NULL AND p_raw_instruction NOT IN (
        'protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation'
    ) THEN
        RAISE EXCEPTION 'Unsupported raw instruction';
    END IF;

    SELECT * INTO room_row
    FROM rooms
    WHERE id = p_room_id AND tutor_id = p_tutor_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found or tutor does not own room';
    END IF;

    INSERT INTO messages (
        room_id, user_id, content, user_role, response_mode, parent_message_id
    ) VALUES (
        p_room_id, p_tutor_id, btrim(p_content), 'tutor', p_final_mode, p_parent_message_id
    )
    RETURNING * INTO message_row;

    INSERT INTO ai_suggestion_feedback (
        room_id, tutor_id, parent_message_id, ai_suggestion, tutor_action,
        tutor_final_response, tutor_message_id, response_time_ms, context_messages,
        raw_mode, raw_instruction, mode_reason, final_mode, mode_rectified
    ) VALUES (
        p_room_id, p_tutor_id, p_parent_message_id, p_ai_suggestion, p_tutor_action,
        btrim(p_content), message_row.id, p_response_time_ms, p_context_messages,
        p_raw_mode, p_raw_instruction, btrim(p_mode_reason), p_final_mode,
        p_raw_mode IS DISTINCT FROM p_final_mode
    )
    RETURNING * INTO feedback_row;

    UPDATE rooms
    SET active_response_mode = p_final_mode,
        mode_changed_at = NOW(),
        mode_change_source = 'reviewed_response'
    WHERE id = p_room_id;

    SELECT * INTO room_row FROM rooms WHERE id = p_room_id;

    RETURN jsonb_build_object(
        'message', to_jsonb(message_row),
        'room', to_jsonb(room_row),
        'feedback', to_jsonb(feedback_row)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION send_reviewed_tutor_response(
    UUID, UUID, UUID, TEXT, tutor_response_mode, TEXT, TEXT, tutor_response_mode,
    TEXT, TEXT, INTEGER, JSONB
) TO anon, authenticated;
