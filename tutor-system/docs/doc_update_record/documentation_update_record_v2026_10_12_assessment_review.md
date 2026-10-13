# Transfer assessment tutor review

Intent: record the tutor review UI and private-read contract introduced after browser QA.

Date: 2026-10-12. Base commit: e67a509e16a15521d8d8b2c3d6e96e3bb452d749.

The draft editor exposes its transfer concept and source/new context. Editing the question updates the submitted changed-context text while preserving the original evidence and concept. Its existing unsaved-edit and validation indicators remain active.

Delivered assessment messages offer tutors an explicit answer-key/context read. `TransferAssessmentService.readReview(roomId, assessmentId)` calls `read_review`; the Edge handler requires a verified tutor and authorized room before invoking `get_transfer_assessment_review_v1(p_room_id, p_assessment_id, p_actor_id)`. The RPC must independently validate room ownership and assessment scope. Its response is `{item_label, assessment}` with the private assessment, optionally carrying persisted `resolution`, `attempt_count`, and `feedback_required` for the feedback flow. The public question DTO is unchanged. Private review state is scoped to the requesting account and assessment, with no browser storage.

Deployment dependency: the new RPC requires live schema inspection, migration, and verification before this Edge operation can succeed. The UI displays a recoverable error until it is available; this work alone does not complete browser QA.

Verification: component coverage includes edited-context preservation, private reads only on explicit tutor action, hiding loaded private content after account/role changes, and denied-read recovery. Edge tests cover unauthorized room/role refusal before any RPC and use of verified actor identity.
