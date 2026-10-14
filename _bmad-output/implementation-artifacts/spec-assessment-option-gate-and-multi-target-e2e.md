---
title: Require assessment option submission and verify multi-target tutoring
type: bugfix
created: 2026-10-14
status: done
baseline_commit: ecee681a9856b46e924bb9c9c61d4adf5c348826
context:
  - tutor-system/docs/browser-e2e-testing.md
---

<frozen-after-approval reason="User explicitly requested delegated implementation and browser E2E updates">

## Intent

**Problem:** A learner can answer an assessment through ordinary chat, leaving the message unbound to the assessment. The assessment then stays open and blocks later knowledge-point assessments. Existing browser checks use option controls and do not verify the alternative-input gate or a second knowledge point.

**Approach:** While the learner has an active delivered assessment, require submission through that question's option controls. Disable ordinary chat and generic Reply, enforce selection and identity in the shared send path, and restore normal tutoring when the assessment closes. Extend browser coverage to prove two distinct knowledge points complete tutoring/assessment cycles in one session.

## Boundaries & Constraints

Always scope the gate to the current learner's nonterminal delivered assessment, preserve retry behavior and authoritative grading, and use distinct question-message and assessment identities in regression evidence. Match existing single/multiple selection contracts. Reuse the established browser fixtures and retain input/output, progress, provider and lifecycle evidence. Keep implementation small and maintain current target scheduling policy.

The user's 2026-10-14 follow-up extends this task through release and live verification. Deliver the inherited final-assessment SQL and matching assessment-api to staging, verify the browser journey, then release and verify the same backend on production. Resolve a deployed-policy mismatch as task work. Keep test-owned fixture cleanup bounded to generated records and preserve evidence before cleanup.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior |
| --- | --- | --- |
| Ordinary chat | No learner-owned open question | Normal posting and tutoring |
| Active question | Learner types, replies elsewhere, or submits without selected options | Composer/Reply disabled; shared send path rejects before persistence |
| Valid selection | Current question, matching assessment, nonempty canonical selection | Trusted post/process runs and records attempt |
| Invalid identity | Foreign/stale assessment or mismatched question parent | Reject before posting |
| Invalid selection | Empty, unknown, duplicate, or multiple choices for single select | Reject before posting |
| First wrong answer | Retry, same open question | Keep chat gated and allow another option submission |
| Terminal result | Pass, second failure, cancellation | Restore ordinary chat and later tutoring |
| Reload/another learner | Persisted lifecycle; foreign learner question | Restore correct gate, never gate on another learner's question |
| Multiple knowledge points | First cycle resolves, then second target is tutored and assessed | Distinct target/assessment IDs, correctly bound attempts and target-local progress |

</frozen-after-approval>

## Code Map

- `tutor-system/src/contexts/transferAssessmentUiAdapter.ts`: shared public question/lifecycle projection.
- `tutor-system/src/contexts/RoomContext.tsx`: trusted learner posting and assessment processing.
- `tutor-system/src/pages/RoomPagePost.tsx`: chat composer, generic replies and dedicated option submission.
- `tutor-system/src/components/PostComment.tsx`: generic Reply action.
- `tutor-system/scripts/browser-e2e/workflows/assessment-answer.js`: retry, pass/fail, reload and answer gate.
- `tutor-system/scripts/browser-e2e/workflows/assessment-delivery.js`: real tutoring/provider/delivery journey.
- `tutor-system/scripts/browser-e2e/workflows/transfer-status-events.js`: target-specific learner observation and persisted progress evidence.

## Tasks & Acceptance

