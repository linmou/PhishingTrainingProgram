---
title: Record assessment results in dialogue history
type: feature
created: 2026-10-17
status: done
baseline_commit: c6d51296f42ab84b2fb42d879cb1ff4db8580eae
approved: 2026-10-17
context:
  - tutor-system/docs/supabase-release-workflow.md
  - tutor-system/docs/browser-e2e-testing.md
---

<frozen-after-approval reason="human-owned intent">

## Intent

Persist assessment correctness and learner feedback as room messages so participants and the AI tutor share the same assessment history. Replace the dynamically appended `VERIFIED ASSESSMENT STATE` section with those saved messages.

## Boundaries & Constraints

The trusted backend owns grading and attempt accounting. Each accepted answer gets one automatic result message linked to that answer. Record correctness, retry availability, and terminal resolution. Publish the reviewed answer/explanation only after the second incorrect attempt; a pass reports correctness. Save cancellation notices linked to the closed question.

Preserve the existing tutor-response gate before a subsequent assessment by distinguishing automatic results from tutor replies. Keep learning-progress context and option controls. Proposed audience: results are shared room messages, including the authorized terminal-failure explanation. This extends the existing learner-only response contract to room participants and requires the documentation changes below.

The proposed audience includes the tutor, target learner, other authorized room participants and observers, plus their room exports. It applies to recovered historical failure results too. This audience extension remains part of the draft awaiting human approval.

## I/O & Edge-Case Matrix

| Scenario | Input or state | Required behavior |
| --- | --- | --- |
| First incorrect answer | One accepted attempt; question open | Save an incorrect-result message with one retry remaining; keep the answer key private. |
| Correct answer | Correct selection on either attempt | Save a correct-result message identifying the completed assessment. |
| Final incorrect answer | Second accepted incorrect attempt | Save an incorrect-result message with exhausted attempts, correct option IDs, and learner-safe explanation. |
| Repeated processing | Same answer processed again or reloaded | Return the existing result; exactly one saved result per accepted attempt. |
| Concurrent submissions | Competing requests for the same assessment | Accepted attempts and result messages remain consistent under the existing locks. |
| Invalid submission | Wrong learner, malformed selection, or stale question | Preserve the existing error and attempt accounting. |
| Cancelled assessment | Assistance or target edit closes a question | Persist its cancellation notice, linked to the relevant question/answer; describe the closure accurately. |
| AI generation | Assessment answer followed by saved result | Read result through complete dialogue history. |
| Persistence error | Result-message write fails | Roll back the associated grading transition so retry can complete consistently. |
| Existing records | Accepted attempts or cancellations predate deployment | Backfill each recoverable event once from persisted authority before prompt removal; preserve its original event time and scope. |
| Missing grading/result | Answer exists but processing failed, is pending, or lacks required authoritative facts | Keep its processing/unavailable state visible; block affected tutor generation before a provider call until the trusted operation completes. |
| Guard-deferred grade | Grade commits while progress is deferred | Save the actual terminal result once and preserve deferred progress and Guard priority. |
| Delayed or tied ingress | Result arrives before its answer or shares its timestamp | UI and AI order the linked question, answer and result consistently; stale events do not reopen a closed question. |

</frozen-after-approval>

## Requirements and Document Impact

Approved 2026-10-17. The frozen block preserves the proposal reviewed at approval. Implementation and environment acceptance are recorded in the [release record](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_17_assessment_result_messages.md).

| Source | Required alignment |
| --- | --- |
| `specs/101-transfer-domain/spec.md`, FR-011–013, SC-006; `contracts/transfer-domain-determinism.md` | Preserve pure grading and failure-only explanation timing; clarify downstream publication scope by reference to the revised backend contract. |
| `specs/102-transfer-backend/spec.md`, FR-007–008, FR-013–018 and privacy SC-004/SC-005; `contracts/assessment-api.md`, Public DTOs and Privacy Matrix | Define result events, immutable provenance, publication audience, atomicity and deduplication. Separate private question material from reviewed feedback published after terminal failure, including historical publication. |
| `specs/102-transfer-backend/data-model.md`, `contracts/rpc-contract.md`, `plan.md` | Record result storage and transaction boundaries, then reconcile affected September snapshot statements with verified current behavior. Preserve dated historical evidence. |
| `specs/103-transfer-room-ui/spec.md`, FR-009, FR-011–014, SC-003–005; `contracts/room-ui-contracts.md`, `data-model.md`, `plan.md` | Retain answer-selection navigation; add saved result messages, attribution, chronological merge, reload and export behavior. Update failure-feedback disclosure exceptions. |
| `tutor-system/docs/ai-behaviors/tutor-behavior-specification.md`, T09.3, T09.4 and T09.6 | Align privacy with the reviewed terminal-failure publication exception. Specify recorded results as tutor context and distinguish automatic results from required tutor feedback. |
| `specs/104-transfer-evaluation/spec.md`, FR-023, FR-026, FR-028; `contracts/transfer-case-schema.md`, `contracts/quality-gate.md` | Add message identity/order, duplicate/reload and outbound-history evidence. Align disclosure checks with terminal-failure room messages. |
| `tutor-system/docs/aiService.md`, `transfer-assessment-qa-guide.md`, `browser-e2e-testing.md` | Describe history-based assessment context and update pass/retry/failure, room-audience and tutor-follow-up checks. |

