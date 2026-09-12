-- Purpose: make reject_guard_progress_mutation safe for every table it serves, by gating every column reference behind its own table test. This is the fourth and final pass over this one shared function, and the first that audited all of its column references instead of the one the reporter happened to hit.
--
-- Root cause, stated once: a plpgsql `IF` expression is handed to the SQL planner, which resolves every column reference in it against the firing table before evaluating anything, and may reorder `AND` terms. A condition written as `TG_TABLE_NAME = 'x' AND NEW.col = OLD.col` therefore still resolves `NEW.col` when a different table fired the trigger. The fix is not to reorder the condition but to put each table's columns inside its own `IF TG_TABLE_NAME = ...` block, so the reference is never planned for a table that lacks the column.
--
-- Three places in the previous version violated this, and the three defects found in this function so far map to them one by one:
--   1. The two early-return conditions. Migration 031 moved the `TG_OP = 'UPDATE'` test out of the `AND` chain into a wrapper, which fixed the INSERT path but left the cross-table column references inside each chain. The second chain names checklist_items columns, so it fails whenever the trigger fires on session_checklists for an UPDATE -- which is every INSERT into checklist_items, because trigger_update_checklist_progress then updates session_checklists.
--   2. The CASE that resolved the owning checklist. Migration 040 replaced it with per-table branches, which was correct but incomplete: the ELSE branch still named `NEW.item_id`, which only coverage_evidence has.
--   3. Nothing else. The final RETURN uses OLD and NEW without naming a column, so it is safe.
--
-- Boundary: function-only. Signature, language, and security posture are unchanged; the function has never been SECURITY DEFINER and does not set search_path, and it stays that way. No table, column, trigger, index, or grant change.

CREATE OR REPLACE FUNCTION public.reject_guard_progress_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    active_mode tutor_response_mode;
    v_checklist_id uuid;
BEGIN
    -- Each table's columns are referenced only inside its own TG_TABLE_NAME block. The two
    -- early-returns compare NEW against OLD, so they are only meaningful on UPDATE, and they
    -- short-circuit the Guard check when a guarded field did not actually change.
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'session_checklists' THEN
        IF NEW.total_items IS NOT DISTINCT FROM OLD.total_items
           AND NEW.completed_items IS NOT DISTINCT FROM OLD.completed_items
           AND NEW.completion_percentage IS NOT DISTINCT FROM OLD.completion_percentage THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'checklist_items' THEN
        IF NEW.status IS NOT DISTINCT FROM OLD.status
           AND NEW.understanding_level IS NOT DISTINCT FROM OLD.understanding_level
           AND NEW.attempts_count IS NOT DISTINCT FROM OLD.attempts_count
           AND NEW.last_addressed IS NOT DISTINCT FROM OLD.last_addressed
           AND NEW.deleted IS NOT DISTINCT FROM OLD.deleted THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Resolve the owning checklist. Same rule: one table per branch, and the branch that reads
    -- checklist_items by item_id is entered only for the table that actually has item_id.
    IF TG_TABLE_NAME = 'session_checklists' THEN
        v_checklist_id := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'checklist_items' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'checklist_updates' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'coverage_evidence' THEN
        SELECT ci.checklist_id INTO v_checklist_id
        FROM checklist_items ci
        WHERE ci.id = COALESCE(NEW.item_id, OLD.item_id);
    END IF;

    IF v_checklist_id IS NOT NULL THEN
        SELECT rooms.active_response_mode INTO active_mode
        FROM rooms
        JOIN session_checklists ON session_checklists.room_id = rooms.id
        WHERE session_checklists.id = v_checklist_id;

        IF active_mode = 'guard' THEN
            RAISE EXCEPTION 'Learning progression is locked while Guard Mode is active';
        END IF;
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
