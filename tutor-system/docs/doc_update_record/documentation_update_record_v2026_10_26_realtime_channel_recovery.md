# Realtime channel recovery

Intent: retain the diagnosis and acceptance evidence for restoring room subscriptions after transport loss.

Updated: 2026-10-26. Implementation baseline: `ee5da9e`.

## Failure evidence

Candidate performance run `room-performance-1792976102901-12d608cf` initially
acknowledged all five public table bindings and received ordinary live changes.
After socket disconnection, HTTP reconciliation restored the missed message
and old-message update in 5,680 ms. A replacement socket opened at
`1792976173980`, but no room subscription acknowledgement arrived within
30 seconds; only a heartbeat reply arrived. Cleanup passed.

The installed `@supabase/realtime-js` version is `2.11.15`. Its transport-close
handler schedules channel retry and socket reconnect. Socket reconnect calls
`disconnect()`, which tears down channel retry timers, then connects a new
socket. Socket-open does not recreate the stranded subscription. A local
transport reproduction, including abnormal close code 1006, produced a second
connected socket, an errored channel, and only the original `phx_join`.

## Repair

The room hook schedules one retry after `CHANNEL_ERROR` or `TIMED_OUT`, waits
for the public transport connection check, removes the old channel through
`removeChannel`, then recreates the room subscription through its existing
effect owner. A successful SDK subscription cancels pending retry. Room switch
and unmount cancel timers and invalidate late removal completion. Cleanup
does not unsubscribe a channel already owned by removal. Database-stream
system errors retain degraded reconciliation without restarting the channel.

## Validation

The installed-SDK hook regression failed before the repair: no replacement
channel was removed or joined. With the repair it observes a second join,
`SUBSCRIBED`, a newly delivered message, one remaining channel and one leave.
Additional cancellation checks cover repeated errors, SDK recovery before
retry, disconnected transport, overlapping removal, room switch and unmount.

Focused ownership, reconciliation and RoomContext suites pass 39/39 checks
and the existing snapshot. Full TypeScript checking reports 446 repository
diagnostics; filtering the same program's diagnostics to both modified files
reports zero. `git diff --check` passes. Live reconnect and affected browser acceptance remain with the release
owner on the integrated candidate. No hosted operations were performed for
this diagnosis or local repair.

Independent review found no remaining issues after the cleanup ownership
guard; the reviewer independently passed all six ownership-hook tests,
including the installed-SDK delayed leave acknowledgement regression.
