# Room Learning Target Draft Documentation Update

Intent: record why target setup failed before learner join and how the shared progress flow now handles that state.

Date: 2026-10-04

The failure came from `useChecklist` treating `transferStudentId` as a save prerequisite. That ID is discovered asynchronously from active room sessions, while the learner join operation can already have succeeded. The hook now stores assessment targets in a room-scoped local draft, keeps them in the existing Learning Progress panel, and promotes the draft through `initializeTransferChecklistForStudent` when the single learner seat becomes available. Tutor text and priority edits remain local until promotion.

Verification: the focused transfer checklist suite passes 19/19 tests and the production build completes with existing ESLint warnings. The Red regression reproduced the original prerequisite error before the fix.
