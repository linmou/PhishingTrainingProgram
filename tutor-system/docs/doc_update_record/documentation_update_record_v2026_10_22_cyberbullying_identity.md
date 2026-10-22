# Cyberbullying generation identity handoff

Intent: record the authorization failure, regression coverage and release verification for AI generation in an already-open room.

Updated: 2026-10-22. Starting commit: `3acec373`. Release owner: Codex /root. Batch: `cyberbullying-generation-identity`.

Status: production verified and cleanup complete. Integrated release: `8e5f880c9c42cb5f3ff8d8b66709262a520f0a8f`.

## Failure and change

The reported room `7c66a400-8365-4d85-a991-cccfd00d4bd2` produced assessment-api HTTP 401 at 02:03:57.980 and 02:04:02.520 UTC. Clicking AI awaits learner-progress analysis before requesting a character draft. Progress transport independently read localStorage while RoomContext held the active user in React state. Removing the stored identity in an already-open tutor UI reproduced the exact reported alert and prevented any ai-api call. A fresh tutor session generated successfully in 6504 ms. The original tab's historical reason for losing or sending an invalid identity remains unconfirmed.

RoomContext now passes its active actor through chronological progress analysis into the assessment request header for tutor generation and learner message analysis. Explicit identity takes precedence over browser storage; existing service-only callers retain their stored-identity path. Server authorization remains authoritative. The generic authorization message now describes the action/session rather than assessment delivery.

Changed factors: frontend actor propagation and authorization error presentation. Prompt, model, response parsing, server permission checks and database contracts are unchanged. No SQL or Edge deployment is required.

## Verification scope

Local: a RoomContext integration regression uses the real ChecklistService, TransferAssessmentService and default transport with a mocked HTTP boundary. Missing, different and unreadable stored identity must send the active tutor header and yield a draft; an actual server authorization rejection must still block generation. Run affected Cyberbullying, phishing generation, learner ingress/answer/concurrency, chronological replay and service contract suites; browser harness checks; TypeScript and frontend build. Mypy is inapplicable to these TypeScript changes.

The initial regression run failed all three storage cases with AssessmentApiRequestError UNAUTHORIZED, with ten existing/failure cases passing. A second attempted Red JSON capture raced the implementation and captured stale expectation failures instead; it is retained as an intermediate result, not Red evidence. The first completed console run is the Red evidence. An initial service-suite invocation lacked inert Supabase environment configuration; subsequent runs provide it. Two test expectation edits initially referenced unimported fixture variables; these were corrected before acceptance.

Staging and production: run the complete Cyberbullying browser journey, extended to remove/replace tutor localStorage after room entry, clear the analysis cache, assert assessment-api HTTP 200 with the active tutor header and observe the draft. Preserve provider IO, identity-check evidence, review publication and fixture cleanup. Also run ordinary tutor-response, Guard and assessment-answer journeys because they share the modified progress-analysis callers. Use separate fresh fixture users and the cross-machine project lease. No user-room messages will be published for verification.

Dependencies owned by this release owner: unchanged hosted assessment-api/ai-api and shared progress/approval database contracts; compare deployed source before accepting evidence. Candidate frontend must be merged into `no_sign_up`, compared with the staging-tested source and verified on the production Render deployment before release completion.

## Results

Local acceptance passed: 137 distinct tests across ten focused suites (nine passing suites in `output/browser-draft/identity-focused-final.json`, plus the corrected 16-test draft-lifecycle suite in `identity-draft-lifecycle-final.json`). The fixture's mocked active tutor is `tutor-1`, independent of the stored room fixture owner; the assertion now uses that active actor. Browser harness: all 20 tests passed. Production frontend build passed with the previously recorded lint warnings. TypeScript reports the same 442 inherited test diagnostics, zero runtime diagnostics and zero diagnostics in the changed Cyberbullying regression.

The first full PR CI run `39711143417` passed the build and isolation checks, with 1445 tests passing and two older facade assertions failing because the transport now receives an optional second actor argument. Those two expectations now include the absent actor explicitly. All six facade tests pass; focused local coverage totals 143 distinct tests. Runtime files are unchanged by this test correction.

## Staging acceptance

