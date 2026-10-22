# Cyberbullying generation identity handoff

Intent: record the authorization failure, regression coverage and release verification for AI generation in an already-open room.

Updated: 2026-10-22. Starting commit: `3acec373`. Release owner: Codex /root. Batch: `cyberbullying-generation-identity`.

Status: staging verified; integration and production acceptance remain open.

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

Retrieved deployed source matches the candidate for all three ai-api files and eleven assessment-api files in both staging and production. Production MCP reports unchanged ai-api v5 and assessment-api v17. This release needs only the frontend. Production baseline Render deployment `dep-dbcjpf49v7es73bkfnq0` is live at `3acec373`; the fix is not yet deployed there.

Pending corrected-candidate CI, integration/source comparison, production frontend release and all four corresponding production browser journeys.
