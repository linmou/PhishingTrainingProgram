---
title: Restore original Learning Progress placement
type: bugfix
created: 2026-10-14
status: done
baseline_commit: 13c3d0b
context: []
---

Intent: preserve the user's clarified request to return Learning Progress to its original position.

## Intent

The user requested the original upper-right placement, as implemented before commit `22c569b`. Restore its fixed positioning and original toolbar/JSX arrangement. Keep the desktop sidebar clearance and full-width notice improvements.

## Implementation

- [x] Restore the fixed collapsed trigger at top/right 20px, z-index 999; use the original 10px offsets at widths <=768px.
- [x] Restore the fixed panel at top/right zero, 400px wide and 100vh high; at <=768px, use the original full-width panel with left zero.
- [x] Restore the checklist JSX after the discussion and original tutor toolbar icon with its existing AI-availability condition.
- [x] Retain desktop 400px sidebar clearance, full-width notices, and scrolling for short manual setup.
- [x] Restore original page-test assertions and verify final placement with real components in Chromium.
- [x] Update documentation and record the focused followup.

## Acceptance

- Given a collapsed progress panel, when the room is displayed or scrolled, then its fixed offsets match the original desktop/mobile rules.
- Given an opened panel, when the room is viewed at desktop or compact widths, then its position and width follow the original fixed sidebar/full-width rules.
- Given a desktop room with the panel open, when the AI button is clicked, then dedicated sidebar clearance prevents interception.
- Given a short viewport with manual setup, when the user scrolls to the submit control, then it is reachable and the panel can close.

## Verification

- Chromium: 16 width/Guard combinations at 1440, 1280, 1100, 1024, 769, 768, 390, and 320px plus 6 empty/manual setup cases at 500px height pass; zero external requests.
- Original placement leaves inherited collapsed-button overlap with some navigation at 1024, 769, 768, and 320px. This is recorded in the evidence.
- Focused Jest: 5 suites / 70 tests pass.
- Runtime TypeScript check and CRA production build pass; existing lint/Browserslist warnings remain.
- Full repository TypeScript previously reported 454 identical baseline/current test diagnostics; the followup restores the original TypeScript structure and page tests.
- Evidence: `output/playwright/original-placement/layout-results.json`, screenshots in that directory, and `*-original.log` files in `output/playwright/`.

## Suggested Review Order

- Fixed offsets and mobile width restore the original placement.
  [ChecklistPanel.css:20](../../tutor-system/src/components/ChecklistPanel.css#L20)
- Dedicated desktop space still protects the composer.
  [RoomPagePost.css:13](../../tutor-system/src/components/RoomPagePost.css#L13)
- Followup record captures exact behavior and inherited overlap evidence.
  [original-position record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_learning_progress_original_position.md)
