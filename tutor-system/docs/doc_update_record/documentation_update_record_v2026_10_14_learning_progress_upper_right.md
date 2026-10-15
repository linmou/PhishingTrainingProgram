# Learning Progress Upper-Right Placement

Intent: record the requested placement correction and evidence that responsive progress access preserves usable room controls.

Date: 2026-10-14. Implementation base commit: `8dc7271`. Branch: `fix/learning-progress-upper-right`.

## Behavior

The collapsed Learning Progress button and opened panel now appear at the upper right. The existing checklist component lives in the sticky room header. Its desktop button stays fixed at the upper-right corner, and the opened 400px sidebar retains dedicated room space so it cannot cover the tutor composer.

At viewport widths of 1100px or less, the collapsed button occupies a right-aligned header row above the navigation controls. Opening it displays a fixed right-side drawer, up to 400px wide and bounded by the viewport. Closing the drawer restores the toolbar and discussion controls. Manual target setup remains scrollable. The redundant icon-only toolbar trigger was removed; Guard and transfer notices retain their full-width rows.

This supersedes the bottom stacking described in the [previous layout repair](documentation_update_record_v2026_10_14_learning_progress_layout.md).

## Validation

The local offline browser fixture bundles the actual `RoomPagePost`, `ChecklistPanel`, and `ManualChecklistInput` components with mocked room/auth/checklist dependencies. Chromium passes 16 combinations of 1440, 1280, 1100, 1024, 769, 768, 390, and 320px widths with Guard enabled and disabled. Every combination verifies:

- Upper-right collapsed trigger and opened panel, including a scrolled room.
- Reachable navigation while collapsed, reachable close/reopen, and a working AI generation handler after closing.
- Dedicated desktop composer clearance, separate full-width notice rows, and no horizontal document overflow.

Another 6 cases check empty and manual target setup at 1024, 390, and 320px widths with a 500px-high viewport. Form controls and submit buttons remain reachable by scrolling, and the drawer closes successfully. The fixture records zero external requests.

Five focused Jest suites pass all 70 tests: `ChecklistPanel`, `ChecklistPanel.transfer`, `RoomPagePost.transferDraft`, `RoomPagePost.transferDecision`, and `RoomPagePost.transferLifecycle`. The updated page tests verify tutor access through the header and hide progress for student and observer viewers.

The runtime-only TypeScript check passes. The repository-wide `tsc --noEmit` reports 454 preexisting test diagnostics on both the base workspace and this worktree, with identical diagnostic lines and no additions or removals. The CRA production build succeeds with existing lint warnings and an outdated Browserslist dataset warning.

## Reproduction And Artifacts

From this worktree root, start the fixture with:

```sh
rtk proxy env UI_FIX_APP_ROOT="$PWD/tutor-system" UI_FIX_PORT=3198 node output/playwright/layout-fixture.js
rtk proxy env UI_FIX_BASE_URL=http://127.0.0.1:3198 node output/playwright/verify-layout.js
```

From `tutor-system/`, run the focused regressions and build with offline client initialization values:

```sh
rtk proxy env CI=true REACT_APP_SUPABASE_URL=https://offline.example.test REACT_APP_SUPABASE_ANON_KEY=offline-fixture npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/components/__tests__/ChecklistPanel.test.tsx src/components/__tests__/ChecklistPanel.transfer.test.tsx src/pages/__tests__/RoomPagePost.transferDraft.test.tsx src/pages/__tests__/RoomPagePost.transferDecision.test.tsx src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx
rtk proxy ./node_modules/.bin/tsc --noEmit --project ../output/tsconfig-runtime.json
rtk proxy env REACT_APP_SUPABASE_URL=https://offline.example.test REACT_APP_SUPABASE_ANON_KEY=offline-fixture npm run build
```

Worktree-local evidence is under `output/playwright/`: `layout-results.json` contains geometry and interaction results; `browser.log`, `jest.log`, `types-runtime.log`, `types-full.log`, `types-baseline.log`, and `build.log` preserve command results. Screenshots use `collapsed-*`, `opened-*`, and `setup-*` names. The fixture and verifier remain there for replay. Visual inspection covered the desktop Guard sidebar, narrow collapsed header, narrow Guard drawer, and short manual form.

Verification covers frontend placement and component interactions using mocked dependencies. No server behavior changes are involved.
