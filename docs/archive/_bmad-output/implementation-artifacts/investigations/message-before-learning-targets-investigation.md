# Investigation: Student messages sent before learning targets

Intent: determine whether adding learning targets recovers evidence from student messages sent before target setup.

## Hand-off Brief

Adding goals does not automatically recheck earlier messages in the current source. A later tutor AI request does analyze the selected or latest ordinary learner message, so “never checked” is too absolute. Earlier messages may remain without their own progress evidence unless explicitly selected; a complete end-to-end recovery regression is missing.

## Case Info

- Date opened: 2026-10-14.
- Status: Concluded.
- Baseline: `88b3ccd`; unrelated in-progress workspace edits are outside this investigation.
- Scope: source tracing and existing local tests; no application changes.
- Input: “If a student writes before the tutor sets the learning goals, that message is never checked, even after the goals are added.”

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| RoomContext send/generate paths | Available | No owner-scoped checklist sends through the ordinary path; tutor generation has an explicit analysis call. |
| useChecklist target saving | Available | Saves/promotes target inventory and updates local state. |
| assessment-api analysis/initialization | Available | Initialization invokes one RPC; evidence is constrained to the requested message ID and content. |
| Existing regression tests | Available | Adjacent initialization/focused-generation tests exist; complete pre-goals recovery sequence has no direct regression. |
| Deployed runtime reproduction | Missing | Conclusions will distinguish source evidence from live behavior. |

## Confirmed Findings

1. `tutor-system/src/contexts/RoomContext.tsx:706` uses trusted transfer analysis on student send only when an owner-scoped transfer checklist is present (or for an assessment answer). The ordinary send path calls `ChecklistService.processStudentMessage` at line 879.
2. `tutor-system/src/hooks/useChecklist.ts:190` promotes target drafts through initialization and updates local state; `saveTransferTargets` at line 286 delegates to that promotion.
3. `tutor-system/src/contexts/RoomContext.tsx:1022` selects the focused or latest message owned by the checklist learner. For an ordinary message, line 1064 calls `analyzeMessage` before preparing a tutor response/assessment.
4. `tutor-system/src/services/checklistService.ts:448` rejects ordinary coverage processing when no checklist exists. RoomContext catches the failure at line 889 and retains the stored message.
5. `tutor-system/supabase/functions/assessment-api/index.ts:597` initializes goals with `initialize_transfer_checklist_v1` and performs no message-analysis loop. The initialization contract test at `index.test.ts:658` requires that single RPC.
6. `tutor-system/supabase/functions/assessment-api/index.ts:332` supplies historical dialogue as context, but lines 359–361 constrain evidence events to the requested message ID and its content. Merely seeing an older message in context does not separately credit it as evidence.

## Hypothesized Paths

### Hypothesis 1: An early student message can never be analyzed after setup

- Status: Refuted for the source's ordinary transfer-message path.
- Would confirm: backend rejects pre-setup messages and no recovery trigger accepts them.
- Would refute: later tutor generation successfully analyzes the selected/latest pre-setup message.
- Resolution: there is an explicit later tutor-request analysis call and no source-side creation-time cutoff found. Live success remains unverified.

### Hypothesis 2: Saving goals leaves earlier messages without an automatic recheck

- Status: Confirmed in application and Edge source.
- Would confirm: target initialization contains no historical analysis trigger or replay.
- Would refute: initialization or another setup event iterates pending learner messages.
- Resolution: both target-save and API initialization paths have no replay; backend history processing restricts evidence to its current focus.

## Investigation Backlog

- Done: trace initialization, message evidence bounds, and next tutor request.
- Done: locate adjacent regression tests and identify the missing full sequence.
- Follow-up if implementation requested: add deterministic replay of eligible early learner messages after targets persist, with idempotent progress evidence.

## Conclusion

**Confidence:** High for source behavior; deployed behavior and the full sequence have not been reproduced live.

The real defect is missing automatic recovery after goals are added. The quoted statement overstates it because a later AI request can analyze a selected/latest message. If a newer message becomes the focus first, the earlier message remains historical context and is not automatically credited on its own.

## Validation

Adjacent existing suites passed: **46 tests across two suites**, using dummy local Supabase configuration and mocked services. Command from `tutor-system/`:

```sh
rtk proxy env CI=true REACT_APP_SUPABASE_URL=http://127.0.0.1:54321 REACT_APP_SUPABASE_ANON_KEY=offline-test-key npm test -- --watchAll=false --maxWorkers=1 --silent --runTestsByPath src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx src/components/__tests__/ChecklistPanel.transfer.test.tsx
```

These tests support target initialization and focused tutor generation, but do not directly reproduce the complete early-message recovery sequence. No application code was changed.

## Reproduction Plan

Create a transfer room without goals; send one or more ordinary learner messages; add goals; inspect whether progress changes immediately. Then request tutor AI for the latest learner message and, separately, focus an older learner message. Verify which message IDs become evidence.
