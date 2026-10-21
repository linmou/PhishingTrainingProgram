-- #!/usr/bin/env psql
-- Purpose: replace persisted Cyberbullying proposals with the ordinary browser-draft review boundary.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM private.practice_write_gate WHERE singleton AND closed) THEN
   RAISE EXCEPTION 'Close the practice write gate before migrating';
 END IF;
END $$;
-- Drain old writes before switching the contract. The gate stays closed until Edge/client verification.
LOCK TABLE public.rooms,public.messages,public.ai_suggestion_feedback,private.cyberbullying_suggestions IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE browser_draft_preservation ON COMMIT DROP AS
 SELECT 'messages' object,count(*) rows,md5(coalesce(string_agg(md5(to_jsonb(m)::text),'' ORDER BY id),'')) hash FROM public.messages m
 UNION ALL
 SELECT 'feedback',count(*),md5(coalesce(string_agg(md5(to_jsonb(f)::text),'' ORDER BY id),'')) FROM public.ai_suggestion_feedback f;

CREATE FUNCTION private.assert_practice_contract() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=private,pg_catalog AS $$
DECLARE gate private.practice_write_gate%ROWTYPE; headers jsonb;
BEGIN
 SELECT * INTO gate FROM private.practice_write_gate WHERE singleton;
 IF gate.closed THEN RAISE EXCEPTION 'PRACTICE_MAINTENANCE: Practice is updating. Please try again shortly.' USING ERRCODE='55000'; END IF;
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 IF headers->>'x-practice-contract' IS DISTINCT FROM gate.required_contract THEN
   RAISE EXCEPTION 'CLIENT_RELOAD_REQUIRED: Reload this page before continuing.' USING ERRCODE='55000';
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.assert_practice_contract() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.get_cyberbullying_context_v1(p_room_id uuid,p_actor_id uuid,p_parent_message_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE r rooms%ROWTYPE; parent_id uuid; dialogue jsonb;
BEGIN
 PERFORM private.assert_practice_contract();
 SELECT * INTO r FROM rooms WHERE id=p_room_id AND tutor_id=p_actor_id AND is_active;
 IF NOT FOUND OR r.practice_type<>'cyberbullying' OR NOT EXISTS(
   SELECT FROM users WHERE id=p_actor_id AND "current_role"='tutor' AND status='active'
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT r.ai_assistant_enabled THEN RAISE EXCEPTION 'AI_DISABLED'; END IF;
 SELECT m.id INTO parent_id FROM messages m JOIN sessions s
 ON s.room_id=m.room_id AND s.student_id=m.user_id AND s.status='active'
 JOIN users u ON u.id=m.user_id AND u."current_role"='student' AND u.status='active'
 WHERE m.room_id=p_room_id AND m.user_role='student' AND (p_parent_message_id IS NULL OR m.id=p_parent_message_id)
 ORDER BY m.created_at DESC,m.id DESC LIMIT 1;
 IF parent_id IS NULL THEN RAISE EXCEPTION 'LEARNER_MESSAGE_REQUIRED'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',m.id,'user_id',m.user_id,'user_role',m.user_role,'display_name',u.display_name,
   'content',m.content,'created_at',m.created_at,'character',m.character,
   'persona_id',m.persona_id,'persona_name',m.persona_name,'guard_mode',m.guard_mode
 ) ORDER BY m.created_at,m.id),'[]'::jsonb) INTO dialogue
 FROM messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=p_room_id;
 RETURN jsonb_build_object('practice_type',r.practice_type,'scenario',r.scenario_config,
   'dialogue',dialogue,'guard_mode',r.guard_mode,'parent_message_id',parent_id);
END $$;
REVOKE ALL ON FUNCTION public.get_cyberbullying_context_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_cyberbullying_context_v1(uuid,uuid,uuid) TO service_role;

