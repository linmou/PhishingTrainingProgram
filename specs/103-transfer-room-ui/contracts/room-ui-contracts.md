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
| `process_message` (`processMessage`) | persisted answer/message ID | `ProcessedMessageDTO` = the server's own grading lifecycle result, never a client grade or progress write instruction |
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

Learner components import component 102's exported `PublicAssessmentDTO` directly and consume only its assessment identity, selection type, stem, rendered text, and ordered option fields. Component 103 does not redeclare this type. The delivered tutor message is the question: its own `id` is the assessment identity and its `content` is the stem.

The projection has no `correct_option_ids`, `transfer_basis`, private `reason`, provider output, or teacher action. The renderer derives no answer key and does not perform semantic grading.

Recorded upstream limitation: the promoted one-table design stores only the ordered options on the delivered message (`messages.assessment_options`). It does not persist `selection_type` or `rendered_text`, and the public message DTO allowlist does not carry them either, so a room reload cannot reconstruct a complete `PublicAssessmentDTO` from persisted state. The UI therefore renders the stem and the ordered options from the message, renders the canonical instruction only when a selection type is explicitly available, and otherwise shows an explicit unavailable-instruction state. It never infers the selection type from the assessment key and never reads `assessment_key` at all.

## Message relationship contract

Every assessment answer message must preserve the persisted assessment identity and its actual `parent_message_id` when a question is being answered. An ordinary learner message has no assessment identity. A UI retry must reuse the upstream request identity and must merge the returned persisted message by ID.

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
- `lifecycle`: the server's own answer outcome, including unresolved-format, already-processed, assisted, and invalidated results.

These states are view state only. They are never progress state and never a substitute for a server result.

## Contract ownership

Component 101 owns shared assessment/progress domain types and exports, including `src/types/assessment.ts`, `src/types/learningProgress.ts`, and `src/types/index.ts`. Component 102 owns `transferAssessmentService.ts`, API DTO/envelope exports, the six-operation mapping, authorization, atomicity, idempotency, private field enforcement, and service contract tests. Component 103 owns React-specific narrowing and adapter-local view-state types in UI-owned files, room state merge, rendering, and role-specific display tests. Component 105 owns release-browser evidence.
