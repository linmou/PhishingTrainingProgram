# Multi-agent Deprecation Documentation Update

Intent: record the production and documentation changes that retire Multi-agent generation while preserving historical records.

Date: 2026-09-27

Updated `ai-assistant-module.md` and `ai-behaviors/tutor-response-contract.md` to state that Multi-agent generation is deprecated, its learner choice and dedicated test-room template are hidden, saved settings use the single-agent request contract, and historical tagged messages remain readable.

## Verification

- Focused regression suites: 8 suites and 106 tests passed.
- Production build: passed with existing lint warnings unrelated to this deprecation.
- Repository TypeScript check: 513 errors across 46 files; no diagnostics matched the files changed for this update.
