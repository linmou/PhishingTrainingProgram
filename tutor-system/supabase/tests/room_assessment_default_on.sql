-- Tests archived_migrations/20261014020000_room_assessment_default_on.sql: room creation defaults, explicit opt-outs, and unchanged existing data.
-- Execute as postgres; every fixture and role/claim setting is rolled back.
BEGIN;

DO $test$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run assertions as postgres'; END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE id = '63c7b7bd-ef1d-4d7d-a4b1-664b44201001')
    OR EXISTS (SELECT 1 FROM public.rooms WHERE tutor_id = '63c7b7bd-ef1d-4d7d-a4b1-664b44201001')
    THEN RAISE EXCEPTION 'Assessment-default fixture already exists'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_templates WHERE tutor_id = '00000000-0000-0000-0000-000000000000')
    THEN RAISE EXCEPTION 'Shared templates required for creation assertions'; END IF;
END;
$test$;

SELECT set_config('test.room_hash', (SELECT md5(COALESCE(string_agg(to_jsonb(r)::text, '' ORDER BY id), '')) FROM public.rooms r), true);
SELECT set_config('test.template_count', (SELECT count(*)::text FROM public.room_templates WHERE tutor_id = '00000000-0000-0000-0000-000000000000'), true);
INSERT INTO public.users (id, display_name, "current_role")
VALUES ('63c7b7bd-ef1d-4d7d-a4b1-664b44201001', 'Assessment default SQL fixture', 'tutor');

DO $test$
DECLARE
  app_role text;
  template_row record;
  created_room uuid;
  enabled boolean;
  template_count integer;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', CASE WHEN app_role = 'authenticated'
      THEN '{"role":"authenticated","sub":"63c7b7bd-ef1d-4d7d-a4b1-664b44201001"}'
      ELSE jsonb_build_object('role', app_role)::text END, true);
    EXECUTE format('SET LOCAL ROLE %I', app_role);
    IF current_user <> app_role THEN RAISE EXCEPTION 'Application role not active: %', app_role; END IF;

    template_count := 0;
    FOR template_row IN
      SELECT * FROM public.room_templates WHERE tutor_id = '00000000-0000-0000-0000-000000000000'
      ORDER BY id
    LOOP
      INSERT INTO public.rooms (tutor_id, title, description, image_url, pre_populated_dialogue)
      VALUES ('63c7b7bd-ef1d-4d7d-a4b1-664b44201001', template_row.title_template,
        template_row.description_template, template_row.image_url, template_row.pre_populated_dialogue)
      RETURNING id, transfer_learning_enabled INTO created_room, enabled;
      IF enabled IS DISTINCT FROM true
        THEN RAISE EXCEPTION 'Assessment default disabled for role % template %', app_role, template_row.id; END IF;

      -- Template AI initialization updates its own fields after room creation.
      UPDATE public.rooms SET ai_assistant_enabled = true,
        ai_assistant_model = COALESCE(template_row.ai_config_template->>'model_name', 'qwen3.5-flash'),
        ai_assistant_prompt = template_row.ai_config_template->>'system_prompt'
      WHERE id = created_room;
      IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = created_room AND transfer_learning_enabled)
        THEN RAISE EXCEPTION 'AI initialization changed assessment flag for role % template %', app_role, template_row.id; END IF;
      template_count := template_count + 1;
    END LOOP;
    IF template_count <> current_setting('test.template_count')::integer
      THEN RAISE EXCEPTION 'Role % tested only % shared templates', app_role, template_count; END IF;

    INSERT INTO public.rooms (tutor_id, title)
    VALUES ('63c7b7bd-ef1d-4d7d-a4b1-664b44201001', 'Assessment plain-creation fixture')
    RETURNING id, transfer_learning_enabled INTO created_room, enabled;
    IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'Plain creation default disabled for %', app_role; END IF;

    UPDATE public.rooms SET transfer_learning_enabled = false WHERE id = created_room;
    IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = created_room AND transfer_learning_enabled = false)
      THEN RAISE EXCEPTION 'Explicit false update failed for %', app_role; END IF;

    INSERT INTO public.rooms (tutor_id, title, transfer_learning_enabled)
    VALUES ('63c7b7bd-ef1d-4d7d-a4b1-664b44201001', 'Assessment explicit opt-out fixture', false)
    RETURNING id, transfer_learning_enabled INTO created_room, enabled;
    IF enabled IS DISTINCT FROM false THEN RAISE EXCEPTION 'Explicit false insert failed for %', app_role; END IF;

    BEGIN
      INSERT INTO public.rooms (tutor_id, title, transfer_learning_enabled)
      VALUES ('63c7b7bd-ef1d-4d7d-a4b1-664b44201001', 'Assessment null fixture', NULL);
      RAISE EXCEPTION 'Null assessment flag accepted on insert for %', app_role;
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.rooms SET transfer_learning_enabled = NULL WHERE id = created_room;
      RAISE EXCEPTION 'Null assessment flag accepted on update for %', app_role;
    EXCEPTION WHEN not_null_violation THEN NULL;
    END;

    EXECUTE 'RESET ROLE';
    RAISE NOTICE 'PASS role %: % templates, AI initialization, plain default, explicit false insert/update, null insert/update rejection', app_role, template_count;
  END LOOP;
END;
$test$;

DO $test$
BEGIN
  IF (SELECT md5(COALESCE(string_agg(to_jsonb(r)::text, '' ORDER BY id), '')) FROM public.rooms r
      WHERE tutor_id <> '63c7b7bd-ef1d-4d7d-a4b1-664b44201001') IS DISTINCT FROM current_setting('test.room_hash')
    THEN RAISE EXCEPTION 'Existing room data changed'; END IF;
END;
$test$;

ROLLBACK;

DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = '63c7b7bd-ef1d-4d7d-a4b1-664b44201001')
    OR EXISTS (SELECT 1 FROM public.rooms WHERE tutor_id = '63c7b7bd-ef1d-4d7d-a4b1-664b44201001')
    THEN RAISE EXCEPTION 'Assessment-default fixtures persisted after rollback'; END IF;
END;
$test$;
SELECT 'PASS: anon/authenticated/service_role default and template creation, AI initialization, explicit opt-outs, null rejection, existing-room hashes, fixture rollback' AS result,
  (SELECT count(*) FROM public.room_templates WHERE tutor_id = '00000000-0000-0000-0000-000000000000') AS shared_templates_per_role;
