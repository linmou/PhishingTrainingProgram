-- Add dialogue customization support to rooms
-- This allows tutors to pre-populate chat history for training scenarios

-- Add pre_populated_dialogue column to rooms table
ALTER TABLE rooms ADD COLUMN pre_populated_dialogue JSONB DEFAULT NULL;

-- Add comment to explain the structure
COMMENT ON COLUMN rooms.pre_populated_dialogue IS 'Array of message objects with structure: [{user_name: string, message: string, role: "student"|"tutor"|"observer", timestamp?: string}]';

-- Create an index on the jsonb column for better query performance
CREATE INDEX idx_rooms_pre_populated_dialogue ON rooms USING GIN (pre_populated_dialogue);

-- Update the rooms table updated_at trigger to fire on pre_populated_dialogue changes
-- (This is already handled by the existing trigger, but adding for clarity)