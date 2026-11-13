# Learning-progress analyzer Candidate01 release

Intent: track the explicitly requested promotion of the evaluated analyzer prompt and its operational verification.

Updated: 2026-11-12. Baseline: `0d4428843c2a7aaba9d11c491bfdb770167d3ab5`.
Release and repair owner: root Codex agent, `fix/learning-progress-candidate01`.

## Scope and authorization

The user explicitly requested: “please PR and merge the change learning-progress analyzer prompt changes”, after the experiment failures were reported. This is an authorized promotion exception, not evidence that the semantic gate passed.

Replace only `TRANSFER_ANALYSIS_SYSTEM_PROMPT` in `assessment-api/index.ts` with the exact Candidate01 bytes, including its final newline. SHA-256: `1fe787dd046e577c2d5e6cf1aa2fb3395137923fbae9f4c1b626cdaddf957735`.
Source: experiment branch `auto-experiment/new-learning-goals`, commit `f15d305`, `evals/promptfoo/learning-progress-analyzer/template-room-pilot/candidate01.txt`.

The prompt judges complete learning points, independent learner evidence, target boundaries and status eligibility. Model, reducer, event schema, room templates and learning targets remain as configured in the baseline. This promotes the single-call prompt; it adds no ensemble architecture.

## Known evaluation outcome

The experiment used all ten unchanged standard rooms and complete document points, with reviewed agent annotations. Human agreement is unmeasured. Development fixed-prior F1 improved from 0.760985 to 0.826543; holdout fixed-prior F1 fell from 0.749320 to 0.738900. Premature coverage rose from 7/141 to 13/141. The candidate fixed 3 and regressed 12 of 258 common successful holdout pairs. Its post-hoc fixed three-member ensemble F1 was 0.748889; ensemble-controlled shared-prior trajectories were not tested. All variants failed the semantic gate. Provider errors remain in the underlying evidence.

Full evaluation record: `tutor-system/docs/ai-behaviors/learning-progress-analyzer-evaluation-record.md` at experiment commit `f15d305`. Raw run evidence remains under `evals/promptfoo/results/qwen3.8-flash/2026-11-12-template-room-pilot/` in the main checkout.

## Verification and release plan

Focused reducer and API contract tests: 22 passed. The initial run lacked placeholder Supabase environment variables; rerunning with explicit local placeholders passed. No network dependency was used for those tests.

Independent review checks exact source fidelity and handler compatibility. Required GitHub CI and staging acceptance precede merge. This Edge-only release requires no SQL changes. Staging `ciubrzggdqesgvfkpolj` and production `zgbufaxooqxeabewktzd` will use the same integrated bundle, with real-provider event/state persistence and cleanup checks. The existing `transfer-status-events` journey covers analysis, eligible transitions and saved progress. The existing shared fourth-grade prompt is an inherited dependency already authorized and merged in PR #77; live bundle inspection found its old version in assessment-api, so exact-source deployment also aligns that dependency. Its ordinary tutor path requires a focused operational check.

Observed pre-release assessment-api versions: staging 81; production 21. Runtime index differs from default only in this prompt; other live differences are the already-merged fourth-grade shared prompt and a comment in `ecologicalTutorCall.ts`. Review, CI, staging, merge and production acceptance are pending.

Recovery: retain exact pre-release bundles and restore the previous integrated artifact if operational acceptance fails; retain known semantic failures rather than rewriting the acceptance claim. The release owner owns diagnosis and cleanup through completion.
