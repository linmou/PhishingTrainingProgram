# Intent
Record that behavior-test rooms are hidden from the Student available-rooms list, not only from the Tutor main dashboard.

## Date
- 2026-07-18

## Base commit (pre-change branch tip)
- `687fc6d` (`no_sign_up`)

## Change
- Student dashboard (`/#/student` Available Rooms) uses `filterRoomsForStudentList` / `isHiddenFromStudentRoomList`:
  - behavior-test rooms (`[behavior-test-room]`, `Demo:` titles, test-only titles)
  - browser-demo harness tutors matching `DemoTutor_*` (heritage classic titles without markers)
- Real teaching rooms (classic titles, real tutor names, no marker) stay listed.
- Out of scope: blocking direct `/#/room/:id` deep links; Observer list.

## Files
- Production: `src/pages/StudentView.tsx`, `src/utils/behaviorTestRooms.ts`
- Tests: `src/utils/__tests__/behaviorTestRooms.test.ts`, `src/pages/__tests__/StudentView.roomVisibility.test.tsx`
- Docs: `claude_docs/testing-strategy.md`

## Evidence
- `behaviorTestRooms` + `StudentView.roomVisibility` suites: 10 passed (pipeline + UI)
