# Disposable PostgreSQL review fixes (#7)

Intent: record fixes and reproducible verification for the three isolation/cleanup findings in PR #7.

Date: 2026-10-21. Review baseline commit: `c2fe2766ac4c4419a89c332dfb1e2344b25de78f`. Worktree: `agent-disposable-postgres`; branch: `feat/disposable-postgres`.

## Changes and scope

The manager and scenario subprocess now clear inherited `PGHOSTADDR`, `PGSERVICE` and `PGSERVICEFILE`. Host validation requires one absolute Unix socket directory and rejects comma-separated fallbacks and NUL bytes. This prevents inherited libpq address/service selection from redirecting management SQL or documented `psql` scenarios to another database.

SIGINT/SIGTERM handlers are installed before allocation and retained through cleanup. Because allocation uses synchronous PostgreSQL subprocesses, signal callbacks run once allocation returns. The manager yields to those callbacks before launching a scenario; cancellation records its signal, returns 130/143 and cleans the owned database. Existing command-stage forwarding and stopped-owner recovery remain covered.

This is a local validation harness change. Verification uses the existing PostgreSQL 17.11 cluster at `~/.transfer-assessment-pg17/migration-validation/socket`, port 55433, user `local_bootstrap`. It changes no deployed application/schema/Edge behavior and requires no hosted release.

## Executed evidence

Commands ran from the PR worktree with Node 22.23.3 and `LC_ALL=C LC_CTYPE=C LANG=C`.

- Before the fix, `PG_DISPOSABLE_INTEGRATION=1 npx --yes --package=node@22 node --test scripts/database/disposable-database.test.js scripts/database/disposable-database.integration.test.js` exited 1. The added tests observed the baseline selected instead of the clone, SIGINT terminating allocation without automatic cleanup, and acceptance of a host list. Existing paths passed. The failing signal test explicitly recovered its own leftover lease. Evidence: `output/pr7-review-fixes-20261021/red.log`.
- After the fix, the same command exited 0: **11 counted tests passed, zero failed**, comprising four offline tests and the real-cluster parent plus six subtests. The new cases exercise a conflicting local service, inherited address selection, both together, and both SIGINT/SIGTERM after real ownership marking. The scenario verifies `current_database()` equals its allocated `PGDATABASE` before updating its clone; the baseline remains 7. Allocation-time cancellation exits 130/143 without starting the scenario and records cleaned leases. Evidence: `output/pr7-review-fixes-20261021/green.log`.
- Combined offline allocator/export/fixture-lock tests: **10 passed, zero failed**. Evidence: `output/pr7-review-fixes-20261021/offline.log`.
- Repeated the review's read-only management probe with inherited `PGHOSTADDR=127.0.0.1`, explicit `/nonexistent-review-socket` and port 65534. It now fails on the missing Unix socket, without attempting TCP; assertions passed. Evidence: `output/pr7-review-fixes-20261021/hostaddr-probe.log`.
- All three JavaScript files pass `node --check`; `git diff --check` passes. Python/mypy is outside this JavaScript change.

Integrated run evidence: `/var/folders/l2/1wqq76v13t776y0_974q5skw0000gp/T/disposable-pg-integration-t8c1ZR`. All **11** allocated databases have cleaned leases. An independent post-run catalog query verified absence of those databases and the owned baseline `agent_fixture_eb2aa199200c4ee8b6c5`. Evidence: `output/pr7-review-fixes-20261021/cleanup-verification.json`. Leases retain source/clone catalog parity, command/result and cleanup timestamps; scenario output is stored alongside them. The existing cluster remains running.

Allocator SHA-256: `f9992d66cfaf1c7d95016bbe245d671cb5b8f92c051109783ae3f7d3ffb60da5`.
Unit-test SHA-256: `f343cd9708612636b4f62e186b77af3f5dc67ff1c900888d5c1c0e1a6ae08852`.
Integration-test SHA-256: `fd2f9501913bf215caa967d4566c015e28386b23d7d68629abcc405d61f9dd8f`.

Required GitHub Jest/build/isolation checks run on the pushed fix commit. Their exact run and result are recorded in PR #7; earlier green CI on c2fe276 does not validate these new artifacts.
