# Intent
Record the March 28, 2026 documentation updates for merged room JSON export behavior and AI assistant configuration audit logging.

## Date
- 2026-03-28

## Scope
- Documented that room JSON export now merges chat and feedback data into one canonical payload.
- Documented that tutor exports include `ai_config_history` entries when audit rows exist.
- Documented that AI config logging is best-effort and must not block Quick Adjust or settings saves.

## Files Updated
- `claude_docs/README.md`
- `claude_docs/aiService.md`
- `claude_docs/RoomContext.md`

## Notes
- The implementation depends on the `ai_assistant_config_logs` table introduced by `supabase/migrations/020_add_ai_assistant_config_logs.sql`.
- If that table has not been applied yet, tutor workflows still succeed, but audit history will be missing from exports.
