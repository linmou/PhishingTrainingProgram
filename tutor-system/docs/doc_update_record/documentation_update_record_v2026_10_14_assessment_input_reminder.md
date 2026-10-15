# Assessment input reminder

Intent: explain the disabled chat input while the learner has an open assessment.

Updated: 2026-10-14. Baseline commit: `289cdfa`.

`RoomPagePost.tsx` supplies the requested placeholder, “select the correct option(s) to finish the assessments first”, while the current learner has an open assessment. Normal chat uses “Write a comment...”. The QA guide now includes the visible reminder in its public-delivery checks.

Validation: all 22 existing `RoomPagePost.transferLifecycle.test.tsx` tests passed; `git diff --check` passed. This is a display-copy change covered by focused UI regression. No server behavior changed.
