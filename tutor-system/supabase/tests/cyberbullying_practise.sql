-- Covers the Cyberbullying practice migration: subject identity, Guard conversion, targets and preserved shared behavior.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rooms'
      AND column_name='practice_type' AND data_type='text'
  ), 'rooms.practice_type must exist';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rooms'
      AND column_name='guard_mode' AND data_type='boolean'
  ), 'rooms.guard_mode must be boolean';
  ASSERT NOT EXISTS (SELECT 1 FROM public.rooms WHERE practice_type IS NULL OR guard_mode IS NULL),
    'existing rooms require explicit subject and Guard values';
  ASSERT (SELECT count(*) FROM public.cyberbullying_learning_targets())=5,
    'Cyberbullying requires the shared five-target inventory';
  ASSERT NOT has_function_privilege('anon','public.post_assessment_message_v1(uuid,text,uuid,uuid,uuid,uuid)','EXECUTE'),
    'legacy message endpoint retains production permissions';
  ASSERT NOT has_function_privilege('service_role','public.process_assessment_message_v1(uuid,uuid,uuid)','EXECUTE'),
    'retired processing endpoint retains production permissions';
  ASSERT NOT has_function_privilege('anon','public.send_reviewed_tutor_response_v3(jsonb,uuid,uuid,uuid,uuid,uuid,uuid,uuid)','EXECUTE'),
    'retired review endpoint retains production permissions';
END;
$test$;
UPDATE private.practice_write_gate SET closed=false WHERE singleton;
SET LOCAL request.headers='{"x-practice-contract":"cyberbullying-v1"}';
DO $test$
DECLARE
 tutor uuid:=gen_random_uuid();
 learner uuid:=gen_random_uuid();
 observer uuid:=gen_random_uuid();
 room uuid:=gen_random_uuid();
 checklist uuid;
 joined jsonb;
BEGIN
 INSERT INTO users(id,display_name,"current_role",status) VALUES
 (tutor,'Cyber migration tutor','tutor','active'),
 (learner,'Cyber migration learner','student','active'),
 (observer,'Cyber migration observer','student','active');
 INSERT INTO rooms(id,tutor_id,title,practice_type,scenario_config)
 VALUES(room,tutor,'Cyber migration fixture','cyberbullying','{"id":"fixture","source_commit":"fixture-commit","post":{"text":"Fixture post","image":"/images/EWWW_meme.jpg","timestamp":"2026-10-21T00:00:00Z","author":{"id":"fixture-author","name":"Sarah","role":"simulated_user","profile_picture":"/images/profile_1.png"}},"initial_comments":[]}');
 joined:=join_room_v1(room,learner);
 ASSERT joined->>'room_role'='student','first learner allocation';
 SELECT id INTO checklist FROM session_checklists WHERE room_id=room AND student_id=learner AND is_active;
 ASSERT checklist IS NOT NULL,'joining initializes learner progress';
 ASSERT (SELECT count(*) FROM checklist_items WHERE checklist_id=checklist AND NOT deleted)=5,'exactly five targets initialized';
 PERFORM join_room_v1(room,learner);
 ASSERT (SELECT count(*) FROM checklist_items WHERE checklist_id=checklist AND NOT deleted)=5,'rejoining is idempotent';
 joined:=join_room_v1(room,observer);
 ASSERT joined->>'room_role'='observer','second learner becomes observer';
 ASSERT NOT EXISTS(SELECT 1 FROM session_checklists WHERE room_id=room AND student_id=observer),'observer has no learner evidence';
 ASSERT (SELECT transfer_learning_enabled=false FROM rooms WHERE id=room),'practice capabilities derive from room type';
 BEGIN
   PERFORM clear_room_chat_history_v1(room,tutor);
   RAISE EXCEPTION 'unsupported clear accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'UNSUPPORTED_PRACTICE_OPERATION' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE rooms SET practice_type='phishing' WHERE id=room;
   RAISE EXCEPTION 'mutable practice type';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'PRACTICE_TYPE_IMMUTABLE' THEN RAISE; END IF;
 END;
 UPDATE rooms SET guard_mode=true WHERE id=room;
 PERFORM join_room_v1(room,learner);
 ASSERT (SELECT guard_mode FROM rooms WHERE id=room),'rejoin preserves Guard';
END;
$test$;
DO $test$
DECLARE
 tutor uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 room uuid:=gen_random_uuid(); phishing uuid:=gen_random_uuid(); parent uuid:=gen_random_uuid();
 proposal uuid:=gen_random_uuid(); second uuid:=gen_random_uuid(); third uuid:=gen_random_uuid();
 result jsonb; duplicate jsonb; baseline_count integer;
