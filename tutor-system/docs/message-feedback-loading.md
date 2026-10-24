# Message Feedback Loading

Intent: explain the feedback read contract and how to verify bounded requests without changing rating or permission behavior.

Updated: 2026-10-24. Source baseline: `7762cbb`.

## Read Contract

`getMessagesFeedbackStats(roomId, userId, messageIds)` reads the existing `message_feedback` table using its current permissions. Every request filters by room and at most 100 distinct persisted message IDs. Up to three batches run concurrently. Each batch pages by ordered feedback row ID in groups of 1,000 so a heavily rated message is not truncated by Supabase's result limit.

The same returned rows produce counts, per-type averages, overall averages, and the selected user's rating. Messages with no rows have explicit zero counts, null averages and null user feedback. Synthetic `prepop-` and `temp-` IDs are filtered before database queries. Errors propagate; failed reads never become cached zero ratings.

## Client Ownership

`useMessageFeedback` owns the active room/user cache, queued requests and in-flight promises. Room or user changes expose a fresh cache immediately. Old callbacks and asynchronous results cannot mutate the active cache. Clearing chat invalidates a read already in flight.

Message-list changes enqueue only unloaded IDs, including replacements that preserve list length. Repeated getters reuse cached empty entries and in-flight promises. INSERT, UPDATE, broadcast and successful rating submission invalidate only their message. Events queued before a read share that read; events arriving during a read cause one follow-up for the affected message so a racing update is not lost.

## Verification

Run the focused service, hook, RoomProvider and export tests with one worker:

```sh
rtk proxy env CI=true npm test -- --watchAll=false --maxWorkers=1 --runTestsByPath src/services/__tests__/feedbackBatch.test.ts src/hooks/__tests__/useMessageFeedback.test.tsx src/contexts/__tests__/RoomContext.test.tsx src/contexts/__tests__/RoomContext.roleBasedExport.test.tsx src/services/__tests__/supabase.test.ts
```

The service benchmark runs the actual old and new read functions against a 5 ms simulated network with empty feedback rows. It measures client scheduling and request count, not live database latency or throughput. Extra rating-row pages add requests when a batch reaches 1,000 ratings.

| Messages | Old Calls | Batched Calls | Old Time (ms) | Batched Time (ms) | Peak Batched Requests |
| --- | --- | --- | --- | --- | --- |
| 10 | 20 | 1 | 11.92 | 5.84 | 1 |
| 100 | 200 | 1 | 13.79 | 5.86 | 1 |
| 1,000 | 2,000 | 10 | 51.90 | 23.73 | 3 |

The 2026-10-24 run passed 58 tests across five suites in 1.87 seconds. Evidence includes mixed ratings/current-user parity, empty/synthetic entries, a 1,001-rating message, failed-read retry, repeated renders, overlapping events, rapid room/user changes, unmount, clear-history races, a 50-message RoomProvider batch, and existing chat/export/role behavior. Full logs and Jest JSON are in ignored `output/issue-20-20261024/` in the issue worktree. Integrated TypeScript/build and browser acceptance remain owned by the integration agent.
