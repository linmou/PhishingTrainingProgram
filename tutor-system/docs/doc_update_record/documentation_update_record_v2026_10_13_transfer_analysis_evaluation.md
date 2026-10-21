# Transfer analysis evaluation documentation update

Intent: record the new classification benchmark and its evidence boundaries.

Date: 2026-10-13. Source baseline: `6c5e7c0b7f5086746d0452bf685b9ed2d068048d`; evaluation prepared from this baseline plus worktree changes.

The canonical tutor specification now makes the existing analysis responsibilities explicit as TA01–TA05 under T02. These interpret the existing transfer status contract and adopted constitution without assigning an experimental version or revising constitutional priorities. The evaluation plan scopes a standalone unchanged-prompt classification baseline. At the user's request, expected labels are compared directly; no model judge is used.

The evaluation inspected production through Supabase MCP, exported 73 learner messages from ten rooms, and replayed twenty message–target combinations alongside ten style-informed cases, sixteen independent holdouts, and a five-turn state sequence. It executed 102 generations, preserving full requests, responses, handler filtering, progress states, and deterministic checks. Eight harness checks passed before execution. The [run record](../ai-behaviors/learning-progress-analyzer-evaluation-record.md) reports the failed benchmark and pending human review of gold labels; [the label sheet](../../../evals/promptfoo/learning-progress-analyzer/gold-label-review.md) exposes every proposed answer and rationale.

Raw run data is retained under `output/transfer-analysis-eval-20261013/`. The frozen package pins the exact source, constitution, specification, contract, plan, runner, labels, and production SQL. The source inventories' historical tutor/assessment assertions remain intact; their applicability audit is in the freeze. This is evaluation evidence, not release verification or a population accuracy estimate.
