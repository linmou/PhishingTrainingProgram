# Documentation Update: Transfer Status Dialogue

Date: 2026-10-03

Intent: record the status judge's new room-history input and current-message evidence boundary.

- Added `claude_docs/transfer-status-analysis.md` with the ordered dialogue input, speaker fields, and model output.
- Migration: `supabase/archived_migrations/20261003000000_room_dialogue_analysis_context.sql`, SHA-256 `450a99b070217954ae160e76f182fc50a7c4d056d5d559967327abe937997ccd`.

Validation on 2026-10-03:

- `deno test --no-lock --allow-env --allow-net --allow-run --unstable-sloppy-imports supabase/functions/assessment-api/index.test.ts`: 18 passed, 0 failed. The integrated cases assert setup and persisted speaker identity, focus cutoff, valid status application, and rejection of another learner's quote before the progress RPC. The suite also type-checks the Edge module.
- Fresh production schema dump: `/Users/admin/.transfer-assessment-pg17/runs/room_dialogue_history_20261003/phishingtutor.dump`, SHA-256 `4f5043e44822bf74d1e56a8eb221708f24117746aa9dd31d4cbcbc896166e80a`, PostgreSQL 17.4. The matching role export is in the same run directory.
- Red: `supabase/tests/transfer_status_dialogue_history.sql` failed on unchanged staging with `P0001: dialogue_history missing`; it failed for the same reason on disposable local database `room_dialogue_red_20261003_01` (psql exit 3). The test inserts a room with two setup speakers, another learner, a tutor, 20 persisted turns through the focus message, and a later tutor turn; its transaction rolls back.
- Green: the exact migration applied to disposable local database `room_dialogue_green_20261003_01`; the same SQL test passed (`BEGIN`, `DO`, `ROLLBACK`, psql exit 0).

Hosted results on 2026-10-03:

| Project | SQL and database test | Edge and application test |
| --- | --- | --- |
| Staging `ciubrzggdqesgvfkpolj` | Management API SQL application HTTP 201; rollback-backed SQL test HTTP 201; installed function MD5 `b77acbf0fd739272f4d7479323bed825`; test fixture rows remaining: 0 | `assessment-api` version 33 deployed with `--use-api`. `assessment-delivery` browser run `20261003192529-576d6641` passed: `analyze_message` and `prepare_turn` returned 200, assessment provider attempt was valid, and cleanup passed. Evidence: `tmp/browser_demo_runs/staging-template-20261003192529-576d6641/report.json`. |
| Production `zgbufaxooqxeabewktzd` | MCP DDL attempt failed with `permission denied for schema public` and changed nothing; Management API application of the same SQL returned HTTP 201. Rollback-backed SQL test returned HTTP 201; installed function MD5 matches staging; test fixture rows remaining: 0 | `assessment-api` version 3 deployed with `--use-api`. Replaced the absent fixture room with dedicated empty room `286de02f-30b0-46ee-8df3-17d1dae1ca89`, cloned from production transfer room `62a27ce1-90e5-4208-96d2-379e3aca2241` without its messages. First browser run `20261003201158-1c2acc39` exposed missing `OAI_API_KEY` and `OAI_BASE_URL` Edge secrets (503); cleanup passed. Set both secrets from the existing provider configuration. Rerun `20261003201506-2059bd0c` passed: `analyze_message` and `prepare_turn` returned 200, provider attempt was valid, the assessment was delivered and learner-visible, and cleanup passed. Evidence: `tmp/browser_demo_runs/production-template-20261003201506-2059bd0c/report.json`. |

The SQL and transfer workflow are verified in both projects, and the migration is archived. A `checklist-coverage` staging browser run failed because that workflow tests the separate `legacy_v1` path; its cleanup passed and it is not transfer-status evidence.
