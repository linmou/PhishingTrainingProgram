# PR #52 monitor refresh — 2026-11-21

Scope: update the vendored local code-smell monitor before discussing the remaining approval infrastructure. Starting PR head: `62b2b03a9be44686e070c783115b6edda8d8d3b3`. Current base inspected: `244b56f`. No application runtime, SQL, Edge, live environment or branch protection changes.

The engine, interpretation references and offline fixtures were refreshed from the locally installed shared skill (its entrypoint records a 2026-11-09 refresh). Repository adaptation lives in `references/phishing-training-program.md`: CRA/React/TypeScript, independent Firebase package, Deno Edge/shared imports, SQL/RLS limits, tooling consumers and frozen evaluation artifacts. The local CLI preserves the original execution opt-in, defaults to no installation, and exposes both legacy compatibility fields and detailed detector coverage. Architecture-only mode cannot bypass execution opt-in. Gitleaks path checks canonicalize the repository path, including macOS `/tmp` aliases. Timeout reporting retains both partial stderr and the timeout explanation.

Validation:

- Python 3.12: 48 offline engine/architecture/report/trust-boundary tests passed.
- Python 3.12: all three original security regression tests passed.
- Node 20.18 / installed project TypeScript: six behavioral adapter tests passed; source-inventory fixture checks passed.
- Skill Creator validator passed using a disposable Python venv with PyYAML; `git diff --check` passed.
- New Python and TypeScript adapter checks are wired into the existing CI jobs. Hosted CI for this update remains unverified.
- Real syntax-only behavioral analysis against the existing primary checkout: 151 files, no parse errors, no file-limit omissions, 10 untriaged candidates; coverage **partial** due to unresolved relative imports, including Deno-style explicit `.ts` imports (#93). Raw output: `/tmp/ptp-pr52-behavioral.json` (ephemeral). This is an adapter smoke test, not a full application audit or a clean scan. No target application module was executed.

Remaining PR discussion:

- GitHub reports merge conflicts; branch divergence at inspection was 156 base-only commits and 30 PR-only commits. Reconcile against the current base before integrated review.
- The last review-policy workflow failed because the protected-base checkout lacked `.github/scripts/review-policy.cjs` (run 42542706170). This is bootstrap state, not evidence of a rejected risk decision. Review the activation design and current workflow together.
- Existing review receipts and CI results refer to old heads. Fresh integrated-head verification/review remains required. The PR explicitly classifies approval-control changes as requiring independent trusted human approval.
- Live `no_sign_up` protection still requires only `isolation-harness`, `frontend-jest`, and `frontend-build`. #71 tracks policy activation, including positive/negative enforcement checks. No settings changed in this task.
- The engine's Deno import resolution remains partial (#93); dependency/type/security backlogs (#89–#94) are not resolved by refreshing the monitor.

No full frontend tests/build were rerun for this tooling-only update. No deployment or shared-state cleanup was required. Primary checkout's existing user changes were untouched. Temporary validation outputs remain outside the checkout.

## Follow-up: base integration and template conflict resolution

Integrated `origin/no_sign_up` at `244b56f3891ffdb8838ad3a84f2aae96ea3fab78` into PR head `808829c1c350cad0f5b2fec21ca998a38d781ae5` on 2026-11-21. The merge commit containing this entry is the candidate. The only content conflict was the Verification section of `.github/PULL_REQUEST_TEMPLATE.md`: retained the base's four CI check IDs (including `browser-tabs`) and the PR's explicit current-head independent-review/acceptance wording. `.github/workflows/verify-pr.yml` merged automatically, retaining current-base jobs and the PR's monitor/policy test steps. No application or server source differs from the base as a result of resolving this conflict.

Integrated local verification passed: 48 engine tests, three original monitor security tests, six TypeScript behavioral tests, source-inventory fixtures, 17 review-policy/decision tests, 16 isolation/configuration harness tests, the exact CI template-versus-job-ID script for all four jobs, and Git whitespace/conflict checks. TypeScript adapters used the existing primary checkout's installed dependency directory via `NODE_PATH` or an explicit path; application dependencies were not installed or changed in the isolated worktree. Hosted CI will run after pushing this commit; no old-head result is claimed for this candidate.

This resolves the merge-conflict item above. Independent current-head review/approval and policy activation (#71) remain open. No PR merge into `no_sign_up`, branch-protection change, deployment or hosted-state mutation was performed.
