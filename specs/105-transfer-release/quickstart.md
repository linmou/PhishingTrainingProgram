# Quickstart: Transfer Assessment Release Evidence

**Intent**: provide the exact planned verification sequence for an implementation agent or release verifier. This document describes commands to run after the owned runner and configuration are implemented; no live run was performed for this planning package.

## Preconditions

- Work from the `105-transfer-release` checkout or the integrated implementation checkout containing the release runner.
- Use an isolated migrated Supabase target with verified teacher and learner principals.
- Configure only the existing non-secret variable names documented in `tutor-system/.env.example`; keep secrets outside the repository and evidence bundle.
- Confirm `TRANSFER_ASSESSMENT_ENABLED` is disabled before setup. Do not use a client-only value as authorization.
- Do not use a linked production target, `supabase db reset`, incidental migration push, or seed command as a test step.

## Planned Verification Sequence

Run from the repository root. The `rtk` prefix is required by this worktree's command policy.

```bash
rtk git rev-parse HEAD
rtk git status --short
rtk npm ci --prefix tutor-system
rtk cp tutor-system/scripts/transfer-assessment-release.config.example.json \
  tutor-system/scripts/transfer-assessment-release.config.json
rtk node --test tutor-system/scripts/transfer-assessment-release.test.js
rtk npm run build --prefix tutor-system
rtk npm run eval:transfer:release --prefix tutor-system -- \
  --config scripts/transfer-assessment-release.config.json \
  --output ../evals/transfer-assessment/release
rtk npm run eval:transfer:release --prefix tutor-system -- \
  --verify evals/transfer-assessment/release/<run-id>
rtk git status --short
```

The implementation must register `eval:transfer:release` and its `--verify` mode before these commands are advertised as executable. The final report must record the exact command actually used.

Implementation state after this component's slice: `eval:transfer:release` is registered, the runtime evidence input is a config plus a directory of upstream link records, and `--verify` accepts either a bundle path or a run id under `--output`. The bundle holds `snapshot.json`, `run-record.json`, `report.json`, and `verdict.json`; the lane results live inside those records until the lane drivers exist, and every lane is recorded `blocked` with a reason in the meantime. Step 2's `scenario-<id>.json` files and steps 3-4's `privacy.json`/`attacks.json` are produced with those drivers.

## Required Run Review

1. Open `snapshot.json` and verify commit, exact non-secret configuration, verified-principal source, origins, flag state, and linked AI run IDs.
2. Confirm every W11 scenario has a `scenario-<id>.json` result and no required case is omitted.
3. Review `privacy.json` and learner-scoped evidence for private keys, transfer basis, raw model output, rationales, credentials, and error leakage.
4. Review `attacks.json` for every applicable forged identity, cross-learner, cross-room, stale-question, direct-write, and legacy-RPC case and verify protected-state equality.
5. Review `activation.json`, `rollback.json`, `report.json`, and `verdict.json`; a non-pass status blocks activation.
6. Link the run ID and evidence hashes into the single initiative milestone ledger through the integration owner.

## Expected Exit Behavior

- Exit zero only when the release runner has complete applicable evidence and all required local checks pass.
- Exit non-zero for a product failure, privacy leak, attack acceptance, stale/duplicate effect, missing evidence, provider/configuration blocker, browser failure, or rollback failure.
- Preserve the output directory and its failure artifacts on every non-zero exit.
- Do not enable the capability from the runner. Activation is a separately authorized operation after the final verdict passes.