Append pending tasks to the affected component `tasks.md` files, with links to this change. Mark their requirements checklists complete only after implementation evidence exists. Use a dated documentation update record for the approved requirement changes and eventual release evidence.

## Implementation Decisions

**Persisted event and API:** Extend the existing message record with backend-owned `assessment_event` metadata: stable event key, result/closure kind, assessment and learner IDs, source answer ID when present, accepted attempt number, outcome, counts, terminal/lifecycle and progress-deferred flag. Enforce unique result keys per accepted answer and one closure key per cancelled assessment. Keep the source attempt identity separate from the public message ID. Protect event metadata and result content against participant creation/editing through direct and legacy writes. Reads inherit the existing ordinary-message reader boundary; the live source currently permits anonymous reads, as recorded in the central contract. User text claiming to be a result has no trusted provenance.

Result rows use the existing tutor storage role/room tutor identity, `response_mode: null`, and an explicit Assessment result presentation. They are not human tutor speech, learner evidence, or mandatory-rating targets. SQL feedback predicates must exclude these rows explicitly, including predicates that currently check any later tutor message. Cancellation has its own event kind and does not imply an incorrect attempt.

Extend `PublicMessageDTO` with the safe event metadata and `ProcessedMessageDTO` with `result_message: PublicMessageDTO | null`. An accepted or duplicate grade returns the same saved row; assistance returns its closure row. Update SQL projection, Edge `projectMessage`/`projectProcessed`, browser parser and allowlists together. A result row is not a new public question. Keep private rubric, transfer basis, raw provider material and undisclosed answers outside these DTOs. Target-edit cancellation arrives through the ordinary message stream and catch-up read.

**Existing-data cutover:** In the same pending migration, backfill recoverable attempts from private persisted outcomes and cancellations from stored lifecycle/closure facts. Reuse the same event-key writer as new processing under the existing lock order. Preserve original attempt/closure timestamps and reviewed explanations; reruns return existing rows. Record counts and publication scope before/after and verify that backfill leaves grading, progress, attempt snapshots and existing tutor feedback unchanged. Incomplete legacy assessments stay explicitly unavailable; never derive missing grades from dialogue. Any missing authority for an affected assessment blocks its generation path and the release completeness gate until resolved or explicitly excluded with recorded evidence. Complete and verify this backfill before enabling the frontend that removes state injection.

**History and generation:** `simplifiedAIContext.ts` must select public question options/selection type, learner identity, parent links and event metadata. Render stem plus ordered options once, preserve the student's selection, then identify the linked backend result as Assessment result with attempt/retry/lifecycle information. Use a shared stable ordering rule in AI context and UI: chronological unrelated messages; causal question → answer → corresponding result order for dependencies and timestamp ties, with ID as the final tie-breaker. Backfilled rows use their source event time rather than migration time. Distinguish multiple learners and repeated questions.

Retain a trusted readiness read through the assessment service before initial generation, historical-answer focus and regeneration: verify relevant learner assessment answers have committed processing/results and include those result IDs in the fetched history. Missing/pending grading or a failed history page stops generation visibly before the provider call. Reuse existing trusted processing for recovery; the browser does not grade. Remove prompt-only `TutorAssessmentFeedback` assembly, while retaining backend validation needed for this readiness check and the existing assessment-answer analysis exclusion. Do not rely on a learner opening the room to populate results.

Persist handled non-consuming outcomes privately so ambiguous, stale and Guard-deferred answers can be distinguished from unfinished processing without inventing a grade or spending an attempt. The authorized readiness operation may recover pending answers through the existing deterministic processor, then reread trusted readiness. A Guard-only deferral can resume when Guard clears. Keep this processing bookkeeping out of the prompt; pass only handled-answer/result IDs and learner scope to history assembly. Apply readiness even after transfer learning is disabled, and keep an unrelated learner's pending answer from blocking the focused learner. Route the existing owner-only clear-history action through an atomic backend operation that removes its assessment sources before messages while preserving protection against individual event deletion.

