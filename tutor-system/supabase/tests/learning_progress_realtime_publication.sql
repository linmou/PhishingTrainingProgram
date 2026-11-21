-- Run on verified baseline clones and both hosted projects after application.
-- Catalog checks supplement, never replace, role/RLS and websocket journeys.
DO $assertions$
DECLARE target_table text;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_publication
    WHERE pubname = 'supabase_realtime' AND pubinsert AND pubupdate) THEN
    RAISE EXCEPTION 'LEARNING_REALTIME_PUBLICATION_PRECONDITION';
  END IF;
  FOREACH target_table IN ARRAY ARRAY['sessions', 'session_checklists', 'checklist_items', 'coverage_evidence'] LOOP
    IF NOT EXISTS (SELECT FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
        AND tablename = target_table AND rowfilter IS NULL) THEN
      RAISE EXCEPTION 'LEARNING_REALTIME_MEMBERSHIP_REQUIRED: %', target_table;
    END IF;
    IF EXISTS (
      SELECT FROM pg_attribute a
      JOIN pg_publication_tables p ON p.pubname = 'supabase_realtime'
        AND p.schemaname = 'public' AND p.tablename = target_table
      WHERE a.attrelid = to_regclass(format('public.%I', target_table))
        AND a.attnum > 0 AND NOT a.attisdropped AND NOT (a.attname = ANY(p.attnames))
    ) THEN
      RAISE EXCEPTION 'LEARNING_REALTIME_COLUMNS_REQUIRED: %', target_table;
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'private') THEN
    RAISE EXCEPTION 'PRIVATE_TABLE_PUBLISHED';
  END IF;
END;
$assertions$;
