-- Intent: test the five_learning_targets migration on a disposable native PostgreSQL
-- fixture: Red/Green, existing content/settings, missing teaching rows, idempotence,
-- duplicate and malformed-prompt rejection, rollback and unrelated rows.
-- Run only in a NEW EMPTY LOCAL database. This fixture is not a hosted-schema baseline.
\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE public.room_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  template_name text NOT NULL,
  template_description text,
  title_template text NOT NULL,
  description_template text,
  image_url text,
  pre_populated_dialogue jsonb,
  ai_config_template jsonb,
  op_config_template jsonb,
  password_config jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.room_templates (
  tutor_id, template_name, title_template, description_template,
  pre_populated_dialogue, op_config_template, password_config, ai_config_template
)
SELECT '00000000-0000-0000-0000-000000000000', name, 'Preserved title',
  'Preserved post', '[{"message":"Preserved dialogue"}]',
  '{"custom_op_name":"Preserved author"}', '{"enabled":true}',
  CASE WHEN name IN ('Location Sharing Safety', 'Movie Meetup Social Engineering',
    'Phone Number Phishing Training') THEN NULL ELSE jsonb_build_object(
      'model_name', 'preserved-model', 'enabled', false,
      'temperature', 0.17, 'max_tokens', 123, 'extra_setting', 'preserved',
      'scenario', 'old-scenario',
      'prompt_config', jsonb_build_object('role', jsonb_build_object('role','high'),
        'interaction_mode', CASE WHEN name = 'Demo: Multi-agent Response Room'
          THEN 'multi_agent' ELSE 'single_agent' END,
        'detection_areas', jsonb_build_array('old recognition'),
        'verification_steps', jsonb_build_array('old action')),
      'system_prompt', 'PRESERVED POLICY' || E'\n\n## Detection Areas to Focus On:\n\n'
        || '- old recognition' || E'\n\n## Verification Steps to Teach:\n\n- old action\n\n'
        || CASE WHEN name LIKE 'Demo: Phase 0%' THEN
          'Remember: Your goal is preserved. HISTORICAL EXAMPLES'
        ELSE '## Default Safe Actions: PRESERVED SAFE ACTIONS' END
    ) END
FROM (VALUES ('Nintendo Switch Deal Scam'),
  ('Demo: Click Impulse (Correct Safe Action)'),
  ('Demo: Phase 0 — Lock Icon Myth'),
  ('Demo: Multi-agent Response Room'),
  ('Location Sharing Safety'), ('Movie Meetup Social Engineering'),
  ('Phone Number Phishing Training')) AS names(name);

INSERT INTO public.room_templates (tutor_id, template_name, title_template)
VALUES ('11111111-1111-1111-1111-111111111111', 'Nintendo Switch Deal Scam', 'Custom owner'),
  ('00000000-0000-0000-0000-000000000000', 'Unrelated global', 'Unrelated');

CREATE TEMP TABLE before_templates AS SELECT * FROM public.room_templates;

SAVEPOINT expected_red;
\set ON_ERROR_STOP off
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.room_templates WHERE template_name = 'Nintendo Switch Deal Scam'
      AND tutor_id = '00000000-0000-0000-0000-000000000000'
      AND jsonb_array_length(ai_config_template->'prompt_config'->'detection_areas')
        + jsonb_array_length(ai_config_template->'prompt_config'->'verification_steps') <> 5
  ) THEN
    RAISE EXCEPTION 'EXPECTED RED: legacy template does not have five targets';
  END IF;
END $$;
\set red_state :SQLSTATE
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT expected_red;
SELECT :'red_state' = 'P0001' AS red_failed_as_expected \gset
\if :red_failed_as_expected
\echo 'PASS expected Red failure'
\else
\quit 1
\endif

