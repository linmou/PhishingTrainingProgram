-- Purpose: bring the live project to the lean transfer-assessment schema. Migrations 025 and 027 authored a second assessment pipeline that no product requirement asked for and no caller reaches: a draft reject/regenerate flow with a generation-trigger suppression mechanism, plus columns that are written and never read. This migration removes that surface and leaves exactly the tables, columns, and functions the seven live operations use.
--
-- SAFETY: every transfer table holds zero rows on the hosted project (verified), so no data is at risk. The ALTER TABLE and DROP TABLE statements are idempotent through IF EXISTS. The DROP FUNCTION statements are NOT reliably idempotent: a signature mismatch reads as "does not exist" and silently does nothing, which is how the regenerate_assessment_draft_v1 drop was missed on first application. Migration 033 corrects that specific orphan. Re-running this file is safe for the table changes but must not be relied on to drop functions.
--
-- ORDERING: plpgsql bodies are stored as text and are not dependency-tracked, so DROP COLUMN does not fail on them. The dependent functions are still dropped first so that no window exists in which a stored body references a column that is gone, and the kept functions are re-created at the end with the dropped references removed.
--
-- Boundary: drops only objects introduced by 025-029 that the lean design does not keep. It does not touch messages, rooms, users, session_checklists, checklist_items, coverage_evidence, checklist_updates, or any legacy table. It does not modify the Guard-mode trigger fixes from 030/031, which are unrelated to transfer assessment.

