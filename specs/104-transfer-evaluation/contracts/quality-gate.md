# Transfer Quality Gate Contract

**Intent**: define the blocking verdict for frozen W9-W10 Promptfoo evidence and the conditions that prevent false acceptance.

## Required gate inputs

The gate reads the candidate run manifest/report and, for non-regression, the unchanged comparable baseline manifest/report. It must reject an incomparable baseline before scoring. It derives expected rows from the frozen manifest, not from returned report rows.

## Verdict rules

Return `accepted` only when all of the following hold:

1. Every required case/check/metric/partition/repetition/turn row has evidence.
2. No required row has `missing` or `error` status; provider, parser, judge, and harness errors are resolved or the verdict is blocking.
3. Every applicable semantic rubric reaches at least 80% overall and in every required applicable partition, unless the frozen manifest declares a stricter threshold.
4. `t09_contract_and_progress`, `assessment_followup`, required validity checks, safety-critical/hard constraints, and every declared semantic pair meet 100% requirements.
5. Zero-applicable partitions are reported as zero coverage and block acceptance.
6. Candidate does not decline against the unchanged comparable baseline on the same case/version, metric version, partition, target generation, settings, and repetition policy. A 95% to 81% decline fails non-regression even though 81% exceeds 80%.
7. Every pair member passes its applicable required checks in every repetition.
8. Calibration and grounding prerequisites are recorded as complete for the relevant run; calibration is not silently replaced by an uncalibrated judge.
9. The manifest pins the component-102-owned shared v3 builder version/hash and backend production prompt reference/hash, both target adapters report an effective 1,200 completion-token budget, and normalized product/evaluation requests match for every parity fixture.
10. Target requests/evidence contain no evaluator-only metadata, copied production prompt artifact, provider credential, or secret value.

Return `failed` for an observed behavior/threshold/pair/regression failure with complete evidence. Return `incomplete` for missing or errored execution/judge/manifest evidence. Both outcomes block acceptance.

## Required failure diagnostics

The gate reports:

- metric, partition, passed/applicable/expected counts, exact fraction, threshold, and method;
- zero-coverage and conditional-applicability counts with reasons;
- every missing/error row and provider/judge/harness cause;
- every candidate pass-to-fail case/assertion and applicability change;
- pair ID/member/repetition failures;
- stateful transition and deterministic expected-versus-actual failures;
- manifest/hash or baseline-comparability failures;
- links to raw evidence and the final non-substitution statement.

No score sum substitutes for pass count. Deterministic and semantic metrics are reported independently. Extra easy cases cannot conceal a regression.

## Gate test matrix

The later implementation must include explicit tests for at least:

| Fixture | Expected verdict | Required assertion |
| --- | --- | --- |
| All declared rows pass at threshold | accepted | exact counts and all partitions present |
| Missing case/check/metric/partition result | incomplete | missing row remains denominator and blocks |
| Evaluator/provider/judge error | incomplete | error is preserved and blocks |
| Zero-applicable partition | incomplete | zero coverage is not 100% |
| Candidate below threshold | failed | metric/partition counts identify failure |
| Candidate above threshold but below comparable baseline | failed | pass-to-fail/non-regression failure is listed |
| One semantic-pair member fails | failed | pair gate blocks despite aggregate pass |
| Incomparable baseline/changed case version | incomplete | comparison is rejected before acceptance |
| Conditional `not_applicable` with valid rule | evaluated | null pass/score and evidence reason only |
| Missing shared builder or production prompt hash | incomplete | contract identity is required before scoring |
| Product/evaluation normalized request mismatch | incomplete | parity failure blocks before semantic scoring |
| Either v3 adapter budget differs from 1,200 | incomplete | effective-budget mismatch is identified |
| Evaluator metadata or provider secret leaks into target evidence | incomplete | offending field/path is identified and acceptance blocks |

## Non-substitution boundary

A passing gate establishes only the frozen transfer evaluation evidence. It does not establish T09 product behavior on the production provider path, database/RLS/atomicity, verified principal or answer-key privacy, browser downstream consumption, activation, or rollback. Those gates remain separate and the feature flag remains disabled until the initiative release gates pass.
