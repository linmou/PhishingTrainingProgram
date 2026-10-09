# Legacy UI Test Repair Record

Intent: Record test-only corrections for legacy UI suites whose fixtures no longer matched current component contracts.

Date: 2026-09-27
Implementation commit: `5fbb74c`

## Scope

- Use radio-role queries in `SimpleLogin` tests so role descriptions do not match multiple labels.
- Mock `useAuth` and call `joinRoom` through the rendered context in the avatar enrichment test.
- Assert preset avatar updates through the current `updateUserProfile` auth method.

## Verification

- Focused run: 3 suites passed, 23 tests passed.
- `git diff --check`: passed for the implementation commit.
- The four-directory regression was not rerun for this focused batch.
