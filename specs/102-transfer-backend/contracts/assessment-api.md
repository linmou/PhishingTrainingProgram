# Assessment API Contract

**Intent**: Freeze the public operation names, request envelope, response envelope, and DTO privacy boundary for the trusted `assessment-api` Edge Function.

## Request and response envelopes

Every operation is a `POST` body containing a non-empty `operation` and transport `request_id`. Identity is never accepted from the body. The API handler receives this narrow dependency:

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
```

Deployment wiring supplies an adapter backed by a real trusted session/capability and stored room authorization; the transport proof format is adapter-specific. Tests inject a verifier. The contract does not require Supabase Auth, a bearer token, or `auth.uid()`. With no deployment adapter, every operation returns the 503 `AUTHORIZATION_NOT_CONFIGURED` envelope before data access or mutation.

```json
{
  "operation": "process_message",
  "request_id": "uuid",
  "message_id": "uuid"
}
```

Success:

```json
{ "ok": true, "data": {} }
```

Error:

```json
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "safe text", "retryable": false } }
```

Messages are safe summaries. They never contain keys, private payloads, provider credentials, raw private model output, or hidden rationale.

## Operations

| Operation | Required body fields | Authorized caller | Result |
|---|---|---|---|
| `initialize_checklist` | `room_id`, requested `student_id`, `template_name` | authorized teacher | transfer checklist ID after server scope validation |
| `post_message` | `room_id`, content, optional parent/question IDs | verified application principal | public stored message and processing indicator |
| `analyze_message` | `room_id`, stored learner `message_id` | trusted backend path for the authorized learner | allowlisted applied/deferred event outcomes |
| `prepare_turn` | `room_id`, focus student message ID, checklist ID | authorized teacher | private authorized-teacher draft reference and reviewable decision; no learner key DTO |
| `review_draft` | draft ID, expected revision, final structured payload, content confirmation | authorized teacher | new revision and review status |
| `send_reviewed` | draft ID, expected revision | authorized teacher | public tutor message and public question DTO, or legacy tutoring result |
| `process_message` | stored learner message ID | verified owner learner/authorized backend | public question result/transition outcome without key |

A draft that is never sent is simply never delivered. There is no reject or regenerate operation, and no generation-trigger suppression: the absence of a send is already the correct outcome, and the product has no requirement to prevent a tutor from receiving a draft again.


The operation set is versioned by the RPCs below. Adding an operation or changing a field requires a new contract version and generated client types; body aliases are not compatibility behavior.

## Public DTOs

`PublicAssessmentDTO` contains only `id`, `selection_type`, `stem`, `rendered_text`, and ordered option objects with `id` and `text`. Public question lifecycle DTOs may add scope/link/timestamp/result fields needed by the UI, but never add `correct_option_ids` or `transfer_basis`.

`PublicMessageDTO` contains stored message identity, room/user scope, content, role, parent, turn mode, assessment link, and timestamp. It does not expose private draft or feedback rows.

`TeacherAssessmentDraftDTO` is the only private browser DTO name. It is returned only after verified teacher authorization and may contain `draft_id`, `revision`, `status`, structured decision, observable reason, and the private assessment basis needed for review. The service maps internal `private.assessment_drafts` rows to this allowlist; storage names never become browser DTO names. It must not be returned by learner operations or included in public/realtime message payloads.

## Stable error classes

`AUTHORIZATION_NOT_CONFIGURED` (503), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `ASSESSMENT_FEATURE_DISABLED` (503), `LEGACY_CHECKLIST` (409), `UNSUPPORTED_ROOM_SCOPE` (409), `DRAFT_REVISION_CONFLICT` (409), `DRAFT_ALREADY_SENT` (409), `CONTENT_CONFIRMATION_REQUIRED` (409), `WRONG_LEARNER` (403/409), `ANSWER_FORMAT_UNRESOLVED` (successful clarification outcome), `ITEM_VALIDATION_FAILED` (422), `AI_PROVIDER_NOT_CONFIGURED` (503), `AI_PROVIDER_ERROR` (502, retryable), `AI_OUTPUT_INVALID` (502, retryable only for bounded format repair), `PROGRESSION_LOCKED` (deferred outcome), and `PERSISTENCE_FAILED` (500, retryable with the same request ID).
