-- Fix the initialize_checklist_from_template function to set is_active = true
-- This was causing PGRST116 errors because the read query filters by is_active = true
-- but the function wasn't setting this field

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
        -- This handles the case where SCENARIO_TEMPLATES are not in the database
        -- but the application expects to create a checklist anyway
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

-- Also ensure that any existing checklists that might have NULL is_active are updated
UPDATE session_checklists 
SET is_active = true 
WHERE is_active IS NULL;

-- Add a default value for future inserts outside of the function
ALTER TABLE session_checklists 
ALTER COLUMN is_active SET DEFAULT true;