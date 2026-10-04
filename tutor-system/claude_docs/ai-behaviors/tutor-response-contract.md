# Tutor response contract

Intent: define the structured decisions, their shared supervisor-facing rationale, learner-facing response, and consumer/validation boundary.

Updated: 2026-09-27
Implementation commit ID: `898d685` (integrated components 101-103)
Status: candidate 11's legacy v2 prompt contract remains implemented. Multi-agent generation is deprecated: production requests normalize stored settings to `single_agent`, and the dedicated Test Rooms template is hidden. The legacy decision grammar and stored-message decoder remain for historical rows. Transfer assessment v3 has persisted server-authoritative attempts, role-safe projections, and an integrated room UI; hosted authorization, live evaluation, and browser acceptance remain pending.
Behavior specification: [canonical working specification](tutor-behavior-specification.md), SHA-256 `06f928db0f746797285dad058fd46395da36e8de83763ca0aa106d22c07a5a9e` (the candidate 11 run snapshot pins the same content).
Production source: [activeTutorAgentPrompt.ts](../../src/services/prompts/activeTutorAgentPrompt.ts), [ecologicalTutorCall.ts](../../src/services/ecologicalTutorCall.ts), [tutorDecisionContract.ts](../../src/services/tutorDecisionContract.ts), [aiService.ts](../../src/services/aiService.ts), and [guardModeService.ts](../../src/services/guardModeService.ts); [human review and persistence workflow](../ai-suggestion-tracking.md).

## Response shape

This instantiates the default [response-contract template](../../../.agents/skills/ai-behavior-design-eval/assets/response-contract.md) following the user's 2026-09-07 contract decision. It retains the template's tutor categories. Candidate 11 was selected for production integration by human review on 2026-09-08; implementation and unmigrated consumers are recorded below.

`reason` and `response` are default non-empty strings and need no separate definitions. Serialize `reason` first; cite observable evidence, not hidden chain-of-thought. Include `decision` only when explicit decisions are needed.

```json
{
  "reason": "The learner is about to open the suspect link, so protection comes first. No deliberate obstruction is evident. The response stops the action and offers an independent verification route.",
  "decision": {
    "mode": "tutoring",
    "instruction": "protective_instruction"
  },
  "response": "Do not open that link. Open the real app yourself to check the alert."
}
```

## Decision fields and order

Resolve fields in the order below, then compose the response. This is the decision dependency order; JSON key order alone does not establish it. When decisions are present, `decision` is a non-null object containing the declared fields.

