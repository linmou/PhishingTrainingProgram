# Browser E2E Testing

<!-- Cyberbullying workflow added 2026-10-21; implementation baseline 2807c52. -->

The `cyberbullying` workflow creates a tagged situation through the tutor UI and verifies learner progress, character selection/regeneration, edited approval, rejection, ratings, observer access, reload and JSON export. Run it with `--workflow=cyberbullying` against the explicitly selected candidate app/project. Cleanup deletes the tagged room by cascade and checks its related rows. See [Cyberbullying practise](cyberbullying-practise.md) and its [cutover runbook](cyberbullying-cutover.md).

<!-- Assessment dialogue revision approved 2026-10-17; baseline commit c6d5129. -->

## Assessment dialogue revision

Extend assessment-answer and tutor-response checks with saved result identities, complete option/result dialogue, no VERIFIED ASSESSMENT STATE section, retry/pass/failure/cancellation disclosure, reload/deduplication, required-rating exclusions and actual provider response evidence. Run matching staging and production journeys in the approved SQL→Edge→client batch. See [Assessment result messages](assessment-result-messages.md) for the governing publication and consumer rules. Implementation/release status is recorded there; older dated evidence below is retained.

Intent: identify test boundaries, reuse template rooms for live browser tests, and retain evidence.

Updated: 2026-10-21. Workflow revision baseline commit: `72f1087`; assessment release browser baseline: `88b3ccd`.

