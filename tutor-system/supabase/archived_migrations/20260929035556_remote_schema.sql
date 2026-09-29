--
-- PostgreSQL database dump
--

-- Intent: record the schema bootstrap applied to PhishingTutorStaging on 2026-09-29.
-- This is a schema-only snapshot with no production table rows; apply in the Supabase dashboard to staging only.
-- Default ACLs owned by supabase_admin are platform-managed and are not changed by this script.

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_status AS ENUM (
    'active',
    'completed',
    'cancelled'
);


--
-- Name: tutor_response_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tutor_response_mode AS ENUM (
    'tutoring',
    'guard'
);


--
-- Name: tutor_turn_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tutor_turn_mode AS ENUM (
    'tutoring',
    'guard',
    'assessment',
    'multiagent'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'student',
    'tutor',
    'observer'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'inactive'
);


--
-- Name: add_conversation_context(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_conversation_context(p_room_id uuid, p_role text, p_content text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    new_message JSONB;
BEGIN
    new_message := jsonb_build_object(
        'role', p_role,
        'content', p_content,
        'timestamp', extract(epoch from now())
    );
    
    INSERT INTO ai_conversation_contexts (room_id, conversation_history)
    VALUES (p_room_id, jsonb_build_array(new_message))
    ON CONFLICT (room_id) DO UPDATE SET
        conversation_history = ai_conversation_contexts.conversation_history || new_message,
        last_updated = NOW();
END;
$$;


--
-- Name: apply_learning_event_v1(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_learning_event_v1(p_event jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
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


--
-- Name: create_room_template(uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_room_template(p_tutor_id uuid, p_template_name text, p_template_description text DEFAULT NULL::text, p_title_template text DEFAULT NULL::text, p_description_template text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text, p_pre_populated_dialogue jsonb DEFAULT NULL::jsonb, p_ai_config_template jsonb DEFAULT NULL::jsonb, p_op_config_template jsonb DEFAULT NULL::jsonb, p_password_config jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    template_id UUID;
BEGIN
    -- Insert new template
    INSERT INTO room_templates (
        tutor_id,
        template_name,
        template_description,
        title_template,
        description_template,
        image_url,
        pre_populated_dialogue,
        ai_config_template,
        op_config_template,
        password_config
    ) VALUES (
        p_tutor_id,
        p_template_name,
        p_template_description,
        p_title_template,
        p_description_template,
        p_image_url,
        p_pre_populated_dialogue,
        p_ai_config_template,
        p_op_config_template,
        p_password_config
    ) RETURNING id INTO template_id;
    
    RETURN template_id;
END;
$$;


--
-- Name: extract_checklist_from_prompt(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_checklist_from_prompt(p_system_prompt text, p_room_id uuid, p_student_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_checklist_id UUID;
BEGIN
    -- Create the session checklist
    INSERT INTO session_checklists (room_id, student_id, template_name)
    VALUES (p_room_id, p_student_id, 'LLM_EXTRACTED')
    RETURNING id INTO v_checklist_id;
    
    -- Note: Actual LLM extraction would be handled by application layer
    -- This function provides the database structure for storing extracted items
    
    RETURN v_checklist_id;
END;
$$;


--
-- Name: get_room_templates_by_tutor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_room_templates_by_tutor(p_tutor_id uuid) RETURNS TABLE(id uuid, template_name text, template_description text, title_template text, description_template text, image_url text, pre_populated_dialogue jsonb, ai_config_template jsonb, op_config_template jsonb, password_config jsonb, usage_count integer, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.template_name,
        t.template_description,
        t.title_template,
        t.description_template,
        t.image_url,
        t.pre_populated_dialogue,
        t.ai_config_template,
        t.op_config_template,
        t.password_config,
        t.usage_count,
        t.created_at,
        t.updated_at
    FROM room_templates t
    WHERE t.tutor_id = p_tutor_id
    ORDER BY t.created_at DESC;
END;
$$;


--
-- Name: initialize_ai_assistant(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_ai_assistant(p_room_id uuid, p_model_name text DEFAULT 'gpt-3.5-turbo'::text, p_system_prompt text DEFAULT 'You are a helpful AI assistant in an educational tutoring session. Provide clear, educational responses to help students learn.'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    config_id UUID;
BEGIN
    -- Check if user is tutor of the room
    IF NOT EXISTS (
        SELECT 1 FROM rooms 
        WHERE id = p_room_id 
        AND tutor_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only room tutors can initialize AI assistant';
    END IF;
    
    -- Create or update AI assistant config
    INSERT INTO ai_assistant_configs (room_id, model_name, system_prompt)
    VALUES (p_room_id, p_model_name, p_system_prompt)
    ON CONFLICT (room_id) DO UPDATE SET
        model_name = EXCLUDED.model_name,
        system_prompt = EXCLUDED.system_prompt,
        is_active = true,
        updated_at = NOW()
    RETURNING id INTO config_id;
    
    -- Initialize conversation context
    INSERT INTO ai_conversation_contexts (room_id, conversation_history)
    VALUES (p_room_id, '[]'::jsonb)
    ON CONFLICT (room_id) DO UPDATE SET
        conversation_history = '[]'::jsonb,
        last_updated = NOW();
    
    -- Enable AI assistant for the room
    UPDATE rooms SET ai_assistant_enabled = true WHERE id = p_room_id;
    
    RETURN config_id;
END;
$$;


--
-- Name: initialize_checklist_from_template(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_template_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_checklist_id UUID;
    v_template_id UUID;
    template_item RECORD;
BEGIN
    -- For simplified auth, skip permission validation
    -- Just validate that the room exists
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) THEN
        RAISE EXCEPTION 'Room not found: %', p_room_id;
    END IF;
    
    -- Get the template ID (using existing SCENARIO_TEMPLATES or custom templates)
    SELECT id INTO v_template_id 
    FROM checklist_templates 
    WHERE name = p_template_name;
    
    -- Create the session checklist WITH is_active = true
    INSERT INTO session_checklists (room_id, template_name, is_active, session_start)
    VALUES (p_room_id, p_template_name, true, NOW())
    RETURNING id INTO v_checklist_id;
    
    -- If we have a custom template, use its items
    IF v_template_id IS NOT NULL THEN
        FOR template_item IN 
            SELECT item_text, item_type, priority 
            FROM template_items 
            WHERE template_id = v_template_id
            ORDER BY sort_order
        LOOP
            INSERT INTO checklist_items (
                checklist_id, area_text, item_type, priority, status, understanding_level,
                tutor_notes, attempts_count, original_template_area
            ) VALUES (
                v_checklist_id, template_item.item_text, template_item.item_type, 
                template_item.priority, 'pending', 'none',
                '', 0, true
            );
        END LOOP;
    ELSE
        -- If no custom template found, create a basic structure
        -- This handles the case where SCENARIO_TEMPLATES are not in the database
        -- but the application expects to create a checklist anyway
        INSERT INTO checklist_items (
            checklist_id, area_text, item_type, priority, status, understanding_level,
            tutor_notes, attempts_count, original_template_area
        ) VALUES 
        (v_checklist_id, 'Suspicious language indicators', 'detection_area', 'critical', 'pending', 'none', '', 0, true),
        (v_checklist_id, 'Verify sender identity', 'verification_step', 'critical', 'pending', 'none', '', 0, true),
        (v_checklist_id, 'Check URL legitimacy', 'verification_step', 'important', 'pending', 'none', '', 0, true);
    END IF;
    
    -- Update total_items count
    UPDATE session_checklists 
    SET total_items = (
        SELECT COUNT(*) FROM checklist_items WHERE checklist_id = v_checklist_id
    ),
    completed_items = 0,
    completion_percentage = 0
    WHERE id = v_checklist_id;
    
    RETURN v_checklist_id;
END;
$$;


--
-- Name: FUNCTION initialize_checklist_from_template(p_room_id uuid, p_template_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_template_name text) IS 'Initializes checklist from template. Accessible to anon role for browser clients.';


--
-- Name: initialize_checklist_from_template(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_student_id uuid, p_template_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_checklist_id UUID;
    v_template_id UUID;
    template_item RECORD;
BEGIN
    -- Get the template ID
    SELECT id INTO v_template_id 
    FROM checklist_templates 
    WHERE name = p_template_name;
    
    -- Create the session checklist for specific student
    INSERT INTO session_checklists (room_id, student_id, template_name)
    VALUES (p_room_id, p_student_id, p_template_name)
    RETURNING id INTO v_checklist_id;
    
    -- If we have a custom template, use its items
    IF v_template_id IS NOT NULL THEN
        FOR template_item IN 
            SELECT item_text, item_type, priority 
            FROM template_items 
            WHERE template_id = v_template_id
            ORDER BY sort_order
        LOOP
            INSERT INTO checklist_items (
                checklist_id, area_text, item_type, priority, status, understanding_level, deleted
            ) VALUES (
                v_checklist_id, template_item.item_text, template_item.item_type, 
                template_item.priority, 'pending', NULL, false
            );
        END LOOP;
    END IF;
    
    -- Update total_items count (excluding deleted items)
    UPDATE session_checklists 
    SET total_items = (
        SELECT COUNT(*) FROM checklist_items 
        WHERE checklist_id = v_checklist_id AND deleted = false
    )
    WHERE id = v_checklist_id;
    
    RETURN v_checklist_id;
END;
$$;


--
-- Name: initialize_transfer_checklist_v1(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_template_name text, p_actor_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
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


--
-- Name: post_assessment_message_v1(uuid, text, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_assessment_message_v1(p_room_id uuid, p_content text, p_parent_message_id uuid, p_assessment_id uuid, p_actor_id uuid, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
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

    SELECT * INTO v_user FROM users WHERE id = p_actor_id;
    IF NOT FOUND OR v_user.current_role IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    v_role := v_user.current_role;

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
        room_id, user_id, content, user_role,
        parent_message_id, response_mode, assessment_id
    ) VALUES (
        p_room_id, p_actor_id, btrim(p_content), v_role,
        p_parent_message_id, NULL, p_assessment_id
    ) RETURNING * INTO v_message;

    RETURN jsonb_build_object(
        'message', to_jsonb(v_message),
        'analysis_pending', (v_role = 'student'),
        'request_id', p_request_id
    );
END;
$$;


--
-- Name: prepare_transfer_turn_v1(uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_transfer_turn_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
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


--
-- Name: private_transfer_checklist_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.private_transfer_checklist_guard() RETURNS trigger
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


--
-- Name: private_transfer_evidence_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.private_transfer_evidence_guard() RETURNS trigger
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


--
-- Name: private_transfer_item_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.private_transfer_item_guard() RETURNS trigger
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


--
-- Name: process_assessment_message_v1(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_assessment_message_v1(p_message_id uuid, p_actor_id uuid, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $_$
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
$_$;


--
-- Name: reject_assessment_key_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_assessment_key_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'ASSESSMENT_KEY_IMMUTABLE' USING ERRCODE = '42501';
END;
$$;


--
-- Name: reject_guard_progress_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_guard_progress_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    active_mode tutor_response_mode;
    v_checklist_id uuid;
BEGIN
    -- Each table's columns are referenced only inside its own TG_TABLE_NAME block. The two
    -- early-returns compare NEW against OLD, so they are only meaningful on UPDATE, and they
    -- short-circuit the Guard check when a guarded field did not actually change.
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'session_checklists' THEN
        IF NEW.total_items IS NOT DISTINCT FROM OLD.total_items
           AND NEW.completed_items IS NOT DISTINCT FROM OLD.completed_items
           AND NEW.completion_percentage IS NOT DISTINCT FROM OLD.completion_percentage THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'checklist_items' THEN
        IF NEW.status IS NOT DISTINCT FROM OLD.status
           AND NEW.understanding_level IS NOT DISTINCT FROM OLD.understanding_level
           AND NEW.attempts_count IS NOT DISTINCT FROM OLD.attempts_count
           AND NEW.last_addressed IS NOT DISTINCT FROM OLD.last_addressed
           AND NEW.deleted IS NOT DISTINCT FROM OLD.deleted THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Resolve the owning checklist. Same rule: one table per branch, and the branch that reads
    -- checklist_items by item_id is entered only for the table that actually has item_id.
    IF TG_TABLE_NAME = 'session_checklists' THEN
        v_checklist_id := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'checklist_items' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'checklist_updates' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'coverage_evidence' THEN
        SELECT ci.checklist_id INTO v_checklist_id
        FROM checklist_items ci
        WHERE ci.id = COALESCE(NEW.item_id, OLD.item_id);
    END IF;

    IF v_checklist_id IS NOT NULL THEN
        SELECT rooms.active_response_mode INTO active_mode
        FROM rooms
        JOIN session_checklists ON session_checklists.room_id = rooms.id
        WHERE session_checklists.id = v_checklist_id;

        IF active_mode = 'guard' THEN
            RAISE EXCEPTION 'Learning progression is locked while Guard Mode is active';
        END IF;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;


--
-- Name: send_reviewed_tutor_response(uuid, uuid, uuid, text, public.tutor_response_mode, text, text, public.tutor_response_mode, text, text, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_reviewed_tutor_response(p_room_id uuid, p_tutor_id uuid, p_parent_message_id uuid, p_content text, p_raw_mode public.tutor_response_mode, p_raw_instruction text, p_mode_reason text, p_final_mode public.tutor_response_mode, p_ai_suggestion text, p_tutor_action text, p_response_time_ms integer, p_context_messages jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    IF p_raw_mode = 'tutoring' AND p_raw_instruction IS NULL THEN
        RAISE EXCEPTION 'Null raw instruction is allowed only for Guard decisions';
    END IF;
    IF p_raw_instruction IS NOT NULL AND p_raw_instruction NOT IN (
        'protective_instruction', 'correction', 'scaffolding', 'explanation',
        'consolidation', 'guard'
    ) THEN
        RAISE EXCEPTION 'Unsupported legacy raw instruction';
    END IF;

    SELECT * INTO room_row FROM rooms
    WHERE id = p_room_id AND tutor_id = p_tutor_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found or tutor does not own room';
    END IF;

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


--
-- Name: send_reviewed_tutor_response_v3(jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_reviewed_tutor_response_v3(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
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
       OR v_payload->>'response' IS NULL THEN
        RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id AND tutor_id = p_actor_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;

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
        IF v_assessment->>'selection_type' NOT IN ('single', 'multiple') THEN
            RAISE EXCEPTION 'ITEM_VALIDATION_FAILED' USING ERRCODE = 'P0001';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM session_checklists
            WHERE id = p_checklist_id
              AND room_id = p_room_id
              AND student_id = p_student_id
              AND progress_policy_version = 'transfer_v1'
        ) THEN
            RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM messages
            WHERE id = p_focus_student_message_id
              AND room_id = p_room_id
              AND user_id = p_student_id
              AND user_role = 'student'
        ) THEN
            RAISE EXCEPTION 'INVALID_SCOPE' USING ERRCODE = 'P0001';
        END IF;
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
        room_id, user_id, content, user_role,
        parent_message_id, response_mode,
        assessment_options, assessment_key, assessment_lifecycle,
        assessment_checklist_id, assessment_item_id, assessment_selection_type
    ) VALUES (
        p_room_id, p_actor_id, btrim(v_payload->>'response'), 'tutor',
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
    SET active_response_mode = CASE
            WHEN v_mode = 'guard' THEN 'guard'::tutor_response_mode
            ELSE 'tutoring'::tutor_response_mode
        END,
        mode_changed_at = NOW(),
        mode_change_source = 'reviewed_response'
    WHERE id = v_room.id;

    RETURN jsonb_build_object(
        'message', (to_jsonb(v_message) - 'assessment_key'),
        'room', to_jsonb(v_room)
    );
END;
$$;


--
-- Name: soft_delete_checklist_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soft_delete_checklist_item(p_item_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_checklist_id UUID;
BEGIN
    -- Mark item as deleted
    UPDATE checklist_items 
    SET deleted = true, updated_at = NOW()
    WHERE id = p_item_id
    RETURNING checklist_id INTO v_checklist_id;
    
    -- Update progress calculation
    PERFORM update_checklist_progress(v_checklist_id);
END;
$$;


--
-- Name: trigger_update_checklist_progress(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_checklist_progress() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM update_checklist_progress(
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.checklist_id
            ELSE NEW.checklist_id
        END
    );
    
    RETURN CASE 
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$;


--
-- Name: update_checklist_progress(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_checklist_progress(p_checklist_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_percentage DECIMAL(5,2);
BEGIN
    -- Count only non-deleted items
    SELECT COUNT(*) INTO v_total
    FROM checklist_items 
    WHERE checklist_id = p_checklist_id AND deleted = false;
    
    SELECT COUNT(*) INTO v_completed
    FROM checklist_items 
    WHERE checklist_id = p_checklist_id 
    AND deleted = false
    AND status = 'covered';
    
    v_percentage := CASE 
        WHEN v_total = 0 THEN 0 
        ELSE ROUND((v_completed::DECIMAL / v_total::DECIMAL) * 100, 2)
    END;
    
    UPDATE session_checklists 
    SET 
        total_items = v_total,
        completed_items = v_completed,
        completion_percentage = v_percentage,
        updated_at = NOW()
    WHERE id = p_checklist_id;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: learning_event_inbox; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.learning_event_inbox (
    event_id uuid NOT NULL,
    dedupe_key text NOT NULL,
    room_id uuid NOT NULL,
    student_id uuid NOT NULL,
    checklist_id uuid NOT NULL,
    item_id uuid NOT NULL,
    source_message_id uuid,
    event_kind text NOT NULL,
    event_payload jsonb NOT NULL,
    classified_by text NOT NULL,
    processing_state text DEFAULT 'received'::text NOT NULL,
    error_code text,
    linked_update_id uuid,
    linked_evidence_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,
    CONSTRAINT learning_event_inbox_processing_state_check CHECK ((processing_state = ANY (ARRAY['received'::text, 'applied'::text, 'no_change'::text, 'deferred_guard'::text, 'rejected'::text, 'error'::text])))
);


--
-- Name: transfer_assessments; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.transfer_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_message_id uuid NOT NULL,
    room_id uuid NOT NULL,
    student_id uuid NOT NULL,
    checklist_id uuid NOT NULL,
    item_id uuid NOT NULL,
    focus_student_message_id uuid NOT NULL,
    selection_type text NOT NULL,
    correct_option_ids text[] NOT NULL,
    learner_safe_explanation text,
    transfer_basis jsonb,
    reviewed_private_payload jsonb,
    lifecycle text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    terminal_answer_message_id uuid,
    terminal_result text,
    closed_at timestamp with time zone,
    delivery_request_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transfer_assessments_attempt_count_check CHECK (((attempt_count >= 0) AND (attempt_count <= 2))),
    CONSTRAINT transfer_assessments_key_shape CHECK ((((selection_type = 'single'::text) AND (cardinality(correct_option_ids) = 1)) OR ((selection_type = 'multiple'::text) AND ((cardinality(correct_option_ids) >= 2) AND (cardinality(correct_option_ids) <= 3))))),
    CONSTRAINT transfer_assessments_lifecycle_check CHECK ((lifecycle = ANY (ARRAY['open'::text, 'passed'::text, 'failed'::text, 'cancelled'::text, 'legacy_incomplete'::text]))),
    CONSTRAINT transfer_assessments_private_fields CHECK (((lifecycle = 'legacy_incomplete'::text) OR ((learner_safe_explanation IS NOT NULL) AND (btrim(learner_safe_explanation) <> ''::text) AND (transfer_basis IS NOT NULL) AND (reviewed_private_payload IS NOT NULL) AND (delivery_request_id IS NOT NULL)))),
    CONSTRAINT transfer_assessments_selection_type_check CHECK ((selection_type = ANY (ARRAY['single'::text, 'multiple'::text]))),
    CONSTRAINT transfer_assessments_terminal_result_check CHECK ((terminal_result = ANY (ARRAY['passed'::text, 'failed'::text]))),
    CONSTRAINT transfer_assessments_terminal_state CHECK ((((lifecycle = ANY (ARRAY['open'::text, 'legacy_incomplete'::text])) AND (terminal_result IS NULL) AND (closed_at IS NULL)) OR ((lifecycle = ANY (ARRAY['passed'::text, 'failed'::text])) AND (terminal_result = lifecycle) AND (terminal_answer_message_id IS NOT NULL) AND (closed_at IS NOT NULL)) OR ((lifecycle = 'cancelled'::text) AND (terminal_result IS NULL) AND (closed_at IS NOT NULL))))
);


--
-- Name: checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checklist_id uuid NOT NULL,
    area_text text NOT NULL,
    item_type text NOT NULL,
    priority text,
    status text NOT NULL,
    understanding_level text,
    tutor_notes text DEFAULT ''::text,
    last_addressed timestamp with time zone,
    attempts_count integer DEFAULT 0 NOT NULL,
    original_template_area boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    CONSTRAINT checklist_items_item_type_check CHECK ((item_type = ANY (ARRAY['understanding'::text, 'behavior'::text, 'detection_area'::text, 'verification_step'::text]))),
    CONSTRAINT checklist_items_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'important'::text, 'optional'::text]))),
    CONSTRAINT checklist_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partially_covered'::text, 'covered'::text, 'needs_review'::text]))),
    CONSTRAINT checklist_items_understanding_level_check CHECK ((understanding_level = ANY (ARRAY['none'::text, 'basic'::text, 'good'::text, 'excellent'::text])))
);


--
-- Name: COLUMN checklist_items.deleted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.checklist_items.deleted IS 'Soft delete flag - items remain in database but excluded from calculations';


--
-- Name: active_checklist_items; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_checklist_items AS
 SELECT id,
    checklist_id,
    area_text,
    item_type,
    priority,
    status,
    understanding_level,
    tutor_notes,
    last_addressed,
    attempts_count,
    original_template_area,
    created_at,
    updated_at,
    deleted
   FROM public.checklist_items
  WHERE (deleted = false);


--
-- Name: VIEW active_checklist_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.active_checklist_items IS 'Shows only non-deleted checklist items for regular operations';


--
-- Name: ai_assistant_config_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_assistant_config_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    changed_by_user_id uuid NOT NULL,
    change_reason text DEFAULT 'settings_update'::text NOT NULL,
    changed_fields text[] NOT NULL,
    previous_config jsonb NOT NULL,
    new_config jsonb NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_assistant_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_assistant_configs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    room_id uuid NOT NULL,
    model_name text DEFAULT 'gpt-3.5-turbo'::text NOT NULL,
    system_prompt text,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 150,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    prompt_config jsonb,
    CONSTRAINT ai_assistant_configs_max_tokens_check CHECK ((max_tokens > 0)),
    CONSTRAINT ai_assistant_configs_temperature_check CHECK (((temperature >= (0)::numeric) AND (temperature <= (2)::numeric)))
);


--
-- Name: COLUMN ai_assistant_configs.prompt_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_assistant_configs.prompt_config IS 'JSON configuration used to generate the system prompt, including role, communication_style, cognitive_parameters, emotional_parameters, detection_areas, and verification_steps';


--
-- Name: ai_suggestion_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_suggestion_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    tutor_id uuid NOT NULL,
    parent_message_id uuid,
    ai_suggestion text NOT NULL,
    tutor_action text NOT NULL,
    tutor_final_response text,
    tutor_message_id uuid,
    response_time_ms integer,
    context_messages jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_mode public.tutor_turn_mode,
    mode_reason text,
    final_mode public.tutor_turn_mode,
    mode_rectified boolean DEFAULT false NOT NULL,
    raw_instruction text,
    contract_version text,
    final_instruction text,
    assessment_id uuid,
    CONSTRAINT ai_suggestion_feedback_raw_instruction_value_check CHECK (((raw_instruction IS NULL) OR (raw_instruction = ANY (ARRAY['protective_instruction'::text, 'correction'::text, 'scaffolding'::text, 'explanation'::text, 'consolidation'::text, 'transfer_assess'::text, 'guard'::text])))),
    CONSTRAINT ai_suggestion_feedback_tutor_action_check CHECK ((tutor_action = ANY (ARRAY['accepted'::text, 'rejected'::text, 'modified'::text, 'ignored'::text])))
);


--
-- Name: checklist_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_configs (
    room_id uuid NOT NULL,
    ai_detection_sensitivity text DEFAULT 'moderate'::text NOT NULL,
    auto_coverage_detection boolean DEFAULT true NOT NULL,
    require_tutor_confirmation boolean DEFAULT false NOT NULL,
    completion_threshold integer DEFAULT 75 NOT NULL,
    regression_detection boolean DEFAULT true NOT NULL,
    show_progress_to_students boolean DEFAULT true NOT NULL,
    group_by_priority boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT checklist_configs_ai_detection_sensitivity_check CHECK ((ai_detection_sensitivity = ANY (ARRAY['strict'::text, 'moderate'::text, 'flexible'::text]))),
    CONSTRAINT checklist_configs_completion_threshold_check CHECK (((completion_threshold >= 0) AND (completion_threshold <= 100)))
);


--
-- Name: checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    created_by_tutor_id uuid NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    average_completion_rate numeric(5,2) DEFAULT 0.00,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: checklist_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checklist_id uuid NOT NULL,
    item_id uuid NOT NULL,
    previous_status text NOT NULL,
    new_status text NOT NULL,
    previous_understanding text NOT NULL,
    new_understanding text NOT NULL,
    evidence_id uuid,
    updated_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_id uuid,
    assessment_id uuid,
    CONSTRAINT checklist_updates_updated_by_check CHECK ((updated_by = ANY (ARRAY['ai'::text, 'tutor'::text, 'student'::text])))
);


--
-- Name: coverage_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coverage_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_id uuid NOT NULL,
    evidence_text text NOT NULL,
    analysis text NOT NULL,
    confidence_score integer NOT NULL,
    detection_method text NOT NULL,
    message_id uuid,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    event_id uuid,
    assessment_id uuid,
    CONSTRAINT coverage_evidence_confidence_score_check CHECK (((confidence_score >= 0) AND (confidence_score <= 100))),
    CONSTRAINT coverage_evidence_detection_method_check CHECK ((detection_method = ANY (ARRAY['ai_analysis'::text, 'tutor_manual'::text, 'student_self_assessment'::text])))
);


--
-- Name: message_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_feedback (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    room_id uuid NOT NULL,
    feedback_type text NOT NULL,
    rating integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_feedback_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['like'::text, 'dislike'::text]))),
    CONSTRAINT message_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: TABLE message_feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.message_feedback IS 'Stores user feedback for messages including like/dislike preference and 1-5 rating scale';


--
-- Name: COLUMN message_feedback.feedback_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_feedback.feedback_type IS 'User preference: like or dislike';


--
-- Name: COLUMN message_feedback.rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.message_feedback.rating IS 'Detailed rating from 1-5 scale after selecting like/dislike';


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    room_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    user_role public.user_role NOT NULL,
    ai_model_used text,
    ai_response_time_ms integer,
    parent_message_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    response_mode public.tutor_turn_mode,
    assessment_id uuid,
    assessment_options jsonb,
    assessment_lifecycle text,
    assessment_answer_message_id uuid,
    assessment_selected_option_ids text[],
    assessment_result text,
    assessment_closed_at timestamp with time zone,
    assessment_checklist_id uuid,
    assessment_item_id uuid,
    assessment_selection_type text,
    assessment_student_id uuid,
    CONSTRAINT messages_assessment_lifecycle_check CHECK (((assessment_lifecycle IS NULL) OR (assessment_lifecycle = ANY (ARRAY['delivered'::text, 'answered'::text, 'cancelled'::text, 'invalidated'::text])))),
    CONSTRAINT messages_assessment_result_check CHECK (((assessment_result IS NULL) OR (assessment_result = ANY (ARRAY['pass'::text, 'fail'::text])))),
    CONSTRAINT messages_assessment_selection_type_check CHECK (((assessment_selection_type IS NULL) OR (assessment_selection_type = ANY (ARRAY['single'::text, 'multiple'::text]))))
);


--
-- Name: room_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tutor_id uuid NOT NULL,
    template_name text NOT NULL,
    template_description text,
    title_template text NOT NULL,
    description_template text,
    image_url text,
    pre_populated_dialogue jsonb,
    ai_config_template jsonb,
    op_config_template jsonb,
    password_config jsonb,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tutor_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    ai_assistant_enabled boolean DEFAULT false NOT NULL,
    ai_assistant_model text DEFAULT 'gpt-3.5-turbo'::text,
    ai_assistant_prompt text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pre_populated_dialogue jsonb,
    op_id uuid,
    op_display_name text,
    op_avatar_url text,
    password text,
    active_response_mode public.tutor_response_mode DEFAULT 'tutoring'::public.tutor_response_mode NOT NULL,
    mode_changed_at timestamp with time zone,
    mode_change_source text,
    CONSTRAINT rooms_mode_change_source_check CHECK ((mode_change_source = ANY (ARRAY['reviewed_response'::text, 'manual_override'::text])))
);


--
-- Name: COLUMN rooms.pre_populated_dialogue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.rooms.pre_populated_dialogue IS 'Array of message objects with structure: 
  [{user_name: string, message: string, role: "student"|"tutor"|"observer", timestamp?: string}]';


--
-- Name: session_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_checklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    template_name text NOT NULL,
    session_start timestamp with time zone DEFAULT now() NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    completed_items integer DEFAULT 0 NOT NULL,
    completion_percentage numeric(5,2) DEFAULT 0.00 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    student_id uuid,
    progress_policy_version text DEFAULT 'legacy_v1'::text NOT NULL,
    CONSTRAINT session_checklists_policy_version_check CHECK (((progress_policy_version = 'legacy_v1'::text) OR ((progress_policy_version = 'transfer_v1'::text) AND (student_id IS NOT NULL))))
);


--
-- Name: TABLE session_checklists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.session_checklists IS 'Student-level checklists with support for LLM extraction and template fallback';


--
-- Name: COLUMN session_checklists.student_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_checklists.student_id IS 'Links checklist to specific student for individual progress tracking';


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    tutor_id uuid NOT NULL,
    student_id uuid,
    room_id uuid NOT NULL,
    status public.session_status DEFAULT 'active'::public.session_status NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone
);


--
-- Name: student_checklist_progress; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.student_checklist_progress AS
 SELECT sc.id AS checklist_id,
    sc.room_id,
    sc.student_id,
    sc.template_name,
    sc.completion_percentage,
    count(ci.id) AS total_active_items,
    count(
        CASE
            WHEN (ci.status = 'covered'::text) THEN 1
            ELSE NULL::integer
        END) AS covered_items,
    count(
        CASE
            WHEN (ci.status = 'partially_covered'::text) THEN 1
            ELSE NULL::integer
        END) AS partially_covered_items,
    count(
        CASE
            WHEN (ci.status = 'pending'::text) THEN 1
            ELSE NULL::integer
        END) AS pending_items,
    count(
        CASE
            WHEN (ci.area_text ~~ '[understanding]%'::text) THEN 1
            ELSE NULL::integer
        END) AS understanding_items,
    count(
        CASE
            WHEN (ci.area_text ~~ '[behavior]%'::text) THEN 1
            ELSE NULL::integer
        END) AS behavior_items
   FROM (public.session_checklists sc
     LEFT JOIN public.checklist_items ci ON (((sc.id = ci.checklist_id) AND (ci.deleted = false))))
  GROUP BY sc.id, sc.room_id, sc.student_id, sc.template_name, sc.completion_percentage;


--
-- Name: VIEW student_checklist_progress; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.student_checklist_progress IS 'Aggregated progress view with cognitive/behavioral breakdown';


--
-- Name: template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    item_text text NOT NULL,
    item_type text NOT NULL,
    priority text NOT NULL,
    suggested_understanding_threshold integer DEFAULT 75,
    description text,
    teaching_tips text,
    sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT template_items_item_type_check CHECK ((item_type = ANY (ARRAY['detection_area'::text, 'verification_step'::text]))),
    CONSTRAINT template_items_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'important'::text, 'optional'::text]))),
    CONSTRAINT template_items_suggested_understanding_threshold_check CHECK (((suggested_understanding_threshold >= 0) AND (suggested_understanding_threshold <= 100)))
);


--
-- Name: tutor_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tutor_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tutor_id uuid,
    room_id uuid,
    image_url text NOT NULL,
    filename text NOT NULL,
    file_size integer,
    upload_date timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text,
    display_name text,
    "current_role" public.user_role,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Users table for simplified authentication - users join with name and role only, no email/password required';


--
-- Name: learning_event_inbox learning_event_inbox_dedupe_key_key; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.learning_event_inbox
    ADD CONSTRAINT learning_event_inbox_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: learning_event_inbox learning_event_inbox_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.learning_event_inbox
    ADD CONSTRAINT learning_event_inbox_pkey PRIMARY KEY (event_id);


--
-- Name: transfer_assessments transfer_assessments_delivery_request_id_key; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_delivery_request_id_key UNIQUE (delivery_request_id);


--
-- Name: transfer_assessments transfer_assessments_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_pkey PRIMARY KEY (id);


--
-- Name: transfer_assessments transfer_assessments_question_message_id_key; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_question_message_id_key UNIQUE (question_message_id);


--
-- Name: transfer_assessments transfer_assessments_terminal_answer_message_id_key; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_terminal_answer_message_id_key UNIQUE (terminal_answer_message_id);


--
-- Name: ai_assistant_config_logs ai_assistant_config_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_assistant_config_logs
    ADD CONSTRAINT ai_assistant_config_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_assistant_configs ai_assistant_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_assistant_configs
    ADD CONSTRAINT ai_assistant_configs_pkey PRIMARY KEY (id);


--
-- Name: ai_assistant_configs ai_assistant_configs_room_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_assistant_configs
    ADD CONSTRAINT ai_assistant_configs_room_id_key UNIQUE (room_id);


--
-- Name: ai_suggestion_feedback ai_suggestion_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_suggestion_feedback
    ADD CONSTRAINT ai_suggestion_feedback_pkey PRIMARY KEY (id);


--
-- Name: ai_suggestion_feedback ai_suggestion_feedback_raw_instruction_mode_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.ai_suggestion_feedback
    ADD CONSTRAINT ai_suggestion_feedback_raw_instruction_mode_check CHECK (((raw_mode IS NULL) OR (raw_instruction IS NOT NULL) OR (raw_mode = 'guard'::public.tutor_turn_mode))) NOT VALID;


--
-- Name: checklist_configs checklist_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_configs
    ADD CONSTRAINT checklist_configs_pkey PRIMARY KEY (room_id);


--
-- Name: checklist_items checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_pkey PRIMARY KEY (id);


--
-- Name: checklist_templates checklist_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_name_key UNIQUE (name);


--
-- Name: checklist_templates checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: checklist_updates checklist_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_updates
    ADD CONSTRAINT checklist_updates_pkey PRIMARY KEY (id);


--
-- Name: coverage_evidence coverage_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coverage_evidence
    ADD CONSTRAINT coverage_evidence_pkey PRIMARY KEY (id);


--
-- Name: message_feedback message_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: room_templates room_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_templates
    ADD CONSTRAINT room_templates_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: session_checklists session_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_checklists
    ADD CONSTRAINT session_checklists_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: template_items template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_items
    ADD CONSTRAINT template_items_pkey PRIMARY KEY (id);


--
-- Name: tutor_images tutor_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_images
    ADD CONSTRAINT tutor_images_pkey PRIMARY KEY (id);


--
-- Name: message_feedback unique_user_message_feedback; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT unique_user_message_feedback UNIQUE (message_id, user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_unique UNIQUE (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_ai_assistant_config_logs_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_assistant_config_logs_changed_at ON public.ai_assistant_config_logs USING btree (changed_at);


--
-- Name: idx_ai_assistant_config_logs_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_assistant_config_logs_room_id ON public.ai_assistant_config_logs USING btree (room_id);


--
-- Name: idx_ai_assistant_configs_prompt_config_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_assistant_configs_prompt_config_gin ON public.ai_assistant_configs USING gin (prompt_config);


--
-- Name: idx_ai_assistant_configs_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_assistant_configs_room_id ON public.ai_assistant_configs USING btree (room_id);


--
-- Name: idx_checklist_items_checklist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_items_checklist_id ON public.checklist_items USING btree (checklist_id);


--
-- Name: idx_checklist_items_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_items_deleted ON public.checklist_items USING btree (deleted) WHERE (deleted = false);


--
-- Name: idx_checklist_items_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_items_priority ON public.checklist_items USING btree (priority);


--
-- Name: idx_checklist_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_items_status ON public.checklist_items USING btree (status);


--
-- Name: idx_checklist_updates_checklist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_updates_checklist_id ON public.checklist_updates USING btree (checklist_id);


--
-- Name: idx_checklist_updates_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checklist_updates_created_at ON public.checklist_updates USING btree (created_at);


--
-- Name: idx_coverage_evidence_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coverage_evidence_item_id ON public.coverage_evidence USING btree (item_id);


--
-- Name: idx_coverage_evidence_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coverage_evidence_timestamp ON public.coverage_evidence USING btree ("timestamp");


--
-- Name: idx_message_feedback_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_feedback_message_id ON public.message_feedback USING btree (message_id);


--
-- Name: idx_message_feedback_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_feedback_room_id ON public.message_feedback USING btree (room_id);


--
-- Name: idx_message_feedback_type_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_feedback_type_rating ON public.message_feedback USING btree (feedback_type, rating);


--
-- Name: idx_message_feedback_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_feedback_user_id ON public.message_feedback USING btree (user_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_messages_parent_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_parent_message_id ON public.messages USING btree (parent_message_id);


--
-- Name: idx_messages_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_room_id ON public.messages USING btree (room_id);


--
-- Name: idx_room_templates_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_templates_created_at ON public.room_templates USING btree (created_at);


--
-- Name: idx_room_templates_template_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_templates_template_name ON public.room_templates USING btree (template_name);


--
-- Name: idx_room_templates_tutor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_templates_tutor_id ON public.room_templates USING btree (tutor_id);


--
-- Name: idx_rooms_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_is_active ON public.rooms USING btree (is_active);


--
-- Name: idx_rooms_op_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_op_id ON public.rooms USING btree (op_id);


--
-- Name: idx_rooms_password; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_password ON public.rooms USING btree (password);


--
-- Name: idx_rooms_pre_populated_dialogue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_pre_populated_dialogue ON public.rooms USING gin (pre_populated_dialogue);


--
-- Name: idx_rooms_tutor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_tutor_id ON public.rooms USING btree (tutor_id);


--
-- Name: idx_session_checklists_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_checklists_active ON public.session_checklists USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_session_checklists_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_checklists_room_id ON public.session_checklists USING btree (room_id);


--
-- Name: idx_session_checklists_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_checklists_student_id ON public.session_checklists USING btree (student_id);


--
-- Name: idx_session_checklists_student_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_checklists_student_policy ON public.session_checklists USING btree (room_id, student_id, progress_policy_version, is_active);


--
-- Name: idx_sessions_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_room_id ON public.sessions USING btree (room_id);


--
-- Name: idx_sessions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_status ON public.sessions USING btree (status);


--
-- Name: idx_template_items_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_items_template_id ON public.template_items USING btree (template_id);


--
-- Name: idx_users_current_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_current_role ON public.users USING btree ("current_role");


--
-- Name: idx_users_display_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_display_name ON public.users USING btree (display_name);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: one_active_transfer_checklist_per_student; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_active_transfer_checklist_per_student ON public.session_checklists USING btree (room_id, student_id) WHERE ((is_active = true) AND (progress_policy_version = 'transfer_v1'::text) AND (student_id IS NOT NULL));


--
-- Name: coverage_evidence block_guard_checklist_evidence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER block_guard_checklist_evidence BEFORE INSERT OR DELETE OR UPDATE ON public.coverage_evidence FOR EACH ROW EXECUTE FUNCTION public.reject_guard_progress_mutation();


--
-- Name: checklist_items block_guard_checklist_item_updates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER block_guard_checklist_item_updates BEFORE INSERT OR DELETE OR UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.reject_guard_progress_mutation();


--
-- Name: checklist_updates block_guard_checklist_updates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER block_guard_checklist_updates BEFORE INSERT OR DELETE OR UPDATE ON public.checklist_updates FOR EACH ROW EXECUTE FUNCTION public.reject_guard_progress_mutation();


--
-- Name: session_checklists block_guard_session_checklist_progress; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER block_guard_session_checklist_progress BEFORE INSERT OR DELETE OR UPDATE ON public.session_checklists FOR EACH ROW EXECUTE FUNCTION public.reject_guard_progress_mutation();


--
-- Name: session_checklists enforce_transfer_checklist_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_transfer_checklist_state BEFORE INSERT OR DELETE OR UPDATE ON public.session_checklists FOR EACH ROW EXECUTE FUNCTION public.private_transfer_checklist_guard();


--
-- Name: coverage_evidence enforce_transfer_evidence_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_transfer_evidence_state BEFORE INSERT OR DELETE OR UPDATE ON public.coverage_evidence FOR EACH ROW EXECUTE FUNCTION public.private_transfer_evidence_guard();


--
-- Name: checklist_items enforce_transfer_item_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_transfer_item_state BEFORE INSERT OR DELETE OR UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.private_transfer_item_guard();


--
-- Name: ai_assistant_configs update_ai_assistant_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ai_assistant_configs_updated_at BEFORE UPDATE ON public.ai_assistant_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: message_feedback update_message_feedback_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_message_feedback_updated_at BEFORE UPDATE ON public.message_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: checklist_items update_progress_on_item_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_progress_on_item_change AFTER INSERT OR DELETE OR UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.trigger_update_checklist_progress();


--
-- Name: room_templates update_room_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_room_templates_updated_at BEFORE UPDATE ON public.room_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rooms update_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: learning_event_inbox learning_event_inbox_checklist_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.learning_event_inbox
    ADD CONSTRAINT learning_event_inbox_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.session_checklists(id) ON DELETE CASCADE;


--
-- Name: learning_event_inbox learning_event_inbox_item_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.learning_event_inbox
    ADD CONSTRAINT learning_event_inbox_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.checklist_items(id) ON DELETE CASCADE;


--
-- Name: learning_event_inbox learning_event_inbox_room_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.learning_event_inbox
    ADD CONSTRAINT learning_event_inbox_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: learning_event_inbox learning_event_inbox_source_message_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.learning_event_inbox
    ADD CONSTRAINT learning_event_inbox_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: learning_event_inbox learning_event_inbox_student_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.learning_event_inbox
    ADD CONSTRAINT learning_event_inbox_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transfer_assessments transfer_assessments_checklist_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.session_checklists(id);


--
-- Name: transfer_assessments transfer_assessments_focus_student_message_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_focus_student_message_id_fkey FOREIGN KEY (focus_student_message_id) REFERENCES public.messages(id);


--
-- Name: transfer_assessments transfer_assessments_item_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.checklist_items(id);


--
-- Name: transfer_assessments transfer_assessments_question_message_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_question_message_id_fkey FOREIGN KEY (question_message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: transfer_assessments transfer_assessments_room_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: transfer_assessments transfer_assessments_student_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: transfer_assessments transfer_assessments_terminal_answer_message_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.transfer_assessments
    ADD CONSTRAINT transfer_assessments_terminal_answer_message_id_fkey FOREIGN KEY (terminal_answer_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: ai_assistant_config_logs ai_assistant_config_logs_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_assistant_config_logs
    ADD CONSTRAINT ai_assistant_config_logs_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_assistant_config_logs ai_assistant_config_logs_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_assistant_config_logs
    ADD CONSTRAINT ai_assistant_config_logs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: ai_assistant_configs ai_assistant_configs_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_assistant_configs
    ADD CONSTRAINT ai_assistant_configs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: ai_suggestion_feedback ai_suggestion_feedback_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_suggestion_feedback
    ADD CONSTRAINT ai_suggestion_feedback_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: ai_suggestion_feedback ai_suggestion_feedback_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_suggestion_feedback
    ADD CONSTRAINT ai_suggestion_feedback_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: ai_suggestion_feedback ai_suggestion_feedback_tutor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_suggestion_feedback
    ADD CONSTRAINT ai_suggestion_feedback_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_suggestion_feedback ai_suggestion_feedback_tutor_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_suggestion_feedback
    ADD CONSTRAINT ai_suggestion_feedback_tutor_message_id_fkey FOREIGN KEY (tutor_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: checklist_configs checklist_configs_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_configs
    ADD CONSTRAINT checklist_configs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: checklist_items checklist_items_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.session_checklists(id) ON DELETE CASCADE;


--
-- Name: checklist_templates checklist_templates_created_by_tutor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_templates
    ADD CONSTRAINT checklist_templates_created_by_tutor_id_fkey FOREIGN KEY (created_by_tutor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: checklist_updates checklist_updates_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_updates
    ADD CONSTRAINT checklist_updates_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.session_checklists(id) ON DELETE CASCADE;


--
-- Name: checklist_updates checklist_updates_evidence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_updates
    ADD CONSTRAINT checklist_updates_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES public.coverage_evidence(id) ON DELETE SET NULL;


--
-- Name: checklist_updates checklist_updates_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_updates
    ADD CONSTRAINT checklist_updates_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.checklist_items(id) ON DELETE CASCADE;


--
-- Name: coverage_evidence coverage_evidence_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coverage_evidence
    ADD CONSTRAINT coverage_evidence_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.checklist_items(id) ON DELETE CASCADE;


--
-- Name: coverage_evidence coverage_evidence_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coverage_evidence
    ADD CONSTRAINT coverage_evidence_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: message_feedback message_feedback_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_feedback message_feedback_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: message_feedback message_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_assessment_answer_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_assessment_answer_message_id_fkey FOREIGN KEY (assessment_answer_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: messages messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: room_templates room_templates_tutor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_templates
    ADD CONSTRAINT room_templates_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: rooms rooms_op_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_op_id_fkey FOREIGN KEY (op_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rooms rooms_tutor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: session_checklists session_checklists_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_checklists
    ADD CONSTRAINT session_checklists_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: session_checklists session_checklists_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_checklists
    ADD CONSTRAINT session_checklists_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_tutor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: template_items template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_items
    ADD CONSTRAINT template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;


--
-- Name: tutor_images tutor_images_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_images
    ADD CONSTRAINT tutor_images_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: tutor_images tutor_images_tutor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tutor_images
    ADD CONSTRAINT tutor_images_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: learning_event_inbox; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.learning_event_inbox ENABLE ROW LEVEL SECURITY;

--
-- Name: transfer_assessments; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.transfer_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_assistant_config_logs Allow AI config log operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow AI config log operations" ON public.ai_assistant_config_logs USING (true);


--
-- Name: ai_assistant_configs Allow AI config management; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow AI config management" ON public.ai_assistant_configs USING (true) WITH CHECK (true);


--
-- Name: ai_suggestion_feedback Allow Guard Mode AI feedback operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow Guard Mode AI feedback operations" ON public.ai_suggestion_feedback USING (true) WITH CHECK (true);


--
-- Name: checklist_configs Allow all operations on checklist_configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on checklist_configs" ON public.checklist_configs USING (true) WITH CHECK (true);


--
-- Name: checklist_templates Allow all operations on checklist_templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on checklist_templates" ON public.checklist_templates USING (true) WITH CHECK (true);


--
-- Name: template_items Allow all operations on template_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on template_items" ON public.template_items USING (true) WITH CHECK (true);


--
-- Name: message_feedback Allow feedback operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow feedback operations" ON public.message_feedback USING (true);


--
-- Name: messages Allow message operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow message operations" ON public.messages USING (true);


--
-- Name: rooms Allow room operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow room operations" ON public.rooms USING (true);


--
-- Name: sessions Allow session operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow session operations" ON public.sessions USING (true);


--
-- Name: users Allow user profile operations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow user profile operations" ON public.users USING (true);


--
-- Name: ai_assistant_configs Anyone can view AI configs for active rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view AI configs for active rooms" ON public.ai_assistant_configs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.rooms
  WHERE ((rooms.id = ai_assistant_configs.room_id) AND (rooms.is_active = true)))));


--
-- Name: rooms Anyone can view active rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active rooms" ON public.rooms FOR SELECT USING ((is_active = true));


--
-- Name: messages Anyone can view messages in active rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view messages in active rooms" ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.rooms
  WHERE ((rooms.id = messages.room_id) AND (rooms.is_active = true)))));


--
-- Name: checklist_items Legacy browser clients can manage legacy checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Legacy browser clients can manage legacy checklist items" ON public.checklist_items TO authenticated, anon USING ((checklist_id IN ( SELECT sc.id
   FROM public.session_checklists sc
  WHERE (sc.progress_policy_version = 'legacy_v1'::text)))) WITH CHECK ((checklist_id IN ( SELECT sc.id
   FROM public.session_checklists sc
  WHERE (sc.progress_policy_version = 'legacy_v1'::text))));


--
-- Name: checklist_updates Legacy browser clients can manage legacy checklist updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Legacy browser clients can manage legacy checklist updates" ON public.checklist_updates TO authenticated, anon USING ((checklist_id IN ( SELECT sc.id
   FROM public.session_checklists sc
  WHERE (sc.progress_policy_version = 'legacy_v1'::text)))) WITH CHECK ((checklist_id IN ( SELECT sc.id
   FROM public.session_checklists sc
  WHERE (sc.progress_policy_version = 'legacy_v1'::text))));