-- Shared table insertion remains the ordinary review path, with Cyberbullying metadata validated here.
CREATE FUNCTION private.validate_character_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE r rooms%ROWTYPE; m messages%ROWTYPE;
BEGIN
 SELECT * INTO r FROM rooms WHERE id=NEW.room_id;
 IF r.practice_type IS DISTINCT FROM 'cyberbullying' THEN
   IF NEW.raw_character IS NOT NULL OR NEW.final_character IS NOT NULL THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
   RETURN NEW;
 END IF;
 IF NOT r.is_active OR NEW.tutor_id IS DISTINCT FROM r.tutor_id OR NOT EXISTS(
   SELECT FROM users WHERE id=NEW.tutor_id AND "current_role"='tutor' AND status='active'
 ) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF NOT EXISTS(SELECT FROM messages parent JOIN sessions s ON s.room_id=parent.room_id AND s.student_id=parent.user_id
   JOIN users u ON u.id=parent.user_id AND u."current_role"='student' AND u.status='active'
   WHERE parent.id=NEW.parent_message_id AND parent.room_id=r.id AND parent.user_role='student' AND s.status='active'
 ) THEN RAISE EXCEPTION 'INVALID_PARENT'; END IF;
 IF NOT EXISTS(SELECT FROM cyberbullying_characters() WHERE character=NEW.raw_character)
   OR NOT EXISTS(SELECT FROM cyberbullying_characters() WHERE character=NEW.final_character) THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
 IF btrim(coalesce(NEW.ai_suggestion,''))='' OR NEW.raw_guard_mode IS NULL OR NEW.final_guard_mode IS NULL
   OR btrim(coalesce(NEW.guard_reason,''))='' OR NEW.raw_instruction IS NOT NULL
   OR NEW.suggestion_id IS NOT NULL OR NEW.contract_version IS DISTINCT FROM 'cyberbullying_v1'
   OR (NEW.context_messages IS NOT NULL AND jsonb_typeof(NEW.context_messages)<>'array')
   OR (NEW.generation_provenance IS NOT NULL AND jsonb_typeof(NEW.generation_provenance)<>'object') THEN
   RAISE EXCEPTION 'INVALID_REVIEW';
 END IF;
 NEW.guard_rectified:=NEW.raw_guard_mode IS DISTINCT FROM NEW.final_guard_mode;
 IF NEW.tutor_message_id IS NOT NULL THEN
   SELECT * INTO m FROM messages WHERE id=NEW.tutor_message_id;
   IF NOT FOUND OR m.room_id<>r.id OR m.user_id<>NEW.tutor_id OR m.user_role<>'tutor'
     OR m.parent_message_id IS DISTINCT FROM NEW.parent_message_id
     OR m.content IS DISTINCT FROM NEW.tutor_final_response OR m.character IS DISTINCT FROM NEW.final_character
     OR m.guard_mode IS DISTINCT FROM NEW.final_guard_mode
     OR NEW.tutor_action NOT IN ('accepted','modified') THEN RAISE EXCEPTION 'INVALID_REVIEW'; END IF;
   IF NEW.tutor_action IS DISTINCT FROM (CASE WHEN btrim(NEW.ai_suggestion)=m.content AND NEW.raw_character=NEW.final_character
     THEN 'accepted' ELSE 'modified' END) THEN RAISE EXCEPTION 'INVALID_REVIEW'; END IF;
 ELSIF NEW.tutor_action NOT IN ('rejected','ignored','modified') THEN
   RAISE EXCEPTION 'INVALID_REVIEW';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_character_review() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER validate_character_review BEFORE INSERT ON public.ai_suggestion_feedback
FOR EACH ROW EXECUTE FUNCTION private.validate_character_review();

