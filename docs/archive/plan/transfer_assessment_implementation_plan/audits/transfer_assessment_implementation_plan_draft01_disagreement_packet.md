# Draft01 Disagreement Packet

## Scope

Re-audit only the disputed criteria from draft01 after the evidenced repair. Unchanged criteria c1, c2, and c5 are out of scope for this round.

## Disputed criteria

- **c3:** clarify that evaluation contract preparation occurs before prompt/runtime edits, while live evaluation follows runtime integration; preserve audit-before-implementation and schema/security-before-client ordering.
- **c4:** make every candidate import's source, insertion point, and compatibility rule explicit in the index.
- **c6:** remove the duplicate gate-status register by making milestone_ledger.md the only status authority; retain gate files only for criteria/evidence and planning-workflow audit artifacts.

## Repair evidence

- draft_final_plan.md now has an explicit import trace table and separates contract freeze from live evaluation.
- draft_final_plan.md now states that the original handoff is normative, the graph maps requirements, and the ledger owns status.
- verification_gates.md no longer has a Current status column and explicitly defers status to the milestone ledger.
