-- Issue 96. Run against a disposable restored baseline; rolls all fixtures back.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL request.headers = '{"x-practice-contract":"cyberbullying-v2"}';
DO $test$
DECLARE
  t uuid := gen_random_uuid(); l uuid := gen_random_uuid(); r uuid := gen_random_uuid();
  c uuid; m uuid := gen_random_uuid(); result jsonb; historical uuid := gen_random_uuid(); original jsonb; i uuid; old_message uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.users(id,display_name,"current_role",status) VALUES
    (t,'Tracking test tutor','tutor','active'),(l,'Tracking test learner','student','active');
  INSERT INTO public.rooms(id,tutor_id,title,transfer_learning_enabled)
    VALUES(r,t,'Independent learning fixture',false);
  PERFORM public.join_room_v1(r,l);
  PERFORM set_config('app.transfer_operation','on',true);
  INSERT INTO public.session_checklists(id,room_id,template_name,progress_policy_version,is_active)
    VALUES(historical,r,'Historical targets','legacy_v1',true);
  INSERT INTO public.messages(id,room_id,user_id,user_role,content,created_at)
    VALUES(old_message,r,l,'student','Historical evidence',now()-interval '1 day');
  result := public.get_transfer_message_analysis_context_v1(r,old_message,l);
  ASSERT result->>'historical_read_only'='true','historical entry must not reactivate judging';
  SELECT to_jsonb(sc) INTO original FROM public.session_checklists sc WHERE id=historical;
  result := public.initialize_transfer_checklist_v1(r,l,
    '[{"area_text":"Verify sender independently","item_type":"detection_area","priority":"important"}]',t);
  c := (result->>'checklist_id')::uuid;
  result := public.get_transfer_message_analysis_context_v1(r,old_message,l);
  ASSERT result->>'historical_read_only'='true','new targets must not rejudge historical messages';
  ASSERT c<>historical,'setup must not convert historical checklist';
  ASSERT (SELECT to_jsonb(sc) FROM public.session_checklists sc WHERE id=historical)=original,
    'historical checklist must remain byte-for-byte unchanged';
  ASSERT EXISTS(SELECT 1 FROM public.session_checklists WHERE id=c AND student_id=l
    AND progress_policy_version='transfer_v1'),'assessment-off setup must be learner-owned';
  INSERT INTO public.messages(id,room_id,user_id,user_role,content)
    VALUES(m,r,l,'student','I would check the sender using the official site.');
  result := public.get_transfer_message_analysis_context_v1(r,m,l);
  ASSERT result->>'checklist_id'=c::text,'assessment-off analysis must resolve learner scope';
  UPDATE public.rooms SET transfer_learning_enabled=true WHERE id=r;
  result := public.get_transfer_message_analysis_context_v1(r,m,l);
  ASSERT result->>'checklist_id'=c::text,'assessment toggle must preserve checklist identity';
  UPDATE public.rooms SET transfer_learning_enabled=false WHERE id=r;
  result := public.get_transfer_message_analysis_context_v1(r,m,l);
  ASSERT result->>'checklist_id'=c::text,'toggle back must preserve checklist identity';
  ASSERT (SELECT count(*) FROM public.session_checklists WHERE room_id=r AND progress_policy_version='legacy_v1')=1,
    'new tracking must never create additional room-wide records';
  ASSERT (SELECT to_jsonb(sc) FROM public.session_checklists sc WHERE id=historical)=original,
    'toggle must not mutate historical records';
  SELECT id INTO i FROM public.checklist_items WHERE checklist_id=c LIMIT 1;
  SET LOCAL ROLE service_role;
  result := public.edit_room_checklist_v1(r,t,gen_random_uuid(),'set_status',i,'{"status":"covered"}');
  RESET ROLE;
  ASSERT (SELECT status FROM public.checklist_items WHERE id=i)='covered','authorized manual edit remains available';
  SET LOCAL ROLE anon;
  BEGIN
    UPDATE public.checklist_items SET status='pending' WHERE id=i;
    RAISE EXCEPTION 'browser automatic write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
END;
$test$;
-- Direct browser mutation is forbidden even where permissive legacy policies remain.
DO $permissions$
DECLARE browser_role text; relation_name text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH relation_name IN ARRAY ARRAY['session_checklists','checklist_items','coverage_evidence','checklist_updates'] LOOP
      ASSERT NOT has_table_privilege(browser_role,'public.'||relation_name,'INSERT'), 'browser INSERT still granted';
      ASSERT NOT has_table_privilege(browser_role,'public.'||relation_name,'UPDATE'), 'browser UPDATE still granted';
      ASSERT NOT has_table_privilege(browser_role,'public.'||relation_name,'DELETE'), 'browser DELETE still granted';
      ASSERT has_table_privilege(browser_role,'public.'||relation_name,'SELECT'), 'read/export grant removed';
    END LOOP;
    ASSERT NOT has_function_privilege(browser_role,'public.initialize_checklist_from_template(uuid,text)','EXECUTE'),
      'legacy initialization still executable';
    ASSERT NOT has_function_privilege(browser_role,'public.update_checklist_progress(uuid)','EXECUTE'),
      'legacy aggregate write still executable';
  END LOOP;
END;
$permissions$;
ROLLBACK;