| Order / field | Definition and consumer | Type / allowed values / nullability | Upstream dependency | Grounding |
| --- | --- | --- | --- | --- |
| 1. `decision.mode` | Participation decision for human review; `multiagent` is a presentation decision and does not change room state. | Required string: `tutoring`, `guard`, or `multiagent` when the request enables Multi-agent; non-null. | Observable engagement and known prior participation state; Multi-agent eligibility for the presentation decision. | [G01](tutor-behavior-specification.md#g01-participation-state-decision) defines participation eligibility and recovery, so resolve mode first to establish which participation obligations apply. The Multi-agent extension below defines the additional presentation decision. |
| 2. `decision.instruction` | First substantive instructional move, excluding a brief acknowledgment, or the `multiagent` presentation instruction; used to review the proposed response. | Required string: `protective_instruction`, `correction`, `scaffolding`, `explanation`, `consolidation`, `multiagent`, or explicit null. `multiagent` is required only with `mode=multiagent`; null is allowed only with `guard`. | Resolve mode first: `mode=multiagent` requires `instruction=multiagent`; otherwise use risk and learning evidence to choose the instructional action. | [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction) permits participation-only intervention in Guard; [T01](tutor-behavior-specification.md#t01-correction-and-protective-instruction-eligibility)/[T02](tutor-behavior-specification.md#t02-learning-state-and-target-selection) govern instructional action and learning targets. The Multi-agent extension defines the presentation value. |

For additional decision fields, record their position, definition, consumer, type, categories, upstream dependencies, and exact requirement references with derivation logic in the same row. Independent fields need no invented dependency.

No top-level `mode` or `mode_reason`: these duplicate the nested decision or shared rationale and are invalid. Other additional fields are tolerated but cannot replace required fields.

## Decision categories

Every field and category owns its grounding through the linked canonical requirements and the derivation written beside it. Unsupported interpretations remain pending. Selection eligibility and response obligations have separate owners. Shared knowledge, accessibility, length, and explanation requirements still apply where triggered.

### Participation mode

| Value | Participation meaning | Boundary | Grounding: governing specs and derivation |
| --- | --- | --- | --- |
| `tutoring` | Genuine engagement, including mistakes, confusion, engaged frustration, or substantive re-engagement from Guard. | Incorrect answers and imminent unsafe action alone do not establish deliberate obstruction. | [G01](tutor-behavior-specification.md#g01-participation-state-decision) bases eligibility and recovery on engagement, so mistakes alone do not exclude tutoring and substantive re-engagement permits return. |
| `guard` | Clear deliberate obstruction or knowing unsafe continuation after correction; persist when known Guard has not met its recovery condition. | Do not invent intent or prior state. Instructional content is optional, not what defines the mode. | [G01](tutor-behavior-specification.md#g01-participation-state-decision) supplies entry, persistence, and recovery conditions, so mode follows participation evidence. [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction)/[G03](tutor-behavior-specification.md#g03-serious-and-firm-guard-tone) govern the resulting participation intervention and dignified delivery, rather than adding teaching as an entry condition. |

### Instructional action

| Value | Observable response action | Boundary | Grounding: governing specs and derivation |
| --- | --- | --- | --- |
| `protective_instruction` | Stop or redirect imminent unsafe action before exploration. | Genuine engagement may require protection while remaining in tutoring. | [T01](tutor-behavior-specification.md#t01-correction-and-protective-instruction-eligibility) prioritizes imminent-risk protection, so stopping or redirecting the unsafe action is the first instructional move. [G01](tutor-behavior-specification.md#g01-participation-state-decision) keeps participation eligibility separate from risk alone. |
| `correction` | Explicitly correct a false inference or misconception. | Not correction of disruptive participation. | [T01](tutor-behavior-specification.md#t01-correction-and-protective-instruction-eligibility) requires misconception correction, so this category applies when the first instructional move repairs a false inference. |
| `scaffolding` | Give a focused hint or question leaving a reasoning step to the learner. | Useful question-only scaffolds are allowed; no question quota. | [T01](tutor-behavior-specification.md#t01-correction-and-protective-instruction-eligibility) permits scaffolding and [T02](tutor-behavior-specification.md#t02-learning-state-and-target-selection) requires an evidence-based target, so the hint or question must leave a useful reasoning step on that target. |
| `explanation` | Explain or elaborate knowledge without first correcting a false inference. | A correct partial answer may need elaboration rather than correction. | [T01](tutor-behavior-specification.md#t01-correction-and-protective-instruction-eligibility) permits explanation and [T02](tutor-behavior-specification.md#t02-learning-state-and-target-selection) grounds the target in learner evidence, so missing knowledge can call for elaboration without implying a misconception. |
| `consolidation` | Reinforce demonstrated understanding without opening a new target. | Appropriate when no useful unmet target remains. | [T02](tutor-behavior-specification.md#t02-learning-state-and-target-selection) ties teaching to evidenced learning needs, so demonstrated understanding without a useful unmet target supports consolidation. |
| `multiagent` | Present one tagged Riley or AI Tutor message, or a contrast containing one of each, for an ordinary Multi-agent tutoring turn. | Valid only with `mode=multiagent`; it is a presentation instruction, not an instructional action category. | The Multi-agent extension below defines the one-or-two-message response and its safety, explanation, and Guard exceptions. |
| null | No instructional move; address participation only. | Valid only in Guard; a participation request is not an instructional correction. | [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction) allows participation correction without teaching, so Guard can omit an instructional move; this contract uses explicit null so a deliberate absence can be distinguished from a missing required decision. |

Except for `multiagent`, label the first substantive instructional move: correction followed by scaffolding is `correction`; protection followed by explanation is `protective_instruction`. Brief acknowledgment does not change the label. Connected follow-up teaching is allowed. Guard may include instruction when needed; [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction) alone does not require it. [T04](tutor-behavior-specification.md#t04-contextual-knowledge-quality) governs any knowledge supplied in either mode.

## Invalid-output handling

Retry invalid output by default. Reject malformed objects, missing/blank/non-string reason or response, missing required decisions, invalid enums, null instruction in tutoring, and duplicate top-level decision/rationale fields. Permit one format-repair retry (two attempts total), then return `success: false`, an empty suggestion, and the error to the requesting consumer; never infer missing fields from response wording. Retain invalid attempts and retry outcomes in run evidence.

This limit and failure destination reuse [the production retry and error path](../../src/services/aiService.ts). HTTP/network failures do not consume a format-repair retry. The production parser validates the v2 fields and serialized first key before adapting the decision to the existing reviewed-response workflow.

## Evaluation

Response structure and general model justification are contract responsibilities, not a named domain-behavior requirement. [P4](constitution.md#principles-and-ownership) and [H4](constitution.md#non-negotiable-constraints) still require inspectable, truthful supervision evidence; they do not create a separate domain-ability score. Schema validity remains a supporting check.

Decision checks and LLM rubrics must inspect the same preserved output. Preserve the project's distinction between a valid-but-wrong decision, invalid structure, and missing expected-label evidence. T02's semantic learning-target judgment is not replaced by an enum comparison.

Deterministic checks assess declared decisions against reviewed expected labels or allowed sets. LLM rubrics separately assess action realization, response quality, and evidence-grounded justification. Valid structure is not proof of correct behavior; plausible reasoning cannot excuse a wrong decision. Absent expected labels are missing evidence, not a pass. Keep schema validity outside the behavior scorecard unless it is an explicit evaluation objective.

## Deployment and evidence boundary

The implemented model boundary uses the designed v2 shape. The reviewed-response adapter keeps existing product/database field names stable:

| Raw v2 field | Reviewed-decision field | Migration status and consumer |
| --- | --- | --- |
| `decision.mode` | `mode` | Implemented in the parser and reviewed-mode workflow. The human tutor may override it; model output does not automatically change room state. |
| `reason` | `mode_reason` | Implemented for existing supervisor evidence and persistence. The shared rationale is retained under the historical database name. |
| `response` | `suggested_response` | Implemented for the suggestion that a human may copy, edit, reject, and send. |
| `decision.instruction` | `raw_instruction` | Preserved by the parser, recorded for accepted, modified, rejected, and ignored suggestions, passed to the reviewed-send RPC, and included in tutor-only JSON/TXT exports. It is not shown to learners. |

Migration `024_raw_instruction.sql` adds the nullable, constrained audit column and replaces the old reviewed-send RPC signature. Existing rows stay null; no historical decision is reconstructed. The parser requires `reason` serialized first, rejects legacy decision/rationale fields, and permits one format-repair retry. This contract grants no automatic sending, enforcement, or room-mode authority. See [the suggestion workflow](../ai-suggestion-tracking.md) for human review and persistence.

Preserve frozen runs under their original contract snapshots. Contract changes require a new contract/evaluation version and fresh comparable baseline before acceptance; updating this template does not migrate production or reinterpret historical evidence.

## Multi-agent extension (deprecated legacy v2)

Intent: document the historical one-or-two-character decision contract while keeping the v2 envelope above unchanged.

Older configurations may contain `interaction_mode=multi_agent`, and historical test rooms used a dedicated `Demo: Multi-agent Response Room` template. The current request builder ignores this value, sends `interaction_mode=single_agent`, and does not append the Multi-agent prompt. The following fields and grammar describe stored legacy behavior, not new production output:

| Field | Value | Boundary |
| --- | --- | --- |
| `decision.mode` | `multiagent` | Presentation decision only. It never enters `rooms.active_response_mode`; approved rows persist with message-level `response_mode=multiagent`. |
| `decision.instruction` | `multiagent` | Required with `mode=multiagent`; invalid in every other mode. |
| `response` | one or two tagged messages | One `[agent:riley] …` or one `[agent:tutor] …`, or one of each in either order. No untagged text may precede the first tag; no body may be empty; a third, duplicate, or unknown tag is invalid. Agent tags are invalid outside `multiagent`. |

Riley was a simulated AI participant who voiced one plausible but incorrect recommendation from supplied facts only; the AI Tutor stayed accurate and could name the flaw in Riley's reasoning. `decodeMultiAgentResponse` remains deprecated compatibility code; `decodeAgentMessage` recovers character identity only from tutor rows persisted with `response_mode=multiagent`, so a learner or an out-of-mode row containing the same literal tag text keeps its ordinary identity and text.

The legacy mode prompt remains in `src/services/prompts/multiAgentTutorPrompt.ts` for reference but is no longer appended to production requests.

Historically, ordinary tutoring turns returned `mode=multiagent` and `instruction=multiagent` with one or two tagged messages, subject to the grammar above. Production now always uses the standard single-agent decision and repair path, including for rooms with a saved multi-agent setting.

The deprecated review code persisted approved rows with `user_role=tutor`, a shared `parent_message_id`, and `response_mode=multiagent`. Historical tagged rows remain readable through the message presentation resolver.

The former multi-agent path used a separate completion budget and repair instruction; production now uses the standard single-response token limit and repair instruction.

Historical Multi-agent responses were stored through the ordinary messages path, so the reviewed-send audit record (`ai_suggestion_feedback`) was not written for them. Multi-agent human-edit provenance remains unavailable for those records.

## Transfer assessment contract

Intent: define the assessment-only teacher-review payload used by T09 while preserving historical shared-tutor decoding.

T09 contract boundary: learner evidence may make a concept eligible without strong prior proof, but a transfer assessment is valid only when its scenario changes the meaningful situation. Once a current room-approved target is fully eligible, TransferLearning prepares an assessment for the next AI-generated response and skips the shared tutor. Reviewed delivery stores `response_mode: assessment` without creating a room mode or bypassing Guard. The separate [status response contract](transfer-status-response-contract.md) permits sufficient direct understanding or spontaneous transfer to cover an item without an assessment.

The assessment generator returns this private draft:

```json
{
  "reason": "The learner applied the rule in a meaningfully changed context.",
  "target_item_id": "checklist-item-id",
  "assessment": {
    "selection_type": "single",
    "stem": "A teammate sends a prize link from a familiar account. What should you check first?",
    "rendered_text": "A teammate sends a prize link from a familiar account. What should you check first?\nChoose one.\nA. Trust the displayed account\nB. Verify through an independent channel\nC. Open the link to inspect it\nD. Forward it to everyone",
    "options": [
      {"id": "A", "text": "Trust the displayed account"},
      {"id": "B", "text": "Verify through an independent channel"},
      {"id": "C", "text": "Open the link to inspect it"},
      {"id": "D", "text": "Forward it to everyone"}
    ],
    "correct_option_ids": ["B"],
    "learner_safe_explanation": "A familiar displayed identity does not verify who controls the account.",
    "transfer_basis": {
      "concept_rule": "Displayed identity is not independent authentication.",
      "source_context": "The original account-alert example.",
      "changed_context": "A prize link from a known teammate account.",
      "source_evidence_message_ids": ["message-id"]
    }
  }
}
```

The separate message-analysis operation classifies each persisted learner contribution against that room's approved targets, recording supported initial, direct-understanding, contradiction, spontaneous-transfer, and post-repair evidence through server-owned learning events. The assessment generator cannot choose tutoring or Guard. Its validator rejects unknown targets or evidence IDs, missing or blank fields, invalid options or keys, and invalid rendering. The shared tutor retains its tutoring/Guard contract and runs when no assessment is due.

Component 101 keeps the resolver pure: component 102 supplies and persists the server-owned `TransferAttemptSnapshot`, then projects the returned state by role. The learner-facing assessment shape omits the answer key, learner-safe explanation, and transfer basis. A valid selection is processed deterministically; an optional explanation cannot overturn an exact selection. Clarification leaves the question open, while assistance cancels it without issuing a failing grade.

The attempt snapshot accepts at most two valid selections. A first incorrect selection returns `retryable` with unchanged progress, one remaining attempt, no transition, and no terminal feedback. A correct first or second selection returns terminal `passed`, applies `assessment_pass` once, requires tutor feedback, and sets `learner_feedback_authorized: false`. A second incorrect selection returns terminal `failed`, applies `assessment_fail` once, requires repair, and includes private terminal feedback with `learner_feedback_authorized: true`. Only that failed result authorizes component 102 to project the correct option IDs and learner-safe explanation to the learner. Duplicate, terminal, stale, undelivered, ambiguous, assisted, malformed, and Guard-deferred inputs do not consume an attempt. The current-version owner release decision is recorded in `specs/orchestration/transfer-assessment/release-decision-2026-09-30.md`; this contract does not control the feature flag.

Answers received before delivery are not graded, do not create feedback, and preserve the existing transfer progress pair. Delivery is a prerequisite for entering the parsing and grading path.

The trusted `assessment-api` Edge Function applies the v3 provider budget of 1,200 completion tokens and reads `OAI_API_KEY`, `OAI_BASE_URL`, and exact `OAI_MODEL=qwen3.5-flash` from its Supabase Edge Function secrets. It records credential-free provider evidence and permits one format-only repair. The production transfer prompt is absent from the browser bundle. Enabling transfer still requires hosted, provider, downstream UI, and integration acceptance.
