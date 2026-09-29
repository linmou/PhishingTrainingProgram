# Staging Assessment Runtime Draft

Intent: preserve the pending backend update and its actual validation status for continued staging delivery.

Date: 2026-09-29

## Hosted State

Staging project `ciubrzggdqesgvfkpolj` has the production schema bootstrap applied. Verified counts: 17 public tables and 2 private tables. `messages.assessment_key` is absent; `private.transfer_assessments.question_message_id` references `messages.id`. The bootstrap script is archived.

The deployed assessment-api expects newer routines missing from that snapshot. The pending `20260929090000_staging_assessment_runtime.sql` is a delta authored from the current schema and active handler contracts. It has not been applied to staging.

## Draft Changes

- Add the v4 reviewed-delivery and v2 submission/processing routines, private attempt/provider logs, context builder, and Guard replay.
- Keep the existing question-message foreign key as the association. `assessment_request_id` records request idempotency; it is not an assessment-answer association.
- Fix SQL references to the application user's `"current_role"` column.
- Adjust the stale-transition regression fixture to change item progress after valid delivery.
- Message analysis still needs its real provider classification path; this draft does not implement `analyze_transfer_message_v1`.

## Validation Evidence

In a fresh disposable PostgreSQL 17 database cloned from the pre-runtime schema bootstrap, the pending migration applied successfully. The following checks passed on 2026-09-29:

- `transfer_assessment_rpc_behaviour.sql`: 28 cases, zero failures, including first-pass, retry-pass, two-failure, Guard replay, and rollback paths.
- `transfer_assessment_catalog_contract.sql`: local catalog contract passed.
- `transfer_assessment_direct_roles.sql`: direct private reads and mutation RPCs denied to `anon` and `authenticated`.
- `transfer_assessment_terminal_faults.sql`: all eight injected terminal faults rolled back and recovered.
- `transfer_assessment_backend.sql`: all eight schema/privacy checks passed after correcting its stale index-column assertion from `ordinal` to `attempt_number`.
- Edge handler Deno tests: 14 passed with `--unstable-sloppy-imports --allow-net --allow-env --allow-run`.

The one-time migration input in `.github/workflows/deploy-assessment-api.yml` runs the SQL before deploying the Edge Function. It defaults to false, so a later function-only dispatch does not reapply the migration.

The `analyze_transfer_message_v1` RPC currently returns `awaiting_review` for ordinary student messages. It does not classify them or advance progress; the tutor review flow remains the authority for sending an assessment.

The first staging workflow run, `36553210224`, applied the runtime SQL and configured provider secrets, then failed bundling the Edge Function because Deno could not resolve extensionless imports in shared TypeScript modules. A function-only rerun with server-side bundling, `36553418118`, hit the same missing module. The shared runtime imports now use explicit `.ts` paths. Local Deno tests pass without sloppy resolution (14/14), and the CRA production build succeeds with existing lint warnings. The next dispatch must leave `apply_runtime_migration` false.

## Earlier Attempt

Before the environment restrictions changed, the draft installed successfully in disposable PostgreSQL database `staging_runtime_20260929`. The existing RPC regression script progressed through delivery, attempts, terminal outcomes, and Guard cases, but did not complete: its final stale fixture attempted delivery to an already covered item and the delivery validator rejected it. The fixture and Guard replay handling were then corrected. Those final changes have not been rerun. No claim of a passing regression suite or browser E2E is made.

The earlier restricted environment denied access to the PostgreSQL Unix socket, GitHub API, and local app. The resumed session can reach these services and launch Playwright. Hosted deployment and browser room testing remain pending.

## Remaining Work

Deliver the validated migration to staging through GitHub Actions, archive it after confirmed success, then create assessment-ready rooms and run Playwright tutor/student pass, retry, failure, and subsequent tutor-reaction flows. The ordinary-message classifier remains a separate follow-up if the hosted room flow requires automatic progress changes before tutor review.