For the staging-to-production Edge Function release sequence, see [supabase-release-workflow.md](supabase-release-workflow.md#edge-function-release). This page contains the browser setup and commands.

## Concurrent Agent Runs (Shared Fixtures)

The browser runner obtains an **exclusive same-host lock per Supabase project** before any live fixture work. The lock covers setup, all selected workflows, cleanup and browser close. A second run in another worktree on the same host fails closed rather than resetting the first run's test room. The lock is recorded in the E2E evidence report and located at `~/.cache/phishing-training-program/fixture-locks/<project-ref>.lock/owner.json`. Check the listed process PID/host and confirm that the owning run has stopped before manually clearing a stale lock. Locks are **never** automatically reclaimed by age.

The runner also acquires the [cross-machine project lease](agent-coordination.md), shared with Staging deployments, before fixture work. Authenticate `gh` with repository Contents write access. Another machine fails closed while that lease is held. Cleanup or browser-close failures retain the lease for inspection. Separate room IDs through `E2E_ROOM_FIXTURES_JSON` still share deployed code and provider resources, so they do not bypass the project lease. Direct API/MCP operators must claim the same lease; the coordinator cannot intercept clients that bypass the protocol.

The no-secret PR CI workflow deliberately omits hosted browser E2E. Only the existing operator-selected staging/production verification can exercise live Supabase. Production E2E must never be triggered by PR CI.

## Supabase Projects

| Environment | Project reference | Current use |
| --- | --- | --- |
| Production | `zgbufaxooqxeabewktzd` | Production browser workflow target with dedicated fixture rooms. |
| Staging | `ciubrzggdqesgvfkpolj` | Staging browser workflow target with reusable fixture rooms. |

The app and runner must use the same selected target. `test:e2e:staging` and `test:e2e:production` invoke the same `scripts/browser-e2e.js` implementation with `E2E_TARGET` set before Node loads it. The runner blocks browser traffic to other Supabase projects and validates each room's ID, title, owner, and template content. It never loads `.env`; supply variables in the process environment. CRA reads `REACT_APP_*` when the app starts. Tutor and extraction calls use the application's localStorage/offline-user session; they do not require a Supabase Auth user JWT.

## Current Test Paths

| Path | Browser and provider | Database effects | Automation |
| --- | --- | --- | --- |
| Jest unit and `*.integration.test.tsx` | jsdom, mocked services | None | Default regression suite. |
| `test:integration:qwen` | Real provider, no browser | None | Opt-in provider contract checks. |
| `test:e2e:staging` / `test:e2e:production` | Eleven default Playwright workflows, plus the opt-in staging security workflow | Test rows are deleted after each workflow; fixture rooms remain; new-room workflows delete their tagged rooms | Explicit live suite against the selected project. |
| `eval:behavior:web` | Playwright and seven real tutor calls with rubric judge | Seven staging Test Rooms | Deeper behavior evaluation; separate from the workflow suite. |
| `scripts/browser-capture-prompt-contrast.js` | Playwright and six prompt comparisons | Six staging Test Rooms | Specialized capture utility. |
| `--workflow=assessment-security` | Opt-in live staging anon HTTP attacks; admin fixture/oracle access | Existing assessment fixtures; runner cleanup | Staging-only; excluded from the default suite. See [Wave 105 audit](transfer-assessment-wave105-audit.md) for open gaps. |
| `scripts/record-transfer-learning-demo-video.js` | Two real browser contexts, staging provider, and timestamped chapters | Reuses the assessment template room; all generated rows are cleaned afterward | Explicit recording run. |

GitHub Actions includes deterministic PR isolation checks and a manually dispatched assessment API deployment/inspection workflow. Hosted browser E2E is not in CI. The `frontend-jest` job installs Playwright Chromium and runs `test:e2e:unit` against local HTML fixtures; these checks do not connect to staging or establish hosted acceptance. The [2026-10-14 release record](doc_update_record/documentation_update_record_v2026_10_14_final_assessment_release.md) contains successful staging/production answer and full-inventory delivery runs, cleanup, and earlier failure evidence. Status observations now preserve the analysis-context RPC result before assertions and fixture cleanup; on success this is the context after analysis, not a raw provider-response audit.

The [early-message browser record](doc_update_record/documentation_update_record_v2026_10_14_early_message_recheck_browser.md) verifies automatic replay after manual goal creation in the merged app against staging, including reload and duplicate prevention.

## Select The Release Checks

Use the [verification scope](supabase-release-workflow.md#verification-scope) and [production batch](supabase-release-workflow.md#production-batches) rules before choosing commands. Record selected workflows and their behavioral coverage in the release record. A full-suite command without `--workflow` runs all eleven workflows; use it when the combined change affects shared behavior that cannot be bounded.

| Changed behavior | Relevant existing browser checks |
| --- | --- |
| Assessment option controls, binding or retry/terminal chat gate | `assessment-answer` |
| Assessment scheduling, eligibility or tutoring across targets | `assessment-delivery`, plus `assessment-answer` if answer/lifecycle behavior changes |
| Learner evidence judgments or status transitions | `transfer-status-events`; add the relevant semantic evaluation cases |
| Tutor suggestion and reviewed ordinary send | `tutor-response` |
| Room assessment setup | `room-assessment-setup` |
| Checklist generation, editing or coverage | Corresponding `checklist-generation`, `checklist-management` or `checklist-coverage` workflow |
| Rechecking learner messages when goals are created | `early-message-recheck` |
| Guard entry/recovery | `guard-mode` |

Run focused deterministic tests first, including applicable provider failures, gates and permission cases. For example, from `tutor-system/` use `rtk npm run test:e2e:unit` for runner checks, then `rtk npm run test:e2e:staging -- --workflow=assessment-answer` for a change confined to answer controls. After batch promotion, the matching production command is `rtk npm run test:e2e:production -- --workflow=assessment-answer`. These commands require the selected app/project environment described below; the unit command has no hosted/provider dependency.

Run selected staging journeys after the affected change, and revalidate combined interactions before promoting a batch. Production checks must cover the changed behavior and resulting state/cleanup; use the full affected journey for lifecycle/security changes and the affected smoke/API check for isolated changes. A successful deployment, health response, or staging result alone cannot close production acceptance. API-only behavior may use an integrated API check instead of an unrelated browser workflow.

Each selected workflow still requires complete evidence and fixture cleanup. Run workflows sharing a fixture sequentially. Real-provider failures remain in the record even if a later attempt passes. Reuse evidence only while the tested source, dependencies, configuration and target preconditions remain valid; rerun affected checks after relevant changes. Full-inventory assessment delivery is reserved for changes to scheduling or cooperation across targets, rather than every UI edit.

## Run The Live Suite

Use Node 18 or newer and `jq`; install Playwright Chromium with `npx playwright install chromium`. From `tutor-system/`, load the existing `.env` into the shell without printing its values. Provide the selected project's anon and service-role keys in memory. The anon key is used by the browser Supabase client; the service-role key is used only by the runner for fixture inspection and cleanup. Provider credentials belong in Edge Function secrets and are not needed by the browser runner. No staging user JWT is needed because the app uses its localStorage/offline-user identity:

```bash
set -a
source .env
set +a
export E2E_TARGET=staging
export E2E_PROJECT_REF=ciubrzggdqesgvfkpolj
export E2E_SUPABASE_URL=https://ciubrzggdqesgvfkpolj.supabase.co
keys_json="$(curl --fail --silent --header "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects/$E2E_PROJECT_REF/api-keys)"
export E2E_SUPABASE_ANON_KEY="$(jq -er '.[] | select(.name == "anon" and .disabled != true) | .api_key' <<< "$keys_json")"
export SUPABASE_SERVICE_ROLE_KEY="$(jq -er '.[] | select(.name == "service_role" and .disabled != true) | .api_key' <<< "$keys_json")"
unset keys_json
```

The local `tutor-system/.env` points the app at production by default. Override its Supabase settings when starting CRA; exclude the service-role key and management token from the app process:

```bash
env -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_ACCESS_TOKEN \
REACT_APP_SUPABASE_URL="$E2E_SUPABASE_URL" \
REACT_APP_SUPABASE_ANON_KEY="$E2E_SUPABASE_ANON_KEY" \
REACT_APP_OAI_API_KEY= \
PORT=3100 BROWSER=none npm start &
curl --fail --silent --retry 20 --retry-connrefused --retry-delay 1 http://localhost:3100/ >/dev/null
E2E_APP_URL=http://localhost:3100 npm run test:e2e:staging

# For production, set E2E_TARGET=production, E2E_PROJECT_REF=zgbufaxooqxeabewktzd,
# and E2E_SUPABASE_URL=https://zgbufaxooqxeabewktzd.supabase.co before fetching keys
# and starting CRA, then run:
E2E_APP_URL=http://localhost:3100 npm run test:e2e:production
```

Use an unused port in both commands if 3100 is occupied. To run one workflow, append `-- --workflow=room-assessment-setup`. `npm run test:e2e:unit` checks selection and preflight locally without a browser or credentials. The room setup workflow creates a uniquely named room through the tutor UI and deletes it after the run; other workflows require empty template rooms. Cleanup runs after failures too, and its status is recorded per room in `report.json`; a cleanup failure fails the run.

The four production browser-test rooms are mirrored to staging with `npm run test:e2e:staging:migrate-templates`, using `SUPABASE_ACCESS_TOKEN`, `REACT_APP_SUPABASE_STAGING_URL`, and `STAGING_SUPABASE_SERVICE_ROLE_KEY`. The migration copies each room's title, description, image, dialogue, transfer mode, assistant settings, and AI config into the same room ID on staging. It refuses occupied staging fixtures and reads back every copied field. Older staging demo rooms remain available but are not used by the browser runner.
After fetching the staging service key above, set `STAGING_SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"` when running the migration command.

Both projects use `3630671f-b40d-48ed-b28b-e1da6d407436` for the five tutor, checklist, and Guard workflows. Assessment delivery uses `286de02f-30b0-46ee-8df3-17d1dae1ca89`; answer pass and failure use separate empty copies `d6b6b8f0-c0f8-4a4f-a55f-6c9f776221dd` and `79be49a2-e53c-493d-bd66-adcffbadbba5`. The browser runner clears generated rows after each workflow. The production `assessment-api` requires `OAI_API_KEY`, `OAI_BASE_URL`, and `OAI_MODEL` in its Edge secret store.

## Record The Transfer Demo

After exporting the staging variables above and starting CRA against staging, run:

```bash
E2E_APP_URL=http://localhost:3100 node scripts/record-transfer-learning-demo-video.js
```

The recorder reuses the `assessment-delivery` staging copy of the production `Transfer Assessment Demo: Account Warning` template. It reads that room's persisted detection and verification targets, creates the full multi-target transfer checklist, and records learner target approval, learner evidence, real assessment preparation and delivery, a learner answer, progress resolution, and the next tutoring response in two synchronized browser contexts. It does not create a room. The recorder cleans the room after the browser closes and writes the WebM, timestamped PNG contact sheet, evidence JSON, chapter list, screenshots, and raw context recordings under `output/playwright/`.

| Workflow | Checks |
| --- | --- |
| `tutor-response` | Learner message, real tutor suggestion, reviewed send, and audit row. |
| `checklist-generation` | Smart Generate from an unstructured prompt, real LLM extraction, and stored targets. |
| `room-assessment-setup` | Create a room through the tutor UI, enable in-room assessment, have a learner join without posting, and verify Generate Learning Targets is enabled. |
| `checklist-management` | Manual creation, status/priority/text edits, and persistence after reload. |
| `checklist-coverage` | Learner message, real coverage call, stored progress, and the next tutor request. Ordinary learner sends invoke analysis after persistence; tutor requests read current progress without replacing the authored prompt. |
| `assessment-delivery` | One full-template room journey across URL-domain and Official Support targets: real tutoring while Partial, full-understanding evidence, provider preparation, tutor review/send, option gating, bound answers and terminal feedback. Drains all scheduler-selected ready targets, including other targets becoming due during a new topic; the partial target must remain partial and ineligible throughout that queue. Asserts both named targets complete and every delivered assessment closes. Checks hosted policy before fixture mutations. |
| `assessment-answer` | Learner pass, retry→pass and retry/failure in separate/reused empty template rooms; exact saved-result disclosure and progress after each attempt; disabled chat/Reply during the assessment, selected-option submissions, persisted identities/attempts, terminal chat recovery and reload. |
| `transfer-status-events` | Real learning-progress analysis against the full persisted room target inventory: direct understanding, initial signal, later full understanding, spontaneous transfer, no evidence, and contradiction. Checks Edge responses, private event kinds, stored progress, and learner/tutor screenshots. Shares the opening learner journey with `assessment-delivery`, then tests the remaining events in the same empty assessment-delivery fixture. |
| `early-message-recheck` | Two learner posts before any goals exist, then manual goal creation through the tutor UI. Verifies chronological real analysis, one backend completion marker per post, visible covered progress, server completion confirmations, an unrelated later post without duplicate effects, and persistence after reload. Captures request/response bodies and database states before cleanup. Reuses the empty assessment-delivery fixture and waits for the tutor panel's learner lookup before entering goals. |
| `guard-mode` | One student-tutor Guard journey: manual mode confirmation, locked checklist controls, real LLM Guard entry and persistence, recovery to tutoring, and response-mode audit rows. |

For a quick local check of the target button without a browser or database, run `npm test -- --watchAll=false --runInBand --runTestsByPath src/components/__tests__/ChecklistPanel.transfer.test.tsx -t 'allows target generation before a learner has posted'` from `tutor-system/`.

Each workflow has its own result. The full command continues after an individual workflow failure. The Guard workflow reuses the existing `Demo: Lock Icon Myth — Correct Reasoning` staging template room; it does not create a room. Cleanup resets response mode before deleting checklist rows, then verifies zero messages, checklists, sessions, feedback, assessments, and provider attempts. A direct database check found all seven rooms back at baseline response-mode state after the 2026-09-30 run.

The updated assessment delivery journey requires `private.transfer_assessment_due_event(uuid)` and a preparation function that uses it. A missing hosted final-assessment policy fails that workflow with prerequisite evidence; it does not switch to the earlier Partial/basic trigger. Historical browser results do not validate this newer policy or the option gate.

One learner message may make several targets ready. The delivery journey follows the server's priority queue rather than assuming a fixed first target or exactly two total questions. Each queued answer receives terminal feedback before the next learner acknowledgement or topic. Learner submission handles consecutive required-rating prompts; the answer fixture waits for the browser-created active learner session. Before deleting fixture rows, the runner navigates both browser pages away from rooms so realtime room entry cannot recreate sessions during cleanup.

Workflow screenshots use full-page JPEG at quality 75 to bound evidence size during long queued-assessment journeys. Earlier runs retain their original PNG files.

## Test Data And Evidence

`tmp/browser_demo_runs/<target>-template-*/report.json` records the run ID, project, commit, room IDs, provider calls, results, cleanup status, and screenshots. The database rows are removed only after evidence is saved. Preserve complete run directories in durable storage before deleting local copies.

Preserve `evals/promptfoo/results/`: LLM-judge results include rubric evidence beyond pass/fail. `scripts/transfer-assessment-release.config.json` is a frozen historical blocked snapshot; its runner no longer generates releases. See the [Wave 105 retirement audit](transfer-assessment-wave105-audit.md).

Earlier staging findings are recorded in [staging runtime evidence](doc_update_record/documentation_update_record_v2026_09_29_staging_runtime_draft.md) and the [AI-only browser rerun](doc_update_record/documentation_update_record_v2026_09_29_ai_only_rerun.md). The 2026-09-30 workflow run verified tutor progress context and learner assessment results after reload.
