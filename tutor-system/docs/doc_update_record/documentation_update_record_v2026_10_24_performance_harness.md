# Room Performance Harness

Intent: define reproducible browser evidence for message synchronization and feedback batching in issues #19 and #20.

Updated: 2026-10-24. Implementation baseline: `26f0130`; the runner records its exact execution commit and SHA-256.

`scripts/measure-room-performance.cjs` runs against staging and the explicitly supplied candidate app. It takes the existing fixture lock and cross-machine project lease, borrowing `PTP_COORDINATION_LEASE` only for the exact candidate commit. It creates uniquely tagged rooms and identities and blocks Edge Function requests. Seeded histories contain 10, 100 and 1000 persisted tutor messages and one alternating like/dislike rating per message.

After each actual browser room join, the runner checks every seeded count, displayed average and own rating, records a 60-second steady-state request window, measures visible realtime INSERT and UPDATE latency, disconnects the realtime sockets, writes a missed INSERT and updates the oldest seeded message, then checks recovery after reconnect. A UI rating change must persist and request exactly one feedback refresh containing only that message ID. Initial feedback request filters are preserved to inspect batching. The app's normal reconciliation and reconnect scheduling remain in effect.

From the repository root, after the candidate app is started with the staging settings in [the browser guide](../browser-e2e-testing.md), run:

```sh
rtk proxy node --test scripts/measure-room-performance.test.cjs
E2E_TARGET=staging rtk proxy node scripts/measure-room-performance.cjs
```

Supply `E2E_APP_URL`, `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ACCESS_TOKEN` in memory. `--help` describes configuration without hosted access. `PERF_WINDOW_MS` can shorten exploratory windows; acceptance measurements should retain the 60000 ms default. The output directory is `output/playwright/room-performance-<run>/`, including full seeded rows, HTTP request filters/bodies and responses, timing/count/byte measurements, screenshots, errors and per-table cleanup readbacks. Credentials and authorization headers are excluded.

The byte metric is decoded HTTP response body bytes, excluding HTTP headers and realtime frames. Latency includes the write round trip and records time after write completion separately. Results measure the supplied candidate only; comparison against an earlier build requires another explicitly selected candidate run. Seeded ratings cover history scaling and the submitting user's refresh; they do not claim cross-user feedback realtime delivery or provider behavior.

Cleanup closes the browser before deleting tagged rooms through the existing ownership-checked helper, then reads back zero rooms/messages/feedback/sessions/checklists and deletes only the run's named identities. Cleanup or browser-close failures fail the run and retain the shared lease. This implementation was checked locally with deterministic tests and `--help`; hosted staging acceptance remains for the release owner after CI and review pass.
