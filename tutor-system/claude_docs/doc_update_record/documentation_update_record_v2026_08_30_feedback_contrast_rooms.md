# Documentation update record — feedback contrast rooms

Intent: record the documentation changes for controlled Phase 0/refined webpage evidence.

- Date: 2026-08-30
- Base commit: `29ba240`; no commit was created during this change.
- Updated `claude_docs/aiService.md` with prompt provenance, version selection, fixed comparison controls, persistence, UI labeling, and capture rules.
- Updated `claude_docs/testing-strategy.md` with the six-room capture tier, artifact contract, focused 34-test evidence, and existing full-suite failures.
- No database migration is required; comparison metadata uses the existing JSONB `prompt_config` field.
