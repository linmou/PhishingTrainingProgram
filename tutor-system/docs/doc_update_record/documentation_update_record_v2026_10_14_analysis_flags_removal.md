# Item-event analysis contract update

Intent: record the approved analysis contract, assessment routing change, and evidence available for review.

Updated: 2026-10-14
Base commit: `80ed973608b3d568af8f103230a4e74605c003ef`
Release follow-up: applied and verified on staging and production on 2026-10-14, baseline commit `88b3ccd`. See the [final release record](documentation_update_record_v2026_10_14_final_assessment_release.md) for exact SQL/source hashes, versions, browser runs and limitations. The remaining sections preserve the earlier local-only evidence and status at that time.

## Decision and implementation

The user resolved the existing spec conflict with: “Remove the flags and their assessment blockers.”

`analyze_message` now requests and consumes `events` plus `explanation`. Combined private analysis also records `rejected_events`. The Edge Function preserves evidence, target, quote, type, and transition validation. The SQL release candidate validates the events array and limits assessment blockers to Guard, another open assessment, and required feedback.

The behavior specification, domain contract, backend contract/data model, evaluation specification, status contract, and QA guide reflect the same policy. Assessment readiness still requires accepted Partial → Covered `demonstrated_understanding`; direct Pending → Covered and spontaneous transfer complete without assessment.

The evaluator scores `raw_event`, `applied_state`, `assessment_route`, and `validity`. Current case labels use only the event and optional assessment expectation. H16, N06, R06, and V06 now explicitly expect assessment readiness. Historical reports retain their frozen metric sets; current execution requires a new freeze. Existing exposed holdouts are marked as regression cases.

Changed factors: analysis prompt/output shape, Edge/SQL validation, assessment blocker logic, metric inventory, and routing expectations. A structural audit verified unchanged target, learner text, dialogue, partition, pair ID, and event label across all 48 synthetic cases, plus all 20 ecological selections. Model settings and thresholds are retained.

## Verification

| Check | Result |
| --- | --- |
| Edge API tests, including production module Deno type check | 33 passed |
| Domain → Edge integration | 5 passed |
| Edge → UI handler integration | 3 passed |
| Evaluator through actual working-tree handler | 13 passed |
| Browser workflow harness tests | 11 passed |
| Progress and API contract Jest suites | 22 passed |
| SQL final-assessment lifecycle | 17 scenarios passed plus anon/authenticated permission checks |
| SQL status transitions and dialogue history | Both passed |
| Input/event-label integrity | 48 synthetic cases and 20 ecological selections preserved |
| Whitespace check | `git diff --check` passed |

Red evidence: the previous API rejected events/explanation responses without flags (six failures). The previous final-assessment SQL failed the assertion that stored protection metadata permits assessment. Green evidence: the revised API accepts that shape, and SQL prepares and delivers an eligible assessment with either stored flag true. Guard deferral/replay, required feedback, open questions, grading, recovery, invalid states, and replay remain covered by the lifecycle suite. SQL fixtures roll back.

The broader historical `transferAssessmentMigration.test.ts` still has two failures against an unchanged archived migration: a preflight substring assertion and a multiline REVOKE regex. Both the test and its migration remain identical to HEAD. Initial UI integration setup needed the explicit Deno config and dummy Supabase values; its final three tests pass.

Full command metadata, intermediate failures, SQL output, evaluator output, and changed-source hashes: [local validation evidence](../../../output/analysis-flags-removal-20261014/validation.json).

## SQL and release boundary

Candidate: [20261014000000_final_assessment_after_understanding.sql](../../supabase/archived_migrations/20261014000000_final_assessment_after_understanding.sql).
SHA-256: `fc9cbf8eb9a580db0f3f914dbcd3ef3431759615dc0c806d3dc69bbf30a6343b`.

Local PostgreSQL socket: `/Users/admin/.transfer-assessment-pg17/migration-validation/socket`, port `55433`; executor `postgres`. A new `analysis_flags_green_20261014` database was cloned from the retained `final_assessment_red_20261013` production-derived baseline, with source database ACLs and `app.settings.jwt_exp=3600` restored. The complete candidate applied in its own transaction before the tests. The Red check used `final_assessment_final_20261013`, which retains the earlier final-assessment implementation.

Local RPC checks establish behavior against the retained baseline. The subsequent [2026-10-14 hosted reconciliation](documentation_update_record_v2026_10_14_analysis_cleanup.md) inspected production through MCP and staging through the Management API, confirmed the old flag-dependent policy remains live, and archived the completed unified-room migration. Staging/production verification of the new candidate is outstanding under the [release workflow](../supabase-release-workflow.md).

No real model evaluation was run: this worktree lacks the historical production source snapshot and ecological export needed by the freeze command. The current harness was verified using injected structured responses through the actual handler. Staging and production remain undeployed.
