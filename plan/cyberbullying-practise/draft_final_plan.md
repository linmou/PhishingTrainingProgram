# Cyberbullying practise execution plan
Intent: extend the existing supervised learning platform with Cyberbullying practise through a small, verifiable change to its current workflow.
Date: 2026-10-21. Identity amendment: user-directed inheritance of the current platform identity model. Baseline: 2807c52f3b3ee82f1e708b20740726a7a28e3912.
Worktree: /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/cyberbullying-practise
Branch: feat/cyberbullying-practise.

## Selected architecture and provenance
Backbone: [candidate 1](candidates/plan_1.md), inline-room-dispatch, steps 1–8. All five independent judges ranked it first: rank sum 5, rubric sum 143, five first-place votes. The fixed ranking rule selects it ahead of plans 2/3/4 (rank sums 10/15/20). See [ranking evidence](judgements_1st/summary.md).

Retain RoomContext, existing AI service dispatch, server-side AI transport, progress storage/panel, and the shared atomic approval RPC. Add explicit subject branches at their existing integration points, with small helpers for prompt construction and validation. Server handlers derive subject and permitted operations from the stored room and the existing application-user/profile/membership model.

| Imported source | Exact benefit | Insertion point |
|---|---|---|
| plan_2.md, steps 1–2 | Characterize ordinary and transfer phishing paths before shared changes | Step 1 fixtures and step 6 regressions |
| plan_2.md, Major Decision 3 | Frontend/Edge contract parity across build boundaries | Steps 2 and 6 |
| plan_2.md, step 4 | Full-history overflow failure and concurrent existing-member initialization | Steps 3–4 |
| plan_3.md, Major Decision 3 and step 4 | Stable persona identity, saved-comment recovery and delayed-result protection | Steps 2, 4–5 |
| plan_3.md, Validation Criteria | One acceptance row per requirement | Final traceability table |
| plan_4.md, Major Decision 4 and step 3 | Authoritative proposal owner/revision/status/context; typed conflict results | Steps 2–3 and 5 |

These safeguards fit existing handlers and storage; inspect reusable fields before extending them. Candidate 2's extraction-first adapter prerequisite, candidate 3's separate controller, and candidate 4's new practice-turn orchestration API are rejected because they assign workflow ownership differently and enlarge the chosen implementation. Candidate key spellings are alternatives; use the five keys below consistently.

## Product and data contracts
- Rooms/templates use immutable-after-creation `practice_type: phishing | cyberbullying`. Preserve complete scenario text, original post/image, initial comments, scenario ID and persona ID through creation/copy/export.
- Participation uses authoritative `guard_mode: boolean`. Review decisions use `raw_guard_mode` and `final_guard_mode`. Preserve existing Guard semantics, locks and replay. Historical message category remains a separate field. Unknown historical context provenance is explicitly nullable/unknown.
- Every Cyberbullying scenario uses the same five definitions: `recognize_cyberbullying_impact` (recognize cyberbullying and impact), `show_empathy_support`, `stand_up_constructively`, `avoid_reinforcing_bullying`, `choose_safe_next_step`. Each has a concise shared description and stable version.
- Character values are `same_age_peer`, `older_peer`, `victim`, `bully`, `educator`. A role-playing call selects one character and one complete text; approval publishes one message.
- Supported Cyberbullying operations: save learner comment → analyze/update progress → request suggestion → review character/text → regenerate, reject or approve/send → rate → continue. Tutor response controls: character selector, text editor, regenerate, reject, send, and existing Guard override. Character configuration supplies style behavior. Enforce this closed capability contract in both UI and backend.
- A tutor's character choice applies to the current proposal; regeneration retains an explicitly edited choice. A subsequent conversation proposal resumes scenario role selection. Guard override is independent of character choice.
- Ratings attach to the approved message ID. Model character/persona and the recorded human tutor application-user ID remain distinct.
- Identity follows the existing name-and-role entry, browser-stored application-user ID, x-application-user-id header and database profile/membership checks. Ownership checks compare the supplied application user with the stored room tutor. Review details use the existing tutor-facing presentation and server permission model.
- Existing phishing operations and progress semantics remain the regression reference.

## Assumptions and execution gates
Request A1–A8 remain explicit assumptions. The future implementation agent owns release batch `cyberbullying-practise`, subject to a recorded handoff from an active shared-environment owner. Progress RPC/replay reuse, historical conversion, staging access, provider fidelity and upstream assets require step 1–2 evidence. Project-scoped MCP access to staging and production was verified during implementation. Live schema and deployed-artifact checks remain release prerequisites.

