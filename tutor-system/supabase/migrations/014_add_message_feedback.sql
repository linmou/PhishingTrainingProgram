-- Migration to add message feedback system for two-step thumb up/down with 1-5 rating
-- Compatible with simplified authentication (no auth.uid() dependency)

-- Create message_feedback table
CREATE TABLE message_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add unique constraint to prevent duplicate feedback from same user on same message
ALTER TABLE message_feedback ADD CONSTRAINT unique_user_message_feedback 
    UNIQUE (message_id, user_id);

-- Create indexes for performance
CREATE INDEX idx_message_feedback_message_id ON message_feedback (message_id);
CREATE INDEX idx_message_feedback_room_id ON message_feedback (room_id);
CREATE INDEX idx_message_feedback_user_id ON message_feedback (user_id);
CREATE INDEX idx_message_feedback_type_rating ON message_feedback (feedback_type, rating);

-- Enable Row Level Security with simplified auth approach
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policy compatible with simplified authentication
-- In production, you might want more sophisticated access control
CREATE POLICY "Allow feedback operations" ON message_feedback FOR ALL USING (true);

-- Add updated_at trigger for message_feedback table
CREATE TRIGGER update_message_feedback_updated_at BEFORE UPDATE ON message_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment explaining the table purpose
COMMENT ON TABLE message_feedback IS 'Stores user feedback for messages including like/dislike preference and 1-5 rating scale';
COMMENT ON COLUMN message_feedback.feedback_type IS 'User preference: like or dislike';
COMMENT ON COLUMN message_feedback.rating IS 'Detailed rating from 1-5 scale after selecting like/dislike';