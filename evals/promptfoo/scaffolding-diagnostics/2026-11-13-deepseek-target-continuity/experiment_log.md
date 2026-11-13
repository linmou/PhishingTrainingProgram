# Intent

Preserve the question, controlled replay, complete response evidence and limitations needed to determine whether DeepSeek Flash switches past unfinished learning targets.

# Experiment: DeepSeek Flash target continuity

## Metadata

- Log status: completed bounded diagnostic and independent review; robust continuity and behavior acceptance not established
- Created: 2026-11-13T09:19:51Z
- Updated: 2026-11-13T09:24:05Z
- Author or agent: root/Codex; log maintained by continuity_log using experiment-log-writer 1.1
- Repository: PhishingTrainingProgram
- Initial source commit: `fd88c5c6373427f0f7b00de9f4c7c81c6a2bd1d9` (observed HEAD at plan creation; runtime has pre-existing uncommitted prompt changes)
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Results address: `evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-target-continuity/evidence-manifest.json` (indexes locally retained raw requests, responses, snapshot and execution evidence)

## Research Questions

### RQ1: Does deepseek-flash still switch past unfinished learning targets in room c2ce8f2e-36f5-4eff-8e3c-aa6af4b6edb9?

- Origin: Derived from [the previous DeepSeek comparison](../2026-11-13-deepseek-comparison/experiment_log.md).
- Prior result motivating this question: the broader comparison had confirmed grader errors and did not directly replay this manual room. The [manual room diagnosis](../2026-11-13-component-scaffolding/manual-room-target-continuity.md) documents a switch from an unanswered safer-sharing question to a post-after-leaving answer after the learner said “Oh , not safe”.
- Answer criterion: inspect the complete generated response and prior dialogue for an unambiguous move to a different learning target while the current target remains unfinished. Preserve ambiguous overlaps separately. Report counts with examples and errors; no calibrated aggregate score or general acceptance claim is planned.

## Hypotheses

### H1 (addresses RQ1): DeepSeek Flash retains target continuity across the replay and vague continuations.

- Expected observation: the tutor continues developing the unresolved learning target in all valid observed responses; vague acknowledgment alone does not establish its completion.
- Rejection observation: at least one unambiguous switch to another target before the learner completes the current target.
- Status: preregistered

## Experiment Design

- Independent factor changed: configured target model is deepseek-flash. The historical room's exact model and original HTTP request are unknown; this is a current-prompt reconstruction, not an exact model-only paired replay. Scripted follow-up replies are an additional declared factor for trajectories.
- Factors held constant: reconstructed current local prompt, live room prompt configuration and checklist snapshot, complete learning-target inventory, initial room dialogue, temperature 0.3, maximum 600 tokens, and disabled thinking. Freeze inputs before generation and preserve their hashes.
- Data or inputs: three identical fixed-turn repetitions and three three-turn trajectories. Each begins with the recorded learner line “Oh , not safe” after the unresolved safer-sharing question. Trajectories then use scripted “Yes” and “Okay” replies and retain actual generated tutor text. This totals 12 planned responses. Raw room input, requests and responses are retained under ignored `raw/`; exact snapshot hashes are Unknown until preparation supplies them.
- Evaluation method: semantic review using the full dialogue. Separate premature target switching, repeated components, answer disclosure and ambiguous overlapping targets. An unchanged subject word does not prove continuity, and a changed wording does not by itself prove switching. The exposed diagnostic is not a new calibrated score, held-out evaluation or acceptance run.
- Stopping rule: at most three concurrent model calls and 30 minutes of active execution; preserve failed and partial requests without substituting models or silently changing settings.
- Known confounders: the historical model/request is unavailable; the current reconstruction incorporates pre-existing prompt edits; overlapping learning targets can make switching ambiguous; the checklist is frozen instead of updated by the analyzer; trajectories use controlled vague interventions rather than natural learner behavior; repeated requests are not independent scenarios.
- Environment: provider configuration and credentials from `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env`; credentials are excluded from artifacts. The exact sanitized endpoint and returned model will be recorded with execution evidence.

## Execution Commands

### Command 1: Generate fixed-turn repetitions and controlled continuations

