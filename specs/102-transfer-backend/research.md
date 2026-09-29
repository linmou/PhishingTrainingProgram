# Historical Design Research: Transfer Assessment Backend

<!-- Intent: preserve the source-backed decisions that shaped the local component-102 target. -->

This document records research and design choices for the local component-102 target. It is historical context, not a description of the current production database implementation; see [implementation evidence](implementation-evidence.md) for the production snapshot.

## Sources Reconciled

- Approved allocation packet V2 and server-authoritative-attempt decision.
- `assessment_ui_change.md` and revised component-103 specification commit `94f0dce`.
- Constitution version 1.0.0.
- Current browser-only service at baseline `d6e1a589893e72862955404c277f5eb65b6edc4f`.
- Historical component-102 package at `c6bc632`, including its superseded public-key tradeoff.
- Browser-only deletion commit `5a7f2a2` and migration-archive commit `732dbcd`.
- Current archived migrations 025-046 and existing transfer tests.

## Decisions

| Topic | Decision | Rationale | Alternatives considered |
|---|---|---|---|
| Attempt authority | Persist attempts server-side and treat them as authoritative across all browser lifecycles | Explicit user approval and constitution require one authority; local counters reset and race | Page-local or hybrid counters rejected |
| Storage | Add private delivered-assessment, append-only grading-attempt, and append-only provider-attempt rows | Key secrecy, row locking, idempotency, grading audit, full generation metadata, and terminal disclosure require durable private state | Public message key rejected; one opaque JSON blob rejected; deliverable draft workflow rejected |
| Public message | Store only the assessment stem in `messages.content`; keep immutable target `assessment_student_id`, ordered options, and selection type in structured public columns | Target identity lets 103 route controls after reload while preventing duplicate options; it is not authorization | Storing `rendered_text`, inferring the target from the message author/latest learner, and parsing options from text rejected |
| Private feedback | Return key plus `learner_safe_explanation` only for authorized terminal second failure | Matches approved UX and avoids first-attempt leakage | Disclosure after first wrong or every terminal result rejected |
| Correct result | Terminal pass on either attempt; do not disclose key/explanation | Explicit approved contract | Always reveal answer after pass rejected |
| Progress | First wrong changes no progress; correct applies pass once; second wrong applies fail once | Prevents premature failure and preserves component-101 transition meaning | Fail on first valid answer rejected |
| Idempotency | Unique `(assessment_id, answer_message_id)` and request identity plus assessment row lock | Distinguishes retries from distinct concurrent submissions | Client dedupe and timestamps rejected |
| API surface | Preserve six browser-facing operation names; map to new versioned trusted RPCs | Minimizes consumer churn without keeping unsafe behavior | Parallel browser and server implementations rejected |
| Answer input | `post_message` accepts structured selected option IDs for an assessment answer and persists their normalized public selection; grading reads that stored message through `process_message` | Selectable UI no longer needs prose parsing; the stored message remains the causal source | Free-text parser as grading authority rejected |
| Identity | Inject `AssessmentPrincipalVerifier`; browser sends its current `tutor_system_user.id` in `x-application-user-id`; verifier loads the role and room memberships from the database | Matches the app's existing no-Supabase-Auth identity flow and keeps authorization checks server-side | `auth.uid()` and a new sign-in product are not used; localStorage identity is explicitly not proof against caller impersonation |
| RPC access | Service-role/postgres execution only for transfer mutation RPCs; untrusted grants revoked | Prevents direct writes and private reads | Public `SECURITY DEFINER` execution rejected |
| Provider | Require server-only `OAI_API_KEY`, `OAI_BASE_URL`, and `OAI_MODEL=qwen3.5-flash`; use existing DashScope-compatible transport with no default | Canonical human answer; avoids silent experiment/config drift | Browser `REACT_APP_*` provider call and hard-coded fallback rejected |
| Provider parity | Retain `TransferTutorRequestV3` and its canonical context/user-message builders in `ecologicalTutorCall.ts`; production and 104 consume them | One inspectable request contract prevents evaluation drift | Copied evaluator context rejected |
| Prompt | Production prompt exists only in the Edge Function and requires `learner_safe_explanation` for assessment mode | Keeps provider authority and raw output off the browser | Browser prompt as production source rejected |
| Provider retry | At most one format-only repair after structural failure; no semantic resampling or dummy output | Bounded, observable recovery without changing experiment meaning | Unbounded retry, model switch, pattern-matched explanation, and silent fallback rejected |
| Migration | Apply one new forward migration; quarantine legacy browser-only assessments as `legacy_incomplete`, move any existing key private, and never infer an explanation | Preserves evidence while refusing to treat incomplete rows as valid new assessments | Destructive reset, re-running archived migrations, or fabricating explanation rejected |
| Hosted evidence | Hosted Supabase execution closes schema, grants, row locks, races, rollback, and transaction gates | Docker unavailable and static SQL cannot prove runtime behavior | Static regex/mocks as acceptance rejected |
| Rollback | Disable new preparation/delivery while retaining private assessment, attempts, messages, evidence, and history | Non-destructive rollback preserves research evidence | Dropping or clearing assessment evidence rejected |

## Clarification Result

No functional ambiguity remains after the user approved server-authoritative attempts and selected required server-side `OAI_MODEL=qwen3.5-flash`. Provider API key and base URL already have an existing DashScope-compatible source pattern; implementation moves them to server-only names and fails closed when any required value is absent.

## Deferred Deployment Prerequisites

- A disposable supported hosted Supabase scope and service-role execution evidence.
- Hosted verification of the `x-application-user-id` adapter against the database role and room-membership rows; this adapter does not provide cryptographic caller identity.
- Server-side DashScope-compatible `OAI_API_KEY`, `OAI_BASE_URL`, and `OAI_MODEL=qwen3.5-flash`.

These are release prerequisites, not silent implementation substitutions. Missing values keep the feature disabled.
