-- Purpose: restore the author role in post_assessment_message_v1. Migration 038 re-created the
-- function with `user_role` hardcoded to 'tutor' while dropping the private.assessment_request_results
-- retry ledger, and that hardcoded role breaks the learner answer path end to end.
--
-- What was wrong: the browser calls `post_message` for a learner's own message and then immediately
-- calls `process_message` on the stored row (RoomContext sendMessage -> postMessage -> processMessage).
-- process_assessment_message_v1 opens with
--   IF NOT FOUND OR v_message.user_id <> p_actor_id OR v_message.user_role <> 'student'
--       THEN RAISE EXCEPTION 'FORBIDDEN'
-- so a learner message stored as 'tutor' can never be graded: the answer path fails with 42501
-- before the grader is reached. The original 025 body read `users.current_role` for the column; 038
-- replaced it with the literal. No lane caught it because the behavioural lane inserted its answer
-- messages directly with user_role='student' instead of going through post_message.
--
-- Fix, keeping 038's simplifications: derive the role from users.current_role, refuse an unknown
-- actor, and translate the dropped assessment_questions ownership check onto the message row that
-- now carries the assessment. The request_id is echoed for correlation only; there is still no
-- retry ledger, so it is not used for replay.
--
-- Boundary: re-creates one function. The signature, the grants, the empty-content refusal, and the
-- room-existence check are unchanged.

CREATE OR REPLACE FUNCTION post_assessment_message_v1(
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

    -- The message role is the author's role, never a literal. Grading and the learner/teacher split
    -- downstream both key off this column.
    SELECT * INTO v_user FROM users WHERE id = p_actor_id;
    IF NOT FOUND OR v_user.current_role IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    v_role := v_user.current_role;

    -- The assessment is a message now. An answer may only link to a delivered assessment whose
    -- checklist belongs to the author, which is the rule the dropped question-table lookup enforced.
    -- Do not name a dropped table in a comment in this body: T009 check 8 scans the stored function
    -- text, comments included, so naming one there trips the dangling-reference guard.
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
        room_id, user_id, content, user_role, is_ai_generated,
        parent_message_id, response_mode, assessment_id
    ) VALUES (
        p_room_id, p_actor_id, btrim(p_content), v_role, false,
        p_parent_message_id, NULL, p_assessment_id
    ) RETURNING * INTO v_message;

    RETURN jsonb_build_object(
        'message', to_jsonb(v_message),
        'analysis_pending', (v_role = 'student'),
        'request_id', p_request_id
    );
END;
$$;

REVOKE ALL ON FUNCTION post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID) TO service_role;
