# Plan: Move the LLM API Key Off the Browser

## Intent

Stop shipping the DashScope/Qwen API key to the browser, so that the deployed bundle contains no
provider credential and an extracted key cannot be used to bill the project.

## Current State (verified, not assumed)

The key is live-leaked, not merely "at risk":

- `tutor-system/build/static/js/main.08d27d7c.js` contains the real key string verbatim. CRA inlined
  it at build time. The file is gitignored, so it never reached git history — but every deploy has
  served it to every visitor.
- `src/services/aiService.ts:63` reads it; lines `558` and `667` are the **only two real outbound
  LLM calls in the app**. Both are `fetch` to Qwen, both with `Authorization: Bearer <key>`.
- `src/services/llmExtractionService.ts:29` reads the key too, but only as a boolean gate — it does
  not fetch. It fails closed to empty results without the key.
- `src/services/aiService.original.ts` has two more fetches, but nothing imports that file.
- No real auth exists: no `signInAnonymously`, no Supabase session, no `access_token`. Every request
  goes out as the `anon` role holding the publishable key.

## Key Realisation: The Pattern Already Exists In This Repo

`supabase/functions/assessment-api/index.ts` is a deployed, working Supabase Edge Function that:

- reads the provider key from `Deno.env.get('REACT_APP_OAI_API_KEY')` (lines 255, 347) — server-side,
- calls Qwen with `fetch` (lines 270, 351),
- validates the model output structurally before persisting (`assertV3DraftShape`),
- is invoked from the browser via `supabase.functions.invoke('assessment-api', { body })`
  (`src/services/transferAssessmentService.ts:97`).

So the transport, the Deno runtime, the CLI (`supabase` 2.30.4), and `supabase/config.toml` are all
already in place. **Nothing new needs to be invented — only a minimal second function extracted.**

## Decision: New Minimal `llm-proxy`, Not an Extension of `assessment-api`

`assessment-api` is 544 lines of transfer-assessment domain logic with an 11-operation dispatch and
its own auth model. Two call sites do not justify folding general chat proxying into it. Create a
sibling function of ~80 lines.

## The Hard Constraint to Accept Up Front

Because the app has no server-verifiable identity, a proxy **cannot authenticate its caller**. An
open proxy that forwards to Qwen is still abusable — just not with a stolen permanent key. Two
honest options:

| Option | Cost | Effect |
|---|---|---|
| **A. Ship unauthenticated proxy** | ~2h | Key off the client. Endpoint is open to abuse by anyone who finds the URL. Mitigate with server-side allowlist + caps. |
| **B. Fix identity first** | days | Real abuse control. Requires reworking the app's whole identity model. Out of scope here. |

This plan does **A**, with the server-side constraints below made non-negotiable, and records **B**
as the real fix. Do not describe option A as "secure" in any doc.

## Steps

### 1. Rotate the key first (do this before any code)

The current key is in a served bundle. Create a new key in the DashScope console, and treat the old
one as public. Code changes below do not un-leak it.

### 2. Create `supabase/functions/llm-proxy/index.ts`

Follow the shebang + purpose-comment convention and the response envelope already used by
`assessment-api` (`{ ok: true, data }` / `{ ok: false, error: { code, message, retryable } }`).

Responsibilities, and nothing else:

- `POST` only; `OPTIONS` returns CORS headers; anything else is `METHOD_NOT_ALLOWED`.
- Read `LLM_PROVIDER_KEY`, `LLM_PROVIDER_BASE_URL`, `LLM_PROVIDER_MODEL` from `Deno.env`. **Use new
  non-`REACT_APP_*` names.** The `REACT_APP_` prefix is what causes CRA to inline a variable into
  the client bundle; a server-only variable must not carry it. (`assessment-api` gets this wrong
  today — copy its transport, not its env naming.)
- Accept from the client only: `messages`, `temperature`, `max_tokens`, `response_format`.
  Everything else — model name, base URL, `Authorization` — is decided server-side and never
  accepted from the request body.
- Pass the provider response through **unchanged** in shape, so the two call sites need no parsing
  changes.
- Map provider failures to `AI_PROVIDER_ERROR` / `AI_OUTPUT_INVALID` exactly as `assessment-api`
  does at lines 285-293.

