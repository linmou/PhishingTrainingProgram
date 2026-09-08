# Documentation update record: candidate 11 production integration

Intent: record the documentation changed with the candidate 11 production-prompt integration and its evidence boundary.

Updated: 2026-09-08
Implementation commit ID: `dce8611c1d196b4baed505b05f3ed3c97adacd05`

## Changes

- Updated the response contract using the skill's response-contract template: the same six top-level sections, the v2 object, field order/dependencies, grounded tutor categories, retry behavior, evaluation boundary, and deployment mapping.
- Recorded candidate 11 as the human-selected production integration while preserving the automated gate's failed verdict and pending release checks.
- Documented the v2-to-existing-product adapter: `decision.mode` to `mode`, `reason` to `mode_reason`, and `response` to `suggested_response`.
- Marked `decision.instruction` as validated but not yet separately displayed or persisted.
- Updated the suggestion-tracking description and documentation index to match the implemented boundary.

## Verification evidence

- Candidate 11 production constant matches `evals/promptfoo/v1/candidate-policy-11-contract-v2.md` exactly after trimming; enforced by a focused Jest test.
- The production request includes scenario, full packaged history, latest learner contribution, and actual room participation mode.
- The v2 parser rejects malformed, incomplete, invalid-enum, wrong-order, null-in-tutoring, and legacy-field objects; one format-repair retry remains.
- Application production build passed with existing warnings.
- Six focused Jest suites passed: 42 tests covering prompt parity, request packaging, prior mode, parsing, repair, and provider transport.
- Four local Node evaluation suites passed, including the simulated-user engine and deterministic mixed-decision checks.
- Repository-wide TypeScript still reports its pre-existing test backlog; this update does not claim that check as clean.

## Evidence boundary

The frozen candidate 11 benchmark failed the complete formal gate despite passing ordinary percentage thresholds for most primary metrics. The responsible human explicitly selected candidate 11 after reviewing those results. This records a human release exception, not retroactive benchmark acceptance. Live provider and browser/downstream verification remain pending.
