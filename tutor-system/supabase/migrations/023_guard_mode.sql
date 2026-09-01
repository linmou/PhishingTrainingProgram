-- Guard Mode persistence and authoritative progression lock.

DO $$
BEGIN
    CREATE TYPE tutor_response_mode AS ENUM ('tutoring', 'guard');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS active_response_mode tutor_response_mode NOT NULL DEFAULT 'tutoring',
    ADD COLUMN IF NOT EXISTS mode_changed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS mode_change_source TEXT CHECK (mode_change_source IN ('reviewed_response', 'manual_override'));

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS response_mode tutor_response_mode;

CREATE TABLE IF NOT EXISTS ai_suggestion_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    ai_suggestion TEXT NOT NULL,
    tutor_action TEXT NOT NULL CHECK (tutor_action IN ('accepted', 'rejected', 'modified', 'ignored')),
    tutor_final_response TEXT,
    tutor_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    response_time_ms INTEGER,
    context_messages JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_suggestion_feedback
    ALTER COLUMN parent_message_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS raw_mode tutor_response_mode,
    ADD COLUMN IF NOT EXISTS mode_reason TEXT,
    ADD COLUMN IF NOT EXISTS final_mode tutor_response_mode,
    ADD COLUMN IF NOT EXISTS mode_rectified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ai_suggestion_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Guard Mode AI feedback operations" ON ai_suggestion_feedback;
CREATE POLICY "Allow Guard Mode AI feedback operations" ON ai_suggestion_feedback
    FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON ai_suggestion_feedback TO anon, authenticated;

CREATE OR REPLACE FUNCTION send_reviewed_tutor_response(
    p_room_id UUID,
    p_tutor_id UUID,
    p_parent_message_id UUID,
    p_content TEXT,
    p_raw_mode tutor_response_mode,
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
        raw_mode, mode_reason, final_mode, mode_rectified
    ) VALUES (
        p_room_id, p_tutor_id, p_parent_message_id, p_ai_suggestion, p_tutor_action,
        btrim(p_content), message_row.id, p_response_time_ms, p_context_messages,
        p_raw_mode, btrim(p_mode_reason), p_final_mode, p_raw_mode IS DISTINCT FROM p_final_mode
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
    UUID, UUID, UUID, TEXT, tutor_response_mode, TEXT, tutor_response_mode,
    TEXT, TEXT, INTEGER, JSONB
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION reject_guard_progress_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    active_mode tutor_response_mode;
BEGIN
    IF TG_TABLE_NAME = 'session_checklists'
       AND TG_OP = 'UPDATE'
       AND NEW.total_items IS NOT DISTINCT FROM OLD.total_items
       AND NEW.completed_items IS NOT DISTINCT FROM OLD.completed_items
       AND NEW.completion_percentage IS NOT DISTINCT FROM OLD.completion_percentage THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'checklist_items'
       AND TG_OP = 'UPDATE'
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.understanding_level IS NOT DISTINCT FROM OLD.understanding_level
       AND NEW.attempts_count IS NOT DISTINCT FROM OLD.attempts_count
       AND NEW.last_addressed IS NOT DISTINCT FROM OLD.last_addressed
       AND NEW.deleted IS NOT DISTINCT FROM OLD.deleted THEN
        RETURN NEW;
    END IF;

    SELECT rooms.active_response_mode INTO active_mode
    FROM rooms
    JOIN session_checklists ON session_checklists.room_id = rooms.id
    WHERE session_checklists.id = CASE
        WHEN TG_TABLE_NAME = 'session_checklists' THEN COALESCE(NEW.id, OLD.id)
        WHEN TG_TABLE_NAME = 'checklist_items' THEN COALESCE(NEW.checklist_id, OLD.checklist_id)
        WHEN TG_TABLE_NAME = 'checklist_updates' THEN COALESCE(NEW.checklist_id, OLD.checklist_id)
        ELSE (
            SELECT checklist_id FROM checklist_items
            WHERE id = COALESCE(NEW.item_id, OLD.item_id)
        )
    END;

    IF active_mode = 'guard' THEN
        RAISE EXCEPTION 'Learning progression is locked while Guard Mode is active';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS block_guard_checklist_item_updates ON checklist_items;
CREATE TRIGGER block_guard_checklist_item_updates
BEFORE INSERT OR UPDATE OR DELETE ON checklist_items
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();

DROP TRIGGER IF EXISTS block_guard_checklist_evidence ON coverage_evidence;
CREATE TRIGGER block_guard_checklist_evidence
BEFORE INSERT OR UPDATE OR DELETE ON coverage_evidence
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();

DROP TRIGGER IF EXISTS block_guard_checklist_updates ON checklist_updates;
CREATE TRIGGER block_guard_checklist_updates
BEFORE INSERT OR UPDATE OR DELETE ON checklist_updates
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();

DROP TRIGGER IF EXISTS block_guard_session_checklist_progress ON session_checklists;
CREATE TRIGGER block_guard_session_checklist_progress
BEFORE UPDATE OR DELETE ON session_checklists
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();
