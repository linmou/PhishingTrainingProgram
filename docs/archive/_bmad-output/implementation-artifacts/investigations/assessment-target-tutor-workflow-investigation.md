# Investigation: Assessment, learning targets, and tutor orchestration

Intent: trace the implemented AI teaching loop and assess whether an explicit workflow or agent control fits its responsibilities.

## Hand-off Brief

The user requested a review of assessment, learning-target updates, and AI tutor responses, including whether to organize them as an agent or workflow. The active code uses model evidence interpretation, deterministic progress and assessment rules, and reviewed response delivery. Retain that workflow and repair the tutor's authoritative progress and history handoff before considering a bounded teaching agent.

## Case Info

| Field | Value |
| --- | --- |
| Date opened | 2026-10-13 |
| Status | Concluded |
| System | React/TypeScript application, Supabase functions and RPCs |
| Evidence sources | Current working tree, behavior contracts, focused existing tests; live Supabase inspection when relevant |

## Problem Statement

User request: “review how do ai act , from assessment to learning target updates to ai tutor response , can we build it as an agent ? or as a current workflow”.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| Application implementation | Available | Tutor and assessment call chains assigned to bounded read-only investigations. |
| Behavior contracts | Available | `tutor-system/docs/ai-behaviors/tutor-response-contract.md:119` establishes assessment boundary; specification linkage needs verification against implementation. |
| Project context | Missing | No `project-context.md` found in workspace search. |
| Tests | Available | Assessment, transition, orchestration, and RoomContext regression suites exist. |
| Production RPC definitions | Available | Supabase MCP inspected definitions on `zgbufaxooqxeabewktzd`; no learner data or state mutation. |
| Live workflow observation | Missing | No end-to-end live teaching session has been executed for this review. |

## Investigation Backlog

| # | Path to explore | Priority | Status |
| --- | --- | --- | --- |
| 1 | Active tutor generation and reviewed send | High | Done |
| 2 | Assessment lifecycle, grading and progress authority | High | Done |
| 3 | Target selection and evidence-to-response handoff | High | Done |
| 4 | Architecture recommendation and verification | High | Done |

## Hypothesized Paths

### Hypothesis 1: The existing implementation is a bounded AI workflow

**Status:** Confirmed

**Theory:** Application code owns the sequence and permissions, while models provide structured interpretation and response drafts.

**Would confirm:** Explicit orchestration branches, bounded model calls, deterministic grading/transitions, and reviewed delivery.

**Would refute:** A model-controlled tool loop decides the sequence, writes state, and determines its own stopping condition.

**Resolution:** `RoomContext.tsx:1060` and `:1062` explicitly invoke analysis and preparation; `:1096` chooses ordinary response generation when no assessment candidate is returned. `aiService.ts:681` bounds format repair to two completion attempts. The host chooses service operations; the model does not run a tool-selection loop.

## Confirmed Findings

### Finding 1: Transfer analysis and assessment preparation are separate operations

`tutor-system/src/contexts/RoomContext.tsx:720` analyzes ordinary persisted learner contributions through `transferAssessmentService.analyzeMessage`. The generation path repeats analysis idempotently at line 1060 and calls preparation at line 1062. `tutor-system/supabase/functions/assessment-api/index.ts:288` begins per-target analysis, persists validated events through `apply_transfer_message_analysis_v1`, and invokes analysis before preparation at line 409. The model interprets evidence; application/server code controls execution.

### Finding 2: Ordinary tutor generation does not load the transfer checklist

`tutor-system/src/services/aiService.ts:870` injects current learning progress obtained from `ChecklistService.getChecklistByRoom`; `tutor-system/src/services/checklistService.ts:259` filters `legacy_v1`. The transfer checklist used during assessment preparation is not passed to the ordinary fallback tutor call. `RoomContext.tsx:1032` separately builds verified assessment feedback for learner messages carrying an assessment identity, and `aiService.ts:883` appends that context. That resolution-specific handoff does not supply the full current transfer progress for ordinary turns.

**Implication (deduced):** The tutor can receive absent or outdated progress and select an already satisfied target or miss a reopened target. This is a confirmed data-source mismatch; its effect on model behavior has not been measured in this review.

### Finding 3: Recent-history retrieval actually selects the earliest 15 messages

`tutor-system/src/services/simplifiedAIContext.ts:39` orders messages ascending by creation time and line 40 applies `limit(15)`. The focused learner message is supplied separately, but recent intervening dialogue is excluded once the room exceeds that window. `tutor-system/src/services/prompts/activeTutorAgentPrompt.ts:30` relies on prior demonstrations and later contradictions when choosing teaching targets.

**Implication (deduced):** Recent teaching, repair, or conflicting learner evidence can be missing from the tutor's context.

### Finding 4: Ordinary target selection is implicit in response prose

`tutor-system/src/services/prompts/activeTutorAgentPrompt.ts:30` instructs the tutor to choose one unmet approved target. The ordinary response contract returns `reason`, `decision.mode`, `decision.instruction`, and `response`, with no explicit selected target ID. In contrast, the assessment path prepares a specific checklist item. Target selection is therefore not uniformly inspectable across ordinary tutoring and assessment.

