<!-- Intent: record the identity, provider configuration, and verification guidance for the assessment API deployment. -->

# Assessment API deployment documentation

## Date

2026-09-29

## Scope

- Document application identity through `x-application-user-id` without Supabase Auth.
- Clarify where the Edge Function reads provider values and how the feature flag is enabled.
- Correct the Deno import guidance for shared TypeScript modules.

## Evidence

- Focused TypeScript check passed for the shared assessment resolver and provider request builder modules.
- CRA production build completed successfully with existing unrelated lint warnings.
- This documentation record does not claim hosted deployment or endpoint verification.
