# Code sweep 3: server and data architecture

Intent: code-evidenced facts for the architecture document. Paths are relative to `tutor-system/`. "LIVE" = Supabase MCP read-only query against production (`zgbufaxooqxeabewktzd`) on 2026-10-22. UNCONFIRMED marks gaps.

## 1. Edge functions

Deployed (LIVE list_edge_functions): `ai-api` v5 and `assessment-api` v17, both ACTIVE, `verify_jwt:false`. Deploy workflow passes `--no-verify-jwt` (`../.github/workflows/deploy-assessment-api.yml:87,93`).

Common to both
- Only POST and OPTIONS; OPTIONS returns 204. CORS is wildcard: `Allow-Origin: *`, allowed headers include `x-application-user-id, x-practice-contract` (`ai-api/index.ts:28-32`, `assessment-api/index.ts:75-79`).
- Every POST must carry `x-practice-contract: cyberbullying-v2`, else 409 `CLIENT_RELOAD_REQUIRED` (`ai-api/index.ts:233`, `assessment-api/index.ts:641-643`). The client sets it globally (`src/services/supabase.ts:14`), the server RPC clients re-send it (`ai-api/index.ts:274`, `assessment-api/index.ts:478`), and SQL re-checks it via `private.assert_practice_contract()` against `private.practice_write_gate.required_contract` (LIVE). The gate also supports a maintenance close (`PRACTICE_MAINTENANCE`).

ai-api (`supabase/functions/ai-api/index.ts`)
- Two shapes on one endpoint. (a) Generic chat: body `{messages[], temperature?, max_tokens?, response_format?, enable_thinking?}`, response `{ok:true,data:{content,model,finish_reason}}` (`:58-103,123-150`). (b) Operation `cyberbullying_suggest` with `{operation, room_id, parent_message_id?, character?}` (`:171-227`). It is the only named operation.
- Error shape is `{error:{code}}` with no `ok:false` and no message (`:46-48`). Status mapping at `:248-260`: 400 INVALID_REQUEST, 413 CONTEXT_TOO_LARGE, 403 FORBIDDEN/UNAUTHORIZED, 409 CLIENT_RELOAD_REQUIRED/PRACTICE_MAINTENANCE, 502 provider/output, 503 not-configured/persistence.
- Identity: only the cyberbullying path reads `x-application-user-id` (UUID shape check, `:173-175`). The generic chat path has no identity or ownership check, and `verify_jwt` is off. UNCONFIRMED whether the Supabase gateway still demands an `apikey` header (`apikey` is allowed in CORS).

assessment-api (`supabase/functions/assessment-api/index.ts`)
- Envelope: POST `{operation, request_id, ...}`. Operations: `initialize_checklist, join_room, edit_learning_progress, post_message, analyze_message, prepare_turn, send_reviewed, read_review, process_message, clear_chat_history` (`:18-21`). Missing `request_id` returns INVALID_REQUEST (`:652`).
- Success is `{ok:true,data}`. Failure is `{ok:false,error:{code,message,retryable}}`, with the status taken from the `ERROR_STATUS` table of about 24 codes (`:82-108`). Unknown codes fall to PERSISTENCE_FAILED/500.
- Identity: `x-application-user-id` must be a UUID. The verifier loads the `users` row (must be `status=active`), then the active `sessions` rooms for that user, plus rooms where `tutor_id` equals the user (`:803-830`). It returns `allowed_room_ids` and `can_review_assessment = (current_role==='tutor')`. This is a client-asserted ID, not a JWT. UNCONFIRMED: whether any other layer authenticates the caller.
- Feature flag: `TRANSFER_ASSESSMENT_ENABLED` (default true) blocks every operation except `clear_chat_history` (`:668,835`).
- Responses are projected server-side, so assessment answers and correct options are not leaked to learners (`projectMessage`, `projectProcessed`, `:166-215`).

## 2. Data model

Live tables (LIVE). `public` (RLS on for all): `users, rooms, sessions, messages, message_feedback, ai_suggestion_feedback, ai_assistant_configs, ai_assistant_config_logs, room_templates, template_items, tutor_images, session_checklists, checklist_items, checklist_configs, checklist_templates, checklist_updates, coverage_evidence`. `private` (RLS on, 0 policies): `learning_event_inbox, transfer_assessments, transfer_assessment_attempts, transfer_assessment_processing, transfer_provider_attempts`. `private.practice_write_gate` has no RLS.

