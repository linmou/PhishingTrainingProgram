## Intent
Record the March 26, 2026 documentation updates for AI assistant config persistence so future changes can be traced to the code path that now persists structured Quick Adjust state.

## Metadata
- Date: 2026-03-26
- Scope: `aiService.md`, `ai-assistant-module.md`
- Commit ID: pending at record creation time

## Changes
- Documented that `rooms` stores AI enablement, model, and rendered prompt text.
- Documented that `ai_assistant_configs` stores durable structured config fields such as `prompt_config`, `temperature`, and `max_tokens`.
- Documented that runtime config is reconstructed by merging room fields with persisted extended config.
- Documented that Quick Adjust role changes, including switching to peer role, are now intended to survive reloads.

## Evidence
- Service tests cover merged reload behavior and structured config persistence.
- UI tests cover rehydration of AI Assistant Settings and Quick Adjust selectors from persisted config.
