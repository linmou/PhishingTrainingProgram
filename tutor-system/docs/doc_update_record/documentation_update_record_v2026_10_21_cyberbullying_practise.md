# Cyberbullying practise implementation

Intent: record implementation decisions and delivery evidence for the Cyberbullying practise batch.
Date: 2026-10-21. Baseline commit: 2807c52f3b3ee82f1e708b20740726a7a28e3912.
Branch: feat/cyberbullying-practise. Release owner: Codex /root.
Status: staging applied; implementation committed as e95a494. Remote verification changes are being integrated; production acceptance remains open.

## Scope and acceptance

Implement the audited worktree plan at plan/cyberbullying-practise/final_plan.md. The batch changes room identity, Guard contracts, scenario data, role-playing, learner progress, tutor review and message projections. Combined verification covers identity/permissions, lifecycle, shared orchestration and migration: complete student/tutor/observer journeys for both practice types on staging and production, with exact integrated staging artifacts before production.

Backend dependencies owned by this batch: existing approval and Guard RPC/trigger contracts, progress analysis/init/replay, membership allocation, assessment-api, ai-api, message/review projections. Application function definitions match between inspected staging and production; deployed Edge hashes remain to inspect.

## Inspected baseline

- Project-scoped MCP confirmed staging ciubrzggdqesgvfkpolj and production zgbufaxooqxeabewktzd. Both are accessible with the existing configured token. The generic connector reports production; the project MCP helper initializes a separate session for the selected environment.
- Live catalog inventory: all production public/private function definitions match staging by MD5. Database ACLs and some role settings differ and require environment-specific baseline treatment.
- Production rooms: 60 tutoring, 2 guard. Staging: 48 tutoring. Production message categories: 492 null, 39 tutoring, 2 guard, 5 assessment.
- Current approval RPC accepts p_tutor_id and checks room ownership by that supplied value. Existing Edge identity uses x-application-user-id and stored profiles; browser identity originates in local storage. Public ALL policies currently cover rooms, messages and review feedback.
- Identity decision: user explicitly chose the current identity model and requested all relevant plan changes. Ownership checks use the supplied application-user ID plus stored profile/room membership; review presentation and database permissions follow the existing platform. Request, draft and final plan are amended; the original audited snapshot is preserved separately.
- SocialMediaCopilot pinned commit: 89e7fda14b9a330c1ae796ca605971a7dc7b1b9b. Scenario blob fc9d5da2ca21e60663dfc0362917d5a0e62fed1d; role-strategy blob 354f31a8158b66142414db72979fd3c32a2bcc8a; profile blob 8b0cf5a28f3606c94f560ebc2e57b243609c7b7d. Two scenarios are present. Local upstream README changes are unrelated and retained.

Full catalog evidence is local under plan/cyberbullying-practise/implementation/. It contains schema/function metadata and aggregate counts.

## Local evidence

Baseline command: CI=true with dummy Supabase URL/key; npm test -- --watchAll=false --runInBand --runTestsByPath covering RoomContext.quickAdjustPersistence, aiService.multiAgentRequired, RoomContext.transferDraftLifecycle and aiService.parameterOverrides.
Result: exit 0; 4 suites, 35 tests passed. Existing React act deprecation and mocked-table console warnings remain baseline observations.

Fresh configured exporter succeeded to /Users/admin/.cyberbullying-practise-pg17/phishingtutor.dump. PostgreSQL 17.4 source; 17.11 client. Archive parse validation succeeded.
SHA-256: 62110ae829f96072657620ca14ce8dcc4674b62a198c166b199656497b91ef38.
Fresh role export succeeded to source-roles.sql.
SHA-256: 33752f7bbc51f9c03cc55ecc6e5eb2788eeccb901f2acf1375ab5c7782cc82b6.
The isolated PostgreSQL cluster uses socket /Users/admin/.transfer-assessment-pg17/migration-validation/socket, port 55433, executor postgres, and a separate local_bootstrap restore administrator. Candidate databases 2–6 were restored separately. Candidate 6 accepted the exact pending migration and the SQL behavior suite, including proposal ownership, duplicate/conflicting approvals, stale results, target initialization, Guard deferral/replay and actual-role write-gate checks. Full baseline equivalence remains open: the database originally named cyberbullying_baseline_20261021 contains earlier candidate changes and is not a pristine Red target. Fresh validation database 7 is being restored for catalog parity and Red/Green.

