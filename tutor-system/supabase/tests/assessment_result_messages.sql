--!/usr/bin/env psql
-- Test responsibility: assessment_result_messages migration; actual grading, atomic events, backfill, readiness, permissions, feedback gates and Guard replay.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE assessment_result_test_evidence(case_id text PRIMARY KEY, detail jsonb NOT NULL) ON COMMIT DROP;
CREATE FUNCTION pg_temp.fail_assessment_result_write() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.assessment_event IS NOT NULL AND current_setting('qa.fail_result_write',true)='on' THEN
    RAISE EXCEPTION 'QA_RESULT_WRITE_FAILURE';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER qa_fail_assessment_result_write BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_assessment_result_write();

DO $test$
DECLARE
  tutor uuid := gen_random_uuid(); learner uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  room uuid := gen_random_uuid(); checklist uuid; item uuid; focus uuid := gen_random_uuid();
  assessment uuid; question uuid; answer uuid; second_answer uuid; event_id uuid; result_id uuid;
  scenario text; outcome text; selected text[]; result jsonb; previous jsonb; review jsonb;
  denied boolean; before_sources jsonb; after_sources jsonb; original_time timestamptz := now()-interval '2 days';
  options jsonb := '[{"id":"A","text":"Reply"},{"id":"B","text":"Call trusted contact"},{"id":"C","text":"Pay"},{"id":"D","text":"Forward"}]';
