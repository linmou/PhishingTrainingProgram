# Room Realtime Publication Repair

Intent: restore the three existing room-channel bindings and preserve evidence for exact-artifact promotion.

Date: 2026-10-24 (inspection and validation continued on 2026-10-25 UTC). Integration baseline: `6d6fefa`. Branch: `fix/realtime-publication-20261024`. Release owner: root open-issues agent. Status: **local tests passed; hosted application and verification pending**.

## Behavior And Scope

Both staging `ciubrzggdqesgvfkpolj` and production `zgbufaxooqxeabewktzd` have an empty `supabase_realtime` publication. A channel can report `SUBSCRIBED` and subsequently report a `postgres_changes` system error, so that status alone does not establish a working message stream. The existing client binds messages, feedback and room changes on the same channel.

The only SQL change adds `public.messages`, `public.message_feedback` and `public.rooms` to that publication in one atomic statement. Publication owner/options, schemas, roles, grants, RLS, row contents and replica identity stay unchanged. The publication remains explicit-table rather than all-tables. It publishes no private schema tables.

Pending artifact: `supabase/migrations/20261025034000_enable_message_realtime.sql`.

SHA-256: `c909b92da2c9b7d96c2a4f0d4e23a8f06d0cc85bb8885d01d2aa911dc4cf5e78`.

The statement requires the existing publication and all three tables; a missing table or insufficient privilege fails rather than silently changing scope. Reapplication after success is a precondition error, so the release owner checks membership before each application.

## Access And Payload Inspection

Read-only project-scoped Supabase MCP inspection found matching relevant permissions in both environments: the three tables belong to `postgres`, have RLS enabled, and grant the existing anon/authenticated/service roles table access. Permissive public `ALL USING (true)` policies already allow full-row reads, including inactive-room rows. This migration introduces a transport for rows those roles can already select; it grants no additional database permissions and adds no bypass role.

`rooms.password` is a plaintext column already available through the current full-row REST permissions; both inspections counted zero non-null passwords. `rooms.scenario_config` is likewise already readable. Publishing room updates preserves the existing full-row client binding and makes those readable values available through change events as well. The release owner explicitly selected this scope after reviewing that preexisting exposure. Tightening those permissions or changing the payload contract would be a separate behavior change.

Both live inspections found zero answer-key columns among the three public tables, zero nested `correct_option_ids`/`answer_key` fields in stored public assessment options/events or scenario configurations, and confirmed `correct_option_ids` and `reviewed_private_payload` remain columns of `private.transfer_assessments`. Local anon and authenticated tests require SQLSTATE `42501` for reading that private table and altering the publication; service-role access remains available. Full-row publication still carries current public message content and assessment result/lifecycle fields, so live verification must use controlled fixtures and inspect their payloads.

## Baseline And Parity

Private resume package: `/Users/admin/.transfer-assessment-pg17/runs/realtime-publication-20261024/`.

The existing PG17 validation cluster was stopped and was started at its existing socket, port `55433`. Baseline database: `realtime_publication_baseline_20261025_0335`, owner `postgres`, UTF8, ICU `en-US`, `en_US.UTF-8` collation/ctype. Source production version is 17.4; local is 17.11; staging inspection reports 17.6. These PG17 patch versions share the tested publication catalog and transactional `ADD TABLE` behavior. No locale-sensitive ordering or transformation is introduced.

Fresh application/private export: `baseline.mMONj2dn/phishingtutor.dump`, SHA-256 `960e9bff5e3e06044258d16ec7ccbef20e14daf3ed32203513417df7e4dc82fb`.

Fresh password-free role export: `baseline.mMONj2dn/source-roles.sql`, SHA-256 `9ad98f8835e32b03c2a1addd4edfaf766823b85a15b4ed2be4626c3b84543d09`.

`baseline-setup.sql` restores source database grants/settings, required external `auth.uid()` and UUID/crypto dependencies, their owners/grants, and the separately captured empty publication. `baseline-parity-repair.sql` restores external default grants and public schema USAGE omitted by the filtered dump. Existing cluster roles matched the fresh source executor/application attributes, memberships, grant options and settings; no global role change was needed. The migration executes as source-equivalent `postgres` with `NOSUPERUSER`, `INHERIT` and `BYPASSRLS`, rather than the bootstrap administrator.

`inspection/source-catalog-utc.json` and `inspection/restored-catalog-utc.json`, checked by `compare-baseline.js`, match database ACL/settings, relevant roles, schemas/default ACLs, policies, constraints, indexes, function definitions/security, publication state and UTC-normalized row counts/hashes. The baseline contains 68 rooms, 550 messages and 184 feedback rows. `baseline-parity-report.json` records the comparison and explained differences: local membership grantor identity with identical effective options, equivalent explicit/default owner-only ACL on `private.practice_write_gate`, ICU platform version, and unrelated absent GraphQL/statistics/vault extensions. All restored public/private functions, constraints and policies match; the inspected dump's external references require only the provisioned Auth/UUID dependencies. No required dependency was replaced with a stub.

