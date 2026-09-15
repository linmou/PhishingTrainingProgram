# Tutor response contract

Intent: define the structured decisions, their shared supervisor-facing rationale, learner-facing response, and consumer/validation boundary.

Updated: 2026-09-13
Status: candidate 11's legacy v2 prompt contract remains implemented verbatim and is extended by the one-or-two-message Multi-agent decision for ordinary Multi-agent turns; transfer assessment v3 is a browser-local research flow. Live semantic evaluation and browser acceptance for transfer v3 and for Multi-agent remain pending.
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

## Multi-agent extension (v2)

Intent: define the one-or-two-character decision for ordinary tutoring turns when the learner selects Multi-agent, while keeping the v2 envelope above unchanged.

The learner's Student AI choice is persisted in `prompt_config` and sent as the request's `interaction_mode` (`single_agent` by default; old callers keep the old behavior). The Test Rooms page ships a dedicated `Demo: Multi-agent Response Room` template that sets this value directly, so its rooms exercise Multi-agent behavior without a learner-side selector. Under `multi_agent`, an ordinary tutoring turn returns:

| Field | Value | Boundary |
| --- | --- | --- |
| `decision.mode` | `multiagent` | Presentation decision only. It never enters `rooms.active_response_mode`; approved rows persist with message-level `response_mode=multiagent`. |
| `decision.instruction` | `multiagent` | Required with `mode=multiagent`; invalid in every other mode. |
| `response` | one or two tagged messages | One `[agent:riley] …` or one `[agent:tutor] …`, or one of each in either order. No untagged text may precede the first tag; no body may be empty; a third, duplicate, or unknown tag is invalid. Agent tags are invalid outside `multiagent`. |

Riley is a simulated AI participant who voices one plausible but incorrect recommendation from supplied facts only; the AI Tutor stays accurate and may name the flaw in Riley's reasoning. Guard turns (active or recovering) and transfer-assessment turns never use `multiagent`. `decodeMultiAgentResponse` validates generated drafts; `decodeAgentMessage` recovers character identity only from tutor rows persisted with `response_mode=multiagent`, so a learner or an out-of-mode row containing the same literal tag text keeps its ordinary identity and text.

The mode has its own prompt: `src/services/prompts/multiAgentTutorPrompt.ts` is appended after the active tutor policy only when the request's `interaction_mode` is `multi_agent`, so the evaluated candidate 11 policy is sent byte-identical in every other case. That block owns the one-or-two-tag output contract, the permitted fallbacks, the Riley and AI Tutor role boundaries, and worked decisions.

With the mode enabled an ordinary tutoring turn — including a greeting, small talk, a topic preference, or a bare question — returns `mode=multiagent` and `instruction=multiagent` with one or two tagged messages. Only three single-Tutor answers are permitted instead: `protective_instruction` when the learner is about to act unsafely, `explanation` when the learner asks to be taught or asks to stop the role-play, and `guard` when participation is deliberately disrupted. `scaffolding`, `correction` and `consolidation` are rejected on every attempt; the service repairs once and then fails generation rather than accepting a forbidden retry response. Guard and transfer-assessment turns keep the single-Tutor path unchanged.

Human review shows one or two decoded messages in model order, without speaker selection. Approval requires the draft's parent learner message to still be the latest learner message, then inserts one or two `messages` rows with `user_role=tutor`, a shared `parent_message_id`, and `response_mode=multiagent`. For a two-message response, rows are timestamped at T and T+2s; the later row stays hidden until its timestamp, and submission is blocked during that window.

A multiagent turn uses its own completion budget (`MULTI_AGENT_MAX_TOKENS`) because the envelope can carry a reason plus two tagged messages. A response that stops on the length limit is reported as a truncated decision instead of being parsed as a partial envelope, and the repair retry preserves the one-or-two-message Multi-agent contract or an allowed exception.

Known limitation: a Multi-agent response is stored through the ordinary messages path, so the reviewed-send audit record (`ai_suggestion_feedback`) is not written for it. Multi-agent human-edit provenance would be a separate requirement.

## Transfer assessment v3 contract

Intent: define the structured teacher-review payload used by the T09 transfer-assessment lifecycle while preserving the legacy v2 contract above.

T09 contract boundary: learner evidence may make a concept eligible without strong prior proof, but a transfer assessment is valid only when its scenario changes the meaningful situation. Assessment is a tutor turn, not a room mode; the reviewed send maps its participation state back to tutoring and does not bypass Guard. A spontaneous medium-transfer observation may verify the concept without an assessment.

The v3 model output is reason-first JSON with this shape:

```json
{
  "reason": "The learner applied the rule in a meaningfully changed context.",
  "learning_evidence": [
    {
      "item_id": "checklist-item-id",
      "evidence_message_id": "message-id",
      "signal": "initial",
      "analysis": "The learner applied the configured verification rule."
    }
  ],
  "decision": {
    "mode": "assessment",
    "instruction": "transfer_assess",
    "target_item_id": "checklist-item-id"
  },
  "response": "A teammate sends a prize link from a familiar account. What should you check first?",
  "assessment": {
    "selection_type": "single",
    "options": [
      {"id": "A", "text": "Trust the displayed account"},
      {"id": "B", "text": "Verify through an independent channel"},
      {"id": "C", "text": "Open the link to inspect it"},
      {"id": "D", "text": "Forward it to everyone"}
    ],
    "correct_option_ids": ["B"],
    "transfer_basis": {
      "concept_rule": "Displayed identity is not independent authentication.",
      "source_context": "The original account-alert example.",
      "changed_context": "A prize link from a known teammate account.",
      "source_evidence_message_ids": ["message-id"]
    }
  }
}
```

Allowed v3 combinations under T09 are:

- `tutoring` with one teaching instruction and `assessment: null`;
- `assessment` with `transfer_assess`, one known target item, and a complete four-option payload;
- `guard` with `guard`, a null target, and `assessment: null`; or `guard` with a real teaching instruction and no assessment payload.

The same v3 call performs T02 evidence classification before choosing the tutor turn. `learning_evidence` records every configured concept demonstrated by the focus learner message, using `initial`, `contradiction`, or `spontaneous_transfer`; an empty array means that message supplies no measurable evidence. Assessment requires prior stored evidence or a new `initial` signal for its target. The parser rejects evidence attributed to another learner/message, duplicate item signals, unknown IDs, missing or blank fields, noncanonical option content, invalid key cardinality, overlong rendering, and incompatible mode/instruction/payload combinations. Assessment rendering is bounded to two stem sentences and 80 word-like segments.

For this research build, the browser owns the draft, answer key, snapshot, exact grading, and progress writes through public Supabase tables. The learner-facing React projection omits the answer key and transfer basis; these values remain inspectable by a participant using browser/database tools and are not a security boundary. A learner's valid answer is processed deterministically; an optional explanation cannot overturn an otherwise valid exact selection. Clarification leaves the question open, while assistance cancels it without issuing a failing grade. The first valid answer resolves the question. A resolved question must receive tutoring or independently required Guard feedback before another assessment is eligible, and already verified concepts are not routinely reassessed unless later learner evidence contradicts them.

Answers received before delivery are not graded, do not create feedback, and preserve the existing transfer progress pair. Delivery is a prerequisite for entering the parsing and grading path.

The browser applies the v3 provider budget of 1,200 completion tokens. The legacy prompt remains a separate contract for rooms without an active `transfer_v1` checklist. Enabling transfer requires provider configuration and browser acceptance; participant authentication and answer-key secrecy are outside this research-build contract.
