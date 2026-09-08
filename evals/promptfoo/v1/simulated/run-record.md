# Evaluation run record: v9-candidate-11-simulated

Intent: preserve the result of candidate 11's first generated-learner multi-turn diagnostic, including context verification and remaining failures.

Run ID: `qwen3.5-flash/v9-candidate-11-simulated`.
Executed: 2026-09-08, 19:35:40.907–20:03:44.397 UTC; runner exit 0.
Git revision at completion: `8097f19f81369007bcfcd611901d6b89f68787d2`; existing uncommitted project changes are present. This run is identified by snapshots, not a claim of a clean checkout.
Behavior specification snapshot SHA-256: `06f928db0f746797285dad058fd46395da36e8de83763ca0aa106d22c07a5a9e`.
Constitution snapshot SHA-256: `8e794e17607ef4f2945e12f6c2fbad26e65dcde7ae0a5953d8616c14d9f8548e`.
Response contract snapshot SHA-256: `36f2570d0d36474cc907ee453f5203730f98d6f86d997f57e8e08398ca55493b`.
Candidate 11 prompt SHA-256: `2aed2910fad48a19cdbaae049137ab326c74643c50080850c371fc43df36405b` (identical to the preceding fixed-history candidate 11 run).
Case definition / rubric-manifest SHA-256: `033c1959e3e267e331bb0c812b502f9a7028ed8a88e7e0370c6543ad98129dae` / `9bac330ce38cb61796db021f99f2332d378dbaed11e486379784d40c6e9fce69` (JSON-serialized hashes).
Experiment definition: [README](README.md), [case definitions](cases.json), [manifest](manifest.json), and the [immutable snapshot](../../results/qwen3.5-flash/v9-candidate-11-simulated/snapshot.json), containing full source/rubric/code/settings text.
Baseline / candidate relation: candidate 11 only, explicitly requested by the user. No baseline requests were made.
Experimental changes: fixed histories became generated continuations; learner backend and conversation-level diagnostic judges were added. Candidate prompt, target model and sampling settings match the preceding fixed-history run. Conversation scores are not comparable to the old per-turn benchmark rates.

## Run outcome

Evaluation verdict: completed diagnostic with one failed conversation-level decision check; seven of eight trajectories passed all five diagnostic checks. This is not benchmark acceptance.
Grounding verdict: existing adopted constitution and specification reused; no new principle or priority adopted. The diagnostic rubric set is not independently calibrated for acceptance.
Release verdict: outside scope; no production prompt change.
Blocking evidence for a perfect diagnostic result: `confusion_to_independent_check-1`, tutor turn 2, labels direct instruction `scaffolding`.

## Result summary

| Metric / method | Suite / partition | Passed / expected | Errors / missing | Threshold | Baseline delta | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Knowledge / LLM | Eight complete trajectories | 8/8 | 0/0 | Diagnostic, none adopted | Not run | All judged pass |
| Participation / LLM | Eight complete trajectories | 8/8 | 0/0 | Diagnostic, none adopted | Not run | All judged pass |
| Progression / LLM | Eight complete trajectories | 8/8 | 0/0 | Diagnostic, none adopted | Not run | All judged pass |
| Decision consistency / LLM | Eight complete trajectories | 7/8 | 0/0 | Diagnostic, none adopted | Not run | One judged failure |
| Relationship/accessibility / LLM | Eight complete trajectories | 8/8 | 0/0 | Diagnostic, none adopted | Not run | All judged pass |
| Context/state preservation / deterministic audit | All actual tutor requests | 40/40 | 0/0 | All preserved | Not run | Pass |
| Contract v2 / deterministic | All tutor responses | 40/40 | 0/0 | All valid | Not run | Pass |
| Response length / deterministic | All tutor responses | 40/40 | 0/0 | Existing three-sentence/50-word limit | Not run | Pass |
| Complete trajectories / deterministic | Four scenario definitions × two repetitions × five tutor turns | 8/8 | 0/0 | Five tutor replies each | Not run | Pass |

