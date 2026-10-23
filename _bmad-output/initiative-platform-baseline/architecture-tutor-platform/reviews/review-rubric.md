# Review: architecture-tutor-platform.md against the good-spine checklist

Intent: judge the spine for use as the contract that features are checked against. Evidence: the three code sweeps, the PRD, `package.json`. Spine not edited. Reviewed 2026-10-22.

## Verdict

REVISE before approval. The paradigm, the layering table and AD-4, AD-5, AD-6, AD-10 and AD-12 are well grounded in the sweeps and worth keeping. But three ADOPTED rules (AD-1, AD-7, AD-12) are contradicted by sweep evidence, AD-8 and AD-10 state targets the code does not meet, no AD names an enforcement mechanism, and the deployment, provider and environment dimensions are thin. No volatile gap IDs or file:line references appear in the spine (checked by grep); a few smaller volatile items remain (see section 7).

| Checklist item | Result |
| --- | --- |
| Fixes the real divergence points, misses none | Partial. Misses 5 (section 2) |
| Every Rule enforceable and prevents its divergence | Fail for AD-1, AD-2, AD-7, AD-8, AD-12; others pass as stated (section 1) |
| Deferred cannot let units diverge | Fail. 3 rows can (section 3) |
| Named tech verified current | Fail. No currency check; CRA is deprecated (section 4) |
| Ratifies, does not contradict, the brownfield code | Fail. 8 contradictions (section 5) |
| Altitude dimensions decided, deferred or open | Partial (section 6) |
| Claims supported by sweeps | Mostly; 9 unsupported or overstated (section 8) |
| No volatile facts | Mostly pass (section 7) |

## 1. Rules: enforceable, and do they prevent the stated divergence?

No AD says how its rule is checked (a test, a DB privilege, a trigger, a grep). A contract that "new features are checked against" needs one line per AD saying where the check lives. Only AD-10 mentions tests.

- **AD-1 (ADOPTED), fails.** Rule says the client and other code "never update these tables directly". Sweep 3 section 2: `public` tables carry `ALL ... USING true` policies for anon, so any client can update `checklist_items` directly whenever Guard is off. Only the Guard triggers block it, and only while Guard is on. Sweep 3 also lists PUBLIC-callable SECURITY DEFINER RPCs `update_checklist_progress` and `soft_delete_checklist_item` (internal authorization unread), and sweep 2 section 4 shows the legacy browser path running coverage detection and `processStudentMessage` in the browser. So there are other writers today. Either mark AD-1 as a target with a migration step (revoke table writes, retire the legacy RPCs), or state the exceptions. Also "history tables are append-only" is contradicted by `clear_room_chat_history_v1`, which deletes assessments, attempts and messages (sweep 1 section 1, last row).
- **AD-2, partly enforceable.** The routing condition is a client-side `if` in `RoomContext.tsx` (sweep 2 section 4). Nothing server-side stops a client from posting through the legacy path, and the legacy path is not "old rooms only": sweep 2 says it applies to phishing rooms without a transfer checklist and to tutor and other messages in all rooms. "Stays in one place" is satisfied today only by convention.
- **AD-7 (ADOPTED), does not prevent its stated divergence.** Prevents: "a retry, reload or second tab creating a duplicate message". Sweep 1 section 2(e): the client generates a fresh request id per call, so a user retry is a new message; two tabs or a double submit can create two answer messages for one open assessment. The dedupe keys protect server-side replays of the same id, not user retries. The legacy browser insert carries no request id at all. Either the Rule must say the client reuses one id per user intent (and say where it is stored), or the Prevents line must be narrowed to server replays.
- **AD-8, target not ratified.** Rule: "Every tutor-only operation checks `rooms.tutor_id = actor` inside its RPC." Sweep 1 section 2(f) and sweep 3 section 3 list counterexamples: `process_assessment_message_v2` and `cancel_transfer_assessment_v1` check only student id; `get_transfer_message_analysis_context_v1` accepts tutor or author; `assertRoom` is membership; ai-api generic chat has no check; the legacy PUBLIC RPCs are unread. And with open RLS, any "tutor-only" write done as a direct table update (for example `rooms.guard_mode` via `guardModeService.ts`, which filters `tutor_id` in the browser) bypasses SQL ownership checks entirely. The Rule is enforceable only for RPCs, so it must say what protects direct table writes.
- **AD-9 (ADOPTED), enforcement unproven.** "Never changes after creation" has no evidence in the sweeps (sweep 3 shows a CHECK and a default, not an immutability trigger). "Branches nowhere else" conflicts with the eight scattered branches the spine itself defers.
- **AD-11, mostly sound.** The handshake is real (sweep 3 section 1, section 7). But the Rule omits that the value is the single literal `cyberbullying-v2` gating all traffic, practice-specific in name only. A reader cannot tell what "bump the contract version" means concretely.
- **AD-12 (ADOPTED), too narrow.** "Nothing secret in a public table" names only the answer key and learner explanation. `public.ai_suggestion_feedback` stores `raw_*` fields and `generation_provenance`, `rooms.ai_assistant_prompt` is public, and NFR-3 says raw AI output must never be visible to participants. With open RLS those are readable by anyone with the anon key. Define "secret" by reference to NFR-3 and list what is in or out.
- **AD-3, AD-4, AD-5, AD-6:** supported by sweep 1 and enforceable as stated (single functions, triggers, unique indexes). AD-5 states catch-up as the mechanism for un-graded answers, but sweep 1 marks "whether the live client always runs catch-up" UNCONFIRMED.

