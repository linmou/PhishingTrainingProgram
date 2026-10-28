--!/usr/bin/env psql
-- Purpose: prove API roles cannot mutate transfer authority or invoke legacy grading RPCs.
-- Self-contained current-contract fixtures; every row and helper setting rolls back.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL request.headers = '{"x-practice-contract":"cyberbullying-v2"}';
DO $fixture$
DECLARE
  tutor uuid := gen_random_uuid(); learner uuid := gen_random_uuid();
  room uuid := gen_random_uuid(); checklist uuid; item uuid := gen_random_uuid();
  focus uuid := gen_random_uuid(); question uuid := gen_random_uuid(); assessment uuid := gen_random_uuid();
  posted jsonb;
BEGIN
  INSERT INTO public.users(id,email,display_name,"current_role",status) VALUES
    (tutor,tutor||'@example.invalid','Direct role tutor','tutor','active'),
    (learner,learner||'@example.invalid','Direct role learner','student','active');
  INSERT INTO public.rooms(id,tutor_id,title,transfer_learning_enabled)
  VALUES(room,tutor,'Direct role transaction fixture',true);
  PERFORM public.join_room_v1(room,learner);
  PERFORM set_config('app.transfer_operation','on',true);
  posted := public.initialize_transfer_checklist_v1(room,learner,
    '[{"area_text":"Verify independently","item_type":"verification_step","priority":"important"}]',tutor);
  checklist := (posted->>'checklist_id')::uuid;
  INSERT INTO public.checklist_items(id,checklist_id,area_text,item_type,priority,status,understanding_level)
  VALUES(item,checklist,'Explain independent verification','verification_step','important','covered','good');
  INSERT INTO public.messages(id,room_id,user_id,user_role,content)
  VALUES(focus,room,learner,'student','I will use an independently verified contact');
  INSERT INTO public.messages(id,room_id,user_id,user_role,content,parent_message_id,response_mode,
    assessment_id,assessment_options,assessment_selection_type,assessment_student_id,assessment_lifecycle)
  VALUES(question,room,tutor,'tutor','Which contact should you use?',focus,'assessment',assessment,
    '[{"id":"A","text":"Reply"},{"id":"B","text":"Trusted contact"},{"id":"C","text":"Pay"},{"id":"D","text":"Forward"}]',
    'single',learner,'delivered');
  INSERT INTO private.transfer_assessments(id,question_message_id,room_id,student_id,checklist_id,item_id,focus_student_message_id,
    selection_type,correct_option_ids,learner_safe_explanation,transfer_basis,reviewed_private_payload,lifecycle,delivery_request_id,progress_snapshot_hash)
  VALUES(assessment,question,room,learner,checklist,item,focus,'single',ARRAY['B'],'Use an independent trusted contact',
    '{"concept_rule":"Independent verification","source_context":"Email","changed_context":"Text","source_evidence_message_ids":[]}',
    '{"target_item_id":"fixture"}','open',gen_random_uuid(),private.transfer_item_hash(item));
  posted := public.post_assessment_message_v2(room,'B',question,assessment,ARRAY['B'],learner,gen_random_uuid());
  PERFORM set_config('qa.transfer_assessment',assessment::text,true);
  PERFORM set_config('qa.transfer_answer',posted->'message'->>'id',true);
  PERFORM set_config('qa.transfer_student',learner::text,true);
  PERFORM set_config('qa.transfer_item',item::text,true);
  IF current_setting('qa.transfer_answer',true) IS NULL THEN RAISE EXCEPTION 'DIRECT_ROLE_FIXTURE_MISSING'; END IF;
  PERFORM set_config('app.transfer_operation','off',true);
