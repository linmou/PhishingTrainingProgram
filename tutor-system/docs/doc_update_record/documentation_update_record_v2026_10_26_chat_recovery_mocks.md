# Chat recovery mock contract

Intent: record the chat regression fixture repair required by public Realtime channel recovery.

Updated: 2026-10-26. Implementation baseline: `13c4d7c`.

The two existing offline chat cases used Supabase mocks without
`realtime.isConnected`, causing their recovery timers to throw in CI after
the channel recovery repair. Both mocks now expose `isConnected` using their
existing simulated network state and `removeChannel` using their channel
unsubscribe boundary.

The offline cases verify that message reconciliation still retries while
offline, the transport check runs, and no channel removal occurs without a
connection. Their simulated successful SDK subscription restores the missed
message and cancels the pending replacement timer. The installed-SDK hook
regression separately verifies replacement when SDK resubscription fails.

`CI=true npm test -- --watchAll=false --runInBand --runTestsByPath
src/__tests__/real_time_chat.test.tsx src/__tests__/real_time_chat.bdd.test.tsx
src/contexts/__tests__/roomOwnershipHooks.test.tsx --silent` passes all 30
checks across three suites. `git diff --check` passes. These changes affect
only tests and this record; no hosted operations were performed.
