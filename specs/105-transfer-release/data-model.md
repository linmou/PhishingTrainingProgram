# Data Model: Transfer Assessment Release Evidence

**Intent**: define the records and invariants needed to make the W11 run, privacy/attack checks, activation decision, and rollback proof reproducible and auditable.

## Evidence Bundle

All records for one execution live under `evals/transfer-assessment/release/<run-id>/`. The runner creates the directory once and writes each file with exclusive creation semantics. Existing files are never overwritten during a run.

### Browser Run Record

| Field | Required | Meaning | Validation |
|---|---:|---|---|
| `run_id` | yes | Unique stable identifier for one release execution | Matches the output directory and every linked result |
| `started_at` / `completed_at` | yes when complete | Execution timestamps | ISO-8601; completion is absent or explicit for blocked runs |
| `branch` | yes | Source branch used for the run | Must be recorded, not inferred from a display label |
| `start_commit` / `end_commit` | yes when known | Code state before and after the run | Full commit IDs |
| `dirty_tree_hash` | yes | Hash of status, diff, and untracked-file metadata | Does not contain file secrets |
| `configuration` | yes | Redacted environment and non-secret runtime settings | Contains names/values or hashes needed to reproduce, never tokens |
| `verified_principals` | yes | Source references for teacher and learner identities | No passwords, access tokens, or unverified browser labels |
| `application_origin` / `supabase_origin` | yes | Target origins | Non-production or explicitly approved isolated target |
| `feature_flag_state` | yes | Backend capability state observed during run | `disabled` until activation is separately authorized |
| `linked_ai_run_ids` | yes | Promptfoo/production-path evidence references | IDs/paths only; no fabricated run IDs |
| `scenario_results` | yes | Per-scenario status and evidence references | No omitted required scenario |
| `gate_verdict` | yes | Aggregate status | Uses only `pass`, `fail`, `blocked`, `missing`, `error`, or `not_applicable` |

### Scenario Result

| Field | Required | Meaning |
|---|---:|---|
| `scenario_id` | yes | Stable ID for a W11 flow or edge case |
| `actor_context` | yes | Teacher, learner, two-tab, or direct-request context |
| `setup` | yes | Room/checklist/question identifiers and precondition references; private values are redacted in public learner evidence |
| `expected` / `observed` | yes | Observable contract and actual outcome |
| `status` | yes | `pass`, `fail`, `blocked`, `missing`, `error`, or `not_applicable` |
| `evidence` | yes | Screenshot, console, network, realtime, storage, export, request, or state-hash links |
| `error` | when non-pass | Redacted error class/message and stage |
| `protected_state_before` / `protected_state_after` | when relevant | Hashes or approved state projections for integrity cases |

### Evidence Item

| Field | Required | Meaning |
|---|---:|---|
| `evidence_id` | yes | Stable item identifier |
| `kind` | yes | `screenshot`, `console`, `network`, `realtime`, `storage`, `export`, `request`, `state`, `command`, or `report` |
| `path` | yes | Relative path within the run directory |
| `sha256` | yes | Content hash for immutable linking |
| `captured_at` | yes | Capture time |
| `scope` | yes | Learner-visible, teacher-only, direct-request, or release-admin scope |
| `redaction` | yes | Redaction status and rule set used |

### Privacy and Attack Case

| Field | Required | Meaning |
|---|---:|---|
| `case_id` | yes | Stable attack or inspection ID |
| `operation` | yes | Request, realtime event, export, storage read, error, or direct mutation attempted |
| `principal_context` | yes | Verified source identity and intended room/learner scope |
| `expected_boundary` | yes | Required denial, neutral error, redaction, or absence |
| `observed_result` | yes | Status, payload summary, and redacted error |
| `protected_state_before` / `protected_state_after` | for mutation cases | Comparison proving no unauthorized state change |
| `status` | yes | One of the result statuses |
| `evidence` | yes | Immutable request/response or inspection references |

### Release Gate Row

| Field | Required | Meaning |
|---|---:|---|
| `gate_id` | yes | Stable release gate identifier |
| `status` | yes | One of `pass`, `fail`, `blocked`, `missing`, `error`, or `not_applicable` |
| `required_evidence` | yes | Evidence required to satisfy the gate |
| `linked_runs` | yes | Immutable upstream or component run references; empty when evidence is absent |
| `source_status` | when linked upstream status differs | Original upstream status, including `pending` or `partial`, retained as metadata |
| `source_status_reason` | when source status is retained | Upstream explanation or a faithful summary with source reference |
| `blocking_reason` | for non-pass required gates | Release-level reason the row does not pass |
| `verified_at` | yes | Reconciliation time |

Normalization is deterministic: a present linked upstream record with source status `pending` or `partial` maps to release-row `blocked`; an absent required upstream record or evidence link maps to `missing`. The upstream value is never promoted into the release `status` field and is never represented as `pass`.

### Release Verdict

The verdict includes separate gate rows for upstream deterministic/database/authorization/evaluation evidence, dedicated browser behavior, privacy, attacks, activation, and rollback. `pass` is valid only when every required gate row is `pass`; any required `fail`, `blocked`, `missing`, or `error` row keeps activation ineligible. `not_applicable` is allowed only with a recorded normative reason.

### Capability State

The activation record contains the observed backend flag, requested state, authorized decision, verifier/approver source, timestamp, exact environment/configuration hash, release verdict hash, and linked evidence. A client UI visibility state may be recorded as diagnostic context but is never an authorization source.

### Rollback Record

The rollback record contains the pre-rollback capability state, post-rollback capability state, operation timestamp, environment/configuration hash, already-delivered question handling result, assessment table/history/evidence state hashes, legacy checklist semantic comparison, and linked screenshots/requests/commands. The record must show new generation/delivery disabled and no deletion, table drop, history erasure, or legacy reinterpretation.

## State Transitions

```text
created -> running -> complete
                    -> blocked | error

complete -> release-approved only when every applicable gate is pass
complete -> release-blocked when any required gate is fail/missing/error/blocked

release-approved -> activated only by an authorized backend decision
activated -> rolled-back by disabling new generation/delivery
rolled-back -> evidence-preserved; already-delivered questions resolve/cancel by existing contract
```

## Invariants

1. `run_id` and evidence hashes make every result traceable to one environment/configuration/commit snapshot.
2. No learner-visible artifact may contain answer keys, transfer basis, raw model output, private rationales, or credentials.
3. An unauthorized operation must leave protected state unchanged.
4. Duplicate, stale, retry, reconnect, and two-tab checks must preserve the existing single-effect/idempotency contract.
5. A missing or failed result is not equivalent to `not_applicable` and cannot be omitted.
6. Legacy checklist data remains legacy; old `excellent`, `good`, or `covered` values are not relabeled as transfer verification.
7. Activation and rollback records are separate from scenario records and do not rewrite the initiative milestone ledger.
