# Recovery-aware Message Synchronization

Intent: record issue #19 implementation, measured local transport cost, and remaining acceptance work.

Date: 2026-10-24. Baseline commit: `7762cbb`. Owner: message-sync implementation agent; integrated browser/live verification owner: root release coordinator.

## Behavior

Replaced the unconditional two-second history read with Realtime-first updates and a cancellable reconciliation session. Join and recovery both request at most 100 rows, ordered by unique ID with `id > cursor`, until the short terminal page. This discovers old-row updates without relying on an unavailable mutation timestamp and cannot lose tied creation timestamps. A healthy audit runs 60 seconds after a completed scan; disconnected/failed reads retry after 5 seconds. Reconnect requests immediate recovery. One active scan coalesces additional recovery requests. Realtime wins over an older in-flight HTTP row; the shared projection and merge preserve dialogue, public questions, and terminal lifecycle state. Stable room/user subscription identity avoids metadata/participant resubscriptions. Leave/unmount aborts and suppresses late reads; a newer join supersedes an older join.

Changed experiment factors: timer cadence, maximum rows/request, unique-ID keyset order, initial history pagination, in-flight realtime precedence, and cancellation. Assessment processing, grading, Guard Mode, server authorization, and the existing database column-selection contract are unchanged.

## Deterministic Measurements

Reproduce with `npm test -- --watchAll=false --runTestsByPath src/contexts/__tests__/roomMessageSync.test.ts --maxWorkers=1`.

Fixture: 100 or 1,000 ASCII messages, 100-character content padding, identical ISO creation timestamps, unique six-digit IDs. JSON response bodies are measured with `Buffer.byteLength`; HTTP headers, compression, network latency and browser rendering are excluded. The former baseline is calculated from its fixed 30 full-history reads/minute. The new path executes one completed steady-state audit with the actual sync module. A full 100-row page requires an additional empty terminal-page probe. Initial join and subscription catch-up are excluded from steady-state counts.

| Messages | Before requests/min | After requests/min | Before JSON bytes/min | After JSON bytes/min |
| --- | --- | --- | --- | --- |
|100|30|2|719730|23993|
|1000|30|11|7226730|240902|

Response-body volume falls about 96.7%. In the recorded run, direct baseline event dispatch/new sync dispatch measured 0.00350/0.00917 ms for 100 messages and 0.00133/0.00150 ms for 1,000 messages; these are in-process callback timings, not end-to-end delivery measurements. The timer-bound tradeoff is explicit: silently missed events on healthy connections wait up to 60 seconds plus scan time (formerly 2 seconds); disconnected recovery waits up to 5 seconds plus scan time, and reconnect recovery has no scheduled delay. Live latency/transfer-byte acceptance remains open.

## Verification

Final command `npm test -- --watchAll=false src/contexts/__tests__/RoomContext src/contexts/__tests__/roomMessageSync --maxWorkers=1 --silent` passed 15 suites / 154 tests. Focused ESLint passed on RoomContext, the sync module and both modified/new sync test files. Integration tests cover missed INSERT, old-row UPDATE, tied timestamps, multi-page recovery, duplicate events, optimistic/persisted overlap, pre-populated dialogue, terminal answer lifecycle, Guard Mode, stable subscriptions, superseded joins and old-room response suppression. The helper reads 1,205 rows in 13 requests and proves cancellation/coalescing and failed healthy-read retries.

No live database writes or deployments were performed by this owner. Root still owns integrated TypeScript/build, existing browser journeys, real-network 100/1,000-message performance measurements and applicable live release acceptance. No server artifact was changed by issue #19.
