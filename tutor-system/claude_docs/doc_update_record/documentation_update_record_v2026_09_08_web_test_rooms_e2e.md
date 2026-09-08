# Documentation update record: web test-room E2E smoke run

Intent: preserve the real-browser test-room evidence, its fixture setup, and the boundary between UI/provider execution and the legacy quick-heuristic score.

Updated: 2026-09-08
Implementation commit ID: pending; recorded in Git history after commit.

## Scope

- Fixed the browser walkthrough race by waiting for the requested template option to arrive before reading the dropdown.
- Replaced invalid TypeScript shebang headers with comments so CRA/Babel can compile the production modules.
- Seeded the 15 global room templates through the repository's idempotent behavior-template seeder.
- Ran the browser flow against `http://localhost:3001` with candidate 11 active.

## Evidence

- Six `test_only` behavior-demo rooms were created and six AI suggestion boxes rendered.
- The run report preserves room IDs, suggestions, scores, errors, and screenshot paths: [report.json](../../../tmp/browser_demo_runs/report.json).
- The legacy quick-heuristic result was 4/6. The only two failures were `webpage_demo_correct_safe_action` and `webpage_demo_correct_lock_reasoning`; both failed the old `practical_knowledge` check because the learner had already supplied the safe action and the response progressed to a remaining target.
- `npm run build` passed after the header fix, with existing ESLint warnings only.

## Interpretation boundary

This is browser/provider/UI smoke evidence, not a replacement for the frozen v1 semantic evaluation. The old browser heuristic still encodes a stricter repeated-safe-action expectation than the current response-contract and learning-progression specification. The two failures remain visible for scorer refinement and are not silently waived.
