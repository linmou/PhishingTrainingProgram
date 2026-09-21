-- Purpose: fix the same latent runtime defect that migration 028 fixed for the draft trigger key, in the two remaining callers inherited from migration 025. `review_assessment_draft_v1` and `send_reviewed_tutor_response_v3` both set `search_path = public, private`, but pgcrypto is installed in the `extensions` schema on the hosted project, so their unqualified `digest(...)` calls raise `function digest(bytea, unknown) does not exist` at runtime. This is the tutor review-and-send path, so the defect breaks the primary workflow rather than an edge case.
--
-- Boundary: no schema, storage, grant, or policy change. Both functions are re-created with identical bodies except for the schema-qualified `extensions.digest` call. Signatures, SECURITY DEFINER, search_path, return shapes, and privileges are unchanged.

CREATE OR REPLACE FUNCTION review_assessment_draft_v1(
    p_draft_id UUID,
    p_expected_revision INTEGER,
    p_final_payload JSONB,
    p_content_confirmed BOOLEAN,
    p_actor_id UUID,
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_draft private.assessment_drafts%ROWTYPE;
    v_assessment JSONB;
    v_options JSONB;
    v_keys JSONB;
    v_hash TEXT;
    v_revision INTEGER;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_draft FROM private.assessment_drafts
    WHERE id = p_draft_id
    FOR UPDATE;
    IF NOT FOUND OR v_draft.room_id NOT IN (SELECT id FROM rooms WHERE tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_draft.revision <> p_expected_revision THEN
        RAISE EXCEPTION 'DRAFT_REVISION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF p_final_payload IS NULL OR jsonb_typeof(p_final_payload) <> 'object'
       OR jsonb_typeof(p_final_payload->'decision') <> 'object'
       OR jsonb_typeof(p_final_payload->'response') <> 'string' THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;

    IF p_final_payload->'decision'->>'mode' = 'assessment' THEN
        v_assessment := p_final_payload->'assessment';
        IF jsonb_typeof(v_assessment) <> 'object'
           OR jsonb_typeof(v_assessment->'options') <> 'array'
           OR jsonb_typeof(v_assessment->'correct_option_ids') <> 'array'
           OR jsonb_typeof(v_assessment->'transfer_basis') <> 'object'
           OR jsonb_typeof(v_assessment->'transfer_basis'->'source_evidence_message_ids') <> 'array' THEN
            RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
        END IF;
        v_options := v_assessment->'options';
        v_keys := v_assessment->'correct_option_ids';
        IF p_final_payload->'decision'->>'instruction' <> 'transfer_assess'
           OR jsonb_array_length(v_options) <> 4
           OR v_options->0->>'id' <> 'A' OR v_options->1->>'id' <> 'B'
           OR v_options->2->>'id' <> 'C' OR v_options->3->>'id' <> 'D'
           OR EXISTS (
               SELECT 1 FROM jsonb_array_elements(v_options) AS option_row
               WHERE btrim(COALESCE(option_row->>'text', '')) = ''
           )
           OR (SELECT COUNT(DISTINCT lower(btrim(option_row->>'text'))) FROM jsonb_array_elements(v_options) AS option_row) <> 4
           OR jsonb_array_length(v_keys) < 1 OR jsonb_array_length(v_keys) > 3
           OR EXISTS (
               SELECT 1 FROM jsonb_array_elements_text(v_keys) AS key_id
               WHERE key_id NOT IN ('A', 'B', 'C', 'D')
           )
           OR (SELECT COUNT(DISTINCT key_id) FROM jsonb_array_elements_text(v_keys) AS key_id) <> jsonb_array_length(v_keys)
           OR ((v_assessment->>'selection_type' = 'single') AND jsonb_array_length(v_keys) <> 1)
           OR ((v_assessment->>'selection_type' = 'multiple') AND jsonb_array_length(v_keys) NOT BETWEEN 2 AND 3)
           OR v_assessment->>'selection_type' NOT IN ('single', 'multiple')
           OR btrim(COALESCE(v_assessment->'transfer_basis'->>'concept_rule', '')) = ''
           OR btrim(COALESCE(v_assessment->'transfer_basis'->>'source_context', '')) = ''
           OR btrim(COALESCE(v_assessment->'transfer_basis'->>'changed_context', '')) = ''
           OR jsonb_array_length(v_assessment->'transfer_basis'->'source_evidence_message_ids') = 0 THEN
            RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
        END IF;
    ELSIF p_final_payload->'decision'->>'mode' NOT IN ('tutoring', 'guard') THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT p_content_confirmed THEN
        RAISE EXCEPTION 'CONTENT_CONFIRMATION_REQUIRED' USING ERRCODE = 'P0001';
    END IF;

    v_hash := encode(extensions.digest(convert_to(p_final_payload::TEXT, 'UTF8'), 'sha256'), 'hex');
    v_revision := v_draft.revision + 1;
    UPDATE private.assessment_drafts
    SET reviewed_payload = p_final_payload,
        revision = v_revision,
        final_hash = v_hash,
        reviewed_by = p_actor_id,
        reviewed_at = NOW(),
        content_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_draft_id;
    RETURN jsonb_build_object('draft_id', p_draft_id, 'revision', v_revision, 'final_hash', v_hash);
END;
$$;

REVOKE ALL ON FUNCTION review_assessment_draft_v1(UUID, INTEGER, JSONB, BOOLEAN, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION review_assessment_draft_v1(UUID, INTEGER, JSONB, BOOLEAN, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION send_reviewed_tutor_response_v3(
    p_draft_id UUID,
    p_expected_revision INTEGER,
    p_expected_hash TEXT,
    p_actor_id UUID,
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_draft private.assessment_drafts%ROWTYPE;
    v_payload JSONB;
    v_decision JSONB;
    v_assessment JSONB;
    v_message messages%ROWTYPE;
    v_question assessment_questions%ROWTYPE;
    v_room rooms%ROWTYPE;
    v_feedback ai_suggestion_feedback%ROWTYPE;
    v_mode TEXT;
    v_instruction TEXT;
    v_question_options JSONB;
    v_private_hash TEXT;
    v_response JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_draft FROM private.assessment_drafts
    WHERE id = p_draft_id FOR UPDATE;
    IF NOT FOUND OR v_draft.reviewed_by IS NULL OR v_draft.reviewed_by <> p_actor_id
       OR NOT EXISTS (SELECT 1 FROM rooms WHERE id = v_draft.room_id AND tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_draft.status <> 'draft' THEN
        RAISE EXCEPTION 'DRAFT_ALREADY_SENT' USING ERRCODE = '40901';
    END IF;
    IF v_draft.revision <> p_expected_revision OR v_draft.final_hash IS DISTINCT FROM p_expected_hash
       OR v_draft.reviewed_payload IS NULL OR v_draft.content_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'DRAFT_REVISION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;

    v_payload := v_draft.reviewed_payload;
    v_decision := v_payload->'decision';
    v_mode := v_decision->>'mode';
    v_instruction := v_decision->>'instruction';
    IF v_mode NOT IN ('tutoring', 'guard', 'assessment') THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
    IF v_mode = 'assessment' AND (v_instruction <> 'transfer_assess' OR v_payload->>'response' IS NULL) THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_room FROM rooms WHERE id = v_draft.room_id FOR UPDATE;
    INSERT INTO messages (
        room_id, user_id, content, user_role, is_ai_generated,
        parent_message_id, response_mode
    ) VALUES (
        v_draft.room_id, p_actor_id, btrim(v_payload->>'response'), 'tutor', true,
        v_draft.focus_student_message_id,
        v_mode::tutor_turn_mode
    ) RETURNING * INTO v_message;

    IF v_mode = 'assessment' THEN
        v_assessment := v_payload->'assessment';
        IF v_draft.student_id IS NULL OR v_draft.checklist_id IS NULL OR v_draft.item_id IS NULL
           OR v_draft.focus_student_message_id IS NULL
           OR NOT EXISTS (
               SELECT 1 FROM session_checklists
               WHERE id = v_draft.checklist_id AND room_id = v_draft.room_id
                 AND student_id = v_draft.student_id AND progress_policy_version = 'transfer_v1'
           )
           OR NOT EXISTS (
               SELECT 1 FROM messages
               WHERE id = v_draft.focus_student_message_id
                 AND room_id = v_draft.room_id AND user_id = v_draft.student_id
                 AND user_role = 'student'
           ) THEN
            RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
        END IF;
        v_question_options := v_assessment->'options';
        INSERT INTO assessment_questions (
            room_id, student_id, checklist_id, item_id, tutor_message_id,
            source_student_message_id, selection_type, stem, rendered_text,
            options, public_payload_hash
        ) VALUES (
            v_draft.room_id, v_draft.student_id, v_draft.checklist_id, v_draft.item_id,
            v_message.id, v_draft.focus_student_message_id,
            v_assessment->>'selection_type',
            btrim(COALESCE(v_assessment->>'stem', v_payload->>'response')),
            btrim(v_assessment->>'rendered_text'),
            v_question_options,
            encode(extensions.digest(convert_to((v_assessment - 'correct_option_ids' - 'transfer_basis')::TEXT, 'UTF8'), 'sha256'), 'hex')
        ) RETURNING * INTO v_question;

        INSERT INTO private.assessment_question_keys (
            question_id, correct_option_ids, private_payload, private_payload_hash,
            source_transfer_basis, teacher_confirmation_id, draft_id, draft_revision,
            source_item_updated_at
        ) VALUES (
            v_question.id,
            ARRAY(SELECT jsonb_array_elements_text(v_assessment->'correct_option_ids')),
            v_assessment,
            encode(extensions.digest(convert_to(v_assessment::TEXT, 'UTF8'), 'sha256'), 'hex'),
            v_assessment->'transfer_basis', p_actor_id, v_draft.id, v_draft.revision,
            (SELECT updated_at FROM checklist_items WHERE id = v_draft.item_id)
        );
        UPDATE messages SET assessment_id = v_question.id WHERE id = v_message.id RETURNING * INTO v_message;
    END IF;

    INSERT INTO ai_suggestion_feedback (
        room_id, tutor_id, parent_message_id, ai_suggestion, tutor_action,
        tutor_final_response, tutor_message_id, response_time_ms, context_messages,
        raw_mode, raw_instruction, mode_reason, final_mode, mode_rectified,
        contract_version, final_instruction, assessment_id
    ) VALUES (
        v_draft.room_id, p_actor_id, v_draft.focus_student_message_id,
        COALESCE(v_draft.raw_model_output->>'response', v_payload->>'response'), 'accepted',
        btrim(v_payload->>'response'), v_message.id, NULL, NULL,
        (v_draft.raw_model_output->'decision'->>'mode')::tutor_turn_mode,
        v_draft.raw_model_output->'decision'->>'instruction',
        v_draft.raw_model_output->>'reason', v_mode::tutor_turn_mode,
        (v_draft.raw_model_output->'decision'->>'mode') IS DISTINCT FROM v_mode,
        'v3', v_instruction, NULLIF(v_question.id::TEXT, '')::UUID
    ) RETURNING * INTO v_feedback;

    UPDATE rooms
    SET active_response_mode = CASE WHEN v_mode = 'guard' THEN 'guard'::tutor_response_mode ELSE 'tutoring'::tutor_response_mode END,
        mode_changed_at = NOW(), mode_change_source = 'reviewed_response'
    WHERE id = v_room.id;
    UPDATE private.assessment_drafts SET status = 'sent', updated_at = NOW() WHERE id = v_draft.id;

    v_response := jsonb_build_object(
        'message', to_jsonb(v_message),
        'question', CASE WHEN v_mode = 'assessment' THEN
            (to_jsonb(v_question) - 'public_payload_hash')
            ELSE NULL END,
        'room', to_jsonb(v_room),
        'feedback_id', v_feedback.id
    );
    RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION send_reviewed_tutor_response_v3(UUID, INTEGER, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION send_reviewed_tutor_response_v3(UUID, INTEGER, TEXT, UUID, UUID) TO service_role;
