-- #!/usr/bin/env psql
-- Covers browser-draft migration: proposal retirement, scoped context, atomic shared reviews, metadata and application-role gates.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  ASSERT to_regclass('private.cyberbullying_suggestions') IS NULL, 'proposal storage must be retired';
  ASSERT to_regprocedure('public.begin_cyberbullying_suggestion_v1(uuid,uuid,uuid,uuid,text)') IS NULL;
  ASSERT to_regprocedure('public.finish_cyberbullying_suggestion_v1(uuid,uuid,uuid,jsonb,jsonb)') IS NULL;
  ASSERT to_regprocedure('public.review_cyberbullying_suggestion_v1(uuid,uuid,uuid,boolean)') IS NULL;
  ASSERT NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='rooms' AND column_name='conversation_revision');
END $$;
UPDATE private.practice_write_gate SET closed=false WHERE singleton;
SET LOCAL request.headers='{"x-practice-contract":"cyberbullying-v2"}';
CREATE TEMP TABLE draft_fixture(tutor uuid,learner uuid,stranger uuid,room uuid,other_room uuid,parent uuid,other_parent uuid);
INSERT INTO draft_fixture SELECT gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid();
GRANT SELECT ON draft_fixture TO anon,authenticated,service_role;
DO $$
DECLARE f draft_fixture%ROWTYPE;
BEGIN
 SELECT * INTO f FROM draft_fixture;
 INSERT INTO users(id,display_name,"current_role",status) VALUES
 (f.tutor,'Draft tutor','tutor','active'),(f.learner,'Draft learner','student','active'),(f.stranger,'Other tutor','tutor','active');
 INSERT INTO rooms(id,tutor_id,title,practice_type,scenario_config,ai_assistant_enabled) VALUES
 (f.room,f.tutor,'Draft fixture','cyberbullying','{"id":"fixture","source_commit":"fixture","post":{"text":"Post","image":"/images/EWWW_meme.jpg","timestamp":"2026-10-21T00:00:00Z","author":{"id":"author","name":"Sarah","role":"simulated_user","profile_picture":"/images/profile_1.png"}},"initial_comments":[]}',true),
 (f.other_room,f.tutor,'Phishing fixture','phishing',NULL,true);
 PERFORM join_room_v1(f.room,f.learner);
 INSERT INTO messages(id,room_id,user_id,content,user_role) VALUES(f.parent,f.room,f.learner,'Saved learner comment','student'),(f.other_parent,f.other_room,f.learner,'Other room comment','student');
END $$;
SET LOCAL ROLE service_role;
DO $$
DECLARE f draft_fixture%ROWTYPE; c jsonb; before_count bigint;
BEGIN
 SELECT * INTO f FROM draft_fixture;
 SELECT count(*) INTO before_count FROM messages WHERE room_id=f.room;
 c:=get_cyberbullying_context_v1(f.room,f.tutor,f.parent);
 ASSERT c->>'parent_message_id'=f.parent::text;
 ASSERT jsonb_array_length(c->'dialogue')=1;
 ASSERT c->'dialogue'->0->>'user_id'=f.learner::text;
 ASSERT (SELECT count(*) FROM messages WHERE room_id=f.room)=before_count;
 BEGIN PERFORM get_cyberbullying_context_v1(f.room,f.stranger,f.parent); RAISE EXCEPTION 'wrong owner accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'FORBIDDEN' THEN RAISE; END IF; END;
 BEGIN PERFORM get_cyberbullying_context_v1(f.other_room,f.tutor,f.other_parent); RAISE EXCEPTION 'wrong subject accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'FORBIDDEN' THEN RAISE; END IF; END;
 BEGIN PERFORM get_cyberbullying_context_v1(f.room,f.tutor,f.other_parent); RAISE EXCEPTION 'wrong parent accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'LEARNER_MESSAGE_REQUIRED' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE f draft_fixture%ROWTYPE; r jsonb; message_id uuid; action text; before_count bigint;
