# Analysis Output Repair

Intent: restore the existing analyzer response contract without accepting incorrect assessment credit.

Updated: 2026-10-27. Baseline commit: `18b3109`. Owner: root Codex release agent. Issue: [#40](https://github.com/linmou/PhishingTrainingProgram/issues/40). Status: local format recovery verified; evidence correctness, independent review and hosted acceptance remain open.

## Failure and Candidate

Production assessment-delivery failed on message `babd9b7d-b3cf-48b6-be36-06b5e4fa8701` with HTTP 502 / `AI_OUTPUT_INVALID`. A read-only replay through the unchanged handler reproduced rejection of top-level event objects lacking the required `events` array, with invalid categories/IDs. The original production raw provider output was not retained; replay establishes a reproducible failure mode, not the exact original invalid field.

The candidate adds a final system reminder only on the existing second attempt: required outer envelope, event fields, exact supplied IDs and existing allowed categories. First-attempt messages, evidence rules, validation, transition eligibility, model (`qwen3.8-flash`), temperature, token budget and two-attempt limit remain unchanged. This is Edge-only; no SQL, permissions or database export/restore is required.

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
