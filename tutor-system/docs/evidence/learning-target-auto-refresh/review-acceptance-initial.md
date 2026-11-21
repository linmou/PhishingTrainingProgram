# Independent acceptance audit — issue #75

Reviewed `/tmp/ptp-refresh-review/review.diff`, the approved feature spec, and relevant hook/panel/room/service dependencies. Read-only code review; no source changes, deployments, hosted access or Docker. This review does not claim test execution or hosted acceptance.

## Findings

### P2 — Automatic reads clear failed mutation warnings without retrying or repairing the save

Location: `tutor-system/src/hooks/useChecklist.ts:595-596`, coupled with `:571-574`.

`updateItem` records a failed status/text/note save in the shared `error` state. The next subscribed invalidation or reconnect read unconditionally clears that same state whenever there is no local setup draft. A successful GET does not mean the failed edit was persisted; ordinary progress traffic can therefore silently remove the only explanation that the edit was lost. This violates the spec's explicit “Keep read failures separate from mutations and feed health” design note and the fail-visible requirement. In the panel, Save closes the editor immediately, and the new effects depending on `editingText`/`editingNote` reset the local value to the saved prop, making the remaining warning particularly important.

Fix: keep mutation errors distinct from read errors; only a corresponding successful explicit mutation or explicit dismissal should clear a mutation error. Add a focused regression: reject `editLearningProgress`, emit an item notification/reconnect, complete a successful authoritative read, assert that the save failure remains visible and no mutation retry occurs.

### P2 — Learner membership value is not scoped when the room changes

Location: `tutor-system/src/pages/RoomPagePost.tsx:652-689`, especially passing unscoped state at `:1206`.

The lookup guards stale query completions, but the previously resolved `transferStudentId` is neither tagged with its lookup scope nor cleared when `learnerLookupScope` changes (the reset effect only clears waiting/error). On a mounted `/room/:roomId` route change from room A to room B, the owner panel immediately receives room B plus room A's learner until B's membership query completes. A failed B lookup retains this incorrect value indefinitely. `useChecklist` then rejects B's valid persisted checklist as belonging to another learner (`useChecklist.ts:613-623`), so valid progress cannot display. If B has locally saved targets, `syncTransferDraft` can additionally attempt to promote them using A's learner before B's lookup resolves; server rejection is not a substitute for correct client scope.

Fix: store `{scope, studentId}` and pass null unless its scope matches, or otherwise ensure a scope change cannot expose an old learner to child effects. Add a room-switch regression with delayed/rejected B membership lookup and a stored B draft; assert no promotion call ever receives A's learner for B and a failed lookup does not incorrectly reject B's saved progress.

## Acceptance assessment

Static implementation supports the principal accepted behavior: owner/learner panel mounting, learner mutation-control removal, scoped INSERT/UPDATE invalidation, quiet serialized checklist reads, obsolete-read rejection, subscription and reconnect reconciliation, active subscriptions while collapsed, independent field-draft synchronization, flat stable item keys across priority moves, and evidence selection derived from fresh item data. Notification callbacks call the read path rather than judging or promotion.

The reviewed release record is honest: staging and production are marked uninspected/unchanged, MCP absence is a concrete blocker, the migration harness skip is not presented as a pass, and the feature is not claimed released. These remain **open acceptance gates**, not code passes: live schema/RLS/privacy and publication validation, baseline migration Red/Green/parity, two-viewer ~2-second journeys for both practice types, setup/catch-up/Guard/assessment integration, exact integrated artifact promotion, production verification and fixture cleanup. The named release owner is Codex in the learning-target-auto-refresh workspace. The spec's final release-record/PR checkbox is appropriately still open in the reviewed snapshot.

Recommended disposition: fix the two local correctness gaps; retain explicit hosted-release blockage until the named owner completes the documented resumption sequence.
