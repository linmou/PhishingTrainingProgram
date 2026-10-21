# Assigned Approach

Intent: implement Cyberbullying practise through an authoritative server operation boundary, preserving shared participation, review, progress, and publication behavior.

Approach: **server-owned-practice-orchestration**. Establish database contracts and a trusted `practice-turn` Edge API first; wire the shared client to that API last. The server loads room identity, membership, saved context, and configuration before dispatching an operation. This concentrates authorization and provenance while limiting frontend changes to operation calls and presentation. Planning baseline: `2807c52f3b3ee82f1e708b20740726a7a28e3912`; execution branch: `feat/cyberbullying-practise`.

## Assumptions

- Existing progress transitions and storage can support the five targets, subject to direct inspection of both live projects and analyzer/replay contracts. Their suitability is an investigation gate, not an established result.
- The configured platform provider is retained. Inspect `.env.example`, `aiModels.ts`, and server configuration before implementation; request any missing required API settings. Record model differences from Copilot in behavioral evaluation.
- Existing shared approval can accept typed character metadata and draft revisions without replacing its atomic message/review transaction. Confirm this against live function definitions and permissions.
- Guard transitions retain their current meaning. Resolve each legacy value using inspected producer/consumer behavior; ambiguous historical provenance remains explicitly unknown.
- The implementing lead owns release batch `cyberbullying-practise`, subject to recorded handoff from any active shared deployment owner. Dependencies discovered in live progress, Guard, identity, or approval contracts belong to that same batch unless another named owner accepts them.
- Copilot assets and a coherent upstream commit remain accessible. Scenario conversion requires verified source assets rather than inferred content.

## Major Decisions

1. **Trusted operation contract.** Add `tutor-system/supabase/functions/practice-turn/index.ts` and small adjacent contract/dispatch modules. Requests contain `room_id`, operation, idempotency key, and operation-specific input. The authenticated principal supplies identity; stored room `practice_type` supplies dispatch. Learners may save their comment and request analysis of their own stored contributions; authorized tutors request/review/regenerate/reject/approve suggestions. Ratings follow existing participant eligibility. Continue-conversation uses the same comment/analysis/suggestion sequence. Resolve membership and publication permission at the database boundary as well as Edge entry.
2. **Narrow reuse.** Cyberbullying orchestration moves behind this API. Existing phishing operations remain available through explicit dispatch to their existing behavior and tests. Move only shared logic needed to establish trustworthy authorization and context; keep phishing-specific generation policy in its existing branch. `RoomContext.tsx` becomes a client for Cyberbullying operations instead of invoking legacy checklist/transfer prerequisites for those rooms.
3. **Stable domain identity.** Add immutable `practice_type` to rooms/templates, stable scenario/persona identifiers, and typed character metadata on proposals, messages, and reviews. Character keys are `same_age_peer`, `older_peer`, `victim`, `bully`, and `educator`; display identity derives from stored metadata everywhere.
4. **Server-owned proposals.** Persist an unpublished proposal with owner, room, revision, input-context linkage, original character/text, model/prompt/config versions, and generation status. Reviews record final character/text, tutor identity, Guard override, and terminal decision. Regeneration creates a new revision using Cyberbullying configuration; approval requires the current revision and atomically publishes one message plus its review. Character override affects that proposal only.
5. **Shared learning definitions.** Use exactly `recognize_cyberbullying_impact`, `show_empathy_support`, `stand_up_constructively`, `avoid_reinforcing_bullying`, and `choose_safe_next_step` as stable keys, with the five required labels/descriptions. Initialize learner-owned instances idempotently. Reuse transitions and evidence storage with subject-specific analysis instructions selected on the server.

## Ordered Implementation Steps

### 1. Establish contracts, inventories, and release scope

**Dependencies:** planning approval and designated worktree. **Deliverables:** implementation contract notes, data-transition inventory, dependency/owner table, and initial release ledger under the nearest relevant `tutor-system/docs/` area. Read applicable repository instructions and release/browser guides. Inspect staging `ciubrzggdqesgvfkpolj` and production `zgbufaxooqxeabewktzd` directly through Supabase MCP: tables, triggers, RPC definitions, grants, broad policies, approval permissions, progress/replay dependencies, and deployed Edge versions. Inventory legacy mode distributions, unknown provenance, Riley rows/configurations, and template/scenario relationships using counts and identifiers without exposing learner text. Inspect referenced local source consumers afterward.

