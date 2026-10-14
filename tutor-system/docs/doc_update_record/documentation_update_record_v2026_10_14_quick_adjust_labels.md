# Quick Adjust display labels

Intent: record the display fix and evidence that Quick Adjust still submits and persists the configured parameter values.

- Date: 2026-10-14
- Baseline commit: `83690fe59f26b8b4edd89255d410775bd2424d1d`
- Updated document: `docs/ai-assistant-module.md`
- Change: existing dynamic metadata formats section names, parameter names, and option labels as readable words. The information modal uses the same parameter labels.
- Regression evidence: before the fix, the actual `AISuggestionBox` component suite had 3 failures for readable section/role labels and 3 passing existing tests.
- Verification: `npm test -- --watchAll=false --maxWorkers=1 --silent --runTestsByPath src/components/__tests__/AISuggestionBox.test.tsx src/components/__tests__/AISuggestionBox.guardMode.test.tsx src/contexts/__tests__/RoomContext.quickAdjustPersistence.test.tsx` passed all 13 tests across 3 suites.
- Covered behavior: displayed selected labels, information headings, both student role locks, internal regeneration values, retained selections after rerender, Guard control placement, and Quick Adjust persistence through RoomContext.
- Static verification: compiling the three changed TypeScript files and their imports with the repository's TypeScript options reported zero diagnostics. The full repository `tsc --noEmit` check reports existing test errors also reproduced by the parent on the unchanged baseline.
