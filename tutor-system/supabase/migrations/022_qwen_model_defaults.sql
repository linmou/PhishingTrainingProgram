-- Purpose: migrate stored AI configurations and database defaults to Qwen3.5 Flash.

UPDATE rooms
SET ai_assistant_model = 'qwen3.5-flash'
WHERE ai_assistant_model IS NOT NULL
  AND ai_assistant_model <> 'qwen3.5-flash';

ALTER TABLE rooms
  ALTER COLUMN ai_assistant_model SET DEFAULT 'qwen3.5-flash';

UPDATE ai_assistant_configs
SET model_name = 'qwen3.5-flash'
WHERE model_name IS NOT NULL
  AND model_name <> 'qwen3.5-flash';

ALTER TABLE ai_assistant_configs
  ALTER COLUMN model_name SET DEFAULT 'qwen3.5-flash';

DROP FUNCTION IF EXISTS initialize_ai_assistant(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION initialize_ai_assistant(
    p_room_id UUID,
    p_model_name TEXT DEFAULT 'qwen3.5-flash',
    p_system_prompt TEXT DEFAULT 'You are a helpful AI assistant in an educational tutoring session. Provide clear, educational responses to help students learn.'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM rooms
        WHERE id = p_room_id
        AND tutor_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only room tutors can initialize AI assistant';
    END IF;

    INSERT INTO ai_assistant_configs (room_id, model_name, system_prompt)
    VALUES (p_room_id, 'qwen3.5-flash', p_system_prompt)
    ON CONFLICT (room_id) DO UPDATE SET
        model_name = 'qwen3.5-flash',
        system_prompt = EXCLUDED.system_prompt,
        is_active = true,
        updated_at = TIMEZONE('utc', NOW())
    RETURNING id INTO config_id;

    UPDATE rooms
    SET ai_assistant_enabled = true,
        ai_assistant_model = 'qwen3.5-flash'
    WHERE id = p_room_id;

    RETURN config_id;
END;
$$;
