# Component 102 Edge API Contract

<!-- Intent: define browser-facing assessment operations and their role-safe request/response DTOs. -->

Updated: 2026-10-17. Revision baseline commit: `c6d5129`.

This contract describes the component-102 Edge Function in the repository. Current artifact versions and live evidence are recorded in the [assessment dialogue release record](../../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_17_assessment_result_messages.md). The [2026-10-14 record](../../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_final_assessment_release.md) preserves that earlier release's source and workflow evidence.

## Envelope and Identity

Every request is `POST` with a non-empty `operation` and `request_id`. The browser sends the current app user's ID from `localStorage.tutor_system_user` in the `x-application-user-id` header; the header is an identity hint, not cryptographic proof. The Edge Function loads that user's role and room memberships from the database and authorizes each requested scope from those records. The handler receives an `AssessmentPrincipalVerifier`, and tests inject a deterministic verifier. Without a verifier, all transfer mutations fail before data access:

This app does not use Supabase Auth. Because the current localStorage identity can be edited or forged by the browser owner, database role and room checks prevent inconsistent claims but do not establish that the caller is the person named by the ID. A trusted identity mechanism would be needed before this boundary can defend against impersonation.

```ts
interface AssessmentPrincipalVerifier {
  verify(request: Request): Promise<VerifiedPrincipal>;
}

interface VerifiedPrincipal {
  principal_id: string;
  application_user_id: string;
  allowed_room_ids: string[];
  can_review_assessment: boolean;
}

type AssessmentApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: AssessmentApiError };

interface AssessmentApiError {
  code: string;
  message: string;
  retryable: boolean;
}
```

Errors contain safe text only. They never contain a key, explanation, transfer basis, rationale, raw provider output, credential, SQL detail, or private row.

## Operations

Refactor revision (2026-09-29): `initialize_checklist` takes approved `items` with `area_text`, `item_type`, and `priority`; the server owns IDs and progress. `analyze_message` semantically applies idempotent learner evidence. The unchanged `prepare_turn` operation is exposed by the browser as `prepareAssessment()` and returns one assessment-only candidate when due, `null` only when no assessment is due, or an explicit error. `send_reviewed` accepts only an assessment draft and rechecks eligibility before atomic delivery.

Final-assessment revision (2026-10-13, deployed 2026-10-14): `prepare_turn` uses trusted Partial → Covered `demonstrated_understanding` history to select an outstanding final check. Initial/repair signals continue tutoring; direct Pending → Covered and spontaneous transfer complete without assessment. Guard, open-question and feedback deferrals preserve readiness. Notes/priority edits preserve it; target/progress invalidation cancels obsolete questions without grading. Terminal pass from Covered records completion even though the progress pair is unchanged. The [response contract](../../../tutor-system/docs/ai-behaviors/transfer-status-response-contract.md) owns the full policy; public operation shapes and per-target analysis calls remain unchanged. The 2026-10-14 analysis contract returns `events` and `explanation`; private combined results also contain `rejected_events`.

Assessment generation retains one format-only repair attempt. Its user input includes `format_repair.validation_error` from the rejected first draft; the same validation applies to the second draft. Neither invalid draft is deliverable. Analysis calls continue to fail closed on invalid provider output.