Resolve existing-room classification with creation/version/template evidence and document why each cohort is phishing; unexplained cohorts block migration. Pin one Copilot commit and verify prompt, role strategies, scenarios, images, and initial comments against E7 blobs. Inventory all runtime Riley references and distinguish preserved transcripts/research evidence. Record current phishing observable contracts before changing shared paths. Resolve CRA-compatible shebang requirements before adding TypeScript files.

**Evidence:** reviewed mapping for every legacy mode/value and content cohort; complete affected lifecycle checklist and configuration baseline. Covers R1–R3, R5, R7, R9–R12.

### 2. Design and prove the single database migration

**Dependencies:** step 1 mappings. **Deliverables:** one pending SQL artifact in `supabase/migrations/`, typed database contracts, and migration verification results. Add room/template subject identity with immutable-after-create enforcement and evidence-backed backfill. Preserve template scenario text, posts/images, initial comments, and stable identifiers. Convert authoritative participation state to `guard_mode`; use `raw_guard_mode`/`final_guard_mode` for recorded decisions. Keep historical category separate, and represent unknown prior-context provenance explicitly rather than coercing it to false.

Update affected RPCs, triggers including `private.replay_transfer_guard_events`, locks, exports' database projections, and approval vocabulary together. Extend proposal/message/review storage and `send_reviewed_tutor_response` for character identity, provenance, ownership, revision, context linkage, and idempotency. Retain real tutor identity from authenticated execution. Preserve stored Riley transcript text through an explicit mapping into ordinary historical message representation; retain conversion evidence and stop on unmapped cases. Implement target definitions and atomic/idempotent learner initialization with existing progress ownership rules.

**Evidence:** fresh hosted dump plus roles, isolated native PostgreSQL baseline with matching ownership/ACL/settings, failing pre-change assertions, exact SQL application, then passing executor/application-role tests. Include unauthorized direct RPC calls, cross-room access, concurrent approvals, rollback on review failure, uniqueness, migration counts/content checks, Guard locks/replay, and unknown provenance. Inspect resulting schema directly. Covers R1–R4, R7–R9, R10–R11.

### 3. Implement trusted server operations and subject routing

**Dependencies:** proven schema contract. **Deliverables:** `practice-turn` handler, focused operation contracts, shared authenticated context loader, and integration tests. Load persisted room, participant allocation/observer status, scenario, full saved history, and progress. Validate every operation against authoritative subject and participant permission. Return typed success/conflict/failure responses; reject stale revisions and mismatched message/proposal ownership. Record request IDs and input context references for replay.

Implement comment save, analysis, suggestion request, review, regeneration, rejection, approval/send, response rating, and continuation. Save operations and approval use transactional RPCs; generation runs outside publication transactions and persists only unpublished proposals. Retry the same operation safely; failed generation leaves recoverable status and no published suggestion. Shared operations reuse room/image/membership allocation and transport; phishing requests preserve their existing operation semantics. Direct calls receive the same capability/authorization checks as UI requests.

**Evidence:** deterministic API-to-database integration tests for all operations, observer fallback, cross-user/room attacks, duplicate requests, provider failure, rejected proposals, stale review, and simultaneous approvals. Verify rating IDs reference approved messages. Covers R6–R10.

### 4. Add Cyberbullying generation and progress analysis

**Dependencies:** steps 1 and 3. **Deliverables:** dedicated server prompt/config files, pinned scenario manifest/assets, and subject-aware analysis in `assessment-api/index.ts`. Reuse server-side transport from `ai-api` while keeping configured model and request limits explicit. A role-playing call selects one allowed character and one complete response; validate `response_in_role` and `final_response` into one proposal. Persist every saved speaker attribution in context. Detect context-size failures explicitly. Review Copilot's inconsistent constructive-upstander examples and document any semantic corrections as changed experimental factors.

Analyze each stored learner contribution against all five targets using history as context. Only evidence attributed to that learner/current contribution can update that learner's progress. Reuse initial-signal, demonstrated-understanding, contradiction, and post-repair transitions as validated; preserve phishing transition behavior. Deduplicate analysis/events, maintain reload persistence, and apply inherited Guard deferral/replay semantics. Integrate reviewed Guard override with existing participation transitions independently of the selected character.

