# Temporary tutor audience integration

Intent: record documentation accompanying the user-authorized temporary fourth-grade prompt adoption.

Date: 2026-11-04. Source baseline: `a69b836`.

Reviewed the active tutor policy and adjacent behavior documentation. Added [the temporary adoption record](../ai-behaviors/temporary-fourth-grade-prompt.md) with the user's decision, experiment provenance, known factual/length/teaching regressions and replacement criteria. The source comment marks the policy temporary without injecting development-status text into learner messages.

Verification: the integrated policy exactly matches the experimental candidate after trimming outer whitespace (SHA256 `3802306babc4a92baf1ecc35241856c3e7eeda357e063ec3b06bd0fcac23c370`). Existing ecological request-packaging and transfer request-contract tests passed: 2 suites, 20 tests, using `CI=true npm test -- --watch=false --runInBand --runTestsByPath src/services/__tests__/ecologicalTutorCall.test.ts src/services/__tests__/transferTutorRequestV3.test.ts`. `git diff --check` passed. This establishes artifact and wiring fidelity, not a new model-quality acceptance result. Hosted release is outside the user's requested first merge step.
