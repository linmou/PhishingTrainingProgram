# Wave 105 retirement verification — 2026-10-24

Issue: #28. Source baseline: `4ff3f86f9e2ad06d9db33897893aafa2b18d026a` (`no_sign_up`). Candidate: branch `fix/28-retire-wave105-gate`, PR head; this record ships with the tested candidate. Scope: docs, tests, test tooling and deterministic PR CI only. No application/server behavior, SQL migrations, Edge source or hosted configuration changed. Deployment is not applicable.

## Result

Retired the Wave 105 generator and unimplemented browser adapter; removed their npm commands and fake-evidence/binding tests. Kept a read-only bundle verifier and checksums for all eight historical bundle JSON files plus three original matrix/config files. No historical bundle bytes or paths changed. Added the [17-case coverage audit](../transfer-assessment-wave105-audit.md), current result disclosure/progress assertions and retry→pass browser journey, plus an opt-in staging attack workflow that checks the real HTTP boundary and persisted state. The attack workflow is forbidden on production and excluded from default browser runs. Its offline tests exercise preflight and verdict logic only.

## Observed local verification

All commands run from `tutor-system/` unless specified. Node `v24.22.1`; dependencies installed with `npm ci --no-audit --no-fund --ignore-scripts`.

| Command / check | Observed result |
| --- | --- |
| `npm run test:assessment:audit` | **7/7 passed**: exact result disclosure, early/nested leak rejection, staging-only attack preflight, denial-result classification, frozen historical bytes, retired generation and read-only tamper/missing-source detection. These are offline checks, not live acceptance. |
| `CI=true REACT_APP_SUPABASE_URL=http://127.0.0.1:54321 REACT_APP_SUPABASE_ANON_KEY=ci-placeholder npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/transferAssessmentOrchestrator.test.ts src/services/__tests__/learningProgressTransitions.test.ts src/services/__tests__/transferAssessmentService.test.ts src/contexts/__tests__/transferAssessmentUiAdapter.lifecycle.test.ts src/pages/__tests__/RoomPagePost.transferDraft.test.tsx` | **5 suites, 75/75 tests passed**. Initial run without placeholder Supabase settings failed module initialization in three suites; rerun with the same no-hosted-state configuration as PR CI passed. Existing React act/router warnings remain. Transport is mocked. |
| `npm run test:e2e:unit` | **18 passed, 2 failed to launch** because local Playwright Chromium is absent. The two cases use a local HTML page, not staging. |
| `npx playwright install chromium` | Blocked: repeated CDN responses were truncated/invalid ZIPs (`End of central directory record signature not found`). No Chromium installed; the two browser cases remain unverified. |
| `node --test --test-skip-pattern='learner sends once\|assessment gate checks' scripts/browser-e2e.test.js` | **18 passed; 2 cases excluded by the explicit pattern** and not executed; only the unavailable local-browser cases were omitted. This does not replace a complete 20-case runner pass. |
| `node --check scripts/browser-e2e/workflows/assessment-answer.js` and `node --check scripts/browser-e2e/workflows/assessment-security.js` | Passed. |
| `git diff --check` (repository root) | Passed. |
| Read-only historical verifier on `transfer-release-20260924-wave105-local` (repository root) | **Expected nonzero**: missing original author-machine matrix path and an already-existing `report.json` bundle hash mismatch. Historical bytes match the pre-change checkout checksums; the old snapshot is not repaired or presented as valid. |

The new offline audit command is included in the existing `frontend-jest` PR job. GitHub CI and independent review are pending; local checks do not self-certify those results.

## Unverified acceptance / blockers

- No staging browser, HTTP security, SQL role/lifecycle or provider run was performed: this environment has no staging anon/service/management credentials or configured candidate app. No live target was probed, changed, activated or reset.
- The default runtime verifier's caller-controlled application-user header remains a source-observed identity weakness. The new anonymous forged-tutor probe must report acceptance as **fail**; its actual hosted result is unknown. This test/docs change does not fix or deploy a new authentication system.
- All six attack probes are implemented but **not live verified**. Same-room cross-learner/observer variants, authenticated-role inventory and full private-value checks in network/realtime/export/error surfaces remain open, as does current SQL execution.
- The old direct-role SQL file's fixed progress target can be absent. Its zero-row update is not accepted as coverage of a protected existing target; new HTTP probes use an existing question. Full replacement of that legacy SQL coverage remains open.
- No actual hosted flag observation or non-destructive rollback drill. The 2026-09-30 authorization and historical `release_not_approved` verdicts remain unchanged.
- Full local browser-runner acceptance remains blocked on Chromium installation. No production verification is authorized by this issue.

Issue #28 must remain open for these acceptance gaps. Draft PR is reviewable retirement/test work, not a claim that the whole issue or security acceptance is complete.

## Follow-up on the same PR — 2026-10-24

Two verifier weaknesses found during continued review are addressed:

- The old direct-role SQL test could report a zero-row update against a missing fixed target as authorization evidence. It now proves the tagged `transfer_v1` target exists, acquires its row lock before switching roles, fails immediately when absent (`DIRECT_ROLE_FIXTURE_MISSING`), and compares the complete target row after both role probes. `ON_ERROR_STOP` is explicit. This still requires provisioning that tagged target on an isolated migrated clone; do not assume the legacy race setup satisfies the current eligibility policy. **SQL execution is unverified** because no migrated validation database or staging access is configured here.
- The attack runner previously lost the case artifact when its persisted-state oracle failed. All six cases now begin as `blocked/not_run`; an oracle failure persists the failed case and stops later attacks. A failed post-attack oracle preserves the original attack failure as well. The outsider profile deletion is independently read back and its cleanup status saved. Five new offline tests exercise these failure paths and successful-denial bookkeeping; they are harness tests, not live authorization evidence.

