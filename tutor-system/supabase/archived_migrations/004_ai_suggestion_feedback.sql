-- Create table to track AI suggestion feedback
CREATE TABLE IF NOT EXISTS ai_suggestion_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) NOT NULL,
    tutor_id UUID REFERENCES users(id) NOT NULL,
    parent_message_id UUID REFERENCES messages(id) NOT NULL,
    ai_suggestion TEXT NOT NULL,
    tutor_action TEXT CHECK (tutor_action IN ('accepted', 'rejected', 'modified', 'ignored')) NOT NULL,
    tutor_final_response TEXT,
    tutor_message_id UUID REFERENCES messages(id),
    response_time_ms INTEGER,
    context_messages JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_feedback_parent_message ON ai_suggestion_feedback(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_tutor_message ON ai_suggestion_feedback(tutor_message_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_room_id ON ai_suggestion_feedback(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_tutor_id ON ai_suggestion_feedback(tutor_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON ai_suggestion_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE ai_suggestion_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for simple auth (no auth.uid())
-- Allow tutors to insert their own feedback
CREATE POLICY "Tutors can insert feedback" ON ai_suggestion_feedback
    FOR INSERT
    WITH CHECK (
        tutor_id IN (
            SELECT id FROM users WHERE current_role = 'tutor'
        )
    );

-- Allow users in the room to view feedback
CREATE POLICY "Room participants can view feedback" ON ai_suggestion_feedback
    FOR SELECT
    USING (
        room_id IN (
            SELECT DISTINCT room_id FROM messages 
            WHERE room_id = ai_suggestion_feedback.room_id
        )
    );

-- Allow tutors to update their own feedback
CREATE POLICY "Tutors can update their feedback" ON ai_suggestion_feedback
    FOR UPDATE
    USING (
        tutor_id IN (
            SELECT id FROM users WHERE current_role = 'tutor'
        )
    );

-- Add comment for documentation
COMMENT ON TABLE ai_suggestion_feedback IS 'Tracks how tutors interact with AI suggestions in the tutoring system';
COMMENT ON COLUMN ai_suggestion_feedback.tutor_action IS 'Action taken by tutor: accepted (used as-is), rejected (explicitly dismissed), modified (changed before sending), ignored (generated new suggestion)';
COMMENT ON COLUMN ai_suggestion_feedback.response_time_ms IS 'Time in milliseconds between showing suggestion and tutor action';
COMMENT ON COLUMN ai_suggestion_feedback.context_messages IS 'Array of message IDs that were used as context for generating the suggestion';