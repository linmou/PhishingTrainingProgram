# Canonical template lifecycle acceptance

Owner: combined #96/#100/#101 release owner. This opt-in workflow is a candidate acceptance check, not a passing hosted result. No registry change is included; register `scripts/browser-e2e/workflows/canonical-template-lifecycle.js` as a separate opt-in workflow in the integrated runner. Use the combined client/Edge/SQL, selected project credentials, project lease, and runner-owned cleanup as described in `browser-e2e-testing.md`. Do not run from this older #101 client branch: the workflow expects the integrated learner-owned target setup UI.

The workflow reads the live system-owned **Account Security Alert Scam** template, requires five canonical points and no separate verification steps, then creates/registers a fresh room through the tutor UI. It compares all detection/action strings exactly between template and saved AI config, verifies that the regenerated system prompt contains every exact point, and compares the tutor-generated learner checklist with the same inventory. The app intentionally regenerates surrounding pedagogy; byte equality of the entire prompt/config is not required. The template snapshots and old fixture rooms are never overwritten. `registerCreatedRoom` delegates room/learner/assessment cleanup to the existing runner even on failure.

The chosen target is Knowledge Point 4, **Check the website address before trusting it**. Its approved observation identifies `testdrive.info` as different from an official social-media company website. Its behavior forbids clicking scary warning links and offers opening the real app OR typing its official address. The full exact approved point is pinned in `TARGET`; a changed point requires reviewing this workflow's expectations.

The candidate learner messages and judgments are:

| Stage | Learner evidence | Required judgment/progress |
| --- | --- | --- |
| Partial | “The link goes to testdrive.info, which is not the official website of a social media company.” | `initial_signal`; `partially_covered` / `basic`. It supplies the observation but no protective action. |
| Full | “The link goes to testdrive.info, not the social media company’s official website. I will never click a link in a scary security message. I will open the real app or type its official website address myself instead.” | `demonstrated_understanding`; `covered` / `good`. It supplies the missing behavior in the same situation, rather than claiming spontaneous transfer. |

These expectations follow the approved point and current analysis rule requiring all components of a combined point. They are proposed test judgments, not independently adjudicated model outputs. The combined owner should review them before live acceptance. The workflow does not relax expected judgments, retry until a desired model result, inject learning events, manually mark progress, or inject fixed assessments.

Both stages require a unique applied `analysis:<message_id>` completion marker, the expected recorded model event, an applied target event citing the learner message, and persisted progress. It captures raw event/progress evidence before asserting. It then uses real provider `prepare_turn`, tutor review/send, hidden exit assessment, browser option selection and trusted grading. It requires that the prepared/delivered item is the selected fully understood point, provider validation succeeded, exactly one assessment/attempt exists, the answer is bound to the learner/question, and the terminal result is passed. Selecting the tutor-visible key tests grading and answer binding, not the model's assessment quality or a human learner's performance.

The learner messages may partially touch other canonical points. If another point becomes fully understood and wins scheduling, the test fails and requires semantic inspection; it must not silently target a different item or weaken expectations. This workflow does not cover every possible event, every point, assessment failure/retry, or re-entry. The existing legacy delivery/answer journeys remain separate compatibility/lifecycle gates and their failures remain open. This new-room check does not imply that saved legacy room copies were migrated.

Local validation (no hosted access):

```sh
node --check tutor-system/scripts/browser-e2e/workflows/canonical-template-lifecycle.js
node --test tutor-system/scripts/browser-e2e/workflows/canonical-template-lifecycle.test.js
```

Five offline tests exercise exact inheritance checks and rejection of legacy/dropped/rewritten inventories, partial over-crediting, duplicate/missing analysis markers, wrong evidence binding and stale progress. These assertions do not simulate or establish a successful browser/provider lifecycle. Hosted execution and cleanup evidence remain the release owner's responsibility. Evidence is saved to `canonical-template-lifecycle.json`; on exceptions it retains the last completed stage, observations and error. Keep private provider/database evidence outside Git.
