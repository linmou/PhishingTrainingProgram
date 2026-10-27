-- Intent: move non-sensitive assessment enablement into publicly readable configuration.
-- Apply before deploying the table-backed assessment-api.
BEGIN;

CREATE TABLE public.feature_flags (
  name text PRIMARY KEY CHECK (name = 'TRANSFER_ASSESSMENT_ENABLED'),
  enabled boolean NOT NULL
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feature_flags FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.feature_flags TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.feature_flags TO service_role;

CREATE POLICY feature_flags_public_read ON public.feature_flags
  FOR SELECT TO anon, authenticated USING (true);

-- Both environments' current explicit values must be checked before applying this seed.
INSERT INTO public.feature_flags (name, enabled) VALUES ('TRANSFER_ASSESSMENT_ENABLED', true);

COMMENT ON TABLE public.feature_flags IS
  'Public non-sensitive feature configuration. Only service-role administrators may update values.';

COMMIT;
