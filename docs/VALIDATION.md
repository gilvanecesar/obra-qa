# Repository-link delivery validation — 2026-09-25

- User request: test https://github.com/gilvanecesar/obra-cockpit and generate a PDF.
- Runtime: locally hosted OpenClaw agent connected to Plow, with a separate authenticated Docker executor.
- Tested revision: `99d7ddaf0e45981e59404bdc4f9f64084a93d777`.
- Onboarding: repository URL only; default branch HEAD resolved automatically, no pre-registration.
- Executed check: JavaScript syntax; 12 files, zero syntax failures.
- Overall result: INCONCLUSIVE; no npm test script and no functional behavior verified.
- Delivery: owner explicitly confirmed that the PDF arrived as an attachment in the Plow conversation.
- Automated implementation checks: eight passing tests before this documentation update.

The first phone attempt after URL onboarding was added still followed an outdated registered-project-only instruction. Commit `be1f2c4` removed that conflict. The agent was rebuilt and restarted; an internal model-driven test completed, followed by the owner’s successful phone retry and attachment confirmation.

Not validated: multiplayer, live per-stage chat notifications, generated functional tests, private-repository onboarding, or independent cloud one-click deployment. The published image from `296f117` predates this flow; build current source for this version. No new image promotion is claimed by this record.

## Deep-analysis update

The updated local agent autonomously inspected the public QA repository, selected 12 source-grounded requirements, created four test files, executed them via the isolated bridge, and downloaded its PDF. Initial environment and test-authoring errors were identified honestly. After assisted environment/assertion remediation, six checks passed on the same target revision. The initial run is retained; see [the acceptance record](../examples/deep-analysis/README.md). This supersedes the earlier "generated functional tests not validated" limitation for bounded JavaScript/Node contracts only; multiplayer and independent installation remain unvalidated.
