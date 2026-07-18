# Intent
Record the 2026-07-18 addition of real product-path E2E tests for AI tutor behaviors fixed from prototype feedback.

## Date
- 2026-07-18

## Scope
- Added live E2E that builds the production `casual_peer` + Account Security Alert system prompt and calls `OpenAIService.generateResponse`.
- Added deterministic behavior heuristics for smoke scoring (not a replacement for Promptfoo LLM judges).
- Documented the new npm script and how it relates to the Promptfoo quality gate.

## Files Updated
- `claude_docs/testing-strategy.md`
- `../../evals/promptfoo/README.md`

## New code
- `src/services/tutorBehaviorHeuristics.ts`
- `src/services/__tests__/tutorBehaviorHeuristics.test.ts`
- `src/__tests__/tutor_behavior_e2e.test.ts`
- `package.json` script: `test:integration:tutor-behavior`

## Evidence
- Offline: heuristics unit suite 19 passed; E2E scaffold 2 passed without network.
- Live (`npm run test:integration:tutor-behavior`): 10/10 passed against real OpenAI-compatible API.
- Cases map to feedback items 1–6 and 8 from `user_feedback_improvement_summary.md` (items 7 and 9 remain product/UI scope).

## Notes
- Heuristics are intentionally strict enough to catch hollow praise, question chains, first-person fake stories, and vague caution, but allow defined jargon when simplified.
- Promptfoo remains the multi-case LLM-as-judge release gate.
