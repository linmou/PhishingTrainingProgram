-- Tests archived_migrations/20261014010000_global_room_template_read.sql: shared template reads and preserved RLS write boundaries.
-- Execute as postgres; all fixture changes and role settings roll back.
BEGIN;

DO $test$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run assertions as postgres'; END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE id IN (
    '5eae54df-6cdd-43d0-8cc2-bc9ac6901001', '5eae54df-6cdd-43d0-8cc2-bc9ac6901002'
  )) OR EXISTS (SELECT 1 FROM public.room_templates WHERE id IN (
    '5eae54df-6cdd-43d0-8cc2-bc9ac6902001', '5eae54df-6cdd-43d0-8cc2-bc9ac6902002',
    '5eae54df-6cdd-43d0-8cc2-bc9ac6902003', '5eae54df-6cdd-43d0-8cc2-bc9ac6902004'
  )) THEN RAISE EXCEPTION 'Test fixture IDs already exist'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = '00000000-0000-0000-0000-000000000000')
    THEN RAISE EXCEPTION 'Missing system template owner'; END IF;
END;
$test$;

INSERT INTO public.users (id, display_name, "current_role")
VALUES ('5eae54df-6cdd-43d0-8cc2-bc9ac6901001', 'Template RLS owner fixture', 'tutor'),
       ('5eae54df-6cdd-43d0-8cc2-bc9ac6901002', 'Template RLS unrelated fixture', 'tutor');
INSERT INTO public.room_templates (id, tutor_id, template_name, title_template)
VALUES ('5eae54df-6cdd-43d0-8cc2-bc9ac6902001', '00000000-0000-0000-0000-000000000000', 'Global RLS fixture', 'Global original'),
       ('5eae54df-6cdd-43d0-8cc2-bc9ac6902002', '5eae54df-6cdd-43d0-8cc2-bc9ac6901001', 'Owner RLS fixture', 'Owner original'),
       ('5eae54df-6cdd-43d0-8cc2-bc9ac6902003', '5eae54df-6cdd-43d0-8cc2-bc9ac6901002', 'Unrelated RLS fixture', 'Unrelated original');
SELECT set_config('test.global_count', (SELECT count(*)::text FROM public.room_templates WHERE tutor_id = '00000000-0000-0000-0000-000000000000'), true);
SELECT set_config('test.global_hash', (SELECT md5(string_agg(to_jsonb(t)::text, '' ORDER BY id)) FROM public.room_templates t WHERE tutor_id = '00000000-0000-0000-0000-000000000000'), true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

SET LOCAL ROLE anon;
DO $test$
DECLARE affected integer;
BEGIN
  IF current_user <> 'anon' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Anon role/claims invalid'; END IF;
  IF (SELECT count(*) FROM public.room_templates WHERE tutor_id = '00000000-0000-0000-0000-000000000000') <> current_setting('test.global_count')::integer
    THEN RAISE EXCEPTION 'Anon cannot read all global room templates'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_templates WHERE id IN ('5eae54df-6cdd-43d0-8cc2-bc9ac6902002', '5eae54df-6cdd-43d0-8cc2-bc9ac6902003'))
    THEN RAISE EXCEPTION 'Anon can read private templates'; END IF;
  UPDATE public.room_templates SET title_template = 'Forbidden anon update' WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Anon updated global template'; END IF;
  DELETE FROM public.room_templates WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Anon deleted global template'; END IF;
  BEGIN
    INSERT INTO public.room_templates (id, tutor_id, template_name, title_template)
    VALUES ('5eae54df-6cdd-43d0-8cc2-bc9ac6902004', '00000000-0000-0000-0000-000000000000', 'Forbidden', 'Forbidden');
    RAISE EXCEPTION 'Anon inserted global template';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.room_templates (id, tutor_id, template_name, title_template)
    VALUES ('5eae54df-6cdd-43d0-8cc2-bc9ac6902004', NULL, 'Null owner', 'Null owner');
    RAISE EXCEPTION 'Null owner accepted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
