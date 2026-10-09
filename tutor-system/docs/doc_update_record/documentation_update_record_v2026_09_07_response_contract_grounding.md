# Documentation update — response-contract grounding and decision order

Intent: record the template and tutor-contract alignment, its validation, and the boundary of this documentation change.

Date: 2026-09-07
Pre-change commit: `6cbe7280b979b587045add144669f687005116b2`.
Change commit: the Git commit containing this record.

## Changes

- Updated the AI behavior skill and response-contract template: default `reason` and `response` fields need no separate definitions; decision fields and categories include upstream references and derivation logic.
- Updated the [tutor response contract](../ai-behaviors/tutor-response-contract.md) with `decision.mode` before `decision.instruction`, category boundaries and grounded definitions, and the `reason` / nested `decision` / `response` example.
- Confined specification edits to [C01](../ai-behaviors/tutor-behavior-specification.md#c01-response-contract-and-decision-reasoning). C01 owns serialization mappings for existing behavioral references; other requirements retain their meanings and text.
- Defaulted invalid output to one format-repair retry, then a visible failure, grounded in the existing `aiService.ts` limit and error path. Retain invalid attempts and retry outcomes as evaluation evidence.
- Updated the documentation index. Existing unrelated working-tree changes are excluded from this commit.

## Verification

- The skill's `quick_validate.py` passed using `uv run --with pyyaml`.
- All 42 local links and anchors in the skill entrypoint, template, and project contract resolve; both JSON examples parse and use the designed fields and ordered decisions.
- A snapshot comparison confirmed that all specification text outside C01 is byte-identical to its pre-task contents, preserving pre-existing edits.
- `git diff --check` passed.

## Implementation boundary

This is a contract-design and documentation update. The deployed `mode`, `mode_reason`, and `suggested_response` parser remains documented separately. Prompt, parser/repair instructions, persistence, UI, and evaluator migration require implementation and a fresh comparable evaluation before acceptance. No production behavior or model-conformance test is claimed by these documentation checks.