### Finding 5: Human review governs response publication, not every evidence update

`tutor-system/src/contexts/RoomContext.tsx:892` stores an ordinary suggestion as a draft. The human can edit its text and mode at lines 1717 and 1722; sending invokes `sendReviewedTutorResponse` at line 777. Assessment delivery uses `confirmTransferDraft` at line 1663 and reviewed send at line 1687. Learner evidence analysis runs independently when an ordinary learner message is stored at line 720.

### Finding 6: Legacy validation returns an object that its caller treats as a boolean

`tutor-system/src/services/coverageDetectionService.ts:317` returns an object, including a truthy object with `requires_tutor_review` for low-confidence evidence at line 324 and short text at line 334. `tutor-system/src/services/checklistService.ts:467` uses `!validateDetectionResults(...)`; lines 476 and 483 then convert and apply the original results. The review flag does not gate those updates. This finding concerns the legacy progress path; it does not describe the transfer server's validated event writes.

### Finding 7: Live assessment eligibility and grading are deterministic

Read-only Supabase MCP inspection on production `zgbufaxooqxeabewktzd` retrieved definitions of `get_transfer_message_analysis_context_v1`, `apply_transfer_message_analysis_v1`, `apply_learning_event_v1`, `prepare_transfer_assessment_context_v1`, `send_reviewed_transfer_assessment_v1`, `get_transfer_assessment_processing_context_v1`, `process_assessment_message_v2`, and `get_transfer_assessment_review_v1` through `pg_proc` and `pg_get_functiondef`.

`public.prepare_transfer_assessment_context_v1` chooses a `partially_covered/basic` target supported by current-message `initial_signal` or `post_repair_signal`, ordering critical, important, optional priority and then UUID. Guard, open questions, outstanding terminal feedback, protection, and correction block a new assessment. Local Edge code consumes the selected target at `assessment-api/index.ts:418` and generates content for that target at line 425.

`public.process_assessment_message_v2` independently verifies selected option IDs against the private key and the accepted attempt count. Correct selection passes on either of two attempts. First wrong selection permits retry without progress change; second wrong selection fails and sets review/basic. Ambiguous input does not consume an attempt; help-seeking without a selection cancels the question. It locks relevant rows, checks expected lifecycle/attempt state, and deduplicates answer identities. `get_transfer_assessment_review_v1` tracks required terminal feedback by a sent tutoring message replying to the terminal learner answer; another assessment waits for that delivery. This inspection verifies definitions, not a fresh live teaching session or deployed Edge source equality.

### Finding 8: Progress rules exist in TypeScript and SQL with different allowed transitions

`tutor-system/src/services/learningProgressTransitions.ts:56` restricts `initial_signal` to pending, `post_repair_signal` to needs_review, direct understanding to pending/partial, and assessment pass/fail to partial. Production `public.apply_learning_event_v1` uses broader sets: initial/post-repair from pending or review, and understanding/transfer/pass from any non-covered state. Edge analysis filters through the TypeScript rules before persistence, and assessment processing checks its expected result, so this difference does not establish an observed incorrect live update. It does make two non-identical rule definitions part of the boundary and warrants contract alignment and database-level integration verification.

### Finding 9: Architecture documentation is stale

`tutor-system/docs/ai-behaviors/tutor-behavior-specification.md:141` describes one browser-side v3 classification call and browser progress processing. The active transfer code instead performs separate server-side per-target analysis and RPC mutation, and the live assessment lifecycle permits two attempts. Read current implementation and inspected RPC definitions when reasoning about behavior; revise architecture linkage and attempt descriptions when implementing the next change.

## Learning Progress Interpretation

These events update progress for existing approved targets. They do not imply adding a new curriculum item or establishing permanent mastery.

| Accepted evidence/outcome | Typical resulting progress |
| --- | --- |
| Initial incomplete evidence on a pending target | `partially_covered/basic` |
| Sufficient direct understanding or spontaneous transfer | `covered/good` |
| Contradiction of partial/covered understanding | `needs_review/basic` |
| Corrected evidence from review | `partially_covered/basic` |
| Assessment pass | `covered/good` |
| First wrong assessment choice | Unchanged; one retry remains |
| Second wrong assessment choice | `needs_review/basic` |

An ordinary learner contribution can update evidence for multiple approved targets. Assessment scheduling chooses one eligible target. Ordinary tutor selection is implicit, while assessment selection is explicit.

## Source Code Trace

```text
Approved room targets + learner-scoped progress
  -> learner sends message
     -> ordinary contribution: server model analysis -> validated evidence events -> progress
     -> delivered assessment answer: server resolution -> trusted result -> progress
  -> tutor requests response
     -> ordinary contribution: analyze idempotently -> prepare eligible assessment
     -> assessment answer: read trusted review -> skip new assessment preparation
  -> eligible candidate: assessment draft -> teacher reviews -> server delivers
  -> no candidate: ordinary tutor completion -> teacher reviews -> server delivers
  -> next learner contribution
```

Important asymmetry: assessment preparation receives the active transfer checklist; the ordinary tutor completion separately loads the legacy checklist.

