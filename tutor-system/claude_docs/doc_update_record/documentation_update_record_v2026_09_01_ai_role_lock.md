# Documentation update record: AI role lock

Intent: record the documentation change for the student-facing AI role label
and the tutor-side configuration lock delivered on 2026-09-01.

## Updated documents

- `tutor-system/claude_docs/ai-assistant-module.md`

## Changes

- Documented the student `AI role` control and its Peer/Adult choices.
- Documented persistence of `student_tone_lock` metadata for single-student,
  AI-enabled rooms.
- Documented that tutor Quick Adjust and regeneration cannot override the
  persisted role.
- Documented the disabled/multi-student availability gate.

Code feature commit: `b15be6e` (`feat(ai): lock tutor role to student choice`).
The documentation record is committed immediately after that feature commit.
