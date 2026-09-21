BEGIN;

-- Purpose: add forward-only transfer-assessment storage, mode separation,
-- idempotency, and trusted transaction boundaries in one Dashboard transaction.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tutor_turn_mode') THEN
        CREATE TYPE tutor_turn_mode AS ENUM ('tutoring', 'guard', 'assessment');
    END IF;
END $$;

ALTER TABLE session_checklists
    ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS progress_policy_version TEXT NOT NULL DEFAULT 'legacy_v1';

ALTER TABLE session_checklists
    DROP CONSTRAINT IF EXISTS session_checklists_policy_version_check;
ALTER TABLE session_checklists
    ADD CONSTRAINT session_checklists_policy_version_check
    CHECK (
        progress_policy_version = 'legacy_v1'
        OR (progress_policy_version = 'transfer_v1' AND student_id IS NOT NULL)
    );

-- The hosted baseline only permits three states, while the transfer event
-- reducer legitimately writes needs_review after a contradiction or failed
-- assessment. Replace the constraint before creating the trusted event RPC.
ALTER TABLE checklist_items
    DROP CONSTRAINT IF EXISTS checklist_items_status_check;
ALTER TABLE checklist_items
    ADD CONSTRAINT checklist_items_status_check
    CHECK (status IN ('pending', 'partially_covered', 'covered', 'needs_review'));

-- The legacy room-wide read policies would otherwise expose one learner's
-- transfer checklist to every participant in the room. Preserve legacy room
-- reads, but make transfer reads owner-or-tutor scoped.
DROP POLICY IF EXISTS "Allow all operations on session_checklists" ON session_checklists;
DROP POLICY IF EXISTS "Users can view checklists for rooms they have access to" ON session_checklists;
CREATE POLICY "Users can view checklists for rooms they have access to" ON session_checklists
    FOR SELECT USING (
        (
            progress_policy_version = 'legacy_v1'
            AND room_id IN (
                SELECT id FROM rooms WHERE tutor_id = auth.uid()
                UNION
                SELECT room_id FROM sessions WHERE student_id = auth.uid() OR tutor_id = auth.uid()
            )
        )
        OR (
            progress_policy_version = 'transfer_v1'
            AND (student_id = auth.uid() OR room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Allow all operations on checklist_items" ON checklist_items;
DROP POLICY IF EXISTS "Users can view non-deleted checklist items for accessible rooms" ON checklist_items;
DROP POLICY IF EXISTS "Users can view checklist items for accessible rooms" ON checklist_items;
CREATE POLICY "Users can view checklist items for accessible rooms" ON checklist_items
    FOR SELECT USING (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            WHERE (
                sc.progress_policy_version = 'legacy_v1'
                AND sc.room_id IN (
                    SELECT id FROM rooms WHERE tutor_id = auth.uid()
                    UNION
                    SELECT room_id FROM sessions WHERE student_id = auth.uid() OR tutor_id = auth.uid()
                )
            )
            OR (
                sc.progress_policy_version = 'transfer_v1'
                AND (sc.student_id = auth.uid() OR sc.room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid()))
            )
        )
    );

DROP POLICY IF EXISTS "Allow all operations on coverage_evidence" ON coverage_evidence;
DROP POLICY IF EXISTS "Users can view evidence for accessible checklist items" ON coverage_evidence;
CREATE POLICY "Users can view evidence for accessible checklist items" ON coverage_evidence
    FOR SELECT USING (
        item_id IN (
            SELECT ci.id FROM checklist_items ci
            JOIN session_checklists sc ON ci.checklist_id = sc.id
            WHERE (
                sc.progress_policy_version = 'legacy_v1'
                AND sc.room_id IN (
                    SELECT id FROM rooms WHERE tutor_id = auth.uid()
                    UNION
                    SELECT room_id FROM sessions WHERE student_id = auth.uid() OR tutor_id = auth.uid()
                )
            )
            OR (
                sc.progress_policy_version = 'transfer_v1'
                AND (sc.student_id = auth.uid() OR sc.room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid()))
            )
        )
    );

DROP POLICY IF EXISTS "Allow all operations on checklist_updates" ON checklist_updates;
DROP POLICY IF EXISTS "Users can view updates for accessible checklists" ON checklist_updates;
CREATE POLICY "Users can view updates for accessible checklists" ON checklist_updates
    FOR SELECT USING (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            WHERE (
                sc.progress_policy_version = 'legacy_v1'
                AND sc.room_id IN (
                    SELECT id FROM rooms WHERE tutor_id = auth.uid()
                    UNION
                    SELECT room_id FROM sessions WHERE student_id = auth.uid() OR tutor_id = auth.uid()
                )
            )
            OR (
                sc.progress_policy_version = 'transfer_v1'
                AND (sc.student_id = auth.uid() OR sc.room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid()))
            )
        )
    );

-- Keep the established tutor workflow working for legacy room-wide
-- checklists. Transfer-policy rows deliberately have no browser write policy:
-- they can only be changed by the trusted RPCs below.
DROP POLICY IF EXISTS "Tutors can manage legacy checklists" ON session_checklists;
CREATE POLICY "Tutors can manage legacy checklists" ON session_checklists
    FOR ALL TO authenticated
    USING (
        progress_policy_version = 'legacy_v1'
        AND room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid())
    )
    WITH CHECK (
        progress_policy_version = 'legacy_v1'
        AND room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid())
    );

