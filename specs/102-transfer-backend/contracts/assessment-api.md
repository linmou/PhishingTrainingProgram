# Assessment API Contract

<!-- Intent: freeze the six browser-facing operations and their role-safe request/response DTOs. -->

## Envelope and Identity

Every request is `POST` with a non-empty `operation` and `request_id`. The browser sends the current app user's ID from `localStorage.tutor_system_user` in the `x-application-user-id` header. The handler reads the user's role and room memberships from the database before authorizing the operation. This project does not use Supabase Auth, and the header is an identity hint rather than cryptographic proof; a browser owner can change it. Tests inject a deterministic `AssessmentPrincipalVerifier`.

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

| Operation | Required body fields | Authorized caller | Result |
|---|---|---|---|
| `initialize_checklist` | `room_id`, `student_id`, `template_name` | authorized teacher | owner-scoped transfer checklist identity |
| `post_message` | `room_id`, `content`, optional `parent_message_id`; assessment answer additionally requires `assessment_id`, `selected_option_ids` | verified room participant; assessment answer must be the target learner | allowlisted stored message plus processing indicator |
| `analyze_message` | `room_id`, stored learner `message_id` | trusted backend for authorized learner scope | allowlisted applied/deferred evidence outcomes |
| `prepare_turn` | `room_id`, `focus_student_message_id`, `checklist_id` | authorized teacher | validated candidate decision and stable scope; nothing delivered is persisted |
| `send_reviewed` | reviewed decision plus `room_id`, `student_id`, `checklist_id`, `item_id`, `focus_student_message_id` | authorized teacher | public tutor message and room projection |
| `process_message` | stored learner `message_id` and `assessment_id` | verified target learner or trusted backend for that learner | authoritative attempt/result DTO |

There is no browser grading fallback, persisted draft/revision, reject operation, regenerate operation, or client-selected attempt number.

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
| correct option IDs | yes | no | no | no | yes |
| learner-safe explanation | yes | no | no | no | yes |
| transfer basis/rationale/raw output | authorized private scope only | no | no | no | no |
