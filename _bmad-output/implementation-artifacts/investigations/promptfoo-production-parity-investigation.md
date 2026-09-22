# Investigation: Promptfoo and Production AI Tutor Call Parity

## Hand-off Brief

1. **What happened.** The user reports a large behavioral difference between Promptfoo test cases and the webpage AI tutor call; commit `5014acf8aca8dca99f9295ea80fe301bb2e45995` is a confirmed later fix titled `fix(ai): align room AI call with full tutor response packaging`.
2. **Where the case stands.** Active; the fix commit is the initial stronghold, while the construction-session history and causal explanation remain unexamined.
3. **What's needed next.** Map the session, version-control, Promptfoo, production-call, and TDD evidence, then trace which contract boundary was absent from the tests.

## Case Info

| Field            | Value |
| ---------------- | ----- |
| Ticket           | N/A |
| Date opened      | 2026-07-18 |
| Status           | Active |
| System           | PhishingTrainingProgram repository; macOS workspace; Git |
| Evidence sources | Codex sessions, source code, tests, Promptfoo configuration, version control |

## Problem Statement

The user reports: "there is a huge diff in promptfoo test cases vs the webpage real ai tutor call (which is now fixed by commit fix(ai): align room AI call with full tutor response packaging)." They want the Codex sessions that built the Promptfoo cases reviewed to diagnose what was missing and why the TDD workflow did not detect the issue during construction.

## Evidence Inventory

| Source | Status | Notes |
| ------ | ------ | ----- |
| Fix commit | Available | `5014acf8aca8dca99f9295ea80fe301bb2e45995`, committed 2026-07-18 09:30:18 -0400 |
| Codex construction sessions | Partial | User identifies them as relevant; exact session files and time window not yet mapped |
| Promptfoo artifacts | Partial | Repository path is in scope; files not yet inventoried |
| Production AI call | Partial | Fix title identifies room AI response packaging as the affected boundary; diff not yet read |
| TDD workflow evidence | Partial | Tests, audits, and logs not yet inventoried |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Inspect fix commit and its parent-side implementation | High | Open | Establish exact production defect and corrected contract |
| 2 | Locate Codex sessions that constructed Promptfoo cases | High | Open | Reconstruct requirements and test decisions |
| 3 | Compare Promptfoo request/response packaging with production | High | Open | Identify missing parity dimensions |
| 4 | Audit TDD Red, Green, and refactor gates | High | Open | Explain why checks could pass |
| 5 | Search for evidence that contradicts the user's premise | Medium | Open | Determine whether Promptfoo itself or surrounding harness was responsible |

## Timeline of Events

| Time | Event | Source | Confidence |
| ---- | ----- | ------ | ---------- |
| 2026-07-18 09:30:18 -0400 | Room AI call alignment fix committed | Git commit `5014acf8aca8dca99f9295ea80fe301bb2e45995` | Confirmed |

## Confirmed Findings

### Finding 1: The named fix commit exists

**Evidence:** Git commit `5014acf8aca8dca99f9295ea80fe301bb2e45995`

**Detail:** Its subject is exactly `fix(ai): align room AI call with full tutor response packaging`. The precise code delta has not yet been examined.

## Deduced Conclusions

None yet. The commit title alone is insufficient to identify why the prior TDD workflow missed the defect.

## Hypothesized Paths

### Hypothesis 1: Promptfoo cases and the webpage call exercised different contracts

**Status:** Open

**Theory:** The Promptfoo harness validated tutor-generation behavior below or beside the production response-packaging boundary, so it could pass while the webpage caller sent an incomplete or differently shaped request.

**Supporting indicators:** The reported mismatch and the fix commit's reference to "full tutor response packaging."

**Would confirm:** The fix diff plus session/test evidence showing Promptfoo bypassed the changed production boundary or represented it differently.

**Would refute:** Evidence that Promptfoo invoked the exact same production adapter with the same serialized inputs and assertions before the fix.

**Resolution:** Open.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | ------ | ------------- |
| Exact fix diff | Prevents identification of the broken contract | Inspect commit and parent versions |
| Relevant Codex session IDs/files | Prevents reconstruction of design assumptions | Search local Codex session metadata and content for Promptfoo paths/terms |
| TDD audit/test outputs | Prevents a grounded workflow diagnosis | Locate session tool calls, saved audits, and test logs |

## Source Code Trace

