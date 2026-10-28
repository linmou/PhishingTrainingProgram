# Deferred repository issues

Intent: retain confirmed baseline failures discovered during five-target implementation without broadening its scope.

Updated: 2026-10-15. Baseline commit: `8441f11`.

- `tutor-system/src/services/__tests__/promptComparisonRooms.integration.test.ts:73`: expects temperature `0.17`, while the current service sends `0.3`. Reproduced in the original checkout; five-target implementation does not change that setting.
- `tutor-system/tsconfig.json`: project type checking reports 454 diagnostics in 33 files. Comparing original and changed TypeScript sources under the same compiler produced identical diagnostics and zero additions. The build passes; baseline type errors need separate repair.
