# Multi-agent Tutor Profile Documentation Update

Intent: document the corrected profile behavior for stored Multi-agent messages.

Date: 2026-09-14

Updated documentation:

- `claude_docs/ai-assistant-module.md` now states that Riley uses the simulated Riley profile and a Tutor-tagged Multi-agent row uses the persisted tutor display name and avatar.

Implementation evidence:

- `src/utils/messagePresentation.ts` uses `baseName` and `message.avatar_url` for the Tutor character while keeping Riley synthetic.
- `src/components/__tests__/PostComment.test.tsx` passes with 9 tests, including tutor name/avatar and Riley avatar-isolation assertions.