DROP POLICY IF EXISTS "Tutors can manage legacy checklist items" ON checklist_items;
CREATE POLICY "Tutors can manage legacy checklist items" ON checklist_items
    FOR ALL TO authenticated
    USING (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            JOIN rooms r ON r.id = sc.room_id
            WHERE sc.progress_policy_version = 'legacy_v1' AND r.tutor_id = auth.uid()
        )
    )
    WITH CHECK (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            JOIN rooms r ON r.id = sc.room_id
            WHERE sc.progress_policy_version = 'legacy_v1' AND r.tutor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tutors can manage legacy coverage evidence" ON coverage_evidence;
CREATE POLICY "Tutors can manage legacy coverage evidence" ON coverage_evidence
    FOR ALL TO authenticated
    USING (
        item_id IN (
            SELECT ci.id FROM checklist_items ci
            JOIN session_checklists sc ON sc.id = ci.checklist_id
            JOIN rooms r ON r.id = sc.room_id
            WHERE sc.progress_policy_version = 'legacy_v1' AND r.tutor_id = auth.uid()
        )
    )
    WITH CHECK (
        item_id IN (
            SELECT ci.id FROM checklist_items ci
            JOIN session_checklists sc ON sc.id = ci.checklist_id
            JOIN rooms r ON r.id = sc.room_id
            WHERE sc.progress_policy_version = 'legacy_v1' AND r.tutor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tutors can manage legacy checklist updates" ON checklist_updates;
CREATE POLICY "Tutors can manage legacy checklist updates" ON checklist_updates
    FOR ALL TO authenticated
    USING (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            JOIN rooms r ON r.id = sc.room_id
            WHERE sc.progress_policy_version = 'legacy_v1' AND r.tutor_id = auth.uid()
        )
    )
    WITH CHECK (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            JOIN rooms r ON r.id = sc.room_id
            WHERE sc.progress_policy_version = 'legacy_v1' AND r.tutor_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_session_checklists_student_policy
    ON session_checklists(room_id, student_id, progress_policy_version, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_transfer_checklist_per_student
    ON session_checklists(room_id, student_id)
    WHERE is_active = true AND progress_policy_version = 'transfer_v1' AND student_id IS NOT NULL;

ALTER TABLE messages
    ALTER COLUMN response_mode TYPE tutor_turn_mode
    USING response_mode::text::tutor_turn_mode;

ALTER TABLE ai_suggestion_feedback
    ALTER COLUMN raw_mode TYPE tutor_turn_mode
    USING raw_mode::text::tutor_turn_mode,
    ALTER COLUMN final_mode TYPE tutor_turn_mode
    USING final_mode::text::tutor_turn_mode;

ALTER TABLE ai_suggestion_feedback
    ADD COLUMN IF NOT EXISTS raw_instruction TEXT,
    ADD COLUMN IF NOT EXISTS contract_version TEXT,
    ADD COLUMN IF NOT EXISTS final_instruction TEXT,
    ADD COLUMN IF NOT EXISTS assessment_id UUID;

-- Existing feedback rows predate raw_instruction. NOT VALID retains them
-- while requiring a raw instruction for every new non-Guard decision.
ALTER TABLE ai_suggestion_feedback
    DROP CONSTRAINT IF EXISTS ai_suggestion_feedback_raw_instruction_mode_check,
    ADD CONSTRAINT ai_suggestion_feedback_raw_instruction_mode_check CHECK (
        raw_mode IS NULL OR raw_instruction IS NOT NULL OR raw_mode = 'guard'
    ) NOT VALID;

ALTER TABLE ai_suggestion_feedback
    DROP CONSTRAINT IF EXISTS ai_suggestion_feedback_raw_instruction_value_check,
    ADD CONSTRAINT ai_suggestion_feedback_raw_instruction_value_check CHECK (
        raw_instruction IS NULL OR raw_instruction IN (
            'protective_instruction', 'correction', 'scaffolding',
            'explanation', 'consolidation', 'transfer_assess', 'guard'
        )
    );

ALTER TABLE checklist_updates
    ADD COLUMN IF NOT EXISTS event_id UUID,
    ADD COLUMN IF NOT EXISTS assessment_id UUID;
ALTER TABLE coverage_evidence
    ADD COLUMN IF NOT EXISTS event_id UUID,
    ADD COLUMN IF NOT EXISTS assessment_id UUID;

CREATE OR REPLACE FUNCTION private_transfer_item_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    policy TEXT;
    old_policy TEXT;
    checklist_id UUID;
BEGIN
    checklist_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.checklist_id ELSE NEW.checklist_id END;
    SELECT progress_policy_version INTO policy
    FROM session_checklists
    WHERE id = checklist_id;
    IF TG_OP <> 'INSERT' THEN
        SELECT progress_policy_version INTO old_policy
        FROM session_checklists
        WHERE id = OLD.checklist_id;
    END IF;

    IF policy = 'transfer_v1' OR old_policy = 'transfer_v1' THEN
        IF TG_OP = 'DELETE' THEN
            IF current_setting('app.transfer_operation', true) <> 'on' THEN
                RAISE EXCEPTION 'TRANSFER_ITEM_WRITE_REQUIRED' USING ERRCODE = '42501';
            END IF;
        ELSE
            IF NEW.status = 'pending' AND NEW.understanding_level <> 'none'
               OR NEW.status IN ('partially_covered', 'needs_review') AND NEW.understanding_level <> 'basic'
               OR NEW.status = 'covered' AND NEW.understanding_level <> 'good' THEN
                RAISE EXCEPTION 'INVALID_STATE_PAIR' USING ERRCODE = '23514';
            END IF;
            IF TG_OP = 'INSERT'
               OR NEW.status IS DISTINCT FROM OLD.status
               OR NEW.understanding_level IS DISTINCT FROM OLD.understanding_level
               OR NEW.attempts_count IS DISTINCT FROM OLD.attempts_count THEN
                IF current_setting('app.transfer_operation', true) <> 'on' THEN
                    RAISE EXCEPTION 'TRANSFER_ITEM_WRITE_REQUIRED' USING ERRCODE = '42501';
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION private_transfer_checklist_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    policy TEXT;
BEGIN
    policy := CASE WHEN TG_OP = 'DELETE' THEN OLD.progress_policy_version ELSE NEW.progress_policy_version END;
    IF (policy = 'transfer_v1' OR (TG_OP <> 'INSERT' AND OLD.progress_policy_version = 'transfer_v1'))
       AND current_setting('app.transfer_operation', true) <> 'on' THEN
        RAISE EXCEPTION 'TRANSFER_CHECKLIST_WRITE_REQUIRED' USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_transfer_checklist_state ON session_checklists;
CREATE TRIGGER enforce_transfer_checklist_state
BEFORE INSERT OR UPDATE OR DELETE ON session_checklists
FOR EACH ROW EXECUTE FUNCTION private_transfer_checklist_guard();

CREATE OR REPLACE FUNCTION private_transfer_evidence_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    policy TEXT;
    old_policy TEXT;
    item_id UUID;
BEGIN
    item_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.item_id ELSE NEW.item_id END;
    SELECT sc.progress_policy_version INTO policy
    FROM checklist_items ci
    JOIN session_checklists sc ON sc.id = ci.checklist_id
    WHERE ci.id = item_id;
    IF TG_OP <> 'INSERT' THEN
        SELECT sc.progress_policy_version INTO old_policy
        FROM checklist_items ci
        JOIN session_checklists sc ON sc.id = ci.checklist_id
        WHERE ci.id = OLD.item_id;
    END IF;
    IF (policy = 'transfer_v1' OR old_policy = 'transfer_v1')
       AND current_setting('app.transfer_operation', true) <> 'on' THEN
        RAISE EXCEPTION 'TRANSFER_EVIDENCE_WRITE_REQUIRED' USING ERRCODE = '42501';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS enforce_transfer_evidence_state ON coverage_evidence;
CREATE TRIGGER enforce_transfer_evidence_state
BEFORE INSERT OR UPDATE OR DELETE ON coverage_evidence
FOR EACH ROW EXECUTE FUNCTION private_transfer_evidence_guard();

DROP TRIGGER IF EXISTS enforce_transfer_item_state ON checklist_items;
CREATE TRIGGER enforce_transfer_item_state
BEFORE INSERT OR UPDATE OR DELETE ON checklist_items
FOR EACH ROW EXECUTE FUNCTION private_transfer_item_guard();

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checklist_id UUID NOT NULL REFERENCES session_checklists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    tutor_message_id UUID NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    source_student_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE RESTRICT,
    selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')),
    stem TEXT NOT NULL CHECK (btrim(stem) <> ''),
    rendered_text TEXT NOT NULL CHECK (btrim(rendered_text) <> ''),
    options JSONB NOT NULL,
    public_payload_hash TEXT NOT NULL,
    lifecycle TEXT NOT NULL DEFAULT 'delivered' CHECK (lifecycle IN ('delivered', 'answered', 'cancelled', 'invalidated')),
    answer_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    selected_option_ids TEXT[],
    result TEXT CHECK (result IS NULL OR result IN ('pass', 'fail')),
    closed_reason TEXT,
    feedback_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    CONSTRAINT assessment_question_option_shape CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
    CONSTRAINT assessment_question_scope_check CHECK (lifecycle <> 'delivered' OR result IS NULL OR result IN ('pass', 'fail'))
);

CREATE UNIQUE INDEX IF NOT EXISTS one_unresolved_assessment_per_student
    ON public.assessment_questions(room_id, student_id)
    WHERE lifecycle = 'delivered';
CREATE INDEX IF NOT EXISTS idx_assessment_questions_student_lifecycle
    ON public.assessment_questions(student_id, lifecycle, created_at);

CREATE TABLE IF NOT EXISTS private.assessment_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checklist_id UUID REFERENCES session_checklists(id) ON DELETE CASCADE,
    item_id UUID REFERENCES checklist_items(id) ON DELETE SET NULL,
    focus_student_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    raw_model_output JSONB NOT NULL,
    reviewed_payload JSONB,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    raw_hash TEXT NOT NULL,
    final_hash TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    content_confirmed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'rejected', 'ignored', 'sent', 'superseded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_drafts_scope
    ON private.assessment_drafts(room_id, student_id, status, updated_at);

CREATE TABLE IF NOT EXISTS private.assessment_question_keys (
    question_id UUID PRIMARY KEY REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
    correct_option_ids TEXT[] NOT NULL,
    private_payload JSONB NOT NULL,
    private_payload_hash TEXT NOT NULL,
    source_transfer_basis JSONB NOT NULL,
    teacher_confirmation_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    teacher_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    draft_id UUID NOT NULL REFERENCES private.assessment_drafts(id) ON DELETE RESTRICT,
    draft_revision INTEGER NOT NULL,
    source_item_updated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT assessment_key_ids_check CHECK (
        correct_option_ids <@ ARRAY['A', 'B', 'C', 'D']::TEXT[]
        AND cardinality(correct_option_ids) BETWEEN 1 AND 3
    ),
    CONSTRAINT one_key_per_reviewed_draft_revision UNIQUE (draft_id, draft_revision)
);

CREATE OR REPLACE FUNCTION reject_assessment_key_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'ASSESSMENT_KEY_IMMUTABLE' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS assessment_key_is_immutable ON private.assessment_question_keys;
CREATE TRIGGER assessment_key_is_immutable
BEFORE UPDATE OR DELETE ON private.assessment_question_keys
FOR EACH ROW EXECUTE FUNCTION reject_assessment_key_update();

CREATE TABLE IF NOT EXISTS private.learning_event_inbox (
    event_id UUID PRIMARY KEY,
    dedupe_key TEXT NOT NULL UNIQUE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checklist_id UUID NOT NULL REFERENCES session_checklists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    event_kind TEXT NOT NULL,
    event_payload JSONB NOT NULL,
    classified_by TEXT NOT NULL,
    effective_order BIGINT,
    processing_state TEXT NOT NULL DEFAULT 'received' CHECK (processing_state IN ('received', 'applied', 'no_change', 'deferred_guard', 'rejected', 'error')),
    error_code TEXT,
    linked_update_id UUID,
    linked_evidence_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS private.assessment_request_results (
    operation TEXT NOT NULL,
    request_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (operation, request_id)
);

ALTER TABLE ai_suggestion_feedback
    DROP CONSTRAINT IF EXISTS ai_suggestion_feedback_assessment_id_fkey;
ALTER TABLE ai_suggestion_feedback
    ADD CONSTRAINT ai_suggestion_feedback_assessment_id_fkey
    FOREIGN KEY (assessment_id) REFERENCES public.assessment_questions(id) ON DELETE SET NULL;
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS assessment_id UUID REFERENCES public.assessment_questions(id) ON DELETE SET NULL;

GRANT SELECT ON public.assessment_questions TO authenticated;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Assessment participants can view public questions" ON public.assessment_questions;
CREATE POLICY "Assessment participants can view public questions" ON public.assessment_questions
    FOR SELECT USING (
        student_id = auth.uid()
        OR room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid())
    );
REVOKE ALL ON private.assessment_drafts, private.assessment_question_keys, private.learning_event_inbox, private.assessment_request_results FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.assessment_drafts, private.learning_event_inbox, private.assessment_request_results TO service_role;
GRANT SELECT, INSERT ON private.assessment_question_keys TO service_role;

CREATE OR REPLACE FUNCTION apply_learning_event_v1(p_event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_event_id UUID := (p_event->>'event_id')::UUID;
    v_dedupe_key TEXT := p_event->>'dedupe_key';
    v_kind TEXT := p_event->>'kind';
    v_item checklist_items%ROWTYPE;
    v_room rooms%ROWTYPE;
    v_old_status TEXT;
    v_old_level TEXT;
    v_next_status TEXT;
    v_next_level TEXT;
    v_student_id UUID;
    v_evidence_id UUID;
    v_update_id UUID;
    v_existing private.learning_event_inbox%ROWTYPE;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_existing FROM private.learning_event_inbox WHERE dedupe_key = v_dedupe_key;
    IF FOUND THEN
        RETURN jsonb_build_object('event_id', v_existing.event_id, 'processing_state', v_existing.processing_state, 'status', v_existing.error_code);
    END IF;

    SELECT * INTO v_item FROM checklist_items WHERE id = (p_event->>'item_id')::UUID FOR UPDATE;
    SELECT r.* INTO v_room FROM rooms r JOIN session_checklists sc ON sc.room_id = r.id WHERE sc.id = v_item.checklist_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = '23503'; END IF;
    IF (SELECT progress_policy_version FROM session_checklists WHERE id = v_item.checklist_id) <> 'transfer_v1' THEN
        RAISE EXCEPTION 'LEGACY_CHECKLIST' USING ERRCODE = 'P0001';
    END IF;
    SELECT student_id INTO v_student_id
    FROM session_checklists
    WHERE id = v_item.checklist_id;
    IF (p_event->>'room_id')::UUID <> v_room.id
       OR (p_event->>'student_id')::UUID <> v_student_id
       OR btrim(COALESCE(p_event->>'evidence_text', '')) = ''
       OR jsonb_typeof(p_event->'source_evidence_message_ids') <> 'array'
       OR jsonb_array_length(p_event->'source_evidence_message_ids') = 0 THEN
        RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
    END IF;

    IF v_kind NOT IN (
        'initial_signal', 'post_repair_signal', 'spontaneous_transfer',
        'contradiction', 'assessment_pass', 'assessment_fail'
    ) THEN
        RAISE EXCEPTION 'UNKNOWN_EVENT_KIND' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(p_event->'source_evidence_message_ids') AS source_evidence(message_id)
        LEFT JOIN messages m ON m.id = source_evidence.message_id::UUID
        WHERE m.id IS NULL
           OR NOT (
                m.room_id = v_room.id
                AND m.user_id = v_student_id
                AND m.user_role = 'student'
           )
    ) THEN
        RAISE EXCEPTION 'INVALID_SOURCE_EVIDENCE' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO private.learning_event_inbox(event_id, dedupe_key, room_id, student_id, checklist_id, item_id, source_message_id, event_kind, event_payload, classified_by)
    VALUES (v_event_id, v_dedupe_key, (p_event->>'room_id')::UUID, (p_event->>'student_id')::UUID, v_item.checklist_id, v_item.id, NULLIF(p_event->>'source_message_id', '')::UUID, v_kind, p_event, COALESCE(p_event->>'classified_by', 'trusted_backend'));

    IF v_room.active_response_mode = 'guard' THEN
        UPDATE private.learning_event_inbox SET processing_state = 'deferred_guard' WHERE event_id = v_event_id;
        RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'deferred_guard', 'error_code', 'PROGRESSION_LOCKED');
    END IF;

    v_old_status := v_item.status;
    v_old_level := v_item.understanding_level;
    v_next_status := v_old_status;
    v_next_level := v_old_level;
    IF v_kind = 'initial_signal' AND v_old_status = 'pending' THEN v_next_status := 'partially_covered'; v_next_level := 'basic';
    ELSIF v_kind = 'post_repair_signal' AND v_old_status = 'needs_review' THEN v_next_status := 'partially_covered'; v_next_level := 'basic';
    ELSIF v_kind = 'spontaneous_transfer' AND v_old_status <> 'covered' THEN v_next_status := 'covered'; v_next_level := 'good';
    ELSIF v_kind = 'contradiction' AND v_old_status IN ('partially_covered', 'covered') THEN v_next_status := 'needs_review'; v_next_level := 'basic';
    ELSIF v_kind = 'assessment_pass' AND v_old_status = 'partially_covered' THEN v_next_status := 'covered'; v_next_level := 'good';
    ELSIF v_kind = 'assessment_fail' AND v_old_status = 'partially_covered' THEN v_next_status := 'needs_review'; v_next_level := 'basic';
    ELSIF v_kind IN ('assessment_pass', 'assessment_fail') THEN
        UPDATE private.learning_event_inbox SET processing_state = 'rejected', error_code = 'INVALID_TRANSITION' WHERE event_id = v_event_id;
        RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'rejected', 'error_code', 'INVALID_TRANSITION');
    END IF;

    IF v_next_status = v_old_status AND v_next_level = v_old_level THEN
        UPDATE private.learning_event_inbox SET processing_state = 'no_change', applied_at = NOW() WHERE event_id = v_event_id;
        RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'no_change');
    END IF;

    PERFORM set_config('app.transfer_operation', 'on', true);
    INSERT INTO coverage_evidence(item_id, evidence_text, analysis, confidence_score, detection_method, message_id, event_id, assessment_id)
    VALUES (v_item.id, COALESCE(p_event->>'evidence_text', ''), COALESCE(p_event->>'explanation', 'Transfer event applied by trusted operation'), 100, CASE WHEN p_event->>'classified_by' = 'tutor' THEN 'tutor_manual' ELSE 'ai_analysis' END, NULLIF(p_event->>'source_message_id', '')::UUID, v_event_id, NULLIF(p_event->>'assessment_id', '')::UUID)
    RETURNING id INTO v_evidence_id;
    UPDATE checklist_items SET status = v_next_status, understanding_level = v_next_level, last_addressed = NOW(), attempts_count = attempts_count + CASE WHEN v_kind IN ('assessment_pass', 'assessment_fail', 'spontaneous_transfer') THEN 1 ELSE 0 END, updated_at = NOW() WHERE id = v_item.id;
    INSERT INTO checklist_updates(checklist_id, item_id, previous_status, new_status, previous_understanding, new_understanding, evidence_id, event_id, assessment_id, updated_by)
    VALUES (v_item.checklist_id, v_item.id, v_old_status, v_next_status, v_old_level, v_next_level, v_evidence_id, v_event_id, NULLIF(p_event->>'assessment_id', '')::UUID, CASE WHEN p_event->>'classified_by' = 'tutor' THEN 'tutor' ELSE 'ai' END)
    RETURNING id INTO v_update_id;
    UPDATE private.learning_event_inbox SET processing_state = 'applied', linked_update_id = v_update_id, linked_evidence_id = v_evidence_id, applied_at = NOW() WHERE event_id = v_event_id;
    RETURN jsonb_build_object('event_id', v_event_id, 'processing_state', 'applied', 'evidence_id', v_evidence_id, 'update_id', v_update_id, 'status', v_next_status, 'understanding_level', v_next_level);