Runtime candidate: `37b8162667b994696870929f4b3bd366b97c6a49`. Manifest: `output/cyberbullying-identity/candidate-manifest.json`. Lease: `output/cyberbullying-identity/staging-lease/coordination-lease.json`, held through all four journeys and cleanup, then released.

Each report under repository `tmp/browser_demo_runs/` passed with every fixture cleanup passing:

- `staging-template-20261022022359-d6b3dfba`: full Cyberbullying journey. Its `cyberbullying-identity-checks.json` confirms both missing and another-user storage cases used active tutor `6c251a12-6787-462e-a5e4-59acd30e6c25`, assessment-api HTTP 200 and a visible character draft. Shared review, Guard, ratings/export and reload behavior passed.
- `staging-template-20261022022511-662e563e`: ordinary phishing tutor response and persisted review.
- `staging-template-20261022022545-9136fa12`: phishing Guard entry/recovery.
- `staging-template-20261022022651-ef64df66`: assessment-answer lifecycle, including all four fixture uses and cleanup.

Retrieved deployed source matches the candidate for all three ai-api files and eleven assessment-api files in both staging and production. Production MCP reports unchanged ai-api v5 and assessment-api v17. This release needs only the frontend. Production baseline at staging acceptance was Render deployment `dep-dbcjpf49v7es73bkfnq0` at `3acec373`; it was superseded by the integrated deployment below.

## Integration and production deployment

Corrected candidate `2d8909f819fb91d2dd5be7a997d303bc3e802b07` passed all three required checks in CI run `39711598022`: 143 Jest suites and 1447 tests passed (92 existing skipped tests), frontend build and isolation harness. PR #15 merged into `no_sign_up` as `8e5f880c9c42cb5f3ff8d8b66709262a520f0a8f`. Its affected runtime and browser workflow files are byte-identical to the staging candidate. Integrated CI run `39718683763` also passed. Manifest: `output/cyberbullying-identity/release-manifest.json`.

Both local worktrees fast-forwarded to the integrated commit; unrelated changes in the main worktree were preserved. Production verification lease: `output/cyberbullying-identity/production-lease/coordination-lease.json`. Hosted ai-api and assessment-api source was compared again against the integrated commit and still matched all 14 original files.

Render deployment `dep-dbcoe4dg1s2s7389ecug` is live from `8e5f880`. A first canonical HTML fetch briefly served the prior cached bundle after Render reported live; production browser verification waited for the new asset. At 03:48:23 UTC, canonical HTML served `/static/js/main.0c3e07b2.js`, SHA-256 `8a29eb9649791b1e2e518179d0bc1cce887a46e5cce5b05d71094bbf01307fd9`. All 74 first-party source-map originals match the integrated commit, including the four changed runtime modules. Evidence: `output/cyberbullying-identity/production-frontend.json`; the initial cache observation is retained separately.

The original reported room was also rechecked at `http://localhost:3001/#/room/7c66a400-8365-4d85-a991-cccfd00d4bd2`: remove stored identity after loading the tutor UI, clear the progress cache, then click AI. At 03:47:45 UTC, analysis and character generation both returned HTTP 200 with actor `38c081df-5ce8-40d6-a77c-1de4fe5938c0`, and a character draft appeared. No message was published. Full requests/responses and screenshot: `output/cyberbullying-identity/reported-room-fixed.json` and `reported-room-fixed.jpg`.

## Production acceptance

Completed browser journeys against the public Render app, with cleanup passing:

- `production-template-20261022034841-6f7a7bd1`: full Cyberbullying journey. Both missing and another-user storage cases returned analysis HTTP 200 under the active tutor and displayed a draft.
- `production-template-20261022035001-092fb631`: ordinary phishing tutor response.

- `production-template-20261022035033-70ed1a45`: phishing Guard entry/recovery.
- `production-template-20261022035237-66a87782`: assessment-answer lifecycle, including grading, retry, cancellation, Guard deferral, recovery and owner clear.

All four reports and every recorded fixture cleanup passed. The production lease was released after acceptance. Aggregate evidence: `output/cyberbullying-identity/production-acceptance.json`; full reports and provider IO remain in the run directories above. No SQL or Edge changes were made. Staging and production acceptance criteria are complete.

The previous unit tests mocked progress analysis as successful, bypassing the failing identity-header path; the previous browser journey used consistent stored identity. The new integration regression and live storage-removal/replacement checks cover that gap without asserting model wording.
