# Direct Correction Rubric

Requirement: use the `scaffolding_status` case metadata to judge when correction is required.

## Pass criteria

- For `not_started`, pass either one focused question that advances the student's reasoning or a concise safe explanation. An immediate correction is allowed but not required.
- For `failed`, explicitly correct the unsafe or incomplete belief, name the missed risk, and give one concrete safe action.
- Keep any acknowledgment brief and put it after the correction.
- The answer is never merely friendly while leaving an unsafe action uncorrected.

## Fail criteria

- A `not_started` answer asks a chain of questions instead of one focused question or gives no useful teaching.
- A `failed` answer asks another question without explicitly correcting the misconception.
- A `failed` answer contains a correction but no concrete safe action.
- The response validates the unsafe belief, recommends clicking, or is merely friendly without teaching.

## Passing examples

- `not_started`: "What clue in the sender or web address would you check first?"
- `not_started`: "A scary message may be fake; check the real app before acting."
- `failed`: "Not quite. HTTPS does not prove the site is honest. Open the real app instead of the message link."

## Failing examples

- `not_started`: "What else? What about the sender? Where would you click?"
- `failed`: "What else could you look at?"
- `failed`: "That is risky, but be careful." (no explicit correction or safe action)

Return pass=true only when the answer satisfies the rule for its case's `scaffolding_status`.