**Evidence:** fixtures covering five targets and five roles, history attribution, tutor/other-learner evidence rejection, retry/replay, contradictory evidence, Guard defer/release, and generation parsing/failure. Real-provider matrix records scenarios, role strategy, prompt/config/model versions, full inputs/outputs, review outcomes, and semantic acceptance separately from deterministic results. Covers R2, R4–R7, R10.

### 5. Wire shared UI and finish runtime cleanup

**Dependencies:** server contracts pass. **Deliverables:** updates to `src/types/index.ts`, `src/services/supabase.ts`, a thin `practiceTurnService.ts`, `RoomContext.tsx`, `TutorView.tsx`, `AISuggestionBox.tsx`, template creation, and progress initialization/panel wiring. Room creation chooses subject; fetched immutable subject controls subsequent behavior. Render character selector, text editor, regenerate, reject, send, and existing Guard override for Cyberbullying proposals. Preserve subject and source assets through template edit/create/copy round trips. Review edits carry draft revision and remain tied to their proposal.

Update student/observer/realtime/reload projection in `messagePresentation.ts`, `RoomPagePost.tsx`, `simplifiedAIContext.ts`, and `roomExportBuilder.ts` to retain character identity and approved-message ratings. Restrict review provenance to authorized reviewers at actual data policies/projections; include durable learner evidence in appropriate exports. Complete inventoried Riley cleanup across `MultiAgentSuggestionEditor.tsx`, draft wiring, `tutorDecisionContract.ts`, tag handling, playback/rating branches, `multiAgentTutorPrompt.ts`, demo templates, helpers, repair instructions, and dependent tests. Preserve mapped historical content.

**Evidence:** component/service integration tests and complete student/tutor/observer journeys for both subjects, including regeneration, override, reject/send, reconnect/reload, exports, ratings, isolation, and historical rendering. TypeScript/build checks; record mypy applicability for TS-only work, run it for any Python refactor. Test-file comments state coverage purpose. Update closest docs before commits with required date/commit baseline and change records. Covers R1–R12.

### 6. Deliver the integrated batch through both environments

**Dependencies:** steps 1–5, release owner confirmed. **Deliverables:** exact artifact manifest, integrated release commit, environment evidence, cleanup records, and completed release ledger. Deploy proven SQL before dependent Edge functions to staging; verify database state and full combined Guard/identity/progress/approval journeys plus phishing regression and real-provider acceptance. Record hashes, deployed versions, configuration, failures, and retained input/output artifacts outside Git when large.

Merge into `no_sign_up`, compute integrated artifact hashes, compare against staging evidence, and deploy/revalidate any affected integrated differences on staging. Production mutation requires the committed integrated release to match the verified artifacts and dependencies. Promote that exact SQL/Edge/configuration set, then repeat complete affected production journeys and scoped model acceptance. Clean up only identified test fixtures through authorized methods and record residuals. Archive the migration only after both environments pass. Any access/tool failure records exact action, current deployed state, evidence, and next action while delivery remains incomplete. Covers R10–R12.

## Risks and Mitigations

- Server scope expands shared orchestration: define operation contracts first and move only required context/authorization logic; prove phishing behavior with differential fixtures and full journeys.
- Unknown historical data or live drift invalidates conversion: inventory both projects, retain content and unknown provenance, and block unexplained mappings before SQL rollout.
- Broad policies undermine reviewer privacy or approval: exercise actual authenticated database/API boundaries under learner, observer, tutor, and unauthorized identities.
- Provider/model differences alter role strategy: pin assets and prompts, record changed factors, and require behavioral evaluation across all five roles and targets before promotion.
- Retry/concurrency creates duplicate evidence or publication: enforce database uniqueness and revision checks, and test transaction failure and concurrent submissions.

## Validation Criteria

Acceptance requires the evidence in the ordered steps, with R1 template/subject persistence; R2 Guard migration/locks/replay/unknown provenance; R3 runtime inventory closure plus historical preservation; R4 five learner-owned targets and durable evidence; R5 all roles with one-call/one-publication behavior; R6 supported UI and direct API operations; R7 atomic review/publication and failure isolation; R8 identity/rating/export/privacy agreement; R9 authoritative membership and subject routing; R10 deterministic and separately accepted real-provider results; R11 exact integrated staging/production verification; and R12 documented commits and preserved unrelated work.

The release ledger must identify the owner, source commit, migration/function hashes, provider/configuration baseline, environment versions, journey results, retained evidence paths, and fixture cleanup. Local or staging success establishes an intermediate checkpoint; completion requires recorded production acceptance of the integrated batch.
