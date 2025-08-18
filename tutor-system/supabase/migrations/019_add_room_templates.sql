-- Add room templates functionality
-- This allows tutors to save room configurations as reusable templates

-- Create room_templates table
CREATE TABLE room_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    template_description TEXT,
    
    -- Template configuration (mirrors room structure)
    title_template TEXT NOT NULL,
    description_template TEXT,
    image_url TEXT,
    pre_populated_dialogue JSONB DEFAULT NULL,
    
    -- AI Configuration Template (stored as JSONB)
    ai_config_template JSONB DEFAULT NULL,
    
    -- OP Configuration Template  
    op_config_template JSONB DEFAULT NULL,
    
    -- Password configuration (stored as JSONB)
    password_config JSONB DEFAULT NULL,
    
    -- Metadata
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for better performance
CREATE INDEX idx_room_templates_tutor_id ON room_templates(tutor_id);
CREATE INDEX idx_room_templates_template_name ON room_templates(template_name);
CREATE INDEX idx_room_templates_created_at ON room_templates(created_at);

-- Add updated_at trigger for room_templates
CREATE TRIGGER update_room_templates_updated_at 
    BEFORE UPDATE ON room_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE room_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for room_templates
-- Tutors can only manage their own templates
CREATE POLICY "Tutors can manage their own templates" ON room_templates FOR ALL USING (
    tutor_id = auth.uid() OR tutor_id IS NULL -- Allow for testing with null auth
);

-- Function to create room template from room data
CREATE OR REPLACE FUNCTION create_room_template(
    p_tutor_id UUID,
    p_template_name TEXT,
    p_template_description TEXT DEFAULT NULL,
    p_title_template TEXT DEFAULT NULL,
    p_description_template TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_pre_populated_dialogue JSONB DEFAULT NULL,
    p_ai_config_template JSONB DEFAULT NULL,
    p_op_config_template JSONB DEFAULT NULL,
    p_password_config JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    template_id UUID;
BEGIN
    -- Insert new template
    INSERT INTO room_templates (
        tutor_id,
        template_name,
        template_description,
        title_template,
        description_template,
        image_url,
        pre_populated_dialogue,
        ai_config_template,
        op_config_template,
        password_config
    ) VALUES (
        p_tutor_id,
        p_template_name,
        p_template_description,
        p_title_template,
        p_description_template,
        p_image_url,
        p_pre_populated_dialogue,
        p_ai_config_template,
        p_op_config_template,
        p_password_config
    ) RETURNING id INTO template_id;
    
    RETURN template_id;
END;
$$;

-- Function to get templates by tutor
CREATE OR REPLACE FUNCTION get_room_templates_by_tutor(p_tutor_id UUID)
RETURNS TABLE(
    id UUID,
    template_name TEXT,
    template_description TEXT,
    title_template TEXT,
    description_template TEXT,
    image_url TEXT,
    pre_populated_dialogue JSONB,
    ai_config_template JSONB,
    op_config_template JSONB,
    password_config JSONB,
    usage_count INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.template_name,
        t.template_description,
        t.title_template,
        t.description_template,
        t.image_url,
        t.pre_populated_dialogue,
        t.ai_config_template,
        t.op_config_template,
        t.password_config,
        t.usage_count,
        t.created_at,
        t.updated_at
    FROM room_templates t
    WHERE t.tutor_id = p_tutor_id
    ORDER BY t.created_at DESC;
END;
$$;