BEGIN
 INSERT INTO users(id,display_name,"current_role",status) VALUES
 (tutor,'Approval tutor','tutor','active'),(learner,'Approval learner','student','active'),
 (stranger,'Other tutor','tutor','active');
 INSERT INTO rooms(id,tutor_id,title,practice_type,scenario_config) VALUES
 (room,tutor,'Approval fixture','cyberbullying','{"id":"fixture","source_commit":"fixture-commit","post":{"text":"Fixture post","image":"/images/EWWW_meme.jpg","timestamp":"2026-10-21T00:00:00Z","author":{"id":"fixture-author","name":"Sarah","role":"simulated_user","profile_picture":"/images/profile_1.png"}},"initial_comments":[]}'),
 (phishing,tutor,'Phishing fixture','phishing',NULL);
 UPDATE rooms SET ai_assistant_enabled=true WHERE id=room;
 PERFORM join_room_v1(room,learner);
 INSERT INTO messages(id,room_id,user_id,content,user_role)
 VALUES(parent,room,learner,'I can support Dylan privately.','student');
 SET LOCAL ROLE service_role;
 BEGIN
   PERFORM begin_cyberbullying_suggestion_v1(room,stranger,proposal,NULL,NULL);
   RAISE EXCEPTION 'wrong tutor accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'FORBIDDEN' THEN RAISE; END IF;
 END;
 result:=begin_cyberbullying_suggestion_v1(room,tutor,proposal,NULL,NULL);
 ASSERT result->>'status'='generating','generation begins unpublished';
 ASSERT jsonb_array_length(result->'input_context'->'dialogue')=1,'full saved dialogue';
 ASSERT result->>'parent_message_id'=parent::text,'linked learner comment';
 result:=finish_cyberbullying_suggestion_v1(room,tutor,proposal,
   '{"character":"victim","response":"Thanks for supporting me.","reason":"Respond to support."}',
   '{"model":"controlled-test","prompt_version":"fixture-v1"}');
 ASSERT result->>'status'='ready','valid output ready for review';
 SET LOCAL ROLE anon;
 BEGIN
   PERFORM begin_cyberbullying_suggestion_v1(room,tutor,second,NULL,NULL);
   RAISE EXCEPTION 'public generation storage accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM send_reviewed_tutor_response(room,stranger,parent,'Edited supportive reply',
     false,NULL,'client supplied',false,'client text','modified',1,'[]',proposal,'older_peer');
   RAISE EXCEPTION 'wrong owner approval accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'FORBIDDEN' THEN RAISE; END IF;
 END;
 result:=send_reviewed_tutor_response(room,tutor,parent,'Edited supportive reply',
   true,NULL,'client supplied',false,'client text','modified',1,'[]',proposal,'older_peer');
 ASSERT result->'message'->>'character'='older_peer','reviewed character persisted';
 ASSERT result->'message'->>'persona_name'='Tom','canonical display identity';
 ASSERT result->'message'->>'user_id'=tutor::text,'human reviewer attribution preserved';
 ASSERT result->'feedback'->>'ai_suggestion'='Thanks for supporting me.','original text comes from stored generation';
 ASSERT result->'feedback'->>'raw_character'='victim','original character preserved';
 ASSERT result->'feedback'->>'raw_guard_mode'='false','original Guard from stored context';
 SET LOCAL ROLE authenticated;
 duplicate:=send_reviewed_tutor_response(room,tutor,parent,'Edited supportive reply',
   false,NULL,'unused',false,'unused','modified',1,'[]',proposal,'older_peer');
 ASSERT duplicate->'message'->>'id'=result->'message'->>'id','retry returns same approved message';
 ASSERT (SELECT count(*) FROM messages WHERE room_id=room AND user_role='tutor')=1,'single publication';
 BEGIN
   PERFORM send_reviewed_tutor_response(room,tutor,parent,'Conflicting reply',
     false,NULL,'unused',false,'unused','modified',1,'[]',proposal,'older_peer');
   RAISE EXCEPTION 'conflicting retry accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'PROPOSAL_CONFLICT' THEN RAISE; END IF;
 END;
 RESET ROLE;
 ASSERT (SELECT status FROM private.cyberbullying_suggestions WHERE id=proposal)='approved','terminal review persisted';
 SET LOCAL ROLE service_role;
 PERFORM begin_cyberbullying_suggestion_v1(room,tutor,second,NULL,'educator');
 BEGIN
   PERFORM finish_cyberbullying_suggestion_v1(room,tutor,second,
     '{"character":"bully","response":"Wrong selected character.","reason":"fixture"}',
     '{"model":"controlled-test","prompt_version":"fixture-v1"}');
   RAISE EXCEPTION 'character mismatch accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'AI_OUTPUT_INVALID' THEN RAISE; END IF;
 END;
 PERFORM finish_cyberbullying_suggestion_v1(room,tutor,second,
   '{"character":"educator","response":"We can choose a safe next step.","reason":"fixture"}',
   '{"model":"controlled-test","prompt_version":"fixture-v1"}');
 INSERT INTO messages(room_id,user_id,content,user_role) VALUES(room,learner,'A new comment.','student');
 BEGIN
   PERFORM send_reviewed_tutor_response(room,tutor,parent,'Stale reply',
     false,NULL,'fixture',false,'fixture','accepted',1,'[]',second,'educator');
   RAISE EXCEPTION 'stale approval accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'STALE_PROPOSAL' THEN RAISE; END IF;
 END;
 ASSERT (SELECT count(*) FROM messages WHERE room_id=room AND user_role='tutor')=1,'stale send is atomic';
 PERFORM begin_cyberbullying_suggestion_v1(room,tutor,third,NULL,NULL);
 result:=review_cyberbullying_suggestion_v1(room,tutor,third,true);
 ASSERT result->>'status'='rejected','rejection is durable';
 BEGIN
   PERFORM finish_cyberbullying_suggestion_v1(room,tutor,third,
     '{"character":"victim","response":"Late reply.","reason":"fixture"}',
     '{"model":"controlled-test","prompt_version":"fixture-v1"}');
   RAISE EXCEPTION 'rejected late generation accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'PROPOSAL_CONFLICT' THEN RAISE; END IF;
 END;
 SET LOCAL ROLE anon;
 result:=send_reviewed_tutor_response(phishing,tutor,NULL,'Check the sender first.',
   false,'scaffolding','Support verification.',false,'Check the sender first.','accepted',1,'[]',gen_random_uuid(),NULL);
 ASSERT result->'message'->>'guard_mode'='false','ordinary phishing approval uses boolean Guard';
 ASSERT result->'message'->>'character' IS NULL,'ordinary tutor identity retained';
 RESET ROLE;
