# Documentation Update Record

Intent: record the documentation changes for moving browser LLM requests behind Supabase Edge Functions with server-only provider credentials.

Date: 2026-10-03
Commit: 3fabb53

Updated `README.md`, `claude_docs/aiService.md`, `claude_docs/supabase-service.md`, `claude_docs/README.md`, and `claude_docs/ai-behaviors/tutor-response-contract.md` to document the `ai-api` boundary and server-only `OAI_API_KEY`, `OAI_BASE_URL`, and `OAI_MODEL` secrets.

## Release Evidence

- Local Deno tests: `ai-api` 7 passed; `assessment-api` 18 passed.
- Staging project: `ciubrzggdqesgvfkpolj`.
- Staging deployment: current worktree deployed through `supabase functions deploy --use-api` for `ai-api` and `assessment-api`; `ai-api` uses `--no-verify-jwt` for offline sessions.
- Staging secrets: `OAI_API_KEY`, `OAI_BASE_URL`, `OAI_MODEL=qwen3.5-flash`, and `TRANSFER_ASSESSMENT_ENABLED=true` configured without recording values.
- Staging boundary check before the offline-auth change: `POST /functions/v1/ai-api` with an anon key returned HTTP 401 `{\"error\":{\"code\":\"UNAUTHORIZED\"}}`.
- Offline-auth change: `ai-api` now accepts localStorage/offline-session requests without Supabase Auth, while retaining strict payload validation and server-only provider secrets. The gateway deployment must use `--no-verify-jwt`.
- Staging live check after redeployment: unauthenticated POST with the staging anon key returned HTTP 200 and provider content `OK`; no Supabase Auth JWT was used.
- Production deployment: current `ai-api` and `assessment-api` deployed through the API path with `--no-verify-jwt` for the offline-session model.
- Production live check: unauthenticated POST with the production anon key returned HTTP 200 and provider content `OK`; no Supabase Auth JWT was used.
- Status: `production verified` for the Edge Function boundary and provider response. The full browser fixture workflow was not run because its service-role cleanup credential is not configured locally.
