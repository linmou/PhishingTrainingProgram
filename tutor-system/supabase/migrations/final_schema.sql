-- =====================================================
-- FINAL DATABASE SCHEMA - PHISHING TRAINING PROGRAM
-- =====================================================
-- This file represents the complete database schema after all 18 migrations
-- Generated from analysis of migrations 001 through 018

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CUSTOM TYPES
-- =====================================================
CREATE TYPE user_role AS ENUM ('student', 'tutor', 'observer');
CREATE TYPE user_status AS ENUM ('active', 'inactive');
CREATE TYPE session_status AS ENUM ('active', 'completed', 'cancelled');

-- =====================================================
-- TABLES
-- =====================================================

-- Users table (simplified auth - no auth.users dependency)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE,
    display_name TEXT,
    current_role user_role,
    status user_status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE users IS 'Users table for simplified authentication - users join with name and role only, no email/password required';

-- Rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    password TEXT,
    ai_assistant_enabled BOOLEAN DEFAULT false NOT NULL,
    ai_assistant_model TEXT DEFAULT 'gpt-3.5-turbo',
    ai_assistant_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_role user_role NOT NULL,
    is_ai_generated BOOLEAN DEFAULT false NOT NULL,
    ai_model_used TEXT,
    ai_response_time_ms INTEGER,
    parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE SET NULL,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    status session_status DEFAULT 'active' NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ
);

-- AI assistant configurations table
CREATE TABLE ai_assistant_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
    system_prompt TEXT,
    temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER DEFAULT 150 CHECK (max_tokens > 0),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE ai_assistant_configs IS 'Stores AI assistant configuration per room. Conversation context is built dynamically from existing rooms and messages tables.';

-- Session checklists table
CREATE TABLE session_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_items INTEGER NOT NULL DEFAULT 0,
    completed_items INTEGER NOT NULL DEFAULT 0,
    completion_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist items table
CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES session_checklists(id) ON DELETE CASCADE,
    area_text TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('detection_area', 'verification_step')),
    priority TEXT NOT NULL CHECK (priority IN ('critical', 'important', 'optional')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'partially_covered', 'covered', 'needs_review')),
    understanding_level TEXT NOT NULL CHECK (understanding_level IN ('none', 'basic', 'good', 'excellent')),
    tutor_notes TEXT DEFAULT '',
    last_addressed TIMESTAMPTZ,
    attempts_count INTEGER NOT NULL DEFAULT 0,
    original_template_area BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coverage evidence table
