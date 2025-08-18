-- Fix room templates RLS policy to use simplified auth (no auth.uid())
-- This follows the same pattern as other tables in the system

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Tutors can manage their own templates" ON room_templates;

-- Create permissive policy that allows all operations
-- This follows the pattern used in other tables per CLAUDE.md guidance
CREATE POLICY "Allow all operations on room_templates" ON room_templates FOR ALL USING (true);

-- Grant permissions to the authenticated role
GRANT ALL ON room_templates TO authenticated;
GRANT ALL ON room_templates TO anon;