# Evaluation plan: <plan ID>

Intent: define a proposed or frozen experiment without redefining behavior or reporting results.

Plan ID and status: <draft / frozen>
Behavior specification snapshot: <existing canonical path and hash>
Response contract snapshot: <path and hash, if applicable>
Prepared: <date>

| Requirement ID | Metric / supporting check | Method | Checked field | Expected evidence / per-case rule | Applicability and partitions | Threshold |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | <metric ID> | <deterministic / llm_rubric> | <field> | <expected label or rubric rule> | <scope> | <gate> |

Case manifest: <path/hash; inputs, state, provenance, roles, mappings, pair/transition IDs, holdout eligibility>
Prompt and target settings: <immutable references or draft status>
Judge settings and calibration: <immutable references or pending status>
Classification, when applicable: <label space, primary metric/averaging, per-class gates, support, abstention/error handling, and threshold rationale; for ensembles, members/settings, aggregation/tie rules, and separate component/system gates>
Refinement audit, when applicable: <independent audit agent, candidate snapshots and evidence to inspect, audit record location>
Joint checks: <co-applicable requirement/metric IDs, predeclared joint gates, and links to the specification's priority interpretations>
Coverage gaps and readiness blockers: <specific gaps>

Execution link: When this plan is frozen and executed, create a separate evaluation run record. Draft or frozen planning does not create a behavior-spec version.
