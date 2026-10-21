# Verification entry points in AGENTS.md

Intent: give agents one repository entry point for verification guidance.

Date: 2026-10-21. Baseline commit: `62f2b6b` (merged coordination PR #8).

Removed `.agents/skills/phishing-training-verification/SKILL.md`. Added a short verification index to root `AGENTS.md`, linking the release workflow, database helpers, browser guide and shared Staging coordination guide. The index also requires recording the intended environment, candidate commit, selected checks, artifact hashes, results and cleanup evidence. Detailed procedures remain in their existing documents.

Updated release-workflow references to use this document structure. The release gates, executable checks and coordination protocol are unchanged. Validation passed: all 14 local Markdown link targets in the changed documents resolve, the only remaining skill-name reference is this historical removal record, and `git diff --check` passes. No hosted checks or deployment are required.
