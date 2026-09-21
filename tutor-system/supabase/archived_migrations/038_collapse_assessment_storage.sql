-- Purpose: collapse transfer-assessment storage from five tables to one. The owner decided four of the five are over-design and that answer-key confidentiality is an acceptable tradeoff for a training app, so the key moves onto the tutor message row and the four tables are dropped.
--
-- Owner decision, recorded rather than treated as an oversight: this is not a strict exam. `public.messages` is readable by every room participant, so a learner who crafts a REST request can read `assessment_key`. That is accepted. It is why the key may live on a participant-readable row at all; the previous design kept it in a table with no grants specifically to prevent that.
--
-- Mapping:
--   assessment_questions.options                 -> messages.assessment_options
--   assessment_question_keys.correct_option_ids  -> messages.assessment_key
--   assessment_questions.lifecycle               -> messages.assessment_lifecycle
--   assessment_questions.answer_message_id       -> messages.assessment_answer_message_id
--   assessment_questions.selected_option_ids     -> messages.assessment_selected_option_ids
--   assessment_questions.result                  -> messages.assessment_result
--   assessment_questions.closed_at               -> messages.assessment_closed_at
--   assessment_questions.checklist_id/item_id    -> messages.assessment_checklist_id / assessment_item_id
--   assessment_drafts                            -> messages (the tutor message IS the assessment)
--   assessment_request_results                   -> nothing; no caller reuses a request_id
--
-- Boundary: drops four tables and the functions that existed only for them, and adds nine nullable columns to public.messages. All transfer tables hold zero rows, so no data is at risk.
--
-- KEPT: private.learning_event_inbox, because it is the only thing that applies assessment_pass and assessment_fail to checklist_items.
--
-- ORDERING NOTE: plpgsql bodies are not dependency-tracked, so DROP TABLE would not fail on a function that still references the table. Every function that touched a dropped table is therefore re-created here, and T009 asserts that no kept body references a dropped object.

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS assessment_options JSONB,
    ADD COLUMN IF NOT EXISTS assessment_key TEXT[],
    ADD COLUMN IF NOT EXISTS assessment_lifecycle TEXT,
    ADD COLUMN IF NOT EXISTS assessment_answer_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assessment_selected_option_ids TEXT[],
    ADD COLUMN IF NOT EXISTS assessment_result TEXT,
    ADD COLUMN IF NOT EXISTS assessment_closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assessment_checklist_id UUID,
    ADD COLUMN IF NOT EXISTS assessment_item_id UUID;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_assessment_lifecycle_check;
ALTER TABLE public.messages
    ADD CONSTRAINT messages_assessment_lifecycle_check
    CHECK (assessment_lifecycle IS NULL
           OR assessment_lifecycle IN ('delivered', 'answered', 'cancelled', 'invalidated'));

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_assessment_result_check;
ALTER TABLE public.messages
    ADD CONSTRAINT messages_assessment_result_check
    CHECK (assessment_result IS NULL OR assessment_result IN ('pass', 'fail'));

-- One open assessment per learner. Folds the dropped
-- one_unresolved_assessment_per_student index onto a column that survives.
CREATE UNIQUE INDEX IF NOT EXISTS one_open_assessment_per_student
    ON public.messages(room_id, user_id)
    WHERE assessment_lifecycle = 'delivered';

