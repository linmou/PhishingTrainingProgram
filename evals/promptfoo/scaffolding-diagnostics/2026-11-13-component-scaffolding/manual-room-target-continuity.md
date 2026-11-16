# Manual room target-continuity diagnosis

Intent: explain the observed target switch using saved dialogue, tutor decisions, learning evidence, and the local request builder.

Date: 2026-11-13. Environment: staging `ciubrzggdqesgvfkpolj`, localhost port 3107. Room: `c2ce8f2e-36f5-4eff-8e3c-aa6af4b6edb9` (Movie Meetup Social Engineering). Local branch: `eval/tutor-stage-scaffolding-20261113`; source base `7d9e648` plus uncommitted component-policy/full-cleanup application. Read-only investigation; no model rerun or live mutation.

## Observed sequence

| UTC | Speaker | Saved text / decision evidence |
| --- | --- | --- |
| 08:45:57 | Student | “it is not good” |
| 08:46:12 | Tutor | “You are right to be careful. Look at the post: does it share a specific place and time for everyone to see?” |
| 08:46:27 | Student | “Yes” |
| 08:47:19 | Tutor | “Good catch. Since strangers can see that exact time and spot, what is a safer way to tell friends your plans?” Saved reason names KP1/KP3 and the next action of sharing privately. |
| 08:47:34 | Student | “Oh , not safe” |
| 08:47:51 | Tutor | “Correct, it is not safe. A better choice is to wait until you leave the theater. Then you can share photos or say you had fun.” Saved reason explicitly changes to KP2, sharing after leaving. |

All three tutor suggestions were accepted unchanged. Thus these switches were in the AI suggestions, not introduced by tutor edits. The final learner contribution neither proposes an action nor explicitly expresses confusion about choosing one. The last reply changes target and supplies its action answer while the previous action question remains unanswered.

## Confirmed implementation and data findings

- The actual target inventory overlaps: KP1 concerns exact destination, KP2 future plans, KP3 exact time/place, KP4 public visibility. The second saved tutor reason already combines KP1/KP3 rather than naming one point.
- At 08:46:32, the analyzer used the single “Yes” message (`92ca24a6-de6d-4c9c-a6ba-bf5b4510ca11`) to make KP1/KP2/KP4 `partially_covered/basic`. Its evidence analyses additionally infer risk, strangers, and absence from home. The preceding yes/no question supports confirmation of displayed details; it does not establish all those consequences.
- `aiService.ts` adds full target texts and their coarse statuses as CURRENT LEARNING PROGRESS. This enrichment contains no selected teaching target, recognition/action evidence distinction, or outstanding tutor question.
- The ecological request includes scenario, full conversation, latest student text, prior Guard mode and interaction mode. It carries no explicit active learning-point/component field. The model can infer continuity from history, but it is not an explicit input/decision contract.
- Remaining prompt clauses instruct the tutor to acknowledge a correct contribution and address a remaining target, and to progress after a correct answer. The component policy says to move after both components are demonstrated, but continuity and incomplete answers are left to model interpretation.
- The database contains older rendered room prompt text. This is not sufficient evidence that it was used: `getEffectiveSystemPrompt` rebuilds from the room's structured prompt configuration. Reconstructing that configuration with the current local builder confirms the component policy and cleaned room rules are present, and the old automatic-safe-action clause is absent.

## Diagnosis and limits

The saved decisions directly establish premature target switching and premature action disclosure. Overlapping target scopes, generic progress-to-another-target instructions and no explicit current-point continuity are supported contributors. The analyzer also overextends evidence across points and its coarse progress is supplied to the tutor. No controlled ablation has isolated each contributor's causal effect.

Saved feedback has null generation_provenance, so exact historical HTTP requests and browser-bundle identity cannot be recovered from those rows. Current-code reconstruction is not an exact replay of the original request. No semantic keyword test or new model generation was used to infer conformance.

## Smallest next refinement

Make the unresolved tutor question and current point/component the default continuation. Interpret the latest student message against that question before selecting another target. A verdict such as “not safe” does not answer “what would you do?”; offer a more concrete action scaffold for the same point. Permit target switching for completed recognition plus action, a learner-led change, or necessary protection, with an explicit reason. Retain full original target semantics and unchanged room templates. Add this real conversation as an exposed development regression case for continuity, disclosure, and evidence attribution; any prompt refinement requires the comparable focused evaluation and independent review.
