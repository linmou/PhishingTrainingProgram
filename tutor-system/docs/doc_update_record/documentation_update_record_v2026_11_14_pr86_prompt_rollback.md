# PR86 tutor prompt rollback

Intent: record the owner's requested restoration after reporting the sequential-point prompt as a negative change.

Updated: 2026-11-14. Rollback baseline: `3becd9b47e78754c9674dd623eb68348e4ba2bce`.

PR #86 merged the sequential knowledge-point prompt into `no_sign_up` on 2026-11-13. On 2026-11-14 the owner requested restoring the previous prompt. This rollback reverses that PR's six-file change, including its associated test changes. The four runtime prompt files match the merge's first parent, `9b2ff07575433d66ed06707d1a68ec9992c85c8c`, byte for byte. Existing model configuration and experiment worktrees retain their separate ownership.

Verification: the request-builder and Promptfoo scaffold suites passed 15/15 tests across two suites. An exact-content comparison confirmed all four runtime files match the pre-PR86 source. This is restoration evidence, not a new model-behavior evaluation. No server API, Edge Function, database, or server configuration changes are included.
