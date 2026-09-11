# Contract: Transfer Domain Determinism

**Intent**: Define the pure function and fixture obligations for W2 implementation and downstream consumption.
**Date**: 2026-09-11

## Pure Boundaries

| Boundary | Input | Output | Must not do |
|---|---|---|---|
| `parseAssessmentAnswer` | learner content, selection type, public options | selection, clarification code, or not-selection | semantic guessing, grading, or progress writes |
| `gradeSelection` | selected IDs and private key IDs | `pass` or `fail` | partial credit, explanation analysis, or LLM calls |
| `renderAssessment` / validation | assessment stem, type, options | canonical text and deterministic errors | leak the key/basis or vary option order |
| `applyLearningEvent` | valid progress pair and event kind | apply, no-change, or reject with next pair/error | write storage or invent a new state |
| v3 parser/validator | JSON content and known IDs | normalized validated `TutorDecisionV3` | accept unknown IDs or incompatible modes; reject Guard merely for using a real teaching instruction |
| answer resolver/orchestrator | delivery, current context, learner message, assessment state | one stable pure lifecycle disposition and next-action boundary for component 102 | grade undelivered/stale/duplicate answers, chain assessments, call APIs, or project transport DTOs |

## Required Fixture Suites

1. `contract`: valid v3 decisions for tutoring with a real teaching instruction, Guard with `guard`, Guard with each real teaching instruction, and assessment with `transfer_assess`; every invalid mode/instruction/target/payload/cardinality/privacy case.
2. `parser`: explicit label normalization, exact option text, Unicode/full-width forms, ambiguity, content help, and malformed input.
3. `grader`: all 16 A-D subsets, duplicate/order normalization, single and multiple keys, and empty selection.
4. `rendering`: option order, instruction selection, 80/81 segment boundary, two/three sentence boundary, exactly four options.
5. `reducer`: all 28 state/event cells and invalid state pairs.
6. `orchestrator`: undelivered, first-valid answer, clarification, assistance, repair, contradiction, spontaneous transfer, duplicate, stale, and no-chain sequences.

## Sequence Expectations

- **Pass**: signal -> delivered question -> correct labels only -> `covered/good` -> tutoring feedback -> no retest.
- **Fail/recover**: signal -> question -> wrong -> `needs_review/basic` -> repair -> new learner signal -> different context -> pass.
- **No repair**: fail -> acknowledgment -> remain `needs_review/basic`.
- **Clarification**: question -> `B or D?` -> unchanged/open -> format help -> clear labels -> pass.
- **Assistance**: question -> content help -> assisted/cancelled, no failure -> fresh signal -> different question.
- **Correct-with-reason**: correct labels plus inaccurate optional explanation -> pass once; no same-message downgrade.
- **Regression**: covered -> distinct later contradiction -> `needs_review/basic`.
- **Spontaneous**: changed-context application -> `covered/good` without generated question.
- **Multi-target**: three initial signals -> all partial/basic -> one assessment; other targets remain eligible.
- **Guard**: valid answer under Guard -> no protected progression write; reviewed recovery -> deferred event applies once when still valid.
- **Races/stale**: duplicate send, duplicate answer, retry, stale draft/manual update -> no duplicate question or answer effect.

## Fixture Stability

Fixture IDs, public result types, and expected disposition names are public planning artifacts for downstream 102/104. Component 102 owns facade/API projection and must consume these outputs rather than duplicate their rules. Error messages may be more specific in implementation, but each invalid class must retain a stable category so tests do not depend on incidental wording.