| Operation | Required body fields | Authorized caller | Result |
|---|---|---|---|
| `initialize_checklist` | `room_id`, `student_id`, approved `items` (`area_text`, `item_type`, `priority`) | authorized teacher | owner-scoped transfer checklist identity; repeated initialization preserves approved items and progress |
| `post_message` | `room_id`, `content`, optional `parent_message_id`; assessment answer additionally requires `assessment_id`, `selected_option_ids` | verified room participant; assessment answer must be the target learner | allowlisted stored message plus processing indicator |
| `analyze_message` | `room_id`, stored learner `message_id` | trusted backend for authorized learner scope | allowlisted applied/deferred evidence outcomes |
| `prepare_turn` | `room_id`, `focus_student_message_id`, `checklist_id` | authorized teacher | validated candidate decision and stable scope; nothing delivered is persisted |
| `send_reviewed` | reviewed decision plus `room_id`, `student_id`, `checklist_id`, `item_id`, `focus_student_message_id` | authorized teacher | public tutor message and room projection |
| `process_message` | stored learner `message_id` and `assessment_id` | verified target learner or trusted backend for that learner | authoritative attempt/result DTO |
| `read_review` | `room_id`, `assessment_id` | authorized teacher | private review plus learner-scoped readiness; deterministic recovery of pending answers before rereading readiness |
| `join_room` | `room_id` | current app user | room/learner identity and participation role |
| `edit_learning_progress` | `room_id`, `item_id`, `action`, `updates` | authorized teacher | validated progress/target edit; obsolete questions close through saved closure events |
| `clear_chat_history` | `room_id` | room-owning teacher | atomic deletion of scoped private assessment sources and room messages; pre-populated dialogue preserved |

There is no browser grading fallback, persisted draft/revision, reject operation, regenerate operation, or client-selected attempt number.

`initialize_checklist` returns `{ checklist_id: string }`, wrapping the database RPC's UUID result. `prepare_turn` includes `item_id` (the candidate's assessment target, or null for tutoring/Guard) and `progress_snapshot_hash` alongside its existing scope and decision. The review UI consumes these fields directly.

## Public DTOs

```ts
interface PublicAssessmentDTO {
  id: string;
  student_id: string;
  selection_type: 'single' | 'multiple';
  stem: string;
  options: AssessmentOption[];
}

interface PublicMessageDTO {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  user_role: string;
  ai_model_used?: string | null;
  ai_response_time_ms?: number | null;
  parent_message_id: string | null;
  response_mode: string | null;
  assessment?: PublicAssessmentDTO | null;
  assessment_event?: AssessmentEvent | null;
  created_at: string;
}

interface ReviewedDeliveryDTO {
  message: PublicMessageDTO;
  room: Room;
}
```

The exact public delivered-assessment shape is `{id, student_id, selection_type, stem, options}`. For a delivered assessment, `message.content === message.assessment.stem`. Options appear only in `message.assessment.options`. `student_id` is derived from the persisted private assessment and owner-scoped checklist, and room consumers use it only to render answer controls for the intended learner. It is never accepted as proof of identity or permission; `post_message` and `process_message` reauthorize the app user against database scope. A missing or mismatched target makes the projection unavailable rather than falling back to message author, latest learner, local role, or browser state.

`PUBLIC_MESSAGE_DTO_KEYS` and `PUBLIC_ASSESSMENT_FORBIDDEN_KEYS` remain explicit allowlist/denylist evidence. Public DTOs exclude `rendered_text` so consumers cannot render an option-bearing string beside structured options. `ProcessedMessageDTO` remains canonical exactly as defined below; adding `student_id` does not change any processing field or outcome.

## Processed Message DTO

```ts
type AssessmentProcessingState = 'applied' | 'duplicate' | 'rejected' | 'deferred';
type AssessmentAnswerOutcome = 'retry' | 'passed' | 'failed';

interface TerminalFailureFeedbackDTO {
  correct_option_ids: AssessmentOptionId[];
  learner_safe_explanation: string;
}

interface ProcessedMessageDTO {
  message_id: string;
  assessment_id: string;
  processing_state: AssessmentProcessingState;
  answer_outcome: AssessmentAnswerOutcome | null;
  attempt_number: 1 | 2 | null;
  attempts_used: 0 | 1 | 2;
  attempts_remaining: 0 | 1 | 2;
  selected_option_ids: AssessmentOptionId[] | null;
  terminal: boolean;
  transition: Record<string, unknown> | null;
  feedback_required: boolean;
  code: string | null;
  already_processed: boolean;
  terminal_failure_feedback: TerminalFailureFeedbackDTO | null;
  result_message: PublicMessageDTO | null;
}
```

Rules:

