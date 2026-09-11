# Production v3 Provider Contract

**Intent**: Freeze the trusted provider request boundary, production prompt responsibilities, token budget, retry policy, and secret handling for W6.

## Request boundary

The request is created only in `tutor-system/supabase/functions/assessment-api/index.ts`. Provider URL, API key, and model are read from server-side environment configuration. The browser facade never receives or forwards the provider credential.

The v3 tutor request contains:

- the production v3 system prompt requiring reason-first JSON with `reason`, `decision`, `response`, and `assessment`;
- stable room/student/message/item IDs and observable evidence needed for selection;
- transfer policy/progress state and eligible item IDs;
- provider model/configuration and `max_tokens: 1200`;
- JSON response format settings supported by the configured provider.

It MUST NOT contain learner-selected answer labels for exact grading, the private answer key, unrelated learner keys, judge labels/rubrics/holdout labels, service credentials, or hidden chain-of-thought instructions.

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
