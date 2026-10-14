# TXT export feedback count

Intent: Record the correction and verification of the rated-message count in downloaded chat transcripts.

- Date: 2026-10-14
- Baseline commit: `83690fe59f26b8b4edd89255d410775bd2424d1d`
- Updated document: `docs/ai-suggestion-tracking.md`, TXT export behavior.
- Cause: The TXT builder counted all cached feedback-stat records, including records with zero feedback entries.
- Change: Count only records where `total_feedback_count > 0`. JSON export behavior is unchanged.
- Regression: `RoomContext.roleBasedExport.test.tsx` joins a room through `RoomProvider`, loads feedback stats for six messages, downloads TXT and JSON, and checks zero, two, and six rated messages. The positive cases also cover multiple feedback entries on one message. Before the fix, the zero/two cases incorrectly printed six messages with feedback; the all-rated case passed.
- Verification: `rtk proxy env REACT_APP_SUPABASE_URL=https://example.supabase.co REACT_APP_SUPABASE_ANON_KEY=offline-test-key npm test -- --watchAll=false --runTestsByPath src/contexts/__tests__/RoomContext.roleBasedExport.test.tsx src/contexts/__tests__/roomExportBuilder.test.ts src/contexts/__tests__/roomExportBuilder.transfer.test.ts --maxWorkers=1 --silent` passes all 25 tests across three suites. The offline client settings let existing builder suites import the service without a configured project.
- Type check: `npx tsc --noEmit --pretty false` reports 454 errors across 33 existing files. Neither changed TypeScript file has a diagnostic; the existing builder test fixture errors and unrelated legacy suites prevent a repository-wide pass.