--
-- Name: session_checklists Legacy browser clients can manage legacy checklists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Legacy browser clients can manage legacy checklists" ON public.session_checklists TO authenticated, anon USING ((progress_policy_version = 'legacy_v1'::text)) WITH CHECK ((progress_policy_version = 'legacy_v1'::text));


--
-- Name: coverage_evidence Legacy browser clients can manage legacy coverage evidence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Legacy browser clients can manage legacy coverage evidence" ON public.coverage_evidence TO authenticated, anon USING ((item_id IN ( SELECT ci.id
   FROM (public.checklist_items ci
     JOIN public.session_checklists sc ON ((sc.id = ci.checklist_id)))
  WHERE (sc.progress_policy_version = 'legacy_v1'::text)))) WITH CHECK ((item_id IN ( SELECT ci.id
   FROM (public.checklist_items ci
     JOIN public.session_checklists sc ON ((sc.id = ci.checklist_id)))
  WHERE (sc.progress_policy_version = 'legacy_v1'::text))));


--
-- Name: checklist_items Research build: checklist items are readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Research build: checklist items are readable" ON public.checklist_items FOR SELECT USING (true);


--
-- Name: checklist_items Research build: checklist items are writable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Research build: checklist items are writable" ON public.checklist_items USING (true) WITH CHECK (true);


