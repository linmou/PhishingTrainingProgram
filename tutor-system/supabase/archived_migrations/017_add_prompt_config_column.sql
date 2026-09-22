-- Add prompt_config JSONB column to ai_assistant_configs table
-- This stores the structured configuration used to generate system prompts
-- Allows clean separation between prompt text and configuration parameters

ALTER TABLE ai_assistant_configs 
ADD COLUMN prompt_config JSONB;

-- Add comment to explain the column purpose
COMMENT ON COLUMN ai_assistant_configs.prompt_config IS 'JSON configuration used to generate the system prompt, including role, communication_style, cognitive_parameters, emotional_parameters, detection_areas, and verification_steps';

-- Add index for efficient JSON queries (without CONCURRENTLY for migration)
CREATE INDEX idx_ai_assistant_configs_prompt_config_gin 
ON ai_assistant_configs USING GIN (prompt_config);

-- Example of what the prompt_config JSON structure looks like:
/*
{
  "role": {
    "role": "high"
  },
  "communication_style": {
    "teen_slang": "low",
    "conversational_markers": "low", 
    "uncertainty_expression": "low"
  },
  "cognitive_parameters": {
    "concept_density": "high",
    "perspective_taking": "high",
    "personal_examples": "high",
    "consequence_highlighting": "high"
  },
  "emotional_parameters": {
    "enthusiasm_level": "low",
    "validation_frequency": "high",
    "mistake_normalization": "high", 
    "confidence_building": "high"
  },
  "detection_areas": ["Urgent language", "Suspicious links"],
  "verification_steps": ["Check sender", "Verify URL"]
}
*/