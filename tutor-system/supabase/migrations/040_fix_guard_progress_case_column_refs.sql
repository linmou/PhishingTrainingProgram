-- Purpose: fix the remaining defect in reject_guard_progress_mutation. The function resolves which checklist a fired row belongs to with a single CASE expression whose branches name columns from different tables. Postgres resolves every column reference in a CASE at plan time, including branches whose WHEN does not match, so `NEW.checklist_id` and `NEW.item_id` are resolved against whichever table fired the trigger. `session_checklists` has neither column, so any INSERT, UPDATE, or DELETE on it fails with `42703 record "new" has no field "checklist_id"`.
--
-- This is the third defect found in this one shared function. Migration 030 fixed the INSERT path by narrowing triggers (later reverted). Migration 031 gated the two early-returns on TG_OP, which fixed the branches that dereference progress columns. Neither touched the CASE below them, because a `CASE` whose branches are unreachable at runtime still has all of its column references resolved when the statement is planned.
--
-- Fix: replace the CASE with per-table branches inside explicit `IF TG_TABLE_NAME = ...` blocks, so only columns that exist on the firing table are ever referenced. Behaviour for UPDATE and DELETE is preserved exactly; INSERT now resolves the same way instead of failing.
--
-- Boundary: function-only. Signature, security posture, and the Guard-mode raise are unchanged. No table, column, trigger, index, or grant change.

CREATE OR REPLACE FUNCTION public.reject_guard_progress_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    active_mode tutor_response_mode;
    v_checklist_id uuid;
BEGIN
    -- These two early-returns compare NEW against OLD, so they are only meaningful on UPDATE.
    -- On other operations they must be skipped before any column is dereferenced, because NEW
    -- and OLD are resolved against the firing table and this function serves several tables
    -- with different column sets.
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

    -- Resolve the owning checklist per table. Separate IF branches rather than one CASE, because
    -- a CASE resolves the column references of every branch regardless of which one is taken.
    IF TG_TABLE_NAME = 'session_checklists' THEN
        v_checklist_id := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME = 'checklist_items' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSIF TG_TABLE_NAME = 'checklist_updates' THEN
        v_checklist_id := COALESCE(NEW.checklist_id, OLD.checklist_id);
    ELSE
        -- coverage_evidence carries item_id, not checklist_id.
        SELECT checklist_id INTO v_checklist_id
        FROM checklist_items
        WHERE id = COALESCE(NEW.item_id, OLD.item_id);
    END IF;

    SELECT rooms.active_response_mode INTO active_mode
    FROM rooms
    JOIN session_checklists ON session_checklists.room_id = rooms.id
    WHERE session_checklists.id = v_checklist_id;

    IF active_mode = 'guard' THEN
        RAISE EXCEPTION 'Learning progression is locked while Guard Mode is active';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
