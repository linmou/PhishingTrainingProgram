-- Purpose: drain application writes and hold the coordinated SQL/Edge/client contract cutover.
-- Run as postgres through the target project's MCP before the practice migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS private.practice_write_gate (
 singleton boolean PRIMARY KEY CHECK(singleton),
 closed boolean NOT NULL,
 required_contract text,
 changed_at timestamptz NOT NULL
);
REVOKE ALL ON private.practice_write_gate FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO private.practice_write_gate VALUES(true,true,NULL,now())
ON CONFLICT(singleton) DO UPDATE SET closed=true,changed_at=now();

CREATE OR REPLACE FUNCTION private.check_practice_write_gate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=private,pg_catalog AS $$
DECLARE gate private.practice_write_gate%ROWTYPE; headers jsonb;
BEGIN
 -- SQL management sessions remain available for deployment, repair and fixture cleanup.
 IF session_user IN ('postgres','supabase_admin','local_bootstrap')
    AND coalesce(current_setting('role',true),'none') IN ('none','postgres') THEN
   RETURN NULL;
 END IF;
 SELECT * INTO gate FROM private.practice_write_gate WHERE singleton;
 IF gate.closed THEN RAISE EXCEPTION 'PRACTICE_MAINTENANCE: Practice is updating. Please try again shortly.' USING ERRCODE='55000'; END IF;
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 IF gate.required_contract IS NOT NULL
   AND headers->>'x-practice-contract' IS DISTINCT FROM gate.required_contract THEN
   RAISE EXCEPTION 'CLIENT_RELOAD_REQUIRED: Reload this page before continuing.' USING ERRCODE='55000';
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.check_practice_write_gate() FROM PUBLIC,anon,authenticated,service_role;

-- Trigger DDL acquires locks on the same tables used by active direct writes and RPCs.
-- A timeout rolls back the gate installation; never proceed after a failed installation.
DO $$
DECLARE relation record;
BEGIN
 FOR relation IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','private') AND c.relkind='r' AND c.relname<>'practice_write_gate'
   ORDER BY n.nspname,c.relname
 LOOP
   EXECUTE format('DROP TRIGGER IF EXISTS practice_write_gate ON %I.%I',relation.nspname,relation.relname);
   EXECUTE format('CREATE TRIGGER practice_write_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION private.check_practice_write_gate()',relation.nspname,relation.relname);
 END LOOP;
END;
$$;
COMMIT;
