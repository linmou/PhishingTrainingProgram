-- Migration to update checklist system architecture
-- Supports student-level checklists, soft delete, and simplified workflow

-- Add student_id to session_checklists for student-level management
ALTER TABLE session_checklists
ADD COLUMN student_id UUID REFERENCES users (id) ON DELETE CASCADE;

-- Add deleted flag for soft delete functionality
ALTER TABLE checklist_items
ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false;

-- Update constraints to support simplified 3-step workflow
-- Remove the 'needs_review' status option to simplify workflow
ALTER TABLE checklist_items
DROP CONSTRAINT checklist_items_status_check;

ALTER TABLE checklist_items
ADD CONSTRAINT checklist_items_status_check CHECK (
    status IN (
        'pending',
        'partially_covered',
        'covered'
    )
);

-- Make priority and understanding_level optional (nullable)
ALTER TABLE checklist_items ALTER COLUMN priority DROP NOT NULL;

ALTER TABLE checklist_items
ALTER COLUMN understanding_level
DROP NOT NULL;

-- Update item_type to support unified knowledge points
ALTER TABLE checklist_items
DROP CONSTRAINT checklist_items_item_type_check;

ALTER TABLE checklist_items
ADD CONSTRAINT checklist_items_item_type_check CHECK (
    item_type IN (
        'understanding',
        'behavior',
        'detection_area',
        'verification_step'
    )
);

-- Add index for soft delete queries
CREATE INDEX idx_checklist_items_deleted ON checklist_items (deleted)
WHERE
    deleted = false;

-- Add index for student-level queries
CREATE INDEX idx_session_checklists_student_id ON session_checklists (student_id);

-- Update RLS policies to support student-level access

-- Drop existing policies
DROP POLICY "Users can view checklists for rooms they have access to" ON session_checklists;

DROP POLICY "Tutors can manage checklists for their rooms" ON session_checklists;

-- Create new policies for student-level checklists
CREATE POLICY "Students can view their own checklists" ON session_checklists FOR
SELECT USING (
        student_id = auth.uid ()
        OR room_id IN (
            SELECT id
            FROM rooms
            WHERE
                tutor_id = auth.uid ()
        )
    );

CREATE POLICY "Tutors can manage checklists for students in their rooms" ON session_checklists FOR ALL USING (
    room_id IN (
        SELECT id
        FROM rooms
        WHERE
            tutor_id = auth.uid ()
    )
);

-- Update checklist_items policies to respect soft delete
DROP POLICY "Users can view checklist items for accessible rooms" ON checklist_items;

DROP POLICY "Tutors can manage checklist items for their rooms" ON checklist_items;

CREATE POLICY "Users can view non-deleted checklist items for accessible rooms" ON checklist_items FOR
SELECT USING (
        deleted = false
        AND checklist_id IN (
            SELECT sc.id
            FROM session_checklists sc
            WHERE
                sc.student_id = auth.uid ()
                OR sc.room_id IN (
                    SELECT id
                    FROM rooms
                    WHERE
                        tutor_id = auth.uid ()
                )
        )
    );

CREATE POLICY "Tutors can manage checklist items for their rooms" ON checklist_items FOR ALL USING (
    checklist_id IN (
        SELECT sc.id
        FROM
            session_checklists sc
            JOIN rooms r ON sc.room_id = r.id
        WHERE
            r.tutor_id = auth.uid ()
    )
);

-- Update the progress calculation function to exclude deleted items
CREATE OR REPLACE FUNCTION update_checklist_progress(p_checklist_id UUID) 
RETURNS VOID AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
    v_percentage DECIMAL(5,2);
BEGIN
    -- Count only non-deleted items
    SELECT COUNT(*) INTO v_total
    FROM checklist_items 
    WHERE checklist_id = p_checklist_id AND deleted = false;
    
    SELECT COUNT(*) INTO v_completed
    FROM checklist_items 
    WHERE checklist_id = p_checklist_id 
    AND deleted = false
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

-- Update the template initialization function to support student-level checklists
CREATE OR REPLACE FUNCTION initialize_checklist_from_template(
    p_room_id UUID,
    p_student_id UUID,
    p_template_name TEXT
) RETURNS UUID AS $$
DECLARE
    v_checklist_id UUID;
    v_template_id UUID;
    template_item RECORD;
