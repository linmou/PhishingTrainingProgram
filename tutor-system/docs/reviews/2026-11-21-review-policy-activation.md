# Review-policy activation — issue #71

Date: 2026-11-21. Owner: Codex integration agent. Protected policy source: `cf9933d6cf6e75a19d48ee3ed234157d2302a08b` (`no_sign_up`, maintainer-merged PR #52). This is repository configuration/documentation only; no application or server deployment.

## Completed activation

- Confirmed PR #52 merged on 2026-11-21 at 18:20:14Z. The merge itself does not retroactively establish a current-head review receipt or independent approval; those historical prerequisites were not evidenced during this activation.
- Dispatched the merged `Review Policy (trusted base)` workflow on `no_sign_up`. [Run 44935074534](https://github.com/linmou/PhishingTrainingProgram/actions/runs/44935074534) completed successfully. A workflow success means evaluation completed; individual PR policy conclusions can still be failures.
- Confirmed a real `review-policy` check on PR #122 head `630372b0bc795155f18b7c4acd3b65a1c8d8c4fa`, published by GitHub Actions app 15368. [Check 136939856437](https://github.com/linmou/PhishingTrainingProgram/runs/136939856437) fails for missing current-head risk decision, authenticated Codex reviews and independent trusted approval.
- Patched only the required-status-check settings: preserved `strict: true` and the existing `isolation-harness`, `frontend-jest`, `frontend-build` checks/app bindings; added `review-policy` bound to app 15368. Read the settings back and verified exact parity with that intended list. Administrator enforcement remains enabled; no other protection setting changed.
- Committed sanitized [before](2026-11-21-review-policy-activation/required-checks-before.json) and [after](2026-11-21-review-policy-activation/required-checks-after.json) API snapshots. Live endpoint: `GET /repos/linmou/PhishingTrainingProgram/branches/no_sign_up/protection/required_status_checks`.
- Ran the merged pure policy/decision suite: 17 tests passed. Cases include routine success, human-required rejection without approval and success with approval, stale/forged/unsigned evidence rejection, unresolved-finding rejection even with acceptance, and authorization revocation. These tests mock GitHub responses and are not live positive-path acceptance.

## Acceptance still open

No open PR currently supplies the genuine current-head clean Codex code/security receipt plus the appropriate authorization/independent approval needed to exercise a live success. Do not manufacture bot receipts, impersonate a maintainer, mark a finding resolved without review, publish synthetic successful checks, weaken protection or count a mocked positive case as a live pass.

Issue #71 remains open pending (1) live positive acceptance for the routine and human-decision paths using genuine eligible candidates, and (2) merge of the README/evidence documentation. The documentation PR can demonstrate a required negative check on an otherwise up-to-date candidate; record that check and mergeability in the handoff. The earlier PR #122 observation also includes an out-of-date-branch blocker and is not a sole-blocker experiment.

Resumption owner: Codex. Trigger: a current-head completed clean Codex review and genuine eligible authorization/independent approval become available on controlled candidates. Verify the routine path with a valid scoped authorization issue, trusted PR-body provenance and verified trusted commit signatures; verify the human-decision path with an independent admin/maintain approval. Remove required evidence on a controlled candidate to confirm rejection, restore only genuine evidence to confirm success, and preserve exact SHAs/check URLs. No existing candidate was modified or merged for this experiment. Close #71 only after the outstanding acceptance and documentation merge are verified.

Recovery: the captured before settings are an exact rollback reference. Any rollback requires an explicit maintainer decision because it disables the newly required approval gate; it is not routine test cleanup. No temporary hosted fixtures, accounts or checks were fabricated.
