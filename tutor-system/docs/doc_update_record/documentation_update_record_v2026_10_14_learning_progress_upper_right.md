# Learning Progress Upper-Right Placement

Intent: record the final upper-right placement and its verification.

Date: 2026-10-14. Latest implementation base commit: `13c3d0b`. Branch: `fix/learning-progress-upper-right`.

## Current Behavior

Learning Progress uses its original fixed upper-right placement from before commit `22c569b`. The collapsed trigger sits 20px from the top and right, with the original 10px offsets at widths of 768px or less. The opened panel is fixed at top/right zero, 400px wide and 100vh high; at 768px or less it spans the viewport width.

The checklist remains after the discussion in the JSX, with fixed CSS controlling its screen location. The original icon-only toolbar trigger and its tutor/AI-availability condition are restored. Desktop rooms retain 400px of reserved sidebar space, notices retain separate full-width rows, and the panel scrolls for short manual forms.

This final behavior supersedes the temporary sticky-header implementation in `13c3d0b` and the bottom stacking described in the [previous layout repair](documentation_update_record_v2026_10_14_learning_progress_layout.md). The [original-position followup](documentation_update_record_v2026_10_14_learning_progress_original_position.md) records the clarification.

## Verification

An offline fixture bundles real `RoomPagePost`, `ChecklistPanel`, and `ManualChecklistInput` components with mocked dependencies. Chromium passes 16 combinations of 1440, 1280, 1100, 1024, 769, 768, 390, and 320px widths with Guard on/off, plus 6 empty/manual setup cases at 500px height. Checks cover original CSS offsets and stacking, panel geometry, close/reopen while scrolled, desktop AI clearance, reachable manual submission, full-width notices, and no horizontal document overflow. The fixture records zero external requests.

The original collapsed trigger overlaps Clear Chat History at 1024px; Settings, Download, and Clear Chat History at 769/768px; and part of Back to Dashboard at 320px. The original position is retained. The tested 390px and >=1100px layouts have no collapsed-trigger/navigation intersection.

Five focused Jest suites pass all 70 tests: `ChecklistPanel`, `ChecklistPanel.transfer`, `RoomPagePost.transferDraft`, `RoomPagePost.transferDecision`, and `RoomPagePost.transferLifecycle`. Runtime TypeScript and the CRA production build pass with existing lint/Browserslist warnings. The earlier full TypeScript comparison found 454 identical preexisting test diagnostics; the final followup restores the original TypeScript structure and page tests.

## Reproduction And Evidence

From the worktree root:

```sh
rtk proxy env UI_FIX_APP_ROOT="$PWD/tutor-system" UI_FIX_PORT=3198 node output/playwright/layout-fixture.js
rtk proxy env UI_FIX_BASE_URL=http://127.0.0.1:3198 node output/playwright/verify-layout.js
```

Current browser geometry and screenshots are under `output/playwright/original-placement/`. Command evidence is saved in `output/playwright/browser-original.log`, `jest-original.log`, `types-runtime-original.log`, and `build-original.log`. Earlier screenshots/logs remain preserved separately.

Verification covers frontend placement using mocked dependencies. No server behavior changes are involved.
