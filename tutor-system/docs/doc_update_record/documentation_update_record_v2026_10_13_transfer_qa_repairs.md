# Transfer assessment QA database repairs

Intent: record the inspected causes, reproducible local checks, and staged release of the browser QA fixes.

Date: 2026-10-13. Implementation baseline: `bc4ba50`. Status: **staging SQL applied and verified; matching Edge/browser verification pending**. Production remains unchanged by this repair at this record's creation.

## Artifact and environment

- Candidate: repository-root `output/qa-transfer-remediation-2026-10-13/20261013000000_transfer_qa_repairs.sql`, SHA-256 `1f05bf8f41cf8c05a434c280fe3d65fbff65defdbb3492436919fabec9f48b35`. Keep this exact artifact until both hosted workflows pass, then archive it. Two older SQL files already present in `supabase/migrations/` have separate unfinished release records; this repair does not claim their earlier semantic validation passed.
- Production `zgbufaxooqxeabewktzd`: PostgreSQL 17.4, inspected through official read-only Supabase MCP with the refreshed token. Staging `ciubrzggdqesgvfkpolj`: PostgreSQL 17.6. Local isolated PostgreSQL 17.11, socket `/Users/admin/.transfer-assessment-pg17/migration-validation/socket`, port `55433`.
- Configured fresh `pd_dump.sh` and `scripts/database/pg_dump_roles.sh` succeeded. Application archive `/Users/admin/.transfer-assessment-pg17/phishingtutor.dump`, created 2026-10-13 00:10:19 EDT, SHA-256 `9e182dbd931ebcbf44a754d25db163c0132e609c594207f03793e54cf78412f5`; roles SHA-256 `e152cdd9c0c69e38d2e2bedcd19975913e72b1ca1dde4d88085dd39f75df3e6d`. Archive listing and decode checks passed.
- Resume evidence: `/Users/admin/.transfer-assessment-pg17/runs/transfer_qa_repairs/20261013_041019/local-and-staging-evidence.json`. Query files, captured production/staging catalogs, setup SQL, exact candidate, staging runner, and concurrency scripts are in repository-root `output/qa-transfer-remediation-2026-10-13/`.

## Observed causes and corrections

`initialize_transfer_checklist_v1` enabled its trusted-write flag after inserting the transfer checklist. A reused connection with an empty custom-setting placeholder raises `TRANSFER_CHECKLIST_WRITE_REQUIRED`; a fresh connection's null setting masked that ordering defect. Enable the flag before the checklist write and restore its previous value afterward.

`edit_room_checklist_v1` changed status without its required understanding pair, causing `INVALID_STATE_PAIR`. Transfer edits now maintain pending/none, partial-or-review/basic, and covered/good atomically. Understanding edits map back to the matching status; basic preserves needs-review when applicable. Excellent remains invalid for transfer progress. Notes-only edits now use the trusted RPC, allow clearing notes, and validate mixed text/notes updates before any write. Duplicated tutor requests return the authoritative current pair after verifying room ownership and item scope.

The new tutor-only `get_transfer_assessment_review_v1` returns the private key and transfer context with authoritative lifecycle, attempt count, and whether linked feedback remains due. SQL execute privileges are restricted to the service role, and actor plus assessment room ownership are verified inside the function. Public messages remain free of private answer data.

Assessment-linked text can now be persisted without option IDs for the trusted Edge parser. Grading still validates selected IDs and computes correctness in SQL. `cancel_transfer_assessment_v1` closes assisted attempts without grading, consuming an attempt, or changing progress. Cancellation and grading use the same room-then-assessment lock order. Prior accepted attempt results remain intact after cancellation; question lifecycle updates when assistance or target removal cancels the assessment.

## Baseline comparison and local validation

Restored `transfer_qa_baseline_20261013` matches production for every public/private function definition hash, owner and ACL; tables and RLS flags; indexes; policies; default ACLs; inspected constraints and triggers. UTF8, en_US.UTF-8 collation/ctype, database ACLs, and `app.settings.jwt_exp=3600` match. Source role attributes/configuration match. Role membership privileges match; the local bootstrap grantor differs from hosted supabase_admin, which is immaterial because the candidate does not grant/revoke role membership. Auth helper definitions/owners/ACLs were reproduced from live MCP.

The local pgcrypto 1.3 and uuid-ossp 1.1 implementations provide the same required functions and PUBLIC execute access; local extension ownership belongs to the bootstrap role. The candidate neither alters extensions nor depends on extension-owner privileges. Unused hosted monitoring, GraphQL, and vault extensions are outside this migration's dependency chain. PostgreSQL patch and platform differences do not change the tested core PL/pgSQL, row-lock, JSON, or constraint operations. Staging differs from production only in three unused legacy v1/v3 function definitions among the inspected application objects; all affected current routines match the baseline.

The initial restore stopped because template0 already contained an empty public schema. Resuming with only the already-created public/private schema CREATE entries omitted completed successfully; ownership and ACL comparisons then passed. An initial disposable green database setup attempted a restricted database setting under postgres; that database is excluded from final evidence. The final clone reapplied database settings under the bootstrap role and database grants under postgres, then verified both before applying the candidate under non-superuser postgres with its own BEGIN/COMMIT transaction.

Red on the restored baseline reproduced initialization `TRANSFER_CHECKLIST_WRITE_REQUIRED`, status `INVALID_STATE_PAIR`, notes `ITEM_VALIDATION_FAILED`, missing private-review RPC, and rejected text-assisted posting. Final Green on a fresh clone `transfer_qa_final_20261013` passed:

- `transfer_assessment_qa_regressions.sql`: same learner in two rooms, initialization retry, paired status edit, observer rejection.
- `transfer_assessment_qa_edit_review.sql`, with `PGOPTIONS='-c qa.scenario=...'`: status, notes, review, raw_grade, assisted, assisted_retry. Covers valid/invalid updates, atomic rollback, private-read denial for learner/other tutor/anon/authenticated, terminal feedback acknowledgement, raw answer replay, cancellation with zero or one accepted attempt, and preservation of prior retry history.
- Existing `transfer_status_events.sql` and `transfer_assessment_terminal_faults.sql`: all eight injected terminal-write failures roll back and recovery succeeds.
- Two actual overlapping database sessions in `transfer_qa_green2_20261013`: cancellation-first versus pass-first. The waiting loser returns `CONCURRENT_MODIFICATION`; final states are cancelled with zero attempts, or passed with one attempt. No partial grade/cancellation combination persisted.

All psql assertions used `-X -v ON_ERROR_STOP=1` on port 55433 as postgres, with the fixture switching to actual application roles for the RPC/permission assertions. Transactional fixtures roll back; concurrency fixtures remain only in the disposable local database. Raw outputs and commands' inputs are retained in the resume evidence and SQL files.

## Staging application

Fresh MCP inspection at 2026-10-13 04:26:50 UTC confirmed staging schema fingerprints were unchanged. Root authorized staging application. The Management API accepted the exact candidate with HTTP 201 at 04:27:10 UTC. The seven rollback QA scenarios then succeeded with HTTP 201 at 04:27:54 UTC; assertion bundle SHA-256 `3a2855200b70a9809d0f8b037a445d0461dbfcc6bd723b47793b5c0f4fa819d5`.

Post-application MCP confirmed all eight affected/new function definitions, owners, and ACLs exactly match the tested final local database. Root owns the dependent Edge deployment and Chrome DevTools browser verification. Stop before production until that matching staging workflow passes; recheck production preconditions before applying this same SQL. No migration-history row is claimed from the raw Management API query operation.
