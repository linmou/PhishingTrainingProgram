# Learning target review — local working record

Owner: root Codex agent. Branch: `review/learning-targets`. Base: `3becd9b`.

User scope: keep edits local until the template-by-template review is finished. Work only in the dedicated learning-target-review worktree. No staging or production changes during review.

## Current approved Nintendo change

The owner reversed KP5 removal: retain all five points. KP3 Observation task now reads exactly: “The post is not from an official Nintendo account but someone named Lucy Simms”. KP5 is restored from the archived document baseline with canonical task labels, including its original observation and behavior content. This supersedes the earlier removal decision below.

## Superseded Nintendo removal decision

Remove KP5; retain original KP1–KP4 unchanged. Owner considers KP5 redundant with KP4. “What to notice” must name an observable cue in the raw post, not an absence such as “no proof”. This applies to future target reviews; negative protective instructions in “What to do” remain allowed.

Updated frontend catalog and existing catalog tests. Archived SQL remains an immutable historical baseline; the test now checks the approved Nintendo subset and exact original inventories for other scenarios.

## Verification and release status

Python content comparison passed: exactly original Nintendo KP1–KP4, other inventories unchanged. `git diff --check` passed. Jest command attempted: `CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/detectionTemplates.test.ts src/services/__tests__/demoRoomTemplates.test.ts`; blocked because npm is unavailable in the current shell (exit 127). This is not a Jest pass.

Local review in progress; not released. Existing saved database templates and existing room/checklist data have not been changed. After review, the release owner must prepare the saved-template SQL update, rerun catalog tests with Node/npm available, and follow staging verification, merge and production verification under the repository release workflow. Live acceptance must confirm the five-target Nintendo configuration and revised KP3 wording and preservation of unrelated templates and historical learner data. No live fixtures were created; no cleanup required.

## Canonical source labels and prompt cleanup

Owner requested source expressions to directly match prompt expressions, removing the runtime conversion. Replaced source `What to notice:` with `Observation task:` and `What to do:` with `Behavior task:` in detectionTemplates.ts. Removed the global split/join rewriting from buildEcologicalChatCompletionMessages. Existing custom/legacy text is now passed verbatim, as are canonical source targets and progress copies. `What to understand:` was not part of the removed transformation and remains unchanged. Updated request-builder tests for both canonical and legacy verbatim transport; catalog tests compare canonical labels against the immutable archived document baseline.

A temporary Node v22.15.0 runtime at `/tmp/ptp-learning-target-runtime/` and `npm ci --ignore-scripts --no-audit --no-fund` (2,122 packages, exit 0) resolve the earlier missing-npm blocker. Dependency installation reported engine warnings for unused Promptfoo dependencies; this run does not execute Promptfoo. Direct TypeScript execution of the actual builder passed all 37 current catalog targets (including generic fallback) plus legacy/custom text. Python baseline comparison confirms exactly label changes and the approved Nintendo removal, with all other wording retained.

Before future release: prepare saved-template and versioned cyberbullying catalog updates from the final reviewed source, preserving historical versions and evidence. The existing cyberbullying version token is still the historical token during local review; assign the new immutable target version and retain historical ordering support when preparing the release. No live changes or model-behavior verification have occurred. Verify actual outgoing target text and affected tutor behavior on staging after all review edits are finalized.

Focused Jest verification: first attempt stopped before execution because `OAI_MODEL` was absent; rerun with `OAI_MODEL=local-test-model` (unit-test placeholder, no provider calls), temporary runtime on PATH and `CI=true` passed 46/46 tests across detectionTemplates, ecologicalTutorCall, demoRoomTemplates and cyberbullyingProgress (4 suites, exit 0). `git diff --check` passed. Local review remains in progress.

## Nintendo decision reversal verification

Restored KP5 and revised only the KP3 observation sentence as requested. Tests now require five Nintendo targets and exact archived content/order with the approved label and KP3 wording changes. Saved context updated so future agents do not reapply the superseded removal. Local only; no deployment.

Verification after reversal: focused detectionTemplates, ecologicalTutorCall and demoRoomTemplates suites passed 44/44 tests (3 suites); memory validation and `git diff --check` passed.

## Draft PR candidate — three combined trials

User authorized a new PR. Endpoint remains local review until the template review finishes; do not deploy or merge on the basis of this draft. Release owner: root Codex agent; next action is independent review and label adjudication, then explicit closeout of the template review before release preparation.

The learning tracer now evaluates the full inventory in three concurrent provider calls, with one system and one JSON user message per call. It applies an event only when two validated trials agree on both item ID and event kind. A failed trial prevents persistence; format-invalid trials retain one bounded repair. Duplicate/unknown targets and invalid quotes are rejected; ineligible events are omitted before voting. Per-trial token allowance is 2400. The shorter rules include five examples with real learner wording and corrected agent-authored judgments. The source catalog uses canonical task labels; Nintendo retains all five points with approved KP3 wording.

Local checks: 56 handler tests, 6 prompt/majority tests and 18 eval-tooling tests passed (80 total); `git diff --check` passed. The evaluator groups the full current inventory by historical response and limits actual provider requests to concurrency 32. Actual-handler run: `current-target-eval.cjs --concurrency 32 --env-file <existing private configuration> --output output/learning-target-review/ensemble-grouped-handler-eval-cap32-20261114.json`: 45/55 exact event matches, 1 unsupported update, 6 missed updates, 3 wrong event kinds, 8/8 positive controls and no invalid aggregate results. The command exits 1 because semantic mismatches remain; this is not an acceptance pass.

Limitations: labels are provisional agent-authored judgments; historical responses are exposed development regressions, including examples included in the prompt. New targets were substituted into older conversations, and room setup/history parity and reconstructed prior progress require further validation. The counterfactual experiment and the actual handler have different error handling and must not be represented as interchangeable acceptance evidence. No accuracy improvement or full lifecycle acceptance is claimed. Raw learner response evidence stays in local ignored output, not in the PR.

Release remains open: no live mutations or fixtures created, no staging lease acquired, no staging/production deployment or acceptance. Before release, prepare saved-template SQL and versioned cyberbullying catalog changes from the final reviewed source; preserve old target versions, progress and evidence. Verify combined grading/eligibility/lifecycle journeys, real provider behavior, target initialization and cleanup in staging and production under the repository gates. The current snapshot is draft review material, not deployable release approval. Roll back by restoring the prior committed Edge and frontend artifacts, preserving existing learner data; frontend source and saved catalogs must be aligned before promotion.
