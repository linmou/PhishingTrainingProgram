# Production v3 Provider Contract

**Intent**: Freeze the trusted provider request boundary, production prompt responsibilities, token budget, retry policy, and secret handling for W6.

## Shared versioned context

Component 102 owns these pure exports in existing `tutor-system/src/services/ecologicalTutorCall.ts`:

```ts
interface TransferTutorRequestV3 {
  contract_version: 'transfer_tutor_request_v3';
  context: TransferTutorRequestContextV3;
}

interface TransferTutorChecklistItemV3 {
  id: string;
  area_text: string;
  priority: 'critical' | 'important' | 'optional';
  status: 'pending' | 'partially_covered' | 'needs_review' | 'covered';
  understanding_level: 'none' | 'basic' | 'good';
  relevant_evidence_message_ids: string[];
  repair_message_id: string | null;
}

interface TransferTutorRequestContextV3 {
  contract_version: 'transfer_tutor_context_v3';
  room_id: string;
  checklist_id: string;
  focus_student_id: string;
  focus_student_message: {
    id: string;
    room_id: string;
    user_id: string;
    user_role: 'student';
    content: string;
  };
  progress_policy_version: 'transfer_v1';
  prior_participation_mode: 'tutoring' | 'guard' | 'unknown';
  checklist_items: TransferTutorChecklistItemV3[];
  eligible_assessment_item_ids: string[];
  unresolved_assessment: PublicAssessmentDTO | null;
  feedback_required: boolean;
  progress_snapshot_hash: string;
}
```

`buildTransferTutorRequestContextV3(...)` performs canonical packaging, `buildTransferTutorRequestV3(context)` wraps it with the request version, and `buildTransferTutorUserMessageV3(request)` canonically serializes the provider user turn. Production imports these exports for its request, and component 104 imports the same exports for Promptfoo cases. Contract tests compare canonical serialized requests from both consumers. Promptfoo owns cases/rubrics and semantic verdicts, not a parallel request or context shape.

## Request boundary

The provider request is created only in `tutor-system/supabase/functions/assessment-api/index.ts`. Provider URL, API key, and model are read from server-side environment configuration. The browser facade and Promptfoo contract adapter never receive or forward production credentials.

The v3 tutor request contains:

- the production v3 system prompt requiring reason-first JSON with `reason`, `decision`, `response`, and `assessment`;
- the canonical `TransferTutorRequestV3` user message, containing `TransferTutorRequestContextV3`, built through `ecologicalTutorCall.ts`;
- provider model/configuration and `max_tokens: 1200`;
- JSON response format settings supported by the configured provider.

It MUST NOT contain learner-selected answer labels for exact grading, the private answer key, unrelated learner keys, judge labels/rubrics/holdout labels, service credentials, or hidden chain-of-thought instructions.

The production system prompt remains backend-owned and is not exported by `ecologicalTutorCall.ts`. Sharing the context contract does not authorize browser or Promptfoo code to call the production provider, access credentials, read private storage, or become the prompt source of truth.

Evidence classification is a separate request. It may use the source plan's 4,096-token budget, includes only stored learner evidence/history and known item IDs, and may emit only evidence observations. It cannot emit `assessment_pass` or `assessment_fail`.

## Response handling

1. Check HTTP status and provider finish/truncation metadata.
2. Parse JSON and require the exact v3 structural/mode/payload contract.
3. Validate known item/message IDs, four ordered options, key cardinality, transfer-basis evidence, rendered limits, and mode/instruction compatibility.
4. On format/schema failure, make at most one format-only repair request. Preserve the initial response and repair outcome privately.
5. On network/HTTP failure, missing configuration, truncation, or a second invalid output, return the stable error class. Never synthesize an assessment, pass, fail, or progress event.

Semantic validity of the concept/key is a teacher-review and downstream evaluation concern; structural validity does not claim the generated key is independently correct.

## Secret checks

The implementation and verification must scan function responses, public DTO projections, Supabase realtime/publication payloads, browser bundles, logs, exports, and error messages. The following values must never appear outside authorized private server/teacher review scope: provider credentials, `correct_option_ids`, private transfer basis, raw model output, private rationale, private payload hashes, or answer-key-shaped data.