- First incorrect: `applied/retry`, attempt 1, remaining 1, nonterminal, null transition, null terminal feedback.
- Correct attempt 1 or 2: `applied/passed`, terminal, remaining 0, pass transition, null terminal feedback.
- Second incorrect: `applied/failed`, attempt 2, terminal, remaining 0, fail transition, non-null terminal failure feedback.
- Duplicate: `processing_state=duplicate`, `already_processed=true`, and the original persisted outcome/counts are returned without mutation.
- Invalid non-authority input: `rejected`, null outcome/attempt, unchanged authoritative counts, null feedback.
- Guard-deferred terminal transition: `deferred`, authoritative terminal answer result and deferred event commit without changing protected progress; an authorized second-failure response receives terminal feedback after that commit, while pass remains feedback-null.

## Stable Error Classes

`AUTHORIZATION_NOT_CONFIGURED` (503), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `ASSESSMENT_FEATURE_DISABLED` (503), `LEGACY_CHECKLIST` (409), `LEGACY_ASSESSMENT_INCOMPLETE` (409), `UNSUPPORTED_ROOM_SCOPE` (409), `ASSESSMENT_ALREADY_OPEN` (409), `ASSESSMENT_TERMINAL` (409 or successful terminal projection), `INVALID_SCOPE` (409), `WRONG_LEARNER` (403/409), `ITEM_VALIDATION_FAILED` (409), `AI_PROVIDER_NOT_CONFIGURED` (503), `AI_PROVIDER_ERROR` (502), `AI_OUTPUT_INVALID` (502), `PROGRESSION_LOCKED` (deferred outcome), and `PERSISTENCE_FAILED` (500).

## Privacy Matrix

| Field | Teacher candidate | Public message | First wrong | Pass | Second wrong learner response |
|---|---:|---:|---:|---:|---:|
| stem/options/selection type | yes | yes | yes | yes | yes |
| correct option IDs | yes | terminal-failure result only | no | no | yes |
| learner-safe explanation | yes | terminal-failure result only | no | no | yes |
| transfer basis/rationale/raw output | authorized private scope only | no | no | no | no |

## Saved result and readiness contract

`AssessmentEvent` is the safe backend-owned event projection defined in `src/types/assessment.ts`: event key/kind, assessment/question/student/answer identities, attempt/outcome/counts, terminal/lifecycle, progress deferral and closure cause. It contains no answer key or reviewed explanation fields. Published terminal-failure feedback lives in result message content. Event rows have no nested public question. Direct participant writes cannot create or edit trusted event provenance/content.

`process_message` returns the saved `result_message` for accepted and duplicate outcomes and assistance closure. Invalid/unscored outcomes return null. Historical duplicate outcomes reference the same backfilled row. No LLM call creates the grade or message.

Tutor `read_review` additionally returns trusted `student_id` and `history_readiness: {ready, result_message_ids, handled_answer_message_ids, pending_answer_message_ids, pending_answers, unavailable_assessment_ids}`. Pending entries contain only message/assessment IDs for authorized recovery. Scope covers the assessment's learner throughout the room, so another tab or selected historical answer cannot bypass pending processing. The readiness operation recovers pending answers through the existing deterministic processor, in source chronological order, then rereads readiness. It never invokes a provider. A private `transfer_assessment_processing` ledger stores non-consuming dispositions so rejected/unscored answers do not remain pending forever; Guard-only deferrals become recoverable when Guard clears. Accepted attempt counts and grades remain in their existing authority.

Generation requires ready=true and every required saved result in fetched dialogue, including after transfer learning is disabled. Handled-answer IDs distinguish unscored dialogue from a pending grade. Another learner's unfinished answer is omitted from this focused request instead of blocking it. Existing private review fields and processing bookkeeping remain outside the tutor prompt. Individual result deletion stays protected; `clear_chat_history` is the owner-authorized whole-room clearing path and preserves the existing backup flow.

Published results inherit ordinary room-message read visibility and exports. Current research-deployment message policies permit direct anonymous reads; this change does not establish stronger reader identity than the existing room transport. Backend assessment mutation/review role checks and immutable result provenance remain enforced.
