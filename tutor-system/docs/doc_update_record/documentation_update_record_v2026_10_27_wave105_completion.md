# Wave 105 current acceptance

Intent: reconcile issue #28 with completed configuration delivery and current staging attack evidence.

Updated: 2026-10-27. Source baseline: `18b3109`. Verification owner: Codex root agent. Issue: [#28](https://github.com/linmou/PhishingTrainingProgram/issues/28).

## Verification scope

This continuation changes the staging security harness and audit documentation. No server contract, model, prompt or grading rule changes. The existing public-configuration release completed the staging disable/history-preservation/restore drill; its exact evidence is recorded in [public flag delivery](documentation_update_record_v2026_10_26_public_feature_flag.md). No production test or deployment is required for this continuation.

Target: staging `ciubrzggdqesgvfkpolj`. Selected live check: `assessment-security`, under the runner's exact-candidate shared lease. Require all six attack verdicts, persisted-state hashes, deployed versions and fixture/identity cleanup. An observed authorization weakness stays a failure and does not become an accepted product contract. Existing staging privacy/configuration evidence is reused only for its recorded source/configuration scope.

The direct-write probes now send different values for anonymous and authenticated roles, so the second role cannot merely repeat the first role's mutation. Direct writes run after stale-question testing so earlier public-field corruption cannot affect the stale lifecycle precondition. Unexpected denials retain a bounded error code without retaining private response messages; a new code is not automatically accepted.

## Results

Focused deterministic checks pass: `test:assessment:audit` 22/22 (including the replay preflight), `test:e2e:unit` 29/29. Historical checksums and `git diff --check` pass.

Candidate `e7ca1c54d04bc9ec64f6b5ad17065a14914c6cb9` completed staging run `staging-template-20261027202110-e1af075b`: cross-learner, cross-room and legacy RPC passed; forged identity and direct writes failed. Every anonymous and authenticated result/lifecycle/selection/options PATCH returned HTTP 200 and independently changed the persisted hash. Trusted-event writes and direct private-review RPCs were denied under both roles. All room, outsider and Auth/profile cleanup passed; lease released, candidate app stopped. Wrapper commands and timestamps are in `output/public-assessment-flag-20261026/staging-1793132467240/`.

The stale-question probe returned HTTP 409 `WRONG_LEARNER` and preserved its state hash. Direct staging MCP inspection of `public.post_assessment_message_v2(uuid,text,uuid,uuid,text[],uuid,uuid)` confirms its combined condition raises that code when the assessment lifecycle is not open. The test already establishes the same learner's successful prior answer, actual assistance cancellation and persisted cancelled question before the stale attempt. Accept that documented live denial code in this probe, while retaining the preconditions and state comparison. This corrects the test contract; it does not weaken authorization or change runtime behavior. The initial failed verdict remains preserved.

Read-only staging MCP function observation: assessment-api v79, bundle `50474c5705db85f002f70ab3f59cabe02b3710cd970d4d01ce17ab0551dd607c`; ai-api v8, bundle `3bd3415490bed08a5992b2fff8db135b897bd1f02c45f5fd249de3bb1f4ab519`. No function was deployed.

Corrected candidate `ee8b02d` completed `staging-template-20261027202248-78fb6efb`: cross-learner, cross-room, legacy RPC and stale question pass; forged identity and direct writes still fail. The stale attempt returns HTTP 409 with identical before/after SHA-256; every attack runs. Both room cleanups, outsider cleanup and Auth/profile cleanup pass; the lease releases and the app stops. Wrapper evidence: `output/public-assessment-flag-20261026/staging-1793132565081/`. Historical bundles and frozen matrix/configuration inputs remain unchanged.

## Replay and reconnect coverage

The opt-in staging-only `assessment-replay` workflow closes the remaining US1-S6 implementation gap: repeats the exact answer request, grades that answer with two simultaneous HTTP requests, checks one persisted attempt/result, disconnects the learner's actual realtime socket while offline, then requires the missed result to appear on reconnect without reload. A subsequent replay/reload must preserve assessment/attempt/result identities. No fixture result or transport response is injected. The runner restores browser network access before cleanup and retains its lease if restoration fails.

Candidate `9920991446fb0210083fac5361f2d15a908b0a0f` passed `staging-template-20261027202702-a6402864` on 2026-10-27. Repeating request `2487e417-ab69-4195-8905-610741d3b559` returned answer `86a8e659-e549-4df4-a0d8-d25a1385b6dc` both times. Both concurrent grading requests returned HTTP 200 with `passed`, retaining one attempt (`90b7614f-4417-4c66-9366-58d805b2b826`) and one result (`bd5a8836-ef60-461b-a696-5308d83092c1`). The actual learner realtime connection was closed while offline at 20:27:10 UTC; the result was saved while absent from the learner DOM, then appeared after reconnect at 20:27:13 UTC without page reload. Later grading replay and page reload preserved the exact assessment/attempt/result snapshot. Fixture cleanup passed, lease released and app stopped.

Full report and per-operation metadata: `tmp/browser_demo_runs/staging-template-20261027202702-a6402864/{report.json,assessment-replay.json}`. SHA-256: report `7e3cf96dd95fce9ec88bb836b4e4e66a67d09bd2defc1eb122e5d7fcadabb7f7`; replay evidence `98a5ceca7ded230cba9124545de2e40a3a9fb8e6ca53fb6a8c1cdded7de137f5`. Command/app logs and exit status: `output/public-assessment-flag-20261026/staging-1793132818807/`. Staging MCP observations after both runs match the v79/v8 versions and bundle hashes above.

## Handoff

[PR #42](https://github.com/linmou/PhishingTrainingProgram/pull/42) contains the test/documentation continuation. All 11 scenarios and six attacks are mapped; the actual identity and direct-write failures remain explicit. The audit's completion does not require an unrelated identity migration or imply permission to accept those failures. Current-head CI and independent review remain delivery gates before integration; issue #28 remains open pending that integration. No production operation was performed in this continuation.

GitHub Codex review could not start: the [review bot reports exhausted code-review usage](https://github.com/linmou/PhishingTrainingProgram/pull/42#issuecomment-6452767126) and [insufficient available credits](https://github.com/linmou/PhishingTrainingProgram/pull/42#issuecomment-6452784841). An explicit `@codex review` retry encountered the same account limitation. These are unavailable reviews, not code findings or an approval. No merge is performed while the independent review gate is unmet. A maintainer can restore the review service's allowance or arrange an authorized independent review; no spending or approval-rule change is included in this task.