END;
$test$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"5eae54df-6cdd-43d0-8cc2-bc9ac6901001"}', true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE affected integer;
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() <> '5eae54df-6cdd-43d0-8cc2-bc9ac6901001'::uuid THEN RAISE EXCEPTION 'Authenticated role/claims invalid'; END IF;
  IF (SELECT count(*) FROM public.room_templates WHERE tutor_id = '00000000-0000-0000-0000-000000000000') <> current_setting('test.global_count')::integer
    THEN RAISE EXCEPTION 'Authenticated user cannot read all global templates'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_templates WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902002')
    THEN RAISE EXCEPTION 'Owner cannot read own template'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_templates WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902003')
    THEN RAISE EXCEPTION 'Authenticated user can read unrelated private template'; END IF;
  UPDATE public.room_templates SET title_template = 'Forbidden authenticated update' WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Authenticated user updated global template'; END IF;
  DELETE FROM public.room_templates WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Authenticated user deleted global template'; END IF;
  BEGIN
    INSERT INTO public.room_templates (id, tutor_id, template_name, title_template)
    VALUES ('5eae54df-6cdd-43d0-8cc2-bc9ac6902004', '00000000-0000-0000-0000-000000000000', 'Forbidden', 'Forbidden');
    RAISE EXCEPTION 'Authenticated user inserted global template';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.room_templates SET title_template = 'Owner updated' WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner cannot update own template'; END IF;
  BEGIN
    UPDATE public.room_templates SET tutor_id = '00000000-0000-0000-0000-000000000000' WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902002';
    RAISE EXCEPTION 'Owner changed private template into global template';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO public.room_templates (id, tutor_id, template_name, title_template)
  VALUES ('5eae54df-6cdd-43d0-8cc2-bc9ac6902004', '5eae54df-6cdd-43d0-8cc2-bc9ac6901001', 'Owner insert', 'Owner insert');
  DELETE FROM public.room_templates WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Owner cannot delete own template'; END IF;
END;
$test$;
RESET ROLE;

-- Also exercise the individual subject-claim path used by auth.uid().
SELECT set_config('request.jwt.claim.sub', '5eae54df-6cdd-43d0-8cc2-bc9ac6901002', true);
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
  IF auth.uid() <> '5eae54df-6cdd-43d0-8cc2-bc9ac6901002'::uuid THEN RAISE EXCEPTION 'Individual subject claim not honored'; END IF;
  IF EXISTS (SELECT 1 FROM public.room_templates WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902002') THEN RAISE EXCEPTION 'Different owner can see private template'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_templates WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902003') THEN RAISE EXCEPTION 'Different owner cannot see own template'; END IF;
END;
$test$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $test$
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Service role not active'; END IF;
  IF (SELECT count(*) FROM public.room_templates WHERE id IN ('5eae54df-6cdd-43d0-8cc2-bc9ac6902001', '5eae54df-6cdd-43d0-8cc2-bc9ac6902002', '5eae54df-6cdd-43d0-8cc2-bc9ac6902003')) <> 3
    THEN RAISE EXCEPTION 'Service role lost access'; END IF;
END;
$test$;
RESET ROLE;

DO $test$
BEGIN
  IF (SELECT md5(string_agg(to_jsonb(t)::text, '' ORDER BY id)) FROM public.room_templates t WHERE tutor_id = '00000000-0000-0000-0000-000000000000') <> current_setting('test.global_hash')
    THEN RAISE EXCEPTION 'Global templates changed during permission assertions'; END IF;
  IF (SELECT title_template FROM public.room_templates WHERE id = '5eae54df-6cdd-43d0-8cc2-bc9ac6902003') <> 'Unrelated original'
    THEN RAISE EXCEPTION 'Unrelated template changed'; END IF;
END;
$test$;

ROLLBACK;
DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id IN ('5eae54df-6cdd-43d0-8cc2-bc9ac6901001', '5eae54df-6cdd-43d0-8cc2-bc9ac6901002'))
    OR EXISTS (SELECT 1 FROM public.room_templates WHERE id IN ('5eae54df-6cdd-43d0-8cc2-bc9ac6902001', '5eae54df-6cdd-43d0-8cc2-bc9ac6902002', '5eae54df-6cdd-43d0-8cc2-bc9ac6902003', '5eae54df-6cdd-43d0-8cc2-bc9ac6902004'))
    THEN RAISE EXCEPTION 'Test fixtures persisted after rollback'; END IF;
END;
$test$;
SELECT 'PASS: shared-template reads; private visibility; write denials; owner CRUD; service-role access; null-owner rejection; fixture rollback' AS result;