\ir ../archived_migrations/20261015000000_five_learning_targets.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM public.room_templates) <> 11 THEN
    RAISE EXCEPTION 'Missing teaching rows were not inserted exactly once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.room_templates
    WHERE tutor_id = '00000000-0000-0000-0000-000000000000'
      AND template_name <> 'Unrelated global'
      AND (jsonb_array_length(ai_config_template->'prompt_config'->'detection_areas') IS DISTINCT FROM 5
        OR ai_config_template->'prompt_config'->'verification_steps' IS DISTINCT FROM '[]'::jsonb)
  ) THEN RAISE EXCEPTION 'Supported template does not have five targets'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_templates t JOIN before_templates b USING(id)
    WHERE (to_jsonb(t) - ARRAY['ai_config_template','updated_at'])
      IS DISTINCT FROM (to_jsonb(b) - ARRAY['ai_config_template','updated_at'])
  ) THEN RAISE EXCEPTION 'Existing template content was changed'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_templates t JOIN before_templates b USING(id)
    WHERE b.ai_config_template IS NOT NULL AND (
      (t.ai_config_template - ARRAY['prompt_config','system_prompt','scenario'])
        IS DISTINCT FROM
      (b.ai_config_template - ARRAY['prompt_config','system_prompt','scenario'])
      OR ((t.ai_config_template->'prompt_config') - ARRAY['detection_areas','verification_steps'])
        IS DISTINCT FROM
      ((b.ai_config_template->'prompt_config') - ARRAY['detection_areas','verification_steps'])
      OR t.ai_config_template->>'system_prompt' NOT LIKE 'PRESERVED POLICY%'
      OR (t.template_name LIKE 'Demo: Phase 0%'
        AND t.ai_config_template->>'system_prompt' NOT LIKE '%HISTORICAL EXAMPLES')
    )
  ) THEN RAISE EXCEPTION 'Existing model, policy or unrelated configuration changed'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_templates t JOIN before_templates b USING(id)
    WHERE (t.tutor_id <> '00000000-0000-0000-0000-000000000000'
      OR t.template_name = 'Unrelated global') AND to_jsonb(t) IS DISTINCT FROM to_jsonb(b)
  ) THEN RAISE EXCEPTION 'Unrelated row changed'; END IF;
END $$;
\echo 'PASS five-target migration and preservation'

CREATE TEMP TABLE after_templates AS SELECT * FROM public.room_templates;
\ir ../archived_migrations/20261015000000_five_learning_targets.sql
DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM public.room_templates EXCEPT SELECT * FROM after_templates)
    UNION ALL (SELECT * FROM after_templates EXCEPT SELECT * FROM public.room_templates)
  ) THEN RAISE EXCEPTION 'Second application was not idempotent'; END IF;
END $$;
\echo 'PASS idempotence'

SAVEPOINT duplicate_case;
INSERT INTO public.room_templates (tutor_id, template_name, title_template)
VALUES ('00000000-0000-0000-0000-000000000000', 'Nintendo Switch Deal Scam', 'Duplicate');
\set ON_ERROR_STOP off
\ir ../archived_migrations/20261015000000_five_learning_targets.sql
\set duplicate_state :SQLSTATE
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT duplicate_case;
SELECT :'duplicate_state' = 'P0001' AS duplicate_rejected \gset
\if :duplicate_rejected
\echo 'PASS duplicate rejection'
\else
\quit 1
\endif

SAVEPOINT malformed_case;
UPDATE public.room_templates SET ai_config_template = jsonb_set(
  ai_config_template, '{system_prompt}', '"Unrecognized authored prompt"')
WHERE template_name = 'Phone Number Phishing Training';
\set ON_ERROR_STOP off
\ir ../archived_migrations/20261015000000_five_learning_targets.sql
\set malformed_state :SQLSTATE
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT malformed_case;
SELECT :'malformed_state' = 'P0001' AS malformed_rejected \gset
\if :malformed_rejected
\echo 'PASS malformed-prompt rejection'
\else
\quit 1
\endif

SAVEPOINT drift_case;
UPDATE public.room_templates SET ai_config_template = jsonb_set(
  ai_config_template, '{system_prompt}', to_jsonb(replace(
    ai_config_template->>'system_prompt', '## Default Safe Actions:',
    'EXTRA AUTHORED INSTRUCTION' || E'\n\n## Default Safe Actions:')))
WHERE template_name = 'Nintendo Switch Deal Scam'
  AND tutor_id = '00000000-0000-0000-0000-000000000000';
\set ON_ERROR_STOP off
\ir ../archived_migrations/20261015000000_five_learning_targets.sql
\set drift_state :SQLSTATE
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT drift_case;
SELECT :'drift_state' = 'P0001' AS drift_rejected \gset
\if :drift_rejected
\echo 'PASS authored-instruction drift rejection'
\else
\quit 1
\endif

SAVEPOINT null_demo_case;
UPDATE public.room_templates SET ai_config_template = NULL
WHERE template_name = 'Demo: Phase 0 — Lock Icon Myth';
\set ON_ERROR_STOP off
\ir ../archived_migrations/20261015000000_five_learning_targets.sql
\set null_demo_state :SQLSTATE
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT null_demo_case;
SELECT :'null_demo_state' = 'P0001' AS null_demo_rejected \gset
\if :null_demo_rejected
\echo 'PASS null comparison-condition rejection'
\else
\quit 1
\endif

DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM public.room_templates EXCEPT SELECT * FROM after_templates)
    UNION ALL (SELECT * FROM after_templates EXCEPT SELECT * FROM public.room_templates)
  ) THEN RAISE EXCEPTION 'Failure changed previously committed test state'; END IF;
END $$;
\echo 'PASS failure rollback'
ROLLBACK;
