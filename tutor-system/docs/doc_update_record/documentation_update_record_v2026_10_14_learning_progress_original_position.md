# Restore Original Learning Progress Position

Intent: record the user's clarification and the narrower final layout correction.

Date: 2026-10-14. Followup base commit: `13c3d0b`. Original positioning reference: `22c569b^`.

## Change

Restore the original fixed upper-right trigger and sidebar, including 20px desktop and 10px mobile trigger offsets and the full-width panel at <=768px. Restore the original checklist JSX location and toolbar icon. Retain desktop sidebar clearance, full-width notices, and panel scrolling for short manual setup.

## Evidence

All 22 offline Chromium cases pass the original positioning, close/reopen, scrolling, desktop AI clearance, notice layout, and short manual-form checks. Five focused Jest suites pass 70 tests; runtime TypeScript and the production build pass. Browser evidence is in `output/playwright/original-placement/`; final command logs use `*-original.log` in `output/playwright/`.

The original collapsed trigger intersects navigation at 1024px (Clear), 769/768px (Settings/Download/Clear), and 320px (part of Back to Dashboard). Exact original placement is retained and this limitation is recorded. See the [complete placement record](documentation_update_record_v2026_10_14_learning_progress_upper_right.md) for details.