--
-- Name: session_checklists Research build: checklists are readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Research build: checklists are readable" ON public.session_checklists FOR SELECT USING (true);


--
-- Name: session_checklists Research build: checklists are writable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Research build: checklists are writable" ON public.session_checklists USING (true) WITH CHECK (true);


--
-- Name: checklist_items Tutors can manage legacy checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tutors can manage legacy checklist items" ON public.checklist_items TO authenticated USING ((checklist_id IN ( SELECT sc.id
   FROM (public.session_checklists sc
     JOIN public.rooms r ON ((r.id = sc.room_id)))
  WHERE ((sc.progress_policy_version = 'legacy_v1'::text) AND (r.tutor_id = auth.uid()))))) WITH CHECK ((checklist_id IN ( SELECT sc.id
   FROM (public.session_checklists sc
     JOIN public.rooms r ON ((r.id = sc.room_id)))
  WHERE ((sc.progress_policy_version = 'legacy_v1'::text) AND (r.tutor_id = auth.uid())))));


--
-- Name: checklist_updates Tutors can manage legacy checklist updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tutors can manage legacy checklist updates" ON public.checklist_updates TO authenticated USING ((checklist_id IN ( SELECT sc.id
   FROM (public.session_checklists sc
     JOIN public.rooms r ON ((r.id = sc.room_id)))
  WHERE ((sc.progress_policy_version = 'legacy_v1'::text) AND (r.tutor_id = auth.uid()))))) WITH CHECK ((checklist_id IN ( SELECT sc.id
   FROM (public.session_checklists sc
     JOIN public.rooms r ON ((r.id = sc.room_id)))
  WHERE ((sc.progress_policy_version = 'legacy_v1'::text) AND (r.tutor_id = auth.uid())))));


