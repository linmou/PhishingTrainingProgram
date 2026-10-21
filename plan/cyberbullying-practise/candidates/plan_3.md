# Assigned Approach

Intent: provide an executable implementation and release plan for Cyberbullying practise while preserving shared participation, review, progress, and identity contracts.

Date: 2026-10-21. Planning baseline: `2807c52f3b3ee82f1e708b20740726a7a28e3912`. Branch: `feat/cyberbullying-practise`; integration branch: `no_sign_up`.

Use **separate-cyber-room-composition**: route an authoritative Cyberbullying room to a dedicated container/controller, composed from shared chat, review, progress, rating, membership, and persistence primitives. Keep phishing orchestration in its current container. Sequence contracts and schema before the new container, then integrate shared components incrementally. Accept limited orchestration duplication to isolate implicit phishing hooks; prevent identity, rating, and export drift with shared projections and persisted contracts.

This document schedules future implementation. Its investigations and acceptance checks are not completed evidence.

# Assumptions

- **A1:** The implementing agent is the proposed release owner for batch `cyberbullying-practise`. Record a named owner and resolve any existing shared deployment ownership before deploying.
- **A2:** Existing progress storage and transition rules are suitable after inspecting live analysis, ownership, and Guard replay contracts. Adapt the subject-specific analyzer input while preserving the existing transition engine.
- **A3:** Preserve inherited Guard decisions, transitions, locks, and overrides. Reviewed character identity is proposal data; Guard is room participation state. Their persistence shares the existing approval transaction where required.
- **A4:** Reuse the platform provider and server credentials. Its behavioral equivalence to upstream remains a real-provider acceptance question.
- **A5:** Existing Riley data and stage/production drift require inventory. Preserve unexplained records until an explicit conversion is supported by evidence.
- **A6:** A coherent SocialMediaCopilot commit and its scenario assets are accessible through the GitHub connector. Pin them before porting prompts or content.

# Major Decisions

1. **Authoritative identity:** Add `practice_type: 'phishing' | 'cyberbullying'` to rooms and templates and freeze it after creation at the server boundary. Dispatch the room route after fetching that identity. Creation/template copying preserves scenario text, original post/image, initial comments, and stable scenario/persona identifiers.
2. **Shared persistence, separate orchestration:** Proposed `src/components/CyberbullyingRoom.tsx` and `src/hooks/useCyberbullyingRoom.ts` own the supported Cyberbullying sequence. `RoomContext.tsx` retains phishing orchestration. Extract only demonstrated shared persistence/projection helpers; the Cyberbullying controller calls these directly instead of entering phishing generation hooks identified in E3/E6.
3. **Explicit proposal contract:** A generated suggestion contains one selected role and one complete text, linked input context, draft revision, and model/prompt/config provenance. Valid roles are `same_age_peer`, `older_peer`, `victim`, `bully`, and `educator`. Store stable character/persona identity separately from display names and real human author identity. Approval records original/final role, character, and text; selected character scope ends with that proposal.
4. **One capability contract:** Authorize and route save comment, analyze progress, request suggestion, review, regenerate, reject, approve/send, rate, and continue using fetched room identity. The Cyberbullying review surface exposes character selector, text editor, regenerate, reject, send, and inherited Guard override. Character configuration supplies generation style. Apply the same contract to direct server calls.
5. **Five shared targets:** Define one versioned target set for every Cyberbullying scenario: recognize cyberbullying and impact; show empathy/support; stand up constructively; avoid reinforcing bullying; choose a safe next step. Use stable keys, concise definitions, and existing progress transitions. Initialize per learner idempotently.
6. **Guard migration:** Replace authoritative participation mode with boolean `guard_mode`, allowing `raw_guard_mode` and `final_guard_mode` in review decisions. Maintain separate historical message category. Prior-context provenance remains explicitly unknown where evidence is absent; a false boolean is never used to manufacture provenance.

# Ordered Implementation Steps

## 1. Establish evidence and release baseline — R1–R12

**Dependencies:** none. Read applicable repository instructions, closest docs, browser testing guidance, release workflow, and `.env.example`. Use Supabase MCP to inspect both live projects: staging `ciubrzggdqesgvfkpolj`, production `zgbufaxooqxeabewktzd`. Inventory room/template identity, Guard fields and triggers, analysis/replay RPCs, approval authorization, feedback/message columns, policies, active Edge versions, and Riley rows/configurations. Record aggregate counts and protected evidence references rather than exposing learner text. Inspect join/allocation and progress initialization behavior.

Resolve upstream to a coherent commit and asset manifest, checking E7 blob references against that commit. Record scenarios, stable character identities, role strategies, and proposed corrections to inconsistent examples for explicit review. Verify model/config settings; request missing required API parameters before provider work.

