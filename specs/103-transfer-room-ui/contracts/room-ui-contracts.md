# Room UI Consumer Contracts

## Intent

Specify how W7-W8 consumes component 101's shared assessment/progress types and component 102's allowlisted browser contract. Component 101 owns shared domain type files and exports; component 102 owns `tutor-system/src/services/transferAssessmentService.ts`, all API DTO/envelope declarations, and operation mapping. Component 103 owns only React-specific narrowing and adapter-local view-state types in UI-owned files; components do not consume raw provider or database responses.

## Teacher operations

Component 102's browser facade exports exactly these six typed methods. This table is a consumer dependency, not a component-103 service definition:

| Operation (facade method) | Request identity | Response consumed by UI |
|---|---|---|
| `initialize_checklist` (`initializeChecklist`) | `roomId`, `studentId`, `templateName` | `{ checklist_id }` |
| `prepare_turn` (`prepareTurn`) | `roomId`, `focusStudentMessageId`, `checklistId` | the generated candidate `TutorDecisionV3` decision plus the prepared scope identity (`room_id`, `student_id`, `checklist_id`, `item_id`, `focus_student_message_id`) and the server's informational `progress_snapshot_hash` echo |
| `send_reviewed` (`sendReviewed`) | `reviewedPayload` (`TutorDecisionV3`), `roomId`, `studentId`, `checklistId`, `itemId` (`string \| null`), `focusStudentMessageId` | `ReviewedDeliveryDTO` = delivered `PublicMessageDTO` plus the updated `Room` |
| `post_message` (`postMessage`) | `roomId`, content, optional `replyToMessageId`, optional `assessmentId` | persisted message row (`Record<string, unknown>`) that the UI must project before it enters React state |
| `process_message` (`processMessage`) | persisted answer/message ID plus the delivered assessment identity carried by the stored message | `ProcessedMessageDTO` = the server's persisted grading and attempt lifecycle result, never a client grade, attempt mutation, disclosure decision, or progress write instruction |
| `analyze_message` (`analyzeMessage`) | persisted message ID and room ID | explicit evidence/lifecycle result for the server-owned path |

There is no `capabilities`, no `review_draft`, no `reject_draft`, and no `regenerate_draft` operation. Teacher confirmation is UI-local review state; the only persistence call on the review path is `sendReviewed`. `sendReviewed` carries no expected draft revision and no expected content hash, because no draft row exists.

Component 102 types and unwraps the successful and failed envelopes (`AssessmentApiEnvelope<T>`, `AssessmentApiError`) and owns API compatibility logic, operation mapping, and the injectable transport used by tests. Component 103's React adapter receives the service's canonical DTO projections and thrown service errors, then maps those into UI states. It does not parse envelopes or recreate API operation mapping, and it never treats raw provider output as a DTO.

## Private teacher review allowlist

The teacher editor may receive:

- selected learner/source message/checklist/item identity from `prepareTurn`;
- the structured candidate decision required for teacher review, including answer key and transfer basis;
- the local review status the teacher's own screen derives (`preparing`, `dirty`, `ready`, `sending`, `delivered`, `unavailable`, `validation`, `superseded`, `retryable`).

It may not receive or display a draft identity, a draft revision, or an expected snapshot hash, because none of those exist. This projection is never sent to learner components, learner exports, browser-wide broadcast events, or public message payloads.

## Public learner assessment allowlist

Learner components import component 102's exported `PublicAssessmentDTO` directly and consume only `id`, `student_id`, `selection_type`, `stem`, and ordered `options`. Component 103 does not redeclare this type. The delivered tutor message is the question: its own `id` is the assessment identity and its `content` equals the stem. `student_id` is stable UI routing metadata: answer controls render only when the local participant matches it, and missing or mismatched identity fails closed. It is never treated as authorization; component 102 still verifies the principal and target learner.

The projection has no `correct_option_ids`, `transfer_basis`, private `reason`, provider output, or teacher action. The renderer derives no answer key and does not perform semantic grading.

The promoted component 102 contract reconstructs the same `PublicAssessmentDTO` after reload. `rendered_text` is not a public DTO field. Persisted `message.content` equals `assessment.stem`, and options appear only in `assessment.options`, so the UI renders the stem and each structured option exactly once. A missing selection type is an unavailable state; the UI never infers it from the answer key.

## Answer lifecycle result consumed by React

The promoted `ProcessedMessageDTO` lets the UI render the persisted lifecycle without another authority. Component 103 imports and consumes this component-102-owned shape without redefining or renaming its fields:

```ts
interface ProcessedMessageDTO {
  message_id: string;
  assessment_id: string;
  processing_state: 'applied' | 'duplicate' | 'rejected' | 'deferred';
  answer_outcome: 'retry' | 'passed' | 'failed' | null;
  attempt_number: 1 | 2 | null;
  attempts_used: 0 | 1 | 2;
  attempts_remaining: 0 | 1 | 2;
  selected_option_ids: AssessmentOptionId[] | null;
  terminal: boolean;
  transition: Record<string, unknown> | null;
  feedback_required: boolean;
  code: string | null;
  already_processed: boolean;
  terminal_failure_feedback: {
    correct_option_ids: AssessmentOptionId[];
    learner_safe_explanation: string;
  } | null;
}
```

`PublicAssessmentDTO` is exactly `{ id, student_id, selection_type, stem, options }`. The consumer semantics are:

| Semantic field | UI use | Constraint |
|---|---|---|
| `message_id` and `assessment_id` | merge the result onto one persisted answer/question pair | stable persisted identities |
| `processing_state` | render applied, duplicate, rejected, or deferred mechanics | must not be renamed into a learning outcome |
| `answer_outcome` | map `retry`, `passed`, `failed`, or null into component-owned presentation state | server-derived; never inferred from selected options |
| `attempt_number` | identify the accepted first or second attempt | null when no attempt was applied |
| `attempts_used` and `attempts_remaining` | display the authoritative count | persisted and identical after reload/reconnect/tab activity |
| `terminal` | disable submission after resolution | server-derived; the UI has no reset path |
| `selected_option_ids` | render the accepted selection when authorized | canonical IDs only |
| `transition` and `feedback_required` | render server-owned progress/feedback status without applying it locally | never interpreted as a browser write instruction |
| `code` | render a safe rejected/deferred/error state | never silently coerced into an outcome |
| `already_processed` | merge a replay without another visible attempt | returns the same persisted lifecycle |
| `terminal_failure_feedback` | render its exact `correct_option_ids` and `learner_safe_explanation` | non-null only for an authorized terminal `answer_outcome: failed`, including a committed failure whose progress transition is deferred; null for retry, passed, null outcome, and unauthorized projections |

The first incorrect result is `answer_outcome: retry`, non-terminal, reports one remaining attempt, and has null `terminal_failure_feedback`. A correct answer on either attempt is terminal `passed` with null terminal feedback. A second incorrect answer is terminal `failed` and may disclose non-null `terminal_failure_feedback` only to the authorized learner, even when `processing_state: deferred` records a deferred progress transition. A third submission is rejected or returned as already processed without another grade or progress transition.

## Message relationship contract

Every assessment answer must preserve the persisted assessment identity and its actual `parent_message_id`. The selection control serializes only displayed canonical option IDs into the existing `content` field: `B` for a single answer and uppercase IDs in A-D order separated by comma-space (for example, `B, D`) for multiple answers. It does not accept free text. An ordinary learner chat message has no assessment identity. A UI retry reuses the upstream request identity and merges the returned persisted message/result by ID.

`itemId` is `string | null`. A tutoring or Guard turn has no checklist item, and the browser must pass `null` rather than the string `"null"`, which the server rejects as an invalid UUID.

## Mode contract

- Room participation: `tutoring | guard`.
- Tutor turn/message: `tutoring | guard | assessment`.
- Assessment turn instruction: `transfer_assess`.
- Guard participation instruction: `guard`.
- `assessment` is not valid as a room participation value.
- Assessment delivery maps to room participation `tutoring`; an independent Guard decision remains server-authoritative.

The UI rejects missing instructions, `assessment` without `transfer_assess`, tutoring/Guard with an assessment payload, and any payload with an unknown target identity.

## React state adaptation

The component-103 adapter imports component 101/102 exports unchanged and defines its React-only review, public-question, and lifecycle view-state types alongside their mappings in `src/contexts/transferAssessmentUiAdapter.ts`. It maps component 102's thrown service errors and returned projections into these states without exposing raw provider output:

- `unavailable`: the capability is disabled, the trusted operation is not configured, or the transfer checklist does not apply to the room (`ASSESSMENT_FEATURE_DISABLED`, `AI_PROVIDER_NOT_CONFIGURED`, `AUTHORIZATION_NOT_CONFIGURED`, `LEGACY_CHECKLIST`, `LEGACY_ASSESSMENT_INCOMPLETE`, `UNSUPPORTED_ROOM_SCOPE`);
- `validation`: malformed or semantically invalid reviewed payload (`ITEM_VALIDATION_FAILED`, `AI_OUTPUT_INVALID`, `INVALID_SCOPE`, `INVALID_REQUEST`, `PROGRESSION_LOCKED`, local `parseTutorDecisionV3` rejection);
- `superseded`: the server reports that persisted state already covers this delivery or the identity no longer matches (`ASSESSMENT_ALREADY_OPEN`, `ASSESSMENT_TERMINAL`, `WRONG_LEARNER`); nothing is rendered as delivered;
- `duplicate`: an idempotent replay whose persisted result can be shown once;
- `unauthorized`: no data or action is rendered (`FORBIDDEN`, `UNAUTHORIZED`);
- `retryable`: transient transport or provider failure with a safe retry action;
- `retry`: mapped from `answer_outcome: retry`, with attempts remaining and null `terminal_failure_feedback`;
- `terminal-correct`: mapped from terminal `answer_outcome: passed`, with null `terminal_failure_feedback`;
- `terminal-incorrect`: mapped from terminal `answer_outcome: failed`, using `terminal_failure_feedback` without renaming or flattening its upstream fields;
- `duplicate` or `already-terminal`: mapped from `processing_state`, `already_processed`, and the returned persisted lifecycle;
- `invalid`: malformed, stale, unauthorized, rejected, or inconsistent lifecycle data that fails closed while preserving the upstream `code`.

These states are view state only. They are never progress state and never a substitute for a server result.

## Selection and disclosure controls

- `single` questions render one radio group; `multiple` questions render checkboxes.
- Submit answer is explicit and disabled with no selection, while a submission is pending, or after a terminal result.
- Option order is canonical A-D; selection serialization is deterministic and independent of click order.
- Every transfer-assessment message starts expanded and exposes an accessible collapse/expand icon to every participant.
- Expanded state is participant-local React state and is never written to room, message, attempt, or progress state.
- Collapsing does not clear a selection, cancel a submission, or alter the authoritative lifecycle result.

## Contract ownership

Component 101 owns shared assessment/progress domain types and exports, including `src/types/assessment.ts`, `src/types/learningProgress.ts`, and `src/types/index.ts`. Component 102 owns `transferAssessmentService.ts`, API DTO/envelope exports, the six-operation mapping, authorization, atomicity, idempotency, private field enforcement, and service contract tests. Component 103 owns React-specific narrowing and adapter-local view-state types in UI-owned files, room state merge, rendering, and role-specific display tests. Component 105 owns release-browser evidence.