--
-- Name: session_checklists Tutors can manage legacy checklists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tutors can manage legacy checklists" ON public.session_checklists TO authenticated USING (((progress_policy_version = 'legacy_v1'::text) AND (room_id IN ( SELECT rooms.id
   FROM public.rooms
  WHERE (rooms.tutor_id = auth.uid()))))) WITH CHECK (((progress_policy_version = 'legacy_v1'::text) AND (room_id IN ( SELECT rooms.id
   FROM public.rooms
  WHERE (rooms.tutor_id = auth.uid())))));


--
-- Name: coverage_evidence Tutors can manage legacy coverage evidence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tutors can manage legacy coverage evidence" ON public.coverage_evidence TO authenticated USING ((item_id IN ( SELECT ci.id
   FROM ((public.checklist_items ci
     JOIN public.session_checklists sc ON ((sc.id = ci.checklist_id)))
     JOIN public.rooms r ON ((r.id = sc.room_id)))
  WHERE ((sc.progress_policy_version = 'legacy_v1'::text) AND (r.tutor_id = auth.uid()))))) WITH CHECK ((item_id IN ( SELECT ci.id
   FROM ((public.checklist_items ci
     JOIN public.session_checklists sc ON ((sc.id = ci.checklist_id)))
     JOIN public.rooms r ON ((r.id = sc.room_id)))
  WHERE ((sc.progress_policy_version = 'legacy_v1'::text) AND (r.tutor_id = auth.uid())))));


