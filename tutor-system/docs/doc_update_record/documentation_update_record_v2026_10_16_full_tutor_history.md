# Full tutor conversation history

Intent: record the removal of truncated AI conversation context and verification in the affected room.

Date: 2026-10-16. Source baseline: `0e5c156fee9d1757b42a5db7beb93b3ee26a6993`. Scope: local frontend-service fix and user-authorized real-room verification. Existing hosted APIs/schema are reused.

## Change

`src/services/simplifiedAIContext.ts` previously selected messages oldest-first and then limited them to 15. In the affected iTunes room, that excluded the latest tutor link instruction while the learner's “Looks like it does” was supplied separately. The builder now loads the entire saved discussion in bounded database pages, preserving chronological order, scenario/pre-populated dialogue, role prefixes and simulated-character identity. Query errors propagate instead of returning partial or empty context as a successful lookup.

Review identified a moving-offset race if rows change between page requests. Final pagination uses a `(created_at, id)` cursor so earlier deletions cannot shift the next page's position. Equal timestamps use the ID tie-breaker. No database migration or Edge Function source change is needed.

## Real-room verification

The user authorized removing the latest erroneous tutor reply `4a5b7b1c-18a7-428f-82fe-53db3c530458` from room `8cafd448-386b-4391-b2e3-60dd842e4d80`. Its complete row and suggestion-feedback record were backed up in [the before-state snapshot](../../../_bmad-output/implementation-artifacts/investigations/room-8cafd448-latest-reply-before-regeneration.json). A guarded deletion removed exactly that ordinary tutor reply; all 24 preceding saved messages and the passed assessment remain. The old feedback audit is retained with its deleted-message reference cleared by the existing foreign key.

A headed Playwright browser opened `http://localhost:3001/`, used the room owner's application-managed tutor identity, and clicked the actual AI button. The real `/functions/v1/ai-api` request contained **28 history lines: four setup entries plus all 24 saved messages**, ending with the latest link instruction and the learner reply. Actual decoding was Qwen3.8 Flash, temperature 0.3, max_tokens 600, thinking disabled. HTTP response was 200 with finish_reason stop.

The first generated structured decision correctly stated that the learner mistakenly believes the bit.ly link is official and selected `tutoring/correction`. The generated response was:

> That is incorrect. The address 'bit.ly' is a generic shortener, not an official Apple domain. Do not click it; type apple.com directly into your browser instead.

The correction remains a review suggestion; no new tutor chat message was posted during verification. Raw request/response bodies and screenshots are preserved under `output/playwright/full-history-room-20261016/`, excluded from Git. No authorization headers, provider keys or browser session exports are included.

After the cursor patch, the browser was reloaded and the actual AI button clicked again. Requests 579/580 fetched all 24 rows, then an empty page after cursor `(2026-10-15T18:41:18.100194+00:00, cf667e30-7f02-41b7-8e6b-9ce5418183b2)`. AI request 582 returned HTTP 200, with the same 28 history lines and decoding settings. Its final decision was:

```json
{
  "reason": "Student incorrectly believes the bit.ly link is official. This is a misconception about URL verification. Correct the false inference and provide the safe action of checking the domain manually.",
  "decision": { "mode": "tutoring", "instruction": "correction" },
  "response": "That is incorrect. 'bit.ly' is a shortener, not Apple. Do not click it; type apple.com directly to verify offers."
}
```

Final raw evidence: `request-cursor.json`, `response-cursor.json`, `generated-correction-cursor.png` and `verification.json` in that output directory. Independent live SQL verified the old reply is absent, all 24 preceding messages remain, and assessment `16f7e57d-f99b-4ab3-a392-21098a7184d6` remains passed.

## Validation and limits

Final focused Jest validation passed **15/15 tests**, covering late turns, 1,000/1,007-message pagination, exact boundaries, smaller server caps, formatting, failures, and earlier-row deletion between pages sharing one timestamp. Changed-file TypeScript diagnostics were zero; repository-wide tsc reported 452 existing diagnostics outside these files. Three independent code reviews found no remaining actionable issues after the cursor patch. Both real generations demonstrate the corrected input and interpretation; they do not establish broad model conformance.

Focused command from `tutor-system/`: `rtk npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/simplifiedAIContext.test.ts src/services/__tests__/aiContextIntegration.test.ts`.
