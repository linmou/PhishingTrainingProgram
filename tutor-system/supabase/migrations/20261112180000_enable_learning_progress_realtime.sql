-- Issue #75. Candidate only: inspect both live projects and validate restored
-- baseline/roles/publication before applying. Execute as one transaction.
-- Preserve existing table policies/grants and publish invalidation separately
-- from evidence content, which remains scoped through the trusted API.
DO $migration$
DECLARE
  target_table text;
  published_columns name[];
  publication_filter text;
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_publication
    WHERE pubname = 'supabase_realtime' AND pubinsert AND pubupdate
  ) THEN
    RAISE EXCEPTION 'LEARNING_REALTIME_PUBLICATION_PRECONDITION: insert/update publication required';
  END IF;

  FOREACH target_table IN ARRAY ARRAY['sessions', 'session_checklists', 'checklist_items', 'coverage_evidence'] LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      RAISE EXCEPTION 'LEARNING_REALTIME_TABLE_REQUIRED: %', target_table;
    END IF;
    IF NOT EXISTS (
      SELECT FROM pg_index i JOIN pg_attribute a
        ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = to_regclass(format('public.%I', target_table))
        AND i.indisprimary AND a.attname = 'id'
    ) THEN
      RAISE EXCEPTION 'LEARNING_REALTIME_PRIMARY_KEY_REQUIRED: %', target_table;
    END IF;

    SELECT attnames, rowfilter INTO published_columns, publication_filter
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = target_table;
    IF NOT FOUND THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
    ELSIF publication_filter IS NOT NULL OR EXISTS (
      SELECT FROM pg_attribute a
      WHERE a.attrelid = to_regclass(format('public.%I', target_table))
        AND a.attnum > 0 AND NOT a.attisdropped
        AND NOT (a.attname = ANY(published_columns))
    ) THEN
      -- Do not silently widen an existing publication's intentional restrictions.
      RAISE EXCEPTION 'LEARNING_REALTIME_RESTRICTED_MEMBERSHIP: %', target_table;
    END IF;
  END LOOP;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.read_learning_evidence_v1(
  p_room_id uuid, p_checklist_id uuid, p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.session_checklists sc
    JOIN public.rooms r ON r.id = sc.room_id
    WHERE sc.id = p_checklist_id AND sc.room_id = p_room_id
      AND sc.is_active AND sc.progress_policy_version = 'transfer_v1'
      AND (sc.student_id = p_actor_id OR r.tutor_id = p_actor_id)
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_actor_id AND u.status = 'active')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'item_id', e.item_id, 'evidence_text', e.evidence_text,
      'analysis', e.analysis, 'confidence_score', e.confidence_score,
      'detection_method', e.detection_method, 'message_id', e.message_id,
      'timestamp', e.timestamp, 'event_id', e.event_id, 'assessment_id', e.assessment_id
    ) ORDER BY e.timestamp, e.id), '[]'::jsonb)
    FROM public.coverage_evidence e
    JOIN public.checklist_items i ON i.id = e.item_id
    WHERE i.checklist_id = p_checklist_id AND NOT i.deleted
  );
END;
$function$;
ALTER FUNCTION public.read_learning_evidence_v1(uuid, uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.read_learning_evidence_v1(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_learning_evidence_v1(uuid, uuid, uuid) TO service_role;

-- An evidence-only write must invalidate the parent's existing subscription.
-- Keep invoker permissions and existing guards; never change progress fields.
CREATE OR REPLACE FUNCTION private.invalidate_learning_evidence_parent()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  UPDATE public.checklist_items SET updated_at = clock_timestamp()
    WHERE id = NEW.item_id;
  IF TG_OP = 'UPDATE' AND OLD.item_id IS DISTINCT FROM NEW.item_id THEN
    UPDATE public.checklist_items SET updated_at = clock_timestamp()
      WHERE id = OLD.item_id;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION private.invalidate_learning_evidence_parent() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.invalidate_learning_evidence_parent() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER invalidate_learning_evidence_parent
AFTER INSERT OR UPDATE ON public.coverage_evidence
FOR EACH ROW EXECUTE FUNCTION private.invalidate_learning_evidence_parent();