DROP FUNCTION public.send_reviewed_tutor_response(uuid,uuid,uuid,text,boolean,text,text,boolean,text,text,integer,jsonb,uuid,text);
CREATE FUNCTION public.send_reviewed_tutor_response(
 p_room_id uuid,p_tutor_id uuid,p_parent_message_id uuid,p_content text,
 p_raw_guard_mode boolean,p_raw_instruction text,p_guard_reason text,
 p_final_guard_mode boolean,p_ai_suggestion text,p_tutor_action text,p_response_time_ms integer,
 p_context_messages jsonb,p_raw_character text DEFAULT NULL,p_final_character text DEFAULT NULL,
 p_generation_provenance jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE r rooms%ROWTYPE; m messages%ROWTYPE; f ai_suggestion_feedback%ROWTYPE; persona record; contract text;
BEGIN
 SELECT * INTO r FROM rooms WHERE id=p_room_id AND tutor_id=p_tutor_id AND is_active FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT FROM users WHERE id=p_tutor_id AND "current_role"='tutor' AND status='active') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF btrim(coalesce(p_content,''))='' OR p_final_guard_mode IS NULL OR p_raw_guard_mode IS NULL
   OR p_tutor_action IS NULL OR p_tutor_action NOT IN ('accepted','modified')
   OR btrim(coalesce(p_ai_suggestion,''))='' OR btrim(coalesce(p_guard_reason,''))=''
   OR jsonb_typeof(p_context_messages) IS DISTINCT FROM 'array'
   OR (p_generation_provenance IS NOT NULL AND jsonb_typeof(p_generation_provenance)<>'object') THEN RAISE EXCEPTION 'INVALID_REVIEW'; END IF;
 IF p_parent_message_id IS NOT NULL AND NOT EXISTS(SELECT FROM messages WHERE id=p_parent_message_id AND room_id=p_room_id) THEN RAISE EXCEPTION 'INVALID_PARENT'; END IF;
 SELECT * INTO persona FROM cyberbullying_characters() c WHERE c.character=p_final_character;
 IF r.practice_type='cyberbullying' THEN
   IF persona.character IS NULL OR NOT EXISTS(SELECT FROM cyberbullying_characters() WHERE character=p_raw_character) THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
   IF p_raw_instruction IS NOT NULL THEN RAISE EXCEPTION 'INVALID_REVIEW'; END IF;
   contract:='cyberbullying_v1';
 ELSE
   IF p_raw_character IS NOT NULL OR p_final_character IS NOT NULL THEN RAISE EXCEPTION 'INVALID_CHARACTER'; END IF;
   IF (NOT p_raw_guard_mode AND p_raw_instruction IS NULL) OR (p_raw_instruction IS NOT NULL AND p_raw_instruction NOT IN (
     'protective_instruction','correction','scaffolding','explanation','consolidation','guard'
   )) THEN RAISE EXCEPTION 'INVALID_REVIEW'; END IF;
   contract:='guard_v1';
 END IF;
 INSERT INTO messages(room_id,user_id,content,user_role,response_mode,parent_message_id,guard_mode,
   character,persona_id,persona_name,persona_avatar,ai_model_used)
 VALUES(p_room_id,p_tutor_id,btrim(p_content),'tutor',(CASE WHEN p_final_guard_mode THEN 'guard' ELSE 'tutoring' END)::tutor_turn_mode,
   p_parent_message_id,p_final_guard_mode,p_final_character,
   CASE WHEN r.practice_type='cyberbullying' THEN persona.persona_id ELSE NULL END,
   CASE WHEN r.practice_type='cyberbullying' THEN persona.persona_name ELSE NULL END,
   CASE WHEN r.practice_type='cyberbullying' THEN persona.persona_avatar ELSE NULL END,
   CASE WHEN r.practice_type='cyberbullying' THEN p_generation_provenance->>'model' ELSE NULL END) RETURNING * INTO m;
 INSERT INTO ai_suggestion_feedback(room_id,tutor_id,parent_message_id,ai_suggestion,tutor_action,tutor_final_response,
   tutor_message_id,response_time_ms,context_messages,raw_guard_mode,raw_instruction,guard_reason,final_guard_mode,
   guard_rectified,contract_version,final_instruction,raw_character,final_character,generation_provenance)
 VALUES(p_room_id,p_tutor_id,p_parent_message_id,p_ai_suggestion,p_tutor_action,btrim(p_content),m.id,p_response_time_ms,
   p_context_messages,p_raw_guard_mode,p_raw_instruction,p_guard_reason,p_final_guard_mode,
   p_raw_guard_mode IS DISTINCT FROM p_final_guard_mode,contract,p_raw_instruction,p_raw_character,p_final_character,p_generation_provenance) RETURNING * INTO f;
 UPDATE rooms SET guard_mode=p_final_guard_mode,guard_mode_changed_at=now(),guard_mode_change_source='reviewed_response'
 WHERE id=p_room_id RETURNING * INTO r;
 RETURN jsonb_build_object('message',to_jsonb(m),'room',to_jsonb(r),'feedback',to_jsonb(f));
END $$;
REVOKE ALL ON FUNCTION public.send_reviewed_tutor_response(uuid,uuid,uuid,text,boolean,text,text,boolean,text,text,integer,jsonb,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_reviewed_tutor_response(uuid,uuid,uuid,text,boolean,text,text,boolean,text,text,integer,jsonb,text,text,jsonb) TO anon,authenticated,service_role;

DROP FUNCTION public.begin_cyberbullying_suggestion_v1(uuid,uuid,uuid,uuid,text);
DROP FUNCTION public.finish_cyberbullying_suggestion_v1(uuid,uuid,uuid,jsonb,jsonb);
DROP FUNCTION public.review_cyberbullying_suggestion_v1(uuid,uuid,uuid,boolean);
-- Unsent drafts expire at cutover as browser drafts do on reload. Historical feedback identifiers remain audit data.
DROP TABLE private.cyberbullying_suggestions;
DROP TRIGGER advance_conversation_revision ON public.rooms;
DROP TRIGGER advance_conversation_revision ON public.messages;
DROP FUNCTION private.advance_conversation_revision();
ALTER TABLE public.rooms DROP COLUMN conversation_revision;
CREATE FUNCTION private.protect_message_room() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.room_id IS DISTINCT FROM OLD.room_id THEN RAISE EXCEPTION 'MESSAGE_ROOM_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.protect_message_room() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_message_room BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION private.protect_message_room();
UPDATE private.practice_write_gate SET required_contract='cyberbullying-v2',changed_at=now() WHERE singleton;
DO $$ BEGIN
 ASSERT (SELECT rows FROM browser_draft_preservation WHERE object='messages')=(SELECT count(*) FROM public.messages);
 ASSERT (SELECT hash FROM browser_draft_preservation WHERE object='messages')=(SELECT md5(coalesce(string_agg(md5(to_jsonb(m)::text),'' ORDER BY id),'')) FROM public.messages m);
 ASSERT (SELECT rows FROM browser_draft_preservation WHERE object='feedback')=(SELECT count(*) FROM public.ai_suggestion_feedback);
 ASSERT (SELECT hash FROM browser_draft_preservation WHERE object='feedback')=(SELECT md5(coalesce(string_agg(md5(to_jsonb(f)::text),'' ORDER BY id),'')) FROM public.ai_suggestion_feedback f);
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
