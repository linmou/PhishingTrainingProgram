---
title: Revert PR 52 and remove browser-tabs CI
status: in-review
baseline_commit: cf9933d6cf6e75a19d48ee3ed234157d2302a08b
---

## Intent
User superseded the advisory proposal with an explicit full revert of PR #52 and removal of browser-tabs from CI. No further scope approval is needed. Preserve manual two-tab test runner and unrelated required checks. Remove review-policy from required status checks so deletion cannot leave a permanently pending gate.

## Tasks & Acceptance
- [x] Revert merge cf9933d with mainline parent 1.
- [x] Remove browser-tabs job and update active documentation.
- [x] Verify remaining harness checks and workflow/template parity.
- [x] Remove only review-policy/browser-tabs from required status checks if present; preserve other settings.
- [ ] Commit, open focused PR, inspect CI and merge the authorized revert after checks pass.

Given PR #52 is reverted, its workflow, validators and vendored monitor are absent. Given browser-tabs is removed from CI, manual test:e2e:tabs remains available. Given branch protection is updated, deterministic checks remain required.

## Verification evidence
16 focused harness tests passed; workflow/template parity and whitespace checks passed. Three independent reviews found no actionable issues. Live branch protection verified: strict remains true; only isolation-harness, frontend-jest and frontend-build are required. All other protection settings match their captured previous values. No deployed app/server source changed.