Focused frontend evidence includes 17 room-template tests (both imported scenarios, retained attribution, template reuse and failed catalog loading), Cyberbullying proposal lifecycle tests, target progress/export tests and shared Guard tests. The latest three-suite regression run passed 13 tests. The assessment Edge suite passed 40 tests; the AI Edge suite passed 13 tests. These counts describe separate runs, not a single full-suite pass.

The broad changed-file Jest run reported 95 passing suites and 31 failing suites, with 1,203 passing and 81 failing tests. Running the same failing suites on the original baseline reported 70 failing tests; feature-introduced failures were corrected and focused suites rerun. The broad result is not a green release gate. The initial JSON report write failed because its output directory did not exist; the preserved rerun is tutor-system/output/cyberbullying-jest.json. Baseline comparison is /tmp/cyberbullying-baseline-jest.json. A production build passed before the latest progress and cutover changes; a final build is still required. TypeScript runtime sources checked clean; pre-existing test typing errors remain under comparison. This change contains no Python modules.

## Implemented behavior

Rooms and templates carry immutable practice_type and a complete scenario_config. The two situations, images and five-character strategy come from the pinned upstream commit. One stored proposal produces one reviewed message. Tutor edits, character selection, regeneration, rejection, approval, Guard override and rating retain the current workflow. Regeneration retains the selected character; subsequent new suggestions allow a new choice. Scenario and persona attribution, five canonical learner targets, target version and progress evidence are retained in exports.

Cyberbullying analysis uses the current learning transition engine with subject-specific prompts and all five targets. Provider requests and outputs are audited per target. A failed target prevents partial progress application; retries remain available. The role-playing prompt preserves the upstream strategy, including its contradictory constructive-upstander examples; provider behavior still requires semantic acceptance. Raw Guard is the stored room Guard value, with tutor override available during review.

Identity follows the user's chosen existing application model: browser-supplied application UUID, stored profile and membership checks, and owning-tutor checks. Proposal storage is service-only; approved publication records both character identity and human reviewer identity.

The coordinated cutover uses scripts/database/practice-write-gate.sql. It closes application writes before the schema contract changes, then requires x-practice-contract: cyberbullying-v1 after reopening. Clients and dependent Edge database calls send that header. Local tests exercise closed, stale-client and current-client behavior under anon, authenticated and service_role. Hosted cutover, concurrency rehearsal and recovery evidence remain open.

## Deployment inventory

The user selected the Render PhishingTraining workspace, tea-d1pj1fbuibrs73dqa67g. Frontend service srv-d1pjtjnfte5s73ce0opg is a static site at https://phishingtrainingprogram.onrender.com, repository linmou/PhishingTrainingProgram, branch no_sign_up, root tutor-system, build npm run build, published directory build. Auto-deploy is enabled. Observed live deployment dep-dbc7rtlg1s2s738h181g runs commit 23a41af4608092ea2733eb8aa3e87e608dcda335. Local no_sign_up and origin/no_sign_up have diverged; integration must preserve the locally committed released dependencies as well as remote verification-isolation work. Pushing the integrated branch will trigger frontend deployment and must be coordinated with the database gate.

Observed Edge versions before this batch:

| Environment | Function | Version | Bundle SHA-256 |
| --- | --- | --- | --- |
| Production | assessment-api | 14 | 2ca7e7edc74a45197ae9e77df734f3bfa87d19b74e8cabf5c4315422bfa83cb6 |
| Production | ai-api | 3 | 7569b0bfd3b2a9687582edc549f10669b59ecf11979d857fdefbc9b8c6f1e567 |
| Staging | assessment-api | 64 | c525ff9292b0a3a60c76b5d3c1f840974193cca07be36a9a87f82278b436813d |
| Staging | ai-api | 4 | 2f8f71da626770d122be8b15fd112a40fa546cf667520f62e571fd5d634ef8ec |

All four are active with verify_jwt=false. Different bundle hashes alone do not establish source divergence. Production function sources were retrieved through MCP; complete source comparison and a final integrated artifact manifest remain open.

