---
title: Load AI model from environment configuration
type: bugfix
created: 2026-11-13
status: in-progress
baseline_commit: 878ed465823959517bb68398b05ee08b90958b24
context: []
---

<frozen-after-approval reason="human-owned intent">

## Intent

**Problem:** The frontend model registry hard-codes qwen3.8-flash. Both ai-api and assessment-api import that default, overriding the documented server OAI_MODEL setting.

**Approach:** Require OAI_MODEL in Edge provider configuration and bridge OAI_MODEL to public frontend catalog metadata during the build; remove DEFAULT_AI_MODEL entirely. Remove hard-coded model selection and ensure audit provenance records the actual configured provider model.

## Boundaries & Constraints

**Always:** Keep provider credentials server-side; reject missing or whitespace-only model configuration. Preserve existing request, authorization, and assessment contracts. Follow repository staging and production delivery gates.

**Ask First:** Changes to unrelated provider or assessment behavior.

**Never:** Fall back to a hard-coded model or modify unrelated untracked files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Configured | Nonempty model setting | Requests and provenance use the configured model | Existing transport handling |
| Missing | Undefined or whitespace setting | No provider request | Explicit configuration error |
| Alternate model | Different configured model identifier | Catalog and provider accept configuration without source edits | Existing transport handling |

</frozen-after-approval>

## Code Map

- `tutor-system/src/services/aiModels.ts`: frontend catalog/default, currently also imported by Edge handlers.
- `tutor-system/supabase/functions/ai-api/index.ts`: provider config, generation and attempt provenance.
- `tutor-system/supabase/functions/assessment-api/index.ts`: assessment provider config.
- `tutor-system/.env.example`: documented runtime settings.

## Tasks & Acceptance

**Execution:**
- [ ] Update frontend registry and environment examples for REACT_APP_OAI_MODEL.
- [ ] Remove frontend default imports from both Edge handlers; require server OAI_MODEL and use it consistently in requests and audit records.
- [ ] Update focused frontend and Edge tests to verify alternate models and absent configuration.
- [ ] Document configuration and release evidence; owner: root/Codex. Acquire staging lease before hosted mutations.
- [ ] Verify candidate on staging, merge into no_sign_up under repository gates, and promote identical committed artifacts to production.

**Acceptance Criteria:**
- Given configured model variables, when frontend and Edge execute, then each uses its environment setting without a source-coded model fallback.
- Given missing server configuration, when either endpoint generates, then it fails before calling the provider.
- Given the integrated release, when scoped live checks run on staging and production, then provider responses and recorded provenance identify the configured model and temporary fixtures are cleaned up.

## Spec Change Log

## Verification

- Run focused frontend model/service tests and both Edge handler suites, including alternate-model and missing-setting cases.
- Run frontend production build with explicit model configuration.
- Edge-only release: no schema migration or database export/restore. Verify configured-model generation through both affected endpoints and persisted audit provenance on staging and production; preserve artifact hashes and cleanup evidence in dated release record.
- Inherited dependencies: existing provider credentials, endpoints, and released database contracts; release owner root/Codex verifies preconditions without changing them.
