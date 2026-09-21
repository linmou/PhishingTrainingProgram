-- Purpose: restore `private.assessment_request_results`, which migration 032 dropped by mistake. The table is not a transfer-assessment artefact and not specific to the reject/regenerate flow. It is the generic request-idempotency ledger: the Edge Function supplies a transport request ID to every mutating RPC, and four operations persist their response under `(operation, request_id)` so a retry returns the recorded result. `post_assessment_message_v1` and `process_assessment_message_v1` both read it as their FIRST database access, so dropping it made every `post_message` and `process_message` call fail with `42P01 relation does not exist`.
--
-- Root cause: migration 032 justified the drop with "it existed only so reject/regenerate could replay", which was true of the draft-disposition rows but false of the table. The lean refactor correctly removed the reject/regenerate callers; it should not have removed the table they shared with two operations that remain live.
--
-- Effect on the lean refactor: none of it is reverted. The removed draft columns, the removed operations, and the removed functions stay removed. Only this table and its grants come back, because two of the seven live operations depend on it.
--
-- SAFETY: idempotent. `CREATE TABLE IF NOT EXISTS` plus re-applied grants. No row is written or deleted. The table is empty on the hosted project because 032's DROP removed it.

CREATE TABLE IF NOT EXISTS private.assessment_request_results (
    operation TEXT NOT NULL,
    request_id UUID NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (operation, request_id)
);

REVOKE ALL ON private.assessment_request_results FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON private.assessment_request_results TO service_role;
