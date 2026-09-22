-- Purpose: close the component 102 draft-disposition gap. Migration 025 authored the transfer storage, review, send, and lifecycle RPCs but omitted the reject and regenerate draft operations that reconciliation item R04 requires; this migration adds the storage they need and both functions, idempotently and without touching any already-applied object.
--
-- Boundary: no public question, message, key, evidence, progress, or room-participation write happens here. Both functions are service_role only and record their result in private.assessment_request_results.

-- 1. Storage the R04 contract requires but migration 025 never authored.
--    supersedes_draft_id: links one replacement draft to its source.
--    trigger_key: the generation-trigger identity derived from stored scope
--    (room, student, checklist, item, focus message) so a rejected trigger can
--    be detected later without re-deriving it from mutable rows.
ALTER TABLE private.assessment_drafts
    ADD COLUMN IF NOT EXISTS supersedes_draft_id UUID REFERENCES private.assessment_drafts(id) ON DELETE RESTRICT;
ALTER TABLE private.assessment_drafts
    ADD COLUMN IF NOT EXISTS trigger_key TEXT;
ALTER TABLE private.assessment_drafts
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- A source draft may have at most one replacement.
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_drafts_one_replacement_per_source
    ON private.assessment_drafts(supersedes_draft_id)
    WHERE supersedes_draft_id IS NOT NULL;

-- One live draft per generation trigger: a draft in 'draft' status blocks a second
-- draft for the same trigger, which is the same-trigger suppression R04 requires.
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_drafts_one_open_per_trigger
    ON private.assessment_drafts(trigger_key)
    WHERE trigger_key IS NOT NULL AND status = 'draft';

CREATE INDEX IF NOT EXISTS idx_assessment_drafts_trigger_status
    ON private.assessment_drafts(trigger_key, status);

