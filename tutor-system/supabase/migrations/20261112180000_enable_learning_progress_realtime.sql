-- Issue #75. Candidate only: inspect both live projects and validate restored
-- baseline/roles/publication before applying. Execute as one transaction.
-- Add membership only; do not change data, policies, grants or replica identity.
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
