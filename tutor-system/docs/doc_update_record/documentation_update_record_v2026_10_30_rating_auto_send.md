# Send drafted posts after required ratings

Intent: record the combined rating and posting behavior and its verification.

Date: 2026-10-30
Baseline commit: `a21d94a8c0e916e8918626278c1f8c6c0ba34d44`
Issue: https://github.com/linmou/PhishingTrainingProgram/issues/49

## Behavior

The required rating dialog now labels its action “Submit rating and send”. After feedback persistence succeeds, RoomPagePost sends the current draft through the same posting helper as ordinary Send, preserving its reply target. The composer cannot submit again while the rating dialog is active. Rating failures preserve the dialog and draft; posting failures preserve the draft and completed rating for retry.

RoomContext.md documents this flow. This is a frontend change using existing feedback and posting APIs.

## Verification

Focused Jest command, from tutor-system:

```sh
rtk proxy env REACT_APP_SUPABASE_URL=http://127.0.0.1:1 REACT_APP_SUPABASE_ANON_KEY=local-test CI=true npm test -- --watchAll=false --maxWorkers=1 --silent --runTestsByPath src/__tests__/tutor_response_rating_gate.integration.test.tsx src/components/__tests__/PostComment.test.tsx src/__tests__/transfer_assessment.bdd.test.tsx
```

The 45 tests cover delayed feedback persistence before one automatic send, reply-target preservation, rating failure/retry, posting failure/retry, existing rating exemptions, and the assessment lifecycle. Additional race regressions deliver a new Tutor response or an assessment while feedback is pending, verify the draft remains unsent, then verify sending can resume through the appropriate gate. These UI integration tests render RoomPagePost with mocked context persistence; they do not mutate hosted projects.

## Review repair

Codex review on PR #50 found that the original continuation could bypass a response or assessment arriving during rating persistence. The continuation now calls the latest render's send handler through a ref; that handler rechecks both gates and receives only the ID of the response just rated. New response ratings begin unselected, and assessment-blocked drafts remain available after the assessment closes.

Production build passes with existing lint warnings. Repository-wide tsc reports 446 diagnostics in unrelated tests and mocks; a TypeScript compiler API check reports zero diagnostics in the two modified TSX files. GitHub checks and independent review are tracked on the PR.
