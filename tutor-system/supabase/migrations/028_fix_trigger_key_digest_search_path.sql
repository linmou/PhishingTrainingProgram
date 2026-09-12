-- Purpose: fix a latent runtime defect in the shared trigger-key derivation. pgcrypto is installed in the `extensions` schema on the hosted project, but `private.transfer_draft_trigger_key_v1` sets `search_path = public, private` and calls `digest` unqualified, so the call fails with `function digest(bytea, unknown) does not exist` the first time a draft is rejected or regenerated. This migration re-creates the function with the schema-qualified call.
--
-- Scope: function-only. No table, index, or grant changes. The same unqualified-digest defect also exists in `review_assessment_draft_v1` and `send_reviewed_tutor_response_v3` from migration 025; their fix is a separate change because re-creating already-deployed delivery functions carries more risk than re-creating this new helper.

-- 2. Derive the generation-trigger key from the STABLE scope both callers can see.
--    It deliberately excludes item_id and assessment_id: reject sees the draft's
--    checklist item while prepare_transfer_turn_v1 sees only the message, so any
--    item- or assessment-derived component would make the two derivations disagree
--    and suppression would never match.
CREATE OR REPLACE FUNCTION private.transfer_draft_trigger_key_v1(
    p_room_id UUID,
    p_student_id UUID,
    p_checklist_id UUID,
    p_focus_student_message_id UUID
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT left(
        encode(
            extensions.digest(
                convert_to(
                    concat_ws('|',
                        COALESCE(p_room_id::TEXT, ''),
                        COALESCE(p_student_id::TEXT, ''),
                        COALESCE(p_checklist_id::TEXT, ''),
                        COALESCE(p_focus_student_message_id::TEXT, '')
                    ),
                    'UTF8'
                ),
                'sha256'
            ),
            'hex'
        ),
        40
    );
$$;

REVOKE ALL ON FUNCTION private.transfer_draft_trigger_key_v1(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