- Status: Planned
- Timestamp: Not executed
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and the existing project adapter; provider configuration from the main-checkout `tutor-system/.env` above. Runtime version is Unknown until execution records it.
- Exit status: Not executed
- Output path: Not executed; planned evidence beneath this experiment's `raw/` directory.

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-target-continuity/run.cjs
```

## Results

At the plan entry, results were not produced. The following result records the subsequent execution without changing the preregistered hypothesis.

### Result 1: Target continuity and disclosure diagnostic

- Informs: RQ1 and H1.
- Run status: 12/12 model responses completed, HTTP 200, returned model `deepseek-flash`, finish reason `stop`; no recorded generation errors. Total reported token usage: 62,136.
- Input: `raw/frozen.json`, SHA-256 `9515fe9bc28ccb680d0c7442950d104c5b327ce20f945eef018cc32c8bdc8372`; live room input is retained in `raw/room-snapshot.json`, SHA-256 `81f7db0f6b3c2ebb2f6037de32849d2bf5e96fc88059000f1714b85e9efebc80`.
- Configuration: `deepseek-flash` at `https://api.deepseek.com`, temperature 0.3, maximum 600 tokens, `thinking: {type: disabled}`, JSON-object response format, three repetitions, three workers, 90-second request timeout, 30-minute active cap.
- Output: three fixed-turn replies and nine trajectory replies, with full request/response pairs in the 12 `raw/fixed-*.json` and `raw/journey-*.json` files.
- Metric definition and value: primary manual review found **0/12 unambiguous abandonments** of the unfinished target and **1/12 ambiguous overlapping-target drift**. This is an exposed qualitative diagnostic, not a calibrated pass rate. The three fixed replies all stayed with the unfinished KP3 action. All three trajectories remained on the target at turns 1 and 2. At `journey-r1-t3`, a KP2 post-after-home action was added alongside the KP3 private-message action; because the current point remains represented, the reply does not unambiguously abandon it. The same reply contains a clear action-answer disclosure before a meaningful action attempt or explicit action confusion.
- Observation: fixed-r1 replied, “You spotted the exact time and place. Now think of a safer way to share plans with friends. What could you use instead of a public post?” After scripted “Yes” and “Okay”, journey-r1-t3 replied, “You found the exact time and place. Now pick one: tell friends in a private message, or post about the movie after you get home. Which would you choose?” Other continuations repeated the action question. The learner had not demonstrated a completed action response.
- Interpretation: the original clear switch was not reproduced in these 12 calls, but the overlap case and premature disclosure prevent a clean reliability claim. H1 remains inconclusive for strict target switching. Retrospective recognition over-credit is a separate concern: acknowledgment such as “You spotted” can attribute more understanding than the learner's vague replies establish.
- Evidence path: [evidence-manifest.json](evidence-manifest.json), `raw/fixed-r1.json`, `raw/journey-r1-t3.json`, and the full retained dialogue in each raw record. Independent review was pending at this entry; no independent verdict is inferred.
- Integrity: executor verified six identical starting inputs (three fixed and three trajectory first turns), six follow-up histories preserving generated tutor replies, and all 24 frozen source hashes matching current files.
- Raw evidence storage: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding/evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-target-continuity/raw/`; 15 files, 640,431 bytes. SHA-256 of manifest entries: `55ba8fd082debfbb15268b4e561678f513491192c8bf17b165fddbbdb6a487f4`. Generation command is Command 2 below; run identifier is `execution-1794561681586`.

## Iterations

### Iteration 1: 2026-11-13T09:22:43Z

- Hypothesis: H1.
- Source commit: `fd88c5c6373427f0f7b00de9f4c7c81c6a2bd1d9`, plus the four pre-existing dirty runtime prompt files: `tutor-system/src/services/ecologicalTutorCall.ts`, `tutor-system/src/services/prompts/activeTutorAgentPrompt.ts`, `tutor-system/src/services/prompts/pedagogy/parameters/emotionalParameters.ts`, and `tutor-system/src/services/prompts/responsePolicy.ts`. This iteration did not edit those files.
- Files or configs changed: this experiment's new `run.cjs` defines input freezing, model generation and resumable output retention; `.gitignore` excludes bulk `raw/`; `evidence-manifest.json` indexes raw hashes; this log records the design and evidence. No runtime-prompt refinement was made.
- Commands: Command 2 executed Command 1 exactly as planned.
- Results: Result 1.
- Decision: inconclusive. No unambiguous target abandonment occurred, but one overlapping-target drift and clear premature action disclosure occurred. The small exposed sample does not establish that target switching is solved.
- Revision note: None; H1 and the planned diagnostic scope remain unchanged.

### Command 2: Execute the planned generation

- Status: Executed
- Started: 2026-11-13T09:21:21.586Z
- Completed: 2026-11-13T09:21:28.342Z
- Elapsed: 6,756 ms
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: Node.js and existing project adapter; provider settings/credentials from `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env`. Node runtime version remains Unknown; recover it from the executor environment if needed.
- Exit status: 0
- Output path: `raw/execution-1794561681586.json` and the raw records indexed in `evidence-manifest.json`.

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-target-continuity/run.cjs
```

