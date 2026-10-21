---
title: Final assessment after developed understanding
type: feature
created: 2026-10-13
status: done
baseline_commit: 7737cfb7026910e53684c6ad739c2f3005af3f54
context:
  - tutor-system/docs/ai-behaviors/transfer-status-response-contract.md
  - tutor-system/docs/ai-behaviors/tutor-behavior-specification.md
  - tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_13_final_assessment_provenance.md
---

<frozen-after-approval reason="User approved Partial-only policy and requested implementation and commit">

## Intent

Assessment currently starts when a learner has only partial understanding. The approved policy makes assessment the final application check after tutoring develops full understanding. Initial and repair signals continue tutoring. Only an accepted Partial → Covered `demonstrated_understanding` transition creates assessment readiness. A direct Pending → Covered response demonstrates existing knowledge and completes without a quiz. Spontaneous transfer keeps its direct-completion exception.

## Boundaries & Constraints

Keep per-target model calls and the events contract. Derive readiness from trusted before/after learning history and assessment lifecycle. Preserve evidence attribution, permissions, review-before-delivery, two attempts, replay idempotency, and protection/Guard/feedback priority. Keep outstanding readiness across deferral and later messages; contradiction or an invalidated target ends that cycle. Do not infer readiness from Covered alone. Scope is repository implementation, local validation, documentation and commit; hosted deployment is a separate release.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Required behavior |
| --- | --- | --- |
| Development | Pending + initial signal | Partial, tutoring continues |
| Understanding | Partial + demonstrated understanding | Covered, final assessment due |
| Existing knowledge | Pending + demonstrated understanding | Covered, complete without assessment |
| Transfer | Non-covered + spontaneous transfer | Covered, complete without assessment |
| Deferral | Due target plus safety/Guard/open/feedback blocker | Preserve due requirement, resume after blocker clears |
| Pass | Open assessment, covered target, correct either attempt | Apply terminal pass once, retain Covered, complete |
| Retry | First incorrect | Keep Covered and same open assessment |
| Failure | Second incorrect | Needs Review, tutoring resumes |
| Repair | Review + repair signal | Partial, no assessment until later full understanding |
| Contradiction | Covered/Partial + contradiction | Needs Review, invalidate prior readiness |
| Invalid scope/state | Foreign target/evidence or assessment from non-covered state | Reject atomically |

</frozen-after-approval>

## Code Map

- `tutor-system/src/services/learningProgressTransitions.ts`: shared pure progress authority used by Edge grading.
- `tutor-system/supabase/functions/assessment-api/index.ts`: message analysis and prepare-turn/answer handlers.
- Live `prepare_transfer_assessment_context_v1`, `send_reviewed_tutor_response_v4`, `apply_learning_event_v1`: scheduling, delivery and durable progression.
- `tutor-system/supabase/tests/`: real PostgreSQL RPC fixtures and permission checks.
- `evals/promptfoo/learning-progress-analyzer/evaluate.cjs`: baseline analysis consumer routing projection.

## Tasks & Acceptance

- [x] Update reducer and relevant grading fixtures/tests for terminal events from Covered, retaining applied pass even with unchanged fields.
- [x] Prepare SQL from inspected live definitions to use learning history for readiness; enforce delivery and grading state and lifecycle boundaries.
- [x] Add rollback-backed SQL integration coverage for the matrix and run Red then Green on fresh exported baseline.
- [x] Align executable BDD requirements, evaluation projection and focused tests with approved trigger.
- [x] Align domain/backend docs, QA guide and evaluation plan; preserve historical evidence. Word synchronization deferred by user.
- [x] Review changes, run type checks and affected test suites, record results and prepare the task-owned commit.

Given a full learning cycle, when each accepted message/result is processed, then target state and assessment eligibility follow the matrix. Given replay, invalid evidence or a delayed response, when processing repeats, then no duplicate terminal history or unintended assessment is created. Given an active assessment, when it passes without changing Covered, then its result is durably recorded exactly once. Given preexisting user changes, when committing, then unrelated files remain outside the commit.

## Design Notes

