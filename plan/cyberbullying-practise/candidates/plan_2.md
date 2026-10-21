# Assigned Approach

Intent: implement Cyberbullying practise through a narrow, typed boundary between shared room workflow and subject behavior, with evidence sufficient for production acceptance.

Date: 2026-10-21. Planning baseline: `2807c52f3b3ee82f1e708b20740726a7a28e3912`. Branch: `feat/cyberbullying-practise`; integration branch: `no_sign_up`.

Use the **practice-adapter-boundary** approach: characterize existing phishing behavior, extract its adapter without changing observed behavior, then implement the Cyberbullying adapter. Shared room code owns membership, persistence, approval, transport, presentation, and ratings. Two explicit adapters supply generation, progress-analysis, and configuration policies. Acceptance ends with verified production delivery during the future implementation task.

# Assumptions

- **A1 — release ownership:** the future implementer owns batch `cyberbullying-practise`, subject to checking active shared-deployment ownership and recording any handoff before deployment.
- **A2 — progress reuse:** existing transition/storage semantics can support the five Cyberbullying targets. Direct inspection of live RPCs, deferred events, and analyzer dependencies must confirm this before extraction.
- **A3 — Guard:** inherited Guard transitions and override semantics remain authoritative. Character selection and Guard are independent proposal fields. Unknown historical context remains explicitly unknown.
- **A4 — provider fidelity:** reuse the configured platform provider through server transport. Copilot role behavior on that model requires real-provider acceptance; source fidelity alone is insufficient.
- **A5 — conversion evidence:** saved Riley forms and staging/production drift are not yet inventoried. Conversion rules require evidence, row-count reconciliation, and preserved transcript content before approval.
- **A6 — upstream access:** resolve one coherent SocialMediaCopilot commit and its complete scenario assets through the available GitHub connector. The supplied blob hashes are discovery anchors, not a complete asset manifest.

# Major Decisions

1. Define `PracticeType = 'phishing' | 'cyberbullying'` on authoritative rooms/templates. Default existing-room classification follows documented evidence; creation explicitly supplies the type, and server enforcement freezes it afterward. Keep scenario text, post/image, initial comments, and stable scenario/persona identifiers in template round trips.
2. Introduce a small typed adapter selected by a two-case factory. Proposed files are `src/services/practice/practiceAdapter.ts`, `phishingPracticeAdapter.ts`, and `cyberbullyingPracticeAdapter.ts`. Its contract exposes capabilities, generation/configuration construction, and target-analysis policy. The controller supplies saved attributed history and learner identity; shared services execute persistence and transport. Contracts distinguish phishing decisions from Cyberbullying proposals through `practice_type`. Resolve CRA handling of mandatory code-file shebangs before creating TypeScript modules.
3. Backend entry points load the room's type and apply the corresponding fixed policy. Frontend adapter selection improves composition; server dispatch remains the security and capability boundary. Reuse a shared contract where existing build boundaries permit it; otherwise test frontend/Edge contract parity explicitly.
4. Cyberbullying proposal output is one character key and one complete text. Supported keys are `same_age_peer`, `older_peer`, `victim`, `bully`, and `educator`; stable speaker identity accompanies the key. Character choice belongs to an individual draft. Review permits character/text edits and the inherited Guard override. Approval atomically stores one message and linked audit feedback.
5. Use five fixed target keys: `recognize_cyberbullying_and_impact`, `show_empathy_and_support`, `stand_up_constructively`, `avoid_reinforcing_bullying`, and `choose_a_safe_next_step`. Every scenario uses the same definitions. Learner enrollment initializes progress idempotently. History provides analysis context; evidence must reference the current learner's contribution.
6. Replace authoritative participation state with `guard_mode: boolean`. Proposed/final decisions can use `raw_guard_mode` and `final_guard_mode`; historical message category remains separate. Store explicit provenance status for historical context when unavailable, independently of the current room's known boolean state.

# Ordered Implementation Steps

## 1. Establish contracts, baseline, and release ownership

**Dependencies:** supplied request and assigned strategy. **Deliverables:** a requirement/evidence ledger, affected-file inventory, live schema/dependency comparison, upstream manifest, and named batch owner.

Read applicable repository instructions and `docs/supabase-release-workflow.md` and `docs/browser-e2e-testing.md`. Inspect both projects directly with Supabase MCP: production `zgbufaxooqxeabewktzd`, staging `ciubrzggdqesgvfkpolj`. Inventory room/template fields, progress initialization and replay RPCs, `send_reviewed_tutor_response`, triggers, policies, approval authorization, and historical Riley data shapes using counts and metadata. Record inherited dependency versions and their release owners. Reconcile unexplained drift before preparing deployment SQL.

