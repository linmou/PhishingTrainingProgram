# DeepSeek unfinished-target diagnostic

Intent: test whether DeepSeek Flash leaves the unfinished learning target in the reported Movie Meetup room.

Updated: 2026-11-13. Source baseline: `fd88c5c6373427f0f7b00de9f4c7c81c6a2bd1d9` plus the pre-existing local prompt edits captured in `raw/frozen.json`.

## Question and method

Continue the [manual room diagnosis](../2026-11-13-component-scaffolding/manual-room-target-continuity.md) for room `c2ce8f2e-36f5-4eff-8e3c-aa6af4b6edb9`. The open tutor question asks for a safer way to tell friends the plans. The learner says only “Oh , not safe”. The historical tutor then supplies a different point's after-leaving action.

The current branch's product prompt builders reconstruct the prompt using the live staging room configuration and checklist, retrieved through Supabase MCP. Keep the full four-point target inventory. Use three independent fixed replays and three independent three-turn continuations. Each continuation starts at the same recorded learner reply, then supplies controlled “Yes” and “Okay” responses while retaining the model's actual prior output. All cases are exposed diagnostics from one scenario, not independent holdouts.

Settings: `deepseek-flash`, `https://api.deepseek.com`, temperature 0.3, maximum 600 output tokens, thinking disabled, JSON output, three concurrent requests at most. These generation temperature/token settings match `TUTOR_GENERATION_SETTINGS` in `aiService.ts`; the room's stored 100-token setting is not the runtime setting used by that path. Credentials come from the main checkout's `tutor-system/.env`, whose keys are declared in `.env.example`.

Judge by meaning against T02/T02.1/T02.2 and the component disclosure rule T01.1: leaving the unfinished point is different from staying on it, offering an overlapping alternative, or repeating a question. Preserve those distinctions in manual semantic review. No calibrated numeric acceptance gate is asserted. Reuse the adopted constitution and [component grounding review](../2026-11-13-component-scaffolding/grounding-review.json); this experiment changes neither requirements nor prompt text.

## Findings

All three fixed replays remain on the unfinished action for the exact-time/place target (KP3). A representative response is:

> You spotted the exact time and place. Now think of a safer way to share plans with friends. What could you use instead of a public post?

The nine continuation outputs contain eight further focused KP3 action questions and one mixed-action reply. In `journey-r1-t3`, after the learner has only supplied “Yes” and “Okay”, DeepSeek says:

> You found the exact time and place. Now pick one: tell friends in a private message, or post about the movie after you get home. Which would you choose?

That reply brings in KP2's after-leaving action alongside KP3's private-message action. It is a target-blending warning, not clear evidence of abandoning KP3 entirely. It does supply action answers before the learner has attempted an action or expressed action-specific confusion. The other continuations repeatedly rephrase the same question; `journey-r2-t2` and `journey-r2-t3` have identical student-facing text.

The immediate historical switch was **not reproduced**. The stronger claim that DeepSeek reliably completes a target before moving on is **not established**. Repetitive scaffolding, over-crediting brief agreement as recognition, and one premature mixed-action disclosure remain concerns.

## Evidence and limits

The run completed 12/12 requests: HTTP 200, returned model `deepseek-flash`, finish reason `stop`, 62,136 total reported tokens. Six start requests are identical; six continuation-history checks verify exact generated-response carry-forward. All 24 snapshotted source files still matched at verification. See [experiment log](experiment_log.md), [raw hash manifest](evidence-manifest.json), and [independent review](independent-review.json).

The original HTTP payload/model attribution is unavailable. This is a reconstruction using today's local code and frozen live checklist state, not an exact historical replay or a concurrent Qwen comparison. Live learner labels are normalized to “Learner”. The analyzer does not run between controlled continuations. Target overlap makes the mixed-action reply ambiguous. One scenario and short artificial learner replies cannot establish general reliability or human learning effects.

Target continuity and adaptive scaffolding are jointly relevant: keeping the same target can coexist with stalled questioning. The mixed-action reply also shows why continuity alone would miss premature disclosure. These observations do not demonstrate that the requirements conflict; a more concrete scaffold can stay with KP3 while leaving the learner to propose an action. A useful next experiment compares the current prompt with explicit unresolved-question continuity and adaptive scaffolding, using the same cases plus completion and learner-led-change controls.

## Reproduction

Run from this worktree root:

```sh
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-target-continuity/run.cjs
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-target-continuity/verify.cjs
```

The saved run is immutable. For a fresh stochastic replication, copy the tracked runner and a newly verified room snapshot into a fresh experiment directory; do not overwrite the existing raw evidence. The runner checks existing request identity on resume and retains any failed request. `verify.cjs` makes no model calls and checks raw hashes, source hashes, actual model, response completeness, fixed-input equality and full continuation history. Raw inputs, outputs and source snapshots remain locally under ignored `raw/`, with exact filenames, sizes and SHA-256 hashes in the manifest.
