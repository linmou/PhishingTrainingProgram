# Integration Verification: component 102 promotion

Intent: record the gate results that justify promoting the merged component 102 state, so
`integration_passed` rests on named evidence rather than on a narrative claim.

Tested integration SHA: `64ae8aa`

## Gates run on the tested SHA

| Gate | Command | Result |
|---|---|---|
| E01 edge handoff (`101 -> 102`) | `node --import ./tools/ts-resolve.mjs --test tests/integration/transfer-domain-backend.test.mjs` | exit `0`, `tests 7 / pass 7 / fail 0` |
| End-to-end aggregate | `node --import ./tools/ts-resolve.mjs --test tests/e2e/transfer-assessment.test.mjs` | exit `0`, `tests 3 / pass 3 / fail 0` |
| Component suites in integration | `CI=true npx react-scripts test --watchAll=false --testPathPattern="(transferAssessment\|transferTutor\|transferMigration\|tutorDecisionContract\.transfer)"` | `9 suites / 72 tests` pass before the projection merge; `11 suites / 196 tests` for the combined 101+102 set |
| Type check | `npx tsc --noEmit` | clean for every touched file; pre-existing unrelated errors unchanged |

## What the edge handoff proves

`tests/integration/transfer-domain-backend.test.mjs` imports component 101's real
`resolveTransferAnswer`, executes it, and passes the produced object into component 102's real
`TransferAssessmentService.toPublicAssessment`. The consumer receives the actual upstream
artifact, so `upstream_output_consumed` is true and no synthetic boundary stands in for the
producer.

## What the end-to-end aggregate proves

`tests/e2e/transfer-assessment.test.mjs` runs one teacher session across both components:
component 101's resolver grades a delivered answer on the real private assessment, and component
102's facade drives `prepare_turn`, `review_draft`, and `send_reviewed` in order through the
shared API contract, then asserts the published learner payload contains no
`correct_option_ids`, no transfer basis, no raw model output, and no reviewed payload — checked
by key name and by value. A second case proves the teacher-private DTO carries the basis the
reviewer needs while the same storage row projected for a learner loses exactly those fields. A
third proves a rejected draft is suppressed on its trigger and superseded only by explicit
regeneration.

Only the network transport (the Edge Function call) is replaced. Every projection, the shared
private-field guard, and component 101's decision logic are production code.

## Deliberately not claimed

- **W3/W4 hosted behavioural evidence.** T009 PART 2 (P1-P19) has not run and requires a
  `service_role` connection this session does not have. Migration 029 is authored and
  unapplied. This verification covers the pure-TypeScript and integration surface, not deployed
  RPC behaviour.
- **The Edge Function deployment.** It routes to the two functions whose `digest` call migration
  029 repairs, so deploying before 029 is applied would produce runtime failures.
- **Smoke and browser release gates.** Those belong to component 105 and to the release edge,
  which is not active.

This verification therefore supports promoting component 102's merged state to its downstream
consumers. It does not support closing W3, W4, or any release milestone.
