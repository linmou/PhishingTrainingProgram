-- Add password field to rooms table
ALTER TABLE rooms ADD COLUMN password TEXT;

-- Add index for password field (for faster lookups)
CREATE INDEX idx_rooms_password ON rooms (password);

-- Update RLS policies to handle password-protected rooms
-- Note: Password checking will be handled in the application layer for security