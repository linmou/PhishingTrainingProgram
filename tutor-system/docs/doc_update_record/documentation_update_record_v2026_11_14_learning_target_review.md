# Learning target review — local working record

Owner: root Codex agent. Branch: `review/learning-targets`. Base: `3becd9b`.

User scope: keep edits local until the template-by-template review is finished. Work only in the dedicated learning-target-review worktree. No staging or production changes during review.

## Approved Nintendo change

Remove KP5; retain original KP1–KP4 unchanged. Owner considers KP5 redundant with KP4. “What to notice” must name an observable cue in the raw post, not an absence such as “no proof”. This applies to future target reviews; negative protective instructions in “What to do” remain allowed.

Updated frontend catalog and existing catalog tests. Archived SQL remains an immutable historical baseline; the test now checks the approved Nintendo subset and exact original inventories for other scenarios.

## Verification and release status

Python content comparison passed: exactly original Nintendo KP1–KP4, other inventories unchanged. `git diff --check` passed. Jest command attempted: `CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/detectionTemplates.test.ts src/services/__tests__/demoRoomTemplates.test.ts`; blocked because npm is unavailable in the current shell (exit 127). This is not a Jest pass.

Local review in progress; not released. Existing saved database templates and existing room/checklist data have not been changed. After review, the release owner must prepare the saved-template SQL update, rerun catalog tests with Node/npm available, and follow staging verification, merge and production verification under the repository release workflow. Live acceptance must confirm the four-target Nintendo configuration and preservation of unrelated templates and historical learner data. No live fixtures were created; no cleanup required.

## Canonical source labels and prompt cleanup

Owner requested source expressions to directly match prompt expressions, removing the runtime conversion. Replaced source `What to notice:` with `Observation task:` and `What to do:` with `Behavior task:` in detectionTemplates.ts. Removed the global split/join rewriting from buildEcologicalChatCompletionMessages. Existing custom/legacy text is now passed verbatim, as are canonical source targets and progress copies. `What to understand:` was not part of the removed transformation and remains unchanged. Updated request-builder tests for both canonical and legacy verbatim transport; catalog tests compare canonical labels against the immutable archived document baseline.

A temporary Node v22.15.0 runtime at `/tmp/ptp-learning-target-runtime/` and `npm ci --ignore-scripts --no-audit --no-fund` (2,122 packages, exit 0) resolve the earlier missing-npm blocker. Dependency installation reported engine warnings for unused Promptfoo dependencies; this run does not execute Promptfoo. Direct TypeScript execution of the actual builder passed all 37 current catalog targets (including generic fallback) plus legacy/custom text. Python baseline comparison confirms exactly label changes and the approved Nintendo removal, with all other wording retained.

Before future release: prepare saved-template and versioned cyberbullying catalog updates from the final reviewed source, preserving historical versions and evidence. The existing cyberbullying version token is still the historical token during local review; assign the new immutable target version and retain historical ordering support when preparing the release. No live changes or model-behavior verification have occurred. Verify actual outgoing target text and affected tutor behavior on staging after all review edits are finalized.

Focused Jest verification: first attempt stopped before execution because `OAI_MODEL` was absent; rerun with `OAI_MODEL=local-test-model` (unit-test placeholder, no provider calls), temporary runtime on PATH and `CI=true` passed 46/46 tests across detectionTemplates, ecologicalTutorCall, demoRoomTemplates and cyberbullyingProgress (4 suites, exit 0). `git diff --check` passed. Local review remains in progress.
