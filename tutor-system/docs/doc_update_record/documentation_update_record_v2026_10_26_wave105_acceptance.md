# Wave 105 acceptance continuation

Intent: preserve reproducible SQL and staging acceptance evidence for PR #29 and issue #28.

Updated: 2026-10-27. Original source baseline: `bfaa92661c29b6606be16ec25dc21b08d7e1fd22`; status reconciliation baseline: `18b3109`.

Current outcome: SQL integration and live staging privacy acceptance pass. The [public-configuration release](documentation_update_record_v2026_10_26_public_feature_flag.md) subsequently completed operational disable/history-preservation/restore acceptance and merged PR #29 through PR #37. Identity-spoofing/direct-write failures remain unresolved. The [October 27 continuation](documentation_update_record_v2026_10_27_wave105_completion.md) records current security results and remaining coverage. Dated checkpoint statements below preserve their original status and are superseded by these linked records.

## SQL fixture corrections

Actual execution exposed an unquoted reserved `current_role` identifier in the direct-role fixture, removed `active_response_mode`/`mode_change_source` columns in the lifecycle/result fixtures, and the current client-contract gate intercepting authenticated event-forgery checks. Quote the identifier, use `guard_mode`/`guard_mode_change_source`, and provide the explicit `cyberbullying-v2` request contract. Runtime code and migrations are unchanged.

## Disposable database results

Baseline: `realtime_publication_baseline_20261025_0335`, whose export/restore and catalog parity are recorded in the realtime-publication worktree's `documentation_update_record_v2026_10_24_realtime_publication.md`. This is an October 25 production-schema snapshot, not current staging acceptance. Each scenario uses the existing PG17 validation cluster and an independently allocated disposable clone. Execute as source-equivalent `postgres`; bootstrap execution initially exposed temporary-table ownership differences after a test's explicit role reset.

From the repository root, for each SQL file below:

```sh
rtk proxy env PG_VALIDATION_PSQL=/opt/homebrew/opt/postgresql@17/bin/psql \
  node scripts/database/disposable-database.js \
  --template realtime_publication_baseline_20261025_0335 -- \
  /opt/homebrew/opt/postgresql@17/bin/psql -X -v ON_ERROR_STOP=1 \
  -c 'SET ROLE postgres' -f tutor-system/supabase/tests/<file>.sql
```

| File | Observed result |
| --- | --- |
| `transfer_assessment_direct_roles.sql` | Exit 0; all 14 anon/authenticated checks return `42501`; authority/progress comparisons pass; transaction rolls back. |
| `final_assessment_after_understanding.sql` | Exit 0; all 17 lifecycle scenarios and anon/authenticated RPC permission assertions pass; transaction rolls back. |
| `assessment_result_messages.sql` | Exit 0; 16 saved-result cases pass, including write-fault atomicity, replay, terminal disclosure, Guard recovery and event forgery; transaction rolls back. |

Full command output, SQL SHA-256 hashes and exit codes: `output/pr29-resume-20261026/{sql-results.json,*.log}` in the `pr-29-resume` worktree. Allocator lease files named in each log confirm owned clone cleanup. Initial failed runs also cleaned their clones. No baseline/global-role changes were made.

## Local verifier results

`npm run test:assessment:audit`: 20 passed. `npm run test:e2e:unit`: 22 passed, including actual local HTTP/WebSocket instrumentation and browser interactions, with installed Playwright Chromium. Historical checksum checks pass. These checks do not establish hosted privacy or authorization.

## Staging acceptance

Intended target: `ciubrzggdqesgvfkpolj`. Selected checks: opt-in `assessment-security` and `assessment-privacy`, under the shared staging lease, with fixture cleanup and deployed Edge version observations. Read-only Management API key-access preflight returned HTTP 200. The available Supabase MCP connection targets production (`zgbufaxooqxeabewktzd`); it is not a staging connection.

Candidate `b549a8c69506e02253c98a7919e4ed08a3e62e4a` was exercised against `assessment-api` v77 and `ai-api` v7. Reports below are under `tmp/browser_demo_runs/` in the `pr-29-resume` worktree.

| Run | Observed result |
| --- | --- |
| `staging-template-20261026200035-f6be7a1e` | Security preflight failed on Management API SQL HTTP 502 before browser/fixture work; lease released. |
| `staging-template-20261026200039-3b1159f5` | Privacy failed before its first checkpoint. Initial cleanup hit HTTP 502 and retained the lease. Recovery under that exact lease verified all fixture tables empty and Guard fields restored, then released the lease; `output/pr29-resume-20261026/cleanup-recovery.json`. |
| `staging-template-20261026200146-0b3ec1c7` | Real security workflow completed: cross-learner, cross-room and legacy RPC passed; forged identity, direct writes and stale question failed. Both room cleanups, outsider profile cleanup and real Auth account/profile cleanup passed; lease released. |
| `staging-template-20261026200317-be441f93` | Privacy again failed before its first checkpoint; room cleanup passed and lease released. The original privacy catch hid the failing prerequisite, so the continuation adds a safe stage identifier without copying private exception bodies. |

