# Role-based Export Provider Test Record

Intent: record the legacy export-test harness repair that now exercises `RoomProvider` through public actions.

Date: 2026-09-27
Implementation commit: `30acc78`

The role-based export tests now load room/messages through `joinRoom`, create tutor AI interaction data through generation and feedback actions, and await TXT/JSON downloads before checking tutor, student, and observer projections.

Verification: 4 focused suites passed with placeholder Supabase environment values (21 tests); `npm run build` completed with existing source-map and lint warnings.
