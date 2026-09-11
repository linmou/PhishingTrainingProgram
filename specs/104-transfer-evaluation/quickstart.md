# Quickstart: Transfer Evaluation Planning Package

**Intent**: provide exact validation commands for the later W9-W10 implementation while making the current planning-only boundary explicit.

## Static planning verification

Run from the allocated worktree root:

```sh
rtk git status --short --branch
rtk .specify/scripts/bash/check-prerequisites.sh --json --paths-only
rtk grep -n "transfer_trigger_target\\|medium_transfer_quality\\|assessment_item_validity\\|assessment_followup\\|verification_evidence\\|t09_contract_and_progress" specs/104-transfer-evaluation
rtk shasum -a 256 /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/plan/transfer_assessment_implementation_plan.md
```

The final hash command must print `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2` for the normative source.

## Later deterministic contract and gate tests

The following are planned commands after implementation adds the transfer harness files. They must run without live model calls:

```sh
rtk proxy node --test evals/promptfoo/v1/transfer/*.test.js evals/promptfoo/v1/harness.test.js
rtk proxy node evals/promptfoo/v1/transfer/validate-manifest.js specs/104-transfer-evaluation/contracts/transfer-case-schema.md
rtk proxy node evals/promptfoo/v1/transfer/gate-fixtures.js
```

The exact future paths are part of the tasks and may be adjusted only by a versioned plan change; the public metric IDs and gate semantics may not change silently.

## Later authorized baseline/candidate execution

Do not run these during the planning turn. When component 102 exposes the frozen contract and the project has authorized model/judge configuration, run the existing v1 runner through a new immutable transfer manifest/output directory. The command shape must include explicit variant, contract version, manifest, repetition, and output directory:

```sh
rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/transfer/cases.json --variant baseline --contract_version v3 --manifest evals/promptfoo/v1/transfer/manifest.json --out evals/promptfoo/results/<model>/<run-id>-baseline
rtk proxy node evals/promptfoo/v1/runner.js --cases evals/promptfoo/v1/transfer/cases.json --variant candidate --contract_version v3 --manifest evals/promptfoo/v1/transfer/manifest.json --out evals/promptfoo/results/<model>/<run-id>-candidate
rtk proxy node evals/promptfoo/v1/gate.js evals/promptfoo/results/<model>/<run-id>-candidate evals/promptfoo/results/<model>/<run-id>-baseline
```

Before running, verify the effective model, base URL, judge, token limits, temperatures, retries, concurrency, timeout, repetition, seed policy, and credential redaction. The checked-in `.env.example` exposes names and an example endpoint but no usable credentials; missing configuration is a blocking unrun stage, not a fallback.

## Later holdout execution

After the candidate is frozen, an independent author/agent runs the same baseline and candidate variants against an eligible sealed holdout directory. Holdout outputs and failures are preserved in a new immutable run. Any exposed holdout moves to regression and is replaced before an unseen-coverage claim.

## Evidence review

For each run, inspect the manifest hash, case/check/repetition denominator, raw target inputs and outputs, parsed/displayed outputs, raw/parsed judgments, deterministic expected/actual values, missing/error records, partitions, pair joins, and baseline deltas. A successful Promptfoo gate is evaluation evidence only; run the separate database/auth/browser/release gates through components 101/102/105 and the initiative integration owner.