The forged tutor `read_review` request returned HTTP 200 to an anonymous caller. Anon REST PATCHes changed persisted question result, lifecycle, selected options and public options; before/after state hashes differ. Authenticated-role variants also returned HTTP 200, while the trusted-event field checks were denied. Because successive probes target the same question, later no-change hashes do not independently establish protection for fields already changed by the anon probe. Both legacy RPC roles were denied. The stale-question response was not an accepted denial reason and remains a failing check. Full per-case/subcheck evidence is `assessment-security.json`, containing status codes and hashes rather than private review bodies. These are observed weaknesses, not acceptance passes or runtime fixes.

Operational flag-value observation and a configuration rollback drill remain open. Secret-name observation encountered HTTP 502; no value or operational state is inferred from it. Issue #28 remains open; no merge or release verdict is implied by local SQL success.

## Base integration

The PR base advanced to `ed572109f39af61f1d674df768eaa07de2f90416`. The sole merge conflict in `browser-e2e.test.js` was resolved by retaining both PR #29's cleanup/privacy cases and the base's room-setup cases. Earlier-head CI is not current-head evidence.

Integrated candidate `50f0aa5` passes all 29 combined browser-runner checks and all 20 audit checks. SQL artifact hashes still match the passing clone runs. Staging security run `staging-template-20261026200442-7a94e1b2` reproduces the same three passing/three failing cases; identities and both rooms clean up and the lease releases. Privacy run `staging-template-20261026200628-d0935153` stops at `private_canary`, before any learner privacy checkpoint; room cleanup passes and the lease releases. A follow-up records only HTTP status and a bounded failure category to diagnose the prerequisite without preserving private exception bodies.

Read-only secret-name observation subsequently succeeds: `TRANSFER_ASSESSMENT_ENABLED` exists, but its value is unavailable through that API. Successful assessment operations establish effective enabled behavior during the runs, not the secret's exact value. Evidence: `output/pr29-resume-20261026/staging-flag-observation.json`.

## Remaining acceptance and handoff

Diagnostic candidate `c005be5` attempted privacy run `staging-template-20261026200731-36ccf5ba`. It failed before browser identity or fixture work because another release owner had acquired staging: operation `staging-release`, candidate `7493add5a879a2db80505b87a98c5d6427f919d4`, run `9a0a93cb-a5a6-4f23-9c1c-0cd6cc166b7f`, claim time `2026-10-26T20:07:21.573Z`. No ownership transfer or reclaim was attempted. The failed claim does not own that reference.

After the release owner finishes and releases the lease, rerun `assessment-privacy` on the current PR head, using the stage/category/HTTP-status diagnostic. Require both pass and retry/terminal-failure journeys, every surface checkpoint, and cleanup. Reobserve deployed versions and target preconditions because the intervening release can invalidate previous evidence for current staging. The earlier security findings remain valid observations of v77 at their recorded times, not certification of subsequent versions. If a privacy fixture defect is identified, correct it and rerun; an infrastructure or prerequisite failure cannot establish privacy acceptance.

