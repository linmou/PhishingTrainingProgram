# Full tutor response history: local experiment

Intent: record the requested reason-limit removal and replay of complete tutor output in subsequent model requests.

Updated: 2026-11-14. Source baseline: `e3e8697513d52561438e7212ddb443ef962104df` plus the existing local task-meaning candidate.

The user requested two changes before a quick rerun of prior failures: remove the literal `At most 40 words of ` from both `reason` examples in the active prompt, and include the complete structured tutor output in subsequent model history. No learning-target field or additional target-analysis prompt instruction is introduced. The generation token budget still applies.

## Model history

Ordinary tutor suggestion generation opts into reading existing `ai_suggestion_feedback` records. The context builder pages through accepted/modified records for the same room, matches the saved tutor message and tutor identity, and reconstructs the original `{reason, decision: {guard_mode, instruction}, response}` from the persisted fields. Accepted output is serialized in full. When wording or mode was changed during review, history labels the original AI suggestion and the actual posted response separately.

Manual messages and older records without a complete contract retain their posted text. Rejected, ignored, unlinked and mismatched records do not become delivered teaching. Assessment history keeps its existing authoritative result rendering. Other users of the common context builder retain the posted-text view; tutor metadata is requested only by the tutor suggestion path. An audit read failure or duplicate linked output surfaces an error rather than silently changing the experimental history.

The public message body and existing persistence operation are unchanged. This local implementation reuses stored feedback; it does not change the database schema or deploy a shared service. Live browser authorization and actual saved-room request replay have not been verified by these mocked checks.

## Verification

From `tutor-system/`:

```sh
rtk npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/tutorResponseHistory.integration.test.ts src/services/__tests__/simplifiedAIContext.test.ts src/services/__tests__/aiService.guardMode.test.ts src/services/__tests__/aiService.requestOwnership.test.ts src/services/__tests__/ecologicalTutorCall.test.ts
```

Result: 5 suites, 70 tests passed. Coverage includes complete JSON reaching final history serialization, human wording/mode edits, public-context isolation, unused/mismatched/incomplete feedback, manual messages, student attribution, feedback pagination, long reasons, read errors and ambiguous duplicates, alongside existing chronology, assessment readiness, request ownership and prompt packaging checks.

`rtk npx tsc --noEmit --pretty false` exited 2 with 436 errors in 37 files, including existing test typing problems. No diagnostics reference the changed runtime files or the new integration test. The touched existing `aiService.guardMode.test.ts` has an unrelated existing `Response` cast error at line 62. Python/mypy does not type-check these TypeScript changes.

Read-only localhost verification: `http://localhost:3107/` and `/static/js/bundle.js` returned HTTP 200. The served bundle contains `formatTutorResponseHistory`, the human-reviewed response label, and the new history-read error. It contains neither `At most 40 words of` nor `Module build failed`. The helper and new test use the project's commented shebang convention for CRA-consumed modules. This verifies the new source is compiled and served, not actual saved-room feedback-read authorization.

Behavioral quality is evaluated separately in the new experiment report. Passing these integration checks does not establish improved tutor progression.
