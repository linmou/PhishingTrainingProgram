# Quickstart: Two-Attempt Transfer Evaluation Planning Package

**Intent**: provide exact validation commands for the two-attempt/explanation upgrade while keeping planning, offline evidence, and live evidence distinct.

## Static planning verification

Run from the allocated worktree root:

```sh
rtk git status --short --branch
rtk .specify/scripts/bash/check-prerequisites.sh --json --paths-only
rtk grep -n "transfer_trigger_target\\|medium_transfer_quality\\|assessment_item_validity\\|assessment_followup\\|verification_evidence\\|learner_explanation_quality\\|t09_contract_and_progress\\|learner_explanation_disclosure" specs/104-transfer-evaluation/*.md specs/104-transfer-evaluation/contracts/*.md
rtk grep -n "ecologicalTutorCall.ts\\|1,200\\|shared.*builder\\|production prompt.*hash" specs/104-transfer-evaluation/{spec.md,plan.md,research.md,data-model.md,tasks.md,contracts/*.md}
rtk shasum -a 256 /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan.md
rtk grep -n "TransferAttemptSnapshot\|ProcessedMessageDTO\|learner_explanation_quality\|learner_explanation_disclosure\|qwen3.5-flash" specs/104-transfer-evaluation/spec.md specs/104-transfer-evaluation/plan.md specs/104-transfer-evaluation/tasks.md specs/104-transfer-evaluation/contracts/*.md
```

The final hash command must print `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` for the normative source.

## Later deterministic contract and gate tests

The following commands are the offline gate after promoted 101/102 contracts and the TDD upgrade land. They must run without live model calls:

```sh
rtk proxy node --test evals/promptfoo/v1/transfer/*.test.js evals/promptfoo/v1/harness.test.js
rtk proxy node evals/promptfoo/v1/transfer/validate-manifest.js specs/104-transfer-evaluation/contracts/transfer-case-schema.md
rtk proxy node evals/promptfoo/v1/transfer/gate-fixtures.js
```

The exact future paths are part of the tasks and may be adjusted only by a versioned plan change; the public metric IDs and gate semantics may not change silently.

## Later authorized baseline/candidate execution

Do not run these during the planning turn. When component 102 exposes the versioned v3 builder/identity through `ecologicalTutorCall.ts`, the backend production prompt reference/hash, and the effective 1,200-token setting, and the project has authorized model/judge configuration, run the existing v1 runner through a new immutable transfer manifest/output directory. The runner must consume that shared builder; no command option may inject a copied prompt or alternate token budget. The command shape must include explicit variant, contract version, manifest, repetition, and output directory:

```sh
rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/transfer/cases.json --variant baseline --contract_version v3 --manifest evals/promptfoo/v1/transfer/manifest.json --out evals/promptfoo/results/<model>/<run-id>-baseline
rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/transfer/cases.json --variant candidate --contract_version v3 --manifest evals/promptfoo/v1/transfer/manifest.json --out evals/promptfoo/results/<model>/<run-id>-candidate
rtk proxy node evals/promptfoo/v1/gate.js evals/promptfoo/results/<model>/<run-id>-candidate evals/promptfoo/results/<model>/<run-id>-baseline
```

Before running, verify promoted 101/102 contract SHAs, shared-builder and production-prompt references/hashes, normalized product/evaluation request parity, and the exact target/judge configuration. Both target and judge MUST use `qwen3.5-flash` through the existing DashScope-compatible provider, as approved at integration commit `df40f32`. The provider boundary uses `REACT_APP_OAI_BASE_URL` and `REACT_APP_OAI_API_KEY`. Also verify the 1,200 target completion-token budget, judge budget, temperatures, retries, concurrency, timeout, repetition, seed policy, evaluator-label isolation, and credential redaction. Missing or mismatched configuration blocks execution; there is no runtime fallback.

## Later holdout execution

After the candidate is frozen, an independent author/agent runs the same baseline and candidate variants against an eligible sealed holdout directory. Holdout outputs and failures are preserved in a new immutable run. Any exposed holdout moves to regression and is replaced before an unseen-coverage claim.

## Evidence review

For each run, inspect promoted contract hashes, attempt-sequence joins, generated/reviewed explanation provenance, role-safe projections, manifest hash, complete input-output pairs, judgments, deterministic expected/actual values, missing/error records, partitions, pair joins, and baseline deltas. A successful Promptfoo gate is evaluation evidence only; database/auth/UI/browser/release gates remain separate.