All room and temporary Auth/profile fixtures from completed runs are cleaned, including recovery of the initial HTTP 502 cleanup failure. The local candidate app is stopped. Operational rollback/readiness remains unverified; exact prior configuration must be observable before a reversible drill. Independent code/security review at `bfaa926` had no findings; the resumed changes require review on the new head. Required CI passed at `50f0aa5` ([run 40392423636](https://github.com/linmou/PhishingTrainingProgram/actions/runs/40392423636)); final-head checks must be read from the PR.

PR #29 remains open for owner review. Issue #28 remains open for privacy acceptance and operational evidence. This continuation implements no authentication or permission fix and makes no production release claim.

## Privacy prerequisite diagnosis

After the competing owner released the lease, candidate `0514234` ran `staging-template-20261026201416-c4047320`. Privacy failed at `private_canary` with HTTP 400; cleanup passed and the lease released. A separately leased diagnostic zero-row UPDATE returned HTTP 201 with `[]`, ruling out statement parsing; it changed no rows. The verified local baseline's `transfer_private_fields_immutable` trigger rejects changes to `reviewed_private_payload` with `IMMUTABLE_ASSESSMENT_PRIVATE_FIELDS`. The original fixture attempted that forbidden post-delivery change.

Correct the fixture by including private raw-output/rationale canaries in the original reviewed assessment passed to `send_reviewed_tutor_response_v4`, then verify both persisted values with a read-only query. No immutable-field protection is bypassed. This changes fixture construction only, not disclosure rules, the tested application or grading.

The final-head CI run for `0514234` passed all three required checks ([40393040426](https://github.com/linmou/PhishingTrainingProgram/actions/runs/40393040426)); later fixture changes require their own current-head checks.

Canary fix candidate `6a74c46` passes 20/20 audit and 29/29 browser-runner checks. Its live run `staging-template-20261026201633-d15d11ea` was blocked before fixture work by a new staging release lease: candidate `be8a695316bd3d22ae2ab2c2de149aa0f74864a1`, run `54ef77a6-ee7d-46ef-a850-823b97278f6f`, claimed `2026-10-26T20:15:40.950Z`. The corrected fixture therefore still needs live privacy acceptance. Neither failed lease claim owns the current reference. All previously allocated fixtures remain cleaned, and the zero-row diagnostic lease was released.

## Successful live privacy acceptance

After lease release, candidate `a5c1682fde2f9576873ea50e7ec7042b2c72f9fc` passed `assessment-privacy` in run `staging-template-20261026201907-6a8dc555`. Both actual browser journeys completed: `open → passed → passed-reload`, and `open → retry → retry-reload → failed → failed-reload`. All eight checkpoints passed: 237 observations, zero violations, covering learner HTTP request/response data, actual message realtime records, DOM, JSON/TXT downloads and a denied private-review error. Each journey verified actual private/provider canary persistence; the second-failure exception was bound to private grading authority and the exact saved result.

Both configured rooms were read back clean, including private assessment/provider stores and restored Guard fields. The run exited 0 and released its lease. The candidate app stopped. The latest observed Edge artifacts remain `assessment-api` v77 and `ai-api` v7; `output/pr29-resume-20261026/staging-functions-retry.json` records the observation. Intervening releases still require relevant schema/configuration preconditions to be checked before reusing these results in a future release.

Artifact hashes:

| Artifact | SHA-256 |
| --- | --- |
| `assessment-privacy.js` | `cdda03ee226db58fc132aae92e89ac4b4b5f6af832ec9d1ecb07ad07395f7247` |
| `assessment-fixture.js` | `598a7ae51a258d608ebcca8dea2ff0f9ac54748add018aecc976dce202514bf5` |
| `assessment-privacy-passed.json` | `57363b06146a53d1583ef48d9b34e9d74298a7bc516cc915215ac0672769b09a` |
| `assessment-privacy-failed.json` | `404e70714995460b8a577e777e78000a7f6cffa8a6801c62c593c03f743bd48a` |

The run directory preserves per-observation hashes, surfaces, status codes, byte counts and violation findings without private response bodies. `report.json` records candidate, workflow hashes, room IDs, command outcome and cleanup. The private local `output/pr29-resume-20261026/` directory retains diagnostic SQL/results, command logs, SQL clone evidence references, deployed-version observations and a report manifest. Historical failed attempts remain alongside the successful run.

All required CI passed at `a5c1682` in [run 40394324030](https://github.com/linmou/PhishingTrainingProgram/actions/runs/40394324030), including pinned Chromium and the full Jest regression. The subsequent evidence-only commit leaves tested source hashes unchanged; its final-head CI remains independently observable on the PR.

Issue #28 remains open for operational rollback/readiness evidence. The flag-value blocker reported at this handoff was resolved by the read-only observation below. Observed identity-spoofing and direct-write weaknesses remain recorded failures requiring a separate runtime/security decision. No merge, flag change, runtime deployment or production verification occurred.

## Boolean configuration observation correction

On 2026-10-26, a read-only GET of `/v1/projects/ciubrzggdqesgvfkpolj/secrets` returned the `TRANSFER_ASSESSMENT_ENABLED` entry. Its `value` matched the locally computed SHA-256 digest of the exact literal `true`, compared against both `true` and `false`. This establishes the stored value as `true` at observation time, rather than merely inferring enablement from successful requests. No credentials or other secret digests were printed.

This flag is non-sensitive configuration. Supabase's Edge environment-variable store is named Secrets, but confidentiality of this boolean is not required. The Management API does not return plaintext; comparison against the two valid boolean literals provides a readable observation without moving the setting or changing runtime code. The earlier claim that available access could not determine the value was incorrect. Reobserve the value under the staging lease immediately before a future drill, restore that observed configuration afterward, and verify restoration. The drill itself remains unperformed.
