# Analysis Output Repair

Intent: restore the existing analyzer response contract without accepting incorrect assessment credit.

Updated: 2026-10-27. Baseline commit: `18b3109`. Owner: root Codex release agent. Issue: [#40](https://github.com/linmou/PhishingTrainingProgram/issues/40). Candidate: [PR #41](https://github.com/linmou/PhishingTrainingProgram/pull/41). Status: revised local replay passes; independent audit and hosted acceptance pending. Native GitHub Codex review is blocked by account usage limits.

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

Staging: `ciubrzggdqesgvfkpolj`. Production: `zgbufaxooqxeabewktzd`. Current production assessment-api v19 bundle: `ae491e78fd87f3428c66fc75c38a4e5e9f28b516192d6420be834f21cb8cb427`. No repair deployment has occurred.

Before release, resolve incorrect credit without weakening the agreed evidence criteria, obtain independent Codex review and pass CI. Under the project lease, deploy exact candidate source to staging, compare downloaded runtime files and run affected delivery/status/answer journeys plus cyberbullying analysis because repair is shared. Require correct persisted transitions, no unrelated credit and full cleanup. Then merge, verify integrated artifact parity and promote the same source to production; rerun affected journeys, inspect persisted state, record versions/hashes and cleanup, and release leases. #19/#22 stay open until their combined acceptance passes.

## Revised Candidate and Comparable Diagnosis

The final contract reminder now applies to both attempts, keeping the required envelope visible after dialogue history. The repair no longer treats a rejected response as a trusted evidence judgment. The reminder restates target-specific attribution: a different safe action cannot supply an unmentioned target component, and a feature being unsafe, unknown, unused or rejected does not establish its absence or multiplicity. These interpret existing TA01/TA02 and P2/P4/H4; curriculum targets and constitutional priorities are unchanged. Strict validation, eligible transitions, model, sampling settings, token budget and two-attempt bound remain unchanged.

Changed factors are the final reminder on the first attempt, explicit relevance/attribute distinctions and repair treatment of rejected judgments. Supporting tests compare contracts and mutation boundaries, not generated prose. The 49 handler tests pass with Deno type checking.

Replay now compares parsed event IDs/kinds against the expected current contribution: only Official Support receives `demonstrated_understanding`; unrelated targets receive no new event. Expectations stay outside model input. On the same full captured context, unchanged production source returns HTTP 502 (`analysis-replay-1793132539815.json`, command exit 1). Earlier candidate `3abc813d` restores HTTP 200 but fails two of three full-context checks by crediting the missing-contact-method target (`1793132545538`, `1793132552017`, `1793132557804`). Several additional diagnostic variants failed and remain in the ignored evidence directory; neither later success nor this record overwrites them.

Revised handler SHA-256 `37fc14c752c73db02f77813d5fdd544b089d8159bfa21761088f57ecfc5ff19f` passes all three full-context repetitions: `analysis-replay-1793132896616.json`, `1793132901996.json`, `1793132907483.json`. Each returns HTTP 200 after 18 provider calls, correctly credits Official Support and emits no unrelated credit. No database writes occur in these replays. This is a focused regression result, not a claim of population-level classifier accuracy.

The first independent refinement audit, retained at `/tmp/ptp41-independent-holdout-run-1793132542960/independent-audit.md`, rejected `3abc813d`. Baseline and that candidate both pass 15/18 raw held-out decisions; both produce an ineligible contradiction from pending in one negative case, which the handler rejects without progress mutation. That inherited classifier failure remains distinct from applied-state protection. Those exposed cases remain regression evidence; fresh independent cases and an exact-hash audit are pending for `37fc14c7`. Native GitHub review remains a separate required merge gate.

The audit also flags the stored target “No Alternative Contact Method: Legitimate alerts provide multiple ways to verify” as underspecified and potentially overgeneralized curriculum content. No target wording or expected labels were silently changed. Its future authorship review is separate from restoring the existing attribution and output contracts.
