# Integration and learning-target audit

Intent: record the tested prompt integration, its adoption scope, and which learning targets the tutor evaluation actually supplies.

Updated: 2026-11-13 UTC. Source baseline commit: `81bb3c91608c38532c53cab27f722133c64e8e91`.

Adoption base: `968331f`. The user subsequently explicitly requested: "Merge the Notice → action instruction." The focused adoption branch is `fix/notice-action-tutor`; it retains the exact tested instruction and placement. It changes the client request builder, not an Edge Function or schema. The prior user instruction excludes staging for this simple prompt change. Broader evaluation with the real targets proceeds separately; adoption is not a claim that the candidate passed that evaluation.

The preceding eight-state, three-condition, three-repetition diagnostic generated 72 valid replies using qwen3.8-flash. At the selected sender-to-link transition, explicit hidden-destination disclosure was baseline 2/3, label-only 2/3, and sequence 1/3. After learner recognition, genuine action elicitation without providing the route was 1/3, 2/3, and 3/3. The sequence still disclosed answers in other cases and did not fix old-answer attribution (3/3 failures in every condition). Safety and actual failed-scaffold exceptions passed 3/3 for the sequence. Independent review covered all72 outputs and recorded36 automated evaluator disagreements/errors; agent judgments are not human labels. One malformed judge result caused process exit1 despite complete target generation. There is no formal behavioral acceptance claim.

Full local diagnostic evidence remains in the original `scaffolding-target-ablation` worktree at experiment commits `a3b80cf` and `81bb3c9`, including frozen requests, raw responses, provider metadata, calibration failures and independent review. This focused adoption change includes the instruction and concise evidence record instead of copying the entire diagnostic history.

## Implementation

Branch: `auto-experiment/scaffolding-target-ablation` in the existing `PhishingTrainingProgram-worktrees/scaffolding-target-ablation` worktree. The user requested experiment-branch implementation first; this is a local branch change.

`tutor-system/src/services/ecologicalTutorCall.ts` exports `NOTICE_THEN_ACTION_POLICY` and appends it after `ASSESSMENT_DIALOGUE_POLICY` in `buildEcologicalChatCompletionMessages`. Its text is byte-identical to `candidate.txt`, including the final newline (SHA-256 `d9b05cc4827e8c1a66eccb4d5ac97dd4a9211e4308f225dc6fa77bf0d054a461`). This reproduces the placement tested by the diagnostic. The original headings and full room prompt are retained. The ordinary phishing/privacy path in `aiService.ts` and ecological prompt exports use this builder; legacy phase0 and separate cyberbullying paths are outside this change.

This integrates the tested instruction without further behavioral refinement. The earlier independent candidate audit and limitations still apply. It is not evidence of reliable scaffolding across templates.

## Verification

On the focused adoption branch based on `968331f`, all four listed suites passed together (31/31) with the dummy local Supabase initialization values. Rebuilt all24 sequence requests again against the original worktree's frozen manifest: byte-identical; the instruction hash remains unchanged. `git diff --check` passed. Hosted CI and current-head code review are recorded on the adoption PR.

- Rebuilt every sequence-condition request from the saved room prompt and each frozen case's input. All 24 requests (eight states × three repetitions) match `raw/v4/frozen.json` byte-for-byte, including full learning targets and user context. The exported instruction exactly equals `candidate.txt`.
- Existing request packaging/ownership/contract suites passed: 31 tests across `ecologicalTutorCall.test.ts`, `promptfooBrevityScaffold.test.ts`, `aiService.requestOwnership.test.ts`, and `tutor_behavior_contract.test.ts`. Only the existing structural prompt-composition expectation changed; no semantic wording assertions were added.
- Initial combined Jest invocation passed 27 tests but the contract suite could not initialize without Supabase configuration. Reran that local parser/builder suite with dummy `REACT_APP_SUPABASE_URL=http://127.0.0.1:54321` and `REACT_APP_SUPABASE_ANON_KEY=local-test-key`: all four tests passed. It performs no database request.
- `tsc --noEmit` remains blocked by repository-wide errors. Compared TypeScript diagnostics with the two changed TypeScript files restored to HEAD in the compiler's in-memory read host: baseline 436, candidate 436, identical file/code/message multiset, zero new diagnostics. No source files were reverted for this comparison.

Jest commands, from `tutor-system/`:

```sh
rtk proxy env CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/ecologicalTutorCall.test.ts src/services/__tests__/promptfooBrevityScaffold.test.ts src/services/__tests__/aiService.requestOwnership.test.ts src/__tests__/tutor_behavior_contract.test.ts
rtk proxy env CI=true REACT_APP_SUPABASE_URL=http://127.0.0.1:54321 REACT_APP_SUPABASE_ANON_KEY=local-test-key npm test -- --watchAll=false --runInBand --runTestsByPath src/__tests__/tutor_behavior_contract.test.ts
rtk proxy ./node_modules/.bin/tsc --noEmit
```

## Which learning targets are evaluated?

The recent notice-then-action diagnostic uses all five full learning points from the saved real iTunes room configuration, via the previous target-ablation snapshot. Its saved `config.prompt_config.detection_areas` exactly equals the current `SCENARIO_TEMPLATES['iTunes Gift Card Survey ($500)'].detection_areas`. The current catalog records its `General Learning Goals.docx` source. Thus this diagnostic contains the new real target text; it is not loading only titles or newly invented targets. It reads a pinned snapshot, not the live database on every run.

The broader tutor suite uses older frozen inventories:

| Checked fixture under `evals/promptfoo/v1/` | Cases | Complete detection inventory exactly matches a current catalog inventory |
|---|---:|---:|
| `development.json` | 45 | 0 |
| `development-with-guard.json` | 61 | 0 |
| `development-with-guard-scenario-rich.json` | 61 | 0 |
| `contextual-reply-cases.json` | 2 | 0 |

These overlapping files are separate versions, not 169 distinct cases. Inspection confirms the old account-alert/iTunes lists with separate detection and verification items remain in these snapshots. Ecological cases originally came from template seeds, while synthetic cases have declared constructed contexts; neither provenance means a frozen inventory automatically stays current.

`prepare.js` reads the repository's demo-room seed configuration (or the configured default for synthetic cases) when preparing a new snapshot. At execution, `runner.js` consumes the case's stored `baseline_messages` or `inventory`. The product adapter uses a stored `baseline_system` by default. Even `regenerate_room_prompt=true` rebuilds from `definition.inventory`; it does not fetch the current room-template targets. Updating a prompt alone therefore does not update those case inventories.

Before using the broader suite to evaluate the current document targets, prepare a new version with explicit template mappings, full current inventories, and revised applicable expectations. Preserve earlier frozen datasets and results for their historical comparisons. This audit did not refresh those cases or rerun the broad suite.
