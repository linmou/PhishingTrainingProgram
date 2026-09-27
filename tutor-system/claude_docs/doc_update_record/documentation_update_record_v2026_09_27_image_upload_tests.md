# ImageUpload Test Repair Record

Intent: Record fixture updates that make ImageUpload tests exercise its actual input, preview, and upload interactions.

Date: 2026-09-27

## Scope

- Replaced role queries that treated the file-selection area as a button with direct file-input and drop-zone lookups.
- Used the installed `user-event` v13 API for upload and button interactions.
- Reinitialized object-URL mocks per test and verified preview creation before canceling the selected file.

## Verification

- Focused run: 1 suite passed, 16 tests passed.
- The four-directory regression was not rerun for this focused batch.