--
-- Name: tutor_images Tutors can manage their own images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tutors can manage their own images" ON public.tutor_images USING ((tutor_id = auth.uid()));


--
-- Name: room_templates Tutors can manage their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Tutors can manage their own templates" ON public.room_templates USING (((tutor_id = auth.uid()) OR (tutor_id IS NULL)));


--
-- Name: users Users can view all user profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all user profiles" ON public.users FOR SELECT USING (true);


--
-- Name: checklist_items Users can view checklist items for accessible rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view checklist items for accessible rooms" ON public.checklist_items FOR SELECT USING ((checklist_id IN ( SELECT sc.id
   FROM public.session_checklists sc
  WHERE (((sc.progress_policy_version = 'legacy_v1'::text) AND (sc.room_id IN ( SELECT rooms.id
           FROM public.rooms
          WHERE (rooms.tutor_id = auth.uid())
        UNION
         SELECT sessions.room_id
           FROM public.sessions
          WHERE ((sessions.student_id = auth.uid()) OR (sessions.tutor_id = auth.uid()))))) OR ((sc.progress_policy_version = 'transfer_v1'::text) AND ((sc.student_id = auth.uid()) OR (sc.room_id IN ( SELECT rooms.id
           FROM public.rooms
          WHERE (rooms.tutor_id = auth.uid())))))))));


