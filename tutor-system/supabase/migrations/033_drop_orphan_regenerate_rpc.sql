-- Purpose: remove the one function migration 032 failed to drop. The DROP in 032 used an argument list that does not match the deployed signature, and `DROP FUNCTION IF EXISTS` treats a signature mismatch as "does not exist", so it reported success while doing nothing. Verified against the hosted project: `public.regenerate_assessment_draft_v1` is still present with the identity arguments `p_source_draft_id uuid, p_expected_revision integer, p_expected_snapshot_hash text, p_provider_payload jsonb, p_raw_hash text, p_actor_id uuid, p_request_id uuid`.
--
-- The function is already broken and unreachable: its body references the dropped columns `trigger_key` and `supersedes_draft_id` and the dropped helper `private.transfer_draft_trigger_key_v1`, so any call would raise at runtime. Nothing calls it. This migration removes the definition so the schema matches the lean design.
--
-- Boundary: removes exactly one function. No table, column, index, or grant change. Idempotent.

-- The argument list below is copied from the deployed signature, not from migration 027, which is
-- where the mismatch originated.
DROP FUNCTION IF EXISTS public.regenerate_assessment_draft_v1(
    UUID, INTEGER, TEXT, JSONB, TEXT, UUID, UUID
);
