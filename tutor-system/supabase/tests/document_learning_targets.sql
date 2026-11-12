-- Tests 20261112000000_document_learning_targets.sql: legacy continuity, new catalog initialization, integrity and runtime application.
-- Run only in a disposable database cloned from a pre-migration baseline; this script applies the migration.
\set ON_ERROR_STOP on
-- Local disposable PostgreSQL reads the same checkout; run from repository root.
\set repository_root `rtk proxy pwd`
CREATE TEMP TABLE document_target_sources AS
SELECT pg_read_file(:'repository_root'||'/tutor-system/src/services/generalLearningGoals.json')::jsonb AS catalog,
  replace(replace(pg_read_file(:'repository_root'||'/tutor-system/supabase/migrations/20261112000000_document_learning_targets.sql'),
    E'\nBEGIN;\n',E'\n'),E'\nCOMMIT;\n',E'\n') AS migration_body;
CREATE TEMP TABLE document_template_names(name text,scenario text);
INSERT INTO document_template_names VALUES
  ('Nintendo Switch Deal Scam','Nintendo Switch Deal ($19.99)'),
  ('iTunes Gift Card Survey Scam','iTunes Gift Card Survey ($500)'),
  ('Account Security Alert Scam','Account Security Alert'),
  ('Movie Meetup Social Engineering','Movie Meetup Social Engineering'),
  ('Location Sharing Safety','Location Sharing Risks'),
  ('Phone Number Phishing Training','Contact Information Exposure');
-- Explicit synthetic legacy configs exercise replacement independently of baseline prompt age.
UPDATE room_templates r SET ai_config_template=jsonb_build_object(
  'scenario',n.scenario,'model','fixture-model','policy',jsonb_build_object('keep','unchanged'),
  'prompt_config',jsonb_build_object('detection_areas',jsonb_build_array('Old point'),
    'verification_steps',jsonb_build_array('Old verification'),'safe_actions',jsonb_build_array('Keep safe action'),
    'conversation_policy','Keep conversation policy'),
  'system_prompt',E'KEEP PREFIX\n## Detection Areas to Focus On:\nOld point\n## Default Safe Actions:\nKEEP SUFFIX')
FROM document_template_names n WHERE r.template_name=n.name
  AND r.tutor_id='00000000-0000-0000-0000-000000000000';
CREATE TEMP TABLE document_template_before AS
SELECT r.id,to_jsonb(r) AS row_data FROM room_templates r JOIN document_template_names n ON n.name=r.template_name
WHERE r.tutor_id='00000000-0000-0000-0000-000000000000';
DO $test$
DECLARE migration text; snapshot jsonb;
BEGIN
  ASSERT (SELECT count(*) FROM document_template_before)=6,'six baseline template fixtures required';
  -- The last template fails after earlier updates and function replacements have run.
  UPDATE room_templates SET ai_config_template=jsonb_set(ai_config_template,'{system_prompt}',
    to_jsonb('Missing detection boundary ## Default Safe Actions:'::text))
  WHERE id IN (SELECT id FROM document_template_before WHERE row_data->>'template_name'='Phone Number Phishing Training');
  SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) INTO snapshot FROM room_templates r;
  SELECT migration_body INTO migration FROM document_target_sources;
  BEGIN
    EXECUTE migration;
    RAISE EXCEPTION 'malformed prompt boundary accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'TEMPLATE_KNOWLEDGE_BOUNDARY_MISMATCH: Phone Number Phishing Training' THEN RAISE; END IF;
  END;
  ASSERT (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM room_templates r)=snapshot,
    'failed migration rolls back all earlier template updates';
  ASSERT (SELECT area_text FROM cyberbullying_learning_targets() WHERE target_key='recognize_cyberbullying_impact')=
    'Recognize harmful online behavior and explain its impact on the person targeted.',
    'failed template migration also rolls back catalog replacement';
  UPDATE room_templates r SET ai_config_template=b.row_data->'ai_config_template'
    FROM document_template_before b WHERE r.id=b.id;
