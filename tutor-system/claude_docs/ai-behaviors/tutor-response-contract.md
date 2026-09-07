# Tutor response contract

Intent: define the structured decisions, their shared supervisor-facing rationale, learner-facing response, and consumer/validation boundary.

Updated: 2026-09-07
Status: designed; production prompt, parser, persistence, UI, and evaluators require migration before acceptance.
Behavior specification: [canonical working specification](tutor-behavior-specification.md); pin its content hash with this contract before execution.
Production source: [aiService.ts](../../src/services/aiService.ts) and [guardModeService.ts](../../src/services/guardModeService.ts); [human review and persistence workflow](../ai-suggestion-tracking.md).

## Response shape

This design applies the [response-contract template](../../../.agents/skills/ai-behavior-design-eval/assets/response-contract.md) following the user's 2026-09-07 decision. It uses `reason`, nested `decision`, and `response`. The deployed format is recorded separately below; updating this document does not establish production support.

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

No top-level `mode` or `mode_reason`: these duplicate the nested decision or shared rationale and are invalid. Other additional fields are tolerated but cannot replace required fields.

## Decision categories

Each field and category records its upstream requirements and derivation logic beside its definition. Selection eligibility and response obligations have separate owners. Shared knowledge, accessibility, length, and explanation requirements still apply where triggered.

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
| null | No instructional move; address participation only. | Valid only in Guard; a participation request is not an instructional correction. | [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction) allows participation correction without teaching, so Guard can omit an instructional move; [C01](tutor-behavior-specification.md#c01-response-contract-and-decision-reasoning) requires that absence to be declared explicitly as null. |

Label the first substantive instructional move: correction followed by scaffolding is `correction`; protection followed by explanation is `protective_instruction`. Brief acknowledgment does not change the label. Connected follow-up teaching is allowed. Guard may include instruction when needed; [G02](tutor-behavior-specification.md#g02-disruption-identification-and-correction) alone does not require it. [T04](tutor-behavior-specification.md#t04-contextual-knowledge-quality) governs any knowledge supplied in either mode.

## Invalid-output handling

Retry invalid output by default. Reject malformed objects, missing/blank/non-string reason or response, missing required decisions, invalid enums, null instruction in tutoring, and duplicate top-level decision/rationale fields. Permit one format-repair retry (two attempts total), then return `success: false`, an empty suggestion, and the error to the requesting consumer; never infer missing fields from response wording. Retain invalid attempts and retry outcomes in run evidence.

This limit and failure destination reuse [the production retry and error path](../../src/services/aiService.ts). HTTP/network failures do not consume a format-repair retry. The revised schema and repair instruction still require implementation; the current parser's tolerance of additional fields does not validate this designed object.

## Evaluation

Decision checks and LLM rubrics must inspect the same preserved output. Preserve the project's distinction between a valid-but-wrong decision, invalid structure, and missing expected-label evidence. T02's semantic learning-target judgment is not replaced by an enum comparison.

Deterministic checks assess declared decisions against reviewed expected labels or allowed sets. LLM rubrics separately assess action realization, response quality, and evidence-grounded justification. Valid structure is not proof of correct behavior; plausible reasoning cannot excuse a wrong decision. Absent expected labels are missing evidence, not a pass. Keep schema validity outside the behavior scorecard unless it is an explicit evaluation objective.

## Deployed object

| Field | Production validation | Consumer |
| --- | --- | --- |
| `mode` | Required string, exactly `tutoring` or `guard`. | Parsed decision and reviewed-mode workflow. Semantic correctness belongs to [G01 in the specification](tutor-behavior-specification.md#g01-participation-state-decision). |
| `mode_reason` | Required non-empty trimmed string. | Existing mode-decision evidence and persisted review metadata. This narrower field is not automatically equivalent to the broader designed `reason` requirement. |
| `suggested_response` | Required non-empty trimmed string. | Tutor suggestion that a human may copy, edit, reject, and send. [T08 in the specification](tutor-behavior-specification.md#t08-suggestion-length) supplies its delivery bounds. |

The parser requires a JSON object, does not require field order, and accepts additional fields. Production requests JSON Object mode and permits one format-repair retry, for two attempts total. HTTP and network errors are not format-repair retries. Reviewed response and final mode are persisted through [guardModeService.ts](../../src/services/guardModeService.ts); the raw AI mode does not automatically control the room.

See [the suggestion workflow](../ai-suggestion-tracking.md) for human review and persistence.

## Deployment and evidence boundary

The designed shape replaces `mode_reason` and the earlier proposed `reasoning` with `reason`, nests `mode` as `decision.mode`, and renames `suggested_response` to `response`. [C01](tutor-behavior-specification.md#c01-response-contract-and-decision-reasoning) owns the field mapping for existing behavioral references. Prompt construction, parsing/repair instructions, persistence, UI consumption, evaluator extraction, and expected labels must use the same contract snapshot before acceptance. This design grants no automatic sending, enforcement, or room-mode authority.

Preserve frozen runs under their original contract snapshots. Contract changes require a new contract/evaluation version and fresh comparable baseline before acceptance; updating this template does not migrate production or reinterpret historical evidence.
