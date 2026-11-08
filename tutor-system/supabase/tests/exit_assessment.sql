--!/usr/bin/env psql
-- Test responsibility: exit_assessment migration eligibility, visit idempotency, cross-visit grading hashes and service-role boundaries.
-- All generated fixtures roll back. Run with psql -X -v ON_ERROR_STOP=1.
BEGIN;
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

DO $test$
DECLARE
  tutor uuid := gen_random_uuid();
  student uuid := gen_random_uuid();
  observer uuid := gen_random_uuid();
  room uuid := gen_random_uuid();
  checklist uuid := gen_random_uuid();
  item uuid;
  second_item uuid;
  focus uuid;
  evidence uuid;
  question uuid;
  assessment uuid;
  answer uuid;
  visit uuid := gen_random_uuid();
  result jsonb;
  original_hash text;
  scenario text;
  denied boolean;
  role_name text;
BEGIN
  INSERT INTO public.users(id,email,display_name,"current_role",status) VALUES
    (tutor,tutor||'@example.invalid','Exit tutor','tutor','active'),
    (student,student||'@example.invalid','Exit learner','student','active'),
    (observer,observer||'@example.invalid','Exit observer','student','active');
  INSERT INTO public.rooms(id,tutor_id,title,transfer_learning_enabled)
    VALUES(room,tutor,'Exit assessment regression',true);
  INSERT INTO public.sessions(room_id,tutor_id,student_id,status) VALUES(room,tutor,student,'active');
  PERFORM set_config('app.transfer_operation','on',true);
  INSERT INTO public.session_checklists(id,room_id,student_id,template_name,progress_policy_version)
    VALUES(checklist,room,student,'Exit fixture','transfer_v1');

  PERFORM public.start_learner_visit_v1(room,student,visit);
  PERFORM public.start_learner_visit_v1(room,student,visit);
  IF (SELECT count(*) FROM private.learner_visits WHERE room_id=room) <> 1 THEN
    RAISE EXCEPTION 'Repeated visit key recorded multiple visits';
  END IF;
  denied := false;
  BEGIN
    PERFORM public.start_learner_visit_v1(room,observer,gen_random_uuid());
  EXCEPTION WHEN raise_exception THEN denied := SQLERRM='INVALID_SCOPE'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Observer recorded learner visit'; END IF;

  FOREACH scenario IN ARRAY ARRAY['pending','partial','spontaneous','guard','cancelled','failed','manual'] LOOP
    item := gen_random_uuid();
    INSERT INTO public.checklist_items(id,checklist_id,area_text,item_type,priority,status,understanding_level)
      VALUES(item,checklist,'Independent verification '||scenario,'understanding','critical','pending','none');
    IF scenario='manual' THEN
      PERFORM public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'set_status',item,'{"status":"covered"}');
      focus := pg_temp.analyze_final_target(room,student,tutor,item,NULL);
      IF private.transfer_assessment_due_event(item) IS NOT NULL THEN RAISE EXCEPTION 'Manual edit became due'; END IF;
      CONTINUE;
    END IF;
    IF scenario='partial' THEN
      focus := pg_temp.analyze_final_target(room,student,tutor,item,'initial_signal');
      IF private.transfer_assessment_due_event(item) IS NOT NULL THEN RAISE EXCEPTION 'Partial became due'; END IF;
    END IF;
    focus := pg_temp.analyze_final_target(room,student,tutor,item,
      CASE WHEN scenario='spontaneous' THEN 'spontaneous_transfer' ELSE 'demonstrated_understanding' END);
    IF private.transfer_assessment_due_event(item) IS NULL THEN RAISE EXCEPTION '% not due',scenario; END IF;
    -- Restrict older completed targets through visits; each current target must appear in eligible list.
    result := public.prepare_transfer_assessment_context_v1(room,focus,checklist,tutor,gen_random_uuid());
    IF NOT result->'context'->'eligible_assessment_item_ids' @> jsonb_build_array(item) THEN
      RAISE EXCEPTION '% missing from eligible targets: %',scenario,result;
    END IF;
    result := pg_temp.deliver_final_assessment(room,student,checklist,item,focus,focus,tutor,'Exit '||scenario);
    evidence := focus;
    question := (result->'message'->>'id')::uuid;
    SELECT id,progress_snapshot_hash INTO STRICT assessment,original_hash
      FROM private.transfer_assessments WHERE question_message_id=question;
    IF original_hash IS DISTINCT FROM private.transfer_item_hash(item) THEN RAISE EXCEPTION '% hash changed on send',scenario; END IF;
    denied := false;
    BEGIN
      PERFORM pg_temp.deliver_final_assessment(room,student,checklist,item,focus,focus,tutor,'Duplicate target');
    EXCEPTION WHEN raise_exception THEN denied := SQLERRM IN ('ASSESSMENT_ALREADY_OPEN','ASSESSMENT_NOT_ELIGIBLE'); END;
    IF NOT denied OR (SELECT count(*) FROM private.transfer_assessments WHERE item_id=item AND lifecycle='open')<>1 THEN
      RAISE EXCEPTION 'Same target accepted duplicate open assessment';
    END IF;

    -- A second target remains deliverable with another question open.
    second_item := gen_random_uuid();
    INSERT INTO public.checklist_items(id,checklist_id,area_text,item_type,priority,status,understanding_level)
      VALUES(second_item,checklist,'Second target '||scenario,'understanding','important','pending','none');
    focus := pg_temp.analyze_final_target(room,student,tutor,second_item,'demonstrated_understanding');
    PERFORM pg_temp.deliver_final_assessment(room,student,checklist,second_item,focus,focus,tutor,'Second '||scenario);
    IF (SELECT count(*) FROM private.transfer_assessments WHERE room_id=room AND lifecycle='open') < 2 THEN
      RAISE EXCEPTION 'Multiple target questions not delivered';
    END IF;
    UPDATE private.transfer_assessments SET lifecycle='cancelled',closed_at=clock_timestamp()
      WHERE item_id=second_item;
    UPDATE public.messages SET assessment_lifecycle='cancelled' WHERE assessment_item_id=second_item;
    UPDATE public.checklist_items SET deleted=true WHERE id=second_item;

    IF scenario='cancelled' THEN
      UPDATE private.transfer_assessments SET lifecycle='cancelled',closed_at=clock_timestamp() WHERE id=assessment;
      UPDATE public.messages SET assessment_lifecycle='cancelled' WHERE id=question;
      result := public.prepare_transfer_assessment_context_v1(room,focus,checklist,tutor,gen_random_uuid());
      IF NOT result->'context'->'eligible_assessment_item_ids' @> jsonb_build_array(item) THEN
        RAISE EXCEPTION 'Cancelled question blocked replacement in same visit';
      END IF;
      PERFORM pg_temp.deliver_final_assessment(room,student,checklist,item,focus,evidence,tutor,'Replacement');
      UPDATE public.checklist_items SET deleted=true WHERE id=item;
      CONTINUE;
    END IF;

    -- A new visit changes eligibility suppression, never the grading snapshot.
    PERFORM public.start_learner_visit_v1(room,student,gen_random_uuid());
    IF original_hash IS DISTINCT FROM private.transfer_item_hash(item) THEN RAISE EXCEPTION '% visit changed snapshot',scenario; END IF;
    -- RPCs normally run in separate transactions. Existing grading writes now(), so
    -- emulate the visit preceding that transaction while keeping this fixture atomic.
    UPDATE private.learner_visits SET started_at=transaction_timestamp()-interval '1 second' WHERE room_id=room;
    IF scenario='guard' THEN
      UPDATE public.rooms SET guard_mode=true WHERE id=room;
      result := public.prepare_transfer_assessment_context_v1(room,focus,checklist,tutor,gen_random_uuid());
      IF result->>'no_assessment_due' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Guard did not block preparation'; END IF;
    END IF;
    IF scenario='failed' THEN
      result := public.post_assessment_message_v2(room,'A',question,assessment,ARRAY['A'],student,gen_random_uuid());
      answer := (result->'message'->>'id')::uuid;
      result := public.process_assessment_message_v2(assessment,answer,student,gen_random_uuid(),0,'open','retry',ARRAY['A'],
        '{"status":"covered","understanding_level":"good"}',NULL);
    END IF;
    result := public.post_assessment_message_v2(room,CASE WHEN scenario='failed' THEN 'A' ELSE 'B' END,
      question,assessment,CASE WHEN scenario='failed' THEN ARRAY['A'] ELSE ARRAY['B'] END,student,gen_random_uuid());
    answer := (result->'message'->>'id')::uuid;
    IF scenario='guard' THEN
      -- The Edge boundary holds posted answers until Guard clears and does not grade them.
      IF EXISTS (SELECT 1 FROM private.transfer_assessment_attempts WHERE assessment_id=assessment)
        OR EXISTS (SELECT 1 FROM private.transfer_assessments WHERE id=assessment AND attempt_count<>0) THEN
        RAISE EXCEPTION 'Posting a held Guard answer consumed an attempt';
      END IF;
      UPDATE public.rooms SET guard_mode=false WHERE id=room;
    END IF;
    result := public.process_assessment_message_v2(assessment,answer,student,gen_random_uuid(),
      CASE WHEN scenario='failed' THEN 1 ELSE 0 END,'open',CASE WHEN scenario='failed' THEN 'failed' ELSE 'passed' END,
      CASE WHEN scenario='failed' THEN ARRAY['A'] ELSE ARRAY['B'] END,
      CASE WHEN scenario='failed' THEN '{"status":"needs_review","understanding_level":"basic"}'::jsonb
        ELSE '{"status":"covered","understanding_level":"good"}'::jsonb END,
      CASE WHEN scenario='failed' THEN 'assessment_fail' ELSE 'assessment_pass' END);
    IF result->>'processing_state' IS DISTINCT FROM 'applied' THEN RAISE EXCEPTION 'Grading failed: %',result; END IF;
    result := public.prepare_transfer_assessment_context_v1(room,focus,checklist,tutor,gen_random_uuid());
    IF result->'context'->'eligible_assessment_item_ids' @> jsonb_build_array(item) THEN
      RAISE EXCEPTION 'Target resolved at visit B became due before visit C';
    END IF;
    DELETE FROM private.learner_visits WHERE room_id=room;
    result := public.prepare_transfer_assessment_context_v1(room,focus,checklist,tutor,gen_random_uuid());
    IF result->'context'->'eligible_assessment_item_ids' @> jsonb_build_array(item) THEN
      RAISE EXCEPTION 'No-visit learner received a previously resolved target';
    END IF;
    PERFORM public.start_learner_visit_v1(room,student,gen_random_uuid());
    result := public.prepare_transfer_assessment_context_v1(room,focus,checklist,tutor,gen_random_uuid());
    IF (result->'context'->'eligible_assessment_item_ids' @> jsonb_build_array(item)) IS DISTINCT FROM (scenario<>'failed') THEN
      RAISE EXCEPTION 'Next visit eligibility incorrect for %: %',scenario,result;
    END IF;
    IF result->'context'->>'feedback_required' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Feedback gate remains'; END IF;
    UPDATE public.checklist_items SET deleted=true WHERE id=item;
    RAISE NOTICE 'PASS: exit assessment %',scenario;
  END LOOP;

  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_function_privilege(role_name,'public.start_learner_visit_v1(uuid,uuid,uuid)','EXECUTE')
      OR has_table_privilege(role_name,'private.learner_visits','SELECT,INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION '% can access private visits',role_name;
    END IF;
    denied := false;
    BEGIN
      PERFORM set_config('role',role_name,true);
      PERFORM public.start_learner_visit_v1(room,student,gen_random_uuid());
    EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
    IF NOT denied THEN RAISE EXCEPTION '% recorded a visit',role_name; END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role','public.start_learner_visit_v1(uuid,uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Service role cannot record visits';
  END IF;
  RAISE NOTICE 'PASS: visit idempotency, observer exclusion, role permissions';
END;
$test$;
ROLLBACK;