END;
$test$;
CREATE TEMP TABLE document_target_fixture(tutor uuid,learner uuid,room uuid,checklist uuid,item uuid,old_text text,old_evidence_count bigint);
DO $test$
DECLARE t uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); c uuid; i uuid; m uuid; result jsonb;
BEGIN
  PERFORM set_config('request.headers','{"x-practice-contract":"cyberbullying-v2"}',true);
  INSERT INTO users(id,display_name,"current_role",status) VALUES
    (t,'Document target tutor','tutor','active'),(l,'Document target legacy learner','student','active');
  INSERT INTO rooms(id,tutor_id,title,practice_type,scenario_config)
  VALUES(r,t,'Document target legacy fixture','cyberbullying','{"id":"fixture","source_commit":"fixture","post":{"text":"Fixture post","image":"/images/EWWW_meme.jpg","timestamp":"2026-11-12T00:00:00Z","author":{"id":"fixture-author","name":"Sarah","role":"simulated_user","profile_picture":"/images/profile_1.png"}},"initial_comments":[]}');
  PERFORM join_room_v1(r,l);
  SELECT id INTO c FROM session_checklists WHERE room_id=r AND student_id=l AND is_active;
  ASSERT (SELECT target_version FROM session_checklists WHERE id=c)='cyberbullying_v1','test requires pre-migration baseline';
  SELECT id INTO i FROM checklist_items WHERE checklist_id=c AND target_key='show_empathy_support';
  SET LOCAL ROLE service_role;
  m:=gen_random_uuid();
  INSERT INTO messages(id,room_id,user_id,content,user_role) VALUES(m,r,l,'I want to help Dylan.','student');
  result:=apply_transfer_message_analysis_v1(r,m,t,gen_random_uuid(),jsonb_build_object('events',
    jsonb_build_array(jsonb_build_object('item_id',i,'kind','initial_signal','explanation','Controlled legacy evidence'))));
  RESET ROLE;
  ASSERT (SELECT status FROM checklist_items WHERE id=i)='partially_covered','legacy fixture has actual progress';
  INSERT INTO document_target_fixture SELECT t,l,r,c,i,area_text,
    (SELECT count(*) FROM coverage_evidence WHERE item_id=i) FROM checklist_items WHERE id=i;
END;
$test$;

\ir ../migrations/20261112000000_document_learning_targets.sql

BEGIN;
DO $test$
DECLARE b record; actual jsonb; expected jsonb; points jsonb; replacement text; snapshot jsonb; migration text;
BEGIN
  FOR b IN SELECT * FROM document_template_before LOOP
    SELECT to_jsonb(r) INTO actual FROM room_templates r WHERE r.id=b.id;
    SELECT catalog->'scenarios'->(b.row_data->'ai_config_template'->>'scenario')->'learning_points'
      INTO points FROM document_target_sources;
    ASSERT points IS NOT NULL,'every fixture has independent document catalog points';
    SELECT string_agg('- '||value,E'\n\n' ORDER BY ordinality) INTO replacement
      FROM jsonb_array_elements_text(points) WITH ORDINALITY;
    expected:=jsonb_set(b.row_data,'{ai_config_template,prompt_config,detection_areas}',points);
    expected:=jsonb_set(expected,'{ai_config_template,prompt_config,verification_steps}','[]'::jsonb);
    expected:=jsonb_set(expected,'{ai_config_template,system_prompt}',
      to_jsonb(E'KEEP PREFIX\n## Detection Areas to Focus On:\n\n'||replacement||E'\n\n## Default Safe Actions:\nKEEP SUFFIX'));
    ASSERT actual-'updated_at'=expected-'updated_at',
      'exact document target update preserves every other template field, content and policy';
  END LOOP;
  SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) INTO snapshot FROM room_templates r;
  SELECT migration_body INTO migration FROM document_target_sources;
  EXECUTE migration;
  ASSERT (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM room_templates r)=snapshot,
    'reapplying migration preserves all template fields including updated_at';
