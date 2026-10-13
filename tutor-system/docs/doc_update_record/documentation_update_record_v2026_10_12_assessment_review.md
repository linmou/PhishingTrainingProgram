# Transfer assessment tutor review

Intent: record the tutor review UI and private-read contract introduced after browser QA.

Date: 2026-10-12. Base commit: e67a509e16a15521d8d8b2c3d6e96e3bb452d749.

The draft editor exposes its transfer concept and source/new context. Editing the question updates the submitted changed-context text while preserving the original evidence and concept. Its existing unsaved-edit and validation indicators remain active.

Delivered assessment messages offer tutors an explicit answer-key/context read. `TransferAssessmentService.readReview(roomId, assessmentId)` calls `read_review`; the Edge handler requires a verified tutor and authorized room before invoking `get_transfer_assessment_review_v1(p_room_id, p_assessment_id, p_actor_id)`. The RPC must independently validate room ownership and assessment scope. Its response is `{item_label, assessment}` with the private assessment, optionally carrying persisted `resolution`, `attempt_count`, and `feedback_required` for the feedback flow. The public question DTO is unchanged. Private review state is scoped to the requesting account and assessment, with no browser storage.

Deployment dependency: the new RPC requires live schema inspection, migration, and verification before this Edge operation can succeed. The UI displays a recoverable error until it is available; this work alone does not complete browser QA.

Verification: component coverage includes edited-context preservation, private reads only on explicit tutor action, hiding loaded private content after account/role changes, and denied-read recovery. Edge tests cover unauthorized room/role refusal before any RPC and use of verified actor identity.

## QA09 integration follow-up — 2026-10-13

Based on merged commit bc4ba50, linked free-text answers now reach the existing deterministic assessment parser through the trusted Edge handler. Ambiguous selections return a non-consuming clarification. A parsed non-selection follows the existing assisted disposition and calls `cancel_transfer_assessment_v1(p_assessment_id, p_message_id, p_actor_id, p_request_id)`. The database owns cancellation, concurrent changes, and duplicate responses. Explicit selection controls retain their existing path; text selections pass the parsed IDs to the grading RPC.

The public question projection preserves the persisted assessment lifecycle, allowing reloads to disable cancelled and resolved questions. Cancelled questions show that no attempt was counted; ambiguous responses retain enabled choices. Cancelled processing context returns its authoritative response before parsing or grading.

Verification: 32 Edge handler tests passed, including real-parser ambiguous/assisted/punctuation selection paths and cancellation replay; 52 frontend/service projection tests passed. SQL deployment remains coordinated with the backend migration.

Follow-up from staging QA on 2026-10-13 (base dc7021c): replaying an accepted answer after cancellation now marks the response `duplicate` / `already_processed: true` while retaining its original grade, attempt counts, selection, and terminal flag. The Edge regression checks that the resolver and write operations are not called.

Stale-candidate recovery follow-up on 2026-10-13 (base 47afa50): the browser facade reads the structured error envelope from Supabase's non-2xx response context, preserving the server code and retryability. An `ASSESSMENT_NOT_ELIGIBLE` rejection now uses the existing superseded mapping. Editing a superseded candidate cannot enable resubmission; the tutor discards it and generates a fresh candidate. A newly supplied candidate resets the editor. Non-JSON transport errors remain transport failures. Verification: 62 focused tests passed, including the service-to-editor stale HTTP response and retryable/non-JSON error paths.
