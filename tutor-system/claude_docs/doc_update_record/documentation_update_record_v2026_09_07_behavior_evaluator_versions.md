# Documentation update — behavior specifications and versioned evaluators

Intent: record the committed behavior-design and evaluator-preparation artifacts, their validation, and what remains unimplemented.

Date: 2026-09-07
Pre-change commit: `ba95540`.
Change commit: the Git commit containing this record; no self-referential commit hash is embedded.

## Scope

- Added the behavior documentation set and its index links: constitution, canonical specification, former-filename pointer, response contract, evaluation plan, and clearly scoped historical case/evaluation reviews.
- Kept 12 unique requirement IDs. T01 owns instructional-action eligibility/realization; T02 owns learning-state/target selection; G02 owns participation correction without mandatory task/safety content.
- Documented the designed `reasoning` and `decision.instruction` fields alongside existing `mode`, `mode_reason`, and `suggested_response`. Production migration is pending.
- Preserved 11 legacy Markdown rubrics and two deterministic scripts as byte-identical v0 snapshots. Retained their existing entrypoints and all 43 existing cases / 173 assertions unchanged.
- Added v1 semantic rubrics, separate deterministic mode/action/contract checks, and manifests. LLM-facing Markdown contains judging instructions, criteria, and examples only; bookkeeping is in the manifest.
- Included the historical offline snapshot/verification files required by the historical review links, without changing their claims, and the new local v1 check-validation evidence.

## Validation

- `rtk proxy node --test --experimental-test-coverage evals/promptfoo/rubrics/v1/decision-metrics.test.js`: 13 tests pass; the new deterministic checker has 100% line, branch, and function coverage.
- Tests cover independent scoring on the same output, valid-but-wrong decisions, allowed sets, null versus missing instruction, malformed output, missing/invalid labels, reasoning serialization order, exact v0 preservation, v1 hashes, and clean rubric text.
- Documentation/source-hash checks retain 12 unique requirement IDs and the 43-case / 173-assertion legacy inventory.
- [Preserved local validation](../../../evals/promptfoo/audits/tutor-v1-checks-20260907/validation.json) is evaluator-logic evidence, not model-conformance evidence.

## Boundaries

No production prompt/parser/UI migration, active Promptfoo config/gate switch, live target/judge call, constitutional-priority revision, or experimental specification version is included. Calibration, full v1 case audit/coverage, independent holdouts, and comparable baseline/candidate runs remain pending. Unrelated workspace changes are excluded from this commit.