END;
$fixture$;
CREATE TEMP TABLE transfer_direct_before ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM private.transfer_assessment_attempts) AS attempts,
  (SELECT count(*) FROM private.learning_event_inbox) AS events,
  (SELECT count(*) FROM public.coverage_evidence) AS evidence,
  (SELECT count(*) FROM public.checklist_updates) AS updates,
  (SELECT to_jsonb(i) FROM public.checklist_items i
   WHERE i.id = current_setting('qa.transfer_item')::uuid) AS target,
  (SELECT to_jsonb(a) FROM private.transfer_assessments a
   WHERE a.id = current_setting('qa.transfer_assessment')::uuid) AS assessment;
CREATE TEMP TABLE transfer_direct_results(role_name TEXT, path TEXT, sqlstate TEXT) ON COMMIT DROP;

SET LOCAL ROLE anon;
DO $attack$
DECLARE v_rows INTEGER;
BEGIN
  BEGIN
    PERFORM public.process_assessment_message_v2(
      current_setting('qa.transfer_assessment')::uuid, current_setting('qa.transfer_answer')::uuid,
      current_setting('qa.transfer_student')::uuid, gen_random_uuid(),
      0, 'open', 'passed', ARRAY['B'], '{"status":"covered","understanding_level":"good"}'::JSONB, 'assessment_pass'
    );
    PERFORM set_config('app.transfer_direct_rpc_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_rpc_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM public.process_assessment_message_v1(current_setting('qa.transfer_answer')::uuid, current_setting('qa.transfer_student')::uuid, gen_random_uuid());
    PERFORM set_config('app.transfer_direct_legacy_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_legacy_result', SQLSTATE, true);
  END;
  BEGIN
    UPDATE private.transfer_assessments SET learner_safe_explanation = 'Forged explanation'
    WHERE id = current_setting('qa.transfer_assessment')::uuid;
    PERFORM set_config('app.transfer_direct_table_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_table_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM count(*) FROM private.transfer_assessments;
    PERFORM set_config('app.transfer_direct_read_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_read_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM count(*) FROM private.transfer_assessment_attempts;
    PERFORM set_config('app.transfer_direct_attempt_read_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_attempt_read_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM count(*) FROM private.transfer_provider_attempts;
    PERFORM set_config('app.transfer_direct_provider_read_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_provider_read_result', SQLSTATE, true);
  END;
  BEGIN
    UPDATE public.checklist_items SET status = 'needs_review', understanding_level = 'basic'
    WHERE id = current_setting('qa.transfer_item')::uuid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM set_config('app.transfer_direct_progress_result',
      CASE WHEN v_rows = 0 THEN 'RLS_0' ELSE 'unexpected_success' END, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_progress_result', SQLSTATE, true);
  END;
END;
$attack$;
RESET ROLE;
INSERT INTO transfer_direct_results VALUES
  ('anon', 'v2_rpc', current_setting('app.transfer_direct_rpc_result', true)),
  ('anon', 'legacy_rpc', current_setting('app.transfer_direct_legacy_result', true)),
  ('anon', 'private_table', current_setting('app.transfer_direct_table_result', true)),
  ('anon', 'private_read', current_setting('app.transfer_direct_read_result', true)),
  ('anon', 'private_attempt_read', current_setting('app.transfer_direct_attempt_read_result', true)),
  ('anon', 'private_provider_read', current_setting('app.transfer_direct_provider_read_result', true)),
  ('anon', 'progress_write', current_setting('app.transfer_direct_progress_result', true));

SET LOCAL ROLE authenticated;
DO $attack$
DECLARE v_rows INTEGER;
BEGIN
  BEGIN
    PERFORM public.process_assessment_message_v2(
      current_setting('qa.transfer_assessment')::uuid, current_setting('qa.transfer_answer')::uuid,
      current_setting('qa.transfer_student')::uuid, gen_random_uuid(),
      0, 'open', 'passed', ARRAY['B'], '{"status":"covered","understanding_level":"good"}'::JSONB, 'assessment_pass'
    );
    PERFORM set_config('app.transfer_direct_rpc_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_rpc_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM public.process_assessment_message_v1(current_setting('qa.transfer_answer')::uuid, current_setting('qa.transfer_student')::uuid, gen_random_uuid());
    PERFORM set_config('app.transfer_direct_legacy_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_legacy_result', SQLSTATE, true);
  END;
  BEGIN
    UPDATE private.transfer_assessments SET learner_safe_explanation = 'Forged explanation'
    WHERE id = current_setting('qa.transfer_assessment')::uuid;
    PERFORM set_config('app.transfer_direct_table_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_table_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM count(*) FROM private.transfer_assessments;
    PERFORM set_config('app.transfer_direct_read_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_read_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM count(*) FROM private.transfer_assessment_attempts;
    PERFORM set_config('app.transfer_direct_attempt_read_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_attempt_read_result', SQLSTATE, true);
  END;
  BEGIN
    PERFORM count(*) FROM private.transfer_provider_attempts;
    PERFORM set_config('app.transfer_direct_provider_read_result', 'unexpected_success', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_provider_read_result', SQLSTATE, true);
  END;
  BEGIN
    UPDATE public.checklist_items SET status = 'needs_review', understanding_level = 'basic'
    WHERE id = current_setting('qa.transfer_item')::uuid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    PERFORM set_config('app.transfer_direct_progress_result',
      CASE WHEN v_rows = 0 THEN 'RLS_0' ELSE 'unexpected_success' END, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.transfer_direct_progress_result', SQLSTATE, true);
  END;
END;
$attack$;
RESET ROLE;
INSERT INTO transfer_direct_results VALUES
  ('authenticated', 'v2_rpc', current_setting('app.transfer_direct_rpc_result', true)),
  ('authenticated', 'legacy_rpc', current_setting('app.transfer_direct_legacy_result', true)),
  ('authenticated', 'private_table', current_setting('app.transfer_direct_table_result', true)),
  ('authenticated', 'private_read', current_setting('app.transfer_direct_read_result', true)),
  ('authenticated', 'private_attempt_read', current_setting('app.transfer_direct_attempt_read_result', true)),
  ('authenticated', 'private_provider_read', current_setting('app.transfer_direct_provider_read_result', true)),
  ('authenticated', 'progress_write', current_setting('app.transfer_direct_progress_result', true));

DO $assert$
BEGIN
  IF (SELECT count(*) FROM transfer_direct_results
      WHERE path NOT IN ('progress_write','legacy_rpc') AND sqlstate = '42501') <> 10
     OR (SELECT count(*) FROM transfer_direct_results WHERE path = 'legacy_rpc'
       AND (sqlstate = '42501' OR (sqlstate = '42883'
         AND to_regprocedure('public.process_assessment_message_v1(uuid,uuid,uuid)') IS NULL))) <> 2
     OR (SELECT count(*) FROM transfer_direct_results
      WHERE path = 'progress_write' AND sqlstate IN ('42501', 'RLS_0')) <> 2
     OR EXISTS (
       SELECT 1 FROM transfer_direct_before b
       WHERE b.attempts <> (SELECT count(*) FROM private.transfer_assessment_attempts)
          OR b.events <> (SELECT count(*) FROM private.learning_event_inbox)
          OR b.evidence <> (SELECT count(*) FROM public.coverage_evidence)
          OR b.updates <> (SELECT count(*) FROM public.checklist_updates)
          OR b.target IS DISTINCT FROM (SELECT to_jsonb(i) FROM public.checklist_items i
             WHERE i.id = current_setting('qa.transfer_item')::uuid)
          OR b.assessment IS DISTINCT FROM (SELECT to_jsonb(a) FROM private.transfer_assessments a
             WHERE a.id = current_setting('qa.transfer_assessment')::uuid)
     ) THEN
    RAISE EXCEPTION 'direct-role denial or zero-mutation check failed';
  END IF;
END;
$assert$;

SELECT * FROM transfer_direct_results ORDER BY role_name, path;
ROLLBACK;
