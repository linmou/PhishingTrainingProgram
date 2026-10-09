# Multi-agent Persistence Documentation Update

Intent: record the documentation change that aligns the AI assistant module with Multi-agent persistence behavior.

Date: 2026-09-13
Commit: 8e27d20

Updated `ai-assistant-module.md` to document that approved Riley and AI Tutor rows persist with `response_mode='multiagent'`, while character tags remain storage metadata decoded by the active message presentation resolver.

## Verification

- RoomContext approval suite: 8 tests passed, including one-row and two-row mode persistence.
- Presentation and decoder route suites: 43 assertions passed.
- Production build: passed.