BEGIN
  INSERT INTO public.users(id,email,display_name,"current_role",status) VALUES
    (tutor,tutor||'@example.invalid','Result tutor','tutor','active'),
    (learner,learner||'@example.invalid','Result learner','student','active'),
    (outsider,outsider||'@example.invalid','Other learner','student','active');
  INSERT INTO public.rooms(id,tutor_id,title,transfer_learning_enabled) VALUES(room,tutor,'Assessment result SQL acceptance',true);
  PERFORM public.join_room_v1(room,learner);
  PERFORM public.join_room_v1(room,outsider);
  PERFORM set_config('app.transfer_operation','on',true);
  result := public.initialize_transfer_checklist_v1(room,learner,
    '[{"area_text":"Verify independently","item_type":"verification_step","priority":"important"}]',tutor);
  checklist := (result->>'checklist_id')::uuid;
  INSERT INTO public.messages(id,room_id,user_id,user_role,content) VALUES(focus,room,learner,'student','I would verify the request');

  FOREACH scenario IN ARRAY ARRAY['failure','pass','retry_pass','assisted','assisted_retry','target_edit','guard','guard_invalidated','rollback','historical','nonconsuming','guard_raw','terminal_unaccepted','pending'] LOOP
    item := gen_random_uuid(); question := gen_random_uuid(); assessment := gen_random_uuid();
    INSERT INTO public.checklist_items(id,checklist_id,area_text,item_type,priority,status,understanding_level)
    VALUES(item,checklist,'Verify independently '||scenario,'verification_step','important','covered','good');
    INSERT INTO public.messages(id,room_id,user_id,user_role,content,parent_message_id,response_mode,
      assessment_id,assessment_options,assessment_selection_type,assessment_student_id,assessment_lifecycle,created_at)
    VALUES(question,room,tutor,'tutor','Which action verifies independently?',focus,'assessment',assessment,options,'single',learner,'delivered',original_time);
    INSERT INTO private.transfer_assessments(id,question_message_id,room_id,student_id,checklist_id,item_id,focus_student_message_id,
      selection_type,correct_option_ids,learner_safe_explanation,transfer_basis,reviewed_private_payload,lifecycle,delivery_request_id,progress_snapshot_hash)
    VALUES(assessment,question,room,learner,checklist,item,focus,'single',ARRAY['B'],'Use a trusted independent contact',
      '{"concept_rule":"independent verification","source_context":"email","changed_context":"text","source_evidence_message_ids":[]}',
      '{"target_item_id":"test"}','open',gen_random_uuid(),private.transfer_item_hash(item));
    IF scenario IN ('nonconsuming','guard_raw','terminal_unaccepted') THEN
      IF scenario='guard_raw' THEN UPDATE public.rooms SET active_response_mode='guard' WHERE id=room; END IF;
      result:=public.post_assessment_message_v2(room,CASE WHEN scenario='nonconsuming' THEN 'A or B' ELSE 'B' END,
        question,assessment,CASE WHEN scenario='nonconsuming' THEN NULL ELSE ARRAY['B'] END,learner,gen_random_uuid());
      answer:=(result->'message'->>'id')::uuid;
      IF scenario='terminal_unaccepted' THEN
        result:=public.post_assessment_message_v2(room,'B',question,assessment,ARRAY['B'],learner,gen_random_uuid());
        second_answer:=(result->'message'->>'id')::uuid;
        PERFORM public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open','passed',ARRAY['B'],
          '{"status":"covered","understanding_level":"good"}','assessment_pass');
        result:=public.record_transfer_assessment_processing_v1(assessment,second_answer,learner,gen_random_uuid(),0,'open','duplicate');
        IF result->>'code' IS DISTINCT FROM 'CONCURRENT_MODIFICATION' THEN RAISE EXCEPTION 'Stale rejection snapshot was accepted'; END IF;
        result:=public.record_transfer_assessment_processing_v1(assessment,second_answer,learner,gen_random_uuid(),1,'passed','duplicate');
        IF result->>'attempts_used'<>'1' OR result->>'answer_outcome' IS NOT NULL OR result->'result_message'<>'null'::jsonb THEN
          RAISE EXCEPTION 'Concurrent unaccepted answer fabricated grade: %',result; END IF;
      ELSE
        result:=public.record_transfer_assessment_processing_v1(assessment,answer,learner,gen_random_uuid(),0,'open',
          CASE WHEN scenario='guard_raw' THEN 'guard_deferred' ELSE 'AMBIGUOUS_SELECTION' END);
        review:=public.get_transfer_assessment_review_v1(room,assessment,tutor);
        IF review->'history_readiness'->>'ready'<>'true'
          OR NOT(review->'history_readiness'->'handled_answer_message_ids' ? answer::text)
          OR EXISTS(SELECT 1 FROM private.transfer_assessment_attempts WHERE assessment_id=assessment) THEN
          RAISE EXCEPTION 'Handled non-consuming answer remained pending or consumed attempt: %',review; END IF;
        IF scenario='guard_raw' THEN
          UPDATE public.rooms SET active_response_mode='tutoring',mode_change_source='manual_override' WHERE id=room;
          review:=public.get_transfer_assessment_review_v1(room,assessment,tutor);
          IF review->'history_readiness'->>'ready'<>'false' THEN RAISE EXCEPTION 'Guard clearance did not request recovery'; END IF;
          review:=public.get_transfer_assessment_processing_context_v1(assessment,answer,learner);
          IF review->'authoritative_result'<>'null'::jsonb THEN RAISE EXCEPTION 'Guard recovery reused stale deferral'; END IF;
        ELSE
          result:=public.post_assessment_message_v2(room,'B',question,assessment,ARRAY['B'],learner,gen_random_uuid());
          answer:=(result->'message'->>'id')::uuid;
        END IF;
        result:=public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open','passed',ARRAY['B'],
          '{"status":"covered","understanding_level":"good"}','assessment_pass');
      END IF;
      review:=public.get_transfer_assessment_review_v1(room,assessment,tutor);
      IF review->'history_readiness'->>'ready'<>'true' OR (SELECT count(*) FROM private.transfer_assessment_attempts WHERE assessment_id=assessment)<>1 THEN
        RAISE EXCEPTION 'Recovery stranded history or changed attempt count: %',review; END IF;
      INSERT INTO assessment_result_test_evidence VALUES(scenario,result || jsonb_build_object('readiness',review->'history_readiness'));
      CONTINUE;
    END IF;
    IF scenario='target_edit' THEN
      UPDATE public.checklist_items SET area_text='Changed target' WHERE id=item;
      SELECT private.transfer_public_message(id) INTO result FROM public.messages
        WHERE assessment_event->>'kind'='closure' AND assessment_event->>'assessment_id'=assessment::text;
      IF result->'assessment_event'->>'closure_reason' IS DISTINCT FROM 'target_changed'
        OR result->'assessment_event'->>'lifecycle' IS DISTINCT FROM 'cancelled'
        OR (SELECT assessment_lifecycle FROM public.messages WHERE id=question)<>'cancelled' THEN
        RAISE EXCEPTION 'Target edit did not publish cancellation: %',result; END IF;
      INSERT INTO assessment_result_test_evidence VALUES(scenario,result);
      CONTINUE;
    END IF;
    selected := CASE WHEN scenario IN ('assisted','assisted_retry') THEN NULL WHEN scenario IN ('pass','guard','guard_invalidated','rollback') THEN ARRAY['B'] ELSE ARRAY['A'] END;
    IF scenario='assisted_retry' THEN
      result := public.post_assessment_message_v2(room,'A',question,assessment,ARRAY['A'],learner,gen_random_uuid());
      answer := (result->'message'->>'id')::uuid;
      PERFORM public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open','retry',ARRAY['A'],
        '{"status":"covered","understanding_level":"good"}',NULL);
    END IF;
    result := public.post_assessment_message_v2(room,CASE WHEN selected IS NULL THEN 'What does verify mean?' ELSE selected[1] END,
      question,assessment,selected,learner,gen_random_uuid());
    answer := (result->'message'->>'id')::uuid;
    IF scenario='pending' THEN
      review := public.get_transfer_assessment_review_v1(room,assessment,tutor);
      IF review->'history_readiness'->>'ready' IS DISTINCT FROM 'false'
        OR NOT (review->'history_readiness'->'pending_answer_message_ids' ? answer::text) THEN
        RAISE EXCEPTION 'Pending answer did not block generation: %',review; END IF;
      INSERT INTO assessment_result_test_evidence VALUES(scenario,review->'history_readiness');
      -- Resolve through trusted cancellation so subsequent checks remain complete.
      UPDATE private.transfer_assessments SET lifecycle='cancelled',closed_at=now() WHERE id=assessment;
      CONTINUE;
    ELSIF scenario='historical' THEN
      INSERT INTO private.transfer_assessment_attempts(assessment_id,answer_message_id,request_id,attempt_number,
        selected_option_ids,answer_outcome,processing_state,authoritative_result,created_at)
      VALUES(assessment,answer,gen_random_uuid(),1,ARRAY['A'],'retry','applied',
        jsonb_build_object('message_id',answer,'assessment_id',assessment,'attempt_number',1,'answer_outcome','retry'),original_time+interval '1 hour');
      UPDATE private.transfer_assessments SET attempt_count=1 WHERE id=assessment;
      review := public.get_transfer_assessment_review_v1(room,assessment,tutor);
      IF review->'history_readiness'->>'ready' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Missing historical result not blocked'; END IF;
      SELECT jsonb_build_object('assessments',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM private.transfer_assessments a WHERE room_id=room),
        'attempts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM private.transfer_assessment_attempts t WHERE assessment_id IN (SELECT id FROM private.transfer_assessments WHERE room_id=room)),
        'progress',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.checklist_items i WHERE checklist_id=checklist)) INTO before_sources;
      result := private.backfill_assessment_event_messages();
      SELECT jsonb_build_object('assessments',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM private.transfer_assessments a WHERE room_id=room),
        'attempts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM private.transfer_assessment_attempts t WHERE assessment_id IN (SELECT id FROM private.transfer_assessments WHERE room_id=room)),
        'progress',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.checklist_items i WHERE checklist_id=checklist)) INTO after_sources;
      IF before_sources IS DISTINCT FROM after_sources THEN RAISE EXCEPTION 'Backfill changed authoritative source state'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.messages WHERE assessment_event->>'answer_message_id'=answer::text
        AND created_at=original_time+interval '1 hour') THEN RAISE EXCEPTION 'Backfill lost original event time'; END IF;
      result := private.backfill_assessment_event_messages();
      IF result->>'inserted' IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'Backfill not idempotent: %',result; END IF;
      INSERT INTO assessment_result_test_evidence VALUES(scenario,result || jsonb_build_object('sources_unchanged',true));
      UPDATE private.transfer_assessments SET lifecycle='cancelled',closed_at=now() WHERE id=assessment;
      CONTINUE;
    ELSIF scenario IN ('assisted','assisted_retry') THEN
      result := public.cancel_transfer_assessment_v1(assessment,answer,learner,gen_random_uuid());
      previous := result;
      result := public.cancel_transfer_assessment_v1(assessment,answer,learner,gen_random_uuid());
      IF result->'result_message'->>'id' IS DISTINCT FROM previous->'result_message'->>'id'
        OR result->>'processing_state' IS DISTINCT FROM 'duplicate'
        OR result->'result_message'->'assessment_event'->>'closure_reason' IS DISTINCT FROM 'assisted'
        OR result->>'attempts_used' IS DISTINCT FROM (CASE WHEN scenario='assisted' THEN '0' ELSE '1' END) THEN
        RAISE EXCEPTION 'Assistance/replay consumed an attempt or duplicated closure: %',result; END IF;
      review := public.get_transfer_assessment_processing_context_v1(assessment,answer,learner);
      IF review->'authoritative_result'->'result_message'->>'id' IS DISTINCT FROM result->'result_message'->>'id' THEN
        RAISE EXCEPTION 'Assistance fast replay lost result'; END IF;
      INSERT INTO assessment_result_test_evidence VALUES(scenario,result);
      CONTINUE;
    END IF;
    outcome := CASE WHEN selected=ARRAY['B'] THEN 'passed' ELSE 'retry' END;
    IF scenario IN ('guard','guard_invalidated') THEN UPDATE public.rooms SET active_response_mode='guard' WHERE id=room; END IF;
    IF scenario='rollback' THEN
      PERFORM set_config('qa.fail_result_write','on',true);
      denied := false;
      BEGIN
        PERFORM public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open',outcome,selected,
          '{"status":"covered","understanding_level":"good"}','assessment_pass');
      EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='QA_RESULT_WRITE_FAILURE'; END;
      PERFORM set_config('qa.fail_result_write','',true);
      IF NOT denied OR EXISTS(SELECT 1 FROM private.transfer_assessment_attempts WHERE assessment_id=assessment)
        OR EXISTS(SELECT 1 FROM private.learning_event_inbox WHERE event_payload->>'assessment_id'=assessment::text)
        OR EXISTS(SELECT 1 FROM public.coverage_evidence WHERE assessment_id=assessment)
        OR EXISTS(SELECT 1 FROM public.checklist_updates WHERE assessment_id=assessment)
        OR (SELECT lifecycle FROM private.transfer_assessments WHERE id=assessment)<>'open'
        OR (SELECT attempt_count FROM private.transfer_assessments WHERE id=assessment)<>0
        OR (SELECT assessment_lifecycle FROM public.messages WHERE id=question)<>'delivered' THEN
        RAISE EXCEPTION 'Failed result write did not roll back the whole grade'; END IF;
    END IF;
    result := public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open',outcome,selected,
      '{"status":"covered","understanding_level":"good"}',CASE WHEN outcome='passed' THEN 'assessment_pass' END);
    previous := result;
    result_id := (result->'result_message'->>'id')::uuid;
    IF result_id IS NULL OR result->'result_message'->'assessment' IS DISTINCT FROM 'null'::jsonb
      OR result->'result_message'->'response_mode' IS DISTINCT FROM 'null'::jsonb
      OR result->'result_message'->'assessment_event'->>'answer_message_id' IS DISTINCT FROM answer::text THEN
      RAISE EXCEPTION 'Unsafe or incomplete result projection: %',result; END IF;
    IF outcome='retry' THEN
      IF result->'result_message'->>'content' IS DISTINCT FROM 'Incorrect. One attempt remaining.'
        OR result->'result_message'->'assessment_event'->>'attempts_remaining' IS DISTINCT FROM '1'
        OR result->'result_message'->'assessment_event' ? 'correct_option_ids'
        THEN RAISE EXCEPTION 'Retry disclosed answer or lost retry: %',result; END IF;
    ELSE
      IF result->'result_message'->>'content' IS DISTINCT FROM 'Correct.' THEN RAISE EXCEPTION 'Pass disclosed explanation: %',result; END IF;
    END IF;
    result := public.process_assessment_message_v2(assessment,answer,learner,gen_random_uuid(),0,'open',outcome,selected,
      '{"status":"covered","understanding_level":"good"}',CASE WHEN outcome='passed' THEN 'assessment_pass' END);
    IF result->>'processing_state' IS DISTINCT FROM 'duplicate' OR result->'result_message'->>'id' IS DISTINCT FROM result_id::text
      OR (SELECT count(*) FROM public.messages WHERE assessment_event->>'answer_message_id'=answer::text AND assessment_event->>'kind'='result')<>1 THEN
      RAISE EXCEPTION 'Grading replay duplicated result: %',result; END IF;
    review := public.get_transfer_assessment_processing_context_v1(assessment,answer,learner);
    IF review->'authoritative_result'->'result_message'->>'id' IS DISTINCT FROM result_id::text THEN RAISE EXCEPTION 'Fast replay lost saved result'; END IF;
    denied:=false;
    BEGIN PERFORM public.process_assessment_message_v2(assessment,answer,outsider,gen_random_uuid(),0,'open',outcome,selected,
      '{"status":"covered","understanding_level":"good"}',NULL);
    EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='WRONG_LEARNER'; END;
    IF NOT denied THEN RAISE EXCEPTION 'Wrong learner could process result'; END IF;
    denied:=false;
    BEGIN UPDATE public.messages SET content='Changed grade' WHERE id=result_id;
    EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='IMMUTABLE_ASSESSMENT_EVENT'; END;
    IF NOT denied THEN RAISE EXCEPTION 'Legacy privileged writes can alter result content'; END IF;
    denied:=false;
    BEGIN DELETE FROM public.messages WHERE id=result_id;
    EXCEPTION WHEN insufficient_privilege THEN denied:=SQLERRM='IMMUTABLE_ASSESSMENT_EVENT'; END;
    IF NOT denied THEN RAISE EXCEPTION 'Legacy privileged writes can delete live result'; END IF;
    PERFORM set_config('role','authenticated',true);
    denied:=false;
    BEGIN
      PERFORM set_config('app.assessment_event_writer','on',true);
      INSERT INTO public.messages(room_id,user_id,user_role,content,assessment_event)
      VALUES(room,learner,'student','Correct.',previous->'result_message'->'assessment_event');
    EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
    PERFORM set_config('role','postgres',true);
    IF NOT denied THEN RAISE EXCEPTION 'Participant forged trusted event'; END IF;
    IF scenario IN ('failure','retry_pass') THEN
      selected := CASE WHEN scenario='failure' THEN ARRAY['C'] ELSE ARRAY['B'] END;
      outcome := CASE WHEN scenario='failure' THEN 'failed' ELSE 'passed' END;
      result := public.post_assessment_message_v2(room,selected[1],question,assessment,selected,learner,gen_random_uuid());
      second_answer := (result->'message'->>'id')::uuid;
      result := public.process_assessment_message_v2(assessment,second_answer,learner,gen_random_uuid(),1,'open',outcome,selected,
        CASE WHEN outcome='failed' THEN '{"status":"needs_review","understanding_level":"basic"}' ELSE '{"status":"covered","understanding_level":"good"}' END::jsonb,
        CASE WHEN outcome='failed' THEN 'assessment_fail' ELSE 'assessment_pass' END);
      IF result->'result_message'->'assessment_event'->>'attempt_number' IS DISTINCT FROM '2'
        OR result->'result_message'->'assessment_event'->>'terminal' IS DISTINCT FROM 'true'
        OR (outcome='failed' AND result->'result_message'->>'content' IS DISTINCT FROM E'Incorrect. No attempts remaining. Correct option(s): B.\nUse a trusted independent contact')
        OR (outcome='passed' AND result->'result_message'->>'content' IS DISTINCT FROM 'Correct.') THEN
        RAISE EXCEPTION 'Second attempt result disclosure/count incorrect: %',result; END IF;
      answer := second_answer;
    END IF;
    IF scenario IN ('guard','guard_invalidated') THEN
      IF previous->>'processing_state' IS DISTINCT FROM 'deferred'
        OR previous->'result_message'->'assessment_event'->>'progress_deferred' IS DISTINCT FROM 'true'
        OR EXISTS(SELECT 1 FROM public.checklist_updates WHERE assessment_id=assessment) THEN
        RAISE EXCEPTION 'Guard did not preserve grade while deferring progress: %',previous; END IF;
      IF scenario='guard_invalidated' THEN
        UPDATE public.checklist_items SET area_text='Changed during Guard' WHERE id=item;
      END IF;
      UPDATE public.rooms SET active_response_mode='tutoring',mode_change_source='manual_override' WHERE id=room;
      IF scenario='guard_invalidated' THEN
        IF NOT EXISTS(SELECT 1 FROM public.messages WHERE assessment_event->>'assessment_id'=assessment::text
          AND assessment_event->>'kind'='closure' AND assessment_event->>'closure_reason'='progress_invalidated')
          OR (SELECT content FROM public.messages WHERE id=result_id)<>'Correct.' THEN
          RAISE EXCEPTION 'Guard invalidation lost original grade or closure'; END IF;
      ELSIF (SELECT count(*) FROM public.checklist_updates WHERE assessment_id=assessment)<>1 THEN
        RAISE EXCEPTION 'Guard replay did not apply progress exactly once';
      END IF;
    END IF;
    review := public.get_transfer_assessment_review_v1(room,assessment,tutor);
    IF review->'history_readiness'->>'ready' IS DISTINCT FROM 'true'
      OR NOT (review->'history_readiness'->'result_message_ids' ? result_id::text)
      OR (scenario<>'guard_invalidated' AND review->>'feedback_required' IS DISTINCT FROM 'true') THEN
      RAISE EXCEPTION 'Result not ready or automatic message satisfied human feedback: %',review; END IF;
    INSERT INTO assessment_result_test_evidence VALUES(scenario,result || jsonb_build_object('readiness',review->'history_readiness'));
    IF scenario<>'guard_invalidated' THEN
      INSERT INTO public.messages(room_id,user_id,user_role,content,parent_message_id,response_mode,created_at)
      VALUES(room,tutor,'tutor','Review your verification choice',answer,'tutoring',clock_timestamp()+interval '1 second');
      review := public.get_transfer_assessment_review_v1(room,assessment,tutor);
      IF review->>'feedback_required' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Real tutor feedback not acknowledged'; END IF;
    END IF;
  END LOOP;
  -- The old public posting RPC can publish text, but cannot attach trusted provenance.
  result := public.post_assessment_message_v1(room,'Correct.',NULL,NULL,tutor,gen_random_uuid());
  IF result->'message'->'assessment_event' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Legacy post forged event provenance'; END IF;
  INSERT INTO assessment_result_test_evidence VALUES('legacy_post',jsonb_build_object('trusted_event',false));
  -- A separate browser clear request has no inherited transfer-write scope.
  INSERT INTO public.coverage_evidence(item_id,message_id,evidence_text,confidence_score,detection_method,analysis)
  VALUES(item,focus,'Trusted method evidence',100,'ai_analysis','Independent verification');
  INSERT INTO private.learning_event_inbox(event_id,dedupe_key,room_id,student_id,checklist_id,item_id,
    source_message_id,event_kind,event_payload,classified_by,processing_state)
  VALUES(gen_random_uuid(),gen_random_uuid()::text,room,learner,checklist,item,focus,'initial_signal','{}','trusted_backend','applied');
  SELECT jsonb_build_object('items',(SELECT md5(string_agg(to_jsonb(ci)::text,'' ORDER BY ci.id)) FROM public.checklist_items ci WHERE ci.checklist_id=checklist),
    'checklists',(SELECT to_jsonb(sc) FROM public.session_checklists sc WHERE sc.id=checklist),
    'evidence',(SELECT jsonb_agg(to_jsonb(e)-'message_id' ORDER BY e.id) FROM public.coverage_evidence e JOIN public.checklist_items ci ON ci.id=e.item_id WHERE ci.checklist_id=checklist),
    'inbox',(SELECT jsonb_agg(to_jsonb(e)-'source_message_id' ORDER BY e.event_id) FROM private.learning_event_inbox e WHERE e.room_id=room)) INTO before_sources;
  PERFORM set_config('app.transfer_operation','',true);
  denied:=false;
  BEGIN PERFORM public.clear_room_chat_history_v1(room,learner);
  EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Learner cleared room history'; END IF;
  result:=public.clear_room_chat_history_v1(room,tutor);
  IF result->>'success'<>'true' OR EXISTS(SELECT 1 FROM public.messages WHERE room_id=room)
    OR EXISTS(SELECT 1 FROM private.transfer_assessments WHERE room_id=room)
    OR EXISTS(SELECT 1 FROM public.message_feedback WHERE room_id=room) THEN RAISE EXCEPTION 'Owner clear failed: %',result; END IF;
  SELECT jsonb_build_object('items',(SELECT md5(string_agg(to_jsonb(ci)::text,'' ORDER BY ci.id)) FROM public.checklist_items ci WHERE ci.checklist_id=checklist),
    'checklists',(SELECT to_jsonb(sc) FROM public.session_checklists sc WHERE sc.id=checklist),
    'evidence',(SELECT jsonb_agg(to_jsonb(e)-'message_id' ORDER BY e.id) FROM public.coverage_evidence e JOIN public.checklist_items ci ON ci.id=e.item_id WHERE ci.checklist_id=checklist),
    'inbox',(SELECT jsonb_agg(to_jsonb(e)-'source_message_id' ORDER BY e.event_id) FROM private.learning_event_inbox e WHERE e.room_id=room)) INTO after_sources;
  IF before_sources IS DISTINCT FROM after_sources
    OR EXISTS(SELECT 1 FROM public.coverage_evidence e JOIN public.checklist_items ci ON ci.id=e.item_id WHERE ci.checklist_id=checklist AND e.message_id IS NOT NULL)
    OR EXISTS(SELECT 1 FROM private.learning_event_inbox WHERE room_id=room AND source_message_id IS NOT NULL)
    OR current_setting('app.transfer_operation',true) IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'Owner clear changed progress/evidence, retained source links or leaked trusted scope'; END IF;
  INSERT INTO assessment_result_test_evidence VALUES('owner_clear',result);
END;
$test$;

SELECT case_id,detail FROM assessment_result_test_evidence ORDER BY case_id;
SELECT count(*) AS passed_cases FROM assessment_result_test_evidence;
ROLLBACK;
