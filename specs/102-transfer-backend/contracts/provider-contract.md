# Component 102 Provider Contract

<!-- Intent: define the Edge Function provider behavior and request parity contract. -->

## Required Configuration

The Edge Function reads the configured tutor provider values from its Supabase secrets, plus the required model setting:

```text
REACT_APP_OAI_API_KEY=<configured-value>
REACT_APP_OAI_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
OAI_MODEL=qwen3.5-flash
```

All three are required in the Edge Function environment. The `REACT_APP_` prefix is exposed in a CRA browser bundle, but values configured as Supabase Edge Function secrets remain server-side at runtime. There is no hard-coded or runtime model fallback. Missing configuration returns `AI_PROVIDER_NOT_CONFIGURED` before a provider request.

## Shared Request Boundary

Component 102 retains these pure exports in `tutor-system/src/services/ecologicalTutorCall.ts`:

- `TransferTutorRequestContextV3`
- `TransferTutorRequestV3`
- `buildTransferTutorRequestContextV3`
- `buildTransferTutorRequestV3`
- `buildTransferTutorUserMessageV3`

Production and component 104 serialize through the same builders. The shared module contains no production system prompt, credentials, provider transport, key, learner answer, or grading result. Component 104 owns cases/rubrics, not a copied request schema.

## Production Request

Only `tutor-system/supabase/functions/assessment-api/index.ts` composes the provider request. It uses:

- configured `REACT_APP_OAI_BASE_URL` and exact configured `OAI_MODEL=qwen3.5-flash`;
- the backend-owned transfer-v3 system prompt;
- canonical `TransferTutorRequestV3` user content;
- JSON response mode supported by the DashScope-compatible endpoint;
- `max_tokens: 1200` for tutor decision generation;
- no learner-selected answer IDs, private answer key, evaluator labels, rubric, holdout result, credential, or hidden reasoning request.

## Required Assessment Output

Assessment mode requires the existing private assessment fields plus:

```ts
interface PrivateAssessment {
  selection_type: 'single' | 'multiple';
  stem: string;
  rendered_text: string;
  options: AssessmentOption[];
  correct_option_ids: AssessmentOptionId[];
  learner_safe_explanation: string;
  transfer_basis: TransferBasis;
}
```

The production prompt instructs the model to make `learner_safe_explanation` concise, age-appropriate, grounded in the correct option and question context, free of hidden chain-of-thought, and safe to disclose after terminal failure. Tutoring and Guard modes require `assessment: null`.

Component 101 owns structural/domain validation. Component 104 evaluates semantic correctness, leakage, and explanation quality. Teacher edits are revalidated by component 102 before send.

## Validation and Repair

1. Require successful HTTP status and non-truncated finish metadata.
2. Parse exactly one JSON object and validate the full versioned tutor-decision contract.
3. Validate known item/message IDs, mode/instruction compatibility, options/key cardinality, transfer basis, rendered bounds, and learner-safe explanation.
4. On format/schema failure only, issue at most one repair request using the same configured provider/model and record both attempts in `private.transfer_provider_attempts` through `record_transfer_provider_attempt_v1`.
5. Do not retry network/HTTP failure as a format repair, switch models, infer fields with pattern matching, or create a dummy assessment.

Stable outcomes: `AI_PROVIDER_NOT_CONFIGURED`, `AI_PROVIDER_ERROR`, `AI_OUTPUT_TRUNCATED`, and `AI_OUTPUT_INVALID`. All produce zero delivered assessment, attempt, grade, or progress mutation.

Every attempted provider call records credential-free canonical request metadata, raw response or safe transport error metadata, effective URL/model/token budget, finish reason, validation outcome, and correlation identity before the handler returns. Audit persistence failure returns `PERSISTENCE_FAILED`; it does not return an unrecorded candidate.

## Privacy Evidence

Tests scan provider errors, Edge responses, public DTOs, public/realtime rows, browser source imports/build assets, logs, and exports. Credentials, raw attempts, private rationale, transfer basis, key, and learner-safe explanation must remain absent except the key/explanation in the authorized terminal-failure DTO.
