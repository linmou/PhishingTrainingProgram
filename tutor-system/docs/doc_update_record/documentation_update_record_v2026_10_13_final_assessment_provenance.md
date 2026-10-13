# Final assessment policy provenance

Intent: record why assessment follows developed full understanding, the human decision on its exact trigger, and the remaining delivery work.

Date: 2026-10-13
Status: policy boundary explicitly decided; documentation and local implementation updated. Subsequent validation and release status are recorded in the [implementation record](documentation_update_record_v2026_10_13_final_assessment_implementation.md).
Upstream: [constitution 1.0](../ai-behaviors/constitution.md), specifically P2 for adaptive learning and assessment, P3 for constructive engagement, and P4/H4 for an inspectable decision basis.
Active requirements: [T09.1, T09.5, T09.6](../ai-behaviors/tutor-behavior-specification.md#t09-transfer-assessment-and-verification-lifecycle).
Consumer contract and diagram: [transfer status response contract](../ai-behaviors/transfer-status-response-contract.md#assessment-after-full-understanding).

## Human decision evidence

Authority: the requesting project user in the current conversation. These excerpts record the contextual policy decisions; the rationale below explains their logical dependency on upstream principles.

1. Requested purpose: “assessment should happen after the student shows a full understanding after development or tutoring”, with assessment the last learning message for the item “unless the assessment failed”.
2. Proposed trigger: “Partial --> Covered: demonstrated_understanding”.
3. When asked whether to include direct Pending → Covered, the user decided: “partial only , since pending to full understanding means students know it already , no need to do assessment , otherwise makes students annoied”.
4. The user separately reversed the single-call/single-target proposal. Per-target analysis and the `events` array remain the contract.
5. The user clarified that provenance means the logical dependency of requirements on upstream principles.

The agent's earlier recommendation to assess from both Pending and Partial was not adopted. The contract and diagram now show Pending → Complete and Partial → Assessment Due for `demonstrated_understanding`.

## Rationale and authority boundary

T09.1 owns the mapping to upstream principles. P2 provides the authority for assessment and progression adapted to demonstrated knowledge. P3 supports constructive engagement rather than repetitive activity. The user's decision supplies the exact state-based policy: verify understanding developed from Partial, while crediting understanding demonstrated directly from Pending without a redundant quiz. P4/H4 requires this decision basis to remain inspectable.

The constitution permits this contextual interpretation; it does not independently prescribe the trigger or establish empirical effectiveness. No constitutional priority or exception has been revised. The existing spontaneous-transfer completion exception is retained. A previous Partial state is the chosen operational indicator of development, not proof of when knowledge was acquired.

## Changes and remaining verification

The response contract now links the upstream authority, separates principle support from the human-selected trigger, fixes the Pending path in its state machine, and replaces its missing design-record link with this file. The behavior specification aligns TA02's downstream effect and T09 eligibility, progress outcome, and recovery with that decision.

Before implementation acceptance, align downstream domain/backend/UI specifications, assessment scheduling and grading, and their tests with these boundaries:

- Partial → Covered through `demonstrated_understanding` creates an outstanding final assessment; direct Pending → Covered completes without one.
- Initial and repair signals continue tutoring; spontaneous transfer retains direct completion.
- Deferral preserves the outstanding assessment while evidence remains valid; contradiction invalidates readiness.
- Passing from Covered records a terminal result once while retaining the pair. First incorrect answer leaves the assessment open; second incorrect answer moves to review.
- Recovery requires repair to Partial and later full understanding before a new assessment.

Historical runs and existing partial-trigger tests describe the previous policy. They do not validate this revision. This update is a documentation change; no runtime or model evaluation was executed.
