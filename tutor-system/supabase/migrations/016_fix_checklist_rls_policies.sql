-- Fix checklist RLS policies for simplified auth system
-- Since the system uses simplified auth without auth.uid(), we need to disable RLS
-- or create permissive policies that allow all operations

-- Drop all existing policies for session_checklists
DROP POLICY IF EXISTS "Users can view checklists for rooms they have access to" ON session_checklists;
DROP POLICY IF EXISTS "Tutors can manage checklists for their rooms" ON session_checklists;
DROP POLICY IF EXISTS "Tutors can view checklists for their rooms" ON session_checklists;
DROP POLICY IF EXISTS "Tutors can create checklists for their rooms" ON session_checklists;
DROP POLICY IF EXISTS "Tutors can update checklists for their rooms" ON session_checklists;
DROP POLICY IF EXISTS "Tutors can delete checklists for their rooms" ON session_checklists;
DROP POLICY IF EXISTS "Users can view checklists for rooms with sessions" ON session_checklists;
DROP POLICY IF EXISTS "Tutors can manage checklists for students in their rooms" ON session_checklists;
DROP POLICY IF EXISTS "Students can view their own checklists" ON session_checklists;

-- For simplified auth, create permissive policies that allow all operations
CREATE POLICY "Allow all operations on session_checklists" ON session_checklists
    FOR ALL USING (true) WITH CHECK (true);

-- Drop all existing policies for checklist_items
DROP POLICY IF EXISTS "Users can view checklist items for accessible rooms" ON checklist_items;
DROP POLICY IF EXISTS "Tutors can manage checklist items for their rooms" ON checklist_items;

-- Allow all operations on checklist_items
CREATE POLICY "Allow all operations on checklist_items" ON checklist_items
    FOR ALL USING (true) WITH CHECK (true);

-- Drop all existing policies for coverage_evidence
DROP POLICY IF EXISTS "System and tutors can insert evidence" ON coverage_evidence;
DROP POLICY IF EXISTS "Tutors and system can insert evidence" ON coverage_evidence;
DROP POLICY IF EXISTS "System can insert evidence" ON coverage_evidence;
DROP POLICY IF EXISTS "Users can view evidence for accessible checklist items" ON coverage_evidence;

-- Allow all operations on coverage_evidence
CREATE POLICY "Allow all operations on coverage_evidence" ON coverage_evidence
    FOR ALL USING (true) WITH CHECK (true);

-- Drop all existing policies for checklist_updates
DROP POLICY IF EXISTS "Users can view updates for accessible checklists" ON checklist_updates;
DROP POLICY IF EXISTS "Tutors can view and insert updates for their rooms" ON checklist_updates;

-- Allow all operations on checklist_updates
CREATE POLICY "Allow all operations on checklist_updates" ON checklist_updates
    FOR ALL USING (true) WITH CHECK (true);

-- Drop all existing policies for checklist_configs
DROP POLICY IF EXISTS "Tutors can manage configs for their rooms" ON checklist_configs;

-- Allow all operations on checklist_configs
CREATE POLICY "Allow all operations on checklist_configs" ON checklist_configs
    FOR ALL USING (true) WITH CHECK (true);

-- Drop all existing policies for checklist_templates
DROP POLICY IF EXISTS "Users can view public templates and their own templates" ON checklist_templates;
DROP POLICY IF EXISTS "Users can manage their own templates" ON checklist_templates;

-- Allow all operations on checklist_templates
CREATE POLICY "Allow all operations on checklist_templates" ON checklist_templates
    FOR ALL USING (true) WITH CHECK (true);

-- Drop all existing policies for template_items
DROP POLICY IF EXISTS "Users can view template items for accessible templates" ON template_items;

-- Allow all operations on template_items
CREATE POLICY "Allow all operations on template_items" ON template_items
    FOR ALL USING (true) WITH CHECK (true);

-- Update the database function to work with simplified auth (no auth.uid() check)
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
    ELSE
        -- If no custom template found, create a basic structure
        -- This handles the case where SCENARIO_TEMPLATES are not in the database
        -- but the application expects to create a checklist anyway
        INSERT INTO checklist_items (
            checklist_id, area_text, item_type, priority, status, understanding_level
        ) VALUES 
        (v_checklist_id, 'Suspicious language indicators', 'detection_area', 'critical', 'pending', 'none'),
        (v_checklist_id, 'Verify sender identity', 'verification_step', 'critical', 'pending', 'none'),
        (v_checklist_id, 'Check URL legitimacy', 'verification_step', 'important', 'pending', 'none');
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