# Integrated open-issue review

Intent: preserve independent code-review and AI-refinement findings against the integrated candidate, separating demonstrated behavior from outstanding acceptance evidence.

Date: 2026-10-24. Reviewer: independent agent `/root/review_integrated`, which did not author the candidate. Candidate: `79496b64a0219b693133fd300b08d0ca62909d53`; comparison base: `505ef52`. Scope: issues #19, #20, #21 and #2; inherited documentation changes and the separately developed #22 refactor are outside this review.

## Findings

No concrete implementation defect was identified in the inspected diff. Completion/release acceptance remains incomplete for the following reasons, ordered by impact:

1. **P1, #2: semantic generalization and non-regression are unverified.** `scripts/replay-issue-2.cjs:62` declares one repetition and no semantic judge. Its three cases share the reported scenario and URL target. The acknowledgment case demonstrates the intended repair, but there is no complete existing/expanded tutor suite, frozen evaluation plan with thresholds and applicability, calibrated semantic scoring, eligible independent holdouts, or comparable three-repetition classification evidence where required. The record already acknowledges these gaps at `documentation_update_record_v2026_10_24_tutor_progress_alignment.md:41`. Required action: evaluate the frozen candidate under the evaluation contract before claiming behavior acceptance. Varied acknowledgment wording, target labels and scenarios, legitimate target switches, Guard priority and already-complete targets need coverage; proposed cases are not executed evidence.
2. **P1, #2: projected eligibility does not verify assessment handoff or persisted lifecycle.** `scripts/replay-issue-2.cjs:179` writes `assessment_preparation_required` and skips tutor generation when projected readiness is true. It never calls the trusted prepare RPC or delivers/answers an assessment. Required action: run the isolated staging journey specified at `documentation_update_record_v2026_10_24_tutor_progress_alignment.md:43`, retaining actual provider input/output, accepted transitions, no-assessment acknowledgment, assessment-before-ordinary-tutor handoff, misconception, repair/recovery, retry/terminal feedback and cleanup. Use the combined candidate and applicable project lease. Browser/release acceptance is open.
3. **P2, #19/#20/#21: combined browser acceptance and #19 end-to-end synchronization measurements are absent from inspected evidence.** `documentation_update_record_v2026_10_24_message_sync.md:24` explicitly measures callback dispatch and JSON bodies, excluding real network/browser latency. The healthy missed-event bound also increases from two seconds to sixty seconds plus scan time. Required action: record actual 100/1,000-message transfer/request and synchronization-latency evidence, including missed INSERT/UPDATE and reconnect, and run the affected combined chat/feedback/assessment browser journeys. #20's simulated latency and #21's local merge measurements are correctly disclosed diagnostics; they do not establish browser acceptance.

These are evidence gaps, not demonstrated code failures. Do not interpret their severity as a finding that a particular unrun journey fails.

## Code and permission review

Inspected the integrated RoomContext ingress/join/subscription changes, `roomMessageSync`, `useMessageFeedback`, batched feedback query, assessment ordering, AI service/progress formatter/prompt and their focused tests. The sync uses cancellable ID-keyset scans, records realtime rows during each scan, coalesces recovery requests, and suppresses old-room delivery. The feedback hook isolates scope by room/user, retains loaded-zero entries, coalesces reads, follows in-flight invalidation, and rejects pre-reset results. The ordering index retains the prior dependency traversal and bounded attempt semantics. No separate message merge or grading path was introduced.

The release coordinator reported a read-only production MCP inspection on project `zgbufaxooqxeabewktzd`: `message_feedback` has public-role ALL policy `Allow feedback operations`, `qual = true`, `with_check = null`; messages also retain existing permissive policies. The batched query changes no authorization policy and preserves the existing table-read boundary. This is a coordinator-supplied live observation, not an independent staging-policy verification or an authorization improvement. No hosted writes or deployments were performed by this reviewer.

## Independent refinement audit

**Verdict: `incomplete` for candidate `79496b64a0219b693133fd300b08d0ca62909d53`.** The inspected rules follow T02/P2, T09 and P4/H4: learner-owned state, acknowledgment versus demonstrated evidence, named unresolved follow-up, and trusted preparation rather than Covered alone. Constitution 1.0 records the human-adopted principles; no new constitutional priority was inferred. No hard-coded evaluation IDs, answer lookups, or scenario-specific exceptions were found in the production changes. The diagnostic harness itself intentionally selects the reported message and URL target, limiting what its results generalize to.

Inspected the constitution, tutor behavior specification including T02/TA01-TA04/T09, response-consumer duties, evaluation-contract sections on independent audits and acceptance, final-analysis/product-verification references, declared changed factors, baseline/candidate AI diffs, replay harness, saved manifests/metadata/source snapshots and all three cases' saved analysis/tutor results. Raw evidence root: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/issue-2-20261024/output/issue-2-replay/`.

Compared runs `baseline-2026-10-24T06-44-44-494Z` and `candidate-2026-10-24T06-43-26-425Z`. Both use `qwen3.8-flash`, the same configured endpoint, tutor temperature 0.3/max_tokens 600, one repetition and the same three-case manifest. The exported progress is a replay prior, not reconstructed historical state. Changed factors are checklist selection, richer learner/target/status/understanding context, placement in the final user turn, and explicit unresolved-target guidance; the observed improvement cannot be assigned to the prompt clause alone.

Independent byte comparison of each frozen source file against candidate Git objects confirmed that the saved candidate's `aiService`, `tutorLearningProgress` and active tutor prompt match this exact candidate. Of 39 frozen files, only `assessmentRendering.ts` and `supabase.ts` differ due to the other integrated fixes; the replay replaces database transport. Both metadata files record base `7762cbb` because the AI changes were uncommitted during replay, so source snapshots, rather than that metadata revision alone, establish tested AI-source identity.

