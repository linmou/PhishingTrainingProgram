# RoomContext Ownership

Intent: identify the state and side-effect owner for room behavior so changes can be verified without expanding the provider's responsibilities.

Updated: 2026-10-24. Source baseline: `79496b6`.

## Boundaries

| Owner | State and side effects |
| --- | --- |
| `useRoomMembership` | Current room, messages, participants, loading, active-room identity, join epoch/abort controller and IDs received during join. Creates/joins/leaves rooms, validates passwords, pages initial history, enriches avatars/personas, restores public assessment lifecycle and tutor feedback for export. Hydration updates the provider's AI interaction state; leave clears its AI config through explicit setters. |
| `useRoomRealtime` | One channel per room/user identity, message reconciliation session, typing users and timers, typing broadcasts. Dispatches room updates, message INSERT/UPDATE and feedback notifications. Mutable presentation and feedback callbacks are read through a ref so updates do not replace the channel. |
| `roomMessageSync` | Cancellable paginated transport/reconciliation and reconnect scheduling. Receives raw rows; the realtime owner projects them before inserting them into React state. |
| `useMessageFeedback` | Room/user cache, bounded feedback reads, in-flight coalescing and targeted invalidation. See [feedback loading](message-feedback-loading.md). |
| `RoomProvider` | Public `useRoom()` adapter and AI/assessment command coordination: config, generation/review drafts, in-flight delivery guard, message posting, Guard Mode, checklist setup, feedback writes and downloads. These commands share one review state and remain together. |
| `transferAssessmentUiAdapter` | Public message projection/merge and assessment lifecycle view policy, including preservation of accepted terminal results during restoration. No local grading. |
| `roomExportBuilder` | Role-sensitive text/JSON export projection. The provider handles fetching export-only progress/summary data and browser download. |

The hooks keep existing React state setters and functional merges. No second store, event bus or consumer migration is required. AI generation and delivery intentionally remain a coordinated command boundary: extracting them with a large set of cross-hook draft setters would obscure their shared guard and generation epoch.

## Invariants

Membership cancellation prevents an older join or an unmounted history read from publishing state. Realtime cleanup stops reconciliation and unsubscribes before adopting a new room. Late old-channel callbacks are ignored. Participant/avatar and feedback callback changes update presentation without channel churn. Database rows still pass through `projectRoomMessage` before entering message state, including assessment restoration and reviewed delivery.

A successful channel join does not guarantee its Postgres Changes extension is active. A `system` event with `extension: postgres_changes` and `status: error` downgrades message synchronization to immediate reconciliation and five-second recovery scans. That failure remains latched through duplicate `SUBSCRIBED` notifications from the same join. A transport disconnect followed by `SUBSCRIBED` starts a new subscription attempt and restores sixty-second healthy audits unless that attempt also reports a system error. Unrelated system events and late callbacks after cleanup have no effect. The existing single channel retains its message, room and feedback listeners; all three tables must have the intended live publication configuration for healthy delivery.

`useRoom()` signatures, consumer state shape, tutor/student/observer guards, password validation, assessment operation scopes, delivery lock and export allowlists retain their existing behavior. These hooks own client state; trusted assessment services and database policies remain authoritative.

## Cost Evidence

`RoomContext.test.tsx` captures a consumer joining one room, receiving a persisted realtime insert, switching tutor to observer, attempting a rejected send, joining another room, receiving a late old-room event, leaving and unmounting. The snapshot was generated before extraction against `79496b6`, then passed after extraction without updating it. Mock transport counts are database query-builder calls, not live HTTP measurements. Feedback batches are measured separately.

| Measurement | Before | After |
| --- | --- | --- |
| Initial join query calls, including immediate reconciliation | 5 | 5 |
| Second-room query calls | 4 | 4 |
| Channel creations / subscriptions | 2 / 2 | 2 / 2 |
| Feedback batches | 3 | 3 |
| Consumer renders: join / insert / role change / room switch | 5 / 2 / 3 / 4 | 5 / 2 / 3 / 4 |
| Consumer renders from late old-room callback | 0 | 0 |
| Channel cleanups after leave | 2 | 2 |

Counts describe a fixed deterministic React test fixture, not a promise that unrelated consumers never render. Updating the snapshot requires investigating the changed requests/subscriptions/renders first.

Direct `roomOwnershipHooks.test.tsx` tests cover overlapping joins, abort-on-unmount, missing/incorrect password, student create rejection, stable channel identity with changed callbacks/participants, typing expiration and old-channel cleanup. Existing provider suites cover AI failures/config, Guard Mode, assessment ingress/answers/review concurrency, role exports and feedback writes. Browser journeys on the integrated candidate remain the integration owner's acceptance responsibility.
