# Assessment Ordering Optimization

Intent: record issue #21's ordering contracts, reproducible measurements and verification.

Updated: 2026-10-24. Baseline commit: `7762cbb8eaeccf8c92360dc8eb335219651cd4b1`.

## Change

`assessmentRendering.ts` builds ordered result buckets by assessment ID and attempts used, then reuses those buckets during the existing dependency traversal. The chronological comparator, traversal order, ID deduplication, parent links and merge lifecycle hydration retain their existing behavior. `mergeRoomMessages` needs no separate optimization or state path. Complexity changes from O(N log N + A*N + E) to O(N log N + N + E), with O(N) index storage. A is the assessment-event count; E includes every dependency reference visited. Valid histories allow at most two accepted attempts, so E is linear; conflicting duplicated results can increase E and retain their previous traversal semantics.

## Benchmark

Command, run from `tutor-system/` before and after the algorithm change:

```sh
rtk proxy env RUN_ASSESSMENT_BENCHMARK=true BENCHMARK_PHASE=before BENCHMARK_OUTPUT=../output/issue-21-benchmark CI=true npm test -- --watchAll=false --maxWorkers=1 --runTestsByPath src/contexts/__tests__/assessmentOrdering.benchmark.test.ts
```

Use `BENCHMARK_PHASE=after` for the optimized source. Node v25.9.0, same machine and Jest runtime, 10 warmups and 41 measured merges per case; p95 is sorted sample index 38. Each assessment group has question, two answers, retry/failure results and closure with inverted timestamps. Few uses two groups; many fills the history with groups. Each incoming batch overlaps 10% of existing rows. Fixture generation and evidence serialization are outside timing; projection, sorting, indexing and lifecycle hydration within merge are timed. Concurrent local work can affect timing, so these are diagnostic measurements rather than a CI timing threshold.

| Messages | Density | Events | Before median / p95 (ms) | After median / p95 (ms) |
| --- | --- | --- | --- | --- |
| 100 | few | 6 | 0.116 / 0.133 | 0.116 / 0.129 |
| 100 | many | 48 | 0.329 / 0.362 | 0.275 / 0.280 |
| 1,000 | few | 6 | 1.297 / 1.389 | 1.288 / 1.418 |
| 1,000 | many | 498 | 7.408 / 15.901 | 3.155 / 3.247 |
| 5,000 | few | 6 | 6.505 / 7.278 | 6.686 / 6.841 |
| 5,000 | many | 2,499 | 82.437 / 108.715 | 17.498 / 19.182 |

Assessment-heavy median improves 2.35x at 1,000 and 4.71x at 5,000 messages. Few-event timing is essentially flat. Every before/after output row, including projected lifecycle, compares exactly equal. Full existing/incoming inputs, output rows, all timing samples, counts, timestamp and Node version are saved in `output/issue-21-benchmark/{before,after}-{100,1000,5000}-{few,many}.json`; generated evidence remains outside Git.

## Verification

- Existing rendering, adapter, contract and lifecycle suites plus new ordering regressions: 7 suites, 88 tests pass.
- RoomContext transfer ingress, transfer-assessment BDD and public question integration: 3 suites, 41 tests pass. Covers duplicate inserts, optimistic/realtime overlap, reconnect, prepopulated dialogue and preserved terminal projection.
- Final combined rerun on the committed implementation scope: 10 suites, 129 tests pass (`--watchAll=false --maxWorkers=1`); benchmark also passes separately. Focused ESLint and `git diff --check` pass.
- New deterministic regression checks compare 80 adversarial histories against the frozen previous traversal: tied/invalid timestamps, duplicates, missing dependencies, cycles and shared answers. Explicit closure test verifies question, answer, retry result, second answer, terminal result, closure order.
- Focused TypeScript check for the changed service and new tests passes with ES5 target. Repository `tsc --noEmit` remains blocked by existing test typing errors, including `ai_openai_integration.bdd.test.ts`, `observer_view_steps.test.tsx`, `real_time_chat.test.tsx` and existing adapter DTO fixtures; it reports no errors in changed/new files.

Focused type-check command:

```sh
rtk proxy npx tsc --noEmit --target es5 --lib dom,es2020 --module commonjs --esModuleInterop --skipLibCheck --jsx react --types jest,node src/services/assessmentRendering.ts src/services/__tests__/assessmentOrdering.regression.test.ts src/contexts/__tests__/assessmentOrdering.benchmark.test.ts
```

Only browser-side ordering changes. Root owns combined integration verification and delivery evidence.