The existing checklist_updates ledger stores previous/new status and event IDs. Use this evidence to identify the current learning cycle without introducing a second progress flag. A same-pair assessment pass must still write evidence/history. SQL is sourced from live MCP inspection; local migration history supplies packaging context only.

Tutor notes and priority edits preserve readiness and an open question. An actual target or progress change invalidates the old question and cancels it without consuming an attempt, allowing a later valid learning cycle. Deferred terminal grading must validate the original target and cycle before replay.

## Review Record

Three independent reviewers found metadata-history invalidation, stranded stale questions, and missing snapshot validation during Guard replay. These are implementation patches under the existing valid-evidence and recovery requirements. Regression fixtures cover metadata before/after delivery, cancellation/recovery, and stale deferred grading. Independent re-review found no remaining introduced SQL defects. Model evaluation additionally exposed spontaneous transfer being classified as direct understanding. Two prompt clarifications were evaluated and rejected for missed behavior or regressions; the original analysis prompt is retained. The evaluation record distinguishes successful deterministic implementation from unresolved model conformance.

## Verification

Run focused Jest reducer/orchestrator/BDD tests, Deno handler checks, TypeScript checks, and PostgreSQL rollback-based integration tests. Record local baseline provenance, command outcomes and remaining release checks in a dated documentation record. Commit only after review and relevant checks pass, or explicitly report any environment limitation with reproducible evidence.

Completed: 175 Jest, 41 Deno, 23 Node/browser-harness, 10 evaluation-harness checks, and 17 real SQL lifecycle scenarios plus role checks passed; scoped TypeScript passed. The real-model evaluation completed three experiments with 682 calls. Its benchmark failed and both prompt candidates were rejected; the original prompt remains. Local task completion does not confer model acceptance or hosted-release readiness. The [implementation record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_13_final_assessment_implementation.md) and [evaluation record](../../tutor-system/docs/ai-behaviors/transfer-final-assessment-evaluation-record.md) preserve the evidence and limitations.

Release follow-up (2026-10-14, baseline commit `88b3ccd`): the inherited SQL and matching assessment-api are now deployed and verified on staging and production, with full-inventory browser delivery, option-answer/retry/failure, and cleanup evidence. The exact SQL is archived. See the [release record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_final_assessment_release.md). This hosted workflow verification does not change the failed semantic benchmark result.

## Suggested Review Order

**Policy and persistence**

- Read the approved boundary and its upstream rationale.
  [transfer-status-response-contract.md:99](../../tutor-system/docs/ai-behaviors/transfer-status-response-contract.md#L99)
- Trace readiness from accepted before/after evidence.
  [20261014000000_final_assessment_after_understanding.sql:12](../../tutor-system/supabase/archived_migrations/20261014000000_final_assessment_after_understanding.sql#L12)
- Check stale-question cancellation and preserved metadata edits.
  [20261014000000_final_assessment_after_understanding.sql:139](../../tutor-system/supabase/archived_migrations/20261014000000_final_assessment_after_understanding.sql#L139)
- Verify terminal grading and deferred replay use the correct learning cycle.
  [20261014000000_final_assessment_after_understanding.sql:373](../../tutor-system/supabase/archived_migrations/20261014000000_final_assessment_after_understanding.sql#L373)

**Shared behavior and evidence**

- Confirm pass records an applied result while retaining Covered.
  [learningProgressTransitions.ts:48](../../tutor-system/src/services/learningProgressTransitions.ts#L48)
- Inspect the revised routing oracle and preserved classification checks.
  [evaluate.cjs:48](../../evals/promptfoo/learning-progress-analyzer/evaluate.cjs#L48)
- Review real RPC lifecycle and permission regression scenarios.
  [final_assessment_after_understanding.sql:89](../../tutor-system/supabase/tests/final_assessment_after_understanding.sql#L89)
- Assess local test results and remaining release boundaries.
  [documentation_update_record_v2026_10_13_final_assessment_implementation.md:1](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_13_final_assessment_implementation.md#L1)
- Read real-model comparisons and their acceptance limits.
  [transfer-final-assessment-evaluation-record.md:1](../../tutor-system/docs/ai-behaviors/transfer-final-assessment-evaluation-record.md#L1)
