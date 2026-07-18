# Intent
Record UI separation of behavior-eval rooms from the main Tutor room list.

## Date
- 2026-07-18

## Change
- Main Tutor dashboard (`/#/tutor`) keeps **classic teaching templates** (Account Security, Nintendo, iTunes, and other non-`Demo:` catalog items).
- **`Demo:` / `test_only` templates** and rooms tagged `[behavior-test-room]` live on `/#/tutor/test-rooms`.
- Browser behavior demos create rooms only on the Test Rooms page.

## Why only “3 templates” appeared earlier
Filtering used the full demo seed catalog (7 names), which removed classics from the main create form. That was incorrect; only `test_only` seeds should be Test Rooms exclusives.

## Files
- `src/pages/TestRoomsView.tsx`, `src/utils/behaviorTestRooms.ts`
- `src/services/demoRoomTemplates.ts` (`test_only` flag)
- Docs: `claude_docs/testing-strategy.md`, root `user_feedback*.md|txt`