## Corrections And Deviations

None.

## Analysis Notes

- 2026-11-13T09:19:51Z: the saved room establishes the original behavior, but cannot establish whether the newly configured DeepSeek Flash reproduces it. The planned calls address that narrower question.

### Final independent review: 2026-11-13T09:24:05Z

- [Independent review](independent-review.json), by `/root/continuity_review`, examined all 12 outputs against frozen input SHA-256 `9515fe9bc28ccb680d0c7442950d104c5b327ce20f945eef018cc32c8bdc8372`. Its integrity verdict is `clear_for_bounded_diagnostic`.
- The original immediate abandonment was not reproduced: all three fixed replays retained the open action, as did all three first trajectory turns. Of nine trajectory outputs, one (`journey-r1-t3`) mixed in an overlapping target and disclosed both candidate action answers; it did not unambiguously abandon the original action because that action remained offered. Counts remain 0/12 clear abandonment, 1/12 overlapping target mix, and 1/12 premature action disclosure.
- Five follow-up outputs repeated the action question with little additional support. `journey-r2-t3` repeated its preceding tutor response verbatim. Staying on the target therefore did not establish responsive scaffolding, and the one more concrete response supplied the answers prematurely. These are interacting instructional outcomes, not a reason to collapse them into one score.
- Recognition completion remained unsupported by the learner evidence. The learner confirmed displayed details and said “not safe”; the tutor supplied the consequence involving strangers. This separate component-progression issue is inherited at the replay boundary. The experiment cannot establish when DeepSeek itself would initially move from recognition to action.
- [README.md](README.md) records the final conclusion, interactions and limitations. The diagnostic is complete, while broad behavioral acceptance remains unestablished. No causal model-superiority claim follows from this reconstructed, single-room comparison.

### Command 3: Verify retained artifacts and request construction

- Status: Executed
- Execution date: 2026-11-13. Exact execution timestamp: Unknown; it was not supplied or retained with this command. This analysis was recorded at 2026-11-13T09:24:05Z and does not substitute that time for execution time.
- Working directory: `/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-stage-scaffolding`
- Environment: local Node.js and experiment artifacts; no model calls.
- Exit status: 0.
- Output: executor reported 12 complete outputs, 15 verified raw hashes, 24 verified source hashes, six equal starting inputs and six exact continuation-history checks. The corresponding integrity observations are also preserved in `independent-review.json#verification`; exact command stdout was not supplied as a separate artifact.

```bash
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-target-continuity/verify.cjs
```

The raw files remain local under ignored `raw/`. Their hashes verify the retained evidence; they do not establish external archival durability.

## Next Research Directions

### Direction 1: Does explicit continuity state prevent drift without supplying the learner's action answer?

- Motivating evidence: the one overlapping KP2/KP3 continuation and premature action disclosure after repeated vague replies; repeated question-only replies in the other continuations.
- Factor to change: an explicitly tracked unresolved question/current point, if a subsequent refinement is authorized.
- Factors to hold constant: scenario, complete target content, initial learner history, provider/decoding settings and comparison cases.
- Evaluation: independent semantic review of continuity, disclosure and useful scaffolding on matched inputs and longer trajectories; distinguish target overlap from abandonment.
- Priority: high as a discriminating follow-up; this direction is not an executed or accepted refinement.
