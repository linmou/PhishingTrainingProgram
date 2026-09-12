-- Purpose: drop `public.review_assessment_draft_v1`, which migration 038 left behind. That migration dropped `private.assessment_drafts` but did not remove this function, so its body still reads a table that no longer exists. Calling it fails with `42P01 relation "private.assessment_drafts" does not exist`.
--
-- Why 038 missed it: the drop list was derived from the functions that write the delivery and grading path, not from a sweep of every function body for the dropped table names. The dangling-reference sweep in T009 found it afterwards. That sweep is the reason this class of defect is now detectable at all.
--
-- Consequence for the API: `review_draft` currently has no implementation. With no draft table there is no staged revision to load, confirm, or bump, so the operation cannot exist. It must be removed from the Edge Function's operation set, the browser facade, and the room UI along with this function. Until that is done, `review_draft` fails at runtime.
--
-- Boundary: removes exactly one function. No table, column, index, or grant change. The argument list is copied from the deployed signature rather than inferred, because a mismatched list makes DROP FUNCTION IF EXISTS silently do nothing.

DROP FUNCTION IF EXISTS public.review_assessment_draft_v1(
    UUID, INTEGER, JSONB, BOOLEAN, UUID, UUID
);
