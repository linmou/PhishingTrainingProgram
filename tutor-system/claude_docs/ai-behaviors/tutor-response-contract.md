# Tutor response contract

Intent: define the structured decisions, their shared supervisor-facing rationale, learner-facing response, and consumer/validation boundary.

Updated: 2026-09-08
Status: implemented in the working tree after human selection of candidate 11; commit/release pending. `decision.instruction` is validated but not yet separately displayed or persisted.
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
| 1. `decision.mode` | Participation decision for human review; does not automatically change room state. | Required string: `tutoring` or `guard`; non-null. | Observable engagement and known prior participation state. | [G01](tutor-behavior-specification.md#g01-participation-state-decision) defines participation eligibility and recovery, so resolve mode first to establish which participation obligations apply. |
| 2. `decision.instruction` | First substantive instructional move, excluding a brief acknowledgment; used to review the proposed response. | Required string: `protective_instruction`, `correction`, `scaffolding`, `explanation`, `consolidation`, or explicit null. | Resolve mode first: null is allowed only with `guard`; either mode may include instruction. Use risk and learning evidence to choose the action. | [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction) permits participation-only intervention in Guard; [T01](tutor-behavior-specification.md#t01-correction-and-protective-instruction-eligibility)/[T02](tutor-behavior-specification.md#t02-learning-state-and-target-selection) govern instructional action and learning targets. Thus mode constrains whether instruction may be absent, while instructional evidence determines its category. |

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
| null | No instructional move; address participation only. | Valid only in Guard; a participation request is not an instructional correction. | [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction) allows participation correction without teaching, so Guard can omit an instructional move; this contract uses explicit null so a deliberate absence can be distinguished from a missing required decision. |

Label the first substantive instructional move: correction followed by scaffolding is `correction`; protection followed by explanation is `protective_instruction`. Brief acknowledgment does not change the label. Connected follow-up teaching is allowed. Guard may include instruction when needed; [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction) alone does not require it. [T04](tutor-behavior-specification.md#t04-contextual-knowledge-quality) governs any knowledge supplied in either mode.

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
| `decision.instruction` | None | Validated at the model boundary and evaluated in saved runs, but not separately displayed or persisted. That consumer migration remains pending. |

The prompt and parser migration is implemented in the working tree. Persistence and UI continue through the explicit mapping above; evaluator v2 extraction is implemented in the candidate 11 harness. The parser requires `reason` serialized first, rejects legacy decision/rationale fields, and permits one format-repair retry. This contract grants no automatic sending, enforcement, or room-mode authority. See [the suggestion workflow](../ai-suggestion-tracking.md) for human review and persistence.

Preserve frozen runs under their original contract snapshots. Contract changes require a new contract/evaluation version and fresh comparable baseline before acceptance; updating this template does not migrate production or reinterpret historical evidence.
