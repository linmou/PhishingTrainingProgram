---
title: 'Automatically refresh room learning progress'
type: feature
created: 2026-11-12
status: in-review
baseline_commit: 878ed465823959517bb68398b05ee08b90958b24
context: []
issue: https://github.com/linmou/PhishingTrainingProgram/issues/75
---

<frozen-after-approval reason="Owner approved the design and implementation in the prior session">

## Intent

**Problem:** Progress stays stale after server judging or another viewer's edit. The room currently mounts the panel only for tutors despite FR-23 requiring a learner view.

**Approach:** Invalidate and quietly re-read learning progress on committed Supabase Realtime changes. Keep the panel mounted while hidden; expose it read-only to the room learner and retain manual Refresh.

## Boundaries & Constraints

**Always:** Preserve learner scope, server authority, Guard and assessment privacy. Preserve active note/text drafts, expanded cards and evidence views across updates, including priority regrouping. Warn visibly when live updates or reads fail. Follow staging-before-production and merge gates; named release owner is Codex in this workspace.

**Ask First:** Material product/privacy changes beyond the approved design.

**Never:** Poll learning progress, trigger judging from notifications, add a new progress writer, use Docker, bypass shared staging leases, or claim hosted verification without evidence.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Persisted update | Item, evidence, setup, Guard replay or assessment progress write | Quiet authoritative re-read for current viewer, ~300ms burst debounce | Retain data, visible warning |
| Editing | Local text/note draft and remote changes | Keep draft/card mounted; update status and evidence | No loading-screen replacement |
| Reconnect | Missed events or initial subscription gap | Read after SUBSCRIBED; no polling | Feed failure warning survives successful manual read |
| Scope change | Room, identity or learner changes | Tear down old feed, discard old responses, clear old data | Never show another learner's progress |
| Concurrent read | Event arrives during fetch | Serialize and reconcile once more | Ignore obsolete completions |
| Setup | No saved checklist yet | Room-scoped setup feed transitions waiting view to targets | Background reads never retry draft promotion writes |

</frozen-after-approval>

## Code Map

- `tutor-system/src/hooks/useChecklist.ts`: reads, local draft promotion and manual updates.
- `tutor-system/src/components/ChecklistPanel.tsx`: loading/error branches, drafts, grouping and evidence.
- `tutor-system/src/pages/RoomPagePost.tsx`: panel mounting, room ownership and waiting polls.
- `tutor-system/src/services/checklistService.ts`: existing read contracts; evidence rows use item_id.
- `tutor-system/supabase/migrations/`: one candidate publication change; live schema must first be inspected through MCP.

## Tasks & Acceptance

**Execution:**
- [x] Hook and focused hook tests: add scoped subscriptions, burst coalescing, read serialization, stale-response rejection and reconnect reconciliation; keep background reads free of draft-promotion side effects.
- [x] Panel and component tests: preserve editors and evidence; use inline refresh/feed warnings, first-load-only replacement and explicit read-only controls. Keep keys stable across priority changes.
- [x] Room page and tests: mount for owner/learner using room membership, retain hidden subscription, replace target waiting/learner lookup polling with appropriate room events/state.
- [x] PRD FR-23/NFR-8, initiative R7, architecture conventions and learning-progress epic: record automatic visibility and edit preservation; add reciprocal platform-guarantee links.
- [x] Candidate SQL and catalog assertions: add only missing progress tables and sessions (learner-join dependency) to existing publication, preserve unrelated members, fail clearly on unmet preconditions. Record live/MCP validation as blocked until available.
- [x] Dated release record: artifact hashes, exact local checks/review, staging/production criteria, owner and concrete resumption steps; reviewed draft PR targeting no_sign_up.

**Acceptance Criteria:**
- Given committed progress in phishing or cyberbullying, when either eligible viewer stays in the room, then progress and evidence appear without manual refresh, targeting two seconds from commit under normal connectivity.
- Given a learner panel, when opened, then it shows that learner's progress with no setup/edit controls and no private assessment material.
- Given server Guard, catch-up or grading behavior, when progress is saved, then only its persisted result is displayed; refresh never runs judging or writes progress.
- Given a verified candidate, when releasing, then live baseline/migration Red-Green, scoped two-viewer staging journeys and integrated production journeys pass with fixture cleanup and exact artifacts recorded.

## Spec Change Log

- 2026-11-12: Source inspection corrected the historical claims: learner panel was not mounted; draft prop synchronization and priority grouping could erase edits; waiting paths poll. These are included to fulfill the approved contract. Filters remain selection, not authorization.

## Design Notes

Grounding: P2/P4/P5 support live visibility; P6 and P7/R7 favor reusing Realtime; FR-23/53 require both viewers. High confidence in requirement fit and draft-preservation resolution. The owner accepted P1's timing trade-off; pedagogical confidence remains medium. AD-1/2/5/8/12 prohibit new writers, changed Guard semantics or private assessment disclosure. A subscriber stays active when hidden. session_checklists uses room_id; item/evidence subscriptions must use their actual keys. Subscribe then reconcile to close fetch/subscription gaps. Keep read failures separate from mutations and feed health.

