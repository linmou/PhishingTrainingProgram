-- Purpose: fix the second half of the reject_guard_progress_mutation defect. Migration 030 narrowed three triggers to BEFORE UPDATE OR DELETE, which stopped the INSERT crashes but only treated one direction of a symmetric bug: the function's two early-returns each dereference columns that belong to a different table.
--
--   Branch 1 tests NEW.total_items / completed_items / completion_percentage. Those columns exist only on session_checklists, so the branch breaks when the trigger fires on checklist_items, checklist_updates, or coverage_evidence.
--   Branch 2 tests NEW.status / understanding_level / attempts_count / last_addressed / deleted. Those columns exist only on checklist_items, so the branch breaks when the trigger fires on session_checklists.
--
-- Migration 030 hid branch 1 by removing INSERT from three triggers. The remaining path is live and reachable in ordinary use, not a corner case: inserting a checklist item fires `trigger_update_checklist_progress`, which updates `session_checklists`, which fires `block_guard_session_checklist_progress` on session_checklists, which reaches branch 2 and fails with `42703: record "new" has no field "status"`. Verified on the hosted project: checklist_items has all five branch-2 columns and session_checklists has none of them.
--
-- Fix: gate each early-return on TG_OP = 'UPDATE' before it dereferences NEW/OLD. Both branches compare against OLD, so they are only meaningful on UPDATE; on INSERT there is no OLD and on DELETE there is no NEW. With both branches guarded, the function is safe for every table and every operation, which is what a shared trigger function must be.
--
-- Consequence for migration 030: its trigger narrowing is now redundant, and this migration restores those triggers to their migration-023 intent of BEFORE INSERT OR UPDATE OR DELETE. That restores the Guard-mode check on INSERT and DELETE, which 030 had inadvertently disabled. The function body is otherwise byte-identical to its migration 023 definition, including the missing SET search_path and SECURITY DEFINER that migration 025 also did not add.

CREATE OR REPLACE FUNCTION reject_guard_progress_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    active_mode tutor_response_mode;
BEGIN
    -- Both early-returns compare NEW against OLD, so both are only meaningful on UPDATE. On other
    -- operations they must be skipped before any column is dereferenced, because NEW and OLD are
    -- resolved against the firing table and this function serves several tables with different
    -- column sets.
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'session_checklists'
           AND NEW.total_items IS NOT DISTINCT FROM OLD.total_items
           AND NEW.completed_items IS NOT DISTINCT FROM OLD.completed_items
           AND NEW.completion_percentage IS NOT DISTINCT FROM OLD.completion_percentage THEN
            RETURN NEW;
        END IF;

        IF TG_TABLE_NAME = 'checklist_items'
           AND NEW.status IS NOT DISTINCT FROM OLD.status
           AND NEW.understanding_level IS NOT DISTINCT FROM OLD.understanding_level
           AND NEW.attempts_count IS NOT DISTINCT FROM OLD.attempts_count
           AND NEW.last_addressed IS NOT DISTINCT FROM OLD.last_addressed
           AND NEW.deleted IS NOT DISTINCT FROM OLD.deleted THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT rooms.active_response_mode INTO active_mode
    FROM rooms
    JOIN session_checklists ON session_checklists.room_id = rooms.id
    WHERE session_checklists.id = CASE
        WHEN TG_TABLE_NAME = 'session_checklists' THEN COALESCE(NEW.id, OLD.id)
        WHEN TG_TABLE_NAME = 'checklist_items' THEN COALESCE(NEW.checklist_id, OLD.checklist_id)
        WHEN TG_TABLE_NAME = 'checklist_updates' THEN COALESCE(NEW.checklist_id, OLD.checklist_id)
        ELSE (
            SELECT checklist_id FROM checklist_items
            WHERE id = COALESCE(NEW.item_id, OLD.item_id)
        )
    END;

    IF active_mode = 'guard' THEN
        RAISE EXCEPTION 'Learning progression is locked while Guard Mode is active';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Restore the migration 023 trigger coverage that migration 030 narrowed. The function is now safe
-- on INSERT and DELETE, so the Guard-mode check applies to them again as originally intended.
DROP TRIGGER IF EXISTS block_guard_checklist_item_updates ON checklist_items;
CREATE TRIGGER block_guard_checklist_item_updates
BEFORE INSERT OR UPDATE OR DELETE ON checklist_items
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();

DROP TRIGGER IF EXISTS block_guard_checklist_updates ON checklist_updates;
CREATE TRIGGER block_guard_checklist_updates
BEFORE INSERT OR UPDATE OR DELETE ON checklist_updates
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();

DROP TRIGGER IF EXISTS block_guard_checklist_evidence ON coverage_evidence;
CREATE TRIGGER block_guard_checklist_evidence
BEFORE INSERT OR UPDATE OR DELETE ON coverage_evidence
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();

DROP TRIGGER IF EXISTS block_guard_session_checklist_progress ON session_checklists;
CREATE TRIGGER block_guard_session_checklist_progress
BEFORE INSERT OR UPDATE OR DELETE ON session_checklists
FOR EACH ROW EXECUTE FUNCTION reject_guard_progress_mutation();
