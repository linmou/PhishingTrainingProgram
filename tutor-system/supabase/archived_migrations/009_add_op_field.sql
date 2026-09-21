-- Add OP (Original Poster) field to rooms table
-- This allows configurable display of who created the room/post

ALTER TABLE rooms 
ADD COLUMN op_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN op_display_name TEXT,
ADD COLUMN op_avatar_url TEXT;

-- Set existing rooms' OP to be the tutor
UPDATE rooms SET 
    op_id = tutor_id,
    op_display_name = (SELECT display_name FROM users WHERE id = tutor_id),
    op_avatar_url = (SELECT avatar_url FROM users WHERE id = tutor_id);

-- Add index for better performance
CREATE INDEX idx_rooms_op_id ON rooms(op_id);

-- Update the rooms table trigger to handle OP fields
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
CREATE TRIGGER update_room_op_info_trigger 
    BEFORE INSERT OR UPDATE ON rooms
    FOR EACH ROW 
    EXECUTE FUNCTION update_room_op_info();