## 2. Divergence points missed

1. **Who writes `rooms.guard_mode`.** Sweep 1 says only `send_reviewed_tutor_response_v4` writes it; sweep 2 says `guardModeService.ts` writes it from the client. The sweeps disagree, and AD-5 builds on Guard without naming its single writer. This is the most important gap, since Guard gates grading and progress.
2. **Who writes `rooms.transfer_learning_enabled`.** Unowned (sweep 1). AD-6 depends on its behavior. It appears in the memlog's deferred list but not in the spine's Deferred table.
3. **Identity derivation and lifecycle.** Only AD-8 covers identity, and it covers authorization. Sweep 2 section 3 shows the id is a 32-bit non-cryptographic hash of normalized name and role, role switch keeps the id but breaks `hash(name, role)`, re-join with a new name or role creates a new user, and the same name and role on two devices collide by design. Any new client or service minting ids would diverge. Needs an AD naming the single generator.
4. **Learner seat and room roles.** NFR-2 says the learner seat is decided on the server (`join_room_v1`, one active learner, later joiners are observers). No AD owns this, and the client keeps an observer flag in sessionStorage. The Capability map points to AD-8 only.
5. **Client route and role guarding.** The scope says "routing", but the spine covers message routing only. `App.tsx` has no route-level role guard (sweep 2 section 1). Decide or defer explicitly.

Also unaddressed: the ai-api error envelope. Spine's convention says responses are `{ok, data}` / `{ok:false, error}` for "Edge Function"; ai-api errors are `{error:{code}}` with no `ok` and no message (sweep 3 section 1). That is a real divergence between the two functions.

## 3. Deferred items that could let two units diverge

- **Owner checks on the remaining RPCs.** Parked in "the addendum", but any new RPC written in the meantime has no tracked rule other than AD-8. Acceptable only if AD-8 is reworded as a rule for new code ("new RPCs check ownership; legacy list is in the addendum").
- **Timeouts and retries on AI calls.** Two functions each make a raw `fetch` with no abort (sweep 3 section 4); a new AI job will pick its own policy. Decide a default now (one sentence).
- **One seam for practice-type branching.** Fine to defer, but AD-9 says "nowhere else", which is already false.
- **Missing from Deferred:** generic ai-api chat with no identity or role check and `verify_jwt:false`. That means anyone with the anon key can spend the provider key; this is a cost and abuse exposure the spine never states. Put it under Deferred or Open question, with the pilot rationale. Likewise the unowned `transfer_learning_enabled` writer.
- "Rate limiting, audit trail, observability: Not needed for the pilot" is a decision, not a deferral, and conflicts with the sweep's finding that provider attempts are already audited (`transfer_provider_attempts`). Reword.

## 4. Named tech, "verified current"

Stack table is copied from `package.json` (versions match: React ^18.2.0, TS ^4.9.5, react-scripts 5.0.1, router ^6.20.1, supabase-js ^2.39.0, RTL ^13.4.0, jest-cucumber ^4.5.0). Matches the repo, but nothing shows currency was checked.

- Create React App is deprecated and unmaintained; the spine commits to it without saying so. Record as ratified-with-known-debt, or as an open question.
- TypeScript 4.9 and supabase-js 2.39 are old releases; the Edge Functions pin 2.39.0 via esm.sh (an external CDN dependency at runtime). Version-pin policy for the Deno side is not stated.
- Unlisted but load-bearing: Deno runtime version for Edge Functions, Node version for CI, promptfoo (cited in the tree), GitHub Actions. The model names (qwen3.8-flash and qwen3.5-flash) are absent; "models set in shared config" is false for assessment-api (section 5).

## 5. Contradictions with the brownfield code

1. Stack says "models set in shared config"; AD-10 says model configuration lives in `src/` and is imported by Edge Functions. Sweep 3 section 4: assessment-api hardcodes `PROVIDER_MODEL='qwen3.5-flash'` while ai-api imports `DEFAULT_AI_MODEL='qwen3.8-flash'`; two models in use.
2. Conventions: `x-application-user-id` on "every call to an Edge Function". Sweep 2 section 3: the generic `invokeAiApi` call sends no such header.
3. Dependency direction: "pages → components → contexts and hooks → services". Sweep 2 section 1: `contexts → components` (`RoomContext` imports from `AISuggestionBox`), `hooks → contexts`, `types → services`, `utils → services`. Either ratify with the exceptions or list them as debt.
4. AD-1 and AD-7 (above).
5. Edge Function envelope (above, ai-api).
6. Errors: "A thrown error carries a code". Sweep 2 section 5: codes are embedded in message strings in contexts (`ASSESSMENT_OPTIONS_REQUIRED: ...`); only the assessment service throws a typed error.
7. "Fail visibly (NFR-7)". Sweep 2: poll errors are logged and swallowed; on user-sync failure the local copy is kept silently. State these as accepted exceptions or the convention is aspirational.
8. Conventions: 2-space indentation is in AGENTS.md; sweep 2 shows mixed 4-space files. The spine is silent; fine if intended, but the naming row implies uniformity.

