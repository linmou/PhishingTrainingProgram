-- Purpose: drop `public.confirm_external_transfer_v1`, the last RPC belonging to a removed operation. The lean refactor removed the `confirm_external_transfer` API operation, its route in the Edge Function, and its facade method, but migrations 032 and 033 only removed reject, regenerate, and the trigger-key helper. This function was left behind: nothing routes to it, and it is the only remaining object that exists for an operation the lean design does not have.
--
-- Verified against the hosted project: the Edge Function contains zero references to `confirm_external_transfer`, and this migration is the only place the name survives outside migration 025, which originally created it.
--
-- Boundary: removes exactly one function. No table, column, index, or grant change. Idempotent through IF EXISTS, and the argument list below is copied from the deployed signature rather than inferred, because migration 032 already demonstrated that a mismatched argument list makes DROP FUNCTION IF EXISTS silently do nothing.

DROP FUNCTION IF EXISTS public.confirm_external_transfer_v1(
    UUID, UUID[], TEXT, TEXT, TEXT, UUID, UUID
);
