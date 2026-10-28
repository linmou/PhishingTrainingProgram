-- Responsibility: verify public-feature-flag.sql read access, administrative writes, and typed configuration.
-- Run after applying the queued migration on a disposable database; all test changes roll back.
BEGIN;

SET LOCAL ROLE anon;
DO $$
BEGIN
  IF (SELECT enabled FROM public.feature_flags WHERE name = 'TRANSFER_ASSESSMENT_ENABLED') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Anonymous readers must see initial configuration';
  END IF;
  BEGIN
    UPDATE public.feature_flags SET enabled = false;
    RAISE EXCEPTION 'Anonymous update unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.feature_flags VALUES ('TRANSFER_ASSESSMENT_ENABLED', false);
    RAISE EXCEPTION 'Anonymous insert unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.feature_flags;
    RAISE EXCEPTION 'Anonymous delete unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    TRUNCATE public.feature_flags;
    RAISE EXCEPTION 'Anonymous truncate unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT enabled FROM public.feature_flags WHERE name = 'TRANSFER_ASSESSMENT_ENABLED') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Authenticated readers must see configuration';
  END IF;
  BEGIN
    UPDATE public.feature_flags SET enabled = false;
    RAISE EXCEPTION 'Authenticated update unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.feature_flags;
    RAISE EXCEPTION 'Authenticated delete unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.feature_flags VALUES ('TRANSFER_ASSESSMENT_ENABLED', false);
    RAISE EXCEPTION 'Authenticated insert unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    TRUNCATE public.feature_flags;
    RAISE EXCEPTION 'Authenticated truncate unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SET LOCAL ROLE service_role;
UPDATE public.feature_flags SET enabled = false WHERE name = 'TRANSFER_ASSESSMENT_ENABLED';
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF (SELECT enabled FROM public.feature_flags WHERE name = 'TRANSFER_ASSESSMENT_ENABLED') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Administrative disable must be publicly readable';
  END IF;
END $$;

SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    UPDATE public.feature_flags SET enabled = NULL;
    RAISE EXCEPTION 'Null flag unexpectedly allowed';
  EXCEPTION WHEN not_null_violation THEN NULL; END;
  BEGIN
    UPDATE public.feature_flags SET name = 'OAI_API_KEY';
    RAISE EXCEPTION 'Unexpected configuration name allowed';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    DELETE FROM public.feature_flags;
    RAISE EXCEPTION 'Service-role delete unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE public.feature_flags SET enabled = true WHERE name = 'TRANSFER_ASSESSMENT_ENABLED';

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT enabled FROM public.feature_flags WHERE name = 'TRANSFER_ASSESSMENT_ENABLED') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Administrative restore must be publicly readable';
  END IF;
END $$;
ROLLBACK;
