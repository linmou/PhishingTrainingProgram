# Learning-progress analyzer Candidate01 release

Intent: track the explicitly requested promotion of the evaluated analyzer prompt and its operational verification.

Updated: 2026-11-12. Integrated release: `4da7cc2741da44419338e40441eb213e371d2dfa` (PR #79).
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

Independent reviewer `prompt_pr_review` found no blockers on candidate `fd1ec70`, after correcting a missing trailing newline. The runtime prompt and remaining handler match the frozen experiment exactly. All required CI passed in run `43338592956`: isolation-harness, frontend-jest and frontend-build. PR #79 merged at `4da7cc2` on 2026-11-13 00:41:09 UTC (November 12 local time). Its deployable source is identical to the tested candidate.

This Edge-only release has no SQL changes. The existing `transfer-status-events` journey covers analysis, eligible transitions and saved progress. The existing shared fourth-grade prompt is an inherited dependency already authorized and merged in PR #77; exact-source deployment also aligns that dependency. Its ordinary tutor path receives a focused operational check.

The user subsequently clarified that staging is unnecessary for this simple prompt change. The already-running staging checks finished and cleaned their fixtures; no additional staging check was added.

Observed pre-release assessment-api versions: staging 81; production 21. Runtime index differs from default only in this prompt; other live differences were the already-merged fourth-grade shared prompt and a comment in `ecologicalTutorCall.ts`.

## Hosted evidence

Staging assessment-api version 82 passed all seven real-provider status observations: direct understanding, initial signal, later understanding, contradiction, transfer, no evidence and renewed contradiction. Persisted events, progress and visible checklist state passed; fixture cleanup passed. Tutor-response also passed with cleanup. Evidence directories, relative to the focused worktree: `tmp/browser_demo_runs/staging-template-20261113003849-77cd6f2e/` and `staging-template-20261113004001-b8559e5b/`. The staging lease was released.

Integrated source manifest SHA-256: `34ccd3761118deaa962f5c9336d52c04629882713391527c9ede31661f4a3091`. Entry-point SHA-256: `0ec9ba62a83ba1369c5e38bcc7f31cf56599ee612bf875c0129ffb3359071f4d`. Staging bundle hash: `97d00565fb94cc2775338e8dbac3e4869d80c583f4d9cf1c7ca3d568bbdd6929`.

Production assessment-api version 22 is deployed from the integrated commit. Bundle hash: `93a2a01cd3449e4c198c9114257ede6184b9ded5c105c392d8adfe6000c00e64`. MCP retrieval verified every returned source file against the integrated local source; no differences. Platform bundle hashes differ by environment; source parity is verified separately.

Initial production verification (`production-template-20261113004153-4b3cddb0`) stopped before room mutation because the historical fixture room IDs no longer exist. Direct production SQL confirmed their absence. Fixture provisioning initially omitted the required `x-practice-contract: cyberbullying-v2` header and was rejected before insertion; adding the existing application contract header resolved that setup error.

Production acceptance passed all seven status/event observations and stored-progress checks (`production-template-20261113004335-3e78ef9b`), followed by successful tutor-response acceptance (`production-template-20261113004437-58e49806`). Both workflows verified cleanup. Temporary rooms `baa49186-9e64-4fce-9640-4ff1a5b07a06` and `dbb9555a-0645-40a1-8505-e918d65b56f0` copied unchanged staging test-room content and configurations under explicit fixture overrides. Both rooms were deleted afterward; direct production SQL confirmed zero remaining rooms, messages, checklists or configurations for these IDs. The production lease was released.

Release and cleanup are complete. These operational checks establish prompt delivery and functioning event/state integration; they do not reverse the failed semantic benchmark or establish human agreement. Deployment metadata and source manifests are retained in `output/analyzer-candidate01-staging/` and `output/analyzer-candidate01-production/` in the focused worktree; browser records include provider request/response evidence, persisted observations and screenshots.

Recovery: retain exact pre-release bundles and restore the previous integrated artifact if operational acceptance fails; retain known semantic failures rather than rewriting the acceptance claim. The release owner owns diagnosis and cleanup through completion.
