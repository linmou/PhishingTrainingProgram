-- Purpose: re-author `prepare_transfer_turn_v1` without the generation-trigger suppression that migration 032 removed. Migration 027 had re-authored this function to call `private.transfer_draft_trigger_key_v1(...)` and read `assessment_drafts.trigger_key`; migration 032 dropped both the helper function and the column but did not re-create this function, so its stored body still references objects that no longer exist. `DROP COLUMN` does not fail on a plpgsql body because the body is not dependency-tracked, so the breakage was silent.
--
-- Severity: the function raises `AI_PROVIDER_NOT_CONFIGURED` before reaching the dangling statements, and the Edge Function shadows this RPC for `prepare_turn`, so the defect is currently latent rather than live. It is fixed because the lean design lists this function as kept, and a latent reference to a dropped object is a trap for the next change.
--
-- Boundary: function-only. The signature, the guards, the security posture, and the deliberate `AI_PROVIDER_NOT_CONFIGURED` exit are preserved exactly. No table, column, index, or grant change.

CREATE OR REPLACE FUNCTION prepare_transfer_turn_v1(
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
    v_message messages%ROWTYPE;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_checklist_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM session_checklists
        WHERE id = p_checklist_id AND room_id = p_room_id
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_message FROM messages WHERE id = p_focus_student_message_id;
    IF NOT FOUND OR v_message.room_id <> p_room_id THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    -- Model generation belongs in the trusted Edge Function/provider adapter.
    -- Returning this explicit error avoids fabricating a question or exposing a key.
    RAISE EXCEPTION 'AI_PROVIDER_NOT_CONFIGURED' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION prepare_transfer_turn_v1(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prepare_transfer_turn_v1(UUID, UUID, UUID, UUID, UUID) TO service_role;