## Verification

- Focused Jest hook, panel and room tests; TypeScript/build checks; pre-PR independent review and required CI.
- Scope: interacting UI/read lifecycle plus publication migration. Both environments require target setup, manual edit, judging/catch-up, Guard replay, assessment-result progress, hidden/reopen, reconnect, two-viewer identity and cleanup checks. No provider behavior changed.
- MCP is unavailable in this session. No live schema, permission, migration parity or hosted result is presumed. Draft PR is an intermediate handoff; production acceptance stays open.

- 2026-11-12: Membership inspection showed participants hydrate only on this browser's join. Add room-filtered sessions notifications so a waiting tutor detects the learner joining and promotes its saved targets without polling. This is a display/setup dependency; existing join and promotion writers remain unchanged. Validate sessions publication and read contract with the three progress tables.

- Review refinement 2026-11-12: bound burst wait and hung reads, scope membership state synchronously, separate mutation/read/feed errors, and close editors only after confirmed saves. These preserve the approved intent while preventing starvation, wrong-room promotion and lost failed-save drafts. Physical DELETE notifications remain outside this feature's persisted progress/setup operations; validate actual hosted writers before release.

## Suggested Review Order

- Start with scoped, serialized reads and separate failure state.
  [useChecklist.ts:496](../../tutor-system/src/hooks/useChecklist.ts#L496)

- Check subscription recovery and bounded event coalescing.
  [useRealtimeInvalidation.ts:8](../../tutor-system/src/hooks/useRealtimeInvalidation.ts#L8)

- Check timeout and cancellation behavior for stalled reads.
  [boundedRead.ts:2](../../tutor-system/src/hooks/boundedRead.ts#L2)

- Verify learner membership isolation and owner/learner panel access.
  [RoomPagePost.tsx:649](../../tutor-system/src/pages/RoomPagePost.tsx#L649)

- Verify drafts survive updates and failed saves.
  [ChecklistPanel.tsx:89](../../tutor-system/src/components/ChecklistPanel.tsx#L89)

- Check publication preconditions before the blocked hosted release.
  [20261112180000_enable_learning_progress_realtime.sql:1](../../tutor-system/supabase/migrations/20261112180000_enable_learning_progress_realtime.sql#L1)

- Inspect regression cases covering events, scope and recovery.
  [useChecklist.realtime.test.tsx:65](../../tutor-system/src/hooks/__tests__/useChecklist.realtime.test.tsx#L65)

- Read observed evidence and the concrete release blocker.
  [documentation_update_record_v2026_11_12_learning_target_auto_refresh.md:1](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_11_12_learning_target_auto_refresh.md#L1)


## Delivery status

### Local PR review follow-up — 2026-11-12

- [x] Fix draft edits accepted during pending promotion: reject mutations in the hook and disable the visible draft controls until synchronization settles. Regression tests cover success, failure, text/priority mutations, and actual panel/hook integration.
- [x] Integrate current `no_sign_up` locally at merge `3d1a1dd0b6ce2e7be0af0bb962321ff0def1ea39`; full frontend regression passes 1,608 tests and the production build passes.
- [ ] Complete release acceptance: fresh-baseline catalog/data parity and three publication migration tests passed. The user subsequently authorized the full merge/release workflow. Hosted checks exposed an existing transfer-evidence visibility gap; the repair and hosted two-viewer acceptance remain open. See the dated release record for exact hashes and evidence.

Draft PR [#76](https://github.com/linmou/PhishingTrainingProgram/pull/76), issue [#75](https://github.com/linmou/PhishingTrainingProgram/issues/75). The original pre-PR reviews covered implementation `b4e5dcb`; the subsequent merge review found the draft-promotion race repaired locally above. Supabase MCP is now available. Status remains in-review pending fresh-baseline migration validation and staging/production acceptance. The repair and verification updates remain local, with evidence and resumption steps in the dated release record.

### Evidence access repair — 2026-11-12

Read-only staging verification found 49 transfer-evidence rows but zero visible
to the anonymous browser role: the existing SELECT policy expects auth.uid,
whereas this application uses an offline application identity. Publication alone
does not fulfill the approved owner/learner evidence contract. The repair uses
the existing assessment API identity model and a service-role-only scoped read,
limited to the active checklist's learner or room owner. It preserves table RLS
and grants and must not expose assessment answers or other learners' evidence.

Evidence INSERT/UPDATE invalidates its parent item by timestamp only so the
existing permitted subscription can request a fresh scoped read. This does not
judge content or write progress/status. Reassignment must invalidate both parents;
the transaction must retain normal write guards and roll back on failure. Local
permission/atomicity tests, independent review, new exact SQL validation and
hosted evidence-only delivery checks are required before promotion. The earlier
publication-only test result does not validate this amended candidate.