Inspection retries: initial staging call required MCP initialization/session header; initialized request then returned the correct staging URL. Initial catalog query used the older daticulocale column; corrected to PostgreSQL 17 datlocale. Initial hash command encountered host locale configuration; LC_ALL=C succeeded.

## Delivery gates

The final local migration cycle used cyberbullying_validation_20261021_8. Source-equivalent schema owners/ACLs, default grants, 35 policies, 50 functions, 78 indexes, 124 constraints, six relevant role attribute sets and both extension versions match after canonical ordering. All 13 effective role memberships match; their local grantor is local_bootstrap rather than supabase_admin. The candidate neither changes nor revokes role membership, so this attribution difference does not affect the exercised permissions. The pristine Red assertion failed at rooms.practice_type as expected; the gate, migration and behavior suite then passed. Hashes of preserved room fields/Guard state, messages, reviews, templates, checklists, items and evidence match before and after. Concurrent joins produced five targets; concurrent approval produced one publication and review; cutover waited for an in-flight write and blocked the next one. Full catalog and data-hash evidence: /Users/admin/.transfer-assessment-pg17/runs/cyberbullying_practise/20261021-local08/record.json, source-catalog.json and restored-catalog.json. Query/harness sources remain under plan/cyberbullying-practise/implementation/.

Validated SQL SHA-256: 24129c655febc2dd7f814f22a5a0b18e74b5cc25d320c289aa87e0e92472a267. Write-gate SHA-256: aba98b318162c28b865d23cbfb2e5d9fc38b0161db57855385eed54fe787ff95. Later edits require a new manifest and affected validation.

Both environments' retrieved Edge source files match byte for byte (two ai-api files and ten assessment-api files), despite different bundle hashes/version counters. The staging Riley inventory remains zero in all six categories. Staging migration history before this batch contains remote_schema, version 20260929035556.

Real-provider role probes: 13 cases across both situations, four learner stances and all five explicitly selected characters. All returned valid structured replies. The first run exposed two grounding defects in forced victim/educator replies. The supervised adapter was amended to acknowledge support already offered and avoid inventing learner attacks, keeping the upstream strategy text unchanged. The second run corrected those observed defects. Raw directories: tutor-system/output/cyberbullying-role-provider-2026-10-21T09-07-51.807Z and cyberbullying-role-provider-2026-10-21T09-08-42.719Z. This is a focused product behavior probe with manual review, not a statistically calibrated benchmark. Target model/settings are preserved in every request; the changed factor was the adapter instruction and its version, now copilot-89e7fda-supervised-v2.

Real-provider progress probes ran all five canonical targets for three contexts. Relevant learner evidence yielded five target events (four demonstrated_understanding, one initial_signal); an unrelated learner reply and character-only evidence each yielded zero events. Full requests, responses and proposed events are under tutor-system/output/cyberbullying-progress-provider-2026-10-21T09-09-32.937Z. Native SQL tests separately verify event persistence, idempotency and Guard replay.

Latest deterministic checks: 53 Edge tests passed together; four focused frontend suites passed 27 tests; browser runner unit suite passed 20 tests after updating its workflow registry expectation. A refreshed production build passed with the existing lint warnings, asset main.3d69da71.js, before the final source-comment-ID and capability UI edits. The staging candidate dev server compiled with no TypeScript issues after those edits.

The operation ledger is in docs/cyberbullying-practise.md. The staged rollout and forward-recovery procedure is in docs/cyberbullying-cutover.md. Staging browser source includes the new cyberbullying workflow with scenario creation, progress, role regeneration/editing/approval, rejection, ratings, observer access, reload and export assertions.

Pre-cutover staging inspection found broader grants on three legacy assessment functions: post_assessment_message_v1, process_assessment_message_v1 and send_reviewed_tutor_response_v3. Function definitions, object permissions, constraints, indexes and policies otherwise matched production. The migration now explicitly retains production's permissions for those legacy entry points. A fresh database, cyberbullying_validation_20261021_9, reproduced the staging grants; all source catalogs matched that staging fixture, Red/Green and concurrency passed, and preserved-data hashes remained unchanged. Current migration SHA-256 is bf2827da65648bdad8324eaec863b71983b9793876ec2885728f81a05d2c6a9a, replacing the earlier local08 candidate hash.

