# Learning State And Guard Evidence Refinement

Intent: record the narrowly scoped prompt factor separating an unresolved learning need from knowing rejection.

Date: 2026-10-25. Baseline integration commit: `3230ecf`. Branch: `fix/tutor-guard-evidence-20261025`. Status: candidate preparation; comparable semantic evaluation remains root's responsibility.

## Grounding And Observed Failure

The adopted constitution `phishing_tutor_constitution` 1.0 assigns learning-state adaptation to P2, participation management to P3.3, and truthful decision evidence to P4/H4. Rule R4 preserves teaching during genuine effort. Existing tutor specification G01 permits Guard for deliberate obstruction or knowing continuation, preserves tutoring for mistakes/confusion, and rejects invented intent. T02 owns unresolved learning targets independently of participation.

The exposed ecological development result `output/issue-2-semantic/run-05-opaque-ids/candidate/original-misconception-0.json` in the integration worktree records a candidate Guard decision whose reason treats a repeated mistaken claim and a `needs_review/basic` target as knowing rejection. Its frozen mode label requires tutoring; the learner's latest mistaken assertion does not establish acceptance of the correction as true followed by a deliberate contrary choice. This observed failure motivates an evidence distinction, not a new case-specific response rule. The original frozen evaluator/run remains unchanged.

## Changed Factor

Only the active tutor prompt's CURRENT LEARNING PROGRESS paragraph changes. Two sentences state that partial/review progress and repetition of a mistaken claim establish learning need rather than knowing rejection, and require learner evidence of accepting the correction as true while deliberately choosing contrary reliance/refusal for that knowing-rejection branch. Progress state or repetition alone cannot supply the missing acceptance or choice.

The existing independent Guard triggers for deliberate obstruction, explicit refusal and intentional repetition of a warned-against act remain in the participation rules. Genuine task attempts and relevant clarification still restore tutoring in known Guard. Protection/correction selection, model/settings, input format, output contract, rubrics, case inputs, labels, repetitions and thresholds are unchanged. No scenario entities, target IDs, expected output wording or evaluation-specific cues are added to the prompt.

The prompt is an imported file in assessment-api's deployment closure, although that handler calls unchanged context/request builders rather than the changed prompt builder. Root must freeze and promote the new closure if this candidate passes acceptance; earlier manifests do not cover the changed prompt bytes.

## Verification And Handoff

Existing focused deterministic checks verify prompt composition and request/response contracts; they do not establish semantic correction of this failure. No wording-based semantic test or provider call is introduced. Exact command results, candidate hash and independent refinement audit are recorded below before handoff. Root owns the comparable baseline/candidate evaluation of the newly frozen candidate, including unchanged explicit knowing-refusal Guard regression coverage and all applicable acceptance gates. Unseen holdouts must remain independent of this exposed development trace.

Candidate prompt SHA-256: `975f49d9bead30b38e1b7f0335f3b209577d15675806ecb9e0c89cd962b40f7e`.

```sh
rtk npm test -- --watchAll=false --runInBand --silent --runTestsByPath src/services/__tests__/ecologicalTutorCall.test.ts src/services/__tests__/transferTutorRequestV3.test.ts src/services/__tests__/promptfooBrevityScaffold.test.ts
rtk proxy /Users/admin/.deno/bin/deno test --cached-only --allow-env --allow-run supabase/functions/assessment-api/index.test.ts
rtk proxy node scripts/deploy-assessment-api.js --dry-run ciubrzggdqesgvfkpolj
```

All commands ran from this worktree's `tutor-system/`. Results: three Jest suites and 26 tests passed; 45 Deno handler tests passed, including the Edge type check; dry-run succeeded with 15-file assessment source manifest `d1e2bf9cf6cffff4d259c55485348580919286042c57137814d90e152dada632`. Deno log: `/tmp/guard-learning-evidence-deno-20261025.log`; source manifest: `/tmp/guard-learning-evidence-assessment-manifest-20261025.json`. `git diff --check` passed. These checks use no target/judge provider requests and mutate no hosted state.

Independent refinement auditor: `/root/issue_22_refactor`, verdict **clear** on 2026-10-25 against the exact prompt hash above. The auditor reviewed the two-sentence diff, adopted G01/P2/P3.3/P4-H4 grounding, exposed failure trace and changed-factor record. Findings: the rule is about state/evidence rather than case cues; the acceptance-of-correction criterion applies to knowing rejection rather than all Guard; explicit obstruction/refusal and intentional warned-act branches remain; acceptance plus deliberate contrary reliance remains sufficient for knowing-rejection Guard. The audit establishes no semantic efficacy result. Comparable frozen baseline/current/revised evaluation and explicit-refusal regression checks remain open for root.
