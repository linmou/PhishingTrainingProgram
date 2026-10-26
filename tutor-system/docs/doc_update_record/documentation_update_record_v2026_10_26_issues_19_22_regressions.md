# Issues 19–22 deterministic verification

Intent: record regression and build evidence for the scoped issue integration.

Updated: 2026-10-26. Verification baseline: `f4b3fa0` on `integration/issues-19-22-20261026`.

The isolated branch contains feedback batching, bounded room synchronization,
assessment-ordering performance and membership/realtime ownership changes,
with their fixture and reconnect repairs. The current baseline AI-call
expectations passed without modification. The separate issue 2 prompt and
evaluation work remains suspended.

The full regression suite ran with one worker and the same credential-free
local Supabase placeholders as `.github/workflows/verify-pr.yml`:

```sh
rtk proxy env CI=true REACT_APP_SUPABASE_URL=http://127.0.0.1:54321 REACT_APP_SUPABASE_ANON_KEY=ci-placeholder npm run test:regression -- --runInBand --silent
rtk proxy env CI=false GENERATE_SOURCEMAP=false npm run build
```

Results: 148 suites and 1,478 tests passed, plus the existing snapshot;
five suites and 93 tests were skipped by the existing configuration. The
production build passed with existing warnings. Full logs are retained in
ignored `output/verification-issues-19-22-20261026/regression-ci-env.log`
and `build-initial.log`. An initial run without the CI placeholder environment
failed client initialization and was stopped; its log remains preserved.

Review identified 13 trailing-whitespace lines in the extracted membership
and realtime hooks. Only that whitespace was trimmed. The same TypeScript
program reports 446 repository diagnostics and zero diagnostics for these
two files; the summary is `typescript-affected.log` in the same log directory.
`git diff --check` passes. Existing nearest fixture documentation was reviewed;
no fixture or runtime contract changed in this verification repair.

Hosted checks, CI and release coordination remain with the integration owner.
No hosted operations were performed here.
