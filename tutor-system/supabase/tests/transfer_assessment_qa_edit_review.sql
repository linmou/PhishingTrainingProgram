--#!/usr/bin/env psql
-- Test responsibility: trusted checklist edits, private tutor review, and assisted cancellation SQL boundaries.
-- Supply PGOPTIONS='-c qa.scenario=status|notes|review|assisted' to select an independently reproducible case.
BEGIN;
DO $test$
DECLARE
  scenario text := current_setting('qa.scenario');
  tutor uuid := gen_random_uuid(); learner uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  room uuid := gen_random_uuid(); other_room uuid := gen_random_uuid(); checklist uuid; item uuid;
  question uuid := gen_random_uuid(); focus uuid := gen_random_uuid(); answer uuid; retry_answer uuid;
  assessment uuid := gen_random_uuid(); request uuid := gen_random_uuid(); result jsonb; previous jsonb;
  denied boolean; options jsonb := '[{"id":"A","text":"Reply"},{"id":"B","text":"Call trusted contact"},{"id":"C","text":"Pay"},{"id":"D","text":"Forward"}]';
BEGIN
  INSERT INTO public.users(id,email,display_name,"current_role",status) VALUES
    (tutor,tutor||'@example.invalid','QA tutor','tutor','active'),
    (learner,learner||'@example.invalid','QA learner','student','active'),
    (outsider,outsider||'@example.invalid','Other tutor','tutor','active');
  INSERT INTO public.rooms(id,tutor_id,title,transfer_learning_enabled) VALUES
    (room,tutor,'QA SQL boundaries',true),(other_room,outsider,'Other room',true);
  PERFORM public.join_room_v1(room,learner);
  PERFORM set_config('app.transfer_operation','on',true);
  result := public.initialize_transfer_checklist_v1(room,learner,
    '[{"area_text":"Verify independently","item_type":"verification_step","priority":"important"}]',tutor);
  checklist := (result->>'checklist_id')::uuid;
  SELECT id INTO STRICT item FROM public.checklist_items WHERE checklist_id=checklist AND NOT deleted;
  UPDATE public.checklist_items SET status='covered',understanding_level='good' WHERE id=item;
  PERFORM set_config('app.transfer_operation','',true);
  PERFORM set_config('role','service_role',true);

  IF scenario='status' THEN
    result := public.edit_room_checklist_v1(room,tutor,request,'set_status',item,'{"status":"partially_covered"}');
    IF result->>'status' IS DISTINCT FROM 'partially_covered' OR result->>'understanding_level' IS DISTINCT FROM 'basic' THEN
      RAISE EXCEPTION 'Status edit failed to preserve valid paired understanding: %',result;
    END IF;
    result := public.edit_room_checklist_v1(room,tutor,request,'set_status',item,'{"status":"partially_covered"}');
    IF result->>'processing_state' IS DISTINCT FROM 'duplicate' THEN RAISE EXCEPTION 'Status replay changed state'; END IF;
    result := public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'set_understanding',item,'{"understanding_level":"none"}');
    IF result->>'status' IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'None did not map pending'; END IF;
    result := public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'set_understanding',item,'{"understanding_level":"good"}');
    IF result->>'status' IS DISTINCT FROM 'covered' THEN RAISE EXCEPTION 'Good did not map covered'; END IF;
    result := public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'set_status',item,'{"status":"needs_review"}');
    result := public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'set_understanding',item,'{"understanding_level":"basic"}');
    IF result->>'status' IS DISTINCT FROM 'needs_review' THEN RAISE EXCEPTION 'Basic lost review state'; END IF;
    denied := false;
    BEGIN
      PERFORM public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'set_understanding',item,'{"understanding_level":"excellent"}');
    EXCEPTION WHEN raise_exception THEN denied := SQLERRM='ITEM_VALIDATION_FAILED'; END;
    IF NOT denied THEN RAISE EXCEPTION 'Unsupported excellent level not rejected'; END IF;
  ELSIF scenario='notes' THEN
    result := public.edit_room_checklist_v1(room,tutor,request,'edit_item',item,'{"tutor_notes":"Practice independently"}');
    IF NOT EXISTS(SELECT 1 FROM public.checklist_items WHERE id=item AND tutor_notes='Practice independently' AND area_text='Verify independently' AND status='covered' AND understanding_level='good') THEN
      RAISE EXCEPTION 'Notes edit changed progress/text or did not persist';
    END IF;
    result := public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'edit_item',item,'{"tutor_notes":""}');
    IF NOT EXISTS(SELECT 1 FROM public.checklist_items WHERE id=item AND tutor_notes='') THEN RAISE EXCEPTION 'Cannot clear notes'; END IF;
    result := public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'edit_item',item,'{"area_text":"Verify before paying","tutor_notes":"Independent contact"}');
    denied := false;
    BEGIN
      PERFORM public.edit_room_checklist_v1(room,tutor,gen_random_uuid(),'edit_item',item,'{"area_text":"","tutor_notes":"Do not save"}');
    EXCEPTION WHEN raise_exception THEN denied := SQLERRM='ITEM_VALIDATION_FAILED'; END;
    IF NOT denied OR NOT EXISTS(SELECT 1 FROM public.checklist_items WHERE id=item AND area_text='Verify before paying' AND tutor_notes='Independent contact') THEN
      RAISE EXCEPTION 'Invalid mixed edit was not atomic';
    END IF;
  ELSE
    PERFORM set_config('role','postgres',true);
    INSERT INTO public.messages(id,room_id,user_id,user_role,content) VALUES(focus,room,learner,'student','I would verify the request');
    INSERT INTO public.messages(id,room_id,user_id,user_role,content,parent_message_id,response_mode,assessment_options,assessment_selection_type,assessment_lifecycle)
    VALUES(question,room,tutor,'tutor','Which action verifies independently?',focus,'assessment',options,'single','delivered');
    INSERT INTO private.transfer_assessments(id,question_message_id,room_id,student_id,checklist_id,item_id,focus_student_message_id,
      selection_type,correct_option_ids,learner_safe_explanation,transfer_basis,reviewed_private_payload,lifecycle,delivery_request_id,progress_snapshot_hash)
    VALUES(assessment,question,room,learner,checklist,item,focus,'single',ARRAY['B'],'Use a trusted independent contact',
      '{"concept_rule":"independent verification","source_context":"email","changed_context":"text","source_evidence_message_ids":[]}',
      '{"target_item_id":"test"}','open',gen_random_uuid(),private.transfer_item_hash(item));
    PERFORM set_config('role','service_role',true);
    IF scenario='review' THEN
      result := public.get_transfer_assessment_review_v1(room,assessment,tutor);
      IF result->>'item_label' IS DISTINCT FROM 'Verify independently' OR result->'assessment'->'correct_option_ids' IS DISTINCT FROM '["B"]'::jsonb
        OR result->>'lifecycle' IS DISTINCT FROM 'delivered' OR result->>'resolution' IS DISTINCT FROM 'open' OR result->>'attempt_count' IS DISTINCT FROM '0'
        OR result->>'feedback_required' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Private review contract incorrect: %',result; END IF;
      denied := false;
      BEGIN PERFORM public.get_transfer_assessment_review_v1(room,assessment,learner);
      EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
      IF NOT denied THEN RAISE EXCEPTION 'Learner read private key'; END IF;
      denied := false;
      BEGIN PERFORM public.get_transfer_assessment_review_v1(other_room,assessment,outsider);
      EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='INVALID_SCOPE'; END;
      IF NOT denied THEN RAISE EXCEPTION 'Other room tutor read private key'; END IF;
      denied := false;
      BEGIN
        PERFORM set_config('role','anon',true);
        PERFORM public.get_transfer_assessment_review_v1(room,assessment,tutor);
      EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
      IF NOT denied THEN RAISE EXCEPTION 'Anon invoked private review'; END IF;
      denied := false;
      BEGIN
        PERFORM set_config('role','authenticated',true);
        PERFORM public.get_transfer_assessment_review_v1(room,assessment,tutor);
      EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
      IF NOT denied THEN RAISE EXCEPTION 'Authenticated caller invoked private review'; END IF;
      result := public.post_assessment_message_v2(room,'B',question,assessment,ARRAY['B'],learner,gen_random_uuid());
      answer := (result->'message'->>'id')::uuid;
      result := public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open','passed',ARRAY['B'],
        '{"status":"covered","understanding_level":"good"}','assessment_pass');
      result := public.get_transfer_assessment_review_v1(room,assessment,tutor);
      IF result->>'resolution' IS DISTINCT FROM 'passed' OR result->>'lifecycle' IS DISTINCT FROM 'passed'
        OR result->>'attempt_count' IS DISTINCT FROM '1' OR result->>'feedback_required' IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Terminal review lost outcome or feedback requirement: %',result;
      END IF;
      PERFORM set_config('role','postgres',true);
      INSERT INTO public.messages(room_id,user_id,user_role,content,parent_message_id,response_mode,created_at)
      VALUES(room,tutor,'tutor','Review the independent verification choice',answer,'tutoring',now()+interval '1 second');
      PERFORM set_config('role','service_role',true);
      result := public.get_transfer_assessment_review_v1(room,assessment,tutor);
      IF result->>'feedback_required' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Reviewed feedback not acknowledged'; END IF;
    ELSIF scenario='raw_grade' THEN
      result := public.post_assessment_message_v2(room,'B?',question,assessment,NULL,learner,request);
      answer := (result->'message'->>'id')::uuid;
      result := public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open','passed',ARRAY['B'],
        '{"status":"covered","understanding_level":"good"}','assessment_pass');
      IF result->>'answer_outcome' IS DISTINCT FROM 'passed' OR result->>'attempts_used' IS DISTINCT FROM '1' THEN
        RAISE EXCEPTION 'Trusted parser selection was not graded';
      END IF;
      result := public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open','passed',ARRAY['B'],
        '{"status":"covered","understanding_level":"good"}','assessment_pass');
      IF result->>'processing_state' IS DISTINCT FROM 'duplicate' OR result->>'attempts_used' IS DISTINCT FROM '1' THEN
        RAISE EXCEPTION 'Raw answer replay consumed another attempt';
      END IF;
    ELSIF scenario IN ('assisted','assisted_retry') THEN
      IF scenario='assisted_retry' THEN
        result := public.post_assessment_message_v2(room,'A',question,assessment,ARRAY['A'],learner,gen_random_uuid());
        answer := (result->'message'->>'id')::uuid;
        retry_answer := answer;
        result := public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open','retry',ARRAY['A'],
          '{"status":"covered","understanding_level":"good"}',NULL);
      END IF;
      result := public.post_assessment_message_v2(room,'What does independent mean?',question,assessment,NULL,learner,request);
      answer := (result->'message'->>'id')::uuid;
      result := public.get_transfer_assessment_processing_context_v1(assessment,answer,learner);
      IF result->'answer'->>'content' IS DISTINCT FROM 'What does independent mean?' THEN RAISE EXCEPTION 'Raw answer text missing'; END IF;
      result := public.cancel_transfer_assessment_v1(assessment,answer,learner,gen_random_uuid());
      IF result->>'code' IS DISTINCT FROM 'assisted' OR result->>'terminal' IS DISTINCT FROM 'true'
        OR (result->>'attempts_used')::integer IS DISTINCT FROM (CASE WHEN scenario='assisted_retry' THEN 1 ELSE 0 END) THEN
        RAISE EXCEPTION 'Assistance result incorrect: %',result;
      END IF;
      IF NOT EXISTS(SELECT 1 FROM public.checklist_items WHERE id=item AND status='covered' AND understanding_level='good')
        OR (SELECT count(*) FROM private.transfer_assessment_attempts WHERE assessment_id=assessment) <> (CASE WHEN scenario='assisted_retry' THEN 1 ELSE 0 END) THEN
        RAISE EXCEPTION 'Assistance consumed attempt or changed progress';
      END IF;
      result := public.cancel_transfer_assessment_v1(assessment,answer,learner,gen_random_uuid());
      IF result->>'processing_state' IS DISTINCT FROM 'duplicate' THEN RAISE EXCEPTION 'Cancellation replay not idempotent'; END IF;
      result := public.get_transfer_assessment_review_v1(room,assessment,tutor);
      IF result->>'resolution' IS DISTINCT FROM 'open' OR result->>'lifecycle' IS DISTINCT FROM 'cancelled' OR result->>'feedback_required' IS DISTINCT FROM 'false' THEN
        RAISE EXCEPTION 'Cancellation was represented as failure';
      END IF;
      IF retry_answer IS NOT NULL THEN
        result := public.get_transfer_assessment_processing_context_v1(assessment,retry_answer,learner);
        IF result->'authoritative_result'->>'answer_outcome' IS DISTINCT FROM 'retry' OR result->'authoritative_result'->>'attempt_number' IS DISTINCT FROM '1' THEN
          RAISE EXCEPTION 'Cancellation replaced prior accepted attempt history';
        END IF;
      END IF;
    ELSE RAISE EXCEPTION 'Unknown QA scenario';
    END IF;
  END IF;
END;
$test$;
ROLLBACK;
