# Final independent acceptance audit — issue #75

Scope: `/tmp/ptp-refresh-review/final.diff`, the approved feature spec and corresponding final hook, panel, room page, tests and release record in the learning-target-auto-refresh worktree. Read-only source review. No source edits, deployments, hosted access, Docker or independent test execution in this audit.

## Disposition

**No remaining actionable local acceptance finding identified in the reviewed final diff.** Both findings from `acceptance.md` are addressed. This is acceptance of the inspected implementation against the local contract, not certification of migration safety or a hosted release.

## Confirmed repairs

1. **Failed mutation warnings survive background reads.** `useChecklist.ts` now owns separate mutation `error` and `readError` state. The notification/read path resets only `readError`, while the returned warning includes both. The added regression rejects `editLearningProgress`, completes a successful event-driven read and verifies the save warning remains. Notifications still call `readChecklist`, not draft promotion or judging.
2. **Membership no longer carries another room's learner into new scope.** `RoomPagePost.ts` stores membership with its lookup scope and derives a null learner immediately when that scope differs. The scope includes route room and current room; progress mounts only when those match. Historical-message fallback is filtered to the current room. Lookup completions require both matching scope and request identity. The added route-change regression keeps the new room's learner null after a lookup failure and verifies old-room messages cannot become its fallback.
3. **Failed asynchronous saves retain the draft.** Text/note saves await the handler result, keep the editor open on false/rejection, and disable save/input while pending. Hook mutation handlers return success/failure and reject obsolete scope completions. The new component cases cover pending, remote prop change, failure, rejection and successful retry for both text and note.
4. **Read/reconcile progress is bounded.** Checklist and membership reads are serialized with one pending follow-up. `boundedRead` releases UI requests after a 15-second timeout or cleanup abort and discards late results; it does not claim transport cancellation. A 1-second maximum invalidation wait prevents an endless event stream from postponing the ordinary 300ms debounce indefinitely. Cleanup clears timers and obsolete channels/read requests.
5. **Collapsed failures remain visible.** The warning block now includes an initial read error and Retry even without saved content while collapsed; expanded initial error rendering is not duplicated. This closes the previously silent hidden-panel failure path.

The underlying accepted behaviors remain present: owner and read-only learner visibility, subscriptions while collapsed, fresh authoritative reads rather than payload-state mutation, scope rejection, subscription/reconnect reconciliation, stable card keys across priority changes, independent draft synchronization, and evidence selection from the latest item data.

## Fixture changes

The four BDD fixture changes are compatible adaptations rather than assertion weakening: chat recovery selects the active messages feed instead of whichever channel was registered first; the second chat harness gives progress its own channel; room discovery supplies the optional-auth interface now used by the learner panel; and transfer assessment's mocked panel emits the setup-state callback that replaced parent polling. Existing assertions are retained. Test success is taken only from the named main-agent evidence, not inferred from this source review.

## Open gates and evidence limits

The release record continues to explicitly state that Supabase MCP is unavailable, staging/production are uninspected and unchanged, the SQL harness was skipped rather than passed, integration merge has not occurred, and production acceptance is open. It also distinguishes local simulated component screenshots from actual room acceptance and does not claim standalone TypeScript checking passed.

Required remaining acceptance: direct MCP schema/publication/RLS/privacy inspection; verified baseline migration Red/Green/parity and executor checks; actual owner/learner websocket delivery and approximately two-second latency in phishing and cyberbullying; setup, chronological catch-up, Guard replay and assessment-result journeys; hidden/reopen and reconnect behavior; scoped identity, layout and cleanup evidence; required final checks/review and exact committed artifact hashes; staging lease and verified staging candidate; merge/integrated artifact verification; exact production promotion and production checks. Physical DELETE behavior is explicitly outside the implemented event contract and must be checked against actual supported hosted writers before release, as already documented.

Named release owner remains Codex in the learning-target-auto-refresh workspace. Concrete next release step is to connect Supabase MCP, inspect both projects and execute the documented release sequence. Until then, an accurately labeled draft PR is a handoff state; the feature is not released or complete.
