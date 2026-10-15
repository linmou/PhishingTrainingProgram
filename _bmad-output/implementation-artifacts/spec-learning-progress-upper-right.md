---
title: Restore Learning Progress to the upper right
type: bugfix
created: 2026-10-14
status: done
baseline_commit: 8dc7271
context: []
---

Intent: keep the implementation and verification of the requested room layout correction reviewable.

<frozen-after-approval reason="user requested implementation in an isolated worktree">

## Intent

**Problem:** Learning Progress moved below the discussion after the previous overlap repair. The user wants it at the upper-right corner, where it is easier to find.

**Approach:** Restore the desktop upper-right trigger and sidebar. On compact screens, keep the trigger in the sticky header and open a right-side drawer with an accessible close control.

## Boundaries & Constraints

**Always:** Keep navigation, tutor controls, checklist notices, and manual target setup reachable. Reserve desktop sidebar space. Keep the change within this isolated worktree.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
| --- | --- | --- |
| Desktop | Open or collapsed checklist above 1100px | Sidebar or trigger appears at upper right; open sidebar has dedicated space. |
| Compact | Open or collapsed checklist at 1100px or below | Trigger appears at header's upper right; opened drawer starts at viewport top/right and can close. |
| Notices | Guard and transfer notices | Notices occupy separate full-width rows below title. |
| Short screen | Manual target setup on 500px-high viewport | Form and submit controls are reachable by scrolling; close remains reachable. |
| Scrolled room | Collapsed checklist while scrolling | Header keeps the trigger visible and navigation reachable. |

</frozen-after-approval>

## Code Map

- `tutor-system/src/pages/RoomPagePost.tsx` — mounts the checklist and navigation.
- `tutor-system/src/components/ChecklistPanel.css` — fixed panel and collapsed trigger geometry.
- `tutor-system/src/components/RoomPagePost.css` — sidebar clearance and sticky navigation.
- `tutor-system/docs/README.md` — current documented progress layout.

## Tasks & Acceptance

**Execution:**
- [x] Move existing checklist into the sticky header and remove the duplicate icon trigger.
- [x] Restore upper-right geometry with compact scrolling and desktop clearance.
- [x] Verify responsive layout and interactions against real components in the offline browser fixture.
- [x] Run focused component/page regressions, TypeScript, and frontend build.
- [x] Update layout documentation and record evidence before the focused commit.

**Acceptance Criteria:**
- Given a tutor room, when progress is collapsed or reopened at 1440, 1280, 1100, 1024, 769, 768, 390, or 320px, then its control or panel is at the upper right and the document has no horizontal overflow.
- Given a desktop sidebar, when the tutor generates an AI response, then the composer is outside the panel and its handler receives the click.
- Given an opened compact drawer, when the tutor closes it, then navigation and composer controls regain access and the trigger remains reachable during scrolling.
- Given a short viewport and manual setup, when the tutor scrolls to the form's submit button, then the button can be clicked and the drawer can be closed.

## Verification

- Offline Chromium fixture: responsive geometry, hit testing, open/close, scrolling, notices, and manual setup; zero external requests.
- Focused Jest component/page suites: 5 suites / 70 tests pass.
- Runtime TypeScript check: pass. Full `tsc --noEmit`: 454 identical preexisting test diagnostics on base and modified tree; zero additions/removals.
- CRA production build: pass, with existing lint and Browserslist warnings recorded.

## Review

Independent parent review found the runtime layout sound and requested adapting existing role tests to the actual progress trigger. Those tests now verify tutor open/close through the header and absence for student/observer roles. Browser checks and visual inspection pass after this adjustment.

## Suggested Review Order

- Existing progress component moves into the sticky header, keeping compact access visible while scrolling.
  [RoomPagePost.tsx:846](../../tutor-system/src/pages/RoomPagePost.tsx#L846)
- Fixed desktop trigger and compact drawer geometry preserve upper-right placement.
  [ChecklistPanel.css:19](../../tutor-system/src/components/ChecklistPanel.css#L19)
- Desktop sidebar clearance remains; compact screens use the drawer.
  [RoomPagePost.css:13](../../tutor-system/src/components/RoomPagePost.css#L13)
- Existing page regressions cover tutor access and student/observer visibility.
  [RoomPagePost.transferDecision.test.tsx:237](../../tutor-system/src/pages/__tests__/RoomPagePost.transferDecision.test.tsx#L237)