### 3. Make the proxy un-abusive

Server-side, not client-side, since the client is untrusted:

- Allowlist the model — one entry, `qwen3.5-flash`.
- Clamp `max_tokens` to the server maximum and ignore client values above it.
- Reject requests whose `messages` payload exceeds a size ceiling.
- Rate-limit per IP. Supabase does not offer this natively at the function layer, so a small
  Postgres counter table checked inside the function is the simplest sufficient mechanism.

### 4. Rewire the two browser call sites

Both in `src/services/aiService.ts`, both keep their current function signatures and error
semantics so callers and tests are unaffected:

- Line **558** — `QwenService.generateResponse`.
- Line **667** — `TutorSuggestionService.generateSuggestion`.

Replace each `fetch` with `supabase.functions.invoke('llm-proxy', { body })` wrapped in the same
try/catch and the same `Qwen API error: <status> - <body>` error string, so the retry logic
(`MAX_TUTOR_DECISION_ATTEMPTS`, `isTutorDecisionFormatError`) and the existing failure tests keep
working.

### 5. Delete the key from the client surface

- Remove `getOAIAPIKey()` (`aiService.ts:63`) and `OAI_BASE_URL` (`aiService.ts:64`).
- Delete `aiService.original.ts` — unimported, and it holds two more copies of the leak.
- In `llmExtractionService.ts`, replace the `hasQwenKey` boolean with a proxy-reachability flag, or
  simply attempt the call and keep its existing empty-result fallback.
- Fix `shouldAllowDummyAISuggestions()` (`aiService.ts`), which currently branches on
  `!getOAIAPIKey()`. It must not silently change behaviour once the client key is gone.
- Remove `REACT_APP_OAI_API_KEY` and `REACT_APP_OAI_BASE_URL` from `tutor-system/.env.example`, and
  remove `SUPABASE_ACCESS_TOKEN` while there — a management credential has no business in a
  frontend env file.

### 6. Keep the eval and script paths working

These run in Node on a developer machine, not in a browser, so reading a local key is legitimate and
must **not** be routed through the proxy:

- `evals/promptfoo/v1/runner.js:37`
- `tutor-system/scripts/run-promptfoo-eval.js:39,178`
- `tutor-system/scripts/browser-demo-tutor-behavior.js:102`

Leave them reading the local key. Update `evals/promptfoo/README.md:71` to say the key is now needed
only for offline evaluation, not by the app.

### 7. Deploy and verify

- `supabase functions deploy llm-proxy`
- Confirm `supabase/config.toml` needs no `[functions.llm-proxy]` entry, or add `verify_jwt = false`
  if the default JWT check rejects the `anon`-key Bearer token. **Verify this explicitly** — it is
  the one step most likely to fail silently, and the same unresolved question already affects
  `assessment-api`, which has no config entry despite requiring a real user JWT it can never
  receive.
- Verify the leak is closed: `npm run build`, then confirm the key string is absent from
  `build/static/js/*.js`. This is the acceptance test for the whole plan.

### 8. Update docs

Per repo convention, update the doc closest to the change with date and commit ID:

- `claude_docs/aiService.md` (lines 224, 323 currently document the client-side key),
- `claude_docs/README.md:210` (troubleshooting entry),
- `claude_docs/doc_update_record/documentation_update_record_v<date>_llm_proxy.md`.

## Evidence That the Request Is Met

The plan is complete only when all three hold:

1. `grep -r "<new key>" tutor-system/build/` returns nothing after a production build.
2. `grep -rn "REACT_APP_OAI_API_KEY" tutor-system/src/` returns nothing.
3. A tutor can still generate an AI suggestion in a real room, and the existing
   `aiService.guardMode` / `aiService.externalFailure` / `aiService.authFallback` suites pass.

## Explicitly Out of Scope

- Giving the proxy real caller identity (option B above). Record it as follow-up; without it the
  proxy is open by design.
- The dead `postgres_changes` subscription on `messages`, the `RoomContext` god object, the
  duplicated `Room` types, and the three-schema migration mess. Separate work.
- `functions/` (the Firebase stub). It never ran; delete it in a cleanup pass, not here.
