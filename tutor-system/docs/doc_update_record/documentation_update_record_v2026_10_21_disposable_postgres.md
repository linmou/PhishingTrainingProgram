# Disposable PostgreSQL scenario allocation (#3)

Intent: record automated scenario isolation using the existing validation cluster.

Date: 2026-10-21. Baseline: `98002f4` (stacked on focused frontend-CI PR #6).

Added `scripts/database/disposable-database.js`. Each invocation clones an explicitly selected local baseline into a random owned database, replays effective ACLs and database/per-role settings, compares owner/encoding/locale/settings/grants, runs the command, and verifies cleanup. It reuses the existing PostgreSQL 17.11 cluster on port 55433. No global roles or hosted runtime behavior change. Documented lease recovery after hard interruptions and retained all release parity gates.

Validation on 2026-10-21:

- Offline Node tests: 4 passed (local-only connection selection, identifier/value quoting, settings/parity, cleanup ownership/cluster/PID protection).
- `PG_DISPOSABLE_INTEGRATION=1 node --test scripts/database/disposable-database.integration.test.js`: final run 5 passed, 0 failed, 2.5 seconds. Two parallel commands used distinct databases; cloned sentinel data started at 7, changed independently to 9, and the baseline remained 7. Effective grants, grant options, search_path/custom settings and per-role statement timeout matched. Nonzero exit 7, missing executable, SIGTERM and explicit lease recovery after SIGKILL all cleaned successfully.
- Final integrated evidence: `/var/folders/l2/1wqq76v13t776y0_974q5skw0000gp/T/disposable-pg-integration-w4nZlK`. Each scenario lease records source/clone catalogs, command, result and cleanup timestamp; command stdout/stderr are retained alongside it. The test baseline was also removed. Earlier passing integration runs remain at `disposable-pg-integration-FJqoWp` and `disposable-pg-integration-hfh1U4` under the same temporary root.
- Combined offline allocation/export/fixture-lock tests: 10 passed with `LC_ALL=C LC_CTYPE=C LANG=C`. An initial invocation failed in the existing export test because this Mac's Perl/shasum rejected inherited `C.UTF-8`; rerunning with the supported C locale passed. No harness source fallback was added.
- Allocator SHA-256: `95dffa94c663bbbebc36090129ead847d7c69527412ca0da6e698fec1a348837`.

These are allocation/cleanup harness changes. Hosted migration validation remains a separate release gate; no hosted release is needed for this change.

## Refresh after PR #6 merged

Date: 2026-10-21. Integrated base: `dec0fd6` (`no_sign_up`, merge of PR #6). Worktree: `agent-disposable-postgres`; branch: `feat/disposable-postgres`.

Merged the current base to inherit the repaired lockfile, complete required Jest gate, and current application contracts. The only merge conflict was the release-workflow documentation header; the current release policy and allocator instructions were both retained. Allocator source and tests are unchanged. PR #7 now targets `no_sign_up` directly.

Verification scope: deterministic allocator/export/fixture-lock checks, opt-in integration against the existing local PG17 validation cluster (Unix socket, port 55433), and the required GitHub Jest/build/isolation checks. The integration creates and removes its own random baseline and scenario databases, preserves lease metadata, and checks parallel isolation, ACL/settings/data parity, failure exits, signals, hard-kill recovery, and cleanup.

- Node 22 offline checks: **10 passed, zero failed**, covering the allocator, export isolation and fixture locking. Evidence: `output/pr7-refresh-20261021/offline.log`.
- Real PostgreSQL **17.11** integration: **5 passed, zero failed** in 2.6 seconds. Evidence: `output/pr7-refresh-20261021/postgres.log`; owned lease records at `/var/folders/l2/1wqq76v13t776y0_974q5skw0000gp/T/disposable-pg-integration-Vjn3mM`. All six allocated databases have `cleaned` leases; the test verified their absence and removed its own baseline. The existing cluster remained running.
- Allocator SHA-256 remains `95dffa94c663bbbebc36090129ead847d7c69527412ca0da6e698fec1a348837`.
- The commands used `LC_ALL=C LC_CTYPE=C LANG=C` for this Mac. The first standalone hash command inherited unsupported `C.UTF-8`; repeating that read-only command with the supported locale confirmed the unchanged hash.
- GitHub runs the full Jest regression, production build and isolation harness on the pushed merge commit. PR #7 records the exact commit and final CI run; merging remains subject to those required checks.