DROP FUNCTION IF EXISTS public.cancel_assessment_question_v1(UUID, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.invalidate_assessment_question_v1(UUID, TEXT, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.send_reviewed_tutor_response_v3(UUID, INTEGER, UUID, UUID);
DROP FUNCTION IF EXISTS public.process_assessment_message_v1(UUID, UUID, UUID);

DROP TABLE IF EXISTS private.assessment_question_keys CASCADE;
DROP TABLE IF EXISTS private.assessment_drafts CASCADE;
DROP TABLE IF EXISTS private.assessment_request_results CASCADE;
DROP TABLE IF EXISTS public.assessment_questions CASCADE;

-- post_assessment_message_v1, no longer reading the retry ledger.
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
    v_message messages%ROWTYPE;
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

    INSERT INTO messages (room_id, user_id, content, user_role, is_ai_generated, parent_message_id, assessment_id)
    VALUES (p_room_id, p_actor_id, btrim(p_content), 'tutor', false, p_parent_message_id, p_assessment_id)
    RETURNING * INTO v_message;

    RETURN jsonb_build_object('message', to_jsonb(v_message), 'analysis_pending', false, 'request_id', p_request_id);
END;
$$;

REVOKE ALL ON FUNCTION post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID) TO service_role;

-- send_reviewed_tutor_response_v3. The reviewed payload is passed in because there is no
-- draft table to read it from. Writes the tutor message and stamps the assessment onto it.
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
    IF v_payload IS NULL OR jsonb_typeof(v_payload) <> 'object'
       OR jsonb_typeof(v_payload->'decision') <> 'object'
       OR jsonb_typeof(v_payload->>'response') <> 'string' THEN
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

    -- The public projection is an allowlist. assessment_key is excluded so the normal UI path
    -- never receives it, even though the row is readable by participants.
    RETURN jsonb_build_object(
        'message', (to_jsonb(v_message) - 'assessment_key'),
        'room', to_jsonb(v_room)
    );
END;
$$;

REVOKE ALL ON FUNCTION send_reviewed_tutor_response_v3(JSONB, UUID, UUID, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION send_reviewed_tutor_response_v3(JSONB, UUID, UUID, UUID, UUID, UUID, UUID, UUID) TO service_role;

-- process_assessment_message_v1. Reads the assessment off the tutor message instead of a
-- question table and writes its verdict back there. Every parsing and grading rule from
-- migration 025 is preserved verbatim.
CREATE OR REPLACE FUNCTION process_assessment_message_v1(
    p_message_id UUID,
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
    v_question messages%ROWTYPE;
    v_key TEXT[];
    v_selected TEXT[] := ARRAY[]::TEXT[];
    v_answer TEXT;
    v_option RECORD;
    v_result TEXT;
    v_transition JSONB;
    v_event JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_message FROM messages WHERE id = p_message_id;
    IF NOT FOUND OR v_message.user_id <> p_actor_id OR v_message.user_role <> 'student' THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

    SELECT q.* INTO v_question
    FROM messages q
    WHERE q.room_id = v_message.room_id
      AND q.user_role = 'tutor'
      AND q.assessment_lifecycle IN ('delivered', 'answered')
      AND q.assessment_options IS NOT NULL
      AND (q.id = v_message.assessment_id
           OR q.id = v_message.parent_message_id)
    ORDER BY q.created_at DESC
    LIMIT 1
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ASSESSMENT_NOT_OPEN' USING ERRCODE = 'P0001';
    END IF;
    IF v_question.assessment_lifecycle = 'answered' THEN
        IF v_question.assessment_answer_message_id = p_message_id THEN
            RETURN jsonb_build_object('message_id', v_question.id, 'result', v_question.assessment_result, 'already_processed', true);
        END IF;
        RAISE EXCEPTION 'ASSESSMENT_NOT_OPEN' USING ERRCODE = 'P0001';
    END IF;

    v_key := v_question.assessment_key;
    IF v_key IS NULL THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001'; END IF;

    v_answer := lower(btrim(v_message.content));
    v_answer := replace(replace(v_answer, '，', ','), '、', ',');
    v_answer := regexp_replace(v_answer, '^(answer:|my answer is|i choose|i select|i think|maybe)[[:space:]]*', '', 'i');
    v_answer := split_part(v_answer, E'\n', 1);
    v_answer := split_part(v_answer, ' because ', 1);
    v_answer := split_part(v_answer, ' — ', 1);
    v_answer := regexp_replace(v_answer, '[.!?]+$', '');
    FOR v_option IN SELECT value->>'id' AS id, lower(btrim(value->>'text')) AS text FROM jsonb_array_elements(v_question.assessment_options)
    LOOP
        IF v_answer = v_option.text THEN v_selected := ARRAY[v_option.id]; END IF;
    END LOOP;
    IF cardinality(v_selected) = 0 AND v_answer ~ '^(a|b|c|d)([[:space:]]*(,|;|and|&|\+)[[:space:]]*(a|b|c|d))*$' THEN
        v_selected := ARRAY(
            SELECT DISTINCT upper(btrim(part.token))
            FROM regexp_split_to_table(v_answer, '[[:space:]]*(,|;|and|&|\+)[[:space:]]*') AS part(token)
            WHERE btrim(part.token) <> ''
        );
    END IF;
    IF cardinality(v_selected) = 0 THEN
        RETURN jsonb_build_object('message_id', v_question.id, 'code', 'ANSWER_FORMAT_UNRESOLVED', 'clarification_required', true);
    END IF;

    v_result := CASE
        WHEN cardinality(v_selected) = cardinality(v_key)
         AND v_selected <@ v_key AND v_key <@ v_selected THEN 'pass'
        ELSE 'fail'
    END;

    UPDATE messages
    SET assessment_lifecycle = 'answered',
        assessment_answer_message_id = p_message_id,
        assessment_selected_option_ids = v_selected,
        assessment_result = v_result,
        assessment_closed_at = NOW()
    WHERE id = v_question.id
    RETURNING * INTO v_question;

    v_event := jsonb_build_object(
        'event_id', gen_random_uuid(),
        'dedupe_key', 'assessment:' || v_question.id::TEXT || ':' || p_message_id::TEXT,
        'room_id', v_question.room_id,
        'student_id', p_actor_id,
        'checklist_id', v_question.assessment_checklist_id,
        'item_id', v_question.assessment_item_id,
        'source_message_id', p_message_id,
        'kind', CASE WHEN v_result = 'pass' THEN 'assessment_pass' ELSE 'assessment_fail' END,
        'evidence_text', v_message.content,
        'source_evidence_message_ids', jsonb_build_array(v_question.parent_message_id),
        'assessment_id', v_question.id,
        'classified_by', 'deterministic_grader'
    );
    v_transition := apply_learning_event_v1(v_event);
    RETURN jsonb_build_object(
        'message_id', v_question.id,
        'result', v_result,
        'selected_option_ids', v_selected,
        'transition', v_transition,
        'feedback_required', true
    );
END;
$$;

REVOKE ALL ON FUNCTION process_assessment_message_v1(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_assessment_message_v1(UUID, UUID, UUID) TO service_role;
