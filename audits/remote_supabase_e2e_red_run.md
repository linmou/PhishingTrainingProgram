# Red run evidence

Command:

`python /Users/admin/.codex/skills/fast-multi-agent-tdd/scripts/tdd_snapshot.py run -- node --test evals/promptfoo/v1/browser-demo-tutor-behavior.test.js`

Observed result: exit code `1`, with 2 passing tests and 1 failing test.

The failing subtest was `accepts a hosted Supabase URL and preserves process-env precedence`. It failed at `tutor-system/scripts/browser-demo-tutor-behavior.js:104` with:

`eval:behavior:web refuses non-local Supabase URLs.`

The local URL acceptance subtest passed. The missing URL/anon-key rejection subtest passed. This is the intended Red signal for the current hostname allow-list.

## Round 2

The same targeted command was rerun after adding the temporary env-file fixture and marker. It again exited with code `1`, with 2 passing tests and 1 failing test. The hosted subtest still failed at `tutor-system/scripts/browser-demo-tutor-behavior.js:104` with `eval:behavior:web refuses non-local Supabase URLs.` The failure occurs before the fixture marker assertion, as expected while the current loader still lacks the injectable env-file parameter and retains the hostname rejection.