-- ---------------------------------------------------------------------------------------
-- 1. Removed operations. Their callers were the reject/regenerate flow, which the product
--    never required: a draft that is not sent is simply never delivered.
-- ---------------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reject_assessment_draft_v1(UUID, INTEGER, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.regenerate_assessment_draft_v1(UUID, INTEGER, UUID, TEXT, JSONB, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS private.transfer_draft_trigger_key_v1(UUID, UUID, UUID, UUID);

-- Functions that keep their role but must be re-created without the dropped columns.
DROP FUNCTION IF EXISTS public.review_assessment_draft_v1(UUID, INTEGER, JSONB, BOOLEAN, UUID, UUID);
DROP FUNCTION IF EXISTS public.send_reviewed_tutor_response_v3(UUID, INTEGER, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.cancel_assessment_question_v1(UUID, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.invalidate_assessment_question_v1(UUID, TEXT, TEXT, UUID, UUID);

-- ---------------------------------------------------------------------------------------
-- 2. The retry ledger. It existed only so reject/regenerate could replay, and both are gone.
--    The idempotency the product relies on is structural: one unresolved question per
--    learner, and a draft whose status has already left 'draft'.
-- ---------------------------------------------------------------------------------------
DROP TABLE IF EXISTS private.assessment_request_results;

-- ---------------------------------------------------------------------------------------
-- 3. Draft columns. `status` keeps only the values the lean lifecycle can reach; 'rejected'
--    and 'superseded' were reachable only through the removed operations.
-- ---------------------------------------------------------------------------------------
ALTER TABLE private.assessment_drafts DROP CONSTRAINT IF EXISTS assessment_drafts_status_check;
DELETE FROM private.assessment_drafts WHERE status NOT IN ('draft', 'ignored', 'sent');
ALTER TABLE private.assessment_drafts
    ADD CONSTRAINT assessment_drafts_status_check CHECK (status IN ('draft', 'ignored', 'sent'));

DROP INDEX IF EXISTS private.idx_assessment_drafts_one_open_per_trigger;
DROP INDEX IF EXISTS private.idx_assessment_drafts_one_replacement_per_source;
DROP INDEX IF EXISTS private.idx_assessment_drafts_trigger_status;

ALTER TABLE private.assessment_drafts
    DROP COLUMN IF EXISTS trigger_key,
    DROP COLUMN IF EXISTS supersedes_draft_id,
    DROP COLUMN IF EXISTS rejected_reason,
    DROP COLUMN IF EXISTS raw_hash,
    DROP COLUMN IF EXISTS final_hash;

-- ---------------------------------------------------------------------------------------
-- 4. Columns written and never read.
--
--    public_payload_hash was only ever subtracted from returned payloads, never compared.
--    private_payload_hash was never consulted at all.
--    effective_order appears in no function or query in the schema.
--
--    public.assessment_questions itself STAYS. It is load-bearing for the live grading path:
--    process_assessment_message_v1 reads the question, grades against the key, and updates
--    the question result. closed_reason also stays, because cancel and invalidate write it.
-- ---------------------------------------------------------------------------------------
ALTER TABLE public.assessment_questions
    DROP COLUMN IF EXISTS public_payload_hash;

ALTER TABLE private.assessment_question_keys
    DROP COLUMN IF EXISTS private_payload_hash;

ALTER TABLE private.learning_event_inbox
    DROP COLUMN IF EXISTS effective_order;

-- ---------------------------------------------------------------------------------------
-- 5. Re-create the four kept functions without the dropped columns.
--    review: no longer computes final_hash.
--    send:   5-arg signature loses the expected-hash argument, and no longer writes either
--            payload hash. It still writes the question row and the immutable private key,
--            because grading reads them.
--    cancel/invalidate: only change is that they no longer subtract the dropped column.
-- ---------------------------------------------------------------------------------------
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

    v_revision := v_draft.revision + 1;
    UPDATE private.assessment_drafts
    SET reviewed_payload = p_final_payload,
        revision = v_revision,
        reviewed_by = p_actor_id,
        reviewed_at = NOW(),
        content_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_draft_id;
    RETURN jsonb_build_object('draft_id', p_draft_id, 'revision', v_revision);
END;
$$;

REVOKE ALL ON FUNCTION review_assessment_draft_v1(UUID, INTEGER, JSONB, BOOLEAN, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION review_assessment_draft_v1(UUID, INTEGER, JSONB, BOOLEAN, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION send_reviewed_tutor_response_v3(
    p_draft_id UUID,
    p_expected_revision INTEGER,
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
    v_mode TEXT;
    v_instruction TEXT;
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
    IF v_draft.revision <> p_expected_revision
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

    IF v_mode = 'assessment' THEN
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
        INSERT INTO assessment_questions (
            room_id, student_id, checklist_id, item_id, tutor_message_id,
            source_student_message_id, selection_type, stem, rendered_text, options
        ) VALUES (
            v_draft.room_id, v_draft.student_id, v_draft.checklist_id, v_draft.item_id,
            v_message.id, v_draft.focus_student_message_id,
            v_assessment->>'selection_type',
            btrim(COALESCE(v_assessment->>'stem', v_payload->>'response')),
            btrim(v_assessment->>'rendered_text'),
            v_assessment->'options'
        ) RETURNING * INTO v_question;

        INSERT INTO private.assessment_question_keys (
            question_id, correct_option_ids, private_payload,
            source_transfer_basis, teacher_confirmation_id, draft_id, draft_revision,
            source_item_updated_at
        ) VALUES (
            v_question.id,
            ARRAY(SELECT jsonb_array_elements_text(v_assessment->'correct_option_ids')),
            v_assessment,
            v_assessment->'transfer_basis', p_actor_id, v_draft.id, v_draft.revision,
            (SELECT updated_at FROM checklist_items WHERE id = v_draft.item_id)
        );
        UPDATE messages SET assessment_id = v_question.id WHERE id = v_message.id RETURNING * INTO v_message;
    END IF;

    UPDATE rooms
    SET active_response_mode = CASE WHEN v_mode = 'guard' THEN 'guard'::tutor_response_mode ELSE 'tutoring'::tutor_response_mode END,
        mode_changed_at = NOW(), mode_change_source = 'reviewed_response'
    WHERE id = v_room.id;
    UPDATE private.assessment_drafts SET status = 'sent', updated_at = NOW() WHERE id = v_draft.id;

    RETURN jsonb_build_object(
        'message', to_jsonb(v_message),
        'question', CASE WHEN v_mode = 'assessment' THEN to_jsonb(v_question) ELSE NULL END,
        'room', to_jsonb(v_room)
    );
END;
$$;

REVOKE ALL ON FUNCTION send_reviewed_tutor_response_v3(UUID, INTEGER, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION send_reviewed_tutor_response_v3(UUID, INTEGER, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION cancel_assessment_question_v1(
    p_question_id UUID,
    p_reason TEXT,
    p_actor_id UUID,
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_question assessment_questions%ROWTYPE;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
    SELECT q.* INTO v_question
    FROM assessment_questions q JOIN rooms r ON r.id = q.room_id
    WHERE q.id = p_question_id AND r.tutor_id = p_actor_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
    IF v_question.lifecycle = 'delivered' THEN
        UPDATE assessment_questions
        SET lifecycle = 'cancelled', closed_reason = p_reason, closed_at = NOW()
        WHERE id = p_question_id RETURNING * INTO v_question;
    END IF;
    RETURN jsonb_build_object('question', to_jsonb(v_question));
END;
$$;

REVOKE ALL ON FUNCTION cancel_assessment_question_v1(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_assessment_question_v1(UUID, TEXT, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION invalidate_assessment_question_v1(
    p_question_id UUID,
    p_reason TEXT,
    p_expected_snapshot TEXT,
    p_actor_id UUID,
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_question assessment_questions%ROWTYPE;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
    SELECT q.* INTO v_question
    FROM assessment_questions q JOIN rooms r ON r.id = q.room_id
    WHERE q.id = p_question_id AND r.tutor_id = p_actor_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
    IF p_expected_snapshot IS NULL OR p_expected_snapshot = '' THEN
        RAISE EXCEPTION 'STALE_SNAPSHOT' USING ERRCODE = 'P0001';
    END IF;
    UPDATE assessment_questions
    SET lifecycle = 'invalidated', closed_reason = p_reason, closed_at = NOW()
    WHERE id = p_question_id RETURNING * INTO v_question;
    RETURN jsonb_build_object('question', to_jsonb(v_question), 'reconciled', false);
END;
$$;

REVOKE ALL ON FUNCTION invalidate_assessment_question_v1(UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION invalidate_assessment_question_v1(UUID, TEXT, TEXT, UUID, UUID) TO service_role;