Staging application on 2026-10-21 succeeded through project-scoped MCP: write gate, closed-gate anon assertion, exact migration, complete transactional SQL behavior suite, assessment-api v65 and ai-api v5. Deployed source retrieval matched every uploaded file byte for byte. assessment-api bundle SHA-256 d53ecff95632692dba9aacab86250808c28f19b6fd90b51f237fe096ed4e68fd; ai-api bundle SHA-256 c096b691113726302b6ac9433d9acda0eb7f30ed7922fb4f97d5cb08f9b5a2a4. The gate was reopened with required_contract=cyberbullying-v1. Candidate frontend http://localhost:3217 compiled with explicit staging configuration; the Cyberbullying browser journey is running. Production is unchanged.

Staging browser/remaining provider acceptance, integrated no_sign_up staging verification, production release/journeys and cleanup remain open. Release trigger: all members and dependencies merged and exact integrated artifacts accepted on staging.

## Staging failure and repair

Run staging-template-20261021092143-3d966f8c failed waiting for progress. Five provider calls completed; two quotes combined noncontiguous passages and failed the existing exact-substring validation, so no partial progress was committed. Full provider audit was saved beside that run as provider-audit-failure.json. Its room cleanup also failed because provider audit foreign keys prevented deleting the room. These failures remain recorded in the original report.

The analyzer now requests a contiguous quote and allows one format repair for Cyberbullying only. Both attempts retain their per-target audit identity and ordinal. HTTP/network/truncation failures still surface, and all target calls settle before application. A deterministic noncontiguous-quote test was added; the combined Edge suite now passes 54 tests. Repeated real-provider probes under tutor-system/output/cyberbullying-progress-provider-2026-10-21T09-27-50.357Z produced five relevant learner events and zero unrelated/character-only events.

The room-cleanup repair deletes provider audits, checklist update links and evidence in order before the room cascade. Its internal Guard exception is limited to deleting records for that room under the cleanup function's postgres identity. Local SQL checks include deleting a Cyberbullying room with evidence and provider audit while Guard is active. Initial local cleanup attempts exposed evidence cascade ordering and a Guard-protected audit-link update; both were corrected before staging deployment.

Fresh database cyberbullying_validation_20261021_13 passed catalog parity, missing-behavior Red, the complete two-transaction migration, all behavior/permission/cleanup assertions, concurrency rehearsal and unchanged-data hashes. The base section remains byte-identical to bf2827da65648bdad8324eaec863b71983b9793876ec2885728f81a05d2c6a9a. Repair section SHA-256: 035b3a54194e38b517c8cd37a53583c2182aa57d9c60db46227e50bfd62a2ce6. Complete pending artifact SHA-256: ca0c1424f18f79c8d16a112ae108e9cf03fa4b9a243de4f51d8c1decfd47c596. The gate spans both transactions; recovery after the base commits uses a forward fix.

Staging was gated again, the exact repair section applied and the updated transactional SQL suite passed. assessment-api v66 is active, bundle SHA-256 271371d9b6a16a9f6e0407b272303af0e9be37e34d1f90913210b9087f71a123, with every deployed source file matching its upload. Its entrypoint source SHA-256 is 47134e7ec929faa7983f9d5afc76b928fba1ec7c9488d9712fb3ec44108aef98. The failed fixture room e853aeb1-8818-4b1f-9e78-7fcd06e269f4 was deleted after preserving evidence; MCP verified zero remaining provider attempts, messages and checklists. The gate reopened at contract cyberbullying-v1 and browser run staging-template-20261021093106-f7234920 began. ai-api remains v5; production remains unchanged.

## Browser acceptance and integration preparation

Cyberbullying passed in staging-template-20261021093106-f7234920. Visual inspection then identified damaged upstream images. All eight originals were recovered from upstream parent 1ee51e5c95f9c4fd3ed7ab2988e3bd90ef9a27dd; UTF-8 conversion of each recovered image reproduces the pinned commit's damaged bytes. Asset hashes and provenance are in public/cyberbullying/asset-manifest.json. The strengthened browser run staging-template-20261021094025-048deb58 passed the complete journey and image decoding assertions; its tutor screenshot was inspected. Both runs cleaned their rooms successfully.

