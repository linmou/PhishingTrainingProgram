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

Component 102 types the successful and failed envelopes (`AssessmentApiEnvelope<T>`, `AssessmentApiError`, `TransferAssessmentServiceOptions`) and owns API compatibility logic and the injectable transport used by tests. Component 103's React adapter consumes only those exported envelopes and maps them into UI states; it must not recreate API operation mapping or treat raw provider output as a DTO.

## Private teacher review allowlist

The teacher editor may receive:

- selected learner/source message/checklist/item identity from `prepareTurn`;
- the structured candidate decision required for teacher review, including answer key and transfer basis;
- the local review status the teacher's own screen derives (`preparing`, `dirty`, `ready`, `sending`, `delivered`, `unavailable`, `validation`, `superseded`, `retryable`).

It may not receive or display a draft identity, a draft revision, or an expected snapshot hash, because none of those exist. This projection is never sent to learner components, learner exports, browser-wide broadcast events, or public message payloads.

## Public learner assessment allowlist

Learner components import component 102's exported `PublicAssessmentDTO` directly and consume only its assessment identity, target learner identity, selection type, stem, rendered text, and ordered option fields. Component 103 does not redeclare this type. The delivered tutor message is the question: its own `id` is the assessment identity and its `content` is the stem. `student_id` determines which learner receives answer controls; teachers, observers, and other learners receive a read-only public rendering.

The projection has no `correct_option_ids`, `transfer_basis`, private `reason`, provider output, or teacher action. The renderer derives no answer key and does not perform semantic grading.

The promoted component 102 contract must reconstruct the same `PublicAssessmentDTO` after reload, including `selection_type`, stem, and ordered options. Persisted message content is the stem only. The UI ignores `rendered_text` for learner rendering and never appends options to message content, so the stem and each structured option render exactly once. A missing selection type is an unavailable state; the UI never infers it from the answer key.

## Answer lifecycle result consumed by React

The promoted `ProcessedMessageDTO` must let the UI render the persisted lifecycle without another authority. Component 103 proposes and consumes this exact shape; reconciliation must return any mismatch to component 102 rather than adapting it locally:

```ts
interface ProcessedMessageDTO {
  question_id: string;
  answer_message_id: string;
  outcome: 'retry_incorrect' | 'terminal_correct' | 'terminal_incorrect';
  attempts_used: 1 | 2;
  attempts_remaining: 0 | 1;
  terminal: boolean;
  selected_option_ids: AssessmentOptionId[];
  correct_option_ids?: AssessmentOptionId[];
  learner_safe_explanation?: string;
  already_processed: boolean;
}
```

`PublicAssessmentDTO` must include `student_id: string` in addition to `id`, `selection_type`, `stem`, `rendered_text`, and ordered options. The consumer semantics are:

| Semantic field | UI use | Constraint |
|---|---|---|
| `question_id` and `answer_message_id` | merge the result onto one delivered question/answer pair | stable persisted identities |
| `outcome` | render retry, correct terminal, or incorrect terminal feedback | server-derived; never inferred from selected options |
| `attempts_used` and `attempts_remaining` | display the authoritative count | persisted and identical after reload/reconnect/tab activity |
| `terminal` | disable submission after resolution | server-derived; the UI has no reset path |
| `selected_option_ids` | render the accepted selection when authorized | canonical IDs only |
| `correct_option_ids` | render the role-safe answer | absent on retry and terminal-correct; required on terminal-incorrect |
| `learner_safe_explanation` | render terminal teaching feedback | absent on retry and terminal-correct; required and non-empty on terminal-incorrect |
| `already_processed` | merge a replay without another visible attempt | returns the same persisted lifecycle |

The first incorrect result is non-terminal, reports one remaining attempt, and discloses neither the correct answer nor the learner-safe explanation. A correct answer on either attempt and a second incorrect answer are terminal. A third submission is rejected or returned as already terminal without another grade or progress transition.

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

- `unavailable`: the capability is disabled or the trusted operation is not configured (`ASSESSMENT_FEATURE_DISABLED`, `AI_PROVIDER_NOT_CONFIGURED`, `AUTHORIZATION_NOT_CONFIGURED`);
- `validation`: malformed or semantically invalid reviewed payload (`ITEM_VALIDATION_FAILED`, `AI_OUTPUT_INVALID`, `INVALID_SCOPE`, local `parseTutorDecisionV3` rejection);
- `superseded`: the server reports that persisted state already covers this delivery or the identity no longer matches (`ASSESSMENT_ALREADY_OPEN`, `WRONG_LEARNER`, `LEGACY_CHECKLIST`); nothing is rendered as delivered;
- `duplicate`: an idempotent replay whose persisted result can be shown once;
- `unauthorized`: no data or action is rendered (`FORBIDDEN`, `UNAUTHORIZED`);
- `retryable`: transient transport or provider failure with a safe retry action;
- `retry`: a persisted first-incorrect result with attempts remaining and no answer/explanation disclosure;
- `terminal-correct`: a persisted correct result on either accepted attempt;
- `terminal-incorrect`: a persisted second-incorrect result with role-safe answer/explanation disclosure;
- `duplicate` or `already-terminal`: an idempotent replay whose persisted lifecycle is rendered once;
- `invalid`: malformed, stale, unauthorized, or inconsistent lifecycle data that fails closed.

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