The first export left `baseline.AYSdDOhg` incomplete when the local `C.UTF-8` locale caused `shasum` to fail after export. The isolated wrapper was rerun with `LC_ALL=C LANG=C`, producing the verified manifest above. The first prerequisite restore attempt lacked the Auth schema grant before creating `auth.uid()` and failed; its restore rolled back atomically. Corrected grants precede function creation, and `restore-retry.log` records the successful complete restore. Failed logs remain in the resume package.

## Local Verification

```sh
rtk proxy env PG_REALTIME_VERIFIED_BASELINE=realtime_publication_baseline_20261025_0335 PG_VALIDATION_PSQL=/opt/homebrew/opt/postgresql@17/bin/psql PG_VALIDATION_RUN_ROOT=/Users/admin/.transfer-assessment-pg17/runs/realtime-publication-20261024/scenarios-recorded node --test scripts/database/message-realtime-publication.integration.test.js
```

`publication-tests-recorded.log` records passing Red, Green and atomic-failure scenarios (four Node tests including their parent). Red verifies existing permissions and fails specifically with `MESSAGE_REALTIME_MEMBERSHIP_REQUIRED`. Green applies the exact SQL and requires all three memberships, unchanged owner/options, full existing anon/authenticated reads, protected private assessments, forbidden publication writes and retained service access. Before/after snapshots require unchanged message, feedback and room row hashes plus all policies and affected table ACL/RLS settings. Atomic failure renames the second required table in its own clone, applies the exact candidate and requires SQLSTATE `42P01`, no partial membership and unchanged data after restoration. The reviewer requested explicit duplicate-application evidence: `publication-tests-rerun-safety.log` additionally requires a second exact application to fail with SQLSTATE `42710` while membership, permissions and rows remain unchanged.

The helper allocates distinct clones of the verified baseline, checks database ACL/settings parity and drops only its owned scenario databases. `scenarios-recorded/*/lease.json` preserves command result, parity and cleanup timestamps; sibling `publication-command-evidence.json` records each SQL input/filename, output, SQLSTATE-bearing error and exit code. The verified baseline remains available for the release owner's reruns. No hosted mutation has occurred in this worktree.

## Release Acceptance

Root owns the shared staging lease, deployment and acceptance. Before staging SQL, recheck publication membership/owner/options, all three table identities, relevant ACL/RLS and source-equivalent executor. Apply the exact hash once, then verify the three catalog memberships, unchanged permissions and private boundary before the integrated browser checks.

Staging acceptance remains open: require actual healthy websocket bindings for all three tables with no subsequent system error; verify INSERT and UPDATE message events and rendered results, targeted feedback refresh, room update delivery, missed-event recovery and the integrated healthy-window request budget. Inspect controlled payloads to confirm no private assessment answer-key data appears, and record fixture cleanup. Local PostgreSQL tests establish SQL/permission behavior, not Supabase websocket delivery.

Production acceptance remains open: merge the tested dependency and frontend commits into `no_sign_up`, freeze the integrated release commit and artifact manifest, compare staging evidence to the merged artifacts, recheck production preconditions, apply the identical SQL, verify catalogs/permissions and the affected live channel journey, and record cleanup. Archive the pending SQL only after both environments pass. Exact integrated release commit, hosted execution records and final websocket evidence are to be filled in by the release owner.

Latest `no_sign_up` workflow check on 2026-10-25: `supabase-release-workflow.md` and the committed database helper guide match the integration baseline; the existing source-equivalent role, ACL, executor, Red/Green and staging-before-production gates remain applicable.

## Integration Review

Integrated as `973d123` in PR [#30](https://github.com/linmou/PhishingTrainingProgram/pull/30). GitHub run `40214391611` passed all three required checks: isolation-harness, frontend-jest and frontend-build. Root rechecked staging through project-scoped MCP: publication remains empty, owner is postgres, all four DML options are enabled, the three table ACL/RLS/policy preconditions match, and no private table is published. No hosted mutation has occurred.

Independent reviewer `/root/issue_22_refactor` found no blocking defect in the exact SQL hash above and reran the final scenarios, including duplicate application: 4/4 passed. Reviewer evidence is `/Users/admin/.transfer-assessment-pg17/runs/realtime-publication-review-final-20261025/`; all three owned scenario databases were cleaned. The reviewer confirmed this is a one-shot migration whose duplicate failure is atomic, rather than a success-idempotent script. Root also inspected the saved baseline parity report and final author test log.

The browser acceptance harness extension is committed as `3a7273b`. Author and independent reviewer each passed 9/9 focused tests; reviewed script SHA-256 is `a9f22c91375a51ebe0da381998e087c1313626071a5fc74e4efa5634a618cd7b`. It requires all five event/filter bindings across the three tables, rejects later system errors, correlates controlled feedback/room updates with websocket records and UI values, and inspects controlled change payloads for known private assessment keys. Its final integrated head must pass applicable checks before root acquires the staging lease. Staging and production acceptance above remain open.
