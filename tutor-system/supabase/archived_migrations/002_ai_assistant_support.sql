-- Migration to add AI assistant support to the tutor system

-- Add AI assistant configuration to rooms table
ALTER TABLE rooms
ADD COLUMN ai_assistant_enabled BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE rooms
ADD COLUMN ai_assistant_model TEXT DEFAULT 'gpt-3.5-turbo';

ALTER TABLE rooms ADD COLUMN ai_assistant_prompt TEXT;

-- Add AI-related fields to messages table
ALTER TABLE messages
ADD COLUMN is_ai_generated BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE messages ADD COLUMN ai_model_used TEXT;

ALTER TABLE messages ADD COLUMN ai_response_time_ms INTEGER;

ALTER TABLE messages
ADD COLUMN parent_message_id UUID REFERENCES messages (id) ON DELETE SET NULL;

-- Create AI assistant configurations table
CREATE TABLE ai_assistant_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    room_id UUID NOT NULL UNIQUE REFERENCES rooms (id) ON DELETE CASCADE,
    model_name TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
    system_prompt TEXT,
    temperature DECIMAL(3, 2) DEFAULT 0.7 CHECK (
        temperature >= 0
        AND temperature <= 2
    ),
    max_tokens INTEGER DEFAULT 150 CHECK (max_tokens > 0),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create AI conversation context table to maintain chat history for AI
CREATE TABLE ai_conversation_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    room_id UUID NOT NULL UNIQUE REFERENCES rooms (id) ON DELETE CASCADE,
    conversation_history JSONB NOT NULL DEFAULT '[]',
    last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for AI-related queries
CREATE INDEX idx_messages_is_ai_generated ON messages (is_ai_generated);

CREATE INDEX idx_messages_parent_message_id ON messages (parent_message_id);

CREATE INDEX idx_ai_assistant_configs_room_id ON ai_assistant_configs (room_id);

CREATE INDEX idx_ai_conversation_contexts_room_id ON ai_conversation_contexts (room_id);

-- Add updated_at trigger for ai_assistant_configs
CREATE TRIGGER update_ai_assistant_configs_updated_at 
    BEFORE UPDATE ON ai_assistant_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update RLS policies for new tables

-- AI assistant configs policies
ALTER TABLE ai_assistant_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors can manage AI configs for their rooms" ON ai_assistant_configs FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM rooms
        WHERE
            rooms.id = ai_assistant_configs.room_id
            AND rooms.tutor_id = auth.uid ()
    )
);

CREATE POLICY "Anyone can view AI configs for active rooms" ON ai_assistant_configs FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM rooms
            WHERE
                rooms.id = ai_assistant_configs.room_id
                AND rooms.is_active = true
        )
    );

-- AI conversation contexts policies
ALTER TABLE ai_conversation_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors can manage AI contexts for their rooms" ON ai_conversation_contexts FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM rooms
        WHERE
            rooms.id = ai_conversation_contexts.room_id
            AND rooms.tutor_id = auth.uid ()
    )
);

CREATE POLICY "System can update AI contexts" ON ai_conversation_contexts FOR
UPDATE USING (true);

-- Function to initialize AI assistant for a room
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
        updated_at = NOW()
    RETURNING id INTO config_id;
    
    -- Initialize conversation context
    INSERT INTO ai_conversation_contexts (room_id, conversation_history)
    VALUES (p_room_id, '[]'::jsonb)
    ON CONFLICT (room_id) DO UPDATE SET
        conversation_history = '[]'::jsonb,
        last_updated = NOW();
    
    -- Enable AI assistant for the room
    UPDATE rooms SET ai_assistant_enabled = true WHERE id = p_room_id;
    
    RETURN config_id;
END;
$$;

-- Function to add conversation context
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
        last_updated = NOW();
END;
$$;