--!/usr/bin/env psql
-- Test responsibility: exit migration preserves existing assessments, attempts and progress, and old open hashes remain gradeable.
-- Run only on a disposable restored baseline with -v migration_file=<candidate SQL>.
CREATE FUNCTION pg_temp.analyze_final_target(
  room_id uuid, student_id uuid, tutor_id uuid, item_id uuid,
  kind text
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

CREATE TEMP TABLE exit_legacy_fixture(room_id uuid,student_id uuid,tutor_id uuid,item_id uuid,question_id uuid,assessment_id uuid);
DO $setup$
DECLARE
  room uuid := gen_random_uuid(); student uuid := gen_random_uuid(); tutor uuid := gen_random_uuid();
  checklist uuid := gen_random_uuid(); item uuid := gen_random_uuid(); focus uuid; result jsonb;
BEGIN
  INSERT INTO public.users(id,email,display_name,"current_role",status) VALUES
    (tutor,tutor||'@example.invalid','Legacy tutor','tutor','active'),
    (student,student||'@example.invalid','Legacy student','student','active');
  INSERT INTO public.rooms(id,tutor_id,title,transfer_learning_enabled) VALUES(room,tutor,'Legacy exit fixture',true);
  INSERT INTO public.sessions(room_id,tutor_id,student_id,status) VALUES(room,tutor,student,'active');
  PERFORM set_config('app.transfer_operation','on',true);
  INSERT INTO public.session_checklists(id,room_id,student_id,template_name,progress_policy_version)
    VALUES(checklist,room,student,'Legacy exit fixture','transfer_v1');
  INSERT INTO public.checklist_items(id,checklist_id,area_text,item_type,priority,status,understanding_level)
    VALUES(item,checklist,'Legacy independent verification','understanding','critical','pending','none');
  focus := pg_temp.analyze_final_target(room,student,tutor,item,'initial_signal');
  focus := pg_temp.analyze_final_target(room,student,tutor,item,'demonstrated_understanding');
  result := pg_temp.deliver_final_assessment(room,student,checklist,item,focus,focus,tutor,'Legacy separate channel');
  INSERT INTO exit_legacy_fixture VALUES(room,student,tutor,item,(result->'message'->>'id')::uuid,
    (SELECT id FROM private.transfer_assessments WHERE question_message_id=(result->'message'->>'id')::uuid));
END;
$setup$;
CREATE TEMP TABLE exit_assessment_before AS SELECT id,to_jsonb(a) original FROM private.transfer_assessments a;
CREATE TEMP TABLE exit_attempt_before AS SELECT id,to_jsonb(a) original FROM private.transfer_assessment_attempts a;
CREATE TEMP TABLE exit_item_before AS SELECT id,to_jsonb(a) original FROM public.checklist_items a;
\i :migration_file
DO $verify$
DECLARE
  fixture exit_legacy_fixture%ROWTYPE;
  result jsonb;
  answer uuid;
BEGIN
  IF (SELECT count(*) FROM private.transfer_assessments)<>(SELECT count(*) FROM exit_assessment_before)
    OR EXISTS (SELECT 1 FROM private.transfer_assessments a JOIN exit_assessment_before b USING(id) WHERE to_jsonb(a) IS DISTINCT FROM b.original)
    OR EXISTS (SELECT 1 FROM private.transfer_assessment_attempts a JOIN exit_attempt_before b USING(id) WHERE to_jsonb(a) IS DISTINCT FROM b.original)
    OR EXISTS (SELECT 1 FROM public.checklist_items a JOIN exit_item_before b USING(id) WHERE to_jsonb(a) IS DISTINCT FROM b.original)
  THEN RAISE EXCEPTION 'Exit migration rewrote existing assessment history or progress'; END IF;
  SELECT * INTO STRICT fixture FROM exit_legacy_fixture;
  PERFORM public.start_learner_visit_v1(fixture.room_id,fixture.student_id,gen_random_uuid());
  IF NOT EXISTS (SELECT 1 FROM private.transfer_assessments WHERE id=fixture.assessment_id
    AND progress_snapshot_hash=private.transfer_item_hash(fixture.item_id)) THEN
    RAISE EXCEPTION 'Pre-release open assessment hash changed';
  END IF;
  result := public.post_assessment_message_v2(fixture.room_id,'B',fixture.question_id,fixture.assessment_id,ARRAY['B'],fixture.student_id,gen_random_uuid());
  answer := (result->'message'->>'id')::uuid;
  result := public.process_assessment_message_v2(fixture.assessment_id,answer,fixture.student_id,gen_random_uuid(),0,'open','passed',ARRAY['B'],
    '{"status":"covered","understanding_level":"good"}','assessment_pass');
  IF result->>'answer_outcome' IS DISTINCT FROM 'passed' OR result->>'processing_state' IS DISTINCT FROM 'applied' THEN
    RAISE EXCEPTION 'Pre-release question no longer grades: %',result;
  END IF;
  RAISE NOTICE 'PASS: existing rows preserved and pre-release open question grades after new visit';
END;
$verify$;

