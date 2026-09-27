# Chat Download Test Repair Record

Intent: Record legacy test corrections for the supported chat-history export formats.

Date: 2026-09-27
Implementation commit: `3283928`

## Scope

- Removed PDF expectations from the simplified chat-download test fixture.
- Asserted that the supported TXT and JSON actions are offered.
- Added browser download API mocks needed by the fixture.

## Verification

- Focused run: 1 suite passed, 10 tests passed.
- `git diff --check`: passed before the implementation commit.
- The four-directory regression was not rerun for this focused batch.
