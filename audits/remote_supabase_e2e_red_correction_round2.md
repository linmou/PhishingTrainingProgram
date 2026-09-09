# Red correction plan: environment-file precedence

The iteration-1 Red review disputed criterion `c1`: the test supplied only process environment values, so a loader that ignored `.env` could pass.

The correction is test-only. Update `evals/promptfoo/v1/browser-demo-tutor-behavior.test.js` to create a temporary `.env` fixture containing a distinct URL/key and a fixture-only marker, pass that file to `loadLocalEnvironment`, set distinct hosted process overrides, and assert both that the marker came from the fixture and that the process values won. The existing local-URL and missing-credential assertions remain unchanged.

The corrected test must fail against the current production function because it currently reads only the repository `.env` path and has no injectable env-file seam. The targeted command remains:

`python /Users/admin/.codex/skills/fast-multi-agent-tdd/scripts/tdd_snapshot.py run -- node --test evals/promptfoo/v1/browser-demo-tutor-behavior.test.js`

No production file is edited in this Red round. Green will add only the optional env-file parameter needed by this test while retaining the browser call's default path.