Remove the entire dynamic state section. Put only invariant instructions in common request assembly: follow recorded backend grades, preserve open retries and disclosure timing, treat cancellation accurately, give required tutor feedback, and preserve immediate safety/Guard priority. Apply the history/readiness contract to every enabled tutor request path and retain product/evaluation packaging parity. Transient assessment state must not be saved into room prompts/configuration; inspect existing saved prompts for this contamination and document exact remediation before changing authored content.

**Room presentation:** The saved result message owns correctness, retry and final explanation display. Keep answer-selection navigation and server-derived disabled/closed controls on the question; remove duplicate inline verdict/explanation text. Merge returned results immediately and hydrate their read-only lifecycle fields through join, polling, realtime and reconnect for every participant. Handle result-before-answer, question UPDATE, duplicate tabs, older events and cancellation without recomputing a grade. Automatic rows have clear attribution and are excluded from required tutor ratings, AI-suggestion feedback and human-feedback gate detection. Exports preserve result identity, linkage, provenance and the approved audience.

## Code Map and Execution

Paths below are relative to `tutor-system/` except the requirements paths in the impact table. Existing live RPCs are inspected through Supabase MCP before SQL authoring.

## Tasks & Acceptance

**Execution:**

- [x] `supabase/archived_migrations/20261017000000_assessment_result_messages.sql` — event metadata/uniqueness/protection; transactional grade and both cancellation paths; historical backfill; readiness/projection changes; all affected feedback predicates.
- [x] `supabase/tests/assessment_result_messages.sql` — matrix, role/legacy-write protection, backfill invariance, Guard deferral, duplicates/concurrency and fault rollback against restored baselines.
- [x] `supabase/functions/assessment-api/index.ts`, `index.test.ts` — safe event/result DTO projection and readiness contract, including duplicate and cancellation returns.
- [x] `src/services/transferAssessmentService.ts`, `src/contexts/transferAssessmentUiAdapter.ts`, `src/types/index.ts` — typed safe projections, immediate result merge and lifecycle hydration.
- [x] `src/services/simplifiedAIContext.ts`, `src/services/ecologicalTutorCall.ts`, `src/services/aiService.ts`, `src/types/assessment.ts` — public question/result history, readiness validation, shared request rules and removal of prompt-only feedback state.
- [x] `src/contexts/RoomContext.tsx`, `src/pages/RoomPagePost.tsx`, `src/components/PostComment.tsx`, `src/components/PublicAssessmentQuestion.tsx`, `src/utils/messagePresentation.ts`, `src/contexts/roomExportBuilder.ts` — all-ingress lifecycle, stable common ordering, one result display, rating exclusion, attribution and exports. Use one shared ordering helper for UI/history.
- [x] Existing Edge/service/context/component/export suites and browser runner — verify these contracts using bounded workers; add focused prompt evaluation fixtures through the existing product/evaluation assembly.
- [x] Documents in the impact table — align requirements/contracts first, then record verified implementation and release evidence.
- [x] Release owner Codex `/root` — validate SQL locally, deploy/verify staging, integrate into `no_sign_up`, freeze artifacts, and promote/verify production in dependency order.

**Acceptance Criteria:**

- Given an accepted assessment answer, when grading completes, then both room participants receive its saved result and see it after reload.
- Given the saved answer/result sequence, when a tutor suggestion is generated, then the outbound dialogue contains that sequence and the system prompt omits the removed section.
- Given an automatic terminal result, when another assessment is considered, then the existing tutor-feedback gate still behaves correctly.
- Given a failed or retried processing request, when persistence is inspected, then grade state and result messages agree.
- Given existing accepted attempts/cancellations, when the migration is rerun and the frontend changes, then recoverable facts remain in causal history exactly once and incomplete facts remain explicitly unavailable.
- Given an answer saved before its grade/result commits, when any tutor generation path is invoked, then provider invocation waits for complete trusted history or returns an explicit processing/unavailable error.
- Given an automatic result with delayed/out-of-order delivery, when a room rejoins or reconnects, then participants converge on the same result order and closed controls without a mandatory tutor-rating prompt.

## Design Notes

Production MCP inspection confirmed private attempt and question-metadata writes. Review of `simplifiedAIContext.ts:48` found that current history omits options and result provenance. Edge projections at `assessment-api/index.ts:180–224` drop unknown fields; `RoomPagePost.tsx:389` treats tutor rows as rating targets. These are assigned integration work, not assumptions that existing code already supports the change.

## Verification

