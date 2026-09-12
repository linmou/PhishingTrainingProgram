# Documentation update record: transfer assessment release evidence (component 105)

Intent: record the W11 release-evidence runner, its configuration and evidence boundaries, and
the observed release verdict, without claiming activation, live browser acceptance, or a passing
evaluation run.

Date: 2026-09-12
Implementation commit ID: `238a51a` (the run bundle records the pre-change commit
`a5ff4fa6904e46e3433c45b2ff2fc5d8a38e8c38` as its `start_commit`)

## Changed documents and artifacts

- `tutor-system/scripts/transfer-assessment-release.js` (new): the dedicated release-evidence
  runner. It validates a non-secret configuration, writes one immutable bundle under
  `evals/transfer-assessment/release/<run-id>/`, normalizes linked upstream evidence into the
  closed six-value status vocabulary, materializes every declared scenario and every required lane
  even when no driver ran, redacts private material from learner-scoped evidence, recomputes
  artifact hashes on `--verify`, and never enables `TRANSFER_ASSESSMENT_ENABLED`.
- `tutor-system/scripts/transfer-assessment-release.test.js` (new): 21 contract tests over the
  release-decision boundary, including content-bound snapshot identity with an independent
  `node:crypto` oracle and a temporary git repository whose tree content changes between runs.
- `tutor-system/scripts/transfer-assessment-release.config.example.json` (new): non-secret
  configuration template with the credential-by-environment-variable rule documented inline.
- `tutor-system/scripts/transfer-assessment-release-attack-matrix.json` (new): the stable W11
  scenario inventory, the six negative attack cases, and the five privacy surfaces.
- `tutor-system/package.json`: registers `eval:transfer:release`.
- `.gitignore`: ignores generated release bundles and the local secret-bearing config copy.
- `evals/transfer-assessment/release/README.md`: evidence location, retention, immutability,
  redaction rules, status vocabulary, and the activation boundary.
- `evals/transfer-assessment/upstream/*.json` (new): upstream evidence link records citing the
  integration records and the frozen evaluation manifest, each labelled as authored by the release
  owner from that source rather than freshly verified.
- `specs/105-transfer-release/contracts/transfer-release-evidence.md` and
  `specs/105-transfer-release/quickstart.md`: reconciled with the implemented command, the `--verify`
  target forms, and the four-artifact bundle this slice produces.

## Observed release outcome

Run `transfer-release-20260912T113611Z` under `evals/transfer-assessment/release/`:

- Decision `release_not_approved`; activation ineligible; capability state `disabled` on the
  backend and never enabled by the runner.
- `backend_boundary` and `room_ui` are `pass`, carrying the integration records' own caveat that the
  W3/W4 hosted behavioural lane is owner-reported and that answer-key confidentiality is a recorded
  owner decision.
- `evaluation` is `blocked` with retained source status `pending`: the frozen manifest records no
  live execution (`execution.commands` empty, `completed_at` null).
- All five required lanes (`browser`, `privacy`, `attacks`, `activation`, `rollback`) are `blocked`
  with the explicit reason that no lane driver exists in this build, and all eleven declared
  scenarios are recorded as incomplete rather than omitted.
- `--verify <run-id>` recomputes the recorded hashes and returns `ok: true`.

## Not claimed

Dedicated browser acceptance, privacy inspection, attack-matrix execution, activation, and rollback
rehearsal are not performed by this build; no isolated migrated target with a deployed
`assessment-api` and verified principals was available. Their gate rows are `blocked` with a reason,
never substituted by the legacy seven-room run, unit tests, or the frozen evaluation artifacts.
