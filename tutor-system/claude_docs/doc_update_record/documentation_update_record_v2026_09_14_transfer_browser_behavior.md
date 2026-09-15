# Transfer Browser Behavior Documentation Update

Intent: record the browser-side transfer scheduling and lifecycle correction.

Date: 2026-09-14

Updated documentation:

- `claude_docs/ai-behaviors/tutor-behavior-specification.md` now describes one browser v3 call that classifies learner evidence and chooses the tutor turn.
- `claude_docs/ai-behaviors/tutor-response-contract.md` now documents `learning_evidence`, browser ownership, and the live lifecycle values used by the research build.
- `claude_docs/ai-behaviors/tutor-behavior-evaluation-plan.md` now maps the single v3 request to the Promptfoo evaluation boundary.

Implementation evidence:

- Transfer items begin as `pending/none`; only learner-owned evidence makes them assessment-eligible.
- The browser scopes focus messages and answers to the checklist owner, blocks unresolved or duplicate assessments, and records pass/fail evidence and history.
- The focused transfer test set passes with 42 tests; the production build passes with existing lint warnings.
