# Investigation: missing assessment in transfer assessment test2

Intent: identify the room from the supplied conversation and explain the missing assessment using live production evidence.

## Hand-off Brief

The supplied conversation exists in production room `6dbd1133-c07a-4af6-9da4-41f874e26ffb`, titled `transfer assessment test2`. Two independent production conditions suppress a new assessment: a prior assessment remains open, and the deployed selector requires Partial/basic evidence while this message produced Covered/good demonstrated understanding. Repair assessment-answer binding and reconcile the pending final-assessment release before validating a fresh learner workflow.

## Case Info

| Field | Value |
| --- | --- |
| Date opened | 2026-10-14 |
| Status | Concluded |
| System | Production Supabase `zgbufaxooqxeabewktzd` |
| Room | `6dbd1133-c07a-4af6-9da4-41f874e26ffb` |
| Student | `794abdb9-6c8e-4526-a384-1e1a5a7f794a` |
| Evidence sources | Read-only Supabase MCP queries, production function definitions and logs, repository source |

## Problem Statement

The user supplied the learner message `all caps, immediately` and the AI reply `You found the words creating urgency. Does the sender name match the real company or platform you use?` and asked why the assessment did not pop up.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| Production messages | Available | Exact content match and parent message link |
| Production progress and assessment storage | Available | 18 checklist items, 32 learning events, one open assessment, zero assessment attempts |
| Live function definitions | Available | Read directly with `pg_get_functiondef`; current production gate verified |
| Browser session and console | Missing | No reproduction performed yet |
| Supabase health advisories | Available | No health lints reported |
| Evidence snapshot | Available | `transfer-assessment-test2-missing-assessment-evidence.json`: full room conversation, progress, learning-event input/output, relevant SQL definitions, selected server logs |

## Investigation Backlog

| # | Path to explore | Priority | Status |
| --- | --- | --- | --- |
| 1 | Find room and exact messages | High | Done |
| 2 | Check persisted learning state and assessment records | High | Done |
| 3 | Trace deployed eligibility and frontend trigger | High | Done |
| 4 | Finalize evidence and diagnosis | High | Done |

## Timeline of Events

| UTC time | Event | Evidence | Confidence |
| --- | --- | --- | --- |
| 2026-10-14 14:45:00.377122 | Prior assessment question delivered: account locked, call a number | Message `d08e6f51-e8e8-4e08-b1a6-cedfeff0edb0`; assessment `85feb0e3-b542-4024-891c-d8266fc10e47` | Confirmed |
| 2026-10-14 14:45:12.750607 | Learner replies `A`, linked to question by parent ID but with null assessment ID | Message `2cd16d01-9351-4f19-8718-c8cf62bc2d56` | Confirmed |
| 2026-10-14 14:45:47.692528 | Tutor posts ordinary tutoring feedback saying answer is incorrect | Message `364f93c1-2201-4965-8b62-2aa46602c72d`; no recorded assessment attempt | Confirmed |
| 2026-10-14 15:08:23.076415 | Student: `all caps, immediately` | `public.messages`, ID `07271a6a-113a-4a92-b2b0-82aaf526b345` | Confirmed |
| 2026-10-14 15:08:40.645009 | Analyzer applies `demonstrated_understanding`, producing Covered/good for No Alternative Contact Method | Event `361e6cbd-be15-4d34-acaf-40ac7302a363`; analysis marker `1bb0f555-21df-49ca-a838-f66d21b373d1` | Confirmed |
| 2026-10-14 15:08:40.677 | Assessment API returns HTTP 200 following analysis | Supabase function edge logs, API version 9 | Confirmed |
| 2026-10-14 15:08:41.225 | Second assessment API call returns HTTP 200 with 43-byte response | Supabase function edge logs; consistent with null preparation, payload unavailable | Confirmed / interpretation deduced |
| 2026-10-14 15:08:47.933 | Ordinary AI API returns HTTP 200 | Supabase function edge logs | Confirmed |
| 2026-10-14 15:09:06.976587 | AI asks whether sender name matches the real company | `public.messages`, ID `27687b92-fbd0-4599-9582-b57a7442bfe3`, parent is student's message | Confirmed |