| Case | Baseline and candidate state | Independently observed tutor/lifecycle result |
| --- | --- | --- |
| Actual acknowledgment | No event, `partially_covered/basic`, not assessment-due | Baseline switches to urgency without retained URL follow-up; candidate names URL Analysis in its reason and asks for the missing URL explanation. |
| Concrete explanation and independent safe action | `demonstrated_understanding`, `covered/good`, projected assessment-due | Both stop at a recorded preparation-required route; no prepare/delivery/grading call is executed. |
| Misconception | `contradiction`, `needs_review/basic`, not assessment-due | Both repair the shortened-link inference and give an independent safe action. Candidate labels the first teaching act correction; baseline labels it protective instruction. No calibrated instruction/response metric is present to establish a regression verdict. |

The acknowledgment is direct diagnostic evidence of improved target continuity. State/eligibility checks and tutor-success flags are available; semantic score and jointly applicable semantic metric results are missing. Thus no formal joint pass rates, non-regression verdict or population-level learning benefit can be inferred. The available cases show no established requirement contradiction. Findings 1-2 must be resolved before the audit can become clear for acceptance; this review does not supply missing model/judge runs.

## Evidence Identity

SHA-256 values independently recomputed from saved files:

| Artifact | SHA-256 |
| --- | --- |
| Shared baseline/candidate manifest | `ea4c648309eaddf940b5824dbff9804ddd4f7a770380a5e091af10cf4d8b75cc` |
| Baseline source snapshot | `626e689398ff90e217a603446da9092206dc0a19252eff86f23ad0b2c9298c4f` |
| Candidate source snapshot | `1202d1b5c47c38e65afdcca8dd5384a52f6362e0098b8d9edd884f127bab40e3` |
| Candidate acknowledgment analysis | `403468649be63b205388d192f118d21e82bab5a7ebd8f05a5a48deb27d9989b2` |
| Candidate acknowledgment tutor | `e983fb12e5f9b25fe165b429d1a96c1df4e7791bf50707e03df0c0d439830309` |
| Baseline acknowledgment tutor | `e9d698f7217f2cc5bd0cff0c155880f59c02227b1debe9b7251c2240131a9160` |

Review used read-only Git/source/artifact inspection and Node byte/hash comparisons. No new tests or provider calls were run; the coordinator owns the integrated suite already in progress. A shell SHA utility failed because of the host Perl locale; Node crypto successfully recomputed the recorded artifact hashes. Any later relevant candidate change requires an affected-scope review and audit against its new hash.

## Scoped Evaluation Follow-up

After the review, the coordinator authorized a bounded provider evaluation of the changed T02 behavior, preserving unrelated existing assertions without rerunning their full suite. Work is retained under ignored `output/issue-2-semantic/` in this integration worktree. This follow-up does not revise the audit verdict above.

The prepared run freezes eight cases: the original acknowledgment and controlled misconception with exact saved production requests; new neutral/terse acknowledgments; an irrelevant shop-name contrast; a fully demonstrated target; a legitimate requested target switch; and deliberate-disruption Guard priority. Baseline and candidate each have three planned generations,48 total. The same canonical evaluator retains target choice, contextual knowledge and evidence-grounded reasoning checks; an additional target-continuity/follow-up check has four labeled calibration examples. The new case author is independent of the candidate author but had previously inspected the prompt; that exposure is disclosed and these cases do not establish wholly unexposed holdout coverage. The original understanding case and its unexecuted real preparation boundary remain preserved in the earlier replay and assigned to live lifecycle verification.

`rtk proxy node output/issue-2-semantic/evaluate.test.cjs` passed request-condition/context separation, eight distinct cases, complete-state contrast, irrelevant-brand contrast, and an executable global concurrency bound of two. The three inherited semantic rubric files match the historical calibrated Qwen3.5 judge package byte for byte. Target settings are Qwen3.8 Flash/nonthinking/temperature0.3/600tokens; judge settings retain Qwen3.5 Flash/thinking/temperature0/8000tokens. Credentials were loaded from the authorized main-worktree configuration into the process environment only.

**Execution is transport-blocked, not semantically evaluated.** On 2026-10-25 UTC, three follow-up calibration samples exhausted three configured transport attempts each with `ENOTFOUND`, `ETIMEDOUT` or `UND_ERR_CONNECT_TIMEOUT`, returning no HTTP/model response. Their saved statuses are `missing`. The fourth was interrupted with SIGINT before further retry work; no target generation or broad run was launched. Subsequent DNS returned three addresses, but an independent unauthenticated HTTPS check to the configured Dashscope endpoint timed out after10seconds; a GitHub HTTPS control returned200 and system proxies were disabled. Full requests, attempts, raw errors, frozen cases/settings/source and resume instructions are in `run-01/manifest.json`, `run-01/calibration/`, `run-01/calls/`, and `run-01/execution-status.json`.

The initial proposed full existing63-case comparison would require378 target generations and3906 semantic judge calls before repairs. The coordinator explicitly narrowed that work before execution. The prepared eight-case run would require approximately200 semantic requests; a defensible live runtime estimate remains unavailable because no judge response returned. Next action: restore access to the configured endpoint, preserve this failed condition, run a fresh transport-recovery condition with identical semantic inputs/settings, complete calibration and a timed preflight, then execute the scoped comparison. Full-suite/unrelated metrics and full unseen generalization remain unrun; no formal experimental behavior version is registered.
