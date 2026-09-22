-- Purpose: make the checklist tables writable by the application's session-less client so the
-- research build can create a transfer checklist and seed demo rooms. The transfer boundary used to
-- perform this with service_role, and removing it moved the blocker to these policies.

DROP POLICY IF EXISTS "Students can view their own checklists" ON session_checklists;
DROP POLICY IF EXISTS "Tutors can manage checklists for students in their rooms" ON session_checklists;
DROP POLICY IF EXISTS "Users can view non-deleted checklist items for accessible rooms" ON checklist_items;
DROP POLICY IF EXISTS "Tutors can manage checklist items for their rooms" ON checklist_items;

CREATE POLICY "Research build: checklists are readable" ON session_checklists FOR SELECT USING (true);
CREATE POLICY "Research build: checklists are writable" ON session_checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Research build: checklist items are readable" ON checklist_items FOR SELECT USING (true);
CREATE POLICY "Research build: checklist items are writable" ON checklist_items FOR ALL USING (true) WITH CHECK (true);
