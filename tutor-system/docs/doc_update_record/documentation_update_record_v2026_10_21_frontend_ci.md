# Frontend CI restoration (#5)

Intent: make frontend installation reproducible and enforce the Jest/build merge gates.

Date: 2026-10-21. Baseline: `23a41af4608092ea2733eb8aa3e87e608dcda335`.

Reconciled `package-lock.json` using npm 10.9.2. Added `mongoose`'s `gcp-metadata@7.0.1` and `promptfoo`'s `@types/node@26.6.5` / `undici-types@8.9.0`. No retained package version changed. Removed 48 obsolete Selenium/ChromeDriver dependency entries absent from package.json; npm 10 also normalizes platform metadata and optional flags. The application dependencies are unchanged. Node 22 and npm 10.9.2 are the CI toolchain.

Restored separate `frontend-jest` and `frontend-build` jobs, each using clean `npm ci`. Jest uses dummy loopback configuration, requires only `*.test` / `*.spec` files, and does not collect its fixture helper as a suite. The React build reports the existing lint warnings while retaining compilation/type failures. No hosted deployment is part of these jobs.

Verification:

- Fresh local `npm ci --no-audit --no-fund` with Node 22 / npm 10.9.2: PASS, 2087 packages installed. No pre-existing node_modules used.
- `CI=false npm run build`: PASS; existing ESLint warnings recorded in `output/verification-20261021/build.log`.
- Initial complete Jest: FAIL, 67 suites failed / 77 passed / 4 skipped, 69 tests failed / 986 passed / 37 skipped. Most startup failures lack test Supabase configuration. Further baseline failures include stale room/observer fixtures and expectations, prompt contracts, and archived migration paths. Full results preserved in `output/verification-20261021/jest.json` and `.log`.
- Complete run with dummy loopback configuration and fixture-file exclusion: FAIL, 29 suites failed / 111 passed / 5 skipped; 77 tests failed / 1295 passed. Results retained separately as `jest-configured.json` / `.log`. The user subsequently expanded #5 to repair these failures; see [Jest repairs](documentation_update_record_v2026_10_21_jest_repairs.md) for the resulting changes and verification.

Branch protection was enabled through GitHub's authenticated API on `no_sign_up`. It requires an up-to-date branch and all three checks: `isolation-harness`, `frontend-jest`, `frontend-build`; administrator enforcement is enabled and force pushes/deletion are disabled. The CLI was used because the connected GitHub tools do not expose branch-protection settings. These checks must pass before this repair or subsequent PRs can merge.
