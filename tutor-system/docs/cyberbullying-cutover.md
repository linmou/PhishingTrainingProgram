# Cyberbullying contract cutover

Intent: coordinate the browser-draft schema, dependent Edge functions and frontend while preserving accepted learner writes.
Updated: 2026-10-21. Integrated release: `9c7364c`. Release owner: Codex /root.

## Preconditions

Record the exact SQL, imported Edge source and frontend source/build hashes in the release record. Confirm the target project through MCP: staging `ciubrzggdqesgvfkpolj`, production `zgbufaxooqxeabewktzd`. Recheck the catalog and Riley inventory against the validated snapshot. Keep a fresh configured export and role export, with restore/parity evidence. Prepare both Edge upload payloads and the matching frontend before closing writes.

The production frontend is Render service `srv-d1pjtjnfte5s73ce0opg` in workspace PhishingTraining. It auto-deploys `no_sign_up`, using root `tutor-system`, command `npm run build` and directory `build`. Staging browser verification uses the candidate frontend with explicit staging URL/key. Before production mutations, merge the complete batch and inherited dependencies into `no_sign_up`, freeze the integrated manifest and verify those exact artifacts on staging. Coordinate the push with the gate because it triggers Render.

## Cutover sequence

1. Apply `scripts/database/practice-write-gate.sql` through the selected project's MCP. Its transaction installs statement triggers across application tables. Trigger DDL waits for in-flight table writes; a five-second lock timeout aborts the whole installation. Confirm `private.practice_write_gate.closed=true`. An application-role write must return `PRACTICE_MAINTENANCE` before advancing.
2. Apply the exact validated `supabase/archived_migrations/20261021010000_cyberbullying_browser_draft.sql` (archived after both environments passed) through the project connection, with the existing gate closed. Its transaction locks rooms/messages/reviews/proposals to drain writes, compares message/review counts and content hashes, replaces the shared send, adds scoped context retrieval and review validation, and retires proposal storage and revision triggers. Existing feedback identifiers/provenance remain audit data. Unsent proposals expire at cutover. The transaction records `required_contract=cyberbullying-v2` and leaves the gate closed.
3. Deploy the matching `assessment-api` and `ai-api`, including all imported dependencies, preserving their existing `verify_jwt=false` setting. Fetch deployed sources and compare them with the frozen payloads. Ensure the frontend built from the same integrated source is available and uses the intended Supabase project.
4. Verify the new client sends `x-practice-contract: cyberbullying-v2`. Both Edge entry points reject missing/outdated headers before identity, database or provider calls. Reopen through a management SQL session: `UPDATE private.practice_write_gate SET closed=false,changed_at=now() WHERE singleton;`. Confirm current-client writes succeed and old/missing-header direct database and Edge requests fail with `CLIENT_RELOAD_REQUIRED`.
5. Run the Cyberbullying tutor/learner/observer journey and shared phishing tutor, Guard and assessment journeys. Verify browser discard/reload, regeneration/rejection/replacement feedback, original/final metadata, message linkage, ratings and exports. Record provider outputs and cleanup counts. Archive the migration only after both environments pass.

## Failure and recovery

Budget 15 minutes for the gated deployment itself; browser acceptance follows reopening. Check progress after each operation. If any prerequisite fails before gate installation, leave the current deployment serving and resolve it. If installation times out, its transaction rolls back: inspect locks and retry only after the cause is understood.

If the migration fails, it rolls back while the installed gate remains closed. Confirm the original proposal schema and `required_contract=cyberbullying-v1`, restore matching old Edge/frontend artifacts if needed, then reopen that original contract. After migration commit, repair forward with the gate closed and the matching version 2 artifacts. Retain each failure and repeat affected local validation.

After the schema commits, keep the gate closed while repairing a failed Edge or frontend deployment. Prefer a forward fix of the frozen compatible set. Crossing the 15-minute budget requires an explicit incident entry with the failing operation, current versions and recovery action; elapsed time does not authorize reopening an incompatible client. A database restore is a separately reviewed recovery action. Never restore over accepted learner writes. After reopening, close the gate again before a repair that changes the contract, and preserve all new data.

Local rehearsal uses fresh hosted snapshots in the existing validation cluster. It verifies baseline missing-behavior failure, exact migration success, unchanged existing-data hashes, shared send behavior, atomic rollback, room/learner/profile checks and stale/current application-role behavior. The browser-draft release record links the precise runs; hosted execution is a separate gate.