## Confirmed Findings

### Finding 1: Exact room and student match

Both supplied messages belong to `transfer assessment test2` in production. The student is `E2E Learner 20260930062117-f2501ed1`; the AI reply is stored under `ellen_1008` with `response_mode = tutoring` and no `assessment_id`.

### Finding 2: Production still uses the earlier eligibility rule

**Evidence:** Live `public.prepare_transfer_assessment_context_v1`, inspected through Supabase MCP on 2026-10-14; full definition in evidence snapshot. It selects only `status = partially_covered`, `understanding_level = basic`, and a focus-message event of `initial_signal` or `post_repair_signal`.

The supplied message instead produced an applied `demonstrated_understanding` event and Covered/good. A read-only SQL evaluation of the actual focus marker and current checklist found **zero matching targets even when ignoring the open-assessment blocker**. Protection and correction flags were false. Therefore the current production rule cannot generate a new assessment from this event.

The newer Partial/basic → Covered/good final-assessment policy exists in `tutor-system/supabase/migration-candidates/20261014000000_final_assessment_after_understanding.sql:12`. Its release record explicitly says hosted release is pending and the candidate was not applied to either project: `tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_13_final_assessment_implementation.md:8` and `:20`. The live function independently confirms the old behavior remains deployed.

### Finding 3: A prior open assessment independently blocks every new assessment for this learner

**Evidence:** `private.transfer_assessments`, ID `85feb0e3-b542-4024-891c-d8266fc10e47`, `lifecycle = open`, created and last updated at 14:45:00.377122 UTC. `private.transfer_assessment_attempts` contains no rows for it. The public question remains `assessment_lifecycle = delivered` with no answer/result/closed timestamp.

The live prepare function checks for any open assessment in the same room for the same student and includes that result in `v_blocked`. It prevents a new question regardless of another target's readiness.

The learner's `A` reply points to the question via `parent_message_id` but has `assessment_id = null`. The live posting function only validates and binds an assessment when `p_assessment_id` is explicitly supplied; a parent question alone is insufficient. The live processing function also requires the answer's assessment ID to match. The ordinary tutor message saying “incorrect” does not create an authoritative attempt or close the assessment.

Generic Reply is available on question messages (`tutor-system/src/components/PostComment.tsx:306`), and the generic composer initially supplies only the parent message ID (`tutor-system/src/pages/RoomPagePost.tsx:421`). Dedicated option controls explicitly supply the assessment ID (`tutor-system/src/pages/RoomPagePost.tsx:589`). However, current checked-in `RoomContext` already attempts to bind ordinary text replies to the learner's active delivered question (`tutor-system/src/contexts/RoomContext.tsx:684` through `:699`), introduced by `ef2d876 fix(transfer): process textbox replies to active assessments` on 2026-10-13. Consequently, the observed failure establishes missing binding in the executing client/path, but does not prove that the current source lacks the fix. A stale frontend or missing active question/checklist projection remains possible.

### Finding 4: The recorded learning evidence targets an unrelated concept

**Evidence:** Event `361e6cbd-be15-4d34-acaf-40ac7302a363` maps `all caps, immediately` to item `75009e62-c335-4d03-88a2-29cb56a9ddfa`, “No Alternative Contact Method: Legitimate alerts provide multiple ways to verify.” It marks this target Covered/good with recognition evidence.

The event explanation treats urgency words as evidence of a lack of alternative contact methods. That conceptual link is unsupported by the quoted learner message. This is a separate classification-quality issue, rather than the cause of the open-assessment lifecycle blocker. Urgency-related targets were already Covered/good before this interaction.

## Source Code Trace

