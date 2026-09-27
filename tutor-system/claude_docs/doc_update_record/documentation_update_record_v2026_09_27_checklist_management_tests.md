# Checklist Management Test Update

Intent: Record how the legacy checklist regression now tests the current service contract while keeping unsupported feature requirements visible.

Date: 2026-09-27

## Current Coverage

`src/__tests__/checklist_management.test.ts` now tests the supported `ChecklistService` and `ChecklistIntegration` APIs: template initialization, asynchronous extraction prefixes, item grouping and evidence reads, progress totals, tutor status changes and audit evidence, custom areas, template fallback, transfer learner ownership, AI message coverage, priority updates, and database error behavior.

The previous suite called removed methods such as `createChecklistFromTemplate`, `calculateProgress`, `softDeleteItem`, and `getStudentChecklist`, and expected obsolete result objects. The replacement keeps the test path and its meaningful supported coverage. The feature file `features/checklist_management.feature` is unchanged.

## Pending Feature Clauses

The suite contains 13 named `it.todo` cases for these requirements. They remain pending and are not asserted as implemented:

1. Tutor status changes refresh AI guidance and show a reinforcement cue.
2. Custom items retain their description and appear in regenerated AI prompts.
3. Individual items can be soft-deleted and excluded from recalculated progress.
4. Coverage evidence remains available after an item is soft-deleted.
5. Analytics report time to first coverage, hardest and strongest items, and AI accuracy.
6. Analytics identify coverage patterns and recommend interventions.
7. Open panels receive checklist and progress changes without a page refresh.
8. Template changes regenerate AI prompts with the replacement items.
9. Understanding and behavior objectives remain separate, with mixed concepts split into items.
10. Legacy room checklists preserve separate progress for each learner across sessions.
11. Tutors can set understanding levels and metadata controls adapt when optional fields are absent.
12. Mastery regression alerts include recommendations and an item reset action.
13. AI outages show Manual Mode and queue updates for synchronization without interrupting the session.

## Verification

- Focused Jest: 1 suite passed; 13 implemented tests passed; 13 feature cases remain pending.
- Changed-file TypeScript: `rtk tsc --noEmit --target es2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --strict --types jest,node src/__tests__/checklist_management.test.ts` reported no errors.
- `git diff --check` passed for the changed test and summary document.
- Clean four-directory replay at `179d433`, before this checklist correction, exited 1 with 4 failing suites, 7 skipped suites, and 61 passing suites. The replay log is `/tmp/transfer-room-ui-T045-179d433-2026-09-27.log`; it has not been rerun after this focused test update.
