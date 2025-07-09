-- Combined migration script - Initial schema + AI assistant support

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('student', 'tutor', 'observer');

CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TYPE session_status AS ENUM ('active', 'completed', 'cancelled');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    "current_role" user_role,
    status user_status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create rooms table (with AI assistant fields included)
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    tutor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    ai_assistant_enabled BOOLEAN DEFAULT false NOT NULL,
    ai_assistant_model TEXT DEFAULT 'gpt-3.5-turbo',
    ai_assistant_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create messages table (with AI assistant fields included)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    room_id UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_role user_role NOT NULL,
    is_ai_generated BOOLEAN DEFAULT false NOT NULL,
    ai_model_used TEXT,
    ai_response_time_ms INTEGER,
    parent_message_id UUID REFERENCES messages (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    tutor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    student_id UUID REFERENCES users (id) ON DELETE SET NULL,
    room_id UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    status session_status DEFAULT 'active' NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ
);

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

-- Create indexes for better performance
CREATE INDEX idx_users_current_role ON users ("current_role");

CREATE INDEX idx_users_status ON users (status);

CREATE INDEX idx_rooms_tutor_id ON rooms (tutor_id);

CREATE INDEX idx_rooms_is_active ON rooms (is_active);

CREATE INDEX idx_messages_room_id ON messages (room_id);

CREATE INDEX idx_messages_created_at ON messages (created_at);

CREATE INDEX idx_messages_is_ai_generated ON messages (is_ai_generated);

CREATE INDEX idx_messages_parent_message_id ON messages (parent_message_id);

CREATE INDEX idx_sessions_room_id ON sessions (room_id);

CREATE INDEX idx_sessions_status ON sessions (status);

CREATE INDEX idx_ai_assistant_configs_room_id ON ai_assistant_configs (room_id);

CREATE INDEX idx_ai_conversation_contexts_room_id ON ai_conversation_contexts (room_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_assistant_configs_updated_at 
    BEFORE UPDATE ON ai_assistant_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_assistant_configs ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_conversation_contexts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Users policies
CREATE POLICY "Users can view all user profiles" ON users FOR
SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON users FOR
UPDATE USING (auth.uid () = id);

CREATE POLICY "Enable insert for authenticated users only" ON users FOR
INSERT
WITH
    CHECK (auth.uid () = id);

-- Rooms policies
CREATE POLICY "Anyone can view active rooms" ON rooms FOR
SELECT USING (is_active = true);

CREATE POLICY "Tutors can create rooms" ON rooms FOR
INSERT
WITH
    CHECK (
        auth.uid () = tutor_id
        AND EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND "current_role" = 'tutor'
        )
    );

CREATE POLICY "Tutors can update their own rooms" ON rooms FOR
UPDATE USING (auth.uid () = tutor_id);

-- Messages policies
CREATE POLICY "Anyone can view messages in active rooms" ON messages FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM rooms
            WHERE
                id = messages.room_id
                AND is_active = true
        )
    );

CREATE POLICY "Only tutors and students can send messages" ON messages FOR
INSERT
WITH
    CHECK (
        auth.uid () = user_id
        AND EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND "current_role" IN ('tutor', 'student')
        )
    );

-- Sessions policies
CREATE POLICY "Anyone can view sessions" ON sessions FOR
SELECT USING (true);

CREATE POLICY "Tutors can create sessions" ON sessions FOR
INSERT
WITH
    CHECK (
        auth.uid () = tutor_id
        AND EXISTS (
            SELECT 1
            FROM users
            WHERE
                id = auth.uid ()
                AND "current_role" = 'tutor'
        )
    );

CREATE POLICY "Tutors and students can update their sessions" ON sessions FOR
UPDATE USING (
    auth.uid () = tutor_id
    OR auth.uid () = student_id
);

-- AI assistant configs policies
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