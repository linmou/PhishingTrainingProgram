# Assigned Approach

Use **inline-room-dispatch**: retain `RoomContext.tsx`, the existing AI service dispatcher, shared approval RPC, progress storage and panel. Introduce explicit branches on authoritative `practice_type` at their current integration points. Extend shared contracts directly, with small Cyberbullying prompt/configuration helpers where necessary. Inventory dependencies first, prepare one coordinated migration, then deliver an end-to-end Cyberbullying conversation and verify phishing regressions.

Intent: provide an executable plan for the future implementation and production delivery of Cyberbullying practise. Planning baseline: `2807c52f3b3ee82f1e708b20740726a7a28e3912`; worktree branch: `feat/cyberbullying-practise`. The steps below are prospective acceptance gates, not completed verification.

# Assumptions

- **A1 — Release ownership:** the future implementer owns batch `cyberbullying-practise`, subject to recording an existing owner's handoff before shared deployments.
- **A2 — Progress:** existing progress storage and transitions can represent the five targets. Live RPC, attribution and replay inspection must establish this before implementation.
- **A3 — Guard:** the existing participation semantics remain authoritative. Reviewed character/text and Guard override are independent fields of one approved decision.
- **A4 — Provider:** reuse the configured server-side provider initially. Differences from Copilot's model are an explicit experimental factor requiring behavior acceptance.
- **A5 — Historical data:** stored Riley configurations and environment drift require inventory. Any unexplained record blocks its conversion until a content-preserving mapping is established.
- **A6 — Upstream:** the GitHub connector can resolve a coherent `linmou/SocialMediaCopilot` revision and its scenario assets. Contents remain unverified until that inspection.

# Major Decisions

1. Add `practice_type: 'phishing' | 'cyberbullying'` to rooms/templates and their creation/copy contracts. The database enforces immutability after creation. Classify existing rooms as phishing only after the inventory establishes the population and records the evidence. Persist scenario text, post/image, initial comments and stable scenario/persona identifiers through template round trips.
2. Replace authoritative participation mode with `guard_mode: boolean`, preserving its established mapping, transitions and locks. Use `raw_guard_mode` and `final_guard_mode` for review decisions. Keep historical message category independent. Represent unavailable prior-context Guard provenance explicitly as unknown, using nullable historical metadata or an explicit provenance field rather than coercing it to false.
3. Define one canonical five-target set with stable keys: `recognize_cyberbullying_impact`, `show_empathy_support`, `stand_up_constructively`, `avoid_reinforcing_bullying`, `choose_safe_next_step`. All Cyberbullying scenarios reference that set. Progress belongs to each learner, and evidence must originate in that learner's current contribution; saved history supplies context.
4. Use the five character values `same_age_peer`, `older_peer`, `victim`, `bully`, `educator`. A proposal contains one selected character and one complete text. The existing atomic approval workflow publishes one message and its audit together. An edited selection belongs to that proposal; future requests use the configured role-selection strategy.
5. Resolve behavior from persisted room identity in UI and server handlers. The Cyberbullying operation contract is: save learner comment, analyze/update progress, request suggestion, review character/text, regenerate, reject, approve/send, rate and continue. Its response controls are character selector, text editor, regenerate, reject, send and the existing Guard override. Character configuration owns style instructions. Existing phishing branches retain their operation contracts.
6. Keep orchestration in current integration points. Small typed helper functions may isolate prompt construction or validation, but shared membership, allocation, transport, persistence and presentation remain the implementation boundary. This minimizes changes while making every subject branch observable in tests.

# Ordered Implementation Steps

## 1. Establish the live baseline and conversion inventory

**Dependencies:** request baseline and designated worktree. **Requirements:** R1–R3, R9–R12.

Read applicable repository instructions, the release workflow and browser testing guide. Inspect staging `ciubrzggdqesgvfkpolj` and production `zgbufaxooqxeabewktzd` directly through Supabase MCP: room/template schemas, join and analysis RPCs, approval permissions, feedback/message columns, progress uniqueness, Guard locks and `private.replay_transfer_guard_events`. Compare function/config versions and identify inherited dependencies with named release owners.

Trace `RoomContext.tsx`, `aiService.ts`, `ecologicalTutorCall.ts`, `assessment-api/index.ts`, `AISuggestionBox.tsx`, `StudentAIToneControl.tsx`, projections and exports. Record every operation entry point and its subject decision. Inventory retired Riley runtime references and stored formats using aggregate counts and schemas rather than exposing learner text. Record the approved file cleanup scope and preservation mapping separately from historical research evidence.

**Deliverables/evidence:** baseline manifest, schema/function drift report, operation-to-handler table, Guard truth table including unknown provenance, Riley conversion ledger and dependency ownership. Resolve ambiguous classifications and replay behavior before schema work. Confirm `.env.example` provider settings; request missing required settings. Resolve CRA/new-file shebang constraints before adding TypeScript modules; use designated text editing and `rtk` commands throughout execution.

## 2. Pin scenario assets and define contracts

**Dependencies:** step 1. **Requirements:** R1, R4–R7, R9–R10.

Pin a coherent upstream commit and asset hashes, relating inspected blob references to that revision. Map complete scenarios, original posts/images, initial comments and persona identities into existing room/template storage. Write a concise role-strategy specification from upstream behavior and flag prompt example corrections for explicit review.

Extend `src/types/index.ts` and the approval/analyzer contract definitions. Specify draft identity/version, owning room, linked learner input/context, original/final character and text, Guard decisions, real reviewer identity and model/prompt/config provenance. Identify existing fields that can satisfy these contracts before adding columns. Define stable target descriptions and generation output validation for one character/text pair.

**Deliverables/evidence:** pinned asset manifest, scenario round-trip fixtures, role/target definitions and typed contract examples. Review changed experimental factors: subject prompts, role strategy corrections, history representation, platform model and target evaluation. These become the real-provider run metadata.

## 3. Prepare and prove one coordinated migration

**Dependencies:** steps 1–2. **Requirements:** R1–R4, R7–R9, R11.

Prepare the single pending artifact in `tutor-system/supabase/migrations/`. Add subject identity and immutability; convert participation state and dependent RPCs/triggers/policies to Guard booleans; extend message/review persistence and learner-progress initialization. Backfill existing room identity and Guard state according to the approved inventory. Preserve message bodies and speaker attribution during the Riley transition, retaining required source/provenance evidence. Preserve unknown historical Guard values explicitly.

Extend `send_reviewed_tutor_response` to load room subject and authorize tutor membership at the actual database boundary. Validate the appropriate decision contract, current draft ownership/version and approved character/text. Atomically persist one message, its review and applicable participation update. Enforce idempotency/concurrency using existing request/draft identity where possible; replaying approval cannot create another message. Ensure rejected or unpublished proposals remain non-public. Audit broad policies alongside reviewer-only metadata restrictions.

Follow the native PostgreSQL migration sequence: fresh hosted database/roles snapshot, isolated equivalent ownership/ACL/settings baseline, failing Red checks, exact SQL Green under executor and application roles. Test conversion counts, preserved content hashes, immutable subject, authorization, rollback, concurrency, progress isolation and replay locks.

**Deliverables/evidence:** exact SQL/hash, restricted snapshot metadata, baseline equivalence and Red/Green results. Store sensitive dumps outside Git. A failed prerequisite blocks migration delivery; repair the prerequisite before advancing.

## 4. Implement the shared controller's Cyberbullying slice

**Dependencies:** validated contracts and migration. **Requirements:** R1, R4–R7, R9.

Update `src/services/supabase.ts`, room/template creation and `TutorView.tsx` copying to preserve subject and scenario data. Reuse `transferAssessmentService.joinRoom` allocation/observer fallback. Initialize learner-owned target rows idempotently through the server path and restore them on reload.

Add explicit subject branches in `RoomContext.tsx` around checklist initialization, legacy analyzer fallback, target readiness and transfer-candidate preparation. Route Cyberbullying analysis through `assessment-api` using shared target definitions, current learner message and attributed history. Adapt subject-specific analyzer instructions after validating the existing event contract. Reuse `learningProgressTransitions.ts`, retaining eligibility, contradiction/repair and Guard deferral/replay semantics. Ensure retries cannot duplicate evidence and one learner's contributions cannot advance another's targets.

Add a Cyberbullying branch to `aiService.ts` and regeneration entry points before phishing prompt/policy assembly. Reuse server AI transport with configured size/model limits. Construct full saved history with stable speaker identifiers; validate one role/text response. Attach configuration and context provenance to the unpublished draft. Failed generation produces a recoverable failure state without publication.

**Deliverables/evidence:** integration tests for join → save comment → analyze → request/review → regenerate → reject or approve → rate → continue. Include all targets/characters, repeated requests, stale context and failed provider responses. Assert generated request contracts and publication counts rather than exact generated wording.

## 5. Complete tutor controls and consistent presentation

**Dependencies:** step 4. **Requirements:** R2, R5–R9.

Dispatch `AISuggestionBox.tsx` controls by authoritative room subject. Implement character editing, text editing, regenerate, reject, send and independent Guard override against the versioned proposal. Ensure regeneration uses Cyberbullying character configuration and fresh linked context. Server handlers independently validate every directly invoked operation using the persisted room and authenticated actor.

Extend `RoomPagePost.tsx`, `messagePresentation.ts`, message projection, `simplifiedAIContext.ts` and `roomExportBuilder.ts` to preserve the approved character. Student, observer, realtime, reload and future AI history must agree on the same stored identity. Bind response ratings to the approved message ID. Export durable learner progress/evidence with appropriate visibility, while review provenance remains reviewer-only.

**Deliverables/evidence:** UI/integration assertions for tutor edits, proposal-local character selection, observer fallback, ratings, realtime/reload agreement and export contents. Direct-call tests cover unauthorized roles, wrong room/subject, stale drafts, concurrent approvals and atomic failure rollback.

## 6. Finish retired runtime cleanup and deterministic regressions

**Dependencies:** steps 3–5. **Requirements:** R2–R3, R10, R12.

Execute the inventoried Riley cleanup across `MultiAgentSuggestionEditor.tsx`, controller wiring, draft handlers, `tutorDecisionContract.ts`, tag parsing, playback/rating mappings, `multiAgentTutorPrompt.ts`, repair instructions, configuration helpers and demo templates. Update dependent tests to verify current contracts and preservation fixtures. Retain stored transcript content and historical evidence according to the conversion ledger.

Update nearest relevant documentation before implementation commits, including applicable date/commit records. Run TypeScript checks, relevant Jest/BDD suites and production build. Record mypy applicability for TS-only changes; run mypy if Python is refactored. New tests identify their covered files and purpose in initial comments.

**Deliverables/evidence:** reference inventory reconciliation, preserved-data comparison and passing focused regression results. Prior 35-test baseline results are context only; rerun affected suites. Verify full phishing operations, Guard transitions and progress semantics alongside the Cyberbullying slice.

## 7. Validate staging and real-provider behavior

**Dependencies:** steps 1–6 passing. **Requirements:** R1–R12.

Release owner deploys exact validated SQL before dependent Edge artifacts to staging. Run complete student/tutor/observer journeys for both subjects, including identity, Guard overrides/locks/replay, learning evidence, approval edits, regeneration, rejection, concurrency, ratings and exports. Verify migrated and newly created rooms/templates.

Run real-provider scenarios spanning all five roles and targets, constructive support, ambiguous learner contributions and contradiction/repair. Evaluate intended role strategies, attributed evidence and one-message proposals separately from deterministic pass results. Preserve every request/response, context, prompt/config/model hash, rubric decision, failure and retry outside Git when large. Review explicit prompt corrections and model differences against intended Copilot behavior.

**Deliverables/evidence:** staging version/hash manifest, complete journey evidence, behavior acceptance record and fixture cleanup proof. Fix failures and rerun affected checks before merge.

## 8. Integrate and release the verified batch

**Dependencies:** accepted staging evidence and owned inherited dependencies. **Requirements:** R10–R12.

Merge into `no_sign_up`, record the integrated release commit and artifact hashes, and verify the exact integrated artifacts together on staging. Revalidate changes introduced by integration and any changed dependencies/configuration. Compare the committed production source with accepted staging evidence before production mutation.

Release SQL before dependent Edge artifacts to production; execute the same complete affected journeys and selected real-provider acceptance checks using controlled fixtures. Record both environments' source/version, migration, configuration, results and cleanup. Archive the migration only after both environments pass, maintaining at most one pending migration.

**Deliverables/evidence:** production acceptance ledger and documentation records. Any deferral retains open production criteria with named owner, exact artifacts, merge state, remaining checks and concrete trigger. An access failure records the failing action, deployed state and required remedy; completion requires production verification.

# Risks and Mitigations

- Hidden phishing side effects in the large controller: use the entry-point table and test each subject branch, including regeneration and legacy fallback.
- Live Guard or approval semantics differ from local expectations: resolve through MCP inspection and native role/concurrency checks before migration approval.
- Historical conversion loses meaning: require inventory counts, content hashes, attribution comparison and explicit unknown provenance; halt unexplained conversions.
- Provider changes alter role behavior: pin inputs/configuration and judge recorded real-provider outputs independently of deterministic contracts.
- Shared staging changes invalidate evidence: one release owner records dependency versions and reruns affected checks against the integrated commit.

# Validation Criteria

- **R1–R3:** immutable subject, faithful scenario/template round trips, evidence-backed backfill, preserved Guard locks/replay/unknown provenance, inventoried Riley transition with historical content intact.
- **R4–R6:** exactly five shared target keys, all five roles, learner-owned durable/idempotent evidence, subject-derived operation routing in UI and direct server calls, one complete proposal and one publication.
- **R7–R9:** atomic reviewed message/audit, real tutor identity, original/final edits and provenance, ownership/staleness/concurrency protections, consistent character/rating/export behavior, generic membership and observer allocation.
- **R10–R12:** passing deterministic and migration checks, separately accepted real-provider behavior with recorded inputs/outputs, complete staging and production journeys for both subjects, integrated hashes, cleanup evidence and current documentation.
