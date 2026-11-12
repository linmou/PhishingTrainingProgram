# Document learning targets — issue #73

Intent: record the exact source, implementation, verification and remaining release work for the ten pilot templates.

Updated: 2026-11-12. Baseline commit: `33dede1`. Branch: `feat/issue-73-learning-targets`.
Issue: https://github.com/linmou/PhishingTrainingProgram/issues/73
Release owner and repair owner: root Codex agent for issue #73.

## Source and behavior

`General Learning Goals.docx` SHA-256: `fd0a0f49106e1b37795886dc39f974c3e99758e0007df5c2b0ba5d730dd6655b`.
`src/services/generalLearningGoals.json` contains all 33 distinct knowledge points, preserving their complete title, explanation, action text and document order.
The six phishing/privacy scenarios contain 5, 5, 5, 4, 4 and 5 points; all four cyberbullying templates use the same five document points.

The frontend scenario catalog supplies new room configurations. SQL migration `20261112000000_document_learning_targets.sql` replaces the six saved standard templates' detection inventories and corresponding system-prompt section. Existing prompt policy and template content remain intact. SQL rejects missing/ambiguous template inventories or malformed prompt boundaries atomically.

New cyberbullying checklists use `cyberbullying_doc_20261112`. Existing checklists keep their original version, target text, progress and evidence; validation resolves their version's catalog. The client displays revised cyberbullying targets in document order even when database timestamps tie. Existing room configurations and learner checklists are not rewritten by this template update.

## Verification

- Source-fidelity comparison: all 33 complete DOCX knowledge-point blocks match the JSON catalog exactly, including order; source hash matches.
- Catalog, template configuration, checklist context and cyberbullying export tests: 44 tests passed across four suites before the ordering fix.
- After the ordering fix: cyberbullying service/export and ChecklistPanel transfer integration tests passed, 34 tests across two suites. The added case returns records in reverse order with identical timestamps and verifies document order and preserved evidence after reading/export.
- Production build compiled successfully with existing warnings, including after the ordering fix (`main.35ad6000.js`). Strict `CI=true` build fails on warnings in unchanged ImageUpload, useChecklist, RoomPagePost, imageUpload and parameterConfig files. These warnings are not accepted as a waiver of CI requirements.
- Combined SQL integration passed on a disposable clone of `exit_baseline_20261031_2354`: real room joining, initialization, analysis application, evidence preservation, idempotence, version protection and anonymous static catalog reads. Six explicitly synthetic legacy prompt fixtures verify exact catalog installation, preservation of every unrelated template column/configuration field and prompt prefix/suffix, idempotence including timestamps, and atomic rollback of both catalog and earlier template updates when the final template has a malformed boundary. Evidence lease: `/Users/admin/.transfer-assessment-pg17/runs/scenario-dLCfqG/lease.json`. This is diagnostic evidence, not fresh hosted-baseline parity.

SQL verification command (repository root): `rtk proxy node scripts/database/disposable-database.js --template exit_baseline_20261031_2354 -- /opt/homebrew/opt/postgresql@17/bin/psql -X -v ON_ERROR_STOP=1 -f tutor-system/supabase/tests/document_learning_targets.sql` (exit 0).

## Hosted release status and resumption

**Not deployed; staging blocked.** Production SQL inspection succeeded. Staging `ciubrzggdqesgvfkpolj` rejects database authentication through Supabase MCP (`postgres`, SQLSTATE 28P01), Management API read-only query (`supabase_read_only_user`, HTTP 400), and normal Management API SELECT (`postgres`, HTTP 500). No hosted mutation was performed.

Resume owner: root Codex agent for issue #73. Next action: restore staging database access, acquire the shared staging lease, obtain a fresh baseline, and complete the documented migration parity/acceptance sequence. Apply SQL before releasing the dependent frontend. Require independent review, CI and staging acceptance before merging into `no_sign_up`; production artifacts must match the integrated release commit.

Staging and production acceptance must verify all ten template inventories against the catalog, unchanged posts/images/characters/dialogue, exact saved prompt sections for all six phishing/privacy templates, new learner cyberbullying initialization and document order, and successful subsequent updates to existing-version learner progress/evidence. Record deployed versions, candidate hashes, persisted checks and fixture cleanup here. Frontend deployment follows the repository release workflow after SQL acceptance. Issue #73 remains open until production acceptance completes.
