# Required frontend Jest repairs (#5)

Intent: restore a passing deterministic regression gate and record the behavior changes exposed by the failing tests.

Date: 2026-10-21. Source baseline commit: `98002f4`. PR: #6, `fix/frontend-ci-lockfile` into `no_sign_up`.

Integration baseline: `a6c977b` (PR #9), merged into this branch after it advanced during verification. Its current contracts use Qwen3.8 Flash for tutoring, 600 generation tokens, boolean Guard state, one target inventory, complete history, and saved assessment results. The PR retains the complete Jest gate on Node 22 / npm 10.9.2 instead of the base's focused test selection.

The restored gate initially reported 29 failed suites and 77 failed tests. The user expanded this PR to repair the regressions before proposing it again.

## Repairs

- Reinitialized Supabase query/storage mocks after CRA's per-test reset. Image upload tests call the real implementation against mocked SDK boundaries, including permission denial, ownership, storage/database failures, and cleanup. Chat clearing exercises the real authorization facade and trusted transaction delegation, including denied actors and transaction failures; the base's SQL suite owns database transaction isolation.
- Updated room discovery to the existing observer fallback, string message IDs, password retry clearing, and the trusted assessment join boundary. Checklist scenarios check persisted evidence and service review metadata rather than nonexistent UI fields or canned learner replies.
- Isolated simulated chat clients' typing expiry and message polling with fake timers cleared after each scenario. This prevents pending timers from affecting later scenarios; all seven chat integration scenarios pass with isolated clocks.
- Updated historical migration paths and whitespace-tolerant SQL checks. The private migration preflight assertion now reads the entire preflight block instead of stopping at its first failure message.
- Aligned prompt tests with selected modules and structured request/context data. Promptfoo fixtures cover every required metric and the frozen case/assertion manifest; the runner shim generates complete evidence for the manifest's cases and repetitions. Refreshed ecological YAML from committed seeds without changing any seed or hosted template.
- Made hosted storage diagnostics explicitly opt-in, as intended for the external tier. No deterministic failing suite was skipped. Existing external integration opt-ins remain in effect.

## Frontend behavior corrections

Teaching rooms whose titles also appear in a test template remain visible unless marked as test rooms or owned by a demo harness account. The integrated list-filter tests cover the title collision, marker, and harness-owner cases.

The frontend context builder filters null, empty, whitespace-only, and malformed legacy posts before the five-post limit, preserving valid later content. The context integration test reproduces the original extra empty messages and exercises these edge cases. Shared server helpers and deployed server behavior are unchanged.

## Verification

Local machine evidence is retained under `output/jest-repair/`, excluded from Git. `batch1.json`, `batch2.json`, and `batch3.json` preserve intermediate results; `full.json` records 138 passed suites with one stale ecological YAML failure. After refreshing the YAML, `final.json` exposed the intermittent chat timing failure; `chat.json` records all seven chat scenarios passing with isolated clocks.

- Before integrating PR #9: complete Node 22 Jest PASS, **139 passed suites / 0 failed / 6 skipped; 1367 passed tests / 0 failed / 126 skipped** (`verified.json` / `verified.log`).
- First integrated run: seven failed suites / 136 passed, 12 failed tests / 1425 passed (`integrated.json` / `integrated.log`). These exposed stale model, request, saved-result and historical migration expectations.
- Final integrated Node 22 Jest: PASS, **143 passed suites / 0 failed / 4 skipped; 1437 passed tests / 0 failed / 92 skipped**. Uses `CI=true`, `REACT_APP_SUPABASE_URL=http://127.0.0.1:54321`, `REACT_APP_SUPABASE_ANON_KEY=ci-placeholder`, and `npm run test:regression -- --runInBand`; full assertions and logs are retained in `integrated-final.json` / `integrated-final.log`. The base added deterministic tests to two previously external-only suites, which explains the reduced skipped-suite count.
- Production build: PASS using Node 22 and `CI=false npm run build`; existing ESLint warnings remain. Evidence after integration: `integrated-build.log`.
- Isolation harness: PASS, six tests. Evidence after integration: `integrated-isolation.log`.
- GitHub's `no_sign_up` protection was read back: strict up-to-date checks `isolation-harness`, `frontend-jest`, and `frontend-build`, bound to GitHub Actions app 15368; administrators are covered.

PR #6 carries the GitHub Actions verification for the pushed commit. No hosted deployment or live LLM evaluation was required for these frontend, fixture, and test changes.
