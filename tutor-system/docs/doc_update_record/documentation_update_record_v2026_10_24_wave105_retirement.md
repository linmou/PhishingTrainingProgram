# Wave 105 retirement verification — 2026-10-24

Issue: #28. Source baseline: `4ff3f86f9e2ad06d9db33897893aafa2b18d026a` (`no_sign_up`). Candidate: branch `fix/28-retire-wave105-gate`, PR head; this record ships with the tested candidate. Scope: docs, tests, test tooling and deterministic PR CI only. No application/server behavior, SQL, Edge source or hosted configuration changed. Deployment is not applicable.

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
