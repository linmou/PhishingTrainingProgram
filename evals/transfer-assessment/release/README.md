<!-- Updated: 2026-09-30; Base commit: 97ebe9fd11d78ab2874e098415f84e4c3eaf608d -->

Intent: explain how the transfer release evidence bundle is produced and how incomplete release prerequisites remain visible.

# Transfer Release Evidence

The release runner is `tutor-system/scripts/transfer-assessment-release.js`. Run it from the repository root through the registered package command:

```text
npm run eval:transfer:release --prefix tutor-system -- --config scripts/transfer-assessment-release.config.json --evidence ../evals/transfer-assessment/upstream --output ../evals/transfer-assessment/release
```

The dedicated browser lane is registered as `eval:transfer:browser`. It requires an isolated
target, both credential environment variables, and a configured `browser.workflow_module` that
exports `run({ teacherPage, learnerPage, config, env, events, runDir })`:

```text
npm run eval:transfer:browser --prefix tutor-system -- --config scripts/transfer-assessment-release.config.json --output ../evals/transfer-assessment/release/browser
```

Each browser run writes exclusive `browser.json`, `privacy.json`, `attacks.json`,
`activation.json`, and `rollback.json` artifacts. Evidence references are SHA-256 checked against
their source bytes both when the browser bundle is written and when the release runner consumes
it. A source-byte mismatch or malformed reference blocks every browser scenario and lane;
learner-scoped captures are redacted, and missing prerequisites produce blocked scenario and lane
rows without launching a browser.

Each invocation creates a new directory under `evals/transfer-assessment/release/<run-id>/` containing `snapshot.json`, `run-record.json`, `report.json`, and `verdict.json`. The runner uses exclusive writes and records hashes for the consumed configuration, scenario manifest, and upstream evidence. Verification recomputes those hashes without changing the bundle:

```text
npm run eval:transfer:release --prefix tutor-system -- --verify <run-id> --output ../evals/transfer-assessment/release
```

Release rows use only `pass`, `fail`, `blocked`, `missing`, `error`, and `not_applicable`. Missing upstream evidence, absent verified principals, and unavailable browser/privacy/attack/activation/rollback drivers remain blocking evidence. The runner never enables `TRANSFER_ASSESSMENT_ENABLED`.

The 2026-09-30 owner decision for the product-code version named in `specs/orchestration/transfer-assessment/release-decision-2026-09-30.md` authorizes release with incomplete gates. It does not change this runner's ordinary `release_not_approved` verdict. The runner records `disabled` from its configured expectation; it does not measure the hosted flag state.

The preserved local wave-105 browser run is
`/tmp/transfer-browser-wave105/wave105-blocked-20260924/`; its `verifyEvidenceBundle` result is
`ok: true` and its status is `blocked`. The corresponding release bundle is
`/tmp/transfer-release-wave105/wave105-release-blocked-20260924/`, with
`release_not_approved` and `activation_eligible: false`. This checkout has no isolated migrated
target, verified release principals, or workflow module, so a passing deterministic or
integration test does not replace those release lanes.
