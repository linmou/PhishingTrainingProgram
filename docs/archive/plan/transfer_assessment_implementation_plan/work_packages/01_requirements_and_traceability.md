# W0: Requirements and Traceability

## Source

Original §§1-2, §17 W0, §19, and the `ai-behavior-design-eval` specification rules.

## Tasks

1. Keep the original handoff read-only and compare its hash before and after package edits.
2. Add transfer assessment as a numbered canonical behavior requirement (`T09`) rather than leaving it only as an implementation extension.
3. Align the v3 response contract, evaluation plan, prompt applicability audit, and BDD feature with the same requirement IDs.
4. Maintain `traceability_graph.md` as the only requirement mapping; do not create competing status ledgers.
5. Update the documentation record after implementation changes, not before evidence exists.

W0 artifacts:

- [Canonical T09 specification](../../../tutor-system/claude_docs/ai-behaviors/tutor-behavior-specification.md)
- [T09 response contract](../../../tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md)
- [T09 evaluation preparation contract](../../../tutor-system/claude_docs/ai-behaviors/tutor-behavior-evaluation-plan.md)
- [Legacy T09 applicability audit](../../../evals/promptfoo/audits/transfer-assessment-w0-20260911/applicability-audit.json)
- [Transfer assessment BDD feature](../../../tutor-system/features/transfer_assessment.feature)
- [W0 documentation update record](../../../tutor-system/claude_docs/doc_update_record/documentation_update_record_v2026_09_11_transfer_assessment_w0.md)

## Completion gate

W0 passes only when the canonical spec has T09, every existing case/assertion has a transfer applicability disposition, the traceability graph points to the same artifacts, and the documentation points to this package without claiming unrun evaluation.

## Verification evidence

Verified 2026-09-11:

- `shasum -a 256 plan/transfer_assessment_implementation_plan.md` matches the preserved source baseline: `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`.
- `node evals/promptfoo/scripts/generate-transfer-applicability-audit.js` completed with `43 cases / 173 assertions`.
- The generated audit records the unchanged legacy source hash, `not_applicable` for every T09 case and assertion, `preserved: true` for all 173 assertions, and `legacy_meaning_changed: false`.
- Static artifact checks passed for JSON parsing, required artifact paths, exactly one canonical `### T09`, all five T09 semantic metrics plus the deterministic supporting check, and eight `@T09` BDD scenarios.
- `git diff --check` passed for the W0 artifacts.
- Live Promptfoo evaluation, calibration, holdout execution, hosted database acceptance, and dedicated browser release acceptance remain explicitly pending; W0 does not claim those gates.