Local validation passes16 SQL scenarios on pristine production/staging baseline clones,39 Edge tests,22 focused Jest suites/240 tests, production TypeScript and optimized builds. The final static retry-contract clarification additionally passes21 affected prompt/comparison tests. The linked release record retains Red/Green, baseline equivalence, concurrency, failed iterations, real-provider and hosted verification evidence.

Deterministic acceptance covers every matrix row, wrong learner/room, forged event metadata, duplicate processing after tutor feedback, terminal third submissions, missing options/history-page errors, tied/backfilled ordering, cancelled retry questions, all ingress paths, multiple learners, answer/result races, preserved tutor gates and required-rating exclusion. Use controlled provider responses for orchestration/format/error cases rather than asserting generated wording.

Real-provider/semantic acceptance checks initial/focused/regenerated tutor requests against saved retry, pass, final failure, cancellation and Guard-deferred results: the tutor follows recorded grading, keeps retry answers private, supplies accurate required feedback, and retains safety/Guard priority. Record complete input/output and judgment evidence; do not replace semantic review with wording assertions. Evaluation fixtures import production request assembly.

Batch `assessment-results-dialogue-2026-10-17`, release owner Codex `/root`: validate/backfill SQL → deploy matching Edge projections/readiness → enable matching client/history/prompt artifacts. Staging acceptance runs extended `assessment-answer` and `tutor-response` journeys plus the targeted API cases above. After merge into `no_sign_up`, freeze SQL/Edge dependency/frontend hashes, compare integrated artifacts with staging, and repeat invalidated checks. Production rechecks preconditions, promotes the exact integrated artifacts in the same order, and passes the matching affected journeys. Coordinate with any active release owner before shared deployment. Save request/response, rows, backfill counts, artifact/config versions and fixture cleanup; archive SQL only after both environments pass. Prompt-state removal depends on verified result/backfill readiness, not a deployment success response.

## Spec Change Log

- 2026-10-17: Requirements review corrected pass feedback to correctness-only and identified room-wide terminal-failure disclosure as a contract change. Added source-level documentation and evaluation alignment tasks. Preserve backend grading and the current tutor-feedback gate.
- 2026-10-17: Three independent reviewers passed request/requirements scope but rejected persistence rollout, history completeness, UI/API integration and evidence coverage. Added authoritative historical backfill, explicit event/API contract, options/provenance/history readiness, preserved invariant rules, complete ingress/display/rating tasks, and targeted deterministic/provider/release checks. Original draft and reviews are retained under `audits/assessment_results_plan_*`.
- 2026-10-17: Implementation review identified unscored-answer readiness, multi-learner scope, feature-disable bypass and clear-history regression. Specify private non-consuming processing provenance, deterministic recovery and a trusted atomic clear operation. Real-provider retry feedback leaked the solution, requiring a stronger invariant retry instruction and repeat initial/regenerated provider evaluation. Preserve accepted-attempt grading, atomic public result creation, causal history, backfill and existing tutor gates.

## Suggested Review Order

**Tutor generation**

- Start at tutor generation: assessment facts now arrive through saved dialogue.
  [aiService.ts:884](../../tutor-system/src/services/aiService.ts#L884)

**Persistence and readiness**

- Check atomic grading, result identity and failure-only reviewed disclosure.
  [20261017000000_assessment_result_messages.sql:116](../../tutor-system/supabase/archived_migrations/20261017000000_assessment_result_messages.sql#L116)

- Check learner-scoped readiness, recovery and complete ordinary dialogue.
  [simplifiedAIContext.ts:75](../../tutor-system/src/services/simplifiedAIContext.ts#L75)

**Request behavior**

- Review invariant retry, unscored-answer and Guard instructions shared across request paths.
  [ecologicalTutorCall.ts:26](../../tutor-system/src/services/ecologicalTutorCall.ts#L26)

**Room presentation**

- Follow causal merging and lifecycle restoration across message ingress paths.
  [transferAssessmentUiAdapter.ts:458](../../tutor-system/src/contexts/transferAssessmentUiAdapter.ts#L458)

- Confirm automatic attribution and rating exclusion.
  [PostComment.tsx:162](../../tutor-system/src/components/PostComment.tsx#L162)

**Verification**

- Review deterministic privacy, rollback, permissions, recovery and clearing regressions.
  [assessment_result_messages.sql:1](../../tutor-system/supabase/tests/assessment_result_messages.sql#L1)

- Check exact staging/production artifacts, real-provider evidence and cleanup.
  [documentation_update_record_v2026_10_17_assessment_result_messages.md:1](../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_17_assessment_result_messages.md#L1)
