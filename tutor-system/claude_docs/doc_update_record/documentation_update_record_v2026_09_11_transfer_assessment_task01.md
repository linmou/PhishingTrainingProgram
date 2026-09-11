# Documentation update record: transfer assessment task 01

Intent: record the documentation change for the T09 boundary that prevents
grading an assessment answer before the question is delivered.

Date: 2026-09-11
Implementation commit ID: pending; changes are currently in the working tree.

## Changed documents

- `ai-behaviors/tutor-behavior-specification.md`: states that draft or
  undelivered questions do not enter grading, feedback, or progress mutation.
- `ai-behaviors/tutor-response-contract.md`: states that delivery is required
  before parsing and grading and that pre-delivery answers preserve progress.

## Verification boundary

The focused T09 test passes. The production build passes. The repository-wide
Jest and TypeScript checks retain unrelated existing failures; this record does
not claim a clean repository release gate.