--
-- Name: session_checklists Users can view checklists for rooms they have access to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view checklists for rooms they have access to" ON public.session_checklists FOR SELECT USING ((((progress_policy_version = 'legacy_v1'::text) AND (room_id IN ( SELECT rooms.id
   FROM public.rooms
  WHERE (rooms.tutor_id = auth.uid())
UNION
 SELECT sessions.room_id
   FROM public.sessions
  WHERE ((sessions.student_id = auth.uid()) OR (sessions.tutor_id = auth.uid()))))) OR ((progress_policy_version = 'transfer_v1'::text) AND ((student_id = auth.uid()) OR (room_id IN ( SELECT rooms.id
   FROM public.rooms
  WHERE (rooms.tutor_id = auth.uid())))))));


--
-- Name: coverage_evidence Users can view evidence for accessible checklist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view evidence for accessible checklist items" ON public.coverage_evidence FOR SELECT USING ((item_id IN ( SELECT ci.id
   FROM (public.checklist_items ci
     JOIN public.session_checklists sc ON ((ci.checklist_id = sc.id)))
  WHERE (((sc.progress_policy_version = 'legacy_v1'::text) AND (sc.room_id IN ( SELECT rooms.id
           FROM public.rooms
          WHERE (rooms.tutor_id = auth.uid())
        UNION
         SELECT sessions.room_id
           FROM public.sessions
          WHERE ((sessions.student_id = auth.uid()) OR (sessions.tutor_id = auth.uid()))))) OR ((sc.progress_policy_version = 'transfer_v1'::text) AND ((sc.student_id = auth.uid()) OR (sc.room_id IN ( SELECT rooms.id
           FROM public.rooms
          WHERE (rooms.tutor_id = auth.uid())))))))));


