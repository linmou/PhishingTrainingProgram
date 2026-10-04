# Direct Understanding Status Release Record

Intent: preserve the source, tests, live event observations, and rollout state for the direct `pending` to `covered` path.

Date: 2026-10-04 UTC
Source commit: `3c0234901429081210aa3129c99a4eb1b3ad1696` plus uncommitted changes
Status: production SQL and Edge applied; assessment verified; transfer-status event gate failed

## Open issue: broad target credit

The 18-target staging recording at `tmp/browser_demo_runs/staging-template-20261004081925-833cb9a1/` showed one safe-action learner message producing 12 `demonstrated_understanding` events and 3 `initial_signal` events. The quote did not name several credited target steps, including URL-domain inspection and login-activity review. The browser run passed its selected status and assessment checks, but its overall progress count was not a measure of classification accuracy. The production sync must carry this issue as open until a fresh live run and a human-calibrated target-by-target evaluation establish the remaining error rate.

The current Edge candidate adds a prompt instruction against crediting unstated steps and rejects action-type evidence for `detection_area` items. This cannot validate the model's semantic explanation or prevent mislabeling an action quote as another evidence type. Record the new staging and production counts below without treating a passing browser workflow as resolution of this issue.

The revised candidate reduced the first safe-action message to 2 covered targets in both staging and production assessment runs. This one-message observation does not establish accuracy across other responses. A second issue remains open: after a contradiction, the learner's reasoned application to a delivery alert was classified as `post_repair_signal` rather than `spontaneous_transfer` for the original account-check target in two production runs. The stored target therefore remained partially covered instead of returning to covered. The same test passed once on staging and failed once there before the learner message was strengthened; model variation and the overlap between repair and transfer need further evaluation.

## Evidence and changed factors

Production learner evidence was reviewed in `output/production-learning-coverage-2026-10-03/review.md` before editing. The prompt requires item-specific learner evidence: an explanation component for partial understanding, the essential explanation for full understanding, or a sufficiently specific action for an action target. The response contract adds `demonstrated_understanding` for direct `pending` or `partially_covered` to `covered/good`; `spontaneous_transfer` remains distinct for a materially different situation. The Edge Function makes one concurrent provider call per target, accepts only supported events, and records well-formed but unsupported proposals under private `rejected_events`. The SQL accepts the new event and retains the existing event paths. Provider call count now scales with the number of active targets, increasing usage cost; concurrent calls limit added latency.

The final seven-message browser input/output records, including exact learner messages, combined model events, rejected proposals, Edge responses, private inbox rows, persisted progress, and screenshots, are at `tmp/browser_demo_runs/staging-template-20261004054301-95f3553b/` and `tmp/browser_demo_runs/staging-template-20261004054407-a7be0e20/` from the repository root. Both test related action and explanation targets in one checklist:

| Learner evidence | Model and stored event | Persisted status |
| --- | --- | --- |
| Independent account check in the official app | `demonstrated_understanding` | `covered/good` directly from `pending/none` |
| Names urgency and fear but not the credential outcome | `initial_signal` | `partially_covered/basic` |
| Explains fake sign-in page and password theft | `demonstrated_understanding` | `covered/good` from partial |
| Calls a familiar-looking sender link safe | `contradiction` | `needs_review/basic` |
| Applies independent verification to a delivery alert after the account-warning discussion | `spontaneous_transfer` | `covered/good` from review |
| Asks about weather | Empty event array | No change |
| Calls an official-looking logo enough to trust the account link | `contradiction` | `needs_review/basic` |

All seven `analyze_message` Edge responses were HTTP 200 in each final run. Each workflow and room cleanup passed; screenshots are in the corresponding run directory. The first safe action covered only its action target while the separate explanation target remained `pending/none`. In both runs, Qwen proposed an action-based `initial_signal` for the explanation target; the Edge Function recorded `EVIDENCE_TYPE_MISMATCH` and omitted it. The later explicit urgency explanation produced `initial_signal`, followed by direct full understanding. Earlier diagnostic runs under `tmp/browser_demo_runs/staging-template-20261004*/` include failures from missing fixture setup, trusted item-write requirements, inferred explanations, and transfer labeling; each reported fixture cleanup `pass`.

The multi-target diagnostics exposed a material limitation in Qwen's raw proposals: it sometimes treats a safe action as partial explanation evidence despite the prompt's counterexample. A repeat of the older six-message flow (`20261004051553-66a7875e`) also labeled changed-scenario evidence `demonstrated_understanding` for a separate bank target rather than `spontaneous_transfer`. Per-target calls and the evidence-type guard resolved the tested overcredit at the stored-progress boundary. The guard cannot prove semantic accuracy if a model incorrectly labels an action quote as `explanation`; wider human-calibrated evaluation remains necessary.

## Local database validation

Baseline dump and role export: `/Users/admin/.transfer-assessment-pg17/runs/direct_understanding_status/20261004_01/`; dump SHA-256 `c8ceb83f1c4ca00c764bf1220bb24b9fdfed3ac0db195aa125a5da043ac6b2e2`. The isolated PostgreSQL 17.11 cluster uses socket `/Users/admin/.transfer-assessment-pg17/migration-validation/socket`, port 55433. The fresh red and green databases are `direct_status_red_20261004_01` and `direct_status_green_20261004_01`, with restored source database ACLs and dependencies. Production PostgreSQL was 17.4; staging was 17.6.