END;
$$;

REVOKE ALL ON FUNCTION apply_learning_event_v1(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_learning_event_v1(JSONB) TO service_role;

CREATE OR REPLACE FUNCTION initialize_transfer_checklist_v1(
    p_room_id UUID,
    p_student_id UUID,
    p_template_name TEXT,
    p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_checklist_id UUID;
    v_template_id UUID;
    v_item RECORD;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM sessions
        WHERE room_id = p_room_id AND student_id = p_student_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'UNSUPPORTED_ROOM_SCOPE' USING ERRCODE = 'P0001';
    END IF;

    SELECT id INTO v_checklist_id
    FROM session_checklists
    WHERE room_id = p_room_id AND student_id = p_student_id
      AND progress_policy_version = 'transfer_v1' AND is_active = true
    FOR UPDATE;
    IF FOUND THEN
        RETURN v_checklist_id;
    END IF;

    SELECT id INTO v_template_id FROM checklist_templates WHERE name = p_template_name;
    IF v_template_id IS NULL THEN
        RAISE EXCEPTION 'TEMPLATE_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    PERFORM set_config('app.transfer_operation', 'on', true);
    UPDATE session_checklists
    SET is_active = false, updated_at = NOW()
    WHERE room_id = p_room_id AND student_id = p_student_id
      AND progress_policy_version = 'transfer_v1' AND is_active = true;

    INSERT INTO session_checklists (room_id, student_id, progress_policy_version, template_name)
    VALUES (p_room_id, p_student_id, 'transfer_v1', p_template_name)
    RETURNING id INTO v_checklist_id;

    FOR v_item IN
        SELECT item_text, item_type, priority
        FROM template_items
        WHERE template_id = v_template_id
        ORDER BY sort_order, id
    LOOP
        INSERT INTO checklist_items (
            checklist_id, area_text, item_type, priority, status,
            understanding_level, tutor_notes, attempts_count, original_template_area
        ) VALUES (
            v_checklist_id, v_item.item_text, v_item.item_type, v_item.priority,
            'pending', 'none', '', 0, true
        );
    END LOOP;

    UPDATE session_checklists
    SET total_items = (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = v_checklist_id),
        completed_items = 0,
        completion_percentage = 0,
        updated_at = NOW()
    WHERE id = v_checklist_id;
    RETURN v_checklist_id;
END;
$$;

REVOKE ALL ON FUNCTION initialize_transfer_checklist_v1(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION initialize_transfer_checklist_v1(UUID, UUID, TEXT, UUID) TO service_role;

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
    v_existing JSONB;
    v_user users%ROWTYPE;
    v_message messages%ROWTYPE;
    v_response JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    SELECT response INTO v_existing
    FROM private.assessment_request_results
    WHERE operation = 'post_message' AND request_id = p_request_id AND actor_id = p_actor_id;
    IF FOUND THEN RETURN v_existing; END IF;
    IF p_content IS NULL OR btrim(p_content) = '' THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_user FROM users WHERE id = p_actor_id;
    IF NOT FOUND OR v_user.current_role IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id)
       AND NOT EXISTS (
           SELECT 1 FROM sessions
           WHERE room_id = p_room_id AND student_id = p_actor_id AND status = 'active'
       ) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_assessment_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM assessment_questions
        WHERE id = p_assessment_id AND room_id = p_room_id
          AND student_id = p_actor_id AND lifecycle = 'delivered'
    ) THEN
        RAISE EXCEPTION 'WRONG_LEARNER' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO messages (
        room_id, user_id, content, user_role, is_ai_generated,
        parent_message_id, response_mode, assessment_id
    ) VALUES (
        p_room_id, p_actor_id, btrim(p_content), v_user.current_role, false,
        p_parent_message_id, NULL, p_assessment_id
    ) RETURNING * INTO v_message;

    v_response := jsonb_build_object(
        'message', to_jsonb(v_message),
        'analysis_pending', true,
        'request_id', p_request_id
    );
    INSERT INTO private.assessment_request_results(operation, request_id, actor_id, response)
    VALUES ('post_message', p_request_id, p_actor_id, v_response);
    RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION post_assessment_message_v1(UUID, TEXT, UUID, UUID, UUID, UUID) TO service_role;

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
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM session_checklists
        WHERE id = p_checklist_id AND room_id = p_room_id
          AND progress_policy_version = 'transfer_v1' AND is_active = true
    ) THEN
        RAISE EXCEPTION 'LEGACY_CHECKLIST' USING ERRCODE = 'P0001';
    END IF;
    -- Model generation belongs in the trusted Edge Function/provider adapter.
    -- Returning this explicit error avoids fabricating a question or exposing a key.
    RAISE EXCEPTION 'AI_PROVIDER_NOT_CONFIGURED' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION prepare_transfer_turn_v1(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prepare_transfer_turn_v1(UUID, UUID, UUID, UUID, UUID) TO service_role;

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

    v_hash := encode(digest(convert_to(p_final_payload::TEXT, 'UTF8'), 'sha256'), 'hex');
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
            encode(digest(convert_to((v_assessment - 'correct_option_ids' - 'transfer_basis')::TEXT, 'UTF8'), 'sha256'), 'hex')
        ) RETURNING * INTO v_question;

        INSERT INTO private.assessment_question_keys (
            question_id, correct_option_ids, private_payload, private_payload_hash,
            source_transfer_basis, teacher_confirmation_id, draft_id, draft_revision,
            source_item_updated_at
        ) VALUES (
            v_question.id,
            ARRAY(SELECT jsonb_array_elements_text(v_assessment->'correct_option_ids')),
            v_assessment,
            encode(digest(convert_to(v_assessment::TEXT, 'UTF8'), 'sha256'), 'hex'),
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
    RETURN jsonb_build_object('question', to_jsonb(v_question) - 'public_payload_hash');
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
    RETURN jsonb_build_object('question', to_jsonb(v_question) - 'public_payload_hash', 'reconciled', false);
END;
$$;

REVOKE ALL ON FUNCTION invalidate_assessment_question_v1(UUID, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION invalidate_assessment_question_v1(UUID, TEXT, TEXT, UUID, UUID) TO service_role;

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
    v_question assessment_questions%ROWTYPE;
    v_key TEXT[];
    v_selected TEXT[] := ARRAY[]::TEXT[];
    v_answer TEXT;
    v_option RECORD;
    v_result TEXT;
    v_transition JSONB;
    v_event JSONB;
    v_existing JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
    SELECT response INTO v_existing
    FROM private.assessment_request_results
    WHERE operation = 'process_message' AND request_id = p_request_id AND actor_id = p_actor_id;
    IF FOUND THEN RETURN v_existing; END IF;

    SELECT * INTO v_message FROM messages WHERE id = p_message_id;
    IF NOT FOUND OR v_message.user_id <> p_actor_id OR v_message.user_role <> 'student' THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_message.assessment_id IS NULL THEN
        RAISE EXCEPTION 'ASSESSMENT_NOT_OPEN' USING ERRCODE = 'P0001';
    END IF;
    SELECT q.* INTO v_question
    FROM assessment_questions q
    WHERE q.student_id = p_actor_id
      AND q.id = v_message.assessment_id
      AND q.room_id = v_message.room_id
      AND q.lifecycle IN ('delivered', 'answered')
    ORDER BY q.created_at DESC
    LIMIT 1
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ASSESSMENT_NOT_OPEN' USING ERRCODE = 'P0001';
    END IF;
    IF v_question.lifecycle = 'answered' THEN
        IF v_question.answer_message_id = p_message_id THEN
            RETURN jsonb_build_object('question_id', v_question.id, 'result', v_question.result, 'already_processed', true);
        END IF;
        RAISE EXCEPTION 'ASSESSMENT_NOT_OPEN' USING ERRCODE = 'P0001';
    END IF;

    SELECT correct_option_ids INTO v_key FROM private.assessment_question_keys WHERE question_id = v_question.id;
    IF v_key IS NULL THEN RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001'; END IF;

    v_answer := lower(btrim(v_message.content));
    v_answer := replace(replace(v_answer, '，', ','), '、', ',');
    v_answer := regexp_replace(v_answer, '^(answer:|my answer is|i choose|i select|i think|maybe)[[:space:]]*', '', 'i');
    v_answer := split_part(v_answer, E'\n', 1);
    v_answer := split_part(v_answer, ' because ', 1);
    v_answer := split_part(v_answer, ' — ', 1);
    v_answer := regexp_replace(v_answer, '[.!?]+$', '');
    FOR v_option IN SELECT value->>'id' AS id, lower(btrim(value->>'text')) AS text FROM jsonb_array_elements(v_question.options)
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
        v_existing := jsonb_build_object('question_id', v_question.id, 'code', 'ANSWER_FORMAT_UNRESOLVED', 'clarification_required', true);
        INSERT INTO private.assessment_request_results(operation, request_id, actor_id, response)
        VALUES ('process_message', p_request_id, p_actor_id, v_existing);
        RETURN v_existing;
    END IF;

    v_result := CASE
        WHEN cardinality(v_selected) = cardinality(v_key)
         AND v_selected <@ v_key AND v_key <@ v_selected THEN 'pass'
        ELSE 'fail'
    END;
    UPDATE assessment_questions
    SET lifecycle = 'answered', answer_message_id = p_message_id,
        selected_option_ids = v_selected, result = v_result, answered_at = NOW()
    WHERE id = v_question.id
    RETURNING * INTO v_question;

    v_event := jsonb_build_object(
        'event_id', gen_random_uuid(),
        'dedupe_key', 'assessment:' || v_question.id::TEXT || ':' || p_message_id::TEXT,
        'room_id', v_question.room_id,
        'student_id', v_question.student_id,
        'checklist_id', v_question.checklist_id,
        'item_id', v_question.item_id,
        'source_message_id', p_message_id,
        'kind', CASE WHEN v_result = 'pass' THEN 'assessment_pass' ELSE 'assessment_fail' END,
        'evidence_text', v_message.content,
        'source_evidence_message_ids', jsonb_build_array(v_question.source_student_message_id),
        'assessment_id', v_question.id,
        'classified_by', 'deterministic_grader'
    );
    v_transition := apply_learning_event_v1(v_event);
    v_existing := jsonb_build_object(
        'question_id', v_question.id,
        'result', v_result,
        'selected_option_ids', v_selected,
        'transition', v_transition,
        'feedback_required', true
    );
    INSERT INTO private.assessment_request_results(operation, request_id, actor_id, response)
    VALUES ('process_message', p_request_id, p_actor_id, v_existing);
    RETURN v_existing;
END;
$$;

REVOKE ALL ON FUNCTION process_assessment_message_v1(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_assessment_message_v1(UUID, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION confirm_external_transfer_v1(
    p_item_id UUID,
    p_source_evidence_message_ids UUID[],
    p_transfer_evidence TEXT,
    p_note TEXT,
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
    v_item checklist_items%ROWTYPE;
    v_checklist session_checklists%ROWTYPE;
    v_event JSONB;
BEGIN
    IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
    IF p_expected_snapshot IS NULL OR btrim(p_expected_snapshot) = ''
       OR p_transfer_evidence IS NULL OR btrim(p_transfer_evidence) = ''
       OR p_source_evidence_message_ids IS NULL OR cardinality(p_source_evidence_message_ids) = 0 THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
    END IF;
    SELECT ci.* INTO v_item
    FROM checklist_items ci
    JOIN session_checklists sc ON sc.id = ci.checklist_id
    JOIN rooms r ON r.id = sc.room_id
    WHERE ci.id = p_item_id AND sc.progress_policy_version = 'transfer_v1'
      AND r.tutor_id = p_actor_id AND sc.is_active = true
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
    SELECT * INTO v_checklist FROM session_checklists WHERE id = v_item.checklist_id;
    v_event := jsonb_build_object(
        'event_id', gen_random_uuid(),
        'dedupe_key', 'external:' || v_item.id::TEXT || ':' || md5(p_expected_snapshot || ':' || p_transfer_evidence),
        'room_id', v_checklist.room_id,
        'student_id', v_checklist.student_id,
        'checklist_id', v_checklist.id,
        'item_id', v_item.id,
        'source_message_id', NULL,
        'kind', 'spontaneous_transfer',
        'evidence_text', btrim(p_transfer_evidence),
        'source_evidence_message_ids', to_jsonb(p_source_evidence_message_ids),
        'classified_by', 'tutor',
        'note', p_note
    );
    RETURN apply_learning_event_v1(v_event);
END;
$$;

REVOKE ALL ON FUNCTION confirm_external_transfer_v1(UUID, UUID[], TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_external_transfer_v1(UUID, UUID[], TEXT, TEXT, TEXT, UUID, UUID) TO service_role;

-- Preserve the legacy reviewed-send signature while adapting its enum values to
-- the split message-turn type. The legacy operation never writes transfer
-- progress or assessment keys.
-- The hosted database currently has the shorter overload. Remove both it and
-- an earlier attempted 12-argument overload so PostgREST cannot resolve an
-- unintended SECURITY DEFINER routine.
DROP FUNCTION IF EXISTS send_reviewed_tutor_response(
    UUID, UUID, UUID, TEXT, tutor_response_mode, TEXT, tutor_response_mode, TEXT, TEXT, INTEGER, JSONB
);
DROP FUNCTION IF EXISTS send_reviewed_tutor_response(
    UUID, UUID, UUID, TEXT, tutor_response_mode, TEXT, TEXT, tutor_response_mode, TEXT, TEXT, INTEGER, JSONB
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
    IF p_content IS NULL OR btrim(p_content) = '' THEN RAISE EXCEPTION 'Tutor response cannot be empty'; END IF;
    IF p_mode_reason IS NULL OR btrim(p_mode_reason) = '' THEN RAISE EXCEPTION 'AI mode reason cannot be empty'; END IF;
    IF p_ai_suggestion IS NULL OR btrim(p_ai_suggestion) = '' THEN RAISE EXCEPTION 'AI suggested response cannot be empty'; END IF;
    IF p_tutor_action NOT IN ('accepted', 'modified') THEN RAISE EXCEPTION 'Reviewed send requires accepted or modified tutor action'; END IF;
    IF p_raw_mode = 'tutoring' AND p_raw_instruction IS NULL THEN
        RAISE EXCEPTION 'Null raw instruction is allowed only for Guard decisions';
    END IF;
    IF p_raw_instruction IS NOT NULL AND p_raw_instruction NOT IN (
        'protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', 'guard'
    ) THEN
        RAISE EXCEPTION 'Unsupported legacy raw instruction';
    END IF;

    SELECT * INTO room_row FROM rooms
    WHERE id = p_room_id AND tutor_id = p_tutor_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found or tutor does not own room'; END IF;

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
        mode_changed_at = NOW(), mode_change_source = 'reviewed_response'
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

COMMIT;