The failed reply: "You can check through the real app or type the known address manually. Never click links in security alerts directly." It gives direct guidance but declares `scaffolding`; the judge identifies `explanation` as the better action description. Other checks passed this trajectory. [Exact decision judgment](../../results/qwen3.5-flash/v9-candidate-11-simulated/confusion_to_independent_check-1/judge-decision.json).

No original benchmark assertion is retired or rescored. Previously-passing-case regressions and eligible holdout performance are unassessed because this is a candidate-only diagnostic. No failures are waived. There were three recorded transport retries, all recovered; zero unresolved target, simulator, or judge errors. Both Guard trajectories have observed modes `guard, guard, tutoring, tutoring, tutoring`: a bare acknowledgment preserves Guard and a substantive question restores Tutoring. These are observed generated events, not claims that a private simulator plan guarantees correct learner behavior.

## Metric interactions

Analysis scope: whole-trajectory knowledge versus progression (content versus learner reasoning); participation versus progression (Guard recovery versus teaching); decision consistency versus progression (action labels versus useful teaching). All five generated turns within a trajectory are assessed together. These diagnostic dimensions are broader than the frozen v1 per-turn metrics, so they do not supply equivalent benchmark interaction statistics.

| Interaction / candidate-only scope | Both pass | A pass / B fail | A fail / B pass | Both fail | Unevaluable | Expected N |
| --- | --- | --- | --- | --- | --- | --- |
| Knowledge / progression | 8 | 0 | 0 | 0 | 0 | 8 |
| Participation / progression | 8 | 0 | 0 | 0 | 0 | 8 |
| Decision consistency / progression | 7 | 0 | 1 | 0 | 0 | 8 |

The sole decision/progression disagreement indicates that useful teaching can coexist with an inaccurate action label. It does not establish incompatible requirements. Both Guard runs demonstrate return to task learning after substantive re-engagement; this is counterevidence to an absolute Guard-versus-progression conflict in these tested scenarios. There is no baseline row because no baseline was requested or run.

## Final analysis

Candidate 11 sustained all eight generated conversations while retaining context. The judges found good knowledge, participation, progression and relationship behavior in these small trajectories, with one action-label inconsistency. Learning outcomes for real students were not measured. Same-model learner and judge behavior and the small four-scenario sample limit generalization; several broad judgments may warrant human inspection despite a pass. All generated content is exposed synthetic development evidence, not independent unseen holdout data.

The independent post-run audit read all 40 saved target API requests. It matched each request's scenario and input object, each complete accumulated history, unchanged inventory, and prior mode against the frozen seed and preceding generated replies. There were zero mismatches. The 32 new learner replies were generated from visible tutor replies; no supervisor rationale or private simulation instructions were supplied to the wrong participant.

Recommended action: review the eight transcripts and retain the action-label failure for future refinement. The user-requested candidate-only simulated tests are complete; no further prompt change or acceptance is implied.

## Evidence

- [Machine-readable report](../../results/qwen3.5-flash/v9-candidate-11-simulated/report.json) reconciles all eight trajectories.
- [Run directory](../../results/qwen3.5-flash/v9-candidate-11-simulated/) contains complete input/output pairs, simulator requests, target requests and responses, full conversations, judge requests and raw/parsed judgments.
- Snapshot pins Promptfoo 0.121.15, Qwen3.5 Flash settings, all prompts and source documents; secrets are omitted. Promptfoo's simulator uses full-history replay and the explicit project-backend override documented in the README.
- Local integration verification: three Node tests passed using the actual Promptfoo conversation engine with mock model outputs, covering context/state preservation, hidden-field boundaries, complete-run replay without new calls, missing-history rejection and malformed-target failure.
- Token usage from recorded successful response payloads: target 203,010; simulated learner 88,623; judge 180,086; total 471,719. Provider work on failed/timed-out attempts without returned usage is unavailable.