The red restore matched production on 23 public/private relations, 36 functions, 34 policies, 436 messages, 494 checklist items, function-definition hash `828722d9099baf9d31e41b156a30de12`, and policy hash `667908de89ec8b2708686f289f51209f`. Staging had the same catalog counts and hashes before application. Both projects had pre-change `apply_learning_event_v1` hash `c7803da0db521b41f5fb98a53b1ef5bf` and `apply_transfer_message_analysis_v1` hash `83544bb7dd70e8e5d5baa923a08ed9cb`.

The exact pending migration is `supabase/migrations/20261004000000_direct_understanding_status.sql`, SHA-256 `d6e8075ec28bf5aafae2d68cf673c839b9447f00c3d0538c62df5dc0a045798c`. Running `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/transfer_status_events.sql` as `postgres` on red exited 3 with `AI_OUTPUT_INVALID` at the new event. Applying the migration as `postgres` with `--single-transaction` on the fresh green restore exited 0. The same six-step SQL test then exited 0 as both `postgres` and `service_role`; its fixture transaction rolled back, leaving 436 messages and 494 checklist items. The two green function hashes were `b075de953345976f44413d2d04683e6b` and `31b6325873b580ab6a3c76f328925d6d`. `anon` and `authenticated` lack RPC execute permission; `service_role` has it.

## Code and staging checks

- `deno test --allow-all --unstable-sloppy-imports supabase/functions/assessment-api/index.test.ts`: 21 passed, including current-message grounding and unsupported-event recording.
- `npm test -- --watchAll=false --runTestsByPath src/services/__tests__/learningProgressTransitions.test.ts`: 14 passed.
- `npm run test:e2e:unit`: 15 passed.
- `npm run build`: passed with existing lint warnings outside changed modules.
- `npx tsc --noEmit --pretty false`: fails on pre-existing test typing errors; none reported in the modified modules.
- `git diff --check`: passed.

Staging project `ciubrzggdqesgvfkpolj` received the exact SQL through its Management API database query endpoint, returning `[]` without error. Post-application function hashes match green, and `anon`/`authenticated` execute permissions are false while `service_role` is true. Required Edge secret names were present. `assessment-api` was deployed using the API bundler with JWT gateway verification disabled for the existing offline-session model; its observed staging version is 45, updated 2026-10-04 05:42:46 UTC. Edge source SHA-256 is `68b79d73241b2f83e4aca059e57f7208fb279aea7d1f96eb58ac6452627d349d`. The browser workflow source SHA-256 is `357df99277780ae2a3f3d3b4d8a6e2091a2c3341eae820e8f364e8c9ba845e42`. The Management API application did not create a `supabase_migrations.schema_migrations` entry; the latest observed staging entry remains `20260929035556`.

## Production sync and verification

On 2026-10-04, the revised `assessment-api` source SHA-256 `edba687447b0f089ac96740ed83216f4496cf06ccd2890483c424e536f5abbf8` passed 22 Deno tests. The extra local guard test rejects action-only evidence for a detection area. Staging's existing SQL function hashes were `b075de953345976f44413d2d04683e6b` and `31b6325873b580ab6a3c76f328925d6d`; the revised Edge source was deployed by `supabase functions deploy assessment-api --project-ref ciubrzggdqesgvfkpolj --no-verify-jwt --use-api`, without Docker. Staging reports `staging-template-20261004091409-e27d341e` (assessment pass, 18 targets, first message 2 covered, partial target covered after assessment, cleanup pass) and `staging-template-20261004091728-0519efbe` (seven status observations pass, cleanup pass). The earlier status run `staging-template-20261004091531-4285c7e4` failed at transfer versus repair classification and cleaned up.

Production project `zgbufaxooqxeabewktzd` was rechecked before applying SQL: the two function hashes were the pre-change values above; `anon` and `authenticated` lacked execute permission, `service_role` had it, and the dedicated fixture room had zero messages, sessions, and checklists. The exact SQL file SHA-256 `d6e8075ec28bf5aafae2d68cf673c839b9447f00c3d0538c62df5dc0a045798c` was applied through the Management API database query endpoint, returning `[]`. The resulting function hashes match staging, with the same execute permissions. The same Edge source was deployed by `supabase functions deploy assessment-api --project-ref zgbufaxooqxeabewktzd --no-verify-jwt --use-api`; the observed production function is active version 7 with JWT gateway verification disabled.

Production report `production-template-20261004092127-b2c3ec80` passed assessment delivery with all 18 targets, 2 direct-understanding events from the first learner message, a partial target changed to `covered/good` after a learner answer, and cleanup pass. Reports `production-template-20261004092019-396feaef` and `production-template-20261004092219-0f22d35e` failed the `spontaneous_transfer` assertion because the model returned `post_repair_signal` for the account-check target; both cleaned up. A final production query confirmed zero fixture messages, sessions, checklists, and private learning events. The migration remains under `supabase/migrations/` because the required production status workflow did not pass. No Management API migration-history entry is claimed.
