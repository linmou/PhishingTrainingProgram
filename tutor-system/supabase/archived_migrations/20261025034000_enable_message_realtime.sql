-- Enable the existing room, message and feedback subscriptions together.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.message_feedback, public.rooms;
