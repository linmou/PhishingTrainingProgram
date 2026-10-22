# Final audit disagreement packet — iteration 2 scope

Artifact: `plan/guard-mode-whole-feature/draft_final_plan.md`

Claim: `draft_final_plan.md satisfies request.md as one coherent, executable plan, and every imported contribution is compatible and traceable to its source.`

Only these disputed criteria are re-audited:

| ID | Blocking | Criterion | Iteration 1 dispute |
|---|---|---|---|
| c3 | yes | Dependencies and sequencing form one feasible execution order. | One reviewer found the room/progression owner conditional and frozen too late; two reviewers accepted the discovery step. |
| c4 | yes | Every imported contribution has a source and insertion point and is compatible with the backbone. | Two reviewers found source provenance insufficient; one found an explicit incompatibility because the draft did not identify its bounded event-sourcing import. |
| c5 | yes | Every material risk has an adequate validation or mitigation. | One reviewer found the student read boundary insufficient because raw audit fields were stored with messages; two accepted the original RLS/DOM controls. |

Repair applied before this round:

- the rooms row is now explicitly the single Guard projection and Phase 0 settles it before contract freeze;
- an Imported contribution crosswalk names candidates 2–4, their contributions, insertion points, and rejected event-sourcing parts;
- raw audit fields are moved to tutor-only records, student messages use a safe projection/view/RPC, and direct-read tests are required.

Prior evidence to inspect:

- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit1_iteration1.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit2_iteration1.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_audit3_iteration1.json`
- `plan/guard-mode-whole-feature/audits/guard-mode-whole-feature_green_iteration1_summary.json`

Reviewers must address only c3, c4, and c5, explicitly state which earlier points they accept or reject, and keep c1, c2, and c6 out of scope.
