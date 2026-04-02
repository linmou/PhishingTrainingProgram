# Intent
Record the April 2, 2026 documentation updates for the room JSON export change that removes `ai_config_history` from downloads and relies on per-interaction AI config snapshots instead.

## Date
- 2026-04-02

## Scope
- Documented that tutor room JSON exports no longer include `ai_config_history`.
- Documented that tutor room JSON exports use `ai_interactions[].ai_config_snapshot` as the source of truth for the effective config used to generate each suggestion.
- Clarified that AI config audit history remains stored in Supabase for debugging and auditing, but is not part of the normal download payload.

## Files Updated
- `claude_docs/RoomContext.md`

## Notes
- This keeps the export aligned with the user-facing analysis use case: each generated AI interaction carries its own config snapshot.
- Audit history is still available through `ai_assistant_config_logs` when debugging settings changes that did not produce a generated tutor message.
