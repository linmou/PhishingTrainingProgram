-- Simplify AI Architecture: Remove unnecessary tables and use existing data
-- Keep only essential AI configuration, remove redundant context storage

-- Drop unnecessary AI tables since we can use existing rooms + messages data
DROP TABLE IF EXISTS ai_conversation_contexts CASCADE;
DROP TABLE IF EXISTS ai_suggestion_feedback CASCADE;

-- Keep ai_assistant_configs but simplify it
-- This table is needed for tutor's AI parameter settings (model, temperature, system prompt config)

-- Update ai_assistant_configs to have simpler RLS policy
DROP POLICY IF EXISTS "Allow AI config operations" ON ai_assistant_configs;
CREATE POLICY "Simple AI config access" ON ai_assistant_configs FOR ALL USING (true);

-- Add comment explaining the simplified approach
COMMENT ON TABLE ai_assistant_configs IS 
'Stores AI assistant configuration per room. Conversation context is built dynamically from existing rooms and messages tables.';

-- Remove any references to the dropped tables from functions
DROP FUNCTION IF EXISTS add_conversation_context(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS initialize_ai_assistant(UUID, TEXT, TEXT);

-- Grant permissions for simplified approach
GRANT ALL ON ai_assistant_configs TO anon;