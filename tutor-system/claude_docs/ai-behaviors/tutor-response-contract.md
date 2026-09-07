# Tutor response contract

Intent: define separately observable participation and instructional decisions, their supervisor-facing justification, and the boundary between designed and deployed contracts.

Updated: 2026-09-07
Production source: [aiService.ts](../../src/services/aiService.ts)

## Deployed object

| Field | Production validation | Consumer |
| --- | --- | --- |
| `mode` | Required string, exactly `tutoring` or `guard`. | Parsed decision and reviewed-mode workflow. Semantic correctness belongs to [G01 in the specification](tutor-behavior-specification.md#g01-participation-state-decision). |
| `mode_reason` | Required non-empty trimmed string. | Existing mode-decision evidence and persisted review metadata. This narrower field is not automatically equivalent to the broader `reasoning` requirement below. |
| `suggested_response` | Required non-empty trimmed string. | Tutor suggestion that a human may copy, edit, reject, and send. [T08 in the specification](tutor-behavior-specification.md#t08-suggestion-length) supplies its delivery bounds. |

The parser requires a JSON object, does not require field order, and accepts additional fields. Production requests JSON Object mode and permits one format-repair retry, for two attempts total. HTTP and network errors are not format-repair retries. Reviewed response and final mode are persisted through [guardModeService.ts](../../src/services/guardModeService.ts); the raw AI mode does not automatically control the room.

See [the suggestion workflow](../ai-suggestion-tracking.md) for human review and persistence.

## Designed extension: reasoning and instructional decision

Requested by the user on 2026-09-07; specified by [C01](tutor-behavior-specification.md#c01-response-contract-and-decision-reasoning), [T01](tutor-behavior-specification.md#t01-correction-and-protective-instruction-eligibility), and [G01](tutor-behavior-specification.md#g01-participation-state-decision). Design only: the production prompt, parser, persistence, and UI have not been migrated. The evaluation checks are v1; this does not register an experimental behavior-spec version.

| Field | Designed validation | Intended consumer |
| --- | --- | --- |
| `reasoning` | Required string; non-null and non-empty after trimming. Serialize first in the extended object. | Human-supervisor explanation of the decision and response. C01 owns semantic evidence, purpose, uncertainty, and priority requirements. Keep it separate from student-facing `suggested_response`. |
| `mode` | Retain the required top-level enum `tutoring` or `guard`; non-null. | G01 participation decision and the existing human-reviewed mode workflow. Do not also add `decision.mode`. |
| `decision` | Required non-null JSON object. | Container for separately named instructional decisions; not an inferred action hidden in prose. |
| `decision.instruction` | Required key; one of `protective_instruction`, `correction`, `scaffolding`, `explanation`, `consolidation`, or explicit null. Null is allowed only in Guard. | Declares the first substantive instructional move, excluding a brief acknowledgment. The supervisor and evaluator compare it with the actual suggestion. |

Retain `mode_reason` and `suggested_response` with their deployed types and values. `mode_reason` remains mode-specific; `reasoning` explains the overall response choice. They must not contradict one another. Retain acceptance of additional fields, but do not use undeclared fields as a substitute for required decisions. No automatic change of room mode, automatic sending, or new enforcement authority is introduced.

### Instructional-action meanings

| Value | Observable response action | Boundary |
| --- | --- | --- |
| `protective_instruction` | Directly stop or redirect an imminent unsafe action before exploration. | Not synonymous with Guard: a genuine learner can need protection while remaining in tutoring. |
| `correction` | Explicitly correct a false inference or misconception. | Does not mean correcting disruptive participation; G02 owns that. |
| `scaffolding` | Give a focused hint or question that leaves a reasoning step to the learner. | A useful question-only scaffold is allowed; no question quota. |
| `explanation` | Explain or elaborate knowledge without first correcting a false inference. | A correct partial answer may need elaboration, not correction. |
| `consolidation` | Reinforce or summarize demonstrated understanding without opening a new target. | T02 owns whether consolidation rather than a new target is appropriate. |
| null | No instructional move; the response addresses participation only. | Valid only with Guard. A G02 participation request is not forced into a tutoring action label. |

If correction is followed by a scaffold, declare `correction`; if protection precedes explanation, declare `protective_instruction`. Brief acknowledgment does not change the action. These labels describe the first substantive instructional move, not a ban on connected follow-up teaching. Guard can coexist with an instructional move when task content is actually needed, but G02 alone never requires it. T04 still governs any knowledge provided in either mode.

Example of genuine engagement requiring protection:

```json
{
  "reasoning": "The learner is about to open the suspect link, so protection comes first. No deliberate obstruction is evident.",
  "mode": "tutoring",
  "mode_reason": "The learner is genuinely asking for help, not obstructing participation.",
  "decision": { "instruction": "protective_instruction" },
  "suggested_response": "Do not open that link. Open the real app yourself to check the alert."
}
```

For deliberate off-topic disruption with no instructional content, use `mode: guard` and `decision.instruction: null`; G02 and G03 judge the participation correction and delivery separately.

### Validation and measurement boundary

Missing/blank/non-string reasoning, missing decisions, invalid enum values, null instruction in tutoring, or malformed objects are invalid under the extended contract. They must use the bounded format-repair/error path, not fall back to `mode_reason` or infer a label from response text. The current parser's acceptance of extra fields does not establish validation, persistence, or visibility for this extension. Production migration and a fresh comparable evaluation remain required.

Deterministic decision metrics compare the declared fields with reviewed expected labels or allowed sets recorded outside target inputs. For example, imminent risk permits only `protective_instruction`; a correct partial answer may allow either `scaffolding` or `explanation`. A malformed field is a validity issue, a valid but wrong decision is a behavior failure, and absent expected labels are missing evaluation evidence—not a pass. Decision checks do not depend on a non-empty explanation passing, and explanation scores never override them. LLM checks separately verify that the actual wording carries out the declared action and that the reasoning is grounded. T02's semantic learning-state/target judgment is not replaced by a string comparison.

The evaluation guide's generalized `reason`-first / optional `decision` / `response` shape differs from the deployed object. The requested field name here is `reasoning`; this document designs that extension without claiming a migration to the guide's other field names.
