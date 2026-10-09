# Staging Assessment Runtime Draft

Intent: record the staging runtime delivery and browser assessment results with their validation limits.

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

Function-only workflow run `36553722649` deployed the Edge Function successfully. Playwright launched against the staging-configured app, created room `92081ace-7370-4fbf-bbb4-39aa10bf7f73`, joined student `646675bd-493c-4092-a5b7-5225e93f6466`, and posted the first student message. The tutor is `327a8707-4dc0-4320-a4e3-318fbb0b327a`. The browser room initially has no transfer checklist. `supabase/fixtures/staging_assessment_room_20260929.sql` adds four eligible items to this exact room after asserting its tutor, active student session, and student message. The fixture passed twice in the clean disposable database, returning the same checklist ID and four items on replay. Its staging dispatch is pending.

Workflow run `36554316472` seeded the staging room, returning checklist `211e1b68-eaf8-440b-870b-5b7014b0b479` and four eligible items. The first real browser preparation returned `AI_OUTPUT_INVALID` (HTTP 502). A direct Edge request returned the same code. Provider-attempt inspection in run `36554733028` showed both attempts were complete JSON responses but used a string `decision` (`continue_tutoring` or `null`) instead of the required object; one also used a string `learning_evidence`. The prompt now states the exact field types and separates historical `prior_participation_mode` from the new decision. This changes prompt wording only; the request data, provider model, grading, and evaluation method are unchanged. The local 14-test Deno suite passed after the prompt edit. Hosted retest is pending.

The next hosted preparation still returned `AI_OUTPUT_INVALID`. Provider attempts inspected in run `36555110601` show the model chose assessment with a valid decision object, but used `selection_type: "single_choice"` and a string `transfer_basis`. The prompt now specifies `single`/`multiple` and the four required object fields. This second prompt edit leaves the context, provider settings, answer authority, and SQL state unchanged. Hosted retest remains pending.

After deployment run `36555326283`, a direct Edge preparation returned a complete assessment candidate, and Playwright displayed its tutor review panel. Browser confirmation found the generated three-sentence stem and then a reason longer than the shared 40-word limit. The tutor shortened the stem in the browser, but the reason is not editable there. The prompt now includes both review limits and requests a reason under 25 words. No assessment was sent by that attempt; hosted retest is pending.

## Earlier Attempt

Before the environment restrictions changed, the draft installed successfully in disposable PostgreSQL database `staging_runtime_20260929`. The existing RPC regression script progressed through delivery, attempts, terminal outcomes, and Guard cases, but did not complete: its final stale fixture attempted delivery to an already covered item and the delivery validator rejected it. The fixture and Guard replay handling were then corrected. Those final changes have not been rerun. No claim of a passing regression suite or browser E2E is made.

The earlier restricted environment denied access to the PostgreSQL Unix socket, GitHub API, and local app. The resumed session can reach these services and launch Playwright. Hosted deployment and browser room testing remain pending.

## Remaining Work

The runtime migration was applied once by workflow run `36553210224` and is archived. The one-time workflow input was removed. Function run `36555715803` deployed the prompt with bounded review text.

The real Playwright tutor and student sessions used staging room `92081ace-7370-4fbf-bbb4-39aa10bf7f73` and checklist `211e1b68-eaf8-440b-870b-5b7014b0b479`:

- The tutor reviewed and sent a bank-alert question. The student selected C on the first attempt and saw `Correct.`
- Assessment `72cde923-fbb9-4aa8-87f9-a0001f382fe1` received A then C. The student first saw `Incorrect. 1 attempt remaining.`, then `Correct.` The tutor's refreshed checklist showed `50.0% Complete (2/4 items)` after the two passing assessments.
- Assessment `69410777-9fbc-4b53-9d52-08999b8e56c1` received A then C against correct option B. The second answer disabled further submission and showed the learner-safe explanation with `Correct option(s): B`.
- The student asked why calling the number in the suspicious delivery text was unsafe. The AI prepared another assessment instead of an explanation. The tutor discarded the draft and sent a direct clarification. This is an observed provider behavior issue; help routing is not validated as correct.

Hosted inspection run `36557652461` confirmed assessment lifecycles `passed/1`, `passed/2`, and `failed/2`, with all five attempt rows `applied`. The two pass events and one fail event were also `applied`. The four checklist rows were `covered`, `covered`, `needs_review`, and `partially_covered`; the tutor view showed `2/4` complete. A one-line provider prompt correction directs explicit post-failure help requests to tutoring mode; deployment run `36557955209` succeeded and the Edge suite passed 14/14. In the hosted browser retest, the provider returned `mode: tutoring` with no assessment. The tutor UI needed a small review region for that mode because its assessment editor renders nothing without an assessment. The focused page suite passed 9/9. The tutor selected the generated response, edited it, and sent it; the student browser displayed the clarification. The ordinary-message classifier still returns `awaiting_review`; tutor review remains the authority for delivered assessments.