## 6. Altitude dimensions

- **Deployment.** Release row covers order and gates. Missing: where the React client is hosted and how it is released (HashRouter implies static hosting; not stated anywhere in the sweeps either, so ask the owner). Sweep 3 section 6: the deploy workflow targets staging only, production is a manual release-owner action, and Edge Functions deploy with `--no-verify-jwt`. None of that is in the spine; the `verify_jwt:false` choice is a deliberate security posture that belongs next to AD-8.
- **Environments.** Two project refs listed. Not stated: the checked-in `tutor-system/.env` targets production, so a default local run writes to production; the secret list (`OAI_API_KEY`, `OAI_BASE_URL`, `TRANSFER_ASSESSMENT_ENABLED`, service key) and who holds it; the operator flag and the `PRACTICE_MAINTENANCE` close in `private.practice_write_gate`.
- **Provider strategy.** "One OpenAI-compatible gateway" is stated. Missing: which model each job uses and the policy for changing it (PRD NFR-10 requires re-evaluation per practice type), the failure stance (503 on missing config, repair retry once), no timeout, and no fallback provider. Decide or defer each in one line.
- **Operations.** Observability, audit and rate limiting are waved off. No statement on backup/restore, migration source of truth (SQL applied via MCP/Management API, not CLI history; `supabase/migrations/` is empty, `archived_migrations/` holds the applied files), or incident handling. At minimum list them as deferred with a trigger.
- **Data.** RLS posture ("public tables open to every client, only `private` closed") is the single most consequential data decision and is mentioned only as a clause inside AD-12. Promote it to its own line in the Paradigm or Conventions, tied to NFR-4.

## 7. Volatile facts in the spine

No gap IDs (G-nn) and no file:line references. Remaining items that will go stale:
- RPC version suffixes in Rules (`send_reviewed_tutor_response_v4`, `process_assessment_message_v2`): the Naming convention says replaced RPCs get new suffixes, so every ADs mentioning one is stale at the next bump. Name the role ("the reviewed-send RPC"), list current names in the Capability map or code.
- "about eight client places" (Deferred): a count; the addendum or sweep owns it.
- Full Stack version table: duplicates `package.json`. Keep names and major versions, or point to the file.
- "R1" and FR/NFR cross-references are stable PRD IDs and acceptable.

## 8. Claims not supported by the sweeps (or overstated)

1. "Browser-side judging path serves old rooms only" (AD-2, Deferred): contradicted by sweep 2 (phishing rooms without transfer checklist, all tutor messages).
2. "five shared targets" (AD-9): not in any sweep.
3. `rooms.practice_type` "never changes" (AD-9): no enforcement evidence.
4. `evals/` with promptfoo and "transfer-assessment" (Structural Seed): not in any sweep.
5. "Edge Functions may import shared rule modules from `src/` and nothing else from the client": sweep lists seven imports; "nothing else" is not verified and not enforced.
6. AD-10 "contract tests covering both" (SQL and TS transitions): sweep 3 section 7 lists API-contract and decision-contract tests and a catalog contract SQL test; none is shown to cover the SQL transition mirror.
7. AD-5 "Un-graded answers are processed afterwards by client catch-up": sweep marks always-runs UNCONFIRMED.
8. AD-8 "accepted for the pilot" cites NFR-4, which is correct, but the Rule's claim that Edge Function checks are "convenience, never the control" is untrue for `assertTeacher` operations that have no SQL owner check on some paths (sweep 1 section 2(f) table, right column).
9. State diagram omits `legacy_incomplete` (sweep 1) and shows Guard-race outcomes only in prose; low impact.

## Recommended changes (priority order)

1. Add one "Check" line per AD (where the rule is verified). Reclassify AD-1, AD-7, AD-12 from ADOPTED to target, or fix their rules to match the code.
2. Add ADs for Guard writer and `transfer_learning_enabled` writer, identity generation, and learner seat.
3. Rewrite AD-8 as a rule for new RPCs plus an explicit statement of the open-RLS posture and `verify_jwt:false`.
4. Move the generic ai-api exposure and the unowned flag into Deferred or Open questions.
5. Fix AD-10 / Stack on the model config, the envelope convention, the header convention, and the dependency-direction exceptions.
6. Add short Deployment, Environment, Provider and Operations lines; ask the owner about client hosting and the CRA position.
7. Remove version suffixes and counts from Rules and Deferred.
