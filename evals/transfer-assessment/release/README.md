# Historical transfer release evidence

The Wave 105 release generator and external browser adapter are retired as of 2026-10-24. Use the [current coverage audit and open gaps](../../../tutor-system/docs/transfer-assessment-wave105-audit.md), [active browser suite](../../../tutor-system/docs/browser-e2e-testing.md), and [deployment workflow](../../../tutor-system/docs/supabase-release-workflow.md).

Both committed run directories are historical `release_not_approved` bundles. IDs, statuses, hashes and paths have not been changed or moved. Their configured `disabled` expectation is not an observation of the hosted flag. The [2026-09-30 owner exception](../../../specs/orchestration/transfer-assessment/release-decision-2026-09-30.md) applies only to its named product version; it is not an automated evaluation pass.

The old npm release/browser commands have been removed. No `workflow_module` is supplied or implied to provide coverage. Historical source is available in Git at `4ff3f86f9e2ad06d9db33897893aafa2b18d026a`; the original matrix/configs remain frozen at their original paths.

Read-only inspection from the repository root:

```bash
node tutor-system/scripts/transfer-assessment-release.js --verify evals/transfer-assessment/release/transfer-release-20260924-wave105-local
```

The verifier reports unavailable author-machine absolute paths and hash mismatches as failures; it does not rewrite references or produce a new release decision. `transfer-assessment-history.sha256.json` and its offline preservation test establish unchanged checkout bytes, separately from historical source availability or any live acceptance result.
