-- Purpose: replace the mis-scoped one_open_assessment_per_student index with a guarded pre-check inside send_reviewed_tutor_response_v3.
--
-- What was wrong: the index constrained (room_id, user_id) where user_id is the message AUTHOR, and an assessment tutor message is authored by the tutor. Its own pre-check queried user_id = p_student_id, the learner. The two tested different rows, so the pre-check could never match what the index constrained. Consequences: ASSESSMENT_ALREADY_OPEN was unreachable and a client received a raw 23505 instead; and because the index keyed on the tutor, a second learner in the same room could not be assessed at all.
--
-- The learner is recoverable through messages.assessment_checklist_id -> session_checklists.student_id, and the pre-check already uses that path. A partial unique index cannot, because an index may only reference columns on its own row. That is why the index fell back to the author column and enforced the wrong rule.
--
-- Fix, per the owner's decision: drop the index and enforce one open assessment per learner in the function, which has p_student_id. The race guard is not lost. The room row is locked FOR UPDATE before the pre-check rather than after it, so two concurrent deliveries for the same room serialize on that lock and the second sees the first's delivered assessment. The lock already existed; it was simply taken too late to protect the check.
--
-- Boundary: drops one index and re-creates one function. Behaviour is unchanged except that the second delivery now raises ASSESSMENT_ALREADY_OPEN, and delivery is correctly scoped per learner rather than per tutor.

DROP INDEX IF EXISTS public.one_open_assessment_per_student;

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

    -- Lock the room BEFORE the open-assessment check. The lock previously sat after it, which left
    -- a window in which two concurrent deliveries could both pass the check. Holding it across the
    -- check and the insert is what replaces the dropped index as the race guard.
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
        -- One open assessment per learner. The learner is reached through the checklist, because a
        -- message's user_id is its author and an assessment message is authored by the tutor.
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
