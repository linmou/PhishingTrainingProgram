# Room Download Controls Test Record

Intent: Record that supported export formats are verified against the actual room page controls.

Date: 2026-09-27
Implementation commit: `adee95f`

## Scope

- Removed format-availability assertions from the synthetic download fixture.
- Added RoomPagePost checks that the menu offers TXT and JSON, omits PDF, and dispatches the selected format.

## Verification

- Focused run with the documented placeholder Supabase URL and key: 2 suites passed, 17 tests passed.
- `git diff --check`: passed before the implementation commit.
- The four-directory regression was not rerun for this focused batch.