--
-- Name: tutor_images Users can view images in accessible rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view images in accessible rooms" ON public.tutor_images FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.rooms r
  WHERE ((r.id = tutor_images.room_id) AND ((r.tutor_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.sessions s
          WHERE ((s.room_id = r.id) AND (s.student_id = auth.uid())))))))));


--
-- Name: checklist_updates Users can view updates for accessible checklists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view updates for accessible checklists" ON public.checklist_updates FOR SELECT USING ((checklist_id IN ( SELECT sc.id
   FROM public.session_checklists sc
  WHERE (((sc.progress_policy_version = 'legacy_v1'::text) AND (sc.room_id IN ( SELECT rooms.id
           FROM public.rooms
          WHERE (rooms.tutor_id = auth.uid())
        UNION
         SELECT sessions.room_id
           FROM public.sessions
          WHERE ((sessions.student_id = auth.uid()) OR (sessions.tutor_id = auth.uid()))))) OR ((sc.progress_policy_version = 'transfer_v1'::text) AND ((sc.student_id = auth.uid()) OR (sc.room_id IN ( SELECT rooms.id
           FROM public.rooms
          WHERE (rooms.tutor_id = auth.uid())))))))));


--
-- Name: ai_assistant_config_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_assistant_config_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_assistant_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_assistant_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_suggestion_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_suggestion_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: checklist_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checklist_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: coverage_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coverage_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: message_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: room_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.room_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: session_checklists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_checklists ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: template_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;