Shared phishing tutor response passed in staging-template-20261021093258-25f712b0. Guard entry, continued Guard, recovery, reviewed publication and audit passed in staging-template-20261021093530-22fef044. Its preceding run failed an obsolete test parser that still expected a string mode. All fixtures were cleaned.

Assessment run staging-template-20261021093431-67b077dc timed out at terminal feedback generation before any provider call; its rerun passed that step for both pass and failure outcomes. The rerun staging-template-20261021094106-4613785b then failed a recovery-fixture SQL statement assigning string 'guard' to the boolean column. The fixture now uses true/false. The tutoring helper waits for the latest learner message to be visible and records browser errors for future diagnosis. A complete rerun is required; the first timeout is retained as an intermittent observation rather than claimed fixed by a passing retry. All failed-run fixtures were cleaned.

The final candidate build passed with existing lint warnings, asset main.4b8671b3.js. Browser harness unit tests passed 20/20. The release still requires integrated source comparison, remaining staging journeys and production acceptance.

The complete assessment-answer rerun staging-template-20261021094231-e7a86eb1 passed answer success, retry/failure, terminal feedback, Guard deferral/recovery, trusted-history cleanup and cancellation; all four fixture uses cleaned successfully. TypeScript comparison reports 468 test-only errors in both candidate and baseline and zero runtime-source errors. Full logs are output/cyberbullying-tsc-candidate.log and cyberbullying-tsc-baseline.log.

Integration includes origin/no_sign_up at 23a41af and its fixture-lock/export-isolation work. The only manual conflict was release-workflow prose; both the merge-before-production gate and the shared staging queue limit are retained. The merged runner and fixture-lock checks passed 24 tests. Export-isolation tests initially encountered the host's unsupported C.UTF-8 locale; rerunning those two tests with LC_ALL=C is the documented environment correction. Assessment delivery now uses the merged fixture lock. No runtime application, Edge or SQL artifact changed during this merge.

Local no_sign_up fast-forwarded to integrated commit aec5b5a68406704dad87b4c34c550ba9f79877f3. Its 310-file manifest is output/cyberbullying-integrated-manifest.json (SHA-256 877c11271197fc23dab81bea454e560a98134084fa5283f7d5636b6dbf2def93). Production MCP catalog reinspection matched all ten baseline inventory sections exactly. Both exporter tests passed with LC_ALL=C.

## Phishing progress dependency correction

The full delivery journeys staging-template-20261021094454-225e00f2 and staging-template-20261021094620-56c879c4 failed on the initial learning-progress judgment. The provider credited unmentioned targets and sometimes classified a complete narrow action as partial. Both runs cleaned successfully. Replaying three targets with the previous dialogue metadata reproduced the incorrect unrelated credit, so character metadata did not explain the failure. Full requests/responses are in output/phishing-progress-diagnostic-2026-10-21T09-47-14.390Z.

A focused diagnostic repeated the exact target in a final provider instruction. It yielded one correct account-check event and no events for unmentioned domain recognition or two-factor setup. The alternative model probe still credited an unmentioned target; the deployed model remains qwen3.5-flash. Diagnostic evidence is output/phishing-progress-diagnostic-2026-10-21T09-48-00.651Z. This is manual semantic acceptance of three observed cases, not a broad accuracy claim. The final instruction follows existing state eligibility and applies only to phishing analysis; Cyberbullying requests remain unchanged.

All 54 deterministic Edge tests passed with --allow-env --allow-net --allow-read --allow-run. An initial invocation omitted --allow-run and failed the existing subprocess type-check test; rerunning with its required permission passed. Staging assessment-api v67 is active with exact source retrieval match, bundle SHA-256 3e399fbbeaa61eb7c020d7b3eae80506e9f96bb23a45df9442a8ff43f208701c and entrypoint SHA-256 b0dbd353ffacc0ae2f542d8024b0b02b8b730dd78aedb0dea3cfe7996bf7e70c. The full delivery journey is rerunning; this correction requires a new integrated manifest before production.