- [x] Add shared learner-owned active-question lookup and enforce selected-option submission in `RoomContext.tsx`.
- [x] Disable the learner composer and generic Reply during an active question, preserving dedicated controls and terminal recovery.
- [x] Update context/page tests for invalid/free-text inputs, ownership, identity, retry, terminal results and reload.
- [x] Extend browser answer checks to demonstrate disabled alternate input, no unbound answer rows, trusted attempts and restored chat.
- [x] Extend the delivery journey through tutoring and assessment of two distinct targets; assert target-local progression and lifecycle identity.
- [x] Run affected Jest, browser harness and TypeScript checks; run the live journey when its hosted prerequisites match; record exact results and limitations.
- [x] Update nearest relevant behavior and browser documentation; review final changes with independent reviewers.
- [x] Refresh the hosted baseline and validate the exact SQL, existing-row disposition, and Edge source locally.
- [x] Apply SQL and deploy the matching assessment-api to staging; verify hosted RPC behavior and source parity.
- [x] Pass live staging multi-target delivery and option-answer/retry workflows with cleanup evidence.
- [x] Apply the same SQL and Edge source to production after staging passes; verify matching live workflows and cleanup.
- [x] Record both release results and archive the exact SQL after verification.

Given an open learner assessment, when ordinary text posting is attempted, then no message is persisted. Given selected options, when the learner submits, then the stored reply and grading result reference the same assessment and question. Given a completed first cycle, when tutoring develops another target, then a new assessment can complete without a stale open assessment blocking it.

## Verification

Run focused `RoomContext.transferAnswer`, concurrency, page lifecycle/decision and adapter suites. Run `npm run test:e2e:unit` and a TypeScript check. For the live assessment-answer/delivery workflows, record app/project identity, assessment/question/target IDs, complete requests/results, progress before/after, screenshots and cleanup status. A non-matching hosted final-assessment policy remains an explicit live-verification limitation.

## Spec Change Log

- 2026-10-14 user follow-up: make development, deployment and live verification one task. Reopened completion and included the inherited backend release. Fresh-baseline tests reproduced incompatible historical open questions; the migration now cancels those questions without changing attempts, completed results or learner progress.
- 2026-10-14 review patches: preserve actual tutor generation while each target is Partial, and send feedback parented to each assessment's terminal answer before moving to the next target. This makes the multi-target test exercise the existing feedback-priority contract rather than stranding the next assessment. Preserve frontend gating, target-local assertions, identity checks and explicit hosted-policy preflight.

## Results

Completed implementation, review, deployment and live verification. Final regression passes 199 frontend tests, 20 browser-harness checks and 39 Edge/domain tests. Full TypeScript checking retains diagnostics in untouched files. Staging assessment-api 54 and production 10 use identical source manifests; the inherited SQL is applied and archived. Playwright against the local app and real hosted backends passes answer/retry/failure plus full-inventory delivery on both environments: seven staging and eight production assessment cycles, including both required tutoring topics, bound answers, gates/reloads, feedback, progress and cleanup. Chrome DevTools confirms the original room is unblocked with no attempt counted. Earlier failures and intermittent invalid analysis-output limitations remain in the [release record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_final_assessment_release.md); the [initial validation record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_assessment_option_gate.md) preserves the pre-release evidence.

## Suggested Review Order

**Learner gate and trusted submission**

- Validate current question identity and selected options before any posting path.
  [RoomContext.tsx:670](../../tutor-system/src/contexts/RoomContext.tsx#L670)
- Share learner ownership and terminal lifecycle lookup between context and page.
  [transferAssessmentUiAdapter.ts:305](../../tutor-system/src/contexts/transferAssessmentUiAdapter.ts#L305)
- Disable ordinary input while keeping dedicated option controls available.
  [RoomPagePost.tsx:1078](../../tutor-system/src/pages/RoomPagePost.tsx#L1078)

**Multi-target cooperation**

- Check hosted policy, then complete both tutoring, assessment and feedback cycles.
  [assessment-delivery.js:201](../../tutor-system/scripts/browser-e2e/workflows/assessment-delivery.js#L201)
- Verify persisted identities and alternate-input gates.
  [assessment-browser-checks.js:8](../../tutor-system/scripts/browser-e2e/workflows/assessment-browser-checks.js#L8)
- Reject terminal feedback tied to another topic or invalid timing.
  [browser-e2e.test.js:330](../../tutor-system/scripts/browser-e2e.test.js#L330)

