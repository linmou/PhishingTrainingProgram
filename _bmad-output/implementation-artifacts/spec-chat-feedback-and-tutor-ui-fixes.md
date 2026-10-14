---
title: Correct chat feedback displays and tutor controls
type: bugfix
created: 2026-10-14
status: done
baseline_commit: 83690fe
context:
  - tutor-system/docs/browser-e2e-testing.md
---

Intent: implement and verify the four reported UI defects in isolated worktrees, then merge the fixes into the original branch.

<frozen-after-approval reason="user explicitly requested all four fixes, worktrees, agents, verification, and merge">

## Intent

TXT chat downloads count unrated messages as rated; the rating popup implies a selected level before a click; Quick Adjust exposes internal identifiers; Learning Progress obscures the AI control and compresses its Guard header. Correct these visible behaviors using the existing export, feedback, parameter, and layout components.

## Boundaries & Constraints

Retain stored rating values, parameter identifiers and role locks. Use independent worktrees and bounded agents, preserve existing workspace files, and merge locally after verification. Review and update the nearest documentation before each commit.

## I/O & Edge-Case Matrix

| Scenario | State | Expected behavior |
| --- | --- | --- |
| Mixed feedback | Six messages, two rated | TXT says two rated, matching JSON |
| Empty feedback | Messages with zero feedback statistics | Rated count is zero |
| Multiple votes | One message has multiple ratings | Count the rated message once |
| Fresh rating | Positive or negative popup, no star clicked | Neutral question, submit disabled |
| Selected rating | Student clicks a star | Show selected level and submit that value |
| Edit rating | Existing persisted rating | Display the saved selection |
| Quick Adjust | Default and student-locked parameters | Readable labels; original config values remain intact |
| Expanded progress | Tutor view at desktop and narrow widths | AI control remains reachable |
| Guard progress | Guard enabled | Header wraps without narrow text columns |

</frozen-after-approval>

## Code Map

- `tutor-system/src/contexts/roomExportBuilder.ts`: chat export summary implementation.
- `tutor-system/src/components/FeedbackRating.tsx`: rating display and selection.
- `tutor-system/src/components/AISuggestionBox.tsx`: Quick Adjust controls.
- `tutor-system/src/services/prompts/parameterConfig.ts`: parameter metadata.
- `tutor-system/src/components/ChecklistPanel.tsx` and CSS: progress panel layout.
- `tutor-system/src/pages/RoomPagePost.tsx` and related styles: tutor controls and required-rating dialog.

## Tasks & Acceptance

- [x] Export worktree: reproduce rated-count defect and verify mixed, empty, and multiple-vote cases.
- [x] Rating worktree: reproduce premature level display and verify selection and editing.
- [x] Labels worktree: replace identifier display with readable labels and verify configuration callbacks.
- [x] Layout worktree: reproduce overlap and Guard compression; verify responsive browser geometry and screenshots.
- [x] Review each diff, update documentation, and commit scoped fixes.
- [x] Integrate fixes and run affected integration suites and production build/type checks.
- [x] Merge the verified integration branch into `no_sign_up`.

Acceptance criteria:

- Given six chat messages with only two rated, when TXT is downloaded, then its summary reports two rated messages.
- Given a new rating popup, when no star has been clicked, then the text asks a neutral question until selection.
- Given Quick Adjust is open, when parameters are viewed or changed, then labels are readable and persisted identifiers remain valid.
- Given Learning Progress is expanded, when Guard is enabled or viewport changes, then tutor AI controls remain accessible and header content stays readable.

## Verification

Run focused Jest regression and integration suites with bounded workers. Run the TypeScript compiler and production build on the integrated branch. Use a real Chromium layout check against rendered components, retain screenshot and geometry evidence under `output/playwright/`, and record exact results in a dated documentation update record.

Verified integration source: `3fabb57`. Merged into `no_sign_up` as `384a0c9`; source and documentation match the verified integration branch exactly. The combined run passed 141 tests, with four existing failures and one skipped test in the legacy AI checklist BDD suite. Baseline comparison reproduced the same four failures. The 15 wholly passing suites account for 135 tests. All 22 browser cases and the production build passed; application TypeScript has zero diagnostics, and the full repository diagnostic fingerprint matches the baseline exactly.

Independent edge review caught clipping in manual setup under the new panel height limit. Vertical scrolling and six short-viewport checks resolve it. Final blind, edge, and acceptance reviews have no remaining actionable findings. See the [integration evidence record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_chat_feedback_ui_integration.md).

## Suggested Review Order

- See how the sidebar reserves room for the AI control.
  [RoomPagePost.tsx:851](../../tutor-system/src/pages/RoomPagePost.tsx#L851)
- Inspect full-width notices and responsive scrolling.
  [ChecklistPanel.css:49](../../tutor-system/src/components/ChecklistPanel.css#L49)
- Count rated messages rather than cached feedback records.
  [roomExportBuilder.ts:211](../../tutor-system/src/contexts/roomExportBuilder.ts#L211)
- Keep the initial prompt through hover until selection.
  [FeedbackRating.tsx:51](../../tutor-system/src/components/FeedbackRating.tsx#L51)
- Format display metadata while preserving parameter keys.
  [dynamicParameterLoader.ts:55](../../tutor-system/src/services/prompts/dynamicParameterLoader.ts#L55)
- Assess reproduction, combined checks, baseline comparisons, and browser evidence.
  [Integration record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_chat_feedback_ui_integration.md)
