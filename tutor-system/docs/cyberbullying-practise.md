# Cyberbullying practise

<!-- Updated 2026-10-23; scenarios are global room templates, release acc3987 (PR #17). Verification: doc_update_record/documentation_update_record_v2026_10_23_cyberbullying_templates.md. Previous: 2026-10-22; identity fix release 8e5f880. AI generation and learner analysis pass the active room actor to progress transport so an already-open tab does not depend on a second localStorage identity read. Verification: doc_update_record/documentation_update_record_v2026_10_22_cyberbullying_identity.md. -->

Intent: describe the shared learning workflow and the contracts used by Cyberbullying rooms.
Updated: 2026-10-21. Browser-draft integrated release: `9c7364c`.

## Room and scenario

A tutor selects **Cyberbullying practise**, chooses a room template, edits its post or opening comments, and creates a room. The two imported scenarios are global room templates (system tutor ID) in the ordinary **Use Template** list; there is no separate situation selector. The room and reusable template store `practice_type` and the complete `scenario_config`. The practice type is fixed at creation. Images, source comment identities, authors and avatars remain attached to the template when comments are edited or reordered.

The first two templates (`copilot-1`, `copilot-2`) and the character strategy are pinned to SocialMediaCopilot commit `89e7fda14b9a330c1ae796ca605971a7dc7b1b9b`. Two further templates (`screenshot-1` "No one likes you…", `screenshot-2` theater invitation) were transcribed from screenshots on 2026-10-23, with photos and avatars cropped into `public/images/` (`black_sand.jpg`, `cinema_night.jpg`, `avatar_*.png`; not in `asset-manifest.json`, which covers only the restored Copilot-commit images). The seed migration `supabase/archived_migrations/20261023000000_seed_cyberbullying_templates.sql` inserts all four into `room_templates` with fixed IDs (idempotent) and is their source of truth. The source strategy remains in `supabase/functions/ai-api/cyberbullying.ts`. Its supervised adapter grounds examples in the actual learner contribution.

That commit damaged its eight binary images through UTF-8 conversion. The original images are restored from its immediate parent, `1ee51e5c95f9c4fd3ed7ab2988e3bd90ef9a27dd`. Reapplying the conversion reproduces each damaged blob exactly. `public/cyberbullying/asset-manifest.json` records source commits and restored SHA-256 hashes; the browser journey verifies all eight decode.

## Five shared learning targets

Every template initializes the same learner-owned inventory, version `cyberbullying_v1`:

1. Recognize harmful online behavior and explain its impact on the person targeted.
2. Acknowledge the targeted person's feelings and offer a concrete supportive response.
3. Challenge bullying calmly and respectfully, avoiding escalation.
4. Choose responses that avoid joining in, amplifying or rewarding harmful behavior.
5. Choose an appropriate next step, such as private support, saving evidence, reporting, blocking or seeking trusted help.

The first learner joining receives these targets. Rejoining reuses the same checklist; later learners observe that room. The current saved learner contribution supplies evidence. Initial comments and AI characters supply context. Progress uses the platform's existing status transitions, evidence records, idempotent analysis and Guard deferral/replay. All five target calls settle before progress is applied; failed analysis remains retryable.

## Tutor-supervised role-playing

The existing `ai-api` prepares one character reply from the stored scenario and complete saved conversation. The tutor reviews the text and character, can regenerate or reject it, and publishes through the shared approval RPC. Regeneration retains the selected character; a new suggestion lets the AI choose again.

| Character | Display identity |
| --- | --- |
| Same-age peer | Jerry |
| Older peer | Tom |
| Victim | Dylan |
| Bully | Sarah |
| Educator | Ms. Smith |

The original AI text and character, editable final text and character, Guard values and generation metadata remain in the browser until review. Reload or discard expires an unsent draft. Replacement records `ignored`, regeneration records `modified`, and rejection records `rejected` through the existing feedback table without publishing. Failed regeneration retains the current draft and selected character, following the ordinary phishing reply flow.

Sending atomically saves the message, review and final Guard state through the shared RPC. Unchanged text and character is `accepted`; editing either is `modified`. Guard rectification is recorded separately. Submission and retry behavior follows ordinary phishing sends. The saved message keeps both the human tutor ID and character identity. Ratings refer to that message ID. Realtime views, reloads and exports use the saved identity; tutor exports include original/final character and review linkage.

`guard_mode` is a boolean throughout the current room and review contract. The browser draft retains the room's Guard value at generation; the tutor can override it. Historical message categories remain available independently, and an unknown historic Guard value remains null.

## Operation boundaries

| Operation | Entry and authority | Persistence and recovery |
| --- | --- | --- |
| Create/reuse template | TutorView → room/template services; stored immutable practice type | Complete scenario, opening dialogue and images |
| Join/rejoin | assessment-api → `join_room_v1`; active application profile | Serialized learner allocation; five targets initialized once |
| Save learner reply | RoomContext → shared message boundary; active learner membership | Saved message precedes analysis; observers cannot contribute evidence |
| Update progress | assessment-api → context/apply RPCs; learner or owning tutor | Per-target provider audit, validated current-message evidence, atomic application and retry |
| Generate/regenerate | ai-api → `get_cyberbullying_context_v1`; owning tutor and enabled AI | Full saved context read without draft writes; browser request epoch protects against late results |
| Review/reject/replace | Existing `ai_suggestion_feedback` insertion; owning tutor and scoped learner message | Original/final text, character, Guard, action and reviewer; unsent reviews remain unpublished |
| Approve/send | `send_reviewed_tutor_response`; owning tutor and scoped learner message | Atomic message, feedback and Guard update, using browser-reported originals as phishing does |
| Guard override | Shared Guard service and reviewed-send RPC | Existing evidence freeze/replay |
| Rate/read/export | Existing message-feedback and view/export services | Approved message identity; canonical target keys, version and learner evidence |

Room identity determines the available operations. Context retrieval is service-owned; drafts remain in the browser. The platform continues to use its existing browser-supplied application-user identity, profile and membership conventions; ownership checks use that supplied identity. Assessment questions retain their separate private delivery lifecycle.

See the [cutover runbook](cyberbullying-cutover.md) and [browser-draft release record](doc_update_record/documentation_update_record_v2026_10_21_browser_draft.md) for verification and deployed status. The earlier proposal release remains documented in its historical release record.
