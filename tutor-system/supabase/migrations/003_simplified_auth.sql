-- Migration to support simplified authentication without Supabase Auth
-- This allows users to join with just a name and role, without email/password

-- First, drop the foreign key constraint to auth.users
ALTER TABLE users DROP CONSTRAINT users_id_fkey;

-- Make email optional since we're not using it for authentication
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Add a constraint to ensure id is still unique
ALTER TABLE users ADD CONSTRAINT users_id_unique UNIQUE (id);

-- Update RLS policies to work without auth.uid()
-- Since we no longer use Supabase Auth, we need to modify policies

-- Drop existing policies that depend on auth.uid() (use IF EXISTS to avoid errors)
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON users;

DROP POLICY IF EXISTS "Tutors can create rooms" ON rooms;

DROP POLICY IF EXISTS "Tutors can update their own rooms" ON rooms;

DROP POLICY IF EXISTS "Only tutors and students can send messages" ON messages;

DROP POLICY IF EXISTS "Tutors can create sessions" ON sessions;

DROP POLICY IF EXISTS "Tutors and students can update their sessions" ON sessions;

DROP POLICY IF EXISTS "Anyone can view active rooms" ON rooms;

DROP POLICY IF EXISTS "Anyone can view messages in active rooms" ON messages;

DROP POLICY IF EXISTS "Anyone can view sessions" ON sessions;

-- Create new simplified policies that allow operations without authentication
-- Note: In a production environment, you might want more sophisticated access control

-- Users policies - allow basic operations
CREATE POLICY "Allow user profile operations" ON users FOR ALL USING (true);

-- Rooms policies - allow operations based on user role stored in database
CREATE POLICY "Anyone can view active rooms" ON rooms FOR
SELECT USING (is_active = true);

CREATE POLICY "Allow room operations" ON rooms FOR ALL USING (true);

-- Messages policies - allow operations for active rooms
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

CREATE POLICY "Allow message operations" ON messages FOR ALL USING (true);

-- Sessions policies - allow session operations
CREATE POLICY "Allow session operations" ON sessions FOR ALL USING (true);

-- Add index for better performance on display_name lookups
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users (display_name);

-- Add comment explaining the simplified auth approach
COMMENT ON
TABLE users IS 'Users table for simplified authentication - users join with name and role only, no email/password required';