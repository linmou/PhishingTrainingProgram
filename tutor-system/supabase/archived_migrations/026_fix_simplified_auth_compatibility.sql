BEGIN;

-- Purpose: repair the post-025 compatibility regression for browser clients
-- that use the application's local identity instead of Supabase Auth.
-- This migration changes function ACLs and RLS policies only; it does not
-- delete or rewrite existing rows.

-- Remove an obsolete overload if a partially applied 025 left it behind.
DROP FUNCTION IF EXISTS send_reviewed_tutor_response(
    UUID, UUID, UUID, TEXT, tutor_response_mode, TEXT, tutor_response_mode,
    TEXT, TEXT, INTEGER, JSONB
);

-- The legacy reviewed-send RPC must not require auth.uid(): the current app
-- sends the caller's locally stored tutor ID and uses the anon PostgREST role.
CREATE OR REPLACE FUNCTION send_reviewed_tutor_response(
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
    IF p_raw_mode = 'tutoring' AND p_raw_instruction IS NULL THEN
        RAISE EXCEPTION 'Null raw instruction is allowed only for Guard decisions';
    END IF;
    IF p_raw_instruction IS NOT NULL AND p_raw_instruction NOT IN (
        'protective_instruction', 'correction', 'scaffolding', 'explanation',
        'consolidation', 'guard'
    ) THEN
        RAISE EXCEPTION 'Unsupported legacy raw instruction';
    END IF;

    SELECT * INTO room_row FROM rooms
    WHERE id = p_room_id AND tutor_id = p_tutor_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found or tutor does not own room';
    END IF;

    INSERT INTO messages (
        room_id, user_id, content, user_role, response_mode, parent_message_id
    ) VALUES (
        p_room_id, p_tutor_id, btrim(p_content), 'tutor',
        p_final_mode::TEXT::tutor_turn_mode, p_parent_message_id
    ) RETURNING * INTO message_row;

    INSERT INTO ai_suggestion_feedback (
        room_id, tutor_id, parent_message_id, ai_suggestion, tutor_action,
        tutor_final_response, tutor_message_id, response_time_ms, context_messages,
        raw_mode, raw_instruction, mode_reason, final_mode, mode_rectified,
        contract_version, final_instruction
    ) VALUES (
        p_room_id, p_tutor_id, p_parent_message_id, p_ai_suggestion, p_tutor_action,
        btrim(p_content), message_row.id, p_response_time_ms, p_context_messages,
        p_raw_mode::TEXT::tutor_turn_mode, p_raw_instruction, btrim(p_mode_reason),
        p_final_mode::TEXT::tutor_turn_mode, p_raw_mode IS DISTINCT FROM p_final_mode,
        'legacy_v2', p_raw_instruction
    ) RETURNING * INTO feedback_row;

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

REVOKE ALL ON FUNCTION send_reviewed_tutor_response(
    UUID, UUID, UUID, TEXT, tutor_response_mode, TEXT, TEXT, tutor_response_mode,
    TEXT, TEXT, INTEGER, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION send_reviewed_tutor_response(
    UUID, UUID, UUID, TEXT, tutor_response_mode, TEXT, TEXT, tutor_response_mode,
    TEXT, TEXT, INTEGER, JSONB
) TO anon, authenticated;

-- 025 changed the legacy checklist policies to auth.uid()-based rules. Keep
-- transfer_v1 rows protected, while preserving the existing local-auth
-- behavior for legacy_v1 rows.
DROP POLICY IF EXISTS "Legacy browser clients can manage legacy checklists" ON session_checklists;
CREATE POLICY "Legacy browser clients can manage legacy checklists" ON session_checklists
    FOR ALL TO anon, authenticated
    USING (progress_policy_version = 'legacy_v1')
    WITH CHECK (progress_policy_version = 'legacy_v1');

DROP POLICY IF EXISTS "Legacy browser clients can manage legacy checklist items" ON checklist_items;
CREATE POLICY "Legacy browser clients can manage legacy checklist items" ON checklist_items
    FOR ALL TO anon, authenticated
    USING (
        checklist_id IN (
            SELECT sc.id
            FROM session_checklists sc
            WHERE sc.progress_policy_version = 'legacy_v1'
        )
    )
    WITH CHECK (
        checklist_id IN (
            SELECT sc.id
            FROM session_checklists sc
            WHERE sc.progress_policy_version = 'legacy_v1'
        )
    );

DROP POLICY IF EXISTS "Legacy browser clients can manage legacy coverage evidence" ON coverage_evidence;
CREATE POLICY "Legacy browser clients can manage legacy coverage evidence" ON coverage_evidence
    FOR ALL TO anon, authenticated
    USING (
        item_id IN (
            SELECT ci.id
            FROM checklist_items ci
            JOIN session_checklists sc ON sc.id = ci.checklist_id
            WHERE sc.progress_policy_version = 'legacy_v1'
        )
    )
    WITH CHECK (
        item_id IN (
            SELECT ci.id
            FROM checklist_items ci
            JOIN session_checklists sc ON sc.id = ci.checklist_id
            WHERE sc.progress_policy_version = 'legacy_v1'
        )
    );

DROP POLICY IF EXISTS "Legacy browser clients can manage legacy checklist updates" ON checklist_updates;
CREATE POLICY "Legacy browser clients can manage legacy checklist updates" ON checklist_updates
    FOR ALL TO anon, authenticated
    USING (
        checklist_id IN (
            SELECT sc.id
            FROM session_checklists sc
            WHERE sc.progress_policy_version = 'legacy_v1'
        )
    )
    WITH CHECK (
        checklist_id IN (
            SELECT sc.id
            FROM session_checklists sc
            WHERE sc.progress_policy_version = 'legacy_v1'
        )
    );

COMMIT;
