# Chat feedback and tutor UI integration

Intent: record the four reported fixes, independent review, and verification of the combined source before local merge.

Date: 2026-10-14. Baseline: `83690fe`. Verified integration source: `3fabb57` on `integration/chat-feedback-ui-fixes`.

## Changes

| Branch | Commit | Result |
| --- | --- | --- |
| `fix/chat-export-rated-count` | `9789762` | TXT counts only messages whose feedback count is positive. Six messages with two rated export two; multiple votes count the message once. |
| `fix/rating-unselected-prompt` | `dd33156` | Inline and required-rating popups retain their question through hover until a star is clicked. Saved selections reopen and remain editable. |
| `fix/quick-adjust-labels` | `6850510` | Quick Adjust and its information dialog show readable metadata labels while retaining configuration keys, values, and student role locks. |
| `fix/learning-progress-layout` | `22c569b` | Desktop reserves sidebar space; narrower screens stack the panel after discussion. Header notices use full rows; mobile toolbar wraps and manual setup scrolls. |

The individual records retain reproduction and focused commands: [export](documentation_update_record_v20261014_txt_feedback_count.md), [rating](documentation_update_record_v2026_10_14_rating_unselected_prompt.md), [labels](documentation_update_record_v2026_10_14_quick_adjust_labels.md), and [layout](documentation_update_record_v2026_10_14_learning_progress_layout.md).

## Verification

All checks used dummy local Supabase settings or mocked services. Browser checks rendered the actual RoomPagePost and ChecklistPanel components in Chromium and blocked external requests.

| Check | Result |
| --- | --- |
| Initial combined export/rating/parameter regression | 12 suites, 94 tests passed. |
| Expanded combined run including checklist components and BDD | 15 suites passed, one existing suite failed; 141 tests passed, four failed, one skipped. The 15 wholly passing suites account for 135 tests. |
| Baseline comparison of the failing AI checklist BDD suite | Original `83690fe` and integration both have the identical four failed test names, six passed, one skipped. JSON and logs retained under `output/playwright/ui-fixes-review/`. |
| Real browser against integrated source | 22 cases passed: eight widths (320–1440px) × Guard on/off, plus six empty/manual setup cases at 500px height. |
| Browser interactions | AI clicks reached the generation callback exactly once in all 16 main cases; all 22 cases had no horizontal overflow. Collapse/reopen, empty setup and manual-submit controls remained reachable. |
| Application TypeScript | Zero diagnostics. |
| Full repository TypeScript | Baseline and integration both have 454 diagnostics in 33 existing test files. Normalized diagnostic SHA-256 matches exactly: `89532d8d567cd4a2d0daa890325534797373176864274dfe6696a712195ac9ac`. |
| Production build | Passed with existing lint and Browserslist warnings; no build errors. |
| Diff whitespace | Passed. |

The four existing BDD failures are: checklist context in system prompt, explanation focused on remaining gaps, inspection of saved coverage evidence, and conflicting understanding flagged for review. Their baseline/integrated JSON reports identify the full test names.

## Review and browser evidence

Three independent reviews checked the diff, edge cases, and acceptance criteria. The edge review found that a capped panel could clip the manual setup form. The final patch uses vertical scrolling, with six additional short-viewport browser cases verifying the controls. Follow-up review confirmed the finding resolved; final reviews report no actionable remaining defects.

Evidence retained locally:

- [Before: covered AI button and compressed notices](../../../output/playwright/ui-fixes-20261014/before-1280-guard.png).
- [After: desktop Guard layout](../../../output/playwright/ui-fixes-20261014/after-1280-guard.png).
- [After: phone Guard layout](../../../output/playwright/ui-fixes-20261014/after-390-guard.png).
- [After: short manual setup](../../../output/playwright/ui-fixes-20261014/after-320-manual-short.png).
- [Integrated browser geometry and interaction results](../../../output/playwright/ui-fixes-20261014/layout-results.json).

The retained worktree `../PhishingTrainingProgram-worktrees/ui-fixes-20261014/layout/output/playwright/` contains `layout-fixture.js` and `verify-layout.js`. To rerun against another checkout, set `UI_FIX_APP_ROOT` to its `tutor-system` directory and `UI_FIX_PORT` when starting the fixture, then set `UI_FIX_BASE_URL` for the verifier. The source and mock input definitions are retained with the harness.
