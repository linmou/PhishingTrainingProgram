-- Purpose: fix a production defect in the legacy Guard-mode progress guard. `reject_guard_progress_mutation()` was authored in migration 023 to early-return when a guarded progress field is unchanged, but its first early-return compares NEW.total_items, NEW.completed_items, and NEW.completion_percentage without first checking TG_OP = 'UPDATE'. Those columns exist only on session_checklists. On an INSERT into any other guarded table the TG_TABLE_NAME check passes, the TG_OP check is part of the same AND chain that is still being evaluated, and Postgres resolves NEW.total_items against the target table, which has no such column. The result is `42703: record "new" has no field "total_items"` and the INSERT fails.
--
-- SUPERSEDED IN PART BY MIGRATION 031. This migration narrows the triggers, which stops the crash but only treats one direction of a symmetric bug: the function's second early-return compares NEW.status and four other columns that exist only on checklist_items, so it breaks when the trigger fires on session_checklists. Migration 031 fixes the function itself by gating both early-returns on TG_OP = 'UPDATE' and then restores these triggers to BEFORE INSERT OR UPDATE OR DELETE, so the Guard-mode check applies to INSERT and DELETE again. Apply 031 as well; do not rely on this migration alone.
--
-- Effect: INSERT into checklist_items currently fails outright, with checklist_updates and coverage_evidence affected identically. Verified against the hosted project: `checklist_items` has none of the three columns, and its trigger still fires on INSERT.
--
-- Fix: narrow the three remaining triggers to BEFORE UPDATE OR DELETE, which is what the function's early-return logic is actually written for and what migration 023 already did for `block_guard_session_checklist_progress`. No function body is touched, so the Guard-mode mutation check keeps its exact current behaviour for UPDATE and DELETE.
--
-- Boundary: trigger-only. No table, column, index, policy, function, or grant change. No row is modified.

-- Guarded tables whose trigger still fires on INSERT even though none of them has the
-- session_checklists progress columns the function's first early-return inspects.
DROP TRIGGER IF EXISTS block_guard_checklist_item_updates ON checklist_items;
CREATE TRIGGER block_guard_checklist_item_updates
BEFORE UPDATE OR DELETE ON checklist_items
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();

DROP TRIGGER IF EXISTS block_guard_checklist_updates ON checklist_updates;
CREATE TRIGGER block_guard_checklist_updates
BEFORE UPDATE OR DELETE ON checklist_updates
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();

DROP TRIGGER IF EXISTS block_guard_checklist_evidence ON coverage_evidence;
CREATE TRIGGER block_guard_checklist_evidence
BEFORE UPDATE OR DELETE ON coverage_evidence
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();