| Element | Detail |
| ------- | ------ |
| Error origin | Not yet traced |
| Trigger | Webpage room AI tutor call, per user report |
| Condition | Pre-fix request/response packaging, exact condition unknown |
| Related files | To be mapped from commit `5014acf8aca8dca99f9295ea80fe301bb2e45995` |

## Conclusion

**Confidence:** Low

Only the existence and metadata of the named fix are confirmed. The leading hypothesis is a contract-parity gap between the Promptfoo harness and the production room call, but the fix diff and session evidence must be examined before assigning cause.

## Recommended Next Steps

### Fix direction

No further fix is proposed during diagnosis.

### Diagnostic

Inventory and cross-reference the fix diff, relevant Codex sessions, Promptfoo harness, production adapter, and TDD evidence.

## Reproduction Plan

Reconstruct the pre-fix production payload and the contemporaneous Promptfoo payload for the same tutor turn, compare serialized fields and response handling, and identify which existing test gates exercise each boundary.

## Side Findings

- The working tree contains substantial pre-existing untracked material. It must be preserved and treated as user-owned.

## Follow-up: 2026-07-18

### New Evidence

- All three target commits were constructed in the root Codex dialogue `/Users/admin/.codex/sessions/2026/06/09/rollout-2026-06-09T11-54-21-019ead17-88b6-70f0-a3a9-b460ac22d8ca.jsonl`.
- The relevant child sessions were static evaluation-set reviewers contributing audit JSON to `64b2898`; no fast-TDD monitor, independent Red auditor, Green gate agent, or cumulative Refactor auditor session exists.
- The user selected `Prompt behavior`, not `App integration`, for the first evaluation target. The resulting plan explicitly excluded app integration, Supabase, browser/UI, and room state.
- After the user later required product-valid complex formatting, the root agent modeled `OpenAIService.generateResponse`, not the actual room caller chain `RoomContext -> generateTutorSuggestion -> TutorSuggestionService.generateSuggestion`.
- At `f8cdc7e`, Promptfoo requested a full tutor response, while the real room service requested a brief follow-up question or prompt under two sentences. The room service also used temperature `0.7` and `max_tokens: 100`, rather than the evaluated configuration.
- `5014acf` introduced a shared ecological message builder and routed both Promptfoo and the room service through it; it also passed the latest student message from `RoomContext`, added room title/description context, included array-form pre-populated dialogue, and respected configured temperature/token limits.

### Additional Findings

#### Finding 2: The initial scope deliberately excluded app integration

**Evidence:** Root session lines 104-106 record the choice `Prompt behavior (Recommended)`; the plan at line 131 says `prompt behavior only, not app integration` and `Do not call the app's Supabase-backed AI service`.

**Detail:** This was a valid scope choice for a prompt-only benchmark, but it could not support a later claim of production-call parity.

#### Finding 3: The agent later asserted parity against the wrong production path

**Evidence:** Root session lines 381-389 record the product-environment request and the decision to reproduce a generic JSON chat shape. Lines 454-455 claim the result matches `OpenAIService.generateResponse`. Historical `f8cdc7e:tutor-system/src/contexts/RoomContext.tsx:604-607` shows the webpage called `generateTutorSuggestion`; historical `f8cdc7e:tutor-system/src/services/aiService.ts:561-597` shows that path used `TutorSuggestionService.generateSuggestion` and a different instruction.

**Detail:** Message roles and variable categories were treated as the contract. The instruction semantics, actual caller, context assembly, sampling configuration, and response purpose were not treated as contract fields.

#### Finding 4: The alleged integration test was self-referential and never Red

**Evidence:** Root session line 404 says both the formatting test and builder were already added before the first run; lines 406-407 show that first run passed. Historical `f8cdc7e:tutor-system/src/services/__tests__/promptfooEvaluationPromptBuilder.test.ts:29-49` calls the synthetic builder and asserts its own output contains the synthetic case values.

**Detail:** No test imported or invoked `TutorSuggestionService`, `generateTutorSuggestion`, or `RoomContext`. The exporter generated Promptfoo JSON from the synthetic builder, and the test loaded that generated JSON and checked the same assumed shape. Internal consistency was verified; external equivalence was not.

#### Finding 5: The fast-TDD workflow was announced but not executed as specified

**Evidence:** Root session lines 191-197 invoke the skill and declare the risk boundary as local config/fixture generation. The first child-agent spawn occurs only after commit `8ea9cc4` and is a benchmark-quality reviewer. The session tree contains no dedicated TDD monitor, Red auditor, Green gate agent, or cumulative Refactor auditor.

