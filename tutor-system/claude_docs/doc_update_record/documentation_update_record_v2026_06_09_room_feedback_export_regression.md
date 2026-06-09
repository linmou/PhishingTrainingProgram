# Intent
Record the June 9, 2026 documentation update for room chat-history export regression coverage.

## Date
- 2026-06-09

## Scope
- Documented that realtime feedback insert/update events refresh in-memory feedback stats used by chat-history export.
- Recorded the regression-test purpose for TXT and JSON exports after feedback changes without a room reload.

## Files Updated
- `claude_docs/RoomContext.md`
- `src/contexts/__tests__/RoomContext.test.tsx`

## Evidence
- Added RoomContext regression tests for TXT export after a realtime feedback insert.
- Added RoomContext regression tests for JSON export after a realtime feedback update.

## Notes
- This change covers export freshness behavior only. It does not change feedback persistence or Supabase schema.
