-- Fix AI Assistant Support Migration
-- This migration ensures all AI assistant tables and functions exist

-- Create ai_assistant_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS ai_assistant_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE UNIQUE,
    model_name TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
    system_prompt TEXT,
    temperature REAL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
    max_tokens INTEGER DEFAULT 150 CHECK (max_tokens > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create ai_conversation_contexts table if it doesn't exist
CREATE TABLE IF NOT EXISTS ai_conversation_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE UNIQUE,
    conversation_history JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS initialize_ai_assistant(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS add_conversation_context(UUID, TEXT, TEXT);

-- Create or replace the initialize_ai_assistant function
CREATE OR REPLACE FUNCTION initialize_ai_assistant(
    p_room_id UUID,
    p_model_name TEXT DEFAULT 'gpt-3.5-turbo',
    p_system_prompt TEXT DEFAULT 'You are a helpful AI assistant in an educational tutoring session. Provide clear, educational responses to help students learn.'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_id UUID;
BEGIN
    -- Check if user is tutor of the room
    IF NOT EXISTS (
        SELECT 1 FROM rooms 
        WHERE id = p_room_id 
        AND tutor_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only room tutors can initialize AI assistant';
    END IF;
    
    -- Create or update AI assistant config
    INSERT INTO ai_assistant_configs (room_id, model_name, system_prompt)
    VALUES (p_room_id, p_model_name, p_system_prompt)
    ON CONFLICT (room_id) DO UPDATE SET
        model_name = EXCLUDED.model_name,
        system_prompt = EXCLUDED.system_prompt,
        is_active = true,
        updated_at = TIMEZONE('utc', NOW())
    RETURNING id INTO config_id;
    
    -- Initialize conversation context
    INSERT INTO ai_conversation_contexts (room_id, conversation_history)
    VALUES (p_room_id, '[]'::jsonb)
    ON CONFLICT (room_id) DO UPDATE SET
        conversation_history = '[]'::jsonb,
        last_updated = TIMEZONE('utc', NOW());
    
    -- Enable AI assistant for the room
    UPDATE rooms SET ai_assistant_enabled = true WHERE id = p_room_id;
    
    RETURN config_id;
END;
$$;

-- Create or replace the add_conversation_context function
CREATE OR REPLACE FUNCTION add_conversation_context(
    p_room_id UUID,
    p_role TEXT,
    p_content TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_message JSONB;
BEGIN
    new_message := jsonb_build_object(
        'role', p_role,
        'content', p_content,
        'timestamp', extract(epoch from now())
    );
    
    INSERT INTO ai_conversation_contexts (room_id, conversation_history)
    VALUES (p_room_id, jsonb_build_array(new_message))
    ON CONFLICT (room_id) DO UPDATE SET
        conversation_history = ai_conversation_contexts.conversation_history || new_message,
        last_updated = TIMEZONE('utc', NOW());
END;
$$;

-- Ensure RLS policies exist
ALTER TABLE ai_assistant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_contexts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tutors can manage AI configs" ON ai_assistant_configs;
DROP POLICY IF EXISTS "Everyone can view AI configs" ON ai_assistant_configs;
DROP POLICY IF EXISTS "System can manage AI contexts" ON ai_conversation_contexts;

-- Create RLS policies for ai_assistant_configs
CREATE POLICY "Tutors can manage AI configs" ON ai_assistant_configs
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM rooms 
        WHERE rooms.id = ai_assistant_configs.room_id 
        AND rooms.tutor_id = auth.uid()
    )
);

CREATE POLICY "Everyone can view AI configs" ON ai_assistant_configs
FOR SELECT USING (true);

-- Create RLS policies for ai_conversation_contexts
CREATE POLICY "System can manage AI contexts" ON ai_conversation_contexts
FOR ALL USING (true);

-- Grant necessary permissions
GRANT ALL ON ai_assistant_configs TO authenticated;
GRANT ALL ON ai_conversation_contexts TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_ai_assistant TO authenticated;
GRANT EXECUTE ON FUNCTION add_conversation_context TO authenticated;