**Detail:** The workflow's highest-risk-boundary rule should have forced the real webpage call seam once product parity became a requirement. Instead, the request map remained anchored to local evaluation files. The later product-formatting addition also skipped a failing Red phase.

#### Finding 6: Multi-review validated benchmark quality, not runtime parity

**Evidence:** The first strict audit session `/Users/admin/.codex/sessions/2026/06/09/rollout-2026-06-09T14-01-59-019ead8c-6300-7971-bab5-0118e8fe4e31.jsonl:6` scoped its claim to evaluation-set coverage, realism, observability, prompt/product-context validity, leakage, and maintainability. Its artifact reads never traced the webpage caller. Iteration-3 sessions were narrowed further to leakage/overfitting only.

**Detail:** `64b2898:evals/promptfoo/README.md:21-23` simultaneously said React was not exercised and claimed the same logical message order as the product. Reviewers accepted that prose-level assumption without an executable production-call comparison.

#### Finding 7: `f8cdc7e` passed a real LLM gate over the wrong transaction

**Evidence:** Root session lines 1160-1217 record a successful live Promptfoo run and gate. Git stat for `f8cdc7e` shows prompt sources, eval artifacts, docs, and tests changed, but not `RoomContext.tsx`, `aiService.ts`, or `simplifiedAIContext.ts`.

**Detail:** The live result was real evidence that the revised system prompt performed better under Promptfoo's synthetic full-response transaction. It was not evidence that the webpage invoked that transaction.

### Updated Hypotheses

#### Hypothesis 1: Promptfoo cases and the webpage call exercised different contracts

**Status:** Confirmed

**Resolution:** The historical source and session record show different response intent, caller path, context packaging, and sampling limits. Commit `5014acf` fixes those dimensions by sharing one ecological builder between Promptfoo and the product path.

#### Hypothesis 2: Reviewers failed because they were insufficiently skeptical

**Status:** Refuted

**Resolution:** Reviewers found real benchmark defects, forced three refinement rounds, preserved counterevidence, and narrowed confidence. They could not find the room-call defect because their claims and artifact scopes excluded it. This was a contract/scope failure, not primarily reviewer laxity.

#### Hypothesis 3: A clean TDD implementation still could not detect the defect

**Status:** Refuted

**Resolution:** The recorded implementation did not complete the required fast-TDD protocol for the parity requirement: there was no production-boundary request map, no failing parity test, no monitor, and no independent Red/Refactor audit. TDD did not fail to discover a defect covered by its tests; the workflow encoded the wrong behavior and then verified it.

### Backlog Changes

| # | Path to Explore | Priority | Status | Notes |
| - | --------------- | -------- | ------ | ----- |
| 1 | Inspect fix commit and its parent-side implementation | High | Done | Exact contract delta identified |
| 2 | Locate Codex sessions that constructed Promptfoo cases | High | Done | Root and child session tree mapped |
| 3 | Compare Promptfoo request/response packaging with production | High | Done | Multiple pre-fix mismatches confirmed |
| 4 | Audit TDD Red, Green, and refactor gates | High | Done | Protocol omissions and wrong boundary confirmed |
| 5 | Search for evidence that contradicts the user's premise | Medium | Done | Live eval and skeptical reviews were real but did not establish runtime parity |

### Updated Conclusion

**Confidence:** High

The root cause is a false equivalence between a synthetic Promptfoo chat shape and the real webpage tutor-suggestion transaction. The benchmark began as intentionally prompt-only, but when product parity was later required, the implementation copied the generic `OpenAIService.generateResponse` abstraction instead of tracing the actual `RoomContext -> generateTutorSuggestion -> TutorSuggestionService` call chain. The TDD process did not catch this because it did not execute a production-boundary Red test or its required monitor/audit protocol; it tested a newly created builder against artifacts generated by that same builder. The later multi-review and live quality gate were valid within their narrower claims, but those claims covered benchmark quality and prompt behavior, not production request/response packaging.

### Final Fix Direction

The durable mechanism is the one introduced by `5014acf`: a single shared ecological call builder used by both Promptfoo export and the real room service, plus an integration test that invokes the production packaging function and asserts the full-response instruction and real room context. Future prompt gates should fail if Promptfoo and the product can construct requests independently.

### Verification Plan

For future changes, freeze a representative room, student message, pre-populated dialogue, prompt config, and sampling config; construct the Promptfoo request and the production room request through the shared production builder; compare their normalized message arrays and model parameters; then run one browser-triggered or service-level integration test proving the room button reaches that shared path. A test that only checks roles or substring presence is insufficient.