CREATE TABLE coverage_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    evidence_text TEXT NOT NULL,
    analysis TEXT NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    detection_method TEXT NOT NULL CHECK (detection_method IN ('ai_analysis', 'tutor_manual', 'student_self_assessment')),
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist updates table
CREATE TABLE checklist_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES session_checklists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    previous_understanding TEXT NOT NULL,
    new_understanding TEXT NOT NULL,
    evidence_id UUID REFERENCES coverage_evidence(id) ON DELETE SET NULL,
    updated_by TEXT NOT NULL CHECK (updated_by IN ('ai', 'tutor', 'student')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist configs table
CREATE TABLE checklist_configs (
    room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    ai_detection_sensitivity TEXT NOT NULL DEFAULT 'moderate' CHECK (ai_detection_sensitivity IN ('strict', 'moderate', 'flexible')),
    auto_coverage_detection BOOLEAN NOT NULL DEFAULT true,
    require_tutor_confirmation BOOLEAN NOT NULL DEFAULT false,
    completion_threshold INTEGER NOT NULL DEFAULT 75 CHECK (completion_threshold >= 0 AND completion_threshold <= 100),
    regression_detection BOOLEAN NOT NULL DEFAULT true,
    show_progress_to_students BOOLEAN NOT NULL DEFAULT true,
    group_by_priority BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist templates table
CREATE TABLE checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_by_tutor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN NOT NULL DEFAULT false,
    usage_count INTEGER NOT NULL DEFAULT 0,
    average_completion_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template items table
CREATE TABLE template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
    item_text TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('detection_area', 'verification_step')),
    priority TEXT NOT NULL CHECK (priority IN ('critical', 'important', 'optional')),
    suggested_understanding_threshold INTEGER DEFAULT 75 CHECK (suggested_understanding_threshold >= 0 AND suggested_understanding_threshold <= 100),
    description TEXT,
    teaching_tips TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Users indexes
CREATE INDEX idx_users_current_role ON users(current_role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_display_name ON users(display_name);

-- Rooms indexes
CREATE INDEX idx_rooms_tutor_id ON rooms(tutor_id);
CREATE INDEX idx_rooms_is_active ON rooms(is_active);
CREATE INDEX idx_rooms_password ON rooms(password);

-- Messages indexes
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_is_ai_generated ON messages(is_ai_generated);
CREATE INDEX idx_messages_parent_message_id ON messages(parent_message_id);

-- Sessions indexes
CREATE INDEX idx_sessions_room_id ON sessions(room_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- AI configs indexes
CREATE INDEX idx_ai_assistant_configs_room_id ON ai_assistant_configs(room_id);

-- Checklist indexes
CREATE INDEX idx_session_checklists_room_id ON session_checklists(room_id);
CREATE INDEX idx_session_checklists_active ON session_checklists(is_active) WHERE is_active = true;
CREATE INDEX idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX idx_checklist_items_status ON checklist_items(status);
CREATE INDEX idx_checklist_items_priority ON checklist_items(priority);
CREATE INDEX idx_coverage_evidence_item_id ON coverage_evidence(item_id);
CREATE INDEX idx_coverage_evidence_timestamp ON coverage_evidence(timestamp);
CREATE INDEX idx_checklist_updates_checklist_id ON checklist_updates(checklist_id);
CREATE INDEX idx_checklist_updates_created_at ON checklist_updates(created_at);
CREATE INDEX idx_template_items_template_id ON template_items(template_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Initialize checklist from template
CREATE OR REPLACE FUNCTION initialize_checklist_from_template(
    p_room_id UUID,
    p_template_name TEXT
) RETURNS UUID AS $$
DECLARE
    v_checklist_id UUID;
    v_template_id UUID;
    template_item RECORD;
BEGIN
    -- For simplified auth, skip permission validation
    -- Just validate that the room exists
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) THEN
        RAISE EXCEPTION 'Room not found: %', p_room_id;
    END IF;
    
    -- First, deactivate any existing active checklists for this room
    UPDATE session_checklists 
    SET is_active = false 
    WHERE room_id = p_room_id AND is_active = true;
    
    -- Get the template ID (using existing SCENARIO_TEMPLATES or custom templates)
    SELECT id INTO v_template_id 
    FROM checklist_templates 
    WHERE name = p_template_name;
    
    -- Create the session checklist WITH is_active = true
    INSERT INTO session_checklists (room_id, template_name, is_active, session_start)
    VALUES (p_room_id, p_template_name, true, NOW())
    RETURNING id INTO v_checklist_id;
    
    -- If we have a custom template, use its items
    IF v_template_id IS NOT NULL THEN
        FOR template_item IN 
            SELECT item_text, item_type, priority 
            FROM template_items 
            WHERE template_id = v_template_id
            ORDER BY sort_order
        LOOP
            INSERT INTO checklist_items (
                checklist_id, area_text, item_type, priority, status, understanding_level,
                tutor_notes, attempts_count, original_template_area
            ) VALUES (
                v_checklist_id, template_item.item_text, template_item.item_type, 
                template_item.priority, 'pending', 'none',
                '', 0, true
            );
        END LOOP;
    ELSE
        -- If no custom template found, create a basic structure
        INSERT INTO checklist_items (
            checklist_id, area_text, item_type, priority, status, understanding_level,
            tutor_notes, attempts_count, original_template_area
        ) VALUES 
        (v_checklist_id, 'Suspicious language indicators', 'detection_area', 'critical', 'pending', 'none', '', 0, true),
        (v_checklist_id, 'Verify sender identity', 'verification_step', 'critical', 'pending', 'none', '', 0, true),
        (v_checklist_id, 'Check URL legitimacy', 'verification_step', 'important', 'pending', 'none', '', 0, true);
    END IF;
    
    -- Update total_items count
    UPDATE session_checklists 
    SET total_items = (
        SELECT COUNT(*) FROM checklist_items WHERE checklist_id = v_checklist_id
    ),
    completed_items = 0,
    completion_percentage = 0
    WHERE id = v_checklist_id;
    
    RETURN v_checklist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update checklist progress
CREATE OR REPLACE FUNCTION update_checklist_progress(p_checklist_id UUID) 
RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_percentage DECIMAL(5,2);
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM checklist_items 
    WHERE checklist_id = p_checklist_id;
    
    SELECT COUNT(*) INTO v_completed
    FROM checklist_items 
    WHERE checklist_id = p_checklist_id 
    AND status = 'covered';
    
    v_percentage := CASE 
        WHEN v_total = 0 THEN 0 
        ELSE ROUND((v_completed::DECIMAL / v_total::DECIMAL) * 100, 2)
    END;
    
    UPDATE session_checklists 
    SET 
        total_items = v_total,
        completed_items = v_completed,
        completion_percentage = v_percentage,
        updated_at = NOW()
    WHERE id = p_checklist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for checklist progress
CREATE OR REPLACE FUNCTION trigger_update_checklist_progress()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_checklist_progress(
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.checklist_id
            ELSE NEW.checklist_id
        END
    );
    
    RETURN CASE 
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_assistant_configs_updated_at BEFORE UPDATE ON ai_assistant_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Checklist progress trigger
CREATE TRIGGER update_progress_on_item_change
    AFTER INSERT OR UPDATE OR DELETE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION trigger_update_checklist_progress();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assistant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (Simplified Auth - Permissive)
-- =====================================================
-- Note: Since the system uses simplified auth without auth.uid(),
-- all policies are permissive (allow all operations)

-- Users policies
CREATE POLICY "Allow user profile operations" ON users FOR ALL USING (true);

-- Rooms policies
CREATE POLICY "Anyone can view active rooms" ON rooms FOR SELECT USING (is_active = true);
CREATE POLICY "Allow room operations" ON rooms FOR ALL USING (true);

-- Messages policies
CREATE POLICY "Anyone can view messages in active rooms" ON messages FOR SELECT 
    USING (EXISTS (SELECT 1 FROM rooms WHERE id = messages.room_id AND is_active = true));
CREATE POLICY "Allow message operations" ON messages FOR ALL USING (true);

-- Sessions policies
CREATE POLICY "Allow session operations" ON sessions FOR ALL USING (true);

-- AI configs policies
CREATE POLICY "Simple AI config access" ON ai_assistant_configs FOR ALL USING (true);

-- Checklist policies (all permissive)
CREATE POLICY "Allow all operations on session_checklists" ON session_checklists 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on checklist_items" ON checklist_items 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on coverage_evidence" ON coverage_evidence 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on checklist_updates" ON checklist_updates 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on checklist_configs" ON checklist_configs 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on checklist_templates" ON checklist_templates 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on template_items" ON template_items 
    FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- Grant permissions for simplified auth
GRANT ALL ON ai_assistant_configs TO anon;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION initialize_checklist_from_template(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION initialize_checklist_from_template(UUID, TEXT) TO authenticated;

-- =====================================================
-- STORAGE CONFIGURATION
-- =====================================================
-- Note: Storage bucket configuration is handled separately via Supabase UI or API
-- The following would be the configuration:
-- Bucket: 'room-images'
-- Public: true
-- File size limit: 50MB
-- Allowed MIME types: image/*

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION initialize_checklist_from_template(UUID, TEXT) IS 
'Initializes checklist from template. Accessible to anon role for browser clients.';