END;
$test$;
DO $test$
DECLARE f document_target_fixture%ROWTYPE; c uuid; t uuid; l uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); i uuid; m uuid; result jsonb; oldkeys text[]; newkeys text[];
BEGIN
  SELECT * INTO f FROM document_target_fixture;
  PERFORM set_config('request.headers','{"x-practice-contract":"cyberbullying-v2"}',true);
  SELECT array_agg(target_key) INTO oldkeys FROM public.cyberbullying_learning_targets('cyberbullying_v1');
  SELECT array_agg(target_key) INTO newkeys FROM public.cyberbullying_learning_targets();
  ASSERT newkeys=ARRAY['recognize_cyberbullying_impact','show_empathy_support','avoid_reinforcing_bullying','stand_up_constructively','choose_safe_next_step'],'document key order';
  ASSERT cardinality(oldkeys)=5,'historical catalog retained';
  ASSERT (SELECT count(*) FROM public.cyberbullying_learning_targets())=5,'new catalog count';
  BEGIN
    PERFORM public.cyberbullying_learning_targets('unknown');
    RAISE EXCEPTION 'unknown version accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'UNKNOWN_TARGET_VERSION' THEN RAISE; END IF;
  END;
  ASSERT (SELECT target_version FROM session_checklists WHERE id=f.checklist)='cyberbullying_v1','migration preserves version';
  ASSERT (SELECT area_text=f.old_text AND status='partially_covered' FROM checklist_items WHERE id=f.item),'migration preserves legacy text and state';
  ASSERT (SELECT count(*) FROM coverage_evidence WHERE item_id=f.item)=f.old_evidence_count,'migration preserves evidence';
  c:=initialize_cyberbullying_progress_v1(f.room,f.learner);
  ASSERT c=f.checklist,'rejoin preserves checklist identity';
  ASSERT (SELECT count(*) FROM checklist_items WHERE checklist_id=c AND NOT deleted)=5,'rejoin does not duplicate or mix catalogs';
  ASSERT NOT EXISTS(SELECT 1 FROM checklist_items x WHERE x.checklist_id=c AND NOT EXISTS(
    SELECT 1 FROM public.cyberbullying_learning_targets('cyberbullying_v1') old WHERE old.target_key=x.target_key AND old.area_text=x.area_text
  )),'legacy checklist retains all historical targets';
  SET LOCAL ROLE service_role;
  m:=gen_random_uuid();
  INSERT INTO messages(id,room_id,user_id,content,user_role)
    VALUES(m,f.room,f.learner,'I will message Dylan privately and offer to find a trusted adult with him.','student');
  result:=apply_transfer_message_analysis_v1(f.room,m,f.tutor,gen_random_uuid(),jsonb_build_object('events',
    jsonb_build_array(jsonb_build_object('item_id',f.item,'kind','demonstrated_understanding','explanation','Controlled continued legacy evidence'))));
  RESET ROLE;
  ASSERT (SELECT status FROM checklist_items WHERE id=f.item)='covered','historical learner can still progress';
  ASSERT (SELECT count(*) FROM coverage_evidence WHERE item_id=f.item)=f.old_evidence_count+1,'historical progress records evidence';
  t:=f.tutor;
  INSERT INTO users(id,display_name,"current_role",status) VALUES(l,'Document target new learner','student','active');
  INSERT INTO rooms(id,tutor_id,title,practice_type,scenario_config)
  VALUES(r,t,'Document target new fixture','cyberbullying','{"id":"fixture","source_commit":"fixture","post":{"text":"Fixture post","image":"/images/EWWW_meme.jpg","timestamp":"2026-11-12T00:00:00Z","author":{"id":"fixture-author","name":"Sarah","role":"simulated_user","profile_picture":"/images/profile_1.png"}},"initial_comments":[]}');
  PERFORM join_room_v1(r,l);
  SELECT id INTO c FROM session_checklists WHERE room_id=r AND student_id=l AND is_active;
  ASSERT (SELECT target_version FROM session_checklists WHERE id=c)='cyberbullying_doc_20261112','new learner gets document version';
  ASSERT (SELECT count(*) FROM checklist_items WHERE checklist_id=c AND NOT deleted)=5,'new learner gets five targets';
  ASSERT NOT EXISTS(SELECT 1 FROM checklist_items x WHERE x.checklist_id=c AND NOT EXISTS(
    SELECT 1 FROM public.cyberbullying_learning_targets() fresh WHERE fresh.target_key=x.target_key
      AND fresh.area_text=x.area_text AND fresh.item_type=x.item_type AND fresh.priority=x.priority
  )),'all initialized target fields match new catalog';
  PERFORM initialize_cyberbullying_progress_v1(r,l);
  ASSERT (SELECT count(*) FROM checklist_items WHERE checklist_id=c AND NOT deleted)=5,'new initialization is idempotent';
  SELECT id INTO i FROM checklist_items WHERE checklist_id=c AND target_key='show_empathy_support';
  SET LOCAL ROLE service_role;
  m:=gen_random_uuid();
  INSERT INTO messages(id,room_id,user_id,content,user_role) VALUES(m,r,l,'I will message Dylan privately and ask if he is okay.','student');
  result:=apply_transfer_message_analysis_v1(r,m,t,gen_random_uuid(),jsonb_build_object('events',
    jsonb_build_array(jsonb_build_object('item_id',i,'kind','demonstrated_understanding','explanation','Controlled new target evidence'))));
  RESET ROLE;
  ASSERT (SELECT status FROM checklist_items WHERE id=i)='covered','new learner can progress through real reducer';
  BEGIN
    UPDATE checklist_items SET area_text=f.old_text WHERE id=i;
    RAISE EXCEPTION 'wrong-version target accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SHARED_TARGETS_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE session_checklists SET target_version='cyberbullying_doc_20261112' WHERE id=f.checklist;
    RAISE EXCEPTION 'legacy version switched';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'LEARNER_SCOPE_IMMUTABLE' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE session_checklists SET target_version=NULL WHERE id=c;
    RAISE EXCEPTION 'null version accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SHARED_TARGETS_REQUIRED' THEN RAISE; END IF;
  END;
  SET LOCAL ROLE anon;
  ASSERT (SELECT count(*) FROM public.cyberbullying_learning_targets())=5,'public catalog read retained';
  RESET ROLE;
END;
$test$;
ROLLBACK;
