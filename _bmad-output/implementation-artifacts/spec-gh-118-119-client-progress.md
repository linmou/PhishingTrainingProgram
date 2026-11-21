---
title: Client identity cleanup and tutor progress visibility
created: 2026-11-21
status: in-progress
baseline_commit: 244b56f3891ffdb8838ad3a84f2aae96ea3fab78
context: []
---

## Intent

Implement the maintainer's instruction to fix GitHub #118 and #119 together, passing independent code review and a scoped code-smell monitor before creating a GitHub PR. The current issue bodies are the acceptance source; keep the server contract and learner seat rules unchanged.

## Boundaries & Constraints

Always preserve per-tab request identity, existing retry semantics and trusted join RPC admission. All changes are frontend, tests and docs; #119 performs reads only. Do not add SQL, Edge or runtime configuration changes without proving a missing existing read contract. No Docker. Do not discard changes in other worktrees. Do not push/open PR until review and smell assessment are complete.

## I/O & Edge-Case Matrix

| Scenario | Expected |
| --- | --- |
| Identity changes between callback creation and request | Request uses current per-tab identity; signed-out request sends nothing |
| join RPC fails | Error surfaced; no direct session insertion |
| Owner has no learner | Tutor room page shows No learner yet |
| Learner has persisted checklist | Tutor sees name/join time and Targets saved |
| Learner has no persisted checklist | Room page warns progress is not recorded; dashboard warns only after learner messages |
| Read fails or learner changes while read pending | Do not claim saved/unsaved based on stale data; clear old status and expose unavailable state |
| Non-owner/observer | No tutor-only status displayed |

## Code Map

- `tutor-system/src/services/transferAssessmentService.ts`, `applicationIdentity.ts`, `checklistService.ts`: identity injection, lazy Supabase transport and analyze call chain.
- `tutor-system/src/contexts/RoomContext.tsx`: remove explicit captured identity override; retain action retry behavior.
- `tutor-system/src/pages/StudentView.tsx`, `RoomPagePost.tsx`: trusted join path, shared observer storage helper and tutor-only room status.
- `tutor-system/src/pages/TutorView.tsx`: dashboard learner/status display through shared bounded read model.
- `tutor-system/src/components/ChecklistPanel.tsx`: shared sync warning component.
- `tutor-system/src/test-support/`: shared RoomProvider render setup and associated tests.
- `_bmad-output/initiative-platform-baseline/`: short FR consequence for owner learner/progress visibility grounded in P4.

## Tasks & Acceptance

- [x] Remove explicit analyze user override throughout the chain; inject identity getter in service options; test reset helper; import service without requiring Supabase env.
- [x] Delete StudentView fallback user read/session insert; shared observer mark/read helpers at all call sites.
- [x] Document idempotency keys per operation; preserve shared requestId utility already in #115.
- [x] Consolidate repeated RoomContext render setup in test-support, avoid incidental request-id exact matching, extract SyncWarning.
- [x] Shared read-only learner/progress model reused on room page/dashboard; name, join time, saved state; tutor-only visibility and query failure handling.
- [x] Add/extend focused tests for identity, joins, statuses, reads, races and observer visibility.
- [x] Add requirement consequence for #119; update relevant implementation docs.
- [ ] Complete final regression/build/browser checks, scoped smell comparison and independent re-review before PR creation.

Given the current tab is signed out, when any assessment request runs, then no transport invocation occurs. Given a direct room visit, when Join as learner succeeds, then the existing visit/request semantics remain unchanged. Given a tutor views a room/list, when the server learner/checklist data changes, then the UI reflects the current persisted state without interpreting local drafts as saved. Given no authoritative status is available, then UI reports unavailable instead of a false assurance.

## Verification

Focused Jest across affected service, RoomContext, StudentView, tutor dashboard and room status suites; production build; two-tab browser harness in production and dev modes. Scoped monitor baseline and final runs on same file set, with missing tool coverage explicit. Existing live read access verified directly against staging/production Supabase MCP; no server writes planned. UI staging verification selected after code implementation according to browser guide, under project lease if fixtures needed.

## Spec Change Log

### Review corrections

Independent review at b115942 found null learner placeholder sessions poisoning batch reads; queries now exclude null student IDs as existing seat readers do. Dashboard status reads/rendering now require current owner/role, tested with an owner switch while room fetch remains pending. A polling-only status conflicted with NFR-8; subscriptions to sessions/checklists/messages now trigger immediate reconciliation with a serialized catch-up and 15-second fallback, resubscribing refresh and cleanup. Existing published tables verified directly on staging. Keep current learner binding, bounded/paginated reads and failure-to-unavailable behavior.