| Element | Evidence |
| --- | --- |
| Analyze the learner's message before preparation | `tutor-system/src/contexts/RoomContext.tsx:1059` |
| Request assessment preparation | `tutor-system/src/contexts/RoomContext.tsx:1062` |
| Trusted prepare RPC; null result when no target is due | Live assessment-api version 9, entrypoint lines 410–417; matching repository `tutor-system/supabase/functions/assessment-api/index.ts:417` |
| Fall through to ordinary tutoring | `tutor-system/src/contexts/RoomContext.tsx:1099` |
| Valid prepared draft is shown for tutor review | `tutor-system/src/pages/RoomPagePost.tsx:1012` |
| Delivered question renders in the conversation | `tutor-system/src/components/PostComment.tsx:223` |
| Generic text reply is bound to active question when transfer state is available | `tutor-system/src/contexts/RoomContext.tsx:684` |
| Only bound replies enter authoritative assessment processing | `tutor-system/src/contexts/RoomContext.tsx:725` |
| Tutor recognizes assessment answers using assessment ID | `tutor-system/src/contexts/RoomContext.tsx:1031` |

The live Edge Function version is 9, updated `2026-10-13T04:40:06.059Z`, bundle SHA-256 `712d042e73f3e01adc6fe96a38c75cd2dca67f3e67f5812f2f1b7b5a9d1bb29c`. Source commit context: `f742c37 feat(ai): assess after developed understanding`; no tracked local changes were present when inspection began.

## Hypothesized Paths

### Hypothesis 1: Assessment eligibility was not reached

**Status:** Confirmed. The focus event is `demonstrated_understanding` and its item is Covered/good; the deployed selector requires Partial/basic plus an initial/post-repair signal. Predicate evaluation returned zero eligible targets, independently of lifecycle blocking.

### Hypothesis 2: An eligible assessment failed in generation or UI delivery

**Status:** Refuted as the explanation for this focus turn. Two independent live selector predicates exclude preparation. The assessment API returned HTTP 200, ordinary AI generation followed, and no assessment row exists for this focus message. Server logs do not expose request/response bodies, so exact payload contents remain unavailable.

### Hypothesis 3: A stale open assessment blocks delivery

**Status:** Confirmed. The prior assessment remains open, has no authoritative attempts, and its purported answer has a null assessment ID. The live selector explicitly blocks open assessments.

### Hypothesis 4: Executing frontend lacks the text-reply binding fix or its required state

**Status:** Open. Current source contains automatic binding, but the production answer lacks it. Verify deployed asset version against `ef2d876`, the actual posting payload, and the learner-owned delivered question/checklist projection at submission. A stale bundle, missing projection, or bypassed transfer branch could account for the discrepancy; current evidence does not distinguish them.

## Missing Evidence

Browser network and console history, HTTP bodies, and the deployed browser bundle version are unavailable. These would establish the exact UI route used to submit `A`; the database confirms its missing binding regardless. The MCP role cannot directly execute the restricted preparation RPC; its inspected predicate was instead evaluated by a read-only SELECT. No production messages, progress, or assessment records were changed.

## Conclusion

**Confidence: High** for the two independent suppression conditions and the missing answer binding. The exact browser action that omitted the binding remains inferred from source and persisted data.

The expected new final assessment does not appear because production still selects the earlier Partial/basic event pattern and an earlier assessment is also stuck open. An AI acknowledgement is ordinary tutoring output and cannot establish assessment eligibility or close an assessment. The classification issue adds incorrect progress credit but does not remove either blocker.

## Recommended Next Steps

1. Verify deployment and runtime conditions for the existing text-reply binding fix (`ef2d876`), then ensure normal replies and option controls create authoritative attempts. Resolve the existing open assessment through its supported lifecycle after establishing the affected state.
2. Deliver the pending final-assessment policy through the repository's staging-before-production release workflow, with matching backend/frontend behavior.
3. Validate target-specific evidence classification so urgency recognition cannot complete an unrelated contact-method target.

These are fix directions; implementation and live data repair are outside this diagnosis.

## Verification and Reproduction Plan

The integrated evidence is the persisted learner message → trusted analysis marker/event → live selector predicates → assessment API success → ordinary AI response chain. The evidence snapshot includes 24 conversation messages, 32 learning-event records, all 18 checklist items, the open assessment, no attempts, the actual live SQL definitions, and timestamped relevant server logs.