**Deliverables/evidence:** schema/function drift report, dependency graph, data-conversion table, upstream manifest, five-target definitions, named batch owner, and requirement-to-test matrix. Assign that owner responsibility for inherited Guard, progress, identity, and approval dependencies. Unresolved conversion or access prerequisites block their dependent steps.

## 2. Define and validate the migration — R1–R3, R7–R9, R11

**Dependencies:** step 1. Prepare one pending SQL migration in `tutor-system/supabase/migrations/`. Add room/template practice identity and supporting scenario/persona metadata. Backfill existing rooms as phishing only after inventory demonstrates their origin; report ambiguous records for resolution. Enforce practice-type immutability, template round trips, and consistent template-to-room creation.

Map every observed participation state to `guard_mode` using the inventoried semantics. Update RPCs, locks, replay trigger dependencies, review decision fields, and export-facing data. Retain historical categories and provenance independently. Extend messages and `ai_suggestion_feedback` for character identity and original/final review data. Extend `send_reviewed_tutor_response` to validate authoritative practice type, membership/tutor authority, proposal ownership/revision, role validity, and context. Persist one message plus its review atomically, with a unique approval/idempotency constraint and real tutor identity. Verify effective access through broad policies as well as RPC checks; reviewer-only metadata must remain protected.

Create an inventoried, content-preserving transition for stored Riley transcripts/configurations. Preserve original evidence and stable attribution in a suitable historical representation; prove renderability before retiring active interpretation.

**Deliverables/evidence:** exact SQL, mappings, reconciliation queries, and migration tests. Follow the release workflow's fresh hosted dump plus roles, isolated native PostgreSQL baseline, ownership/ACL/settings equivalence, Red then exact-SQL Green under executor and application roles. Exercise authorization, transaction rollback, duplicate/concurrent approval, immutability, unknown provenance, Guard replay, and content preservation. Keep protected dumps outside Git.

## 3. Implement shared types and server behavior — R1, R2, R4–R9

**Dependencies:** step 2 contracts and validated SQL. Update `src/types/index.ts`, `src/services/supabase.ts`, review service/contracts, and message projections. Make server dispatch load authoritative room identity. Reuse generic `ai-api` server transport with explicit Cyberbullying prompt/config assembly and bounded request validation. Keep phishing assembly in `aiService.ts`/`ecologicalTutorCall.ts` attached to phishing routing.

Port pinned scenarios and the five role strategies into a small dedicated configuration/prompt module. Parse a single role/text result, validate identity against its configuration, and preserve the full saved conversation with stable speaker attribution. Generation creates an unpublished proposal; regeneration uses edited character selection and Cyberbullying configuration, preserving original/final audit linkage.

Extend `assessment-api/index.ts` and supporting analysis RPC contracts after their inspection. Supply the fixed target definitions, learner message, current state, and complete relevant history. Evidence references only the current learner's contributions. Validate event attribution, quoted evidence, eligibility, and idempotency by learner/message/target; retain existing transition semantics and Guard deferral/replay. Initialize five learner-owned progress rows through an idempotent server path on participation, covering existing eligible memberships.

**Deliverables/evidence:** schema-aligned types, server dispatch, dedicated prompts/configuration, proposal lifecycle services, target initialization/analyzer integration. Integration tests cover all roles/targets, malformed responses, failed generation, direct invocation, learner isolation, retry/replay, ownership, and full context assembly.

## 4. Compose the Cyberbullying room — R1, R4–R9

**Dependencies:** step 3. Add the dedicated container/controller at the room route boundary. Reuse membership and student allocation/observer fallback from `transferAssessmentService.joinRoom`, shared image handling, and room/template loading. Adapt shared chat, progress panel, and review primitives incrementally; isolate required props from `RoomContext` orchestration.

Implement the explicit sequence: save learner comment, analyze/update progress, request character suggestion, review/edit, regenerate or reject, approve/send, rate, continue. Preserve saved learner messages when analysis or generation fails and provide safe retry. The review component may adapt `AISuggestionBox.tsx` with explicit capability props. Bind Guard override independently from selected character. Reject clears the active proposal state; revision checks prevent delayed generation results or stale tabs from replacing current proposals.

**Deliverables/evidence:** room routing, new composition, template creation/copy support, and controller integration tests. Demonstrate readiness without phishing target/candidate hooks, persisted learner progress on reload, successful retries, edits and overrides, stale-draft rejection, and one publication per approved proposal.

## 5. Unify presentation and retire Riley runtime — R2, R3, R7, R8

**Dependencies:** steps 2–4. Update `messagePresentation.ts`, `simplifiedAIContext.ts`, `RoomPagePost.tsx`, realtime projections, observer/student rendering, and `roomExportBuilder.ts` to consume stored character identity. Preserve ratings by approved message ID. Include durable progress evidence and appropriate audit fields in permission-aware exports.

