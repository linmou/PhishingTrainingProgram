# Contract: Transfer Release Evidence Bundle

**Intent**: define the public, reproducible outputs owned by component `105-transfer-release`. This contract is for evidence and release decisions; it does not change the application API or database schema.

## Bundle Location

Each execution writes a new directory at:

```text
evals/transfer-assessment/release/<run-id>/
```

The `<run-id>` is stable for the run and appears in every top-level record. The directory is immutable after completion. A rerun receives a new ID and must not overwrite a prior result.

## Required Top-Level Artifacts

| Artifact | Required content |
|---|---|
| `snapshot.json` | Branch, start commit, dirty-tree hash, exact non-secret configuration, app/Supabase origins, principal source references, capability state, linked AI run IDs, and hashes of manifests used. |
| `run-record.json` | Run timestamps, scenario inventory, per-scenario status, evidence links, errors, and completion state. |
| `scenario-<id>.json` | Expected/observed behavior, actor context, status, state comparisons, and evidence links for one scenario. |
| `privacy.json` | Learner network, realtime, export, storage, and error inspection results with redaction checks. |
| `attacks.json` | Forged identity, cross-learner, cross-room, stale-question, direct-write, and legacy-RPC cases with observed rejection and protected-state comparison. |
| `activation.json` | Gate reconciliation, backend flag state, authorization source, configuration hash, and activation eligibility. |
| `rollback.json` | Before/after capability, data/history/evidence hashes, already-delivered question handling, and non-destructive rollback verdict. |
| `report.json` | Human-readable release reconciliation with starting/ending commits, migration/auth/key status references, commands/statuses, AI/browser links, flag state, rollback path, and remaining gaps. |
| `verdict.json` | Machine-readable aggregate statuses and blocking reasons. |
| `screenshots/`, `network/`, `console/`, `storage/`, `exports/` | Captured evidence referenced by the records, redacted according to scope. |

## Status Contract

Every check has one of:

```text
pass | fail | blocked | missing | error | not_applicable
```

`not_applicable` requires a recorded reason and may be used only when the normative scenario truly does not apply. `blocked`, `missing`, `error`, and `fail` remain visible and prevent a release-approved verdict for any required check.

Release gate rows use the same closed vocabulary. When a linked upstream record exists with source status `pending` or `partial`, the release row MUST use `blocked` and preserve the original value and explanation as `source_status` and `source_status_reason`. When the required upstream record or evidence link is absent, the release row MUST use `missing`. `pending` and `partial` MUST NOT appear in a release row's `status` field.

## Privacy Contract

Learner-visible or learner-captured records MUST NOT contain:

- immutable answer keys or correct-option IDs;
- transfer basis, private rationale, raw model output, private draft fields, or server-only progress snapshots;
- access tokens, provider keys, passwords, or other credentials;
- an internal error string that reveals any of the fields above.

Teacher-only evidence may contain the reviewed draft fields required by the existing contract, but the evidence record must label its scope. Redaction is applied before writing artifacts and is itself recorded.

## Attack Contract

Each applicable attack case records the attempted operation and expected boundary. A passing case requires the supported server boundary to reject or neutralize the operation and, for mutation attempts, the protected-state before/after comparison to be unchanged. Browser labels, local storage identity, forged UUIDs, and legacy RPC availability are not trusted authorization evidence.

## Release Verdict Contract

The final release verdict is approved only when all of the following have `pass` status and immutable evidence:

1. upstream deterministic/database/authorization/evaluation gates;
2. dedicated transfer browser scenarios;
3. privacy inspection;
4. attack matrix;
5. activation prerequisites; and
6. non-destructive rollback rehearsal.

The seven-room legacy browser result may be linked as regression evidence but cannot satisfy item 2, 3, 4, 5, or 6. A Promptfoo run may be linked as AI evidence but cannot satisfy product, privacy, attack, or rollback gates.

Each upstream gate row retains its source status and reason metadata separately from the normalized release status so the final report preserves incomplete upstream evidence without expanding the public result vocabulary.

## Capability and Rollback Contract

`TRANSFER_ASSESSMENT_ENABLED` is backend-controlled and remains disabled until the release verdict is approved. A client flag may control visibility only. Rollback sets new assessment generation/delivery to disabled and preserves assessment tables, evidence, history, and legacy semantics. Already-delivered questions are safely resolved or explicitly cancelled according to the existing product contract; rollback does not delete or rewrite evidence.

## Reproducibility Contract

The report must link the exact command, commit, environment/configuration hash, verified-principal source, run ID, linked AI run IDs, evidence paths/hashes, feature-flag state, and observed exit status. Missing credentials, hosted access, browser runtime, or provider configuration are recorded as blockers, never silently substituted.