Implementation is authorized by the user's follow-up. The user subsequently chose inheritance of the current identity model. The initial audit applies to the preserved draft01 snapshot; this identity amendment is an explicit user decision. Implementation evidence is tracked in the dated release record.

## Ordered execution

### 1. Establish baseline, dependency ownership and conversion mappings
Dependencies: designated worktree and request.md.

Read applicable AGENTS, release workflow and browser-testing guide. Inspect staging `ciubrzggdqesgvfkpolj` and production `zgbufaxooqxeabewktzd` directly with Supabase MCP. Record schemas, policies, functions, config versions and drift for rooms/templates, membership/allocation, approval, progress, Guard locks and `private.replay_transfer_guard_events`. Assign each inherited backend dependency a release owner and exact version.

Create an operation-to-handler ledger: every UI/direct-call entry point, authoritative room lookup, actor check, capability check, prompt/context construction, persistence boundary, failure result and integration test. Trace RoomContext checklist lookup, legacy analyzer fallback, target readiness and transfer-candidate preparation; aiService/ecologicalTutorCall; assessment-api; AISuggestionBox; StudentAIToneControl; projections and exports.

Inventory Riley runtime references and stored formats by counts/schema. Record files and conversion mappings, distinguishing historical research evidence. Establish a Guard truth table from actual semantics, including raw/final decisions, old multiplexed message categories, and unknown context provenance. Resolve unexplained data before conversion.

Capture deterministic characterization fixtures for ordinary/transfer phishing generation, regeneration, approval, parameter persistence, Guard, progress and allocation. Verify provider configuration through .env.example; request any required missing settings. Resolve new TypeScript-file header requirements against CRA compilation before adding files.

Deliverables and acceptance: baseline manifest, dependency owners, operation ledger, passing baseline fixtures, Guard mapping and Riley preservation ledger. A tool/access or ambiguous-data failure is an explicit unresolved prerequisite with its remedy.

### 2. Pin content and finalize typed contracts
Dependencies: step 1 inventory.

Resolve one coherent upstream SocialMediaCopilot commit and hash complete scenario assets. Map posts/images/comments/personas into existing storage. Document each role-selection strategy, original examples and any proposed semantic correction for explicit review. Record provider/model differences as changed behavior factors.

Extend room/template, generation, analyzer, proposal and approval contracts. A proposal needs room, stable identity/revision, linked learner message and saved-context revision, owner, generation status, original and edited character/text, original/final Guard, terminal review outcome and replay identity. Record prompt/model/config version and the tutor application-user ID checked against the room owner. Reuse existing fields where sufficient.

Validate role enum plus nonempty complete text; maintain server-owned input/context provenance. Define typed recoverable provider failures and stale/ownership conflicts. Specify frontend/Edge parity tests when direct shared imports are impractical. Scenario/persona IDs survive display-name changes.

Deliverables and acceptance: pinned asset manifest, template round-trip fixtures, canonical targets, role strategies, payload examples and proposal transition table. Review changed factors: prompt, role strategy correction, history format, model and target analysis. Each maps to step 7 behavior checks.

### 3. Prove schema, approval authority and a coordinated cutover
Dependencies: accepted mappings/contracts from steps 1–2.

Prepare one pending SQL migration. Add immutable subject, inventory-backed phishing backfill, Guard boolean conversion across tables/functions/triggers/audits, character/provenance fields and learner progress initialization constraints. Convert stored Riley formats while preserving transcript bodies, attribution and necessary provenance; compare counts and content hashes. Unknown values retain explicit unknown provenance.

Extend `send_reviewed_tutor_response` and associated existing handlers: load room identity; check the supplied application-user ID against the stored tutor profile and room ownership/membership; validate supported decision, current proposal/revision/context, terminal status and original/final metadata. Atomically insert one message and review and update applicable Guard state. Duplicate/concurrent approval reuses the accepted result or returns a typed conflict. Preserve existing database permissions and tutor-facing review presentation. Test wrong-profile, wrong-room and capability checks at the existing RPC/Edge boundary using the platform's current identity convention.

Make target initialization unique per learner/room/target/version, idempotent on join/reload and able to repair eligible existing memberships. Preserve existing Guard evidence deferral/replay transaction guarantees.

Define the deployment cutover in the migration artifact's runbook: SQL precedes dependent Edge and frontend. Inspect old-client/old-function compatibility explicitly. Use a bounded maintenance/write gate during the contract switch, drain active approvals, deploy the coherent schema/server/client set, and require stale clients to reload before writes resume. The gate must cover direct writes and RPCs; prove its enforcement under actual application roles. Keep one authoritative Guard field. Record restoration/forward-fix procedure and fresh backup metadata; never restore over accepted new learner writes. If the existing infrastructure cannot enforce the gate, resolve that prerequisite before scheduling cutover.

