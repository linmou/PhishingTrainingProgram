# Intent
Record the June 9, 2026 documentation updates for the tutor prompt behavior quality gate and production prompt change.

## Date
- 2026-06-09

## Scope
- Documented the Promptfoo quality gate used before changing the production tutor prompt.
- Documented which user feedback items are covered by prompt-only changes.
- Documented evidence from the accepted Promptfoo run for reviewer inspection.

## Files Updated
- `claude_docs/aiService.md`
- `../../evals/promptfoo/README.md`

## Evidence
- Promptfoo eval id: `eval-EFn-2026-06-09T18:40:25`
- Cases evaluated: 34
- Tokens: 110,899
- Errors: 0
- Gate result: passed
- Threshold: at least 80% for every metric and no regression against the current prompt on any metric

## Notes
- Prompt-only work covers repeated question loops, indirect correction, unstable persona, generic praise, vague safety advice, fake personal testimonials, and over-complex language.
- UI latency/typing indicators and multi-bot simulation are explicitly outside this prompt-only gate.
