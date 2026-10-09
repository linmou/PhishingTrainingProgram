# Documentation update record: assessment review UI

Intent: record the tutor-facing assessment review behavior and its verification.

Date: 2026-09-28

## Changed documentation

- `ai-suggestion-tracking.md`: describes editable answer type and choices, the hidden prepared explanation, explicit send after tutor review, and retry behavior.

## Implemented behavior

- Tutors can edit the question, answer type, options, and correct answers.
- The prepared learner-safe explanation stays in the submitted assessment payload but is not shown in the editor.
- Delivery occurs only after the tutor presses **Send assessment**. Failed sends retain the candidate for retry.

## Verification

- Focused assessment UI tests: 3 suites, 49 tests passed.
- Playwright exercised the editor at desktop and mobile widths, including invalid-question rejection and explicit submission through a local callback. The browser made no backend requests and reported no console errors.