Core relations (LIVE columns)
- `users(id, email, display_name, current_role, status)`. `rooms(id, tutor_id, practice_type, scenario_config, guard_mode, transfer_learning_enabled, ai_assistant_enabled, ai_assistant_model, is_active, ...)`.
- `sessions(room_id, tutor_id, student_id, status)`: one active learner per room, enforced by `join_room_v1`; later joiners get `room_role:'observer'`.
- `messages(room_id, user_id, user_role, parent_message_id, response_mode, guard_mode, character, persona_*, assessment_* ...)`: assessment lifecycle is embedded in messages (`assessment_event` JSON).
- Ratings: `message_feedback(message_id, user_id, rating, feedback_type)`.
- AI suggestion tracking: `ai_suggestion_feedback(room_id, tutor_id, parent_message_id, ai_suggestion, tutor_action, tutor_final_response, raw_*/final_* character/guard_mode, contract_version, generation_provenance, assessment_id)`.
- Learning targets and progress: `session_checklists(room_id, student_id, progress_policy_version, target_version) -> checklist_items(status, understanding_level, target_key) -> coverage_evidence(message_id, event_id, assessment_id)`. Transitions live in `src/services/learningProgressTransitions.ts` (client and server share it).
- Assessments: `private.transfer_assessments / _attempts / _processing / transfer_provider_attempts` (an audit of raw provider payloads).

RLS posture (LIVE `pg_policies`): on `users, rooms, sessions, messages, message_feedback, ai_suggestion_feedback`, there is an `ALL ... roles {public} USING true` policy ("Allow ... operations"). Any anon-key holder can read and write these tables directly. Only `private.*` is closed. Security therefore rests on the RPCs and Edge Functions, not on RLS, for the new flows. A SQL write gate trigger (`private.check_practice_write_gate`) also checks the contract header on writes.

RPCs (LIVE `prosecdef`, EXECUTE grants)
- `service_role` only (anon/authenticated denied): `join_room_v1, initialize_transfer_checklist_v1, edit_room_checklist_v1, post_assessment_message_v2, process_assessment_message_v2, get_cyberbullying_context_v1, get_transfer_*_v1, prepare_transfer_*_v1, record_transfer_*_v1, send_reviewed_transfer_assessment_v1, send_reviewed_tutor_response_v4, apply_learning_event_v1, apply_transfer_message_analysis_v1, cancel_transfer_assessment_v1, clear_room_chat_history_v1`. These are reached only via the Edge Functions' service key.
- Legacy and `PUBLIC`-callable SECURITY DEFINER (anon and authenticated can EXECUTE): `add_conversation_context, create_room_template, extract_checklist_from_prompt, get_room_templates_by_tutor, initialize_ai_assistant, initialize_checklist_from_template (x2 overloads), initialize_cyberbullying_progress_v1, send_reviewed_tutor_response, soft_delete_checklist_item, update_checklist_progress`. Their internal authorization was not read (UNCONFIRMED).
- `private.*` helpers are not executable by client roles. `process_assessment_message_v1` and `send_reviewed_tutor_response_v3` are executable by nobody (superseded).

## 3. Ownership and role checks