Use step 1's inventory to remove retired Riley editor/wiring, draft handlers, tag grammar, playback/rating branches, prompts/repair instructions, choices/config helpers, demo templates, and dependent active tests. Retain historical research artifacts as evidence and validate migrated transcripts through ordinary presentation. Review each affected file and data conversion before removal.

**Deliverables/evidence:** shared presentation/export contract and cleanup inventory with disposition. Tests compare persisted identity across student/observer views, realtime, reload, AI history, and exports; verify rating linkage, audit visibility, historical content preservation, and remaining runtime references against the inventory.

## 6. Complete development acceptance and documentation — R1–R12

**Dependencies:** steps 2–5. Run focused deterministic integration suites, TypeScript checks, build, and affected phishing regressions. For any Python refactor run mypy; record applicability for TS-only changes. New test comments name their covered files/purpose. Resolve new-file shebang requirements against CRA constraints using applicable repository guidance before adding files. Use `apply_patch` for text changes and `rtk` for shell commands.

Execute browser journeys against explicitly configured staging after its step 7 deployment. Prepare fixtures and scripts now. Prepare real-provider scenario checks spanning all five roles and targets, learner-only evidence, strategy fidelity, constructive support, regeneration, Guard interactions, and full-history attribution. Record changed factors: provider/model, prompt corrections, scenario data format, target definitions, and analyzer method. Preserve complete input/output pairs, config hashes, costs/timing where available, and judgment rationale outside Git when large.

**Deliverables/evidence:** deterministic results and separate behavioral acceptance rubric; closest updated Markdown/docs and required dated update record before commits. Preserve unrelated files/changes. Prior 35 passing tests are baseline context only.

## 7. Release and verify the integrated batch — R10–R12

**Dependencies:** development gates passed. The named owner deploys validated SQL before dependent Edge code to staging, recording source hashes, database versions, functions, and configuration. Run full student/tutor/observer journeys for both practice types, covering Guard/identity/progress/approval interactions, ratings, exports, permissions, failures, and real-provider checks. Record fixture cleanup and retained evidence. Fix failures and repeat affected checks.

Merge into `no_sign_up` only after staging passes. Record the integrated release commit, exact artifact hashes, and dependency versions. Compare against staging and revalidate combined integrated artifacts on staging; any affected change invalidates earlier evidence. Promote only committed matching artifacts to production, SQL before dependent Edge, then run complete affected journeys and scoped protected-data checks there. Archive the single pending migration only after both environments pass.

**Deliverables/evidence:** both-environment release ledger with baseline, hashes, versions, configuration, tests, live input/output evidence, cleanup, failures, and production acceptance. An unavailable prerequisite leaves release incomplete with exact blocker, deployed state, and next action recorded.

# Risks and Mitigations

- Separate containers can diverge in ratings or identity: share persisted projections and run identical contract fixtures through both compositions.
- Existing hooks may retain phishing assumptions: inspect every reused primitive's service calls and test Cyberbullying prompt/context assembly directly.
- Guard conversion can lose historical meaning: reconcile every observed value, preserve unknown provenance, and test locks/replay across migration.
- Provider differences can change role behavior: pin upstream inputs, version local changes, and judge recorded live runs independently of deterministic passes.
- Authorization may differ between RPC and table policies: exercise both access paths under actual application roles, including concurrent approval and reviewer metadata reads.
- Shared deployment drift can invalidate evidence: one release owner records exact dependencies and repeats affected integrated staging checks before promotion.

# Validation Criteria

| Requirements | Required acceptance evidence |
| --- | --- |
| R1 | Creation/template round trips, immutable authoritative type, reconciled phishing backfill and preserved scenario/assets/personas. |
| R2 | Guard mapping, locks, override, trigger replay and audit tests; historical categories and unknown provenance preserved. |
| R3 | Completed runtime inventory disposition and content-preserving historical transcript checks. |
| R4 | Exactly five initialized targets; learner-only evidence, isolation, transitions, duplicate/retry/replay and reload tests. |
| R5 | Five roles exercised; one valid selected character/text per call, full attributed history, recorded provider acceptance. |
| R6 | Each supported operation/control tested through UI and direct server invocation with authoritative routing. |
| R7 | Edits, proposal-local selection, provenance, real reviewer identity, stale/ownership/concurrency/failure checks; atomic single publication. |
| R8 | Ratings reference approved message; consistent character across every projection/export; protected audit and durable progress evidence. |
| R9 | Membership, allocation/observer fallback, assets and transport journeys for both room types. |
| R10 | Deterministic, migration, browser and real-provider results clearly distinguished, with reproducible input/output metadata. |
| R11 | Native migration gates and complete staging/integrated-staging/production journey evidence match committed artifact hashes; cleanup recorded. |
| R12 | Updated nearest docs and dated records before implementation commits, explicit dependency/evidence ledger, preserved unrelated changes. |
