-- Database schema for the checklist system
-- Corrected to work with existing schema (no room_participants table)

-- Main checklist for each session
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

-- Individual items in the checklist (both detection areas and verification steps)
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

-- Evidence for why an area was marked as covered
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

-- Track all updates to checklist items
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

-- Configuration for checklist behavior per room
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

-- Templates for reusable checklists
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

-- Items within templates
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

-- Indexes for performance
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

-- Row Level Security (RLS) policies
ALTER TABLE session_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_checklists (simplified - using existing schema)
CREATE POLICY "Users can view checklists for rooms they have access to" ON session_checklists
    FOR SELECT USING (
        room_id IN (
            -- Allow tutors to see their own rooms
            SELECT id FROM rooms WHERE tutor_id = auth.uid()
            UNION
            -- Allow users who have sessions in the room
            SELECT room_id FROM sessions WHERE student_id = auth.uid() OR tutor_id = auth.uid()
        )
    );

CREATE POLICY "Tutors can manage checklists for their rooms" ON session_checklists
    FOR ALL USING (
        room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid())
    );

-- RLS Policies for checklist_items
CREATE POLICY "Users can view checklist items for accessible rooms" ON checklist_items
    FOR SELECT USING (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            WHERE sc.room_id IN (
                SELECT id FROM rooms WHERE tutor_id = auth.uid()
                UNION
                SELECT room_id FROM sessions WHERE student_id = auth.uid() OR tutor_id = auth.uid()
            )
        )
    );

CREATE POLICY "Tutors can manage checklist items for their rooms" ON checklist_items
    FOR ALL USING (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            JOIN rooms r ON sc.room_id = r.id
            WHERE r.tutor_id = auth.uid()
        )
    );

-- RLS Policies for coverage_evidence
CREATE POLICY "Users can view evidence for accessible checklist items" ON coverage_evidence
    FOR SELECT USING (
        item_id IN (
            SELECT ci.id FROM checklist_items ci
            JOIN session_checklists sc ON ci.checklist_id = sc.id
            WHERE sc.room_id IN (
                SELECT id FROM rooms WHERE tutor_id = auth.uid()
                UNION
                SELECT room_id FROM sessions WHERE student_id = auth.uid() OR tutor_id = auth.uid()
            )
        )
    );

CREATE POLICY "System and tutors can insert evidence" ON coverage_evidence
    FOR INSERT WITH CHECK (true); -- Will be handled by application logic

-- RLS Policies for checklist_updates
CREATE POLICY "Users can view updates for accessible checklists" ON checklist_updates
    FOR SELECT USING (
        checklist_id IN (
            SELECT sc.id FROM session_checklists sc
            WHERE sc.room_id IN (
                SELECT id FROM rooms WHERE tutor_id = auth.uid()
                UNION
                SELECT room_id FROM sessions WHERE student_id = auth.uid() OR tutor_id = auth.uid()
            )
        )
    );

-- RLS Policies for templates
CREATE POLICY "Users can view public templates and their own templates" ON checklist_templates
    FOR SELECT USING (is_public = true OR created_by_tutor_id = auth.uid());

CREATE POLICY "Users can manage their own templates" ON checklist_templates
    FOR ALL USING (created_by_tutor_id = auth.uid());

CREATE POLICY "Users can view template items for accessible templates" ON template_items
    FOR SELECT USING (
        template_id IN (
            SELECT id FROM checklist_templates 
            WHERE is_public = true OR created_by_tutor_id = auth.uid()
        )
    );

-- RLS Policy for checklist_configs
CREATE POLICY "Tutors can manage configs for their rooms" ON checklist_configs
    FOR ALL USING (
        room_id IN (SELECT id FROM rooms WHERE tutor_id = auth.uid())
    );

-- Functions for common operations

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
    -- Get the template ID (using existing SCENARIO_TEMPLATES or custom templates)
    SELECT id INTO v_template_id 
    FROM checklist_templates 
    WHERE name = p_template_name;
    
    -- Create the session checklist
    INSERT INTO session_checklists (room_id, template_name)
    VALUES (p_room_id, p_template_name)
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
                checklist_id, area_text, item_type, priority, status, understanding_level
            ) VALUES (
                v_checklist_id, template_item.item_text, template_item.item_type, 
                template_item.priority, 'pending', 'none'
            );
        END LOOP;
    END IF;
    
    -- Update total_items count
    UPDATE session_checklists 
    SET total_items = (
        SELECT COUNT(*) FROM checklist_items WHERE checklist_id = v_checklist_id
    )
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

-- Trigger to automatically update progress when items change
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

CREATE TRIGGER update_progress_on_item_change
    AFTER INSERT OR UPDATE OR DELETE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION trigger_update_checklist_progress();