Observed follow-up checks:

| Check | Result |
| --- | --- |
| `npm run test:assessment:audit` | **12/12 passed**, including unchanged historical bytes. |
| Complete `scripts/browser-e2e.test.js` using scratch-only launch-option preload and alternate Chromium | **20/20 passed**, including both real-browser local HTML tests, no exclusions. |
| Alternate browser | `@sparticuz/chromium@153.0.0` retrieved from npm (outside the repository), binary reports `Chromium 153.0.8010.0`. No browser package or lockfile changes were added to the app. A scratch preload changes only executable path, launch flags and font/library locations; assertions, DOM fixtures and application helpers are unchanged. This is an alternate-browser local run, not a claim that the unavailable pinned Playwright browser ran locally. |
| Earlier alternate-browser failures | Preserved: initial rendering failed due to font configuration; with fonts fixed, single-process Chromium closed when a context was replaced (19/20 passed). Correct font paths and normal multi-process launch produced the complete 20/20 pass. No test assertion was relaxed. |
| CI change | Existing `frontend-jest` job now installs the project's pinned Playwright Chromium with system dependencies and runs the complete local HTML runner suite. It does not run `scripts/browser-e2e.js` or use hosted credentials. Check the current PR head's actual CI results; the prior head's passing CI cannot certify this follow-up. |
| Syntax and whitespace | `node --check` on the changed attack workflow and `git diff --check` passed. |

Local reproduction of the alternate run used `node --require /tmp/ptp-chromium/preload.cjs --test scripts/browser-e2e.test.js`. The ephemeral preload points Playwright's launch to `/tmp/ptp-chromium/browser/chromium`, adds `--no-sandbox --disable-dev-shm-usage --no-zygote --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --in-process-gpu`, and sets that browser's font/shared-library locations. The supported CI command remains `npm run test:e2e:unit` after normal Playwright installation.

No connected Supabase tools or staging credentials are available. Hosted security/privacy acceptance, current SQL acceptance and rollback evidence remain open, as does the source-observed identity-header weakness. These changes strengthen verification tooling and do not deploy an authentication fix or authorize merge.

### Cleanup lease follow-through

The temporary outsider profile is a fixture outside the runner's room cleanup list. Its cleanup failure now carries an explicit marker into the runner report and shared-lease retention decision; successful room cleanup cannot mask an orphaned profile. A local harness case verifies persistence of that failure and the actual lease-retention predicate, while ordinary failed assertions with fully successful cleanup remain safe to release. The complete local HTML runner suite passed **21/21** with the same alternate Chromium/toolchain; the audit suite remains **12/12**. No hosted cleanup or lease operation was performed.

## Remaining verification implementation completed — 2026-10-24

Follow-up source baseline: `621836cfcf49c22a457cfd6cd8b1e6cfb3363455`; final candidate is the current PR #29 head. No runtime application, Edge, database migration or hosted configuration changes are introduced.

- Implemented opt-in staging `assessment-privacy`: real learner request/response bodies, realtime message records (not heartbeats), DOM, JSON/TXT downloads, forbidden-review error responses, retry/pass/failure/reload. Unique private canaries are persisted and verified in private assessment/provider storage. The synthetic provider row is conspicuously `privacy_fixture_only`, never recorded as a valid provider or quality result. Terminal disclosure requires matching private grading authority and the exact saved second-failure result. Findings contain no private value material; raw download files are removed.
- Expanded the six-case security workflow with same-room observer/foreign-answer processing, a valid owner paired with a mismatched room/assessment, both anon and real authenticated-role field/RPC attacks, and privileged catalog confirmation for absent/revoked legacy endpoints. Auth accounts/JWTs are real temporary staging fixtures when run; secrets are in memory only. Missing auth setup blocks the relevant cases. Auth/profile deletion is verified, including ambiguous creation responses with a preselected UUID. Cleanup failures retain the shared lease.
- Replaced the direct-role test's inherited fixed target with a self-contained current-format SQL fixture and valid pending answer. It attempts actual grading/private writes/reads and progress changes under anon/authenticated, compares authority and target rows, and rolls everything back. This file has **not** been executed against a migrated baseline here.
- Both new staging workflows remain explicitly opt-in and fail before production fixture work. The default eleven-workflow suite and no-hosted-state PR CI remain isolated from staging.

Observed checks: **20/20 audit checks passed**; **22/22 complete browser-runner checks passed** with the previously documented alternate Chromium. The new browser case uses a real local HTTP/WebSocket server to confirm body/frame capture and private-value detection; it is instrumentation evidence, not staging privacy evidence. Syntax checks for all changed JS and `git diff --check` pass. The newly explicit `ws@8.21.0` dev dependency reuses the exact version already in the lockfile; no package upgrade was introduced.

The remaining obstacle is access/execution, not missing verification code: no staging credentials, connected Supabase tool or migrated database snapshot are available in this session. GitHub's available connector can inspect CI and rerun existing jobs but exposes no workflow-dispatch operation or staging-secret access. No secret values were requested or exposed, no deployment workflow was run, and no hosted flag was changed. Source-observed identity spoofability remains a failing acceptance expectation, not a passed attack or a required identity-system migration in this test-retirement PR.

The PR can be reviewed as an implementation. Issue #28 and hosted acceptance remain open until the selected staging workflows, current SQL tests and non-destructive operational verification actually run. Required CI must be checked on the final head; earlier passing heads do not certify later edits.
