# Image service ownership and timer maintenance

Intent: record the ownership decisions and verification for issues #64 and #66.

Updated: 2026-11-08. Source baseline: `a69b836b7a46d801beb8139415691f4cb3b494ae`.
Coding owner: `images_timers`; integration and release owner: root orchestration agent.

## Ownership decision

Repository-wide searches for `uploadTutorImage` and `deleteTutorImage` found the
production upload caller in `components/ImageUpload.tsx`, importing `imageUpload.ts`.
The dedicated module's behavior tests and both upload-component suites use the
same owner. Only two export checks in `imageServices.test.ts` and the service guide
advertised the duplicate `supabase.ts` exports. Those checks now import the dedicated
module; the old business implementations are retired. `getTutorImages`, avatar
facade APIs and other active `supabase.ts` operations remain their existing owners.

`package.json` marks this frontend package private and exposes no published library
entrypoint. No supported external module contract was found in repository sources;
this inventory does not establish that arbitrary out-of-repository consumers are
absent. The supported application contract is the existing dedicated module's
`ImageUploadResult`, file/role/room checks, user-scoped timestamp path, upload
rollback, and storage removal followed by soft deletion. No authorization, schema,
storage policy or server implementation changes are part of this maintenance.

## Timer behavior

Typing cleanup keeps the prior array when no entry expires and retains the existing
five-second boundary. Upload simulation keeps the prior state at 90%, sets 100%
only on success, and clears its interval on success, failure results, rejection or
unmount. The delayed success reset and typing-stop timeout are also cleaned up on
unmount; late upload results do not publish state or invoke component callbacks.

## Verification

- Five focused suites pass: `imageUpload.test.ts`, `imageServices.test.ts`,
  `ImageUpload.test.tsx`, `ImageUpload.simple.test.tsx`, and
  `roomOwnershipHooks.test.tsx`: 92 tests passed with explicit dummy Supabase URL/key,
  `CI=true`, `--watchAll=false --runInBand --silent --runTestsByPath`.
- Fake timers cover empty, unchanged and mixed-expiry typing state with array
  identity assertions; avatar and tutor-image uploads remain capped during long
  requests with no repeated React commits; success, failure, rejection and unmount
  verify timer counts and visible state/callback behavior.
- Storage-boundary tests cover role, room/image ownership, invalid files, upload
  success, storage response/rejection failures, upload rollback, soft deletion and
  metadata failure after object removal.
- Focused strict TypeScript compilation passes for all changed source/tests plus
  `setupTests.ts`, with `--noEmit --skipLibCheck --esModuleInterop --strict --jsx
  react-jsx --target es2015 --module esnext --moduleResolution node --lib dom,esnext
  --types node,jest`. The full project `tsc --noEmit` remains red on unrelated legacy
  test fixtures and mocks; it is not reported as passing. Two existing export-test
  typing issues and the SDK-private test callback cast were repaired in touched tests.
- Mypy does not apply: this change contains TypeScript/TSX and Markdown, no Python.

Initial local runs exposed missing test environment variables and a first same-state
React bailout render in the new profiler fixture. The rerun uses the repository CI's
explicit dummy settings and measures steady capped ticks after that first bailout.
No production assertion or required check was weakened.

## Integration acceptance

This is frontend-only maintenance. No SQL or Edge deployment is required. Root owns
the combined build, independent review, CI and staging browser acceptance before
merge, followed by the affected production frontend smoke check. The selected
browser scope is the student/tutor typing interaction and avatar/tutor-image upload
success/error UI against the intended environment, including cleanup. These live
checks remain open in this coding handoff; local tests do not establish release.
