# Observed model-authored audit (2026-09-25)

The local OpenClaw/Plow agent inspected the public Obra QA repository at `dda78ceb6b575f0caa51868b79932ed77aa7dc15`, identified 12 requirements and authored four Node test files itself. No test source was supplied in the initial request. It executed them through the authenticated bridge and downloaded the actual generated PDF. This was a headless internal agent turn, not a new phone/multiplayer delivery test.

The initial run was INCONCLUSIVE: Git was missing from the execution image, and one generated assertion incorrectly demanded `https:` in an error message. The agent explicitly diagnosed its assertion error rather than claiming a product defect. The operator added Git to repository-prepared runners and instructed the agent to fix only that noncontractual error-message expectation, retaining HTTP rejection. The first artifacts were retained. This was assisted remediation, not an autonomous self-healing claim.

The second run reused the same source revision: all six checks passed (syntax, existing npm tests and four generated files). Generated files contained 23 tests; existing npm tests contained eight. See `plan.json` for full generated source and requirement basis and `report.json` for commands, durations and hashes.

Coverage remains limited to the selected contracts. Docker nesting, live external services, the browser UI, independent installation and multiplayer were not verified by this audit.
