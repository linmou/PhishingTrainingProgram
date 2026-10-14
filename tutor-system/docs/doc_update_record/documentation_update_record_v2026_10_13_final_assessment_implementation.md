# Final assessment implementation

Intent: record implementation and verification of the approved Partial → Covered assessment trigger.

Date: 2026-10-13
Source baseline commit: `7737cfb7026910e53684c6ad739c2f3005af3f54`.
Policy authority: [user decision and principle provenance](documentation_update_record_v2026_10_13_final_assessment_provenance.md).
Status: local implementation and evaluation execution complete; model benchmark failed; hosted release pending.

## Implementation

The database derives an outstanding assessment from the latest effective trusted progress-history row: `demonstrated_understanding` with Partial/basic before and Covered/good after. Direct Pending → Covered and spontaneous transfer bypass assessment. Later no-change messages and tutor notes/priority edits retain readiness; contradiction, a changed target, or a terminal result ends the old readiness. Existing priority and lifecycle blockers still control preparation and delivery.

Assessment pass/fail is valid from Covered. Pass records evidence and terminal history exactly once even though the progress pair stays Covered. First incorrect leaves the question open; second incorrect moves the item to review. A later repair/full-understanding cycle produces fresh readiness. Delivery and answer validation include the readiness identity so a stale assessment cannot grade a replacement learning cycle.

Actual target/progress changes cancel obsolete open questions in both private lifecycle and public messages, allowing later development to produce a new question. Deferred Guard results also revalidate the delivered target/cycle. The event stores its target wording at acceptance so later target edits cannot reuse evidence for a different item definition.

Guard replay now treats the analysis-complete marker as metadata instead of replaying it as a learning event. New history timestamps use wall-clock insertion time so multiple transitions in one transaction retain causal order.

SQL artifact: [release candidate](../../supabase/migration-candidates/20261014000000_final_assessment_after_understanding.sql). On 2026-10-14, live reconciliation confirmed both older SQL changes are applied. Both were archived; direct understanding's failed production status workflow remains tracked in its release record. The candidate remains in `migration-candidates/` and has not been applied to staging or production. See the [reconciliation record](documentation_update_record_v2026_10_14_analysis_cleanup.md).

## Local database evidence

- Fresh configured export: `/Users/admin/.transfer-assessment-pg17/phishingtutor.dump`; roles: `source-roles.sql`. Export commands completed successfully on 2026-10-13.
- Target inspected directly with Supabase MCP: production `zgbufaxooqxeabewktzd`, PostgreSQL 17.4. MCP role is read-only; no hosted mutation was attempted.
- Local PostgreSQL 17.11, isolated socket `/Users/admin/.transfer-assessment-pg17/migration-validation/socket`, port 55433. Databases: `final_assessment_red_20261013`, `final_assessment_green_20261013`, and fresh final verification clone `final_assessment_final_20261013`; migration/test executor `postgres` (non-superuser, BYPASSRLS as source).
- Public/private schemas restored with ownership, grants and data from the fresh export. Seven affected/dependent baseline function definitions match the live MCP definitions exactly. Auth UID function was reproduced from live source; UUID and crypto extensions supply dump dependencies.
- Both database ACLs match source effective grants; both have `app.settings.jwt_exp=3600`. Local patch/platform differences remain a hosted-release verification concern; these local checks establish RPC behavior, not full hosted parity.
- Red: [RPC integration test](../../supabase/tests/final_assessment_after_understanding.sql) exits 3 against the baseline because initial partial evidence incorrectly makes a target eligible.
- Green: the expanded test passes all 17 lifecycle scenarios plus anon/authenticated permission checks and rolls back every fixture. Scenarios include direct knowledge, transfer, safety deferral across messages, Guard replay, first/pass/retry/failure paths, repair, contradiction, metadata edits, stale cancellation/recovery, and invalid-state rejection.
- Existing `transfer_status_dialogue_history.sql` also passes against the candidate database.
- Final replay: cloned the unchanged Red database, applied the complete candidate once as `postgres`, then passed both SQL suites. Exact final output is retained in `output/final-assessment-implementation-20261013/sql-final-results.json`.

Reproduce SQL checks with `/opt/homebrew/opt/postgresql@17/bin/psql -h /Users/admin/.transfer-assessment-pg17/migration-validation/socket -p 55433 -U postgres -d <database> -X -v ON_ERROR_STOP=1 -f <test-or-candidate-file>`, prefixed with `rtk proxy`. The candidate owns its transaction; tests use rollback.

## Application tests and evaluation

| Check | Result |
| --- | --- |
| Focused reducer/orchestrator/golden/BDD Jest suites | 175 passed |
| Deno API + domain/handler/UI integration | 41 passed |
| Node domain/service integration | 10 passed |
| Browser workflow harness unit tests | 13 passed |
| Strict scoped TypeScript | Passed |
| Whole-project TypeScript | 455 diagnostics; zero in changed domain/BDD files; no full baseline comparison claimed |
| Evaluation harness | 10 passed |

Exact application commands and output summaries: `output/final-assessment-implementation-20261013/validation.md`. Browser workflows were updated to develop Partial then full understanding; hosted browser execution belongs to release verification.

The [model evaluation record](../ai-behaviors/transfer-final-assessment-evaluation-record.md) reports fresh generations, routing and classification metrics, prompt changes, regression results, and separate acceptance limits. Model evaluation is separate from deterministic transition and persistence checks; historical model scores cannot establish conformance to the revised rule. Raw prompts, inputs, outputs, settings and comparisons are retained under ignored `output/transfer-analysis-eval-20261013/`.

The paired policy comparison improves route matches from 96/122 to 118/122, including the approved Pending/Partial boundary. The full benchmark fails: model misclassification of spontaneous transfer can still produce an unnecessary assessment. Two prompt clarifications were tested and rejected for regressions or missing the targeted fix; the original prompt is retained. Across all three experiments, 682 provider calls and 402 paired records are preserved. This commit records a verified deterministic change and measured model limitations, not model-quality or release acceptance.

## Review and documentation

Three independent reviews identified metadata-only edits clearing readiness, stale open questions blocking recovery, and missing snapshot validation during Guard replay. The implementation now handles each boundary and the SQL fixture exercises the failures and recovery. The metadata regression failed before its fix, then passed against the corrected candidate.

Aligned artifacts include the behavior/response contracts, domain state matrix and determinism contract, backend data/API/RPC contracts, room UI scheduling interpretation, executable BDD scenarios, evaluation plan/cases/report, browser fixtures, and Markdown QA guide. The Word QA copy is deferred at the user's request.

## Release boundary

Before hosted release, reconcile the existing migration queue, recheck baseline and role/extension parity on both projects, and follow staging-before-production SQL/Edge/application validation. Deploy the updated shared grading reducer with the Edge Function after its matching SQL. Existing open assessments under the old Partial-state policy and deferred events without target snapshots require an explicit release disposition; they cannot be treated as new-policy evidence automatically.
