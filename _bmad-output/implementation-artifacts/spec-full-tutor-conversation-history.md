---
title: Load the full tutor conversation and verify the real room
type: bugfix
created: 2026-10-16
status: done
baseline_commit: 0e5c156fee9d1757b42a5db7beb93b3ee26a6993
context: []
---

<frozen-after-approval reason="User explicitly requested this implementation and real-room cleanup/regeneration">

## Intent

The context builder reads the oldest 15 saved messages, excluding the tutor instruction that gives the latest short learner answer its meaning. Load all saved messages in chronological order so the AI responds to the actual current conversation.

## Boundaries & Constraints

Preserve scenario setup, pre-populated dialogue, role formatting and character decoding. Fetch paginated database results to cover rooms beyond the server response cap. This is a browser-service change; existing server contracts are reused. User authorizes removing the latest erroneous tutor reply in room `8cafd448-386b-4391-b2e3-60dd842e4d80` and regenerating through the real app. Preserve a before-state snapshot and capture the actual outbound AI request and full structured response. Existing conversation and prior assessment history remain.

## I/O & Edge-Case Matrix

| Scenario | Input | Required result |
| --- | --- | --- |
| Real room | 24 saved messages before the erroneous reply | Include all 24, particularly the latest link instruction and learner reply |
| Long room | More than one database page | Include all pages once in deterministic chronological order |
| Empty room | No saved messages | Preserve scenario/pre-populated context |
| Page boundary | Exact multiple of page size | Read the final empty page and terminate |
| Query failure | A page fails | Do not pass an apparently complete partial history to the model |

</frozen-after-approval>

## Code Map

- `tutor-system/src/services/simplifiedAIContext.ts`: database retrieval and context formatting.
- `tutor-system/src/services/__tests__/simplifiedAIContext.test.ts`: context builder cases.
- `tutor-system/src/services/__tests__/aiContextIntegration.test.ts`: downstream context integration.
- `tutor-system/src/services/aiService.ts`: actual prompt enrichment and generation caller, used for live verification.

## Tasks & Acceptance

- [x] Load all saved messages with bounded pages and deterministic ordering.
- [x] Update existing mocks and add structural regressions for late turns, pagination, empty results and page errors.
- [x] Run focused Jest checks and relevant static verification.
- [x] Snapshot and remove only the latest erroneous tutor reply, regenerate through localhost:3001 and retain actual request/response evidence.
- [x] Update the nearby context documentation with verified results.

Given a room longer than 15 messages, when the AI suggestion is requested, then its outbound history contains every saved message including the latest tutor instruction immediately preceding the focus reply. Given the real room after removing the stale reply, when generation completes, then inspect the full reason/decision/response against the current learner statement. Semantic failure remains a recorded live result rather than a passing implementation claim.

## Verification

Run focused context Jest suites. Verify the real browser request uses the actual current room prompt/progress, token budget and complete history. No deployment is needed for this local frontend-service request; no backend source/schema change is planned.

Result: 15/15 focused tests pass; changed-file TypeScript diagnostics zero (452 unrelated repository diagnostics). All three review roles cleared the final cursor patch. Manual browser generation retained all24 saved turns plus4 setup entries and returned tutoring/correction about the learner's mistaken Apple-link belief. Old erroneous reply removed after backup; no replacement chat message posted. Exact request/response/screenshots are in `output/playwright/full-history-room-20261016/` and the durable narrative is in the documentation update record.

## Suggested Review Order

- Read every saved turn without a moving row offset.
  [simplifiedAIContext.ts:34](../../tutor-system/src/services/simplifiedAIContext.ts#L34)
- Reject failed context queries before generating a suggestion.
  [simplifiedAIContext.ts:109](../../tutor-system/src/services/simplifiedAIContext.ts#L109)
- Verify late turns, boundaries and cursor stability.
  [simplifiedAIContext.test.ts:86](../../tutor-system/src/services/__tests__/simplifiedAIContext.test.ts#L86)
- Confirm the real request and full structured response.
  [documentation_update_record_v2026_10_16_full_tutor_history.md:15](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_16_full_tutor_history.md#L15)