BEGIN
    -- Get the template ID
    SELECT id INTO v_template_id 
    FROM checklist_templates 
    WHERE name = p_template_name;
    
    -- Create the session checklist for specific student
    INSERT INTO session_checklists (room_id, student_id, template_name)
    VALUES (p_room_id, p_student_id, p_template_name)
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
                checklist_id, area_text, item_type, priority, status, understanding_level, deleted
            ) VALUES (
                v_checklist_id, template_item.item_text, template_item.item_type, 
                template_item.priority, 'pending', NULL, false
            );
        END LOOP;
    END IF;
    
    -- Update total_items count (excluding deleted items)
    UPDATE session_checklists 
    SET total_items = (
        SELECT COUNT(*) FROM checklist_items 
        WHERE checklist_id = v_checklist_id AND deleted = false
    )
    WHERE id = v_checklist_id;
    
    RETURN v_checklist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to soft delete checklist items
CREATE OR REPLACE FUNCTION soft_delete_checklist_item(p_item_id UUID)
RETURNS VOID AS $$
DECLARE
    v_checklist_id UUID;
BEGIN
    -- Mark item as deleted
    UPDATE checklist_items 
    SET deleted = true, updated_at = NOW()
    WHERE id = p_item_id
    RETURNING checklist_id INTO v_checklist_id;
    
    -- Update progress calculation
    PERFORM update_checklist_progress(v_checklist_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to extract checklist items from system prompt (placeholder for LLM integration)
CREATE OR REPLACE FUNCTION extract_checklist_from_prompt(
    p_system_prompt TEXT,
    p_room_id UUID,
    p_student_id UUID
) RETURNS UUID AS $$
DECLARE
    v_checklist_id UUID;
BEGIN
    -- Create the session checklist
    INSERT INTO session_checklists (room_id, student_id, template_name)
    VALUES (p_room_id, p_student_id, 'LLM_EXTRACTED')
    RETURNING id INTO v_checklist_id;
    
    -- Note: Actual LLM extraction would be handled by application layer
    -- This function provides the database structure for storing extracted items
    
    RETURN v_checklist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for active checklist items (non-deleted)
CREATE VIEW active_checklist_items AS
SELECT *
FROM checklist_items
WHERE
    deleted = false;

-- Create a view for student checklist progress
CREATE VIEW student_checklist_progress AS
SELECT
    sc.id as checklist_id,
    sc.room_id,
    sc.student_id,
    sc.template_name,
    sc.completion_percentage,
    COUNT(ci.id) as total_active_items,
    COUNT(
        CASE
            WHEN ci.status = 'covered' THEN 1
        END
    ) as covered_items,
    COUNT(
        CASE
            WHEN ci.status = 'partially_covered' THEN 1
        END
    ) as partially_covered_items,
    COUNT(
        CASE
            WHEN ci.status = 'pending' THEN 1
        END
    ) as pending_items,
    COUNT(
        CASE
            WHEN ci.area_text LIKE '[understanding]%' THEN 1
        END
    ) as understanding_items,
    COUNT(
        CASE
            WHEN ci.area_text LIKE '[behavior]%' THEN 1
        END
    ) as behavior_items
FROM
    session_checklists sc
    LEFT JOIN checklist_items ci ON sc.id = ci.checklist_id
    AND ci.deleted = false
GROUP BY
    sc.id,
    sc.room_id,
    sc.student_id,
    sc.template_name,
    sc.completion_percentage;

-- Add comment to document the new architecture
COMMENT ON
TABLE session_checklists IS 'Student-level checklists with support for LLM extraction and template fallback';

COMMENT ON COLUMN session_checklists.student_id IS 'Links checklist to specific student for individual progress tracking';

COMMENT ON COLUMN checklist_items.deleted IS 'Soft delete flag - items remain in database but excluded from calculations';

COMMENT ON VIEW active_checklist_items IS 'Shows only non-deleted checklist items for regular operations';

COMMENT ON VIEW student_checklist_progress IS 'Aggregated progress view with cognitive/behavioral breakdown';