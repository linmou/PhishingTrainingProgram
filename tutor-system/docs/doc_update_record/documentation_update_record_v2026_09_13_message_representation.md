# Message Representation Documentation Update

Intent: record the documentation changes for the role, tutor-turn mode, and Multi-agent tag hierarchy.

Date: 2026-09-13
Commit: uncommitted

Updated `ai-assistant-module.md`, `database-schema.md`, and `ai-behaviors/tutor-response-contract.md` to document:

- `user_role` as the base presentation and AI-context identity;
- message-level `response_mode`, including `assessment` and `multiagent`, while room participation remains `tutoring | guard`;
- Multi-agent-only Riley and AI Tutor tag decoding and `response_mode=multiagent` persistence;
- retained model/timing export diagnostics without visible model or timing chips; and
- removal of the legacy AI-generation column through migration `046_refactor_message_representation.sql`.

## Verification Record

- Feature-focused Jest run: 11 suites passed, 113 tests passed.
- Explicit test-discovery meta-validation: 1 suite passed, 11 tests passed.
- Python static check: `mypy src/services/test_aiService.py` passed with no issues.
- Production build: completed with existing ESLint warnings.
- Coverage run: 94 suites passed, 29 failed, and 9 skipped; 912 tests passed, 129 failed, and 141 skipped. Aggregate coverage was 57.01% statements, 55.56% branches, 57.61% functions, and 57.59% lines.
- Final full Jest regression: 94 suites passed, 29 failed, and 9 skipped; 913 tests passed, 129 failed, and 141 skipped. The extra passing test relative to the coverage run verifies observer badge styling. Remaining failures are in existing repository mock, dependency, route-fixture, prompt-scaffold, storage, and pre-populated-context debt.
- Standalone legacy Python unit test: 14 tests ran with 6 pre-existing errors in its async and update mocks; the representation fixture cleanup introduced no additional error.
- Migration execution: not run because the local Docker daemon was unavailable. Static migration contract tests passed, and no hosted Supabase migration was applied.

The strict TDD production-refactor audit is intentionally not claimed as complete because concurrent protected test edits invalidated its immutable phase boundary.