Pin Copilot scenarios, assets, role strategies, and prompt blobs to one commit; record hashes and intended handling of inconsistent upstander examples. Read `.env.example`, platform model selection, and transport limits; request missing required configuration. Establish phishing characterization fixtures covering ordinary and transfer paths, Guard, approval, and quick-adjust persistence. Prior 35-test evidence is baseline context only.

**Acceptance evidence (R1–R12):** every requirement has an owner, concrete contract, fixture, and environment check; migration mappings and unresolved provenance are documented; full affected lifecycle scope and production acceptance criteria are recorded.

## 2. Extract and verify the phishing adapter

**Dependencies:** Step 1's verified controller/service inventory. **Deliverables:** adapter contract, explicit factory, phishing implementation, characterization integration tests.

Move subject-specific construction out of `RoomContext.tsx`, `aiService.ts`, and `ecologicalTutorCall.ts` behind the typed boundary. Keep shared send, draft lifecycle, membership, and approval orchestration in place. Capture existing target-readiness and transfer-candidate behavior before changing the controller. The phishing adapter supplies its existing generation policies and supported operations; the shared controller consumes adapter results rather than rebuilding phishing prompts itself.

Use saved, attributed history as an explicit input and typed decision results as outputs. Keep persistence and reviewer authorization outside adapter code. Tests assert routing, payload contracts, state transitions, and error behavior across both legacy and transfer paths. Record mypy applicability for any Python refactor and execute it if applicable; execute TypeScript checks for the frontend/Edge changes.

**Acceptance evidence (R2, R6, R9, R10, R12):** existing phishing suites and new extraction integration cases pass; factory selection is authoritative; observed phishing publication/progress/Guard behavior is unchanged.

## 3. Prepare the single migration and atomic approval contract

**Dependencies:** Steps 1–2. **Deliverables:** one pending migration, explicit data-conversion manifest, updated room/template/message/audit types and RPC contracts.

Add immutable room/template practice identity, stable scenario/persona fields as needed, approved-message character metadata, and feedback fields for original/final character and text, tutor author, input-context linkage, and model/prompt/config provenance. Extend the existing atomic approval RPC with typed proposal data, ownership checks, expected draft/context version, and an idempotency identity backed by database uniqueness. Repeated identical approval returns the original publication; stale, conflicting, unauthorized, and rejected proposals cannot publish. Ensure reviewer-only feedback remains protected under actual combined RLS policies.

Convert room participation values using the inventoried mapping; update Guard-dependent RPCs, locks, replay triggers, exports, and audit fields together. Validate all legacy values before applying conversions. Preserve historical category and unknown prior-context provenance explicitly. Classify existing rooms/templates using inventory evidence; stop on ambiguous rows. Preserve Riley transcript text and attribution through a documented representation conversion with reconciled counts.

Validate a fresh hosted dump plus roles in isolated native PostgreSQL, including ownership, ACL, and settings equivalence. Demonstrate Red before applying the exact SQL and Green afterward under executor and application roles. Exercise permissions, frozen types, replay, duplicate/concurrent approval, transaction rollback, and data preservation.

**Acceptance evidence (R1–R3, R7–R10):** migration hashes, baseline/version metadata, conversion counts, unknown-provenance cases, and role/concurrency results are saved. Schema decisions match direct live inspection.

## 4. Implement Cyberbullying policies and learner progress

**Dependencies:** adapter and schema contracts from Steps 2–3. **Deliverables:** Cyberbullying adapter, pinned scenario configuration/assets, server dispatch and analysis changes.

Implement the one-call character/text proposal with stable role and persona attribution. Route it through existing server-key transport while loading authoritative room type server-side. Keep the complete saved history available; measure transport bounds and surface explicit context-size failures rather than silently losing history. Generate and regenerate using Cyberbullying configuration, preserving each role-selection strategy and recording changed prompt/model factors.

Adapt `assessment-api/index.ts` and verified progress RPC dependencies to select the correct analysis policy. Initialize all five targets per learner idempotently at the authoritative enrollment boundary, with a repair path for existing members encountered during rollout. Reuse `learningProgressTransitions.ts` and the progress panel; preserve phishing transitions. Validate evidence ownership, current-message attribution, quote/context linkage, event eligibility, and duplicate suppression. Carry pending Guard events through the inherited deferral/replay lifecycle using `guard_mode`.

**Acceptance evidence (R4–R6, R9–R10):** integration cases cover all five keys and role values, learner isolation, concurrent initialization, evidence rejection, retries, replay, reload, contradiction/repair, and Guard locking. Direct server calls resolve room policy and reject operations outside its supported contract.

## 5. Connect review, presentation, ratings, and templates

**Dependencies:** Steps 3–4. **Deliverables:** complete Cyberbullying learner/tutor/observer flow and durable projections.

