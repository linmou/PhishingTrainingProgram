-- Ensure message_feedback changes are published to Supabase Realtime so room participants
-- can observe thumb up/down rating changes without refreshing the page.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'message_feedback'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.message_feedback;
    END IF;
END;
$$;