BEGIN
 SELECT * INTO f FROM draft_fixture;
 ASSERT NOT has_function_privilege('anon','public.get_cyberbullying_context_v1(uuid,uuid,uuid)','EXECUTE');
 r:=send_reviewed_tutor_response(f.room,f.tutor,f.parent,'Edited text',false,NULL,'Support',true,'Original text','modified',100,'["saved context"]','victim','older_peer','{"model":"fixture-model"}');
 message_id:=(r->'message'->>'id')::uuid;
 ASSERT r->'message'->>'character'='older_peer';
 ASSERT r->'message'->>'persona_id'='copilot:tom';
 ASSERT r->'message'->>'user_id'=f.tutor::text;
 ASSERT r->'feedback'->>'ai_suggestion'='Original text';
 ASSERT r->'feedback'->>'raw_character'='victim';
 ASSERT r->'feedback'->>'final_character'='older_peer';
 ASSERT r->'feedback'->>'tutor_message_id'=message_id::text;
 ASSERT (r->'feedback'->>'guard_rectified')::boolean;
 ASSERT (r->'room'->>'guard_mode')::boolean;
 -- Guard-only changes retain accepted text/character classification.
 r:=send_reviewed_tutor_response(f.room,f.tutor,f.parent,'Same text',true,NULL,'Support',false,'Same text','accepted',100,'[]','victim','victim',NULL);
 ASSERT r->'feedback'->>'tutor_action'='accepted';
 ASSERT (r->'feedback'->>'guard_rectified')::boolean;
 ASSERT NOT (r->'room'->>'guard_mode')::boolean;
 SELECT count(*) INTO before_count FROM messages WHERE room_id=f.room;
 FOREACH action IN ARRAY ARRAY['rejected','ignored','modified'] LOOP
   INSERT INTO ai_suggestion_feedback(room_id,tutor_id,parent_message_id,ai_suggestion,tutor_action,raw_guard_mode,final_guard_mode,guard_reason,raw_character,final_character,contract_version)
   VALUES(f.room,f.tutor,f.parent,'Original draft',action,false,true,'Support','victim','educator','cyberbullying_v1');
 END LOOP;
 ASSERT (SELECT count(*) FROM messages WHERE room_id=f.room)=before_count, 'unsent reviews cannot publish';
 ASSERT NOT (SELECT guard_mode FROM rooms WHERE id=f.room), 'unsent Guard override cannot affect room';
 BEGIN PERFORM send_reviewed_tutor_response(f.room,f.stranger,f.parent,'Text',false,NULL,'Support',false,'Original','modified',0,'[]','victim','victim',NULL); RAISE EXCEPTION 'wrong owner accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'FORBIDDEN' THEN RAISE; END IF; END;
 BEGIN PERFORM send_reviewed_tutor_response(f.room,f.tutor,f.other_parent,'Text',false,NULL,'Support',false,'Original','modified',0,'[]','victim','victim',NULL); RAISE EXCEPTION 'wrong parent accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_PARENT' THEN RAISE; END IF; END;
 BEGIN PERFORM send_reviewed_tutor_response(f.room,f.tutor,f.parent,'Text',false,NULL,'Support',false,'Original','modified',0,'[]','invalid','victim',NULL); RAISE EXCEPTION 'bad character accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_CHARACTER' THEN RAISE; END IF; END;
 BEGIN PERFORM send_reviewed_tutor_response(f.room,f.tutor,f.parent,'Text',false,NULL,'Support',false,'Original','accepted',0,'[]','victim','victim',NULL); RAISE EXCEPTION 'misclassified review accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_REVIEW' THEN RAISE; END IF; END;
 BEGIN PERFORM send_reviewed_tutor_response(f.room,f.tutor,f.parent,'Text',false,NULL,'Support',false,'Original','modified',0,'{}','victim','victim',NULL); RAISE EXCEPTION 'invalid context accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_REVIEW' THEN RAISE; END IF; END;
 ASSERT (SELECT count(*) FROM messages WHERE room_id=f.room)=before_count, 'failed reviews roll back publication';
 BEGIN
   INSERT INTO ai_suggestion_feedback(room_id,tutor_id,parent_message_id,ai_suggestion,tutor_action,raw_guard_mode,final_guard_mode,guard_reason,raw_character,final_character,contract_version)
   VALUES(f.room,f.learner,f.parent,'Draft','rejected',false,false,'Support','victim','victim','cyberbullying_v1');
   RAISE EXCEPTION 'student reviewer accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'FORBIDDEN' THEN RAISE; END IF; END;
 -- Ordinary phishing keeps browser-reported review and its existing repeat-send behavior.
 r:=send_reviewed_tutor_response(f.other_room,f.tutor,f.other_parent,'Phishing reply',false,'scaffolding','Help',false,'Phishing reply','accepted',10,'[]');
 ASSERT r->'message'->>'character' IS NULL;
 ASSERT r->'feedback'->>'contract_version'='guard_v1';
END $$;
RESET ROLE;
UPDATE private.practice_write_gate SET closed=true WHERE singleton;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f draft_fixture%ROWTYPE; BEGIN
 SELECT * INTO f FROM draft_fixture;
 BEGIN PERFORM send_reviewed_tutor_response(f.other_room,f.tutor,f.other_parent,'Reply',false,'scaffolding','Help',false,'Reply','accepted',0,'[]'); RAISE EXCEPTION 'closed gate accepted';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN ASSERT SQLERRM LIKE 'PRACTICE_MAINTENANCE%'; END;
END $$;
RESET ROLE;
UPDATE private.practice_write_gate SET closed=false WHERE singleton;
SET LOCAL request.headers='{"x-practice-contract":"cyberbullying-v1"}';
SET LOCAL ROLE service_role;
DO $$ DECLARE f draft_fixture%ROWTYPE; BEGIN
 SELECT * INTO f FROM draft_fixture;
 BEGIN PERFORM get_cyberbullying_context_v1(f.room,f.tutor,f.parent); RAISE EXCEPTION 'stale generation accepted';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN ASSERT SQLERRM LIKE 'CLIENT_RELOAD_REQUIRED%'; END;
 BEGIN INSERT INTO users(display_name,"current_role",status) VALUES('Stale fixture','student','active'); RAISE EXCEPTION 'stale direct write accepted';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN ASSERT SQLERRM LIKE 'CLIENT_RELOAD_REQUIRED%'; END;
END $$;
RESET ROLE;
ROLLBACK;