## Side Findings

- `aiService.ts:658` always selects `single_agent`; the historical multi-agent configuration represented simulated character messages from a completion, not independent tool-using agents.
- Ordinary tutor audit IDs are queried separately in ascending order with `limit(5)` at `aiService.ts:1010`, rather than identifying the complete supplied context.
- Legacy item, evidence, and history writes are separate at `checklistService.ts:526`, `:544`, and `:566`. Evidence insertion failure can leave progress committed; historical before-values are hard-coded. This is distinct from transfer RPC mutation behavior.

## Deduced Conclusions

The learning loop needs consistent state and explicit decision ownership. A change to an agent would retain the same need for correct context, target evidence, deterministic resolution, and human publication gates. The first two findings directly threaten that context and should be addressed before expanding autonomy.

## Architecture Recommendation

Retain an explicit server-owned workflow with a shared learner-state snapshot. The state should identify learner, focus message, approved target inventory, current progress, learner evidence, open assessment, required feedback, and participation state. Each generated response should receive the same authoritative snapshot and an explicit selected target or consolidation decision. Keep the model responsible for evidence interpretation and pedagogical response composition; keep grading, progress transitions, assessment eligibility, and reviewed publication in application code.

A bounded tutor agent becomes useful if future teaching requires variable retrieval or simulation steps before composing a response. It can operate within the response-generation step and propose actions through narrow tools. Promotion to that design should follow measured benefit on fixed learner cases, with comparable response quality, target correctness, latency, and model-call cost.

The workflow/agent distinction follows the control boundary described in [Anthropic's engineering guidance](https://www.anthropic.com/engineering/building-effective-agents): predefined application paths versus model-directed process and tool use. The recommendation here is derived from this application's fixed sequencing requirements and observed state handoff gaps.

## Verification Record

Working-tree base commit: `6c5e7c0b7f5086746d0452bf685b9ed2d068048d`. Review date: 2026-10-13. Existing user edits in `tutor-system/docs` and evaluation artifacts were present before this review.

Command executed from `tutor-system/`:

```sh
rtk npm test -- --watchAll=false --runInBand --runTestsByPath src/contexts/__tests__/RoomContext.transferAnswer.test.tsx src/contexts/__tests__/RoomContext.transferModes.test.tsx src/contexts/__tests__/RoomContext.checklistCoverage.test.tsx src/services/__tests__/transferAssessmentOrchestrator.test.ts src/services/__tests__/learningProgressTransitions.test.ts src/services/__tests__/transferAssessmentService.test.ts
```

Result: exit 0; 6 suites passed; 97 tests passed; Jest reported 1.557 seconds. Existing React `act` warnings and mocked feedback-table warnings were emitted. These suites cover room-context integration and service/state contracts using mocks; they do not establish live model conformance or correctness of the ordinary tutor's transfer-state injection.

A second focused command included the BDD integration suite:

```sh
rtk npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/transferAssessmentOrchestrator.test.ts src/services/__tests__/learningProgressTransitions.test.ts src/__tests__/transfer_assessment.bdd.test.tsx
```

Result: 3 suites passed; 60 tests passed; 0 snapshots; 0.878 seconds. Two suites overlap the first command, so these counts are not additive. The BDD suite exercises preparation, reviewed delivery, retries, duplicate/reload behavior, feedback, and safety deferral through RoomProvider with mocked boundaries. React and feedback-table mock warnings also appeared.

## Missing Evidence

| Gap | Impact | How to obtain |
| --- | --- | --- |
| Integrated case asserting the exact authoritative progress and recent history supplied to the tutor | Current passing tests do not close the identified context gaps | Exercise ordinary tutoring and assessment feedback using the same learner-scoped transfer state, including a later contradiction |
| Live model behavior on these handoff cases | Cannot quantify target repetition or missed correction from static trace | Preserve request/response pairs and state versions in a controlled staging evaluation |
| Comparative agent experiment | No measured case for changing control architecture | Compare a bounded agent with the corrected explicit workflow on the same cases |

## Conclusion

**Confidence:** High for the local control-flow classification and checklist mismatch; model-quality implications are deduced.

The application already implements a bounded AI workflow. Fixing authoritative state and context handoff should precede introducing model control over the sequence.

## Recommended Next Steps

1. Supply the ordinary tutor with the current learner's transfer checklist and recent conversation from one authoritative turn context. Include an explicit target ID in its reviewable decision.
2. Align TypeScript and database progress transition rules and verify them at the RPC boundary.
3. Centralize turn orchestration around that context, preserving reviewed publication, deterministic attempts/grading, and required feedback.
4. Evaluate a bounded tutor agent only if variable tool use provides a concrete teaching benefit; compare it with the corrected workflow on the same cases.

## Verification Plan

Use a staging learner with approved targets. Demonstrate one target, contradict it after more than 15 messages, and inspect the exact tutor request for current progress, recent evidence, and explicit target choice. Exercise an eligible assessment, first wrong retry, terminal pass/fail, delivered feedback, and a different repaired context. Preserve request/response pairs, target/event IDs, state versions, and timing so model quality and state correctness can be evaluated separately.
