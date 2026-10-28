# 03 — Tasks and verification

Execute in order. Each task has an observable completion condition. This is a prototype implementation plan; all tests and live checks below are **unrun** at handoff.

## Task 0 — Confirm the baseline and freeze the boundary

Read root and `tutor-system/AGENTS.md`. Compare the working checkout with the inspected commit. Preserve uncommitted work. Recheck `App.tsx`, `aiService.ts`, `activeTutorAgentPrompt.ts`, `RoomContext.tsx`, `PostComment.tsx`, and `package.json`; repository findings in file 04 are a baseline, not a guarantee that these files remain unchanged.

Record baseline test/build results before editing. Confirm that the feature remains a local sandbox and identify the existing authorized model configuration without printing credentials. No deployment, account changes, or database migration is authorized by this plan.

**Done when:** the implementer identifies any drift, records pre-existing test failures, and confirms the proposed files can be added without changing the production tutor contract.

## Task 1 — Contract and message builder

Create shared types/constants, the strict output/message-list validator, and the pure prompt/input builder. Translate file 01 into a demo-specific system prompt. Keep the ordinary active prompt unchanged.

Add deterministic tests before connecting a model. Include valid tutor-only and paired outputs; reversed/duplicate/unknown/missing speakers; extra fields; invalid JSON; empty/oversized text; legacy response shapes; and reason isolation. Assert that transcript attribution survives serialization and the focused learner message appears exactly once.

**Done when:** the new contract tests pass and the current single-response parser and its contract remain unchanged.

## Task 2 — Live generation service

Implement the one-call generation function, the larger demo output budget, cancellation/timeout, and one schema-repair retry. Keep all configuration in the new service; import the existing default model constant. Do not modify legacy model settings or introduce a provider framework.

Mock `fetch` for request-shape tests. Verify the selected model, system/user messages, output budget, JSON response format, and two-attempt maximum. Verify that 401/provider/network failures do not trigger a retry loop, malformed first output gets one repair attempt, and an invalid second output is surfaced. Verify that missing configuration is distinguishable from a model response failure.

**Done when:** the new service can produce a typed sequence from a mocked compatible response and has an explicit error path. Live configuration availability is reported separately.

## Task 3 — Local controller and reviewed playback

Implement the phase flow in file 02 with an injected generator, immutable original/draft/approved values, one timeout, and reset/unmount cleanup. Add the minimal review records and JSON export snapshot.

Use deferred promises and fake timers to test races. Do not add storage, polling, subscriptions, distributed locks, or queue libraries.

**Done when:** the complete local turn works under deterministic tests, including duplicate events, failures, reset, and edited-text publication.

## Task 4 — Page, identity, and editor

Build the two-panel page and one fictional scenario. Add/remove only the optional peer card; always keep the tutor card last. Connect the learner textbox to the controller and preserve typed text while Send is disabled. Render only delivered messages in the preview.

Add the gated HashRouter route and the gated tutor-page link. Default the flag off. Scope CSS to the new page. Add the setup instructions and local-only limitations to the project README.

**Done when:** the mock-driven page can complete two consecutive learner turns, show the 3-second separation, export its session, and reset cleanly. The feature flag hides both route and navigation when disabled.

## Task 5 — Verify behavior and product separately

### Deterministic acceptance checklist

| ID | Check | Expected result |
|---|---|---|
| D01 | Initial response is a pair | Both editable cards appear; neither message is in the preview before approval |
| D02 | Human edits both messages | Exactly the edited text is delivered; original output remains distinct in the record |
| D03 | Approve a pair | First appears immediately; at 2,999 ms the second is absent; at 3,000 ms it appears exactly once |
| D04 | Approve tutor-only | One tutor message appears immediately; no pending second-message timer |
| D05 | Submit via button, Enter, or direct handler while locked | No additional learner message or generation is accepted; typed draft survives |
| D06 | Double-click Submit or Approve | One learner message/request, or one publication sequence, respectively |
| D07 | Remove/add Riley | Tutor text survives removal; adding an empty peer disables approval; tutor cannot be removed |
| D08 | Regeneration fails | Existing edited draft remains intact; no output is published |
| D09 | Initial generation fails | Learner message stays; Retry, manual tutor drafting, Discard, and Reset remain usable |
| D10 | Reset during generation; old promise resolves later | No old draft, error, message, or timer appears in the fresh session |
| D11 | Reset/unmount during interval | Pending second message never appears after reset or remount |
| D12 | Trigger stale/duplicate timer callback | No duplicate or out-of-session message |
| D13 | Inspect the next generation request | Contains delivered approved text and correct speaker IDs, not unsent originals or private reasons |
| D14 | Export during review/playback | Draft/queued content is separate from delivered transcript; no secrets; status is truthful |
| D15 | Disabled flag / normal room route | Demo route/link absent when off; ordinary room UI and service behavior unchanged |
| D16 | Text contains URL-like strings or markup | Displayed as inert text; no active links, HTML execution, or new browser actions |

The 3,000 ms assertion belongs to fake-timer tests. Browser scheduling may make an actual delay longer; real playback must preserve order rather than promise exact wall-clock timing.

### Semantic smoke cases

The accompanying [behavior-cases.json](behavior-cases.json) contains twelve complete proposed inputs, expected patterns, and review criteria. Expected labels/criteria are **evaluator-only**; send only each case's `input` to the target model.

