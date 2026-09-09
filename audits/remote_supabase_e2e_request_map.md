# Remote Supabase browser E2E request map

**Intent:** Restore the browser behavior evaluator's previous ability to use the configured Supabase project, including a hosted URL, so the requested browser E2E run can exercise the existing remote test data and persistence path.

## Requirement re-check

From the user's perspective: `npm run eval:behavior:web` should accept the Supabase URL already configured for the test environment, whether it is local or hosted, and proceed to the real browser room workflow.

The prior local-only requirement is explicitly superseded by the user's later instruction: **"give up the local supabase plan , set e2e test config as before, remote Supabase was technically allowed, but test data could be written to the hosted project."** The browser run is therefore authorized to write test data to the configured hosted project.

| Requirement | User-visible feature | Must-exist artifact | Acceptance evidence | Work type | TDD? |
| --- | --- | --- | --- | --- | --- |
| Restore prior remote behavior | Browser runner accepts a valid hosted Supabase URL and creates its client | Updated environment loader and regression test | Test passes with a non-local URL; loader returns the configured client | executable | Yes |
| Preserve configuration validation | Missing URL/key still fails clearly | Existing loader guard and regression assertions | Test rejects missing credentials | executable | Yes |
| Use the existing configured project | Runner continues to load `.env` plus process overrides | Browser command output and run snapshot | `supabase_origin` records the configured origin without hostname rejection | result | No |
| Run the real browser path | Test-room creation, provider request, review, and persistence use the configured Supabase project | Timestamped run directory with case records and verdict | Product checks and behavior-subset results are written by the runner | result | No |

## Definition of done

- The browser runner no longer rejects a valid non-local Supabase URL.
- URL/key presence validation remains intact.
- Existing request capture, evaluator, redaction, product checks, and artifact behavior remain unchanged.
- A focused regression test distinguishes valid hosted configuration from missing configuration.
- Relevant documentation no longer claims that the browser runner is local-only.
- The hosted run is explicitly allowed by the user and may create test rooms/audit records in the configured project.
- No local Supabase stack is required for this run.
- The browser command is attempted against the configured application and Supabase project; its result is reported honestly if application, provider, or remote-project access blocks completion.

## Highest-risk boundary and smallest vertical slice

The highest-risk boundary is the browser runner's environment loader deciding whether the production Supabase client may be created for the configured origin. That decision gates the subsequent real browser path: `loadLocalEnvironment` → Supabase client → room/template operations → provider request → tutor review → persisted audit record. The live remote run will provide the network and persistence evidence; the Red test must isolate the policy branch so it does not create remote data.

The smallest usable Red slice is a Node test importing `loadLocalEnvironment`, supplying a temporary non-neutral `.env` URL/key fixture plus a distinct process override through the loader's testable env-file seam, and asserting that the override's hosted origin is accepted and returned while a fixture-only variable proves `.env` was read. It also clears each required credential and asserts the existing validation error. The observed evidence is the returned client's configured origin, the fixture variable, and the absence of the former hostname rejection; no remote write occurs during Red.

## Behavior properties and controls

| Property | Independent control | Non-neutral test observation | Shortcut rejected |
| --- | --- | --- | --- |
| Hosted URL is accepted | `REACT_APP_SUPABASE_URL=https://remote.example.supabase.co` | Loader returns the configured origin and a client | Retaining hostname allow-list or silently substituting localhost |
| Local URL remains accepted | `REACT_APP_SUPABASE_URL=http://127.0.0.1:54321` | Loader returns a client | Replacing the allow-list with a hosted-only rule |
| Missing URL is rejected | URL omitted with key present | Loader throws the existing missing-configuration error | Allowing an unusable client |
| Missing key is rejected | Key omitted with URL present | Loader throws the existing missing-configuration error | Allowing anonymous/unconfigured requests |
| Environment precedence is preserved | `.env` values plus process override and loader env-file seam | A temporary non-neutral `.env` fixture contributes a fixture-only variable while a distinct hosted `process.env` value overrides the fixture URL/key | Reading only `.env`, only process state, or ignoring the supplied env file |
| Browser workflow remains unchanged | Existing runner path after loader return | Focused tests keep all existing adapter/evaluator behavior passing | Moving remote policy into request construction or adding a second scorer |

## Explicit exclusions

- No changes to Candidate 11's prompt, model policy, frozen cases, rubrics, thresholds, or evaluator semantics. **Source:** user-provided plan, quote: "prompt, model policy, rubrics, and frozen expected labels are unchanged" and "Candidate 11’s production prompt and the frozen v1 behavior specifications, cases, rubrics, and thresholds will not be changed by this refactor."
- No local Supabase stack is required for the browser run. **Source:** the later user instruction, quote: "give up the local supabase plan"; the requested run uses the configured hosted project.
- No migration is invoked by this configuration change. **Source:** user-provided plan, quote: "The migration will be applied and verified only against local Supabase." This request changes only the endpoint policy and does not apply that migration.
- No separate scoring implementation is added. **Source:** user-provided plan, quote: "Refactor `tutor-system/scripts/browser-demo-tutor-behavior.js` so it no longer scores text itself." No behavior-label inference is added either; the same plan states: "Infer expected labels from the response" is not a responsibility of the shared evaluator. This change only removes the URL hostname rejection.

## Phase-safe path plan

| Phase | Paths | Semantic classification |
| --- | --- | --- |
| Red | `evals/promptfoo/v1/browser-demo-tutor-behavior.test.js` | test |
| Green | `tutor-system/scripts/browser-demo-tutor-behavior.js` | production/runtime tooling |
| Regression | no edits | verification |
| Documentation | `evals/promptfoo/v1/README.md`, relevant `tutor-system/claude_docs/*.md` only if they state local-only behavior | documentation |
| Result | `evals/promptfoo/results/qwen3.5-flash/web-test-rooms-<timestamp>/` | result artifacts |

**Route:** `full` — the requested path uses a network service and can create persistent remote test data; compact TDD is not eligible.
