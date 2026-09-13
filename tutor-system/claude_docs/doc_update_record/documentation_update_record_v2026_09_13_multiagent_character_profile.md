# Multi-agent Character Profile Documentation Update

Intent: record the correction that makes the rendered Riley and AI Tutor profiles match their decoded Multi-agent identities.

Date: 2026-09-13
Commit: uncommitted

Updated `ai-assistant-module.md` to clarify that valid Multi-agent tags select the complete character profile, including the author label and avatar identity, while the persisted tutor account avatar is not rendered for either Riley or AI Tutor.

## Verification

- Active-route Jest integration: 14 tests passed after Green, including non-null tutor avatar suppression for both characters, tag-free bodies, and a valid tag remaining literal in `tutoring` mode.
- Focused presentation/decoder regression: 4 suites and 55 tests passed.
- Real-browser DOM check: Riley and AI Tutor each rendered their own author/avatar identity, no tutor profile image, and no visible valid agent tag.
- Production build and `mypy src/services/test_aiService.py` passed.
- Full Jest regression retained the existing baseline of 29 failing suites and 129 failing tests, with 95 suites and 918 tests passing.