| Case | Main boundary | Expected pattern |
|---|---|---|
| B01 | Familiar logo creates a plausible bad recommendation | Peer then tutor |
| B02 | Countdown pressure without a learner intention to act | Peer then tutor |
| B03 | Learner says they will click now | Tutor only; protection first |
| B04 | Learner plans to enter a real password | Tutor only; protection first |
| B05 | Learner adopts the peer's misconception after a focused scaffold | Tutor only; direct correction |
| B06 | Learner correctly rejects the bait | Tutor only; acknowledge and progress |
| B07 | Learner quotes unsafe advice to question it | Tutor only; clarification without falsely attributing intent |
| B08 | Learner requests a direct explanation | Tutor only; answer the request |
| B09 | Scenario lacks the facts needed for a grounded lure | Tutor only; no invented facts |
| B10 | Learner asks to stop role-play | Tutor only; stop pressure |
| B11 | Learner tries to rewrite character/output rules | Preserve roles/contract; no application-rule override |
| B12 | Peer/tutor statements could be mistaken for learner knowledge | Tutor only; no invented learner error, intent, or mastery |

For the first live smoke check, run each case once with the same demo prompt/settings. Save raw responses and the schema result. A human reviewer checks MC-01 through MC-05 using the full response and supplied history. Record pass/fail/not-applicable and a brief quoted or paraphrased observation per applicable requirement. Repeat only unstable or borderline cases. These are development cases, not independent holdouts.

**Demo content check:** every tested output must end in a valid final contract; safety and attribution requirements must pass wherever applicable; B01 and B02 must actually produce plausible misleading contributions and useful tutor follow-up; pattern/semantic failures must be documented and fixed when they block the intended demonstration. Do not hide failures with a single average score. Separate first-attempt contract failures, repaired outputs, provider failures, and semantic failures.

If the demo-specific prompt fails, diagnose whether the problem is contract parsing, inadequate token budget, role confusion, or pedagogical behavior. Change the relevant demo component and rerun the twelve targeted cases. No frozen baseline/holdout package or formal experiment record is required for this isolated prototype.

This human review is a deliberately modest demo method, not a calibrated LLM-judge benchmark. Do not add a new automated judge or claim formal research/release acceptance to complete the local UI. The full `ai-behavior-design-eval` lifecycle is deferred until the behavior is promoted into ordinary production rooms or otherwise becomes a formal production tutor-policy change.

### Conditional production-prompt regression

At the end of implementation, inspect the diff. The default design in file 02 leaves `ACTIVE_TUTOR_AGENT_PROMPT` and ordinary production tutor behavior unchanged. If that remains true, the targeted multi-character checks above are sufficient AI-behavior verification for this demo; a new full Promptfoo evaluation is not required.

If implementation changes `ACTIVE_TUTOR_AGENT_PROMPT` or shared production tutor behavior semantics, also run the repository's existing Promptfoo regression and quality gate before calling the demo complete. Preserve the existing cases/rubrics rather than weakening them for the new change. This conditional regression still does not require a new constitution/freeze/holdout package for the isolated demo.

### Actual browser smoke

With the authorized gateway configured, start the app and open the new route. Enter the B01 scenario and learner message, generate a live sequence, edit both cards, approve, observe two distinct identities and ordered playback, then enter B06-style learner evidence. Capture the actual next request to verify speaker attribution and approved-history use. Exercise Reset during generation and during playback; confirm ordinary room access remains unaffected.

Save screenshots or a short recording and a redacted request/response trace. Use stable test IDs in the new page so this smoke path can be automated later without text-dependent selectors. Existing Selenium infrastructure may be reused; do not install another browser framework solely for this demo.

**Done when:** deterministic results, content-review results, and actual-browser results are reported separately. A mock passing does not prove that a live provider or browser was verified.

## Commands and final handoff

Run from `tutor-system/` after setting the flag in the local environment and restarting CRA:

```bash
npm ci
CI=true npm test -- --watchAll=false --runInBand --testPathPattern=multiCharacterDemo
npm run test:regression -- --runInBand
npm run build
# When evaluating coverage against the repository's existing thresholds:
npm run test:coverage -- --runInBand
# Only if ACTIVE_TUTOR_AGENT_PROMPT or shared production tutor semantics changed:
npm run eval:prompts
# If the wrapper does not already apply the repository quality gate, run the existing gate command as configured in package.json.
# For the interactive browser check:
npm start
```

Required local opt-in:

```dotenv
REACT_APP_ENABLE_MULTI_CHARACTER_DEMO=true
```

Use the repository's existing authorized model/gateway configuration; do not copy secrets into documentation. The new tests should be named `multiCharacterDemo.contract.test.ts`, `multiCharacterDemo.service.test.ts`, `multiCharacterDemo.flow.test.tsx`, and `multiCharacterDemo.routes.test.tsx` so the focused command selects them.

Do not delete, skip, or weaken existing tests to obtain a green result. Report pre-existing failures from Task 0 separately from introduced failures. When dependencies, model access, or browser access are unavailable, state exactly which checks were not run rather than replacing the evidence with a successful mock.

Final implementer report: changed files, route/setup, deterministic results, live content results, browser evidence, existing regressions, and explicit limitations. Mark shared-room persistence, cross-device visibility, Guard/transfer integration, and educational-effectiveness evaluation as outside this implementation—not completed.
