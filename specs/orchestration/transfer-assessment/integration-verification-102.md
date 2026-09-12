# Integration Verification: component 102 promotion

Intent: record the gate results that justify promoting the merged component 102 state, so
`integration_passed` rests on named evidence rather than on a narrative claim.

Tested integration SHA: `9bab1e1`. The commit chain is `37b9cf2` (merge of `102-transfer-backend`
into `integration/transfer-assessment`), `2578ea5` (the author-role and dead-code fix), and
`c6bc632` (the spec and record reconciliation). The gates were run three times with identical
results: once on `2578ea5`, once on the clean tree at `c6bc632`, and once on `9bab1e1` after
`c933b4e` corrected migration 044's stored body, which moved the code SHA past the `c6bc632`
measurement. `9bab1e1` is the SHA propagated to components 103 and 104; it supersedes the
`c6bc632` record in this file and in `coverage-manifest.json`.

## Gates run on the tested SHA

| Gate | Command | Result |
|---|---|---|
| E01 edge handoff (`101 -> 102`) | `node --import ./tools/ts-resolve.mjs --test tests/integration/transfer-domain-backend.test.mjs` | exit `0`, `tests 7 / pass 7 / fail 0` |
| End-to-end aggregate | `node --import ./tools/ts-resolve.mjs --test tests/e2e/transfer-assessment.test.mjs` | exit `0`, `tests 3 / pass 3 / fail 0` |
| Component suites in integration | `CI=true npx react-scripts test --watchAll=false --testPathPattern="(transferAssessment\|transferTutor\|transferMigration\|tutorDecisionContract\.transfer\|assessmentApi)"` | `10 suites / 186 tests` pass for the combined 101+102 set |
| Hosted schema conformance | All 16 T009 PART 1 checks run against the hosted project | **16/16 pass**, measured twice: once with check 16 red before migration 044 was applied, and again with every check green after. Migration 044 is applied on hosted, so `post_assessment_message_v1` now stores the author's own role |
| Type check | `npx tsc --noEmit` | zero errors in every touched file; the repo's 508 pre-existing errors are unchanged and live in unrelated legacy test files |

Three `RoomContext.*` suites fail on this head. They are pre-existing and unrelated: with the
`RoomContext.tsx` and `types/index.ts` edits stashed, the same three suites fail with the identical
`13 failed / 14 passed`. They fail on room creation, image upload, and AI-config loading.

## What the edge handoff proves

`tests/integration/transfer-domain-backend.test.mjs` imports component 101's real
`resolveTransferAnswer`, executes it, and passes the produced object into component 102's real
`TransferAssessmentService.toPublicAssessment`. The consumer receives the actual upstream
artifact, so `upstream_output_consumed` is true and no synthetic boundary stands in for the
producer.

## What the end-to-end aggregate proves

`tests/e2e/transfer-assessment.test.mjs` runs one teacher session across both components.
Component 101's resolver grades a delivered answer on the real private assessment; component 102's
facade drives `prepare_turn` and `send_reviewed` in the only order the collapsed model allows and
asserts the transport saw exactly those two operations, with the reviewed payload on the second
call. There is no review round trip, because there is no draft row.

Two further cases cover the projection. One feeds the facade a response that still carries
`assessment_key` and asserts the allowlist drops it regardless, so the browser-side projection is a
second line of defence rather than a copy of the server's behaviour. The other asserts the public
message DTO keeps identity, content, and turn mode while dropping raw model output.

Only the network transport (the Edge Function call) is replaced. Every projection, the shared
private-field guard, and component 101's decision logic are production code.

## Deliberately not claimed

- **W3/W4 hosted behavioural evidence.** T009 PART 2 needs a `service_role` connection this session
  does not have, so A1-A10 were last executed and passing in an earlier session, and A11 (the new
  author-role case) plus the tightened A4 have not been run since migration 044 was applied.
- **Answer-key confidentiality.** The key lives on `public.messages`, which participants can read,
  so a crafted REST request reaches it. This is a recorded owner decision, not a guarantee, and
  lane case A3 asserts the exposure rather than hiding it.
- **Smoke and browser release gates.** Those belong to component 105 and to the release edge,
  which is not active.

This verification therefore supports promoting component 102's merged state to its downstream
consumers. It does not support closing W3, W4, or any release milestone.