--
-- Name: tutor_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tutor_images ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION add_conversation_context(p_room_id uuid, p_role text, p_content text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.add_conversation_context(p_room_id uuid, p_role text, p_content text) TO anon;
GRANT ALL ON FUNCTION public.add_conversation_context(p_room_id uuid, p_role text, p_content text) TO authenticated;
GRANT ALL ON FUNCTION public.add_conversation_context(p_room_id uuid, p_role text, p_content text) TO service_role;


--
-- Name: FUNCTION apply_learning_event_v1(p_event jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.apply_learning_event_v1(p_event jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_learning_event_v1(p_event jsonb) TO service_role;


--
-- Name: FUNCTION create_room_template(p_tutor_id uuid, p_template_name text, p_template_description text, p_title_template text, p_description_template text, p_image_url text, p_pre_populated_dialogue jsonb, p_ai_config_template jsonb, p_op_config_template jsonb, p_password_config jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_room_template(p_tutor_id uuid, p_template_name text, p_template_description text, p_title_template text, p_description_template text, p_image_url text, p_pre_populated_dialogue jsonb, p_ai_config_template jsonb, p_op_config_template jsonb, p_password_config jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_room_template(p_tutor_id uuid, p_template_name text, p_template_description text, p_title_template text, p_description_template text, p_image_url text, p_pre_populated_dialogue jsonb, p_ai_config_template jsonb, p_op_config_template jsonb, p_password_config jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_room_template(p_tutor_id uuid, p_template_name text, p_template_description text, p_title_template text, p_description_template text, p_image_url text, p_pre_populated_dialogue jsonb, p_ai_config_template jsonb, p_op_config_template jsonb, p_password_config jsonb) TO service_role;


--
-- Name: FUNCTION extract_checklist_from_prompt(p_system_prompt text, p_room_id uuid, p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.extract_checklist_from_prompt(p_system_prompt text, p_room_id uuid, p_student_id uuid) TO anon;
GRANT ALL ON FUNCTION public.extract_checklist_from_prompt(p_system_prompt text, p_room_id uuid, p_student_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.extract_checklist_from_prompt(p_system_prompt text, p_room_id uuid, p_student_id uuid) TO service_role;


--
-- Name: FUNCTION get_room_templates_by_tutor(p_tutor_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_room_templates_by_tutor(p_tutor_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_room_templates_by_tutor(p_tutor_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_room_templates_by_tutor(p_tutor_id uuid) TO service_role;


--
-- Name: FUNCTION initialize_ai_assistant(p_room_id uuid, p_model_name text, p_system_prompt text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.initialize_ai_assistant(p_room_id uuid, p_model_name text, p_system_prompt text) TO anon;
GRANT ALL ON FUNCTION public.initialize_ai_assistant(p_room_id uuid, p_model_name text, p_system_prompt text) TO authenticated;
GRANT ALL ON FUNCTION public.initialize_ai_assistant(p_room_id uuid, p_model_name text, p_system_prompt text) TO service_role;


--
-- Name: FUNCTION initialize_checklist_from_template(p_room_id uuid, p_template_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_template_name text) TO anon;
GRANT ALL ON FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_template_name text) TO authenticated;
GRANT ALL ON FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_template_name text) TO service_role;


--
-- Name: FUNCTION initialize_checklist_from_template(p_room_id uuid, p_student_id uuid, p_template_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_student_id uuid, p_template_name text) TO anon;
GRANT ALL ON FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_student_id uuid, p_template_name text) TO authenticated;
GRANT ALL ON FUNCTION public.initialize_checklist_from_template(p_room_id uuid, p_student_id uuid, p_template_name text) TO service_role;


--
-- Name: FUNCTION initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_template_name text, p_actor_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_template_name text, p_actor_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_transfer_checklist_v1(p_room_id uuid, p_student_id uuid, p_template_name text, p_actor_id uuid) TO service_role;


--
-- Name: FUNCTION post_assessment_message_v1(p_room_id uuid, p_content text, p_parent_message_id uuid, p_assessment_id uuid, p_actor_id uuid, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_assessment_message_v1(p_room_id uuid, p_content text, p_parent_message_id uuid, p_assessment_id uuid, p_actor_id uuid, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_assessment_message_v1(p_room_id uuid, p_content text, p_parent_message_id uuid, p_assessment_id uuid, p_actor_id uuid, p_request_id uuid) TO service_role;


--
-- Name: FUNCTION prepare_transfer_turn_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prepare_transfer_turn_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_transfer_turn_v1(p_room_id uuid, p_focus_student_message_id uuid, p_checklist_id uuid, p_actor_id uuid, p_request_id uuid) TO service_role;


--
-- Name: FUNCTION private_transfer_checklist_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.private_transfer_checklist_guard() TO anon;
GRANT ALL ON FUNCTION public.private_transfer_checklist_guard() TO authenticated;
GRANT ALL ON FUNCTION public.private_transfer_checklist_guard() TO service_role;


--
-- Name: FUNCTION private_transfer_evidence_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.private_transfer_evidence_guard() TO anon;
GRANT ALL ON FUNCTION public.private_transfer_evidence_guard() TO authenticated;
GRANT ALL ON FUNCTION public.private_transfer_evidence_guard() TO service_role;


--
-- Name: FUNCTION private_transfer_item_guard(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.private_transfer_item_guard() TO anon;
GRANT ALL ON FUNCTION public.private_transfer_item_guard() TO authenticated;
GRANT ALL ON FUNCTION public.private_transfer_item_guard() TO service_role;


--
-- Name: FUNCTION process_assessment_message_v1(p_message_id uuid, p_actor_id uuid, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.process_assessment_message_v1(p_message_id uuid, p_actor_id uuid, p_request_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION reject_assessment_key_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reject_assessment_key_update() TO anon;
GRANT ALL ON FUNCTION public.reject_assessment_key_update() TO authenticated;
GRANT ALL ON FUNCTION public.reject_assessment_key_update() TO service_role;


--
-- Name: FUNCTION reject_guard_progress_mutation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reject_guard_progress_mutation() TO anon;
GRANT ALL ON FUNCTION public.reject_guard_progress_mutation() TO authenticated;
GRANT ALL ON FUNCTION public.reject_guard_progress_mutation() TO service_role;


--
-- Name: FUNCTION send_reviewed_tutor_response(p_room_id uuid, p_tutor_id uuid, p_parent_message_id uuid, p_content text, p_raw_mode public.tutor_response_mode, p_raw_instruction text, p_mode_reason text, p_final_mode public.tutor_response_mode, p_ai_suggestion text, p_tutor_action text, p_response_time_ms integer, p_context_messages jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_reviewed_tutor_response(p_room_id uuid, p_tutor_id uuid, p_parent_message_id uuid, p_content text, p_raw_mode public.tutor_response_mode, p_raw_instruction text, p_mode_reason text, p_final_mode public.tutor_response_mode, p_ai_suggestion text, p_tutor_action text, p_response_time_ms integer, p_context_messages jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_reviewed_tutor_response(p_room_id uuid, p_tutor_id uuid, p_parent_message_id uuid, p_content text, p_raw_mode public.tutor_response_mode, p_raw_instruction text, p_mode_reason text, p_final_mode public.tutor_response_mode, p_ai_suggestion text, p_tutor_action text, p_response_time_ms integer, p_context_messages jsonb) TO service_role;
GRANT ALL ON FUNCTION public.send_reviewed_tutor_response(p_room_id uuid, p_tutor_id uuid, p_parent_message_id uuid, p_content text, p_raw_mode public.tutor_response_mode, p_raw_instruction text, p_mode_reason text, p_final_mode public.tutor_response_mode, p_ai_suggestion text, p_tutor_action text, p_response_time_ms integer, p_context_messages jsonb) TO anon;
GRANT ALL ON FUNCTION public.send_reviewed_tutor_response(p_room_id uuid, p_tutor_id uuid, p_parent_message_id uuid, p_content text, p_raw_mode public.tutor_response_mode, p_raw_instruction text, p_mode_reason text, p_final_mode public.tutor_response_mode, p_ai_suggestion text, p_tutor_action text, p_response_time_ms integer, p_context_messages jsonb) TO authenticated;


--
-- Name: FUNCTION send_reviewed_tutor_response_v3(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_reviewed_tutor_response_v3(p_reviewed_payload jsonb, p_room_id uuid, p_student_id uuid, p_checklist_id uuid, p_item_id uuid, p_focus_student_message_id uuid, p_actor_id uuid, p_request_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION soft_delete_checklist_item(p_item_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.soft_delete_checklist_item(p_item_id uuid) TO anon;
GRANT ALL ON FUNCTION public.soft_delete_checklist_item(p_item_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.soft_delete_checklist_item(p_item_id uuid) TO service_role;


--
-- Name: FUNCTION trigger_update_checklist_progress(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trigger_update_checklist_progress() TO anon;
GRANT ALL ON FUNCTION public.trigger_update_checklist_progress() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_update_checklist_progress() TO service_role;


--
-- Name: FUNCTION update_checklist_progress(p_checklist_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_checklist_progress(p_checklist_id uuid) TO anon;
GRANT ALL ON FUNCTION public.update_checklist_progress(p_checklist_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_checklist_progress(p_checklist_id uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE learning_event_inbox; Type: ACL; Schema: private; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE private.learning_event_inbox TO service_role;


--
-- Name: TABLE transfer_assessments; Type: ACL; Schema: private; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE private.transfer_assessments TO service_role;


--
-- Name: TABLE checklist_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.checklist_items TO anon;
GRANT ALL ON TABLE public.checklist_items TO authenticated;
GRANT ALL ON TABLE public.checklist_items TO service_role;


--
-- Name: TABLE active_checklist_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.active_checklist_items TO anon;
GRANT ALL ON TABLE public.active_checklist_items TO authenticated;
GRANT ALL ON TABLE public.active_checklist_items TO service_role;


--
-- Name: TABLE ai_assistant_config_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_assistant_config_logs TO anon;
GRANT ALL ON TABLE public.ai_assistant_config_logs TO authenticated;
GRANT ALL ON TABLE public.ai_assistant_config_logs TO service_role;


--
-- Name: TABLE ai_assistant_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_assistant_configs TO anon;
GRANT ALL ON TABLE public.ai_assistant_configs TO authenticated;
GRANT ALL ON TABLE public.ai_assistant_configs TO service_role;


--
-- Name: TABLE ai_suggestion_feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_suggestion_feedback TO anon;
GRANT ALL ON TABLE public.ai_suggestion_feedback TO authenticated;
GRANT ALL ON TABLE public.ai_suggestion_feedback TO service_role;


--
-- Name: TABLE checklist_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.checklist_configs TO anon;
GRANT ALL ON TABLE public.checklist_configs TO authenticated;
GRANT ALL ON TABLE public.checklist_configs TO service_role;


--
-- Name: TABLE checklist_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.checklist_templates TO anon;
GRANT ALL ON TABLE public.checklist_templates TO authenticated;
GRANT ALL ON TABLE public.checklist_templates TO service_role;


--
-- Name: TABLE checklist_updates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.checklist_updates TO anon;
GRANT ALL ON TABLE public.checklist_updates TO authenticated;
GRANT ALL ON TABLE public.checklist_updates TO service_role;


--
-- Name: TABLE coverage_evidence; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.coverage_evidence TO anon;
GRANT ALL ON TABLE public.coverage_evidence TO authenticated;
GRANT ALL ON TABLE public.coverage_evidence TO service_role;


--
-- Name: TABLE message_feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.message_feedback TO anon;
GRANT ALL ON TABLE public.message_feedback TO authenticated;
GRANT ALL ON TABLE public.message_feedback TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE room_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.room_templates TO anon;
GRANT ALL ON TABLE public.room_templates TO authenticated;
GRANT ALL ON TABLE public.room_templates TO service_role;


--
-- Name: TABLE rooms; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rooms TO anon;
GRANT ALL ON TABLE public.rooms TO authenticated;
GRANT ALL ON TABLE public.rooms TO service_role;


--
-- Name: TABLE session_checklists; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.session_checklists TO anon;
GRANT ALL ON TABLE public.session_checklists TO authenticated;
GRANT ALL ON TABLE public.session_checklists TO service_role;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sessions TO anon;
GRANT ALL ON TABLE public.sessions TO authenticated;
GRANT ALL ON TABLE public.sessions TO service_role;


--
-- Name: TABLE student_checklist_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_checklist_progress TO anon;
GRANT ALL ON TABLE public.student_checklist_progress TO authenticated;
GRANT ALL ON TABLE public.student_checklist_progress TO service_role;


--
-- Name: TABLE template_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.template_items TO anon;
GRANT ALL ON TABLE public.template_items TO authenticated;
GRANT ALL ON TABLE public.template_items TO service_role;


--
-- Name: TABLE tutor_images; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tutor_images TO anon;
GRANT ALL ON TABLE public.tutor_images TO authenticated;
GRANT ALL ON TABLE public.tutor_images TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--
