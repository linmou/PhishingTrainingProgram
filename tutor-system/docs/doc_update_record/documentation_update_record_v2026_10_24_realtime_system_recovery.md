# Realtime Extension Failure Recovery

Intent: record recovery of message synchronization when a channel joins but its database-change extension fails.

Date: 2026-10-24. Source baseline: `6d6fefa`. Implementation owner: issue-22 refactor agent; live inspection and release owner: root coordinator.

## Trigger And Change

Root's read-only staging probe observed `SUBSCRIBED` followed by a `system` payload with `extension: postgres_changes`, `status: error` and a message that Realtime must be enabled for the requested tables. The hook previously considered that channel healthy and retained sixty-second audits.

`useRoomRealtime` now routes that structured extension error to the existing scheduler's `CHANNEL_ERROR` recovery path. A per-channel failure latch prevents a late or duplicate `SUBSCRIBED` callback from overriding the failure. A non-subscribed transport state followed by `SUBSCRIBED` clears the latch for the new subscription attempt. Errors unrelated to the database-change extension are ignored. Cleaned-up channel callbacks cannot alter synchronization.

The existing one-channel consumer contract remains intact. Publication configuration is a separate server prerequisite owned by root; the generic system error deliberately degrades the combined channel whenever any requested database stream is unavailable. The payload has no structured table identifier on which to base safe per-table health. No message text parsing is used.

## Evidence

- Focused `roomOwnershipHooks.test.tsx` and `roomMessageSync.test.ts` run: 2 suites / 9 tests passed. The new hook test invokes the actual scheduler, demonstrates an immediate recovery scan, no early retry at 4,999 ms, a retry at 5,000 ms, continued five-second recovery after duplicate `SUBSCRIBED`, sixty-second audits after `CLOSED` then `SUBSCRIBED`, stable channel count and no requests from stale callbacks after unmount.
- Provider/assessment regression run: 3 suites / 42 tests passed (`RoomContext`, transfer modes, transfer concurrency), including the unchanged request/subscription/render snapshot.
- Focused ESLint passed for the modified hook and hook test. No Python source was changed.

Changed factors: structured system-event handling and channel-health recovery state only. Root retains live publication verification, integrated checks and any release work. This owner performed no hosted mutations.