- assessment-api: `assertRoom` (room must be in the principal's `allowed_room_ids`) runs on every room operation. `assertTeacher` (`current_role==='tutor'`) runs on `read_review, clear_chat_history, initialize_checklist, edit_learning_progress, prepare_turn, send_reviewed` (`:340-440`). Learner-capable operations (`post_message, process_message, join_room`) use the room check plus `join_room_v1`, which requires an active student. `analyze_message` has an `assertRoom` check but no `assertTeacher` check.
- Weak point: `allowed_room_ids` includes a room if the user is `tutor_id` or in an active session, so a tutor in a room is accepted by the room check alone. No finer distinction was found (UNCONFIRMED in the SQL RPC bodies). The caller identity comes from a header.
- ai-api cyberbullying: ownership is checked in SQL. `get_cyberbullying_context_v1` requires `rooms.tutor_id = p_actor_id`, an active room, `practice_type='cyberbullying'`, and an active tutor user. It also needs `ai_assistant_enabled` (LIVE def).
- ai-api generic chat: no ownership or role check.
- Direct table access: not restricted (see RLS).

## 4. AI provider integration

- One OpenAI-compatible gateway: POST `{OAI_BASE_URL}/chat/completions` with `Bearer OAI_API_KEY`. Both secrets are Edge env (`ai-api/index.ts:105-110`, `assessment-api/index.ts:322-326`); missing returns 503 `AI_PROVIDER_NOT_CONFIGURED`. Calls are a plain `fetch` with no timeout or `AbortSignal` (UNCONFIRMED beyond a grep of both files).
- Models: ai-api uses `DEFAULT_AI_MODEL='qwen3.8-flash'` (`src/services/aiModels.ts:18`). assessment-api hardcodes `PROVIDER_MODEL='qwen3.5-flash'` (`index.ts:24`). Two models are in use, which `src/services/README.md:16` acknowledges.
- Limits: ai-api allows at most 30 messages, 50,000 chars per message and in total, `max_tokens` up to 2000 (default 100), temperature 0-2 (`:34-37`). Cyberbullying uses temperature 0.7, 2000 tokens, `json_object`, `enable_thinking:false`, and a single repair retry (2 attempts) (`:194-217`). Truncation (`finish_reason=length`) raises `AI_OUTPUT_TRUNCATED`. assessment-api uses `PROVIDER_MAX_TOKENS=1200`, and analysis uses 600.
- Feature flags and env: `TRANSFER_ASSESSMENT_ENABLED`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OAI_*`.
- Prompts: cyberbullying system prompt and parser in `ai-api/cyberbullying.ts` (pinned source commit `89e7fda`, prompt version `copilot-89e7fda-supervised-v2`). Transfer assessment and analysis prompts are inline constants in `assessment-api/index.ts:27-60`, with prompt owner constants in `src/services/prompts/transferV3Prompt.ts`. Phishing tutor prompts are built client-side (`src/services/aiService.ts`) and sent as generic chat messages. The per-room prompt is stored in `rooms.ai_assistant_prompt` and `ai_assistant_configs`.
- Audit: each provider attempt is persisted with request hash and raw response (`record_transfer_provider_attempt_v1`; `generation_provenance` on `ai_suggestion_feedback`).

## 5. Practice-type branching

- DB: `rooms.practice_type` and `room_templates.practice_type` are `text NOT NULL DEFAULT 'phishing' CHECK IN ('phishing','cyberbullying')` (`supabase/archived_migrations/20261021000000_cyberbullying_practise.sql:19-21`). `scenario_config` holds the cyberbullying scenario.
- Server: branching is hard-coded in SQL (`join_room_v1` calls `initialize_cyberbullying_progress_v1` when `practice_type='cyberbullying'`; `get_cyberbullying_context_v1` rejects other types) and in ai-api (a dedicated operation plus `cyberbullying.ts`). Phishing has no server operation: it uses generic chat from the client.
- Client: `src/services/aiService.ts:883` branches on `roomData.practice_type`; `src/pages/TutorView.tsx` sets it at room creation.
- New practice type: it would need a CHECK constraint change (migration), a context RPC, a prompt and parser module, an ai-api operation, a client branch and a join-time initializer. There is no registry or plugin point (the dispatch is a hard-coded if/switch).

## 6. Environments and release

- Production `zgbufaxooqxeabewktzd`, staging `ciubrzggdqesgvfkpolj`; the checked-in `.env` targets production (`../AGENTS.md`).
- Migrations: the live folder `supabase/migrations/` does not exist right now (0 pending); `supabase/archived_migrations/` holds 75 files. Rule is at most one pending SQL file, archive only after both projects verify (`docs/supabase-release-workflow.md:36,61,260`). The schema is not driven by the Supabase CLI history; SQL is applied through MCP/Management API.
- Order: SQL before the dependent Edge Function, staging then production, with a merge-into-`no_sign_up` gate before any production mutation (`docs/supabase-release-workflow.md:65-73,107-109,258-260`).
- Coordination: `scripts/staging-coordination.js` creates the git tag `refs/tags/verification-locks/<project-ref>` as a lease, held through deploy and acceptance; child tools use `PTP_COORDINATION_LEASE` (`docs/agent-coordination.md`). The Actions workflow adds a concurrency group `supabase-staging-ciubrzggdqesgvfkpolj`.
- Secrets: set via `supabase secrets set --env-file` from GitHub secrets in the workflow (`OAI_API_KEY`, `OAI_BASE_URL`, `TRANSFER_ASSESSMENT_ENABLED=true`); names only are recorded. The workflow deploys both functions with `--use-api` to avoid Docker. The workflow `deploy-assessment-api.yml` targets staging only; production deploy is manual through the release owner (no workflow found).

## 7. Shared contracts

- Edge Functions import `src/` modules directly: `aiModels.ts`, `transferAssessmentOrchestrator.ts`, `ecologicalTutorCall.ts`, `assessmentValidation.ts`, `assessmentAnswerParser.ts`, `assessmentRendering.ts`, `learningProgressTransitions.ts` (`assessment-api/index.ts:6-16`). Client and server therefore compile the same source and are deployed as a function bundle with those files; a frontend change to these files requires an Edge redeploy (the release manifest hashes function source "including imported dependencies").
- Version gate: a single header value `cyberbullying-v2` is the only runtime contract version, enforced in Edge and SQL (`private.practice_write_gate.required_contract`), producing `CLIENT_RELOAD_REQUIRED` for stale clients. The name is practice-specific but gates all traffic including phishing.
- Documented contracts: `docs/ai-behaviors/tutor-response-contract.md` (v2 decision shape, versioned by contract/evaluation version) and `docs/ai-behaviors/transfer-status-response-contract.md`. Client parser `src/services/tutorDecisionContract.ts`. Sync is by tests: `src/services/__tests__/transferAssessmentApiContract.test.ts`, `tutorDecisionContract*.test.ts`, `supabase/tests/transfer_assessment_catalog_contract.sql`, plus Edge unit tests `supabase/functions/*/index.test.ts`. No generated shared schema or OpenAPI was found. DB types are in `src/types/database.ts` (generation process UNCONFIRMED).