Use native PostgreSQL with fresh hosted dump and roles, equivalent ownership/ACL/settings baseline, failing Red tests then exact-SQL Green under migration executor, anon, authenticated and service roles. Cover conversion counts/hashes, subject immutability, permission boundaries, progress isolation, Guard locks/replay, rollback and concurrent approval. Follow repository release workflow; store snapshots outside Git.

Deliverables and acceptance: SQL hash, baseline equivalence, Red/Green integration evidence, tested cutover/recovery runbook and data preservation ledger. Application implementation can proceed against the validated local schema; hosted mutation waits for step 7.

### 4. Implement progress and role-playing in existing orchestration
Dependencies: steps 2–3 contracts/local schema.

Update room/template creation in supabase.ts and TutorView. Reuse membership, images, joinRoom allocation and observer fallback. Initialize/repair the five learner-owned targets through the server on join/reload, including concurrent joins.

In RoomContext, branch on authoritative practice_type before the checklist/fallback/readiness/transfer-preparation paths. For Cyberbullying, save the learner comment first, then analyze it against each shared target using attributed saved history as context. Reuse assessment-api event validation and learningProgressTransitions after adapting subject instructions. Evidence quotes must belong to the current learner's current contribution. Preserve eligibility, contradiction/repair, idempotent event identity, Guard deferral/replay and learner isolation. All five target analyses settle before marking this analysis attempt processed; failed targets remain retryable without duplicating successful events.

Branch aiService and all regeneration paths before phishing policy assembly. Reuse server transport/provider keys. Load full saved history with stable author/persona attribution; address the current 30-message and body-size limits explicitly. Measure payload/model bounds; return a visible recoverable context-size failure if full context cannot fit. Preserve saved data and proposal state on downstream analysis/provider failure. An analysis retry resumes unfinished work; generation retry does not resave the learner comment.

Validate one role/text result and retain unpublished provenance. Reject delayed results when linked context or proposal revision changes. Next proposals use the scenario strategy; edited current-proposal character guides regeneration.

Deliverables and acceptance: integration coverage for join/reload/concurrent repair, all five targets and role values, evidence attribution, repeat/retry and Guard replay, over-limit history, malformed/provider failures and stale results. Assert state/contracts and publication counts.

### 5. Wire tutor review, ratings and shared projections
Dependencies: step 4.

Dispatch the exact controls/operations in the product contract. Review/edit/regenerate/reject/send uses versioned proposals and independent Guard override. Each backend entry independently derives capabilities from the persisted room, including direct calls whose prompt labels, claimed role, practice type or character metadata conflict with stored room/profile data.

Update RoomPagePost, messagePresentation, simplifiedAIContext and roomExportBuilder plus realtime projections to retain approved character/persona. Student/observer/reload/history/export must agree with stored message identity. Keep ratings tied to that message and preserve the recorded tutor application-user identity. Export durable target progress/evidence through existing export permissions; present review metadata through the existing tutor interface.

Deliverables and acceptance: integrated tutor override/regenerate/reject/send journeys, role/identity matrix, wrong-room/ineligible-profile/stale/duplicate/concurrent direct calls, atomic rollback, tutor-facing metadata presentation, rating linkage and export round trips. A rejected/unpublished proposal never enters the public transcript.

### 6. Reconcile cleanup, run deterministic regressions and update docs
Dependencies: steps 3–5.

Reconcile Riley inventory across editor/wiring, draft handling, tag grammar, playback/rating cases, prompt/repair instructions, type/config helpers, demos and dependent tests. Apply the inventoried content-preserving conversion before retiring decoders needed by stored records. User-file removal follows repository permissions; remove legacy runtime functionality within the authorized inventory and retain historical evidence.

Run affected Jest/BDD integration suites, TypeScript checks and production build. Include both phishing paths and full operation-ledger coverage. Test canonical contract parity across frontend/Edge, stored-data migration fixtures and new failure paths. New tests start with covered-file/purpose comments and validate behavior rather than model wording. Record mypy applicability for TS-only changes; run it on any Python refactor.

Update closest relevant Markdown/docs before each implementation commit; include required date/baseline commit and documentation update records where applicable. Use designated text-editing tooling, rtk commands and preserve unrelated work.

Deliverables and acceptance: completed inventory, passing deterministic report with commands/versions, all operation-ledger tests, preserved history evidence and current docs. Any new changes invalidate affected evidence.

### 7. Deploy staging and accept behavior
Dependencies: steps 1–6 passing; named owner and staging access confirmed.

