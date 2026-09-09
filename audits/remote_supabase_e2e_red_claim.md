# Red review claim: remote Supabase E2E configuration

Claim: the proposed regression test correctly specifies the smallest executable change needed to restore the browser runner's prior acceptance of a configured hosted Supabase URL without weakening required credential validation or changing browser/evaluator behavior.

Criteria:

1. `c1` (blocking): A valid hosted URL with a process-level override is accepted and the override is observable in the loader result.
2. `c2` (blocking): A valid local URL remains accepted.
3. `c3` (blocking): Missing URL and missing anon key remain rejected with the existing configuration error.
4. `c4` (blocking): The test is isolated to the URL-policy/environment boundary and does not add a second scorer, touch remote data, or weaken unrelated behavior.

Evidence under review: `evals/promptfoo/v1/browser-demo-tutor-behavior.test.js`, the Red scope, the request map, and the failing Red run captured through `tdd_snapshot.py`.
