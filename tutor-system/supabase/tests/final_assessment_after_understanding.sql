--!/usr/bin/env psql
-- Test responsibility: final-assessment RPC scheduling, delivery, grading, recovery, and role boundaries.
-- Run with psql -v ON_ERROR_STOP=1; all fixtures and helper functions are rolled back.
BEGIN;

CREATE FUNCTION pg_temp.analyze_final_target(
  room_id uuid, student_id uuid, tutor_id uuid, item_id uuid,
  kind text, protection boolean, correction boolean
) RETURNS uuid LANGUAGE plpgsql AS $function$
DECLARE
  message_id uuid := gen_random_uuid();
  evidence text := 'I will verify independently through the official app.';
BEGIN
  INSERT INTO public.messages(id, room_id, user_id, user_role, content, created_at)
  VALUES (message_id, room_id, student_id, 'student', evidence, clock_timestamp());
  PERFORM public.apply_transfer_message_analysis_v1(
    room_id, message_id, tutor_id, gen_random_uuid(), jsonb_build_object(
      'events', CASE WHEN kind IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
        'item_id', item_id, 'kind', kind, 'evidence_type', 'explanation',
        'evidence_message_id', message_id, 'evidence_quote', evidence,
        'explanation', 'Accepted fixture evidence for the requested transition.'
      )) END,
      'requires_protection', protection, 'requires_correction', correction,
      'explanation', 'Deterministic fixture analysis.'
    )
  );
  RETURN message_id;
END;
$function$;

CREATE FUNCTION pg_temp.expect_final_due(
  room_id uuid, focus_id uuid, checklist_id uuid, tutor_id uuid, expected_item uuid, label text
) RETURNS void LANGUAGE plpgsql AS $function$
DECLARE
  result jsonb;
BEGIN
  result := public.prepare_transfer_assessment_context_v1(
    room_id, focus_id, checklist_id, tutor_id, gen_random_uuid()
  );
  IF (result->>'selected_target_item_id')::uuid IS DISTINCT FROM expected_item
    OR (result->>'no_assessment_due')::boolean IS DISTINCT FROM (expected_item IS NULL) THEN
    RAISE EXCEPTION '%: unexpected assessment readiness: %', label, result;
  END IF;
END;
$function$;

CREATE FUNCTION pg_temp.deliver_final_assessment(
  room_id uuid, student_id uuid, checklist_id uuid, item_id uuid,
  focus_id uuid, evidence_id uuid, tutor_id uuid, changed_context text
) RETURNS jsonb LANGUAGE plpgsql AS $function$
BEGIN
  RETURN public.send_reviewed_transfer_assessment_v1(
    jsonb_build_object('target_item_id', item_id, 'reason', 'Verify developed understanding.',
      'assessment', jsonb_build_object(
        'selection_type', 'single', 'stem', 'Which action verifies this new request independently?',
        'options', '[{"id":"A","text":"Reply"},{"id":"B","text":"Use the official app"},{"id":"C","text":"Pay immediately"},{"id":"D","text":"Forward"}]'::jsonb,
        'correct_option_ids', '["B"]'::jsonb,
        'learner_safe_explanation', 'Use a separate trusted channel.',
        'transfer_basis', jsonb_build_object(
          'concept_rule', 'Independent verification', 'source_context', 'Account warning email',
          'changed_context', changed_context,
          'source_evidence_message_ids', jsonb_build_array(evidence_id)
        )
      )
    ), room_id, student_id, checklist_id, item_id, focus_id, tutor_id, gen_random_uuid()
  );
END;
$function$;

DO $test$
DECLARE
  scenario text;
  tutor uuid;
  student uuid;
  room uuid;
  checklist uuid;
  item uuid;
  focus uuid;
  evidence uuid;
  assessment uuid;
  question uuid;
  answer uuid;
  result jsonb;
  replay jsonb;
  denied boolean;
  role_name text;
  rpc regprocedure;
