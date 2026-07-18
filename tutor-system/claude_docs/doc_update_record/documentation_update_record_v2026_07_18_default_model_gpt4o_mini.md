# Documentation update record — default AI model gpt-4o-mini

**Date:** 2026-07-18  
**Commit (at write time):** pending (working tree)

## Intent

Record that product and docs treat **`gpt-4o-mini`** as the default AI model (`DEFAULT_AI_MODEL`), not `gpt-4o`.

## Docs changed

| File | Change |
| --- | --- |
| `claude_docs/aiService.md` | Default model listed as `gpt-4o-mini` |
| `claude_docs/database-schema.md` | Example default model `gpt-4o-mini` |
| `features/ai_assistant.feature` | Default selection/status uses GPT-4o Mini |
| `features/ai_openai_integration.feature` | Room config example + model table includes mini as primary |

## Code alignment (non-doc)

- `DEFAULT_AI_MODEL = 'gpt-4o-mini'` in `aiService.ts` (already)
- Fallbacks in `TutorView`, `TestRoomsView`, `simplifiedAIContext`, `demoRoomTemplates` use `DEFAULT_AI_MODEL`
- Test fixtures updated from sample `gpt-4o` to `gpt-4o-mini`
- `gpt-4o` remains a selectable entry in `AI_MODELS`
