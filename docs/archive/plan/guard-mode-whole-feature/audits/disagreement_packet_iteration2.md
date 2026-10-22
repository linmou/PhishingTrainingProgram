# Final audit disagreement packet — iteration 3 scope

Artifact: `plan/guard-mode-whole-feature/draft_final_plan.md`

Claim: `draft_final_plan.md satisfies request.md as one coherent, executable plan, and every imported contribution is compatible and traceable to its source.`

Only criterion `c5` remains disputed after iteration 2:

| ID | Blocking | Criterion | Iteration 2 evidence |
|---|---|---|---|
| c5 | yes | Every material risk has an adequate validation or mitigation. | Two reviewers passed after the privacy repair; the strict reviewer required the student-read mechanism to be singular rather than “a safe view or RPC.” |

Repair applied before this round:

- Phase 3 step 15 now selects one concrete server boundary: a `student_messages` database view.
- Every student message read is routed through that view.
- The view exposes only message content, sender-safe identity, timestamps, and final response mode.
- Direct base-table raw audit access is revoked for student roles; only the view is granted.
- Direct-read denial and DOM tests remain required for every protected field.

Prior evidence to inspect:

- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit1_iteration1.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit2_iteration1.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit3_iteration1.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_iteration1_summary.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit1_iteration2.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit2_iteration2.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit3_iteration2.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_iteration2_summary.json`

Reviewers must address only c5, explicitly state which earlier points they accept or reject, and keep c1–c4 and c6 out of scope.
