# Learning Progress Layout Repair

Intent: record the responsive layout changes and browser evidence that the tutor composer and Learning Progress controls remain accessible.

Date: 2026-10-14. Implementation base commit: `83690fe`.

## Changes

- Reserve the 400px Learning Progress sidebar width in the desktop room layout.
- Stack Learning Progress after the discussion at viewport widths of 1100px or less; retain scrolling for checklist items and manual setup.
- Place the panel title and close control on one row, followed by full-width Guard and transfer notices.
- Place the collapsed Learning Progress button in document flow and wrap the navigation toolbar on mobile screens.

## Validation

An offline browser fixture bundles the real `RoomPagePost`, `ChecklistPanel`, and `ManualChecklistInput` components with mocked auth, room, and checklist hooks. It makes no external requests.

Before the repair, at 1280×900 with Guard enabled, the AI button spans x=871–964 while the panel begins at x=880. Clicking its center hits checklist content. Guard and transfer notices are squeezed to 112px and 129px respectively.

After the repair, Chromium checks 1440, 1280, 1100, 1024, 769, 768, 390, and 320px widths with Guard on and off. All 16 cases verify that the AI button reaches the mocked generation handler, panel notices have full-width rows, panel collapse/reopen works, and the document has no horizontal overflow. Empty and manual setup controls are also checked at 1024, 390, and 320px widths with a 500px-high viewport.

The focused Jest run passes 4 suites / 48 tests: checklist export, transfer checklist behavior, checklist management, and Guard composer identity. The parent integration run checks the combined frontend build and types.

Local browser artifacts are under `output/playwright/`: `before-1280-guard.png`, `after-*-guard.png`, `after-*-short.png`, and `layout-results.json`. The reproducible harness is `layout-fixture.js` plus `verify-layout.js` in that same directory. Set `UI_FIX_APP_ROOT` to select a source tree, `UI_FIX_PORT` for the fixture server, and `UI_FIX_BASE_URL` for the verifier.
