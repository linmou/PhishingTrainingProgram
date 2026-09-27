# Realtime Chat Regression Documentation Update

Intent: Record the current reconnect behavior and the focused regression evidence for realtime chat.

Date: 2026-09-27

## Updated Guidance

- Clarified that the RoomContext's two-second polling recovers persisted messages after database access returns.
- Marked offline status and local message queue UI as not implemented.
- Documented rollback of failed optimistic sends as a separate supported behavior.

## Verification

- Command: `CI=true npm test -- --watchAll=false --runInBand src/__tests__/real_time_chat.test.tsx`
- Result: 1 suite passed, 17 tests passed.
- The reconnect test observes an offline polling response, adds the tutor's persisted message, restores database access, and verifies the student page receives the message through polling.