BEGIN
  FOREACH scenario IN ARRAY ARRAY[
    'partial', 'existing_knowledge', 'spontaneous', 'protection', 'correction',
    'guard', 'pass', 'retry_pass', 'failure_repair', 'contradiction', 'invalid_state',
    'metadata', 'target_edit', 'stale_open', 'guard_terminal', 'guard_stale_terminal', 'guard_changed_target'
  ] LOOP
    tutor := gen_random_uuid(); student := gen_random_uuid(); room := gen_random_uuid();
    checklist := gen_random_uuid(); item := gen_random_uuid();
    INSERT INTO public.users(id, email, display_name, "current_role", status) VALUES
      (tutor, tutor || '@example.invalid', 'Final assessment tutor', 'tutor', 'active'),
      (student, student || '@example.invalid', 'Final assessment learner', 'student', 'active');
    INSERT INTO public.rooms(id, tutor_id, title, transfer_learning_enabled)
    VALUES (room, tutor, 'Final assessment ' || scenario, true);
    INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
    VALUES (tutor, student, room, 'active');
    PERFORM set_config('app.transfer_operation', 'on', true);
    INSERT INTO public.session_checklists(id, room_id, student_id, template_name, progress_policy_version)
    VALUES (checklist, room, student, 'Final assessment fixture', 'transfer_v1');
    INSERT INTO public.checklist_items(id, checklist_id, area_text, item_type, priority, status, understanding_level)
    VALUES (item, checklist, 'Explain independent verification', 'understanding', 'critical', 'pending', 'none');

    IF scenario IN ('existing_knowledge', 'spontaneous') THEN
      focus := pg_temp.analyze_final_target(room, student, tutor, item,
        CASE WHEN scenario = 'existing_knowledge' THEN 'demonstrated_understanding' ELSE 'spontaneous_transfer' END,
        false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, scenario);
      IF NOT EXISTS (SELECT 1 FROM public.checklist_items WHERE id = item AND status = 'covered' AND understanding_level = 'good') THEN
        RAISE EXCEPTION '% did not complete directly', scenario;
      END IF;
      RAISE NOTICE 'PASS: %', scenario;
      CONTINUE;
    END IF;

    focus := pg_temp.analyze_final_target(room, student, tutor, item, 'initial_signal', false, false);
    PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'initial signal continues tutoring');
    IF scenario = 'partial' THEN
      denied := false;
      BEGIN
        PERFORM pg_temp.deliver_final_assessment(room, student, checklist, item, focus, focus, tutor, 'Payment warning text');
      EXCEPTION WHEN raise_exception THEN denied := SQLERRM = 'ASSESSMENT_NOT_ELIGIBLE'; END;
      IF NOT denied THEN RAISE EXCEPTION 'Partial target accepted assessment delivery'; END IF;
      RAISE NOTICE 'PASS: partial';
      CONTINUE;
    END IF;

    IF scenario IN ('guard', 'guard_changed_target') THEN
      UPDATE public.rooms SET active_response_mode = 'guard' WHERE id = room;
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'demonstrated_understanding', false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'Guard defers understanding and assessment');
      IF NOT EXISTS (SELECT 1 FROM public.checklist_items WHERE id = item AND status = 'partially_covered') THEN
        RAISE EXCEPTION 'Guard changed progress before replay';
      END IF;
      IF scenario = 'guard_changed_target' THEN
        -- Target text is editable independently of the Guard-locked progress fields.
        UPDATE public.checklist_items SET area_text = 'Explain a different learning target' WHERE id = item;
        UPDATE public.rooms SET active_response_mode = 'tutoring' WHERE id = room;
        IF NOT EXISTS (SELECT 1 FROM private.learning_event_inbox
          WHERE item_id = item AND event_kind = 'demonstrated_understanding'
            AND processing_state = 'rejected' AND error_code = 'INVALID_TRANSITION' AND applied_at IS NULL
            AND event_payload->>'target_area_text' = 'Explain independent verification')
          OR NOT EXISTS (SELECT 1 FROM public.checklist_items WHERE id = item AND status = 'partially_covered') THEN
          RAISE EXCEPTION 'Guard replay applied prior evidence to an edited target';
        END IF;
        focus := pg_temp.analyze_final_target(room, student, tutor, item, NULL, false, false);
        PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'edited target has no readiness from deferred evidence');
        RAISE NOTICE 'PASS: guard_changed_target';
        CONTINUE;
      END IF;
      UPDATE public.rooms SET active_response_mode = 'tutoring' WHERE id = room;
      focus := pg_temp.analyze_final_target(room, student, tutor, item, NULL, false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, item, 'Guard replay preserves final assessment requirement');
      IF (SELECT count(*) FROM public.checklist_updates u JOIN private.learning_event_inbox e ON e.event_id = u.event_id
        WHERE u.item_id = item AND e.event_kind = 'demonstrated_understanding') <> 1 THEN
        RAISE EXCEPTION 'Guard replay lost or duplicated understanding transition';
      END IF;
      RAISE NOTICE 'PASS: guard';
      CONTINUE;
    END IF;

    focus := pg_temp.analyze_final_target(room, student, tutor, item, 'demonstrated_understanding',
      scenario = 'protection', scenario = 'correction');
    evidence := focus;
    IF scenario IN ('protection', 'correction') THEN
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, scenario || ' blocks assessment');
      focus := pg_temp.analyze_final_target(room, student, tutor, item, NULL, false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, item, scenario || ' deferral survives later no-event message');
      result := pg_temp.deliver_final_assessment(room, student, checklist, item, focus, evidence, tutor, 'Payment warning text');
      IF result->'message'->>'id' IS NULL THEN RAISE EXCEPTION 'Deferred assessment was not delivered'; END IF;
      RAISE NOTICE 'PASS: %', scenario;
      CONTINUE;
    END IF;

    PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, item, 'developed understanding is due');
    IF scenario = 'target_edit' THEN
      PERFORM public.edit_room_checklist_v1(room, tutor, gen_random_uuid(), 'edit_item', item,
        '{"area_text":"Explain a different learning target"}');
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'target edit invalidates prior evidence');
      RAISE NOTICE 'PASS: target_edit';
      CONTINUE;
    END IF;
    IF scenario = 'metadata' THEN
      PERFORM public.edit_room_checklist_v1(room, tutor, gen_random_uuid(), 'edit_item', item,
        '{"tutor_notes":"Review independent channels"}');
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, item, 'notes preserve readiness');
      PERFORM public.edit_room_checklist_v1(room, tutor, gen_random_uuid(), 'set_priority', item,
        '{"priority":"important"}');
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, item, 'priority preserves readiness');
    END IF;
    IF scenario = 'contradiction' THEN
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'contradiction', false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'contradiction invalidates readiness');
      denied := false;
      BEGIN
        PERFORM pg_temp.deliver_final_assessment(room, student, checklist, item, evidence, evidence, tutor, 'Payment warning text');
      EXCEPTION WHEN raise_exception THEN denied := SQLERRM = 'ASSESSMENT_NOT_ELIGIBLE'; END;
      IF NOT denied OR EXISTS (SELECT 1 FROM private.transfer_assessments WHERE item_id = item) THEN
        RAISE EXCEPTION 'Stale assessment draft survived contradiction';
      END IF;
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'post_repair_signal', false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'repair alone does not resurrect old readiness');
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'spontaneous_transfer', false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'spontaneous recovery bypasses final assessment');
      RAISE NOTICE 'PASS: contradiction';
      CONTINUE;
    END IF;

    result := pg_temp.deliver_final_assessment(room, student, checklist, item, focus, evidence, tutor, 'Payment warning text');
    question := (result->'message'->>'id')::uuid;
    SELECT id INTO STRICT assessment FROM private.transfer_assessments WHERE question_message_id = question;
    PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'open assessment blocks duplicate delivery');

    IF scenario = 'metadata' THEN
      PERFORM public.edit_room_checklist_v1(room, tutor, gen_random_uuid(), 'edit_item', item,
        '{"tutor_notes":"A later note must not invalidate the question"}');
      PERFORM public.edit_room_checklist_v1(room, tutor, gen_random_uuid(), 'set_priority', item,
        '{"priority":"optional"}');
      IF NOT EXISTS (SELECT 1 FROM private.transfer_assessments a
        WHERE a.id = assessment AND a.lifecycle = 'open'
          AND a.progress_snapshot_hash = private.transfer_item_hash(item)) THEN
        RAISE EXCEPTION 'Metadata edits invalidated delivered question';
      END IF;
    END IF;

    IF scenario = 'stale_open' THEN
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'contradiction', false, false);
      IF NOT EXISTS (SELECT 1 FROM private.transfer_assessments WHERE id = assessment AND lifecycle = 'cancelled')
        OR NOT EXISTS (SELECT 1 FROM public.messages WHERE id = question AND assessment_lifecycle = 'cancelled') THEN
        RAISE EXCEPTION 'Changed target left an open stale question';
      END IF;
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'post_repair_signal', false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'repair after cancelled question continues tutoring');
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'demonstrated_understanding', false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, item, 'cancelled question does not block new learning cycle');
      PERFORM pg_temp.deliver_final_assessment(room, student, checklist, item, focus, focus, tutor, 'New delivery warning');
      RAISE NOTICE 'PASS: stale_open';
      CONTINUE;
    END IF;

    IF scenario = 'invalid_state' THEN
      result := public.post_assessment_message_v2(room, 'B', question, assessment, ARRAY['B'], student, gen_random_uuid());
      answer := (result->'message'->>'id')::uuid;
      PERFORM public.edit_room_checklist_v1(room, tutor, gen_random_uuid(), 'set_status', item, '{"status":"partially_covered"}');
      denied := false;
      BEGIN
        result := public.process_assessment_message_v2(assessment, answer, student, gen_random_uuid(), 0, 'open', 'passed', ARRAY['B'],
          '{"status":"covered","understanding_level":"good"}', 'assessment_pass');
        denied := result->>'code' = 'CONCURRENT_MODIFICATION';
      EXCEPTION WHEN raise_exception THEN denied := SQLERRM IN ('INVALID_TRANSITION', 'INVALID_ATTEMPT_TRANSITION'); END;
      IF NOT denied OR EXISTS (SELECT 1 FROM private.transfer_assessment_attempts WHERE assessment_id = assessment)
        OR NOT EXISTS (SELECT 1 FROM public.checklist_items WHERE id = item AND status = 'partially_covered') THEN
        RAISE EXCEPTION 'Non-covered grading was not rejected atomically';
      END IF;
      RAISE NOTICE 'PASS: invalid_state';
      CONTINUE;
    END IF;

    IF scenario IN ('guard_terminal', 'guard_stale_terminal') THEN
      UPDATE public.rooms SET active_response_mode = 'guard' WHERE id = room;
      IF scenario = 'guard_stale_terminal' THEN
        focus := pg_temp.analyze_final_target(room, student, tutor, item, 'contradiction', false, false);
      END IF;
      result := public.post_assessment_message_v2(room, 'B', question, assessment, ARRAY['B'], student, gen_random_uuid());
      answer := (result->'message'->>'id')::uuid;
      result := public.process_assessment_message_v2(assessment, answer, student, gen_random_uuid(), 0, 'open', 'passed', ARRAY['B'],
        '{"status":"covered","understanding_level":"good"}', 'assessment_pass');
      IF result->>'processing_state' IS DISTINCT FROM 'deferred' THEN
        RAISE EXCEPTION 'Guard terminal result did not defer';
      END IF;
      UPDATE public.rooms SET active_response_mode = 'tutoring' WHERE id = room;
      IF scenario = 'guard_stale_terminal' THEN
        IF NOT EXISTS (SELECT 1 FROM private.transfer_assessment_attempts
          WHERE assessment_id = assessment AND processing_state = 'rejected'
            AND authoritative_result->>'code' = 'INVALID_TRANSITION')
          OR EXISTS (SELECT 1 FROM public.checklist_updates WHERE assessment_id = assessment)
          OR NOT EXISTS (SELECT 1 FROM public.checklist_items WHERE id = item AND status = 'needs_review')
          OR NOT EXISTS (SELECT 1 FROM private.transfer_assessments WHERE id = assessment AND lifecycle = 'cancelled') THEN
          RAISE EXCEPTION 'Guard replay applied a terminal result to changed progress';
        END IF;
        result := public.get_transfer_assessment_processing_context_v1(assessment, answer, student);
        IF result->'authoritative_result'->>'answer_outcome' IS NOT NULL
          OR result->'authoritative_result'->>'transition' IS NOT NULL
          OR result->'authoritative_result'->>'terminal_failure_feedback' IS NOT NULL
          OR result->'authoritative_result'->>'feedback_required' IS DISTINCT FROM 'false'
          OR result->'authoritative_result'->>'attempts_used' IS DISTINCT FROM '1' THEN
          RAISE EXCEPTION 'Cancelled Guard result still reports a pass or failure: %', result;
        END IF;
        result := public.process_assessment_message_v2(assessment, answer, student, gen_random_uuid(), 0, 'open', 'passed', ARRAY['B'],
          '{"status":"covered","understanding_level":"good"}', 'assessment_pass');
        IF result->>'processing_state' IS DISTINCT FROM 'duplicate'
          OR result->>'answer_outcome' IS NOT NULL OR result->>'transition' IS NOT NULL THEN
          RAISE EXCEPTION 'Rejected answer replay reports a completed assessment: %', result;
        END IF;
      ELSE
        IF NOT EXISTS (SELECT 1 FROM private.transfer_assessment_attempts
          WHERE assessment_id = assessment AND processing_state = 'applied')
          OR (SELECT count(*) FROM public.checklist_updates WHERE assessment_id = assessment) <> 1 THEN
          RAISE EXCEPTION 'Unchanged Guard terminal replay lost completion history';
        END IF;
      END IF;
      RAISE NOTICE 'PASS: %', scenario;
      CONTINUE;
    END IF;

    IF scenario IN ('retry_pass', 'failure_repair') THEN
      result := public.post_assessment_message_v2(room, 'A', question, assessment, ARRAY['A'], student, gen_random_uuid());
      answer := (result->'message'->>'id')::uuid;
      result := public.process_assessment_message_v2(assessment, answer, student, gen_random_uuid(), 0, 'open', 'retry', ARRAY['A'],
        '{"status":"covered","understanding_level":"good"}', NULL);
      IF result->>'answer_outcome' IS DISTINCT FROM 'retry'
        OR NOT EXISTS (SELECT 1 FROM public.checklist_items WHERE id = item AND status = 'covered')
        OR NOT EXISTS (SELECT 1 FROM private.transfer_assessments WHERE id = assessment AND lifecycle = 'open' AND attempt_count = 1) THEN
        RAISE EXCEPTION 'First incorrect answer did not retain Covered and the open assessment';
      END IF;
    END IF;

    result := public.post_assessment_message_v2(room, CASE WHEN scenario = 'failure_repair' THEN 'A' ELSE 'B' END,
      question, assessment, CASE WHEN scenario = 'failure_repair' THEN ARRAY['A'] ELSE ARRAY['B'] END, student, gen_random_uuid());
    answer := (result->'message'->>'id')::uuid;
    result := public.process_assessment_message_v2(assessment, answer, student, gen_random_uuid(),
      CASE WHEN scenario IN ('retry_pass', 'failure_repair') THEN 1 ELSE 0 END, 'open',
      CASE WHEN scenario = 'failure_repair' THEN 'failed' ELSE 'passed' END,
      CASE WHEN scenario = 'failure_repair' THEN ARRAY['A'] ELSE ARRAY['B'] END,
      CASE WHEN scenario = 'failure_repair' THEN '{"status":"needs_review","understanding_level":"basic"}'::jsonb
        ELSE '{"status":"covered","understanding_level":"good"}'::jsonb END,
      CASE WHEN scenario = 'failure_repair' THEN 'assessment_fail' ELSE 'assessment_pass' END);
    IF result->>'processing_state' IS DISTINCT FROM 'applied' THEN RAISE EXCEPTION 'Terminal grading not applied: %', result; END IF;
    replay := public.process_assessment_message_v2(assessment, answer, student, gen_random_uuid(), 0, 'open',
      'passed', ARRAY['B'], '{"status":"covered","understanding_level":"good"}', 'assessment_pass');
    IF replay->>'processing_state' IS DISTINCT FROM 'duplicate'
      OR (SELECT count(*) FROM public.checklist_updates WHERE assessment_id = assessment) <> 1 THEN
      RAISE EXCEPTION 'Terminal replay duplicated or lost persisted history';
    END IF;
    INSERT INTO public.messages(room_id, user_id, user_role, content, parent_message_id, response_mode, created_at)
    VALUES (room, tutor, 'tutor', 'Assessment feedback.', answer, 'tutoring', clock_timestamp() + interval '1 second');
    focus := pg_temp.analyze_final_target(room, student, tutor, item, NULL, false, false);
    PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'terminal grading clears prior readiness');

    IF scenario = 'failure_repair' THEN
      IF NOT EXISTS (SELECT 1 FROM public.checklist_items WHERE id = item AND status = 'needs_review' AND understanding_level = 'basic') THEN
        RAISE EXCEPTION 'Second incorrect answer did not require review';
      END IF;
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'post_repair_signal', false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, NULL, 'repair continues tutoring');
      focus := pg_temp.analyze_final_target(room, student, tutor, item, 'demonstrated_understanding', false, false);
      PERFORM pg_temp.expect_final_due(room, focus, checklist, tutor, item, 'later full understanding starts a new assessment cycle');
      denied := false;
      BEGIN
        PERFORM pg_temp.deliver_final_assessment(room, student, checklist, item, focus, focus, tutor, 'Payment warning text');
      EXCEPTION WHEN raise_exception THEN denied := SQLERRM = 'ASSESSMENT_NOT_ELIGIBLE'; END;
      IF NOT denied THEN RAISE EXCEPTION 'Recovery reused the failed assessment context'; END IF;
      PERFORM pg_temp.deliver_final_assessment(room, student, checklist, item, focus, focus, tutor, 'Changed delivery notification');
    ELSIF NOT EXISTS (SELECT 1 FROM public.checklist_updates WHERE assessment_id = assessment
      AND previous_status = 'covered' AND new_status = 'covered'
      AND previous_understanding = 'good' AND new_understanding = 'good' AND evidence_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Pass did not retain evidence and same-pair completion history';
    END IF;
    RAISE NOTICE 'PASS: %', scenario;
  END LOOP;

  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOR rpc IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('apply_learning_event_v1', 'apply_transfer_message_analysis_v1',
        'prepare_transfer_assessment_context_v1', 'send_reviewed_transfer_assessment_v1', 'process_assessment_message_v2') LOOP
      IF has_function_privilege(role_name, rpc, 'EXECUTE') THEN
        RAISE EXCEPTION '% unexpectedly has EXECUTE on %', role_name, rpc;
      END IF;
    END LOOP;
    denied := false;
    BEGIN
      PERFORM set_config('role', role_name, true);
      PERFORM public.prepare_transfer_assessment_context_v1(room, focus, checklist, tutor, gen_random_uuid());
    EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
    IF NOT denied THEN RAISE EXCEPTION '% invoked assessment preparation', role_name; END IF;
  END LOOP;
  RAISE NOTICE 'PASS: anon/authenticated RPC permissions';
END;
$test$;

ROLLBACK;
