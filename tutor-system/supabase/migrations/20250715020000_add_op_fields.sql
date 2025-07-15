-- Add OP (Original Poster) fields to rooms table
-- This allows configurable display of who created the room/post

-- Add the missing columns
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS op_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS op_display_name TEXT,
ADD COLUMN IF NOT EXISTS op_avatar_url TEXT;

-- Set existing rooms' OP to be the tutor (for backward compatibility)
UPDATE rooms SET 
    op_id = tutor_id,
    op_display_name = (SELECT display_name FROM users WHERE id = tutor_id),
    op_avatar_url = (SELECT avatar_url FROM users WHERE id = tutor_id)
WHERE op_id IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_rooms_op_id ON rooms(op_id);

-- Create or replace the trigger function to handle OP fields
CREATE OR REPLACE FUNCTION update_room_op_info()
RETURNS TRIGGER AS $$
BEGIN
    -- If op_id is set but op_display_name/op_avatar_url are null, populate them
    IF NEW.op_id IS NOT NULL AND (NEW.op_display_name IS NULL OR NEW.op_avatar_url IS NULL) THEN
        SELECT display_name, avatar_url 
        INTO NEW.op_display_name, NEW.op_avatar_url
        FROM users 
        WHERE id = NEW.op_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-populate OP info
DROP TRIGGER IF EXISTS update_room_op_info_trigger ON rooms;
CREATE TRIGGER update_room_op_info_trigger 
    BEFORE INSERT OR UPDATE ON rooms
    FOR EACH ROW 
    EXECUTE FUNCTION update_room_op_info();