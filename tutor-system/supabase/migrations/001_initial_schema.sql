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
    current_role user_role,
    status user_status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    tutor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    room_id UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_role user_role NOT NULL,
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

-- Create indexes for better performance
CREATE INDEX idx_users_current_role ON users (current_role);

CREATE INDEX idx_users_status ON users (status);

CREATE INDEX idx_rooms_tutor_id ON rooms (tutor_id);

CREATE INDEX idx_rooms_is_active ON rooms (is_active);

CREATE INDEX idx_messages_room_id ON messages (room_id);

CREATE INDEX idx_messages_created_at ON messages (created_at);

CREATE INDEX idx_sessions_room_id ON sessions (room_id);

CREATE INDEX idx_sessions_status ON sessions (status);

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

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

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
                AND current_role = 'tutor'
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
                AND current_role IN ('tutor', 'student')
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
                AND current_role = 'tutor'
        )
    );

CREATE POLICY "Tutors and students can update their sessions" ON sessions FOR
UPDATE USING (
    auth.uid () = tutor_id
    OR auth.uid () = student_id
);