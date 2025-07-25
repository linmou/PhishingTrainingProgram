-- Fix AI Assistant RLS Policies to be consistent with simplified auth
-- This migration resolves RLS issues that prevent AI from accessing conversation history and room data

-- Drop all possible policy name variations for ai_assistant_configs
DROP POLICY IF EXISTS "Tutors can manage AI configs for their rooms" ON ai_assistant_configs;
DROP POLICY IF EXISTS "Anyone can view AI configs for active rooms" ON ai_assistant_configs;
DROP POLICY IF EXISTS "Tutors can manage AI configs" ON ai_assistant_configs;
DROP POLICY IF EXISTS "Everyone can view AI configs" ON ai_assistant_configs;

-- Drop all possible policy name variations for ai_conversation_contexts  
DROP POLICY IF EXISTS "Tutors can manage AI contexts for their rooms" ON ai_conversation_contexts;
DROP POLICY IF EXISTS "System can update AI contexts" ON ai_conversation_contexts;
DROP POLICY IF EXISTS "System can manage AI contexts" ON ai_conversation_contexts;
DROP POLICY IF EXISTS "Tutors can manage AI conversation contexts" ON ai_conversation_contexts;

-- Drop all existing policies for ai_suggestion_feedback
DROP POLICY IF EXISTS "Tutors can insert feedback" ON ai_suggestion_feedback;
DROP POLICY IF EXISTS "Room participants can view feedback" ON ai_suggestion_feedback;
DROP POLICY IF EXISTS "Tutors can update their feedback" ON ai_suggestion_feedback;

-- Create consistent simplified policies for AI tables (matching other tables)
-- This allows the AI service to access conversation history and room data

-- AI Assistant Configs - Allow full access for AI operations
CREATE POLICY "Allow AI config operations" ON ai_assistant_configs
    FOR ALL USING (true);

-- AI Conversation Contexts - Allow full access for AI operations  
CREATE POLICY "Allow AI context operations" ON ai_conversation_contexts
    FOR ALL USING (true);

-- Create ai_suggestion_feedback table if it doesn't exist
CREATE TABLE IF NOT EXISTS ai_suggestion_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    tutor_id TEXT NOT NULL,
    parent_message_id TEXT NOT NULL,
    ai_suggestion TEXT NOT NULL,
    tutor_action TEXT NOT NULL CHECK (tutor_action IN ('accepted', 'rejected', 'modified', 'ignored')),
    tutor_final_response TEXT,
    tutor_message_id TEXT,
    response_time_ms INTEGER,
    context_messages TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on ai_suggestion_feedback
ALTER TABLE ai_suggestion_feedback ENABLE ROW LEVEL SECURITY;

-- AI Suggestion Feedback - Allow full access for AI tracking
CREATE POLICY "Allow AI feedback operations" ON ai_suggestion_feedback
    FOR ALL USING (true);

-- Grant necessary permissions to anon role for AI operations
-- This ensures the AI service can read room posts and comments for context

-- Ensure anon can read room posts for AI context (if not already granted)
GRANT SELECT ON rooms TO anon;

-- Ensure anon can read messages for conversation history (if not already granted)  
GRANT SELECT ON messages TO anon;

-- Ensure anon can read/write AI-related tables
GRANT ALL ON ai_assistant_configs TO anon;
GRANT ALL ON ai_conversation_contexts TO anon;
GRANT ALL ON ai_suggestion_feedback TO anon;

-- Grant sequence permissions for auto-generated IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Add helpful comment for future reference
COMMENT ON POLICY "Allow AI config operations" ON ai_assistant_configs IS 
'Simplified policy allowing AI service to manage assistant configurations without auth.uid() dependency';

COMMENT ON POLICY "Allow AI context operations" ON ai_conversation_contexts IS 
'Simplified policy allowing AI service to access conversation history for better contextual responses';

COMMENT ON POLICY "Allow AI feedback operations" ON ai_suggestion_feedback IS 
'Simplified policy allowing AI service to track suggestion feedback and effectiveness';