Update `AISuggestionBox.tsx` and room wiring to expose character selection, text editing, regenerate, reject, send, and existing Guard override for Cyberbullying. Implement save learner comment → analyze/update progress → request suggestion → review/regenerate/reject/approve → rate stored response → continue. Persist review context without making suggestions visible in conversation. Regeneration advances the draft version; room/context changes invalidate stale results. Failed generation preserves recoverable review state and never publishes a partial output. A character override affects only the reviewed proposal.

Update `RoomPagePost.tsx`, `messagePresentation.ts`, `simplifiedAIContext.ts`, realtime projections, and `roomExportBuilder.ts` so character identity survives student/observer display, reload, history, and export. Keep ratings tied to the approved message ID and learner progress evidence in the appropriate export. Extend `TutorView.tsx` and template create/copy flows to retain practice/scenario/persona data and subject configuration. Reuse `transferAssessmentService.joinRoom` allocation/observer fallback and existing room/image services.

**Acceptance evidence (R1, R5–R9):** integration tests demonstrate edited approval, exactly one publication/audit transaction, author identity, stale/concurrent/failed operations, reviewer metadata access, template round trips, rating linkage, and consistent character projection across all surfaces.

## 6. Complete Riley retirement and documentation

**Dependencies:** inventoried conversion and passing shared-flow coverage. **Deliverables:** scoped cleanup diff, historical preservation evidence, updated closest documentation.

Apply the inventoried cleanup to `MultiAgentSuggestionEditor.tsx`, room draft handlers, `tutorDecisionContract.ts`, tag grammar, presentation/playback/rating branches, `multiAgentTutorPrompt.ts`, repair instructions, old configuration helpers, demo templates, and dependent tests. Preserve stored transcript content and historical research evidence through the approved mapping. Verify runtime references and use retained historical fixtures to demonstrate readable attribution after conversion.

Before each implementation commit review the closest Markdown or `claude_doc` documentation, update behavior/contracts and required date/commit metadata, and add the prescribed documentation record where applicable. Use `apply_patch`; preserve unrelated work. Test comments identify their covered file and purpose.

**Acceptance evidence (R3, R12):** runtime inventory is reconciled, historical-content fixtures pass, and documentation describes the implemented contracts and release evidence.

## 7. Verify and release exact integrated artifacts

**Dependencies:** Steps 1–6 and passing local deterministic/migration checks. **Deliverables:** staged and production batch evidence, exact artifact manifest, cleanup record.

Deploy validated SQL before dependent Edge functions to staging using supported MCP operations. Run full student/tutor/observer journeys for both practices with Guard, identity, progress, approval, ratings, images, templates, and reload. Run real-provider fixtures covering five roles, five targets, scenario fidelity, character selection, complete single-message output, and edited review. Save all inputs/outputs and configuration metadata outside version control when large; judge behavior separately from deterministic checks.

After staging passes, merge into `no_sign_up`, record the integrated commit and artifact hashes, and verify those exact integrated artifacts together on staging. Resolve inherited dependencies under the named owner. Promote only matching committed source to production; repeat complete affected journeys and scoped permission/concurrency checks. Record deployed versions, migration state, tests, failures, and fixture cleanup in both environments. Archive the migration only after both pass. An unresolved access or verification failure leaves production acceptance open with the precise next action.

**Acceptance evidence (R10–R12):** exact commit/hash correspondence, combined staging/production journey records, provider acceptance, and cleanup evidence support the release declaration.

# Risks and Mitigations

- Adapter growth: keep one fixed contract and two implementations; add methods only for demonstrated controller policy differences.
- Hidden phishing policy coupling: characterize both generation paths and test server dispatch plus regenerated request payloads.
- Historical ambiguity: stop conversion on unexplained values; reconcile counts and preserve unknown provenance.
- Approval races and broad policies: enforce authorization and uniqueness within the transaction; verify with real application roles and concurrent clients.
- Model or context limits: record provider/configuration changes and bound failures explicitly; require saved real-provider behavioral evidence before release.
- Shared deployment drift: one owner records dependency versions and revalidates changed artifacts/configuration before promotion.

# Validation Criteria

Completion requires R1–R12 evidence from the referenced steps: authoritative immutable type and template fidelity; Guard conversion/locks/replay/provenance; historical Riley preservation; five learner-owned targets with reliable evidence; five role strategies and one approved message; identical capability enforcement across UI/server; atomic authorized review; durable identity/ratings/exports; shared membership/transport behavior; deterministic and provider checks; exact integrated staging-to-production delivery; and maintained documentation. Every failed criterion records reproduction, affected artifact, and next corrective action. Production acceptance remains open until both practices' full affected journeys pass on the released artifact.
