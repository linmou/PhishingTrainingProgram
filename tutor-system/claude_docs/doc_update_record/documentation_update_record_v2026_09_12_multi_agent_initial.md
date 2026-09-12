# Documentation update record: multi-agent tutoring mode (initial)

Intent: record the documentation change for the Multi-agent Student AI choice that
adds a simulated second character (Riley) to selected tutoring turns.

Date: 2026-09-12
Implementation commit ID: uncommitted worktree `multi-character-demo` at baseline `59fd1f4`

## Changed documents

- `ai-behaviors/tutor-response-contract.md`: adds the Multi-agent extension section
  (`mode=multiagent`, `instruction=multiagent`, the two-tag response grammar, the
  `interaction_mode` request field, the dedicated `multiAgentTutorPrompt.ts` selection
  block, the two-card human review, the T / T+2s persistence and staged playback, the
  Tutor rating target, and the missing `ai_suggestion_feedback` audit record for the pair).

No other tracked document changes: the feature adds no database schema, no room
participation mode, and no new evaluation framework. `npm run eval:prompts` regenerates
`evals/promptfoo/prompts/current.chat.prompt.json` at run time; the committed fixture was
left at its HEAD revision because it is already stale relative to the current production
builder ("Write the tutor response only" survives only in
`promptfooEvaluationPromptBuilder.test.ts`), which is a pre-existing drift unrelated to
this feature.

## Verification boundary

- The frozen candidate 11 policy text is unchanged and is now the whole active prompt again;
  the Multi-agent instructions live in `src/services/prompts/multiAgentTutorPrompt.ts` and are
  appended only for `interaction_mode = multi_agent` turns. The targeted eval records
  `dedicatedMultiAgentPrompt: true` for the multi-agent arm and `false` for the control arm.
- Design decision recorded with the reviewer: because the learner asked for Multi-agent, the pair
  is now the **required** output for an ordinary tutoring turn in that mode, and only
  `protective_instruction` (imminent unsafe action), `explanation` (teaching or stop request) and
  `guard` may answer instead. `aiService.ts` treats a `scaffolding`/`correction`/`consolidation`
  decision as repairable on the first attempt and asks once more for the pair. This supersedes the
  plan's advisory reading ("enabling it never forces it") and therefore changes the expected
  outcomes of the plan's behavior cases B05–B09 and B12, which were written for the advisory
  semantics; the case file itself was left unchanged.
- Full Jest run equals baseline when both worktrees run with the same provider
  credentials: identical failing suites and failing tests, plus the new Multi-agent
  suites (`tutorDecisionContract.test.ts`, `RoomContext.multiAgentDraft.test.tsx`,
  `multi_agent_room_playback.e2e.test.tsx`).
- `multi_agent_room_playback.e2e.test.tsx` (8 passing UI tests) covers both character
  orders for the staged T / T+2s reveal, tag-free rendering, a learner message containing
  a literal agent tag staying learner-authored, typing allowed while submission and Enter
  are blocked, the Tutor message as the rating target in both orders, and the two-card
  editor replacing the single-response box only for an actual `multiagent` decision.
- Production build passes (`react-scripts build`, exit 0, pre-existing lint warnings).
- Live behavior cases (`plan/multi-character_initial/behavior-cases.json`) ran against
  `qwen3.5-flash` in both interaction modes, with per-case records under
  `evals/promptfoo/results/multi-agent-behavior-cases-*.json`. With the dedicated prompt the
  Multi-agent arm matched the case's allowed decision in 10/12 cases and the single-agent
  control in 9/12 (two of the control misses are cases that require the pair, so they are
  expected there). The only Multi-agent-specific miss is B05 (a wrong inference after a
  focused scaffold chose `multiagent` instead of `tutoring/correction`); B11 fails identically
  in both arms and is therefore inherited from the candidate 11 policy, not from this
  extension.
- The Promptfoo gate fails both with and without the extension in this environment
  (`structured_output` and `mode_selection` score 0/15 at baseline). A matched in-worktree
  A/B run shows no metric collapse: `turn_rhythm` 18→19, `direct_correction` 7→6,
  `persona_stability` 5→4, `response_length` 3→4, `mode_reason_grounding` 3→5, all other
  metrics unchanged.
- Two-client hosted smoke test (`Demo: Personal Story Trap`, rooms in the configured
  Supabase project, Playwright CLI with a tutor session and a student session):
  - the selector shows Peer / Adult / Multi-agent and Multi-agent persists in
    `ai_assistant_configs.prompt_config` while the Tutor tone is retained;
  - the learner's reply is blocked by the compulsory rating gate until the previous Tutor
    response is rated, and the completed pair is rated on the tagged Tutor row
    (`message_feedback` 1 row on the Tutor message, 0 on Riley);
  - approving a stale draft is rejected with "The learner sent a newer message, so this
    draft is stale" and inserts nothing (message count unchanged);
  - regeneration retargets the newest learner turn and may switch back to the ordinary
    single-response panel with Quick Adjust;
  - approving a fresh pair stores exactly two tagged rows 2000 ms apart, sharing the
    parent learner message, `response_mode=tutoring`, with the tutor's edited text;
  - the learner feed renders "🤖Riley · AI participant" and "🤖AI Tutor" with the tags
    stripped, and a hard reload reconstructs the pair from the stored rows.
  - Not reproduced live: the two-character stagger itself. With the learner page on its
    2-second polling loop the first poll after approval can already be past T+2, so both
    rows render together. The hidden-until-timestamp rule and the staggered reveal are
    covered by the fake-timer UI tests; the live transport cannot guarantee the window.
- Defect found and fixed by the smoke test: rooms configured with `max_tokens` 100
  truncated the two-message envelope (`finish_reason: length`), the truncation was
  reported as a format error, and the single-agent repair instruction pushed the retry
  back to a single-Tutor response, so Multi-agent never reached the reviewer. Multiagent
  turns now use `MULTI_AGENT_MAX_TOKENS` (240), a length-stopped response is reported as
  truncated, and the multiagent repair instruction keeps the two-tag shape.
