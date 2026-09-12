-- Purpose: persist the assessment selection type on public.messages and write it from the reviewed
-- payload, so a learner who reloads the room can still be told whether the question is single- or
-- multiple-choice. Recorded as R15 in specs/orchestration/transfer-assessment/dependency-graph.md.
--
-- Why this exists: migration 038 collapsed the assessment onto public.messages and persisted the
-- stem (as content), the ordered options (assessment_options), and the key (assessment_key), but
-- not the selection type. rendered_text is recoverable, because component 101's pure
-- renderAssessment rebuilds it from stem + selection_type + options; selection_type was not, and
-- without it the browser cannot render the canonical "choose one" versus "select all that apply"
-- instruction after a reload. The owner chose to store the column rather than let the browser infer
-- it from assessment_key cardinality, so the UI never derives behaviour from a private column.
--
-- Scope: one column, one constraint, and a CREATE OR REPLACE of send_reviewed_tutor_response_v3
-- that adds the column to its INSERT. No other behaviour changes. This file is carried by the
-- integration agent because component 102 has no active owner; it is a 102-owned change and follows
-- 038-044 in the same sequence.
--
-- No explicit begin/commit: migrations 038-044 carry none and were applied through the SQL editor,
-- which manages the transaction itself. Adding one risks an "already a transaction in progress"
-- warning or an early commit.
--
-- Note for maintainers, because T009 PART 1 check 8 scans stored function bodies as text including
-- comments: do not name a dropped object anywhere in a function body, not even to explain what
-- replaced it. That check caught exactly that mistake in the first version of migration 044.

alter table public.messages
  add column if not exists assessment_selection_type text;

-- Nullable because only assessment messages carry it, but constrained when present so a tutoring or
-- Guard turn cannot accidentally record one and an assessment cannot record an unknown value.
alter table public.messages
  drop constraint if exists messages_assessment_selection_type_check;
alter table public.messages
  add constraint messages_assessment_selection_type_check
  check (assessment_selection_type is null or assessment_selection_type in ('single', 'multiple'));

create or replace function public.send_reviewed_tutor_response_v3(
    p_reviewed_payload jsonb,
    p_room_id uuid,
    p_student_id uuid,
    p_checklist_id uuid,
    p_item_id uuid,
    p_focus_student_message_id uuid,
    p_actor_id uuid,
    p_request_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
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
        -- Validated here rather than left to the column constraint, so an invalid payload reports
        -- the same ITEM_VALIDATION_FAILED the caller already handles instead of a raw 23514.
        IF v_assessment->>'selection_type' NOT IN ('single', 'multiple') THEN
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
        assessment_checklist_id, assessment_item_id, assessment_selection_type
    ) VALUES (
        p_room_id, p_actor_id, btrim(v_payload->>'response'), 'tutor', true,
        p_focus_student_message_id,
        v_mode::tutor_turn_mode,
        CASE WHEN v_mode = 'assessment' THEN v_assessment->'options' ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN v_key ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN 'delivered' ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN p_checklist_id ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN p_item_id ELSE NULL END,
        CASE WHEN v_mode = 'assessment' THEN v_assessment->>'selection_type' ELSE NULL END
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
$function$;
