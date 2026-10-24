# Open GitHub Issue Execution Plan

Intent: resolve the five open issues with isolated ownership, measured acceptance evidence, and one verified integrated result.

Updated: 2026-10-24. Starting local commit: `2caa4ae`; upstream includes `8a92391`.

## Scope and Ownership

Root agent owns integration, shared-environment leases, release coordination and final verification. Implementation agents use `gpt-6.1-sol` with medium reasoning. Each has a dedicated branch/worktree and commits only its changes. At most four implementation agents run concurrently; test commands use one worker.

| Issue | Owner | Primary boundary | Acceptance evidence |
| --- | --- | --- | --- |
| #19 recovery-aware message synchronization | message-sync agent | RoomContext message subscription/polling; dedicated sync module | Healthy subscription request counts; paginated disconnect/missed INSERT and UPDATE recovery; stale response and unmount protection; 100/1,000-message requests, bytes and latency |
| #20 batched feedback | feedback agent | Supabase feedback read helpers; dedicated feedback hook; RoomContext feedback sections | Bounded initial batches; zero-feedback cache; in-flight coalescing; targeted invalidation; user/room isolation; 10/100/1,000-message measurements |
| #21 assessment ordering performance | ordering agent | transferAssessmentUiAdapter and assessmentRendering | Before/after median and tail at 100/1,000/5,000 messages, few/many assessment events; exact ordering and lifecycle regressions |
| #2 learner-status/tutor consistency | tutor-policy agent | AI prompt/context and target-selection policy; minimal orchestration integration | Actual progress/tutor replay for acknowledgment, understanding and misconception; structured policy, readiness and follow-up evidence; full input/output metadata |
| #22 RoomContext decomposition | later refactor agent | Remaining stable membership, synchronization, feedback and AI/assessment ownership boundaries | Starts after #19/#20; preserve useRoom contract; before/after requests/subscriptions/render evidence; affected integration and browser checks |

## Execution Order

1. Inventory the open issues and repository state; create integration worktree from local `no_sign_up`; merge upstream so both existing commit sets are preserved. Leave unrelated local edits in their original checkout.
2. Run #19, #20, #21 and #2 in isolated worktrees from the combined baseline. Each agent reproduces the issue, implements a focused change, runs deterministic integration tests and records benchmarks or behavioral evidence. Request missing LLM configuration only if it is absent from `.env.example`; use configured provider flow for actual behavioral replay.
3. Review each diff, reconcile overlapping RoomContext edits, and merge tested branches into the integration branch. Keep every unresolved acceptance criterion explicit.
4. Assign #22 on the updated integration baseline after #19/#20. Extract only coherent responsibilities that reduce coupling. Preserve state/side-effect ownership and consumer contracts. Validate the combined behavior again.
5. Run combined TypeScript/build checks, affected RoomContext/service/assessment/feedback/role/export tests, and relevant browser journeys. Python changes, if any, require mypy. Keep resource usage bounded and preserve complete command results outside Git under `output/`; keep a concise tracked acceptance record.
6. For server changes: root is release owner. Inspect target live schema with Supabase MCP, select checks under the release workflow, obtain the cross-machine staging lease, perform required local migration validation where applicable, deploy staging SQL before dependent Edge artifacts, and run affected staging acceptance. Include inherited backend dependencies and exact artifact hashes in the release record.
7. Merge all validated commits into `no_sign_up` without disturbing unrelated working-tree changes. Verify integrated artifacts match staging evidence; rerun invalidated checks. Publish the merged branch as authorized by the user's merge request.
8. For server changes: promote the exact integrated committed artifacts to production, run matching production acceptance and cleanup, and record both environments' actual versions/results. Close an issue only after its acceptance criteria have evidence; incomplete live checks remain open with a precise blocker.

## Verification Scope

The combined changes affect shared message ingress, feedback, tutor planning and assessment eligibility. Select the full affected lifecycle journeys: tutor-response, checklist-coverage, assessment-delivery, assessment-answer, transfer-status-events, early-message-recheck and guard-mode; include cyberbullying and room/role/export coverage because RoomContext is shared. Use the explicit staging app/project and then matching production checks for any released server changes. Never infer production completion from local or staging tests.

Staging acceptance: actual configured progress/tutor calls remain consistent with authoritative target readiness; acknowledgment does not complete a target; unresolved targets retain follow-up; all selected message/feedback/assessment workflows converge and clean up. Production acceptance: matching behavior and persisted state on the exact integrated artifact versions, with fixture cleanup and environment evidence recorded.

## Risks and Assumptions

- #19, #20 and #2 touch RoomContext: agents own separate sections and integration resolves conflicts; #22 runs after the optimization changes.
- UPDATE recovery cannot rely solely on created_at. Implement an evidence-backed recovery strategy that finds old-row updates and handles tied timestamps.
- Read batching preserves existing permissions and explicitly represents empty results; frontend projection is not a substitute for server authorization.
- The existing upstream/local template changes are inherited dependencies, not new implementation scope. Verify compatibility where touched and avoid redeploying unrelated artifacts.
- LLM behavior is evaluated by structured policy/state and stored evidence rather than exact response wording. Provider/configuration failures are retained and cannot be replaced with heuristic results.
- Live credentials, fixture availability and shared project contention may block acceptance. Record exact failures and continue independent implementation/testing.

## Status

- Repository/issue inventory: complete; five open issues (#2, #19, #20, #21, #22).
- Combined baseline: local and upstream histories merged in the integration worktree.
- Initial implementation agents: pending launch.
- Integrated verification, target-branch merge, release and issue completion: pending.