END;
$test$;
DO $test$
DECLARE
 tutor uuid:=gen_random_uuid(); learner uuid:=gen_random_uuid(); observer uuid:=gen_random_uuid();
 room uuid:=gen_random_uuid(); checklist uuid; item uuid; comment uuid; payload jsonb; result jsonb;
BEGIN
 INSERT INTO users(id,display_name,"current_role",status) VALUES
 (tutor,'Progress tutor','tutor','active'),(learner,'Progress learner','student','active'),
 (observer,'Progress observer','student','active');
 INSERT INTO rooms(id,tutor_id,title,practice_type,scenario_config)
 VALUES(room,tutor,'Progress fixture','cyberbullying','{"id":"fixture","source_commit":"fixture-commit","post":{"text":"Fixture post","image":"/images/EWWW_meme.jpg","timestamp":"2026-10-21T00:00:00Z","author":{"id":"fixture-author","name":"Sarah","role":"simulated_user","profile_picture":"/images/profile_1.png"}},"initial_comments":[]}');
 PERFORM join_room_v1(room,learner);
 PERFORM join_room_v1(room,observer);
 SELECT id INTO checklist FROM session_checklists WHERE room_id=room AND student_id=learner AND is_active;
 SELECT id INTO item FROM checklist_items WHERE checklist_id=checklist AND target_key='show_empathy_support';
 SET LOCAL ROLE service_role;
 comment:=gen_random_uuid();
 INSERT INTO messages(id,room_id,user_id,content,user_role)
 VALUES(comment,room,learner,'I will check that Dylan is okay.','student');
 payload:=jsonb_build_object('events',jsonb_build_array(jsonb_build_object(
   'item_id',item,'kind','initial_signal','explanation','Controlled evidence event'
 )));
 result:=apply_transfer_message_analysis_v1(room,comment,tutor,gen_random_uuid(),payload);
 ASSERT result->'applied'->0->>'status'='partially_covered','learner evidence updates progress';
 result:=apply_transfer_message_analysis_v1(room,comment,tutor,gen_random_uuid(),payload);
 ASSERT result->>'already_processed'='true','analysis retry is idempotent';
 ASSERT (SELECT count(*) FROM coverage_evidence WHERE item_id=item)=1,'one evidence record per applied event';
 UPDATE rooms SET guard_mode=true WHERE id=room;
 comment:=gen_random_uuid();
 INSERT INTO messages(id,room_id,user_id,content,user_role)
 VALUES(comment,room,learner,'I will message Dylan privately and listen to how he feels.','student');
 payload:=jsonb_build_object('events',jsonb_build_array(jsonb_build_object(
   'item_id',item,'kind','demonstrated_understanding','explanation','Controlled Guard event'
 )));
 result:=apply_transfer_message_analysis_v1(room,comment,tutor,gen_random_uuid(),payload);
 ASSERT result->'applied'->0->>'processing_state'='deferred_guard','Guard defers evidence';
 ASSERT (SELECT status FROM checklist_items WHERE id=item)='partially_covered','Guard retains previous progress';
 UPDATE rooms SET guard_mode=false WHERE id=room;
 ASSERT (SELECT status FROM checklist_items WHERE id=item)='covered','leaving Guard replays evidence';
 ASSERT (SELECT count(*) FROM coverage_evidence WHERE item_id=item)=2,'replay records exactly one new evidence';
 result:=apply_transfer_message_analysis_v1(room,comment,tutor,gen_random_uuid(),payload);
 ASSERT result->>'already_processed'='true','replayed analysis remains idempotent';
 BEGIN
   UPDATE checklist_items SET area_text='Custom target' WHERE id=item;
   RAISE EXCEPTION 'custom target accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'SHARED_TARGETS_REQUIRED' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM initialize_cyberbullying_progress_v1(room,observer);
   RAISE EXCEPTION 'observer progress initialized';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'INVALID_SCOPE' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM prepare_transfer_assessment_context_v1(room,comment,checklist,tutor,gen_random_uuid());
   RAISE EXCEPTION 'unsupported preparation accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'FORBIDDEN' THEN RAISE; END IF;
 END;
 PERFORM record_transfer_provider_attempt_v1(gen_random_uuid(),room,learner,checklist,comment,
   1,'https://controlled.invalid','controlled',600,'fixture-hash','{}','{}','stop','valid',NULL);
 RESET ROLE;
 ASSERT EXISTS(SELECT 1 FROM private.transfer_provider_attempts WHERE room_id=room),'provider audit fixture';
 UPDATE rooms SET guard_mode=true WHERE id=room;
 SET LOCAL ROLE anon;
 DELETE FROM rooms WHERE id=room;
 RESET ROLE;
 ASSERT NOT EXISTS(SELECT 1 FROM private.transfer_provider_attempts WHERE room_id=room),'room deletion cleans analysis audit';
 ASSERT NOT EXISTS(SELECT 1 FROM messages WHERE room_id=room),'room deletion cleans dialogue';
 ASSERT NOT EXISTS(SELECT 1 FROM session_checklists WHERE room_id=room),'room deletion cleans targets';