For a future staging regression: deliver one question, reply `A` through the ordinary reply composer, verify assessment binding and recorded attempt, then complete a different target from Partial/basic to Covered/good and verify the expected tutor assessment review appears after lifecycle resolution. Include option-control answers, text answers, and unrelated-topic evidence. Existing regression references include `tutor-system/src/contexts/__tests__/RoomContext.transferDraftLifecycle.test.tsx:226` (null preparation falls through to tutoring) and `tutor-system/supabase/tests/final_assessment_after_understanding.sql:214` (open assessment blocks duplicate delivery). No automated tests were run or added during this read-only diagnosis.

## Follow-up: 2026-10-14 — why answer binding and tests missed the interaction

Intent: distinguish the observed missing identity from the unconfirmed executing-client cause, and audit the relevant test coverage.

### Binding mechanism

There are two independent identities: `parent_message_id` threads a reply under a message; `assessment_id` identifies the authoritative assessment. Generic Reply supplies only the first. Current `RoomContext.tsx:684` adds the second only inside the active transfer branch and when it finds a learner-owned, delivered, nonterminal `publicQuestion` in local messages (`:686`–`:699`). If no such question is found, the options remain unbound; posting accepts the ordinary message and processing is skipped (`:725`, `:763`). The current server does not infer the assessment from the parent question. A pre-`ef2d876` client never performs this automatic binding at all.

For the observed production answer, the missing binding is confirmed. Whether a stale client, missing question projection, or bypassed transfer branch caused it remains open; no actual client payload or bundle identity is available.

### Test evidence

Executed from `tutor-system/`:

```sh
rtk proxy env CI=true npm test -- --watch=false --runInBand --runTestsByPath src/contexts/__tests__/RoomContext.transferAnswer.test.tsx --silent
```

Result: **1 suite passed, 30 tests passed**, Jest reported 0.791 seconds. No tests or production code were added or changed.

`RoomContext.transferAnswer.test.tsx:286` covers free-text auto-binding by calling `sendMessage(content)` directly. It preloads a complete delivered question and mocks checklist lookup, posting, and processing. Its other cases cover wrong learner, terminal questions, and explicitly unrelated replies. This proves the local routing logic under those fixtures, not the actual page-to-database interaction or deployed frontend version.

The fixtures use the same UUID for assessment and question message (`src/test-support/transferRoomFixtures.ts:143`), while production uses distinct UUIDs. The posting mock also returns a prebuilt bound answer instead of storing the request through the live backend (`RoomContext.transferAnswer.test.tsx:156`). Argument assertions provide useful local coverage but do not exercise persistence invariants across these boundaries.

The inspected page tests mock the context/composer, and the browser answer workflow submits via option controls rather than the generic Reply textbox. The missing integrated scenario is: deliver a real question with distinct message/assessment IDs, click generic Reply, type `A`, submit, verify persisted assessment ID and authoritative attempt, and verify retry/terminal lifecycle after reload.

Specific coverage references:

- Page tests mock `RoomContext` and replace `CommentInput` with a static element: `tutor-system/src/pages/__tests__/RoomPagePost.transferDecision.test.tsx:32`, `:87`; `RoomPagePost.transferLifecycle.test.tsx:41`, `:100`.
- Browser answers check an option and click Submit answer: `tutor-system/scripts/browser-e2e/workflows/assessment-answer.js:19`; they verify actual attempts and reload behavior at `:38` and `:50`, but only for that input path.
- Raw-text SQL grading explicitly supplies the assessment ID: `tutor-system/supabase/tests/transfer_assessment_qa_edit_review.sql:116`. The inspected backend tests omit the question-parent-plus-null-assessment-ID scenario.
- A saved null-ID reply is deliberately rendered as plain conversation in `tutor-system/src/pages/__tests__/RoomPagePost.transferLifecycle.test.tsx:372`; that test does not exercise posting or grading an option-shaped text reply.
- Other tests do distinguish question IDs and assessment IDs (`RoomPagePost.transferLifecycle.test.tsx:274`, `transferAssessmentUiAdapter.test.ts:162`), so the shared-fixture identity simplification is a local limitation rather than a repository-wide omission.
