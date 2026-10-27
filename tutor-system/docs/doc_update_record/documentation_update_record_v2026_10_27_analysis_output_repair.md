# Analysis Output Repair

Intent: restore the existing analyzer response contract without accepting incorrect assessment credit.

Updated: 2026-10-27. Record baseline: `7ae933d`; original implementation base: `18b3109`. Owner: root Codex release agent. Issue: [#40](https://github.com/linmou/PhishingTrainingProgram/issues/40). Candidate: [PR #41](https://github.com/linmou/PhishingTrainingProgram/pull/41). Status: staging verified — awaiting native GitHub Codex review, merge and production release. Native review is blocked by account usage limits.

## Failure and Candidate

Production assessment-delivery failed on message `babd9b7d-b3cf-48b6-be36-06b5e4fa8701` with HTTP 502 / `AI_OUTPUT_INVALID`. A read-only replay through the unchanged handler reproduced rejection of top-level event objects lacking the required `events` array, with invalid categories/IDs. The original production raw provider output was not retained; replay establishes a reproducible failure mode, not the exact original invalid field.

The original candidate added a final system reminder only on the existing second attempt: required outer envelope, event fields, exact supplied IDs and existing allowed categories. Its failures below prompted the revised candidate. This is Edge-only; no SQL, permissions or database export/restore is required.

## Local Evidence and Limits

Evidence root: sibling `pr-29-resume/output/issues-19-22-closeout-20261027/`. The replay uses the retained full analysis context and real provider, with database RPCs replaced by capture-only responses; it performs no hosted fixture writes. Requests/responses are retained without authorization headers.

| Replay | Outcome |
| --- | --- |
| Unchanged full scope, `analysis-replay-1793130092660.json` | HTTP 502, 19 provider calls |
| Unchanged reduced target, `analysis-replay-1793130150431.json` | HTTP 502, both attempts invalid |
| Candidate reduced target, `analysis-replay-1793130326187.json` | HTTP 200, two calls, no event for unrelated target |
| Candidate full scope, `analysis-replay-1793130378122.json` | HTTP 200, 19 calls; incorrect unrelated Login Activity credit remains |

The full-scope response credits `initial_signal` for Login Activity although the learner described contacting official support. Its explanation itself says reviewing login activity was absent. Another first-attempt result credits a missing-contact-method target without establishing the required absence. These are unresolved evidence-judgment findings; a structurally valid response is not sufficient acceptance, and this run does not establish grading equivalence. No production promotion is authorized by these results.

The existing handler suite passes 49/49 with Deno type checking: `deno test --sloppy-imports --allow-env --allow-net --allow-run --allow-read tutor-system/supabase/functions/assessment-api/index.test.ts`. The existing repair assertion now selects the last user message because the reminder is a final system message. These deterministic tests verify repair/rejection and mutation boundaries, not provider semantic correctness. Earlier invocations failed on inherited extensionless imports, missing subprocess permission and the old last-message assumption; those failures remain recorded in the session.

## Release Gates

Staging: `ciubrzggdqesgvfkpolj`. Production: `zgbufaxooqxeabewktzd`. Production assessment-api v19 bundle: `ae491e78fd87f3428c66fc75c38a4e5e9f28b516192d6420be834f21cb8cb427`. No production repair deployment has occurred; staging delivery is recorded below.

Before release, resolve incorrect credit without weakening the agreed evidence criteria, obtain independent Codex review and pass CI. Under the project lease, deploy exact candidate source to staging, compare downloaded runtime files and run affected delivery/status/answer journeys plus cyberbullying analysis because repair is shared. Require correct persisted transitions, no unrelated credit and full cleanup. Then merge, verify integrated artifact parity and promote the same source to production; rerun affected journeys, inspect persisted state, record versions/hashes and cleanup, and release leases. #19/#22 stay open until their combined acceptance passes.

## Revised Candidate and Comparable Diagnosis

The final contract reminder now applies to both attempts, keeping the required envelope visible after dialogue history. The repair no longer treats a rejected response as a trusted evidence judgment. The reminder restates target-specific attribution: a different safe action cannot supply an unmentioned target component, and a feature being unsafe, unknown, unused or rejected does not establish its absence or multiplicity. These interpret existing TA01/TA02 and P2/P4/H4; curriculum targets and constitutional priorities are unchanged. Strict validation, eligible transitions, model, sampling settings, token budget and two-attempt bound remain unchanged.

Changed factors are the final reminder on the first attempt, explicit relevance/attribute distinctions and repair treatment of rejected judgments. Supporting tests compare contracts and mutation boundaries, not generated prose. The 49 handler tests pass with Deno type checking.

Replay now compares parsed event IDs/kinds against the expected current contribution: only Official Support receives `demonstrated_understanding`; unrelated targets receive no new event. Expectations stay outside model input. On the same full captured context, unchanged production source returns HTTP 502 (`analysis-replay-1793132539815.json`, command exit 1). Earlier candidate `3abc813d` restores HTTP 200 but fails two of three full-context checks by crediting the missing-contact-method target (`1793132545538`, `1793132552017`, `1793132557804`). Several additional diagnostic variants failed and remain in the ignored evidence directory; neither later success nor this record overwrites them.

Revised handler SHA-256 `37fc14c752c73db02f77813d5fdd544b089d8159bfa21761088f57ecfc5ff19f` passes all three full-context repetitions: `analysis-replay-1793132896616.json`, `1793132901996.json`, `1793132907483.json`. Each returns HTTP 200 after 18 provider calls, correctly credits Official Support and emits no unrelated credit. No database writes occur in these replays. This is a focused regression result, not a claim of population-level classifier accuracy.

The first independent refinement audit, retained at `/tmp/ptp41-independent-holdout-run-1793132542960/independent-audit.md`, rejected `3abc813d`. Baseline and that candidate both pass 15/18 raw held-out decisions; both produce an ineligible contradiction from pending in one negative case, which the handler rejects without progress mutation. That inherited classifier failure remains distinct from applied-state protection. Those exposed cases remain regression evidence; fresh independent cases and an exact-hash audit are pending for `37fc14c7`. Native GitHub review remains a separate required merge gate.

The audit also flags the stored target “No Alternative Contact Method: Legitimate alerts provide multiple ways to verify” as underspecified and potentially overgeneralized curriculum content. No target wording or expected labels were silently changed. Its future authorship review is separate from restoring the existing attribution and output contracts.

Final candidate handler SHA-256: `fd891964861cc5fedb88fefd41f01a9a5f60dc0d25ae6f883582841f21976876`. The final reminder now derives eligible event kinds from the existing `applyLearningEvent` result instead of advertising every global category. This avoids a duplicated state table and aligns the provider's contract with the unchanged server authority. Type-checked handler tests pass 49/49. Full-context replays `1793133150495`, `1793133155795`, `1793133161867` pass 3/3, each HTTP 200 with exactly the correct Official Support event and no unrelated credit. Previous `37fc14c7` replacement holdouts pass 23/24 raw decisions (baseline 22/24), with one inherited ineligible contradiction safely rejected; that failed validity result is retained and motivates the category reminder correction. Final independent audit and staging results follow.

## Final Independent Audit and Staging Acceptance

Independent auditor `/root/analysis_repair_audit_resume` clears the final handler hash for the inspected refinement and scoped correctness. New independent cases pass 24/24 decisions versus baseline 21/24; the exposed regression set passes 24/24 versus a fresh baseline 22/24. There are no pass-to-fail results or rejected events hiding wrong raw decisions. Narrow action targets stored as detection_area, partial action completion, covered repetition and genuine covered contradiction pass. All three full-context replays were independently checked. Raw inputs/outputs, frozen source/spec/dependency snapshots, settings, confusion metrics, pairs and earlier failed audits are retained under `pr-29-resume/output/issues-19-22-closeout-20261027/audit-v3-final/`, `audit-v2-final/`, `audit-v2-failed/` and `audit-v1-failed/`. Final audit SHA-256: `236b36907d89d30b725c8c93e32e2518b9ec219d92761a27fb542b001f82af89`.

These are scoped regression/generalization results. The new-case auditor had seen older prompts, so this evidence does not establish strict prompt-blind holdout eligibility or acceptance of the entire historical classifier benchmark. The local audit also does not replace native GitHub Codex review. No target, gold label, threshold or constitutional priority was changed.

Exact runtime commit `7ae933ddf5c587a20f49d9c6d7532569c6cd7201` passed all three GitHub checks in run `40579105460`. Under its project lease, staging advanced from assessment-api v79 to **v80**, bundle `9674a1dab615706f67de4236217e9fa9e46aff6e17bd011935115b1b99befda9`. Submitted 15-file source manifest SHA-256: `c2b778d8aa40629082097ee5bd62012d6ba1683c1e587b0242ba226cdbea3736`. All 11 downloaded runtime files match the committed candidate before and after browser checks; public assessment flag is true. No SQL, secret or ai-api change was needed. Deployment/source evidence: `pr-29-resume/output/issues-19-22-closeout-20261027/staging-repair-1793133412610/release.json`.

All six selected browser journeys exit 0 against this exact source; every fixture cleanup passes. Reports are under this worktree's `tmp/browser_demo_runs/`:

| Journey | Passing run |
| --- | --- |
| Full assessment delivery | `staging-template-20261027203742-17be4a9a` |
| Status transitions | `staging-template-20261027204130-31dcdd2c` |
| Pass/retry/failure/cancellation answer lifecycle | `staging-template-20261027204250-46c156f1` |
| Cyberbullying | `staging-template-20261027204509-b5517a57` |
| Room assessment setup | `staging-template-20261027204615-7e9eead2` |
| Early-message recheck | `staging-template-20261027204646-319fa206` |

In the delivery run's final `transfer-status-events.json` observation, the previously failing learner contribution leaves Official Support **covered/good** while Login Activity and No Alternative Contact Method remain **pending/none**. Saved function calls, progress and assessment/result artifacts establish successful downstream consumption, not merely valid JSON. Launcher evidence: `pr-29-resume/output/public-assessment-flag-20261026/staging-1793133452567/execution.json`. The app stopped with exit 0, local fixture locks were removed, source parity was rechecked and the owned remote lease was released.

Batch/release owner remains root; target branch remains at `18b3109`. The final evidence-only documentation commit preserves runtime artifacts and may reuse this staging evidence while target preconditions remain valid. Release trigger: successful current-head native GitHub Codex review plus required CI and risk-gate authorization, followed by merge into no_sign_up, integrated artifact comparison, exact promotion and affected production journeys/cleanup. Production was not changed by this repair. #40 and #19/#22 production acceptance remain open.