-- 2. Derive the generation-trigger key from the STABLE scope both callers can see.
--    It deliberately excludes item_id and assessment_id: reject sees the draft's
--    checklist item while prepare_transfer_turn_v1 sees only the message, so any
--    item- or assessment-derived component would make the two derivations disagree
--    and suppression would never match.
CREATE OR REPLACE FUNCTION private.transfer_draft_trigger_key_v1(
    p_room_id UUID,
    p_student_id UUID,
    p_checklist_id UUID,
    p_focus_student_message_id UUID
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT left(
        encode(
            digest(
                convert_to(
                    concat_ws('|',
                        COALESCE(p_room_id::TEXT, ''),
                        COALESCE(p_student_id::TEXT, ''),
                        COALESCE(p_checklist_id::TEXT, ''),
                        COALESCE(p_focus_student_message_id::TEXT, '')
                    ),
                    'UTF8'
                ),
                'sha256'
            ),
            'hex'
        ),
        40
    );
$$;

REVOKE ALL ON FUNCTION private.transfer_draft_trigger_key_v1(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- 3. reject_assessment_draft_v1
CREATE OR REPLACE FUNCTION reject_assessment_draft_v1(
    p_draft_id UUID,
    p_expected_revision INTEGER,
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
    v_draft private.assessment_drafts%ROWTYPE;
    v_existing JSONB;
    v_trigger_key TEXT;
    v_response JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    SELECT response INTO v_existing
    FROM private.assessment_request_results
    WHERE operation = 'reject_draft' AND request_id = p_request_id AND actor_id = p_actor_id;
    IF FOUND THEN RETURN v_existing; END IF;

    IF p_reason IS DISTINCT FROM 'teacher_rejected' THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_draft FROM private.assessment_drafts
    WHERE id = p_draft_id
    FOR UPDATE;
    IF NOT FOUND OR v_draft.room_id NOT IN (SELECT id FROM rooms WHERE tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_draft.status <> 'draft' THEN
        RAISE EXCEPTION 'DRAFT_NOT_REJECTABLE' USING ERRCODE = 'P0001';
    END IF;
    IF v_draft.revision <> p_expected_revision THEN
        RAISE EXCEPTION 'DRAFT_REVISION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;

    v_trigger_key := private.transfer_draft_trigger_key_v1(
        v_draft.room_id, v_draft.student_id, v_draft.checklist_id,
        v_draft.focus_student_message_id
    );

    UPDATE private.assessment_drafts
    SET status = 'rejected',
        rejected_reason = p_reason,
        trigger_key = v_trigger_key,
        updated_at = NOW()
    WHERE id = p_draft_id;

    v_response := jsonb_build_object(
        'draft_id', p_draft_id,
        'revision', v_draft.revision,
        'status', 'rejected',
        'same_trigger_suppressed', true,
        'request_id', p_request_id
    );
    INSERT INTO private.assessment_request_results(operation, request_id, actor_id, response)
    VALUES ('reject_draft', p_request_id, p_actor_id, v_response);
    RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION reject_assessment_draft_v1(UUID, INTEGER, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reject_assessment_draft_v1(UUID, INTEGER, TEXT, UUID, UUID) TO service_role;

-- 4. regenerate_assessment_draft_v1
--    The provider call happens in the Edge Function before this RPC; the RPC only
--    commits the source supersession and the replacement draft atomically.
CREATE OR REPLACE FUNCTION regenerate_assessment_draft_v1(
    p_source_draft_id UUID,
    p_expected_revision INTEGER,
    p_expected_snapshot_hash TEXT,
    p_provider_payload JSONB,
    p_raw_hash TEXT,
    p_actor_id UUID,
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_source private.assessment_drafts%ROWTYPE;
    v_replacement private.assessment_drafts%ROWTYPE;
    v_existing JSONB;
    v_trigger_key TEXT;
    v_response JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    SELECT response INTO v_existing
    FROM private.assessment_request_results
    WHERE operation = 'regenerate_draft' AND request_id = p_request_id AND actor_id = p_actor_id;
    IF FOUND THEN RETURN v_existing; END IF;

    SELECT * INTO v_source FROM private.assessment_drafts
    WHERE id = p_source_draft_id
    FOR UPDATE;
    IF NOT FOUND OR v_source.room_id NOT IN (SELECT id FROM rooms WHERE tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    -- A sent or already-superseded source can never be regenerated.
    IF v_source.status NOT IN ('draft', 'rejected', 'ignored') THEN
        RAISE EXCEPTION 'DRAFT_NOT_REGENERABLE' USING ERRCODE = 'P0001';
    END IF;
    IF v_source.revision <> p_expected_revision THEN
        RAISE EXCEPTION 'DRAFT_REVISION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF p_expected_snapshot_hash IS NULL
       OR p_expected_snapshot_hash <> COALESCE(v_source.raw_hash, '') THEN
        RAISE EXCEPTION 'DRAFT_SNAPSHOT_STALE' USING ERRCODE = 'P0001';
    END IF;
    IF p_provider_payload IS NULL
       OR jsonb_typeof(p_provider_payload) <> 'object'
       OR p_raw_hash IS NULL OR btrim(p_raw_hash) = '' THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;

    v_trigger_key := COALESCE(
        v_source.trigger_key,
        private.transfer_draft_trigger_key_v1(
            v_source.room_id, v_source.student_id, v_source.checklist_id,
            v_source.focus_student_message_id
        )
    );

    UPDATE private.assessment_drafts
    SET status = 'superseded',
        trigger_key = v_trigger_key,
        updated_at = NOW()
    WHERE id = p_source_draft_id;

    INSERT INTO private.assessment_drafts(
        room_id, student_id, checklist_id, item_id, focus_student_message_id,
        raw_model_output, revision, raw_hash, status, trigger_key, supersedes_draft_id
    ) VALUES (
        v_source.room_id, v_source.student_id, v_source.checklist_id, v_source.item_id,
        v_source.focus_student_message_id, p_provider_payload, 1, p_raw_hash, 'draft',
        v_trigger_key, p_source_draft_id
    ) RETURNING * INTO v_replacement;

    v_response := jsonb_build_object(
        'source_draft_id', p_source_draft_id,
        'source_status', 'superseded',
        'replacement_draft_id', v_replacement.id,
        'replacement_revision', v_replacement.revision,
        'replacement_status', 'draft',
        'request_id', p_request_id
    );
    INSERT INTO private.assessment_request_results(operation, request_id, actor_id, response)
    VALUES ('regenerate_draft', p_request_id, p_actor_id, v_response);
    RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION regenerate_assessment_draft_v1(UUID, INTEGER, TEXT, JSONB, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION regenerate_assessment_draft_v1(UUID, INTEGER, TEXT, JSONB, TEXT, UUID, UUID) TO service_role;

-- 5. prepare_transfer_turn_v1 must refuse to generate for a rejected trigger.
--    Re-authored here only to add the suppression check; the provider boundary and
--    every earlier check are preserved unchanged.
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
    v_trigger_key TEXT;
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

    v_trigger_key := private.transfer_draft_trigger_key_v1(
        p_room_id,
        v_message.user_id,
        p_checklist_id,
        p_focus_student_message_id
    );

    IF EXISTS (
        SELECT 1 FROM private.assessment_drafts
        WHERE trigger_key = v_trigger_key AND status = 'rejected'
    ) THEN
        RAISE EXCEPTION 'DRAFT_TRIGGER_SUPPRESSED' USING ERRCODE = 'P0001';
    END IF;

    -- Model generation belongs in the trusted Edge Function/provider adapter.
    -- Returning this explicit error avoids fabricating a question or exposing a key.
    RAISE EXCEPTION 'AI_PROVIDER_NOT_CONFIGURED' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION prepare_transfer_turn_v1(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prepare_transfer_turn_v1(UUID, UUID, UUID, UUID, UUID) TO service_role;
