-- Purpose: verify delivery, persisted attempts, privacy, idempotency, CAS conflict, and terminal atomicity.

BEGIN;

CREATE TEMP TABLE transfer_v2_results (
  case_id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  detail TEXT NOT NULL
) ON COMMIT DROP;

DO $test$
DECLARE
  v_tutor UUID := gen_random_uuid();
  v_student UUID := gen_random_uuid();
  v_room UUID := gen_random_uuid();
  v_checklist UUID := gen_random_uuid();
  v_item UUID := gen_random_uuid();
  v_focus UUID := gen_random_uuid();
  v_assessment UUID;
  v_question UUID;
  v_answer_1 UUID;
  v_answer_2 UUID;
  v_delivery_request UUID := gen_random_uuid();
  v_post_request_1 UUID := gen_random_uuid();
  v_post_request_2 UUID := gen_random_uuid();
  v_process_request_1 UUID := gen_random_uuid();
  v_process_request_2 UUID := gen_random_uuid();
  v_invalid_request UUID := gen_random_uuid();
  v_result JSONB;
  v_reviewed_payload JSONB;
  v_pass_item UUID;
  v_pass_assessment UUID;
  v_pass_question UUID;
  v_pass_answer UUID;
  v_before_events INTEGER;
BEGIN
  INSERT INTO public.users(id, email, display_name, "current_role", status)
  VALUES
    (v_tutor, 'transfer-v2-tutor@example.invalid', 'Transfer V2 Tutor', 'tutor', 'active'),
    (v_student, 'transfer-v2-student@example.invalid', 'Transfer V2 Student', 'student', 'active');
  INSERT INTO public.rooms(id, tutor_id, title) VALUES (v_room, v_tutor, 'Transfer V2 room');
  INSERT INTO public.sessions(tutor_id, student_id, room_id, status)
  VALUES (v_tutor, v_student, v_room, 'active');
  PERFORM set_config('app.transfer_operation', 'on', TRUE);
  INSERT INTO public.session_checklists(
    id, room_id, student_id, template_name, progress_policy_version, is_active
  ) VALUES (v_checklist, v_room, v_student, 'Transfer V2', 'transfer_v1', TRUE);
  INSERT INTO public.checklist_items(
    id, checklist_id, area_text, item_type, priority, status, understanding_level
  ) VALUES (
    v_item, v_checklist, 'Verify a familiar sender independently',
    'verification_step', 'critical', 'partially_covered', 'basic'
  );
  INSERT INTO public.messages(id, room_id, user_id, content, user_role)
  VALUES (v_focus, v_room, v_student, 'The account looked familiar, so I clicked.', 'student');

  v_reviewed_payload := jsonb_build_object(
      'reason', 'The learner needs transfer evidence.',
      'decision', jsonb_build_object(
        'mode', 'assessment', 'instruction', 'transfer_assess', 'target_item_id', v_item::TEXT
      ),
      'response', 'Which action is safest?',
      'assessment', jsonb_build_object(
        'selection_type', 'single',
        'stem', 'Which action is safest?',
        'rendered_text', 'Which action is safest?',
        'options', jsonb_build_array(
          jsonb_build_object('id', 'A', 'text', 'Open the link'),
          jsonb_build_object('id', 'B', 'text', 'Verify through the official app'),
          jsonb_build_object('id', 'C', 'text', 'Reply with credentials'),
          jsonb_build_object('id', 'D', 'text', 'Forward it to a friend')
        ),
        'correct_option_ids', jsonb_build_array('B'),
        'learner_safe_explanation', 'Verify through the official app because familiar accounts can be compromised.',
        'transfer_basis', jsonb_build_object(
          'concept_rule', 'Familiarity is not authentication.',
          'source_context', 'A familiar account sent a link.',
          'changed_context', 'A bank notification asks for action.',
          'source_evidence_message_ids', jsonb_build_array(v_focus::TEXT)
        )
      )
    );
  v_result := public.send_reviewed_tutor_response_v4(
    v_reviewed_payload,
    v_room, v_student, v_checklist, v_item, v_focus, v_tutor, v_delivery_request
  );
  v_question := (v_result->'message'->>'id')::UUID;
  v_assessment := (v_result->'message'->'assessment'->>'id')::UUID;

  INSERT INTO transfer_v2_results VALUES (
    'delivery', 'public delivery is stem-only and exact while grading material is private',
    v_result->'message'->>'content' = 'Which action is safest?'
      AND jsonb_typeof(v_result->'message'->'assessment') = 'object'
      AND (SELECT count(*) FROM jsonb_object_keys(v_result->'message'->'assessment')) = 5
      AND jsonb_array_length(v_result->'message'->'assessment'->'options') = 4
      AND (SELECT string_agg(opt->>'id', ',' ORDER BY opt->>'id')
        FROM jsonb_array_elements(v_result->'message'->'assessment'->'options') opt) = 'A,B,C,D'
      AND NOT (v_result->'message'->'assessment' ? 'rendered_text')
      AND NOT (v_result->'message'->'assessment' ? 'correct_option_ids')
      AND (v_result->'message'->'assessment'->>'student_id')::UUID = v_student
      AND (SELECT assessment_student_id FROM public.messages WHERE id = v_question) = v_student
      AND EXISTS (SELECT 1 FROM private.transfer_assessments
        WHERE id = v_assessment AND correct_option_ids = ARRAY['B']
          AND learner_safe_explanation <> ''),
    v_result::TEXT
  );

  BEGIN
    PERFORM public.send_reviewed_tutor_response_v4(
      v_reviewed_payload,
      v_room, v_student, v_checklist, v_item, v_focus, v_tutor, v_invalid_request
    );
    INSERT INTO transfer_v2_results VALUES (
      'open_delivery_rejected', 'second open delivery creates no public or private pair', FALSE, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'open_delivery_rejected', 'second open delivery creates no public or private pair',
      SQLERRM = 'ASSESSMENT_ALREADY_OPEN'
        AND NOT EXISTS (SELECT 1 FROM public.messages WHERE assessment_request_id = v_invalid_request)
        AND NOT EXISTS (SELECT 1 FROM private.transfer_assessments WHERE delivery_request_id = v_invalid_request),
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  BEGIN
    UPDATE public.messages SET assessment_student_id = v_tutor WHERE id = v_question;
    INSERT INTO transfer_v2_results VALUES (
      'immutable_public_target', 'delivered public learner target cannot change', FALSE, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'immutable_public_target', 'delivered public learner target cannot change',
      SQLERRM = 'IMMUTABLE_ASSESSMENT_STUDENT_ID'
        AND (SELECT assessment_student_id FROM public.messages WHERE id = v_question) = v_student,
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  BEGIN
    UPDATE private.transfer_assessments
    SET correct_option_ids = ARRAY['C'] WHERE id = v_assessment;
    INSERT INTO transfer_v2_results VALUES (
      'immutable_private_key', 'reviewed private answer key cannot change', FALSE, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'immutable_private_key', 'reviewed private answer key cannot change',
      SQLERRM = 'IMMUTABLE_ASSESSMENT_PRIVATE_FIELDS'
        AND (SELECT correct_option_ids FROM private.transfer_assessments WHERE id = v_assessment) = ARRAY['B'],
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  BEGIN
    UPDATE private.transfer_assessments
    SET learner_safe_explanation = 'Changed explanation' WHERE id = v_assessment;
    INSERT INTO transfer_v2_results VALUES (
      'immutable_explanation', 'reviewed learner explanation cannot change', FALSE, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'immutable_explanation', 'reviewed learner explanation cannot change',
      SQLERRM = 'IMMUTABLE_ASSESSMENT_PRIVATE_FIELDS'
        AND (SELECT learner_safe_explanation FROM private.transfer_assessments WHERE id = v_assessment)
          = 'Verify through the official app because familiar accounts can be compromised.',
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  v_result := public.send_reviewed_tutor_response_v4(
    jsonb_build_object('decision', jsonb_build_object('mode', 'assessment')),
    v_room, v_student, v_checklist, v_item, v_focus, v_tutor, v_delivery_request
  );
  INSERT INTO transfer_v2_results VALUES (
    'delivery_retry', 'delivery request replay returns one stable public/private pair',
    (v_result->'message'->>'id')::UUID = v_question
      AND (SELECT count(*) FROM private.transfer_assessments WHERE delivery_request_id = v_delivery_request) = 1,
    v_result::TEXT
  );

  v_invalid_request := gen_random_uuid();
  BEGIN
    PERFORM public.post_assessment_message_v2(
      v_room, 'Z', v_question, v_assessment, ARRAY['Z'], v_student, v_invalid_request
    );
    INSERT INTO transfer_v2_results VALUES (
      'invalid_selection', 'unknown option while open creates no answer', FALSE, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'invalid_selection', 'unknown option while open creates no answer',
      SQLERRM = 'ITEM_VALIDATION_FAILED'
        AND NOT EXISTS (SELECT 1 FROM public.messages WHERE assessment_request_id = v_invalid_request),
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  v_result := public.post_assessment_message_v2(
    v_room, 'A', v_question, v_assessment, ARRAY['A'], v_student, v_post_request_1
  );
  v_answer_1 := (v_result->'message'->>'id')::UUID;
  v_result := public.post_assessment_message_v2(
    v_room, 'A', v_question, v_assessment, ARRAY['A'], v_student, v_post_request_1
  );
  INSERT INTO transfer_v2_results VALUES (
    'post_retry', 'answer request replay returns one stored message',
    (v_result->'message'->>'id')::UUID = v_answer_1
      AND (SELECT count(*) FROM public.messages WHERE assessment_request_id = v_post_request_1) = 1,
    v_result::TEXT
  );

  BEGIN
    PERFORM public.process_assessment_message_v2(
      v_assessment, v_answer_1, v_student, gen_random_uuid(),
      0, 'open', 'failed', ARRAY['A'],
      jsonb_build_object('status', 'needs_review', 'understanding_level', 'basic'), 'assessment_fail'
    );
    INSERT INTO transfer_v2_results VALUES (
      'invalid_first_failure', 'terminal failure cannot consume the first attempt', FALSE, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'invalid_first_failure', 'terminal failure cannot consume the first attempt',
      SQLERRM = 'INVALID_ATTEMPT_TRANSITION'
        AND (SELECT attempt_count FROM private.transfer_assessments WHERE id = v_assessment) = 0
        AND NOT EXISTS (SELECT 1 FROM private.transfer_assessment_attempts WHERE assessment_id = v_assessment),
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  SELECT count(*) INTO v_before_events FROM private.learning_event_inbox;
  v_result := public.process_assessment_message_v2(
    v_assessment, v_answer_1, v_student, v_process_request_1,
    0, 'open', 'retry', ARRAY['A'],
    jsonb_build_object('status', 'partially_covered', 'understanding_level', 'basic'), NULL
  );
  INSERT INTO transfer_v2_results VALUES (
    'first_wrong', 'first wrong persists attempt one without progress or private feedback',
    v_result->>'answer_outcome' = 'retry'
      AND (v_result->>'attempts_remaining')::INTEGER = 1
      AND v_result->'terminal_failure_feedback' = 'null'::JSONB
      AND (SELECT attempt_count FROM private.transfer_assessments WHERE id = v_assessment) = 1
      AND (SELECT count(*) FROM private.learning_event_inbox) = v_before_events,
    v_result::TEXT
  );

  BEGIN
    PERFORM public.process_assessment_message_v2(
      v_assessment, v_answer_1, v_tutor, gen_random_uuid(),
      1, 'open', 'retry', ARRAY['A'],
      jsonb_build_object('status', 'partially_covered', 'understanding_level', 'basic'), NULL
    );
    INSERT INTO transfer_v2_results VALUES (
      'wrong_actor', 'non-target actor cannot process a learner answer', FALSE, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'wrong_actor', 'non-target actor cannot process a learner answer',
      SQLERRM = 'WRONG_LEARNER'
        AND (SELECT attempt_count FROM private.transfer_assessments WHERE id = v_assessment) = 1,
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  v_result := public.post_assessment_message_v2(
    v_room, 'A', v_question, v_assessment, ARRAY['A'], v_student, v_post_request_2
  );
  v_answer_2 := (v_result->'message'->>'id')::UUID;
  v_result := public.process_assessment_message_v2(
    v_assessment, v_answer_2, v_student, gen_random_uuid(),
    0, 'open', 'failed', ARRAY['A'],
    jsonb_build_object('status', 'needs_review', 'understanding_level', 'basic'), 'assessment_fail'
  );
  INSERT INTO transfer_v2_results VALUES (
    'cas_conflict', 'a stale snapshot cannot allocate the same attempt ordinal',
    v_result->>'code' = 'CONCURRENT_MODIFICATION'
      AND (SELECT count(*) FROM private.transfer_assessment_attempts WHERE assessment_id = v_assessment) = 1,
    v_result::TEXT
  );
  v_result := public.process_assessment_message_v2(
    v_assessment, v_answer_2, v_student, v_process_request_2,
    1, 'open', 'failed', ARRAY['A'],
    jsonb_build_object('status', 'needs_review', 'understanding_level', 'basic'), 'assessment_fail'
  );
  INSERT INTO transfer_v2_results VALUES (
    'second_wrong', 'second wrong atomically terminates and returns role-safe feedback',
    v_result->>'answer_outcome' = 'failed'
      AND (v_result->>'attempts_used')::INTEGER = 2
      AND v_result->'terminal_failure_feedback'->'correct_option_ids' = jsonb_build_array('B')
      AND (SELECT lifecycle FROM private.transfer_assessments WHERE id = v_assessment) = 'failed'
      AND EXISTS (SELECT 1 FROM private.learning_event_inbox
        WHERE event_payload->>'assessment_id' = v_assessment::TEXT
          AND event_kind = 'assessment_fail'),
    v_result::TEXT
  );

  v_result := public.process_assessment_message_v2(
    v_assessment, v_answer_2, v_student, v_process_request_2,
    1, 'open', 'failed', ARRAY['A'],
    jsonb_build_object('status', 'needs_review', 'understanding_level', 'basic'), 'assessment_fail'
  );
  INSERT INTO transfer_v2_results VALUES (
    'duplicate', 'duplicate processing returns the original outcome without a third attempt',
    v_result->>'processing_state' = 'duplicate'
      AND (v_result->>'already_processed')::BOOLEAN
      AND (SELECT count(*) FROM private.transfer_assessment_attempts WHERE assessment_id = v_assessment) = 2,
    v_result::TEXT
  );

  BEGIN
    PERFORM public.post_assessment_message_v2(
      v_room, 'B', v_question, v_assessment, ARRAY['B'], v_student, gen_random_uuid()
    );
    INSERT INTO transfer_v2_results VALUES (
      'third_submission', 'closed assessment rejects a third distinct submission', FALSE, 'unexpected success'
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'third_submission', 'closed assessment rejects a third distinct submission',
      SQLERRM = 'WRONG_LEARNER'
        AND (SELECT count(*) FROM private.transfer_assessment_attempts WHERE assessment_id = v_assessment) = 2,
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  BEGIN
    PERFORM public.post_assessment_message_v2(
      v_room, 'Z', v_question, v_assessment, ARRAY['Z'], v_student, gen_random_uuid()
    );
    INSERT INTO transfer_v2_results VALUES ('closed_invalid_selection', 'closed assessment rejects an unknown option', FALSE, 'unexpected success');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'closed_invalid_selection', 'closed assessment rejects an unknown option',
      SQLERRM = 'WRONG_LEARNER',
      SQLSTATE || ': ' || SQLERRM
    );
  END;

  v_pass_item := gen_random_uuid();
  INSERT INTO public.checklist_items(
    id, checklist_id, area_text, item_type, priority, status, understanding_level
  ) VALUES (
    v_pass_item, v_checklist, 'Verify a new sender independently',
    'verification_step', 'critical', 'partially_covered', 'basic'
  );
  v_reviewed_payload := jsonb_set(
    v_reviewed_payload, '{decision,target_item_id}', to_jsonb(v_pass_item::TEXT)
  );
  v_result := public.send_reviewed_tutor_response_v4(
    v_reviewed_payload, v_room, v_student, v_checklist, v_pass_item,
    v_focus, v_tutor, gen_random_uuid()
  );
  v_pass_question := (v_result->'message'->>'id')::UUID;
  v_pass_assessment := (v_result->'message'->'assessment'->>'id')::UUID;
  v_result := public.post_assessment_message_v2(
    v_room, 'B', v_pass_question, v_pass_assessment, ARRAY['B'], v_student, gen_random_uuid()
  );
  v_pass_answer := (v_result->'message'->>'id')::UUID;
  SELECT count(*) INTO v_before_events FROM private.learning_event_inbox;
  BEGIN
    PERFORM public.process_assessment_message_v2(
      v_pass_assessment, v_pass_answer, v_student, gen_random_uuid(),
      0, 'open', 'passed', ARRAY['B'],
      jsonb_build_object('status', 'covered', 'understanding_level', 'good'), 'assessment_pass'
    );
    RAISE EXCEPTION 'ROLLBACK_PROBE';
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO transfer_v2_results VALUES (
      'terminal_rollback', 'aborted terminal call leaves no attempt, event, lifecycle, or progress effect',
      SQLERRM = 'ROLLBACK_PROBE'
        AND (SELECT attempt_count FROM private.transfer_assessments WHERE id = v_pass_assessment) = 0
        AND NOT EXISTS (SELECT 1 FROM private.transfer_assessment_attempts
          WHERE assessment_id = v_pass_assessment)
        AND (SELECT lifecycle FROM private.transfer_assessments WHERE id = v_pass_assessment) = 'open'
        AND (SELECT assessment_lifecycle FROM public.messages WHERE id = v_pass_question) = 'delivered'
        AND (SELECT status FROM public.checklist_items WHERE id = v_pass_item) = 'partially_covered'
        AND (SELECT count(*) FROM private.learning_event_inbox) = v_before_events,
      SQLSTATE || ': ' || SQLERRM
    );
  END;
  v_result := public.process_assessment_message_v2(
    v_pass_assessment, v_pass_answer, v_student, gen_random_uuid(),
    0, 'open', 'passed', ARRAY['B'],
    jsonb_build_object('status', 'covered', 'understanding_level', 'good'), 'assessment_pass'
  );
  INSERT INTO transfer_v2_results VALUES (
    'pass_first', 'correct first answer commits one terminal attempt without private feedback',
    v_result->>'answer_outcome' = 'passed'
      AND (v_result->>'attempts_used')::INTEGER = 1
      AND v_result->'terminal_failure_feedback' = 'null'::JSONB
      AND (SELECT lifecycle FROM private.transfer_assessments WHERE id = v_pass_assessment) = 'passed'
      AND (SELECT count(*) FROM private.transfer_assessment_attempts WHERE assessment_id = v_pass_assessment) = 1
      AND EXISTS (SELECT 1 FROM private.learning_event_inbox
        WHERE event_payload->>'assessment_id' = v_pass_assessment::TEXT
          AND event_kind = 'assessment_pass'),
    v_result::TEXT
  );

  v_pass_item := gen_random_uuid();
  INSERT INTO public.checklist_items(
    id, checklist_id, area_text, item_type, priority, status, understanding_level
  ) VALUES (
    v_pass_item, v_checklist, 'Verify a changed sender independently',
    'verification_step', 'critical', 'partially_covered', 'basic'
  );
  v_reviewed_payload := jsonb_set(
    v_reviewed_payload, '{decision,target_item_id}', to_jsonb(v_pass_item::TEXT)
  );
  v_result := public.send_reviewed_tutor_response_v4(
    v_reviewed_payload, v_room, v_student, v_checklist, v_pass_item,
    v_focus, v_tutor, gen_random_uuid()
  );
  v_pass_question := (v_result->'message'->>'id')::UUID;
  v_pass_assessment := (v_result->'message'->'assessment'->>'id')::UUID;
  v_result := public.post_assessment_message_v2(
    v_room, 'A', v_pass_question, v_pass_assessment, ARRAY['A'], v_student, gen_random_uuid()
  );
  v_pass_answer := (v_result->'message'->>'id')::UUID;
  v_result := public.process_assessment_message_v2(
    v_pass_assessment, v_pass_answer, v_student, gen_random_uuid(),
    0, 'open', 'retry', ARRAY['A'],
    jsonb_build_object('status', 'partially_covered', 'understanding_level', 'basic'), NULL
  );
  v_result := public.post_assessment_message_v2(
    v_room, 'B', v_pass_question, v_pass_assessment, ARRAY['B'], v_student, gen_random_uuid()
  );
  v_pass_answer := (v_result->'message'->>'id')::UUID;
  v_result := public.process_assessment_message_v2(
    v_pass_assessment, v_pass_answer, v_student, gen_random_uuid(),
    1, 'open', 'passed', ARRAY['B'],
    jsonb_build_object('status', 'covered', 'understanding_level', 'good'), 'assessment_pass'
  );
  INSERT INTO transfer_v2_results VALUES (
    'pass_second', 'correct second answer commits two attempts and one terminal event',
    v_result->>'answer_outcome' = 'passed'
      AND (v_result->>'attempts_used')::INTEGER = 2
      AND v_result->'terminal_failure_feedback' = 'null'::JSONB
      AND (SELECT lifecycle FROM private.transfer_assessments WHERE id = v_pass_assessment) = 'passed'
      AND (SELECT count(*) FROM private.transfer_assessment_attempts WHERE assessment_id = v_pass_assessment) = 2
      AND (SELECT count(*) FROM private.learning_event_inbox
        WHERE event_payload->>'assessment_id' = v_pass_assessment::TEXT
          AND event_kind = 'assessment_pass') = 1,
    v_result::TEXT
  );
END;
$test$;

SELECT * FROM transfer_v2_results ORDER BY case_id;
SELECT count(*) AS failing_cases FROM transfer_v2_results WHERE NOT ok;

DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM transfer_v2_results WHERE NOT ok OR ok IS NULL) THEN
    RAISE EXCEPTION 'transfer assessment RPC behavior checks failed';
  END IF;
END;
$test$;

ROLLBACK;
