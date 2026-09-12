# Specification Analysis Report

**Intent**: Record the final non-destructive cross-artifact consistency audit for `spec.md`, `plan.md`, and `tasks.md` after task generation.
**Date**: 2026-09-11
**Scope**: `102-transfer-backend`

## Analysis Result

The reopened analysis identified four source-contract defects at HIGH severity. All four were remediated across specification, design, contracts, tasks, checklist, and verification guidance. **This report is dated and partly superseded.** The remediation of A3 introduced a capability that a later review removed again, so A3's disposition is no longer 'remediated' in the sense of surviving; see its row. A1, A2, and A4 remain valid. A subsequent precision pass constrained the reject reason and removed an ambiguous suppression field from the replacement DTO. The final read-only rerun found no remaining CRITICAL, HIGH, MEDIUM, or LOW findings.

| ID | Category | Severity | Location(s) | Summary | Remediation |
|---|---|---|---|---|---|
| A1 | Constitution/security | HIGH | `spec.md`, `plan.md`, `research.md`, API contract, tasks, quickstart | Planning prescribed Supabase Auth/bearer behavior despite the normative generic trusted-verifier rule | Replaced with injected `AssessmentPrincipalVerifier`, deployment-configured adapter, injected test verifier, missing-adapter disabled capability, and `AUTHORIZATION_NOT_CONFIGURED`; explicitly rejected an `auth.uid()` or sign-in contract |
| A2 | Cross-component contract | HIGH | `spec.md`, `plan.md`, provider contract, tasks | Production context was constructed independently instead of sharing the existing ecological request boundary with Promptfoo | Assigned versioned `TransferTutorRequestV3`/`TransferTutorRequestContextV3` and pure builders to `ecologicalTutorCall.ts`; production and component 104 consume them while prompt, credentials, and calls remain server-only |
| A3 | Incompleteness/lifecycle | HIGH | `spec.md`, `data-model.md`, API/RPC contracts, tasks, quickstart | Reject/regenerate behavior had no callable operations or atomic persistence contract | Added `reject_draft`/`regenerate_draft`, two versioned service-role RPCs, existing draft statuses, trigger key, suppression, supersession, idempotency, stale/race, provider-failure, and rollback behavior. **REVERSED 2026-09-12:** the whole capability was removed by the lean refactor (migrations 032/033) because it was traceable to this finding rather than to a source-plan requirement, no product requirement asked for a tutor-facing reject, and the same-trigger suppression could never fire because the draft-creation path never wrote the trigger key. |
| A4 | Terminology/privacy | HIGH | API contract and task projections | Private browser DTO used a noncanonical abbreviated name | Canonicalized all browser-facing references to `TeacherAssessmentDraftDTO` and kept `private.assessment_drafts` as an internal storage mapping |
| None | Final rerun | - | All planning artifacts | At the time of writing, no remaining cross-artifact inconsistency, coverage gap, unresolved placeholder, or constitution violation. SUPERSEDED 2026-09-12: the lean refactor removed six operations and several columns, so this rerun result no longer describes the package. See the A3 row. | No further remediation required |

## Requirements Coverage

| Requirement | Covered by | Notes |
|---|---|---|
| FR-001 | T002, T007, T025, T041 | Legacy/transfer policy and hosted schema |
| FR-002 | T027, T030, T032 | Four progress pairs and one authority |
| FR-003 | T003, T005, T010, T013, T019 | API operations, draft dispositions, and envelope |
| FR-004 | T006, T021, T024, T026 | Injected verifier, missing adapter, and body identity rejection |
| FR-005 | T011, T014, T023, T026, T036 | Public/private and secret boundary |
| FR-006 | T010, T012, T013, T014 | Review, reject/suppress, regenerate/supersede, revision, hash, confirmation |
| FR-007 | T010, T012, T030 | Atomic reviewed delivery |
| FR-008 | T016, T018, T020 | Stored-message exact grading |
| FR-009 | T016, T028, T018 | First answer and retry idempotency |
| FR-010 | T027, T030 | Causal event transaction |
| FR-011 | T027, T028, T031 | Guard/stale/error outcomes |
| FR-012 | T029, T031 | Immutable key and compensation |
| FR-013 | T012, T015 | Turn mode versus room mode |
| FR-014 | T016, T017, T020 | Feedback-first and no routine retest |
| FR-015 | T008, T033, T036 | Shared v3 request/context and 1,200-token production request |
| FR-016 | T034, T035, T037 | Bounded retry and error/truncation behavior |
| FR-017 | T006, T021, T024, T034, T042 | Missing-adapter/provider fail-closed capability and flag |
| FR-018 | T002, T007, T015, T041 | Hosted schema and generated types |
| FR-019 | T021, T022, T023 | Direct-write and authorization attack matrix |
| FR-020 | T043, T044 | Component/downstream evidence boundary |

## Success Criteria Coverage

| Criterion | Covered by | Evidence lane |
|---|---|---|
| SC-001 | T002, T007, T041 | Hosted schema and generated types |
| SC-002 | T006, T021, T022, T023, T024, T025 | Verifier configuration and authorization/RLS |
| SC-003 | T010, T012, T013, T016, T027, T028, T029, T040 | Draft/question lifecycle integration |
| SC-004 | T027, T030, T031 | Atomic causal history |
| SC-005 | T008, T033, T034, T035, T036, T037 | Shared contract and provider request inspection |
| SC-006 | T011, T023, T026, T035, T038 | Privacy and secret scans |
| SC-007 | T002, T022, T025, T041 | Legacy preservation |
| SC-008 | T040, T042, T043 | Disabled capability and downstream separation |

## User Story Coverage

| Story | Test tasks | Implementation tasks | Independent test signal |
|---|---|---|---|
| US1 | T010-T011 | T012-T015 | Review, reject/suppress, explicit regenerate, delivery, projection, rollback |
| US2 | T016-T017 | T018-T020 | Exact first-answer lifecycle |
| US3 | T021-T023 | T024-T026 | Configured/injected verifier and attack matrix |
| US4 | T027-T029 | T030-T032 | Hosted transaction/race/invalidation evidence |
| US5 | T033-T035 | T036-T039 | Shared versioned context, captured provider request, and bounded failures |

## Constitution Alignment

No violations remain. The package preserves the approved source hash, keeps identity/provider/persistence authority server-side, requires real boundary tests, uses explicit versioned contracts, and does not introduce a sign-in product, `auth.uid()` application identity contract, parallel mastery field, or feature activation. Root agent-context regeneration remains deferred to the integration owner.

## Unmapped Tasks

None. Setup, foundational, story, and polish tasks each map to a requirement, success criterion, evidence gate, or required handoff control. No task claims React UI, Promptfoo, or browser release evidence.

## Metrics

- Functional requirements: 20
- Buildable success criteria: 8
- User stories: 5
- Tasks: 44
- Completed specification checklist items: 19/19
- Requirement coverage: 20/20 (100%)
- Success-criteria coverage: 8/8 (100%)
- Ambiguity findings: 0
- Duplication findings: 0
- Constitution findings: 0
- CRITICAL findings: 0
- Reopened HIGH findings remediated: 4/4
- Remaining HIGH findings: 0
- MEDIUM findings: 0
- LOW findings after remediation: 0

## Next Actions

Proceed to implementation only after the integration owner accepts the component package and supplies any blocked hosted/verifier/provider prerequisites. Keep the capability disabled while a required evidence lane is pending, errored, or blocked. Do not run `update-agent-context.sh` from this component; that context update remains deferred to the integration owner.