Owner applies tested cutover, exact SQL then dependent Edge/frontend on staging. Record source/artifact/config hashes and all inherited dependencies. Run complete student/tutor/observer journeys for both subjects: new/migrated room/template, join/allocation, Guard override/locks/replay, saved comments, progress, tutor editing/regeneration/rejection/approval, stale/concurrent calls, ratings, reload/realtime and exports. Verify maintenance gate and stale-client transition, then cleanup fixtures with recorded counts.

Run real-provider cases spanning every role and target, constructive support, ambiguity and contradiction/repair. Judge role-strategy fidelity, coherent attribution, evidence relevance and one-message proposals. Record human-reviewed acceptance separately from deterministic tests. Preserve every input/output pair, saved context, model/prompt/config hashes, changed factors, judgment, failure and retry; store large/sensitive evidence outside Git.

Deliverables and acceptance: staging manifest, complete journey and cutover evidence, provider acceptance, fixture cleanup. Fix failures and repeat affected checks before advancing.

### 8. Integrate, reverify and release
Dependencies: accepted staging evidence and inherited dependencies ready.

Merge into no_sign_up. Record integrated commit and artifact hashes; deploy/verify the exact integrated artifacts together on staging. Revalidate changes from merge, dependency or configuration drift. Production source must match the committed, staging-accepted release.

Owner repeats tested cutover and SQL-before-Edge order in production. Run complete affected journeys for both subjects and selected real-provider acceptance with controlled fixtures. Record source/version/config, database change, all checks and cleanup for both environments. Archive SQL after both pass, retaining at most one pending migration.

Deliverables and acceptance: production acceptance ledger and updated delivery docs. A deferred batch retains owner, exact versions, merge status, open checks and concrete release trigger. An external failure records exact action, deployed state and remedy. Completion requires production verification.

## Material risks and controls
| Risk | Mitigation and evidence |
|---|---|
| Hidden subject coupling across shared paths | Step 1 exhaustive ledger; steps 4–6 branch and direct-call contract tests |
| Live schema/permissions or replay differ | MCP baseline, native actual-role/concurrency checks, both-environment journeys |
| Guard rename interrupts active clients | Step 3 enforced write gate and rehearsed coordinated cutover; stale-client checks |
| Historical content/unknown provenance lost | Inventory, explicit unknown mapping, counts/content hashes, decoder retirement order |
| Initialization/analysis retries duplicate or cross learners | Unique keys, per-target retry state and learner attribution tests |
| Stale proposals, concurrent sends or incorrect reviewer attribution | Revision/status checks, current-model room-owner checks, atomic approval and tutor-view tests |
| Full history exceeds transport/model capacity | Measured complete payload and recoverable failure; saved-data retention |
| Copilot strategy changes under platform model | Pinned assets, explicit changed factors and separately accepted recorded provider runs |
| Shared staging/integration invalidates evidence | One release owner, dependency hashes, exact integrated staging revalidation |
| Access or conversion prerequisite unresolved | Explicit blocked step and remedy; dependent deployment waits |

## Requirement-to-evidence traceability
All evidence listed is prospective implementation acceptance.
| Request | Executable steps | Required acceptance |
|---|---|---|
| R1 subject/scenarios | 1–4, 7–8 | Immutable type, evidence-backed old rows, full asset/template round trips |
| R2 guard_mode | 1–3, 5–8 | Truth-table migration, booleans across contracts, unknown provenance, locks/replay/cutover |
| R3 Riley cleanup | 1, 3, 6–8 | Inventory reconciled, stored content/attribution preserved, active contracts current |
| R4 five targets/progress | 2–4, 6–8 | Shared keys, owned initialization/repair, all-target evidence and retry/replay/reload |
| R5 role-playing | 2, 4–8 | Five roles/strategy fidelity, full history, server credentials, one approved message |
| R6 supported capabilities | 1–2, 4–8 | Exact control set, operation ledger, UI/backend direct-call parity, phishing regressions |
| R7 shared approval | 2–3, 5–8 | Atomic message/review/Guard, tutor edits and provenance, owner/revision/concurrency tests |
| R8 ratings/presentation | 2, 5–8 | Stored-message rating, persona consistency, existing export permissions and tutor-facing review |
| R9 shared platform | 1, 3–8 | Current identity/profile/membership model, allocation/images reuse, authoritative room routing |
| R10 verification | 1–8 | Deterministic/migration/browser/provider results distinguished; full live metadata |
| R11 delivery | 1, 3, 7–8 | Owner/dependencies, exact staging/integrated/production artifacts, cleanup and acceptance |
| R12 docs/workspace | 1, 6, 8 | Applicable docs/date/commit records, scoped changes, concrete deliverables per step |
