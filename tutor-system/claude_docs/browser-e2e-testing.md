# Browser E2E Testing

Intent: identify test boundaries, reuse template rooms for live browser tests, and retain evidence.

## Supabase Projects

| Environment | Project reference | Current use |
| --- | --- | --- |
| Production | `zgbufaxooqxeabewktzd` | Source of the demo room templates. Never the browser workflow target. |
| Staging | `ciubrzggdqesgvfkpolj` | Seven reusable copies of production templates, including transfer-enabled assessment rooms. |

The app and runner must both use staging. The runner blocks browser traffic to other Supabase projects and validates each room's ID, title, owner, and template content. It never loads `.env`; supply variables in the process environment. CRA reads `REACT_APP_*` when the app starts.

## Current Test Paths

| Path | Browser and provider | Database effects | Automation |
| --- | --- | --- | --- |
| Jest unit and `*.integration.test.tsx` | jsdom, mocked services | None | Default regression suite. |
| `test:integration:qwen` | Real provider, no browser | None | Opt-in provider contract checks. |
| `test:e2e:staging` | Seven selectable Playwright tutor, checklist, assessment, and Guard workflows | Test rows are deleted after each workflow; template rooms remain | Explicit live suite. |
| `eval:behavior:web` | Playwright and seven real tutor calls with rubric judge | Seven staging Test Rooms | Deeper behavior evaluation; separate from the workflow suite. |
| `scripts/browser-capture-prompt-contrast.js` | Playwright and six prompt comparisons | Six staging Test Rooms | Specialized capture utility. |
| `eval:transfer:release-browser` | Release evidence adapter | Configuration-dependent | Specialized release lanes, not the normal browser suite. |
| `scripts/record-transfer-learning-demo-video.js` | Two real browser contexts, staging provider, and timestamped chapters | Reuses the assessment template room; all generated rows are cleaned afterward | Explicit recording run. |

The only GitHub Actions workflow is a manually dispatched assessment API deployment/inspection workflow. Browser E2E is not in CI.

## Run The Live Suite

Use Node 18 or newer, Supabase CLI, and `jq`; install Playwright Chromium with `npx playwright install chromium`. From `tutor-system/`, load the existing `.env` into the shell without printing its values. The token needs project API-key access and database query access. Retrieve the staging keys in memory:

```bash
set -a
source .env
set +a
keys_json="$(supabase projects api-keys --project-ref ciubrzggdqesgvfkpolj -o json)"
export REACT_APP_SUPABASE_STAGING_ANON_KEY="$(jq -er '.[] | select(.name == "anon" and .disabled != true) | .api_key' <<< "$keys_json")"
export SUPABASE_SERVICE_ROLE_KEY="$(jq -er '.[] | select(.name == "service_role" and .disabled != true) | .api_key' <<< "$keys_json")"
unset keys_json
```

The local `tutor-system/.env` points the app at production by default. Override its Supabase settings when starting CRA; exclude the service-role key and management token from the app process:

```bash
env -u SUPABASE_SERVICE_ROLE_KEY -u SUPABASE_ACCESS_TOKEN \
REACT_APP_SUPABASE_URL="$REACT_APP_SUPABASE_STAGING_URL" \
REACT_APP_SUPABASE_ANON_KEY="$REACT_APP_SUPABASE_STAGING_ANON_KEY" \
PORT=3100 BROWSER=none npm start &
curl --fail --silent --retry 20 --retry-connrefused --retry-delay 1 http://localhost:3100/ >/dev/null
E2E_APP_URL=http://localhost:3100 npm run test:e2e:staging
```

Use an unused port in both commands if 3100 is occupied. To run one workflow, append `-- --workflow=checklist-generation`. `npm run test:e2e:staging:unit` checks selection and preflight locally without a browser or credentials. The runner never creates a room. It requires an empty template room before each workflow and deletes generated messages, checklists, sessions, feedback, and private assessment rows afterward, including after a failure. Cleanup status is recorded per room in `report.json`; a cleanup failure fails the run.

The seven rooms were migrated once from production demo rooms with `npm run test:e2e:staging:migrate-templates`, using `SUPABASE_ACCESS_TOKEN`, `REACT_APP_SUPABASE_STAGING_URL`, and `STAGING_SUPABASE_SERVICE_ROLE_KEY`. The migration is idempotent and validates existing copies. Assessment copies receive the canonical local template dialogue and full target inventory, even when the production room's `prompt_config` is null. It is setup, not part of a test run.
After fetching the staging service key above, set `STAGING_SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"` when running the migration command.

## Record The Transfer Demo

After exporting the staging variables above and starting CRA against staging, run:

```bash
E2E_APP_URL=http://localhost:3100 node scripts/record-transfer-learning-demo-video.js
```

The recorder reuses the existing `assessment-delivery` staging copy of the `Demo: Click Impulse (Correct Safe Action)` template. It reads that room's persisted detection and verification targets, creates the full multi-target transfer checklist, and records learner target approval, learner evidence, real assessment preparation and delivery, a learner answer, progress resolution, and the next tutoring response in two synchronized browser contexts. It does not create a room. The recorder cleans the room after the browser closes and writes the WebM, timestamped PNG contact sheet, evidence JSON, chapter list, screenshots, and raw context recordings under `output/playwright/`.

| Workflow | Checks |
| --- | --- |
| `tutor-response` | Learner message, real tutor suggestion, reviewed send, and audit row. |
| `checklist-generation` | Smart Generate from an unstructured prompt, real LLM extraction, and stored targets. |
| `checklist-management` | Manual creation, status/priority/text edits, and persistence after reload. |
| `checklist-coverage` | Learner message, real coverage call, stored progress, and the next tutor request. Ordinary learner sends invoke analysis after persistence; tutor requests read current progress without replacing the authored prompt. |
| `assessment-delivery` | Real transfer provider preparation, tutor review/send, and learner-visible question. |
| `assessment-answer` | Learner pass and retry/failure in separate template rooms, persisted outcome, and reload. |
| `guard-mode` | One student-tutor Guard journey: manual mode confirmation, locked checklist controls, real LLM Guard entry and persistence, recovery to tutoring, and response-mode audit rows. |

Each workflow has its own result. The full command continues after an individual workflow failure. The Guard workflow reuses the existing `Demo: Lock Icon Myth — Correct Reasoning` staging template room; it does not create a room. Cleanup resets response mode before deleting checklist rows, then verifies zero messages, checklists, sessions, feedback, assessments, and provider attempts. A direct database check found all seven rooms back at baseline response-mode state after the 2026-09-30 run.

## Test Data And Evidence

`tmp/browser_demo_runs/staging-template-*/report.json` records the run ID, project, commit, room IDs, provider calls, results, cleanup status, and screenshots. The database rows are removed only after evidence is saved. Preserve complete run directories in durable storage before deleting local copies. The 2026-09-30 production trial's exact test rows and temporary learners were removed and verified absent; its reports remain historical evidence.

Preserve `evals/promptfoo/results/`: LLM-judge results include rubric evidence beyond pass/fail. `scripts/transfer-assessment-release.config.json` is a historical blocked snapshot.

Earlier staging findings are recorded in [staging runtime evidence](doc_update_record/documentation_update_record_v2026_09_29_staging_runtime_draft.md) and the [AI-only browser rerun](doc_update_record/documentation_update_record_v2026_09_29_ai_only_rerun.md). The 2026-09-30 workflow run verified tutor progress context and learner assessment results after reload.
