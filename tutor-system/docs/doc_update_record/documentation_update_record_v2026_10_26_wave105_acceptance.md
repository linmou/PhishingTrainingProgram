# Wave 105 acceptance continuation

Intent: preserve reproducible SQL and staging acceptance evidence for PR #29 and issue #28.

Updated: 2026-10-26. Source baseline: `bfaa92661c29b6606be16ec25dc21b08d7e1fd22`.

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

Execution results are pending. Operational flag observation and a configuration rollback drill remain open. Issue #28 remains open; no merge or release verdict is implied by local SQL success.
