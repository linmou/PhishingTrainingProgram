# Two-Attempt Transfer Case Schema Contract

**Intent**: define the stable public evaluator input/expected-outcome contract for W9-W10 transfer cases.

## Top-level shape

```json
{
  "case_id": "transfer-positive-known-account-001",
  "case_version": 1,
  "source_type": "synthetic_holdout",
  "case_role": "positive",
  "partition": "development",
  "source_provenance": {},
  "input": {},
  "evaluator": {},
  "pair": null,
  "transition": null,
  "attempt_sequence": null,
  "explanation": null,
  "holdout_eligibility": {}
}
```

## Required fields

### Identity and provenance

- `case_id` and integer `case_version` are stable and immutable within a frozen manifest.
- `source_type` is one of `product_template` or `synthetic_holdout`, following the repository's established Promptfoo source convention. Development/regression status is carried by `partition` and exposure metadata.
- `case_role` is one of the required coverage roles in the feature spec.
- `partition` declares the primary execution partition; required derived partitions are explicit in the manifest.
- `source_provenance` records source record/template ID, revision/export time, author, changed-field rationale, redaction status, and prompt/development exposure.

### Target-visible `input`

`input` MUST contain the full reproducible target-visible data projection accepted by the component-102-owned versioned v3 builder in `tutor-system/src/services/ecologicalTutorCall.ts`:

- scenario/context and configured learning inventory;
- ordered conversation history and latest learner contribution;
- prior participation mode, progress pair, unresolved assessment/feedback state, and relevant stable item/message IDs;
- source and repair evidence needed by the target to make the decision;
- role/configuration and any turn/repetition inputs;
- shared request contract version and target generation identity inputs, without evaluator labels.

The evaluation adapter passes this projection to the shared builder. It MUST NOT independently serialize transfer context, construct system/user messages, copy production prompt text, choose a provider endpoint/secret, or override the builder's effective 1,200 completion-token budget. The resulting target request records the shared builder hash/version and backend-owned production prompt reference/hash.

The target projection MUST NOT contain expected mode/instruction, expected metric labels, rubric text, pair membership, holdout eligibility, judge annotations, gate thresholds, or candidate/baseline verdicts.

### Evaluator-only `evaluator`

`evaluator` MUST contain:

- T09/T09.x requirement mappings and applicable metric IDs;
- expected decision/state values or allowed sets;
- prohibited outcomes and expected downstream effects;
- conditional applicability rule and rationale;
- expected transition steps and result after each step;
- pair/contrast expectation where the case is paired;
- label author/reviewer, review status, and label version.

Expected labels are outside the target projection but are passed to the evaluator through the frozen manifest.

### Pair and transition metadata

`pair` is null for unpaired cases. Otherwise it contains `pair_id`, `member`, `changed_factor`, and the expected contrast. Both members must be evaluated on the same run policy and both must pass required checks.

`transition` is null for single-turn cases. Otherwise it contains ordered turns, prior state, expected decision/state after each step, and the causal evidence reference. Do not flatten a recovery, assistance, clarification, contradiction, Guard, or follow-up sequence into a final-only assertion.

### Attempt sequence metadata

`attempt_sequence` is required for lifecycle cases. It contains one `assessment_id`, one `sequence_id`, and ordered steps. Each step records:

- the message/request identity and client context (`same_page`, `reload`, `separate_tab`, or `concurrent`);
- promoted component 101 `TransferAttemptSnapshot` projections before and after processing;
- promoted component 102 `ProcessedMessageDTO` observable fields, including processing state, answer outcome, attempt number/counts, terminal state, transition identity, result code, replay identity, and terminal-feedback presence;
- expected consuming/non-consuming disposition and exact allowed role-safe projection fields.

Valid sequences enforce: first wrong is retryable with one attempt remaining and no transition; correct on attempt one or two passes once; second wrong fails once; no third attempt or second terminal transition is consumed. Duplicate, stale, malformed, unauthorized, assistance, Guard, and post-terminal steps remain non-consuming according to the promoted contracts.

### Explanation metadata

`explanation` is required for assessment-generation or terminal-disclosure cases. It contains generated and reviewed values, edit/confirmation provenance, evaluator-only correct answer and concept/context references, learner projection stage, and applicable quality/disclosure checks. The target does not receive expected quality labels or disclosure expectations.

### Holdout eligibility

`holdout_eligibility` records author identity or authorized agent, creation version, target-prompt/development exposure, exposure date, eligible flag, and replacement/retirement link. An exposed holdout remains useful regression evidence but is not eligible unseen coverage.

## Validation and versioning

- Reject missing identity, provenance, target input, expected mapping, partition, or holdout fields.
- Reject evaluator labels in target input.
- Reject target inputs not accepted by the pinned shared v3 builder, any adapter-authored prompt/context field, and any product/evaluation effective token budget other than `1200`.
- Reject a pair without exactly two members or without one declared meaning-bearing change.
- Reject an eligible holdout with prompt/development exposure.
- Reject a changed contract/case version from a baseline/candidate comparison unless a new manifest and comparable baseline are created.
- Reject a lifecycle case that resolves the first valid incorrect answer, consumes more than two valid attempts, applies more than one terminal progress transition, or exposes terminal feedback outside an authorized second-incorrect failure.
- Reject an explanation case that omits generated/reviewed provenance, judges the wrong value, or places evaluator annotations in target inputs.
- Preserve all historical case versions; do not edit a frozen case in place.
