# Analysis cleanup and hosted migration reconciliation

Intent: distinguish deployed SQL from incomplete release verification, and record the remaining assessment/evaluation cleanup.

Release follow-up (2026-10-14, baseline commit `88b3ccd`): the final-assessment SQL and flag-removal Edge source have since been applied and verified on both environments; SQL is archived. See the [final release record](documentation_update_record_v2026_10_14_final_assessment_release.md). The reconciliation below records the earlier state; it is historical.

Updated: 2026-10-14. Base commit: `80ed973608b3d568af8f103230a4e74605c003ef`; changes uncommitted.

## Hosted inspection

Production `zgbufaxooqxeabewktzd` was inspected through Supabase MCP (`get_project_url`, `list_migrations`, `execute_sql`, `get_edge_function`, `list_edge_functions`). This MCP connection is project-scoped. Staging `ciubrzggdqesgvfkpolj` was inspected at `2026-10-14T19:42:08.426Z` through the Management API database-query endpoint, using the existing configured credential and `read_only: true`.

Both projects returned the same `md5(pg_get_functiondef(oid))` values:

| Public function | Definition MD5 | Current result |
| --- | --- | --- |
| `apply_learning_event_v1` | `760327557c0c0db21b511a3136ce81ae` | Includes demonstrated understanding and shared room ownership |
| `apply_transfer_message_analysis_v1` | `31b6325873b580ab6a3c76f328925d6d` | Direct-understanding release definition; still contains both analysis flags |
| `join_room_v1` | `bd595fdaf41743ebfccc464fd5c603f1` | Unified room learner-seat function |
| `initialize_transfer_checklist_v1` | `a5109cfc94b1d3635db0303c72133503` | Shared room checklist initialization |
| `edit_room_checklist_v1` | `47dde15e05bb0d09ed59f6aec74e5086` | Shared room checklist editing |
| `prepare_transfer_assessment_context_v1` | `ef5c295cabcbd75a68c7edf6458507a6` | Still contains both flag blockers |

Both projects have the unique index `sessions_one_active_learner_per_room` on `public.sessions(room_id)` with predicate `status = 'active'::session_status AND student_id IS NOT NULL`. Both migration-history tables contain only `20260929035556 / remote_schema`. The October release records document direct database-query application, which did not register migration-history rows; an absent row therefore does not mean unapplied SQL.

Production `assessment-api` is active version 9, bundle SHA-256 `712d042e73f3e01adc6fe96a38c75cd2dca67f3e67f5812f2f1b7b5a9d1bb29c`. Its retrieved source still requests, validates, and aggregates the two flags. The flag-removal candidate is not deployed. No hosted writes or deployments were performed during this reconciliation.

## Migration disposition

- `20261005000000_unified_room_progress.sql`: already applied on both projects. Its [release record](documentation_update_record_v2026_10_04_unified_room_progress_v2.md) records passing hosted assertions and completed release checks. Moved unchanged to `supabase/archived_migrations/`. SHA-256 remains `abc57d1336a8a632df1b16a5ba912d5ecb347db1a5a2fcf1fdd488edbb4ac7d1`.
- `20261004000000_direct_understanding_status.sql`: already applied on both projects, with its learning-event function subsequently replaced by unified room progress. Following the user's archive request, moved unchanged to `supabase/archived_migrations/`. SHA-256 remains `d6e8075ec28bf5aafae2d68cf673c839b9447f00c3d0538c62df5dc0a045798c`. Its [release record](documentation_update_record_v2026_10_04_direct_understanding_status.md) retains the unresolved production transfer-versus-repair classification issue. Do not replay it as an unapplied migration: it would replace the newer shared-room learning-event function. The pending migration directory is now empty.
- `20261014000000_final_assessment_after_understanding.sql`: remains in `supabase/migration-candidates/`; final-assessment policy and flag removal require a new staged release. Live function inspection confirms the old flag-dependent policy is still present.

The [release workflow](../supabase-release-workflow.md) normally requires passing verification on both projects before archival. The user requested archival of the applied October 4 SQL after reviewing its verification status. This disposition separates the applied SQL history from the unresolved model-classification issue; it does not claim that the failed workflow now passes.

## Cleanup and validation

The BDD scenario now describes the actual Guard-mode deferral. The eligible-assessment scenario names Guard, open assessment, and feedback blockers and explicitly starts without an unresolved assessment. The old fixture silently started with an open assessment. Guard golden-fixture descriptions now match the mode-based behavior.

The evaluator loads both historical refinement rounds by default: 20 ecological + 10 development + 16 original holdout + 5 sequence + 22 revision cases = 73. Previously evaluated holdouts are exposed regressions in both comparison modes. The fresh-holdout option rejects previously used IDs. Human provenance review is still required for newly authored cases.

Changed factors: BDD setup and assertions, fixture descriptions, evaluation case inclusion/exposure accounting, and migration-file placement. No model prompt, gold event label, threshold, or hosted schema was changed in this cleanup follow-up.

| Validation | Result |
| --- | --- |
| `rtk proxy node --test evals/promptfoo/transfer-analysis/evaluate.test.cjs` | 15 passed, including actual Edge-handler/reducer integration and all prior-round holdout rejection checks |
| BDD Jest suite, dummy Supabase URL/key, `--watchAll=false --runInBand --silent` | 18 passed |
| First full BDD run | 17 passed, 1 failed because the eligible fixture had an unresolved assessment; corrected before the passing run |
| TypeScript `tsc --noEmit --pretty false` | Repository-wide failure; compiler API reports 455 diagnostics, zero in the two changed TypeScript files |
| Default case inventory | 73 cases; all 22 revision cases loaded and marked ineligible for unseen-holdout claims |
| Archive integrity | SQL SHA-256 identical before/after move |
| `git diff --check` | Passed |

Remaining exact flag-name references outside historical archives are deliberate regression inputs in the SQL/evaluator tests. The historical ecological export and source snapshot needed for a full model-evaluation freeze are still absent from this worktree; no new model evaluation was run.

Validated source SHA-256 values:

Commit-readiness follow-up on 2026-10-14: review found one contradictory final instruction in the analysis prompt still requesting four fields and boolean flags. It now requests exactly the two current fields, `events` and a nonempty `explanation`. The Edge API suite passed all 33 tests, including Deno type checking, and the evaluator suite passed all 15 tests after this correction. The baseline plan's historical five-metric table remains historical evidence; its current-policy table specifies the four active metrics. No model-quality or hosted-release acceptance is claimed from these injected-response tests.

| File | SHA-256 |
| --- | --- |
| `evals/promptfoo/transfer-analysis/evaluate.cjs` | `ecb29fec66b91eee0d075ef7d414ffacc550d7dc217c2b12fd2c1b20ca6ef560` |
| `evals/promptfoo/transfer-analysis/evaluate.test.cjs` | `76ff382961839e13e12a4204201a6087dff45591a896150c2338db208cd0c216` |
| `tutor-system/features/transfer_assessment.feature` | `e4b800095f720f53a99030b74235a1ff22b9b2f4b4a95c7de352902d7b8b4bb1` |
| `tutor-system/src/__tests__/transfer_assessment.bdd.test.tsx` | `4e21515ac7536ba5cb90fb914a106d94d373d39ee1772cac0b9f0f5773683fb4` |
| `tutor-system/src/services/transferAssessmentGoldenFixtures.ts` | `68e683f91a4077ae76e495675c53d06e4ac5dce73e40866955e133606e7a31fb` |
