# PR template risk gate and release repair

Intent: record the requested separation of PR review, human decisions and automatic release repair ownership.

Updated: 2026-10-27. Implementation baseline: `dec7c27`. Owner: root Codex agent.

The PR template contains the risk criteria and merge authorization rules. Codex on GitHub reviews the diff and assessment; the coding/release agent fixes findings and checks the evidence before merging. Human decisions remain on the PR. Existing AGENTS.md PR guidance already references the template; no additional PR review sections are needed.

The release workflow retains repair ownership through staging, merge, production acceptance, cleanup and SQL archival. AGENTS.md links that procedure. This change affects documentation only; it changes no deployed Supabase behavior.

Refactored PR #38 after scope review: withdrew the proposed enforcement workflow, validator, tests, JSON contract, approval commands and separate policy document. The previously passing 17 validator tests concern that withdrawn implementation. Final validation consists of link/reference and whitespace checks, actual GitHub CI and Codex review recorded on the PR. No Cloud task environment or branch-protection activation is required for the template gate.
