# <Product> response contract

Intent: define the structured decisions, their shared supervisor-facing rationale, learner-facing response, and consumer/validation boundary.

Updated: <date>
Status: <designed / implemented; identify unmigrated consumers>
Behavior specification: <canonical specification path and version/hash>
Production source: <request, parser, persistence, and UI paths>

## Response shape

This is the default designed contract, not evidence of production support. Retain the tutor categories below unless a separate behavior-design decision changes them. For another product, ground replacement categories in that product's specs before adoption.

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
| 1. `decision.mode` | Participation decision for human review; does not automatically change room state. | Required string: `tutoring` or `guard`; non-null. | Observable engagement and known prior participation state. | G01 defines participation eligibility and recovery, so resolve mode first to establish which participation obligations apply. |
| 2. `decision.instruction` | First substantive instructional move, excluding a brief acknowledgment; used to review the proposed response. | Required string: `protective_instruction`, `correction`, `scaffolding`, `explanation`, `consolidation`, or explicit null. | Resolve mode first: null is allowed only with `guard`; either mode may include instruction. Use risk and learning evidence to choose the action. | G02 permits participation-only intervention in Guard; T01/T02 govern instructional action and learning targets. Thus mode constrains whether instruction may be absent, while instructional evidence determines its category. |

For additional decision fields, record their position, definition, consumer, type, categories, upstream dependencies, and exact requirement references with derivation logic in the same row. Independent fields need no invented dependency.

No top-level `mode` or `mode_reason`: these duplicate the nested decision or shared rationale and are invalid. Other additional fields are tolerated but cannot replace required fields.

## Decision categories

Replace tutor spec IDs with links to the pinned canonical requirements when instantiating this template, verifying each interpretation. Every field and category owns its grounding: cite the upstream definition and explain why it yields this definition, boundary, or action. Mark unsupported interpretations pending. Distinguish selection eligibility from response obligations. Shared content, accessibility, length, and explanation requirements still apply where triggered.

### Participation mode

| Value | Participation meaning | Boundary | Grounding: governing specs and derivation |
| --- | --- | --- | --- |
| `tutoring` | Genuine engagement, including mistakes, confusion, engaged frustration, or substantive re-engagement from Guard. | Incorrect answers and imminent unsafe action alone do not establish deliberate obstruction. | G01 bases eligibility and recovery on engagement, so mistakes alone do not exclude tutoring and substantive re-engagement permits return. |
| `guard` | Clear deliberate obstruction or knowing unsafe continuation after correction; persist when known Guard has not met its recovery condition. | Do not invent intent or prior state. Instructional content is optional, not what defines the mode. | G01 supplies entry, persistence, and recovery conditions, so mode follows participation evidence. G02/G03 govern the resulting participation intervention and dignified delivery, rather than adding teaching as an entry condition. |

### Instructional action

| Value | Observable response action | Boundary | Grounding: governing specs and derivation |
| --- | --- | --- | --- |
| `protective_instruction` | Stop or redirect imminent unsafe action before exploration. | Genuine engagement may require protection while remaining in tutoring. | T01 prioritizes imminent-risk protection, so stopping or redirecting the unsafe action is the first instructional move. G01 keeps participation eligibility separate from risk alone. |
| `correction` | Explicitly correct a false inference or misconception. | Not correction of disruptive participation. | T01 requires misconception correction, so this category applies when the first instructional move repairs a false inference. |
| `scaffolding` | Give a focused hint or question leaving a reasoning step to the learner. | Useful question-only scaffolds are allowed; no question quota. | T01 permits scaffolding and T02 requires an evidence-based target, so the hint or question must leave a useful reasoning step on that target. |
| `explanation` | Explain or elaborate knowledge without first correcting a false inference. | A correct partial answer may need elaboration rather than correction. | T01 permits explanation and T02 grounds the target in learner evidence, so missing knowledge can call for elaboration without implying a misconception. |
| `consolidation` | Reinforce demonstrated understanding without opening a new target. | Appropriate when no useful unmet target remains. | T02 ties teaching to evidenced learning needs, so demonstrated understanding without a useful unmet target supports consolidation. |
| null | No instructional move; address participation only. | Valid only in Guard; a participation request is not an instructional correction. | G02 allows participation correction without teaching, so Guard can omit an instructional move; C01 requires that absence to be declared explicitly as null. |

Label the first substantive instructional move: correction followed by scaffolding is `correction`; protection followed by explanation is `protective_instruction`. Brief acknowledgment does not change the label. Connected follow-up teaching is allowed. Guard may include instruction when needed; G02 alone does not require it. T04 governs any knowledge supplied in either mode.

## Invalid-output handling

Retry invalid output by default. Reject malformed objects, missing/blank/non-string reason or response, missing required decisions, invalid enums, null instruction in tutoring, and duplicate top-level decision/rationale fields. Retry within the configured limit, then surface failure to the consumer; never infer missing fields from response wording. Retain invalid attempts and retry outcomes in run evidence.

Retry limit and failure consumer: <reuse project settings; if absent, specify the limit and failure destination before execution>.

## Evaluation

Deterministic checks assess declared decisions against reviewed expected labels or allowed sets. LLM rubrics separately assess action realization, response quality, and evidence-grounded justification. Valid structure is not proof of correct behavior; plausible reasoning cannot excuse a wrong decision. Absent expected labels are missing evidence, not a pass. Keep schema validity outside the behavior scorecard unless it is an explicit evaluation objective.

## Deployment and evidence boundary

Record the deployed shape, differences from this design, and affected consumers: <prompt, parser, persistence, UI, and evaluator migration status>. This design grants no automatic sending, enforcement, or room-mode authority.

Preserve frozen runs under their original contract snapshots. Contract changes require a new contract/evaluation version and fresh comparable baseline before acceptance; updating this template does not migrate production or reinterpret historical evidence.