END;
$test$;
ROLLBACK;

BEGIN;
DO $$
DECLARE denied boolean;
BEGIN
 UPDATE private.practice_write_gate SET closed=true WHERE singleton;
 SET LOCAL ROLE anon;
 BEGIN
   UPDATE public.rooms SET title=title WHERE false;
   RAISE EXCEPTION 'Expected maintenance gate';
 EXCEPTION WHEN SQLSTATE '55000' THEN
   IF SQLERRM NOT LIKE 'PRACTICE_MAINTENANCE:%' THEN RAISE; END IF;
 END;
 RESET ROLE;
 UPDATE private.practice_write_gate SET closed=false WHERE singleton;
 PERFORM set_config('request.headers','{}',true);
 SET LOCAL ROLE authenticated;
 BEGIN
   UPDATE public.rooms SET title=title WHERE false;
   RAISE EXCEPTION 'Expected stale client gate';
 EXCEPTION WHEN SQLSTATE '55000' THEN
   IF SQLERRM NOT LIKE 'CLIENT_RELOAD_REQUIRED:%' THEN RAISE; END IF;
 END;
 RESET ROLE;
 PERFORM set_config('request.headers','{"x-practice-contract":"cyberbullying-v1"}',true);
 SET LOCAL ROLE anon;
 UPDATE public.rooms SET title=title WHERE false;
 RESET ROLE;
 SET LOCAL ROLE service_role;
 UPDATE public.messages SET content=content WHERE false;
 RESET ROLE;
END;
$$;
ROLLBACK;
