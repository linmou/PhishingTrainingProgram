# Rating prompt display update

Intent: record the neutral question shown before a student selects a star and the regression evidence.

Date: 2026-10-14
Baseline commit: `83690fe59f26b8b4edd89255d410775bd2424d1d`

## Behavior and documentation

`RoomContext.md` now explains the unselected question in both the inline comment popup and mandatory reply dialog. Hovering can preview stars, but the question remains until the first click. Existing stored ratings continue to show their level when reopened and can be edited.

The cause was using the hovered star value for the description before the selected value was nonzero. Both description expressions now require a selected rating before displaying a level.

## Verification

Run from `tutor-system/`:

```sh
rtk proxy env REACT_APP_SUPABASE_URL=http://127.0.0.1:1 REACT_APP_SUPABASE_ANON_KEY=local-test CI=true npm test -- --watchAll=false --maxWorkers=1 --silent --runTestsByPath src/components/__tests__/PostComment.test.tsx src/__tests__/tutor_response_rating_gate.integration.test.tsx
```

- Before the fix, the actual comment popup and required room dialog lost the neutral question on hover: 5 tests failed, 18 passed.
- After the fix, both suites pass: 23 tests, including positive/negative unselected hover, disabled submission before clicking, selected values passed to persistence, and reopening/editing stored ratings.
- The test contexts supply feedback persistence mocks and the environment uses a loopback placeholder; verification does not use a live database.
- `tsc --noEmit --pretty false` reports repository type errors, including unrelated test mocks and missing declarations. A full TypeScript compiler API check found 454 diagnostics across the repository and zero diagnostics in the four changed TS/TSX files.
