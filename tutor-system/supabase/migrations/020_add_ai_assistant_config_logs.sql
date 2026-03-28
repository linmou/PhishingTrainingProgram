-- Create AI assistant config change logs so tutor exports can show how settings changed over time.

CREATE TABLE IF NOT EXISTS ai_assistant_config_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    changed_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_reason TEXT NOT NULL DEFAULT 'settings_update',
    changed_fields TEXT[] NOT NULL,
    previous_config JSONB NOT NULL,
    new_config JSONB NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_config_logs_room_id
ON ai_assistant_config_logs(room_id);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_config_logs_changed_at
ON ai_assistant_config_logs(changed_at);

ALTER TABLE ai_assistant_config_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow AI config log operations" ON ai_assistant_config_logs;
CREATE POLICY "Allow AI config log operations" ON ai_assistant_config_logs
FOR ALL USING (true);

GRANT ALL ON ai_assistant_config_logs TO anon;
GRANT ALL ON ai_assistant_config_logs TO authenticated;
