# Deep-analysis protocol

1. `qa-client.mjs inspect PROJECT_OR_GITHUB_URL [SHA]` reads committed documentation and up to 20 source files, 12k characters per file, 90k total. Truncation and skipped coverage must be disclosed. No target code executes during inspection. Common secret filenames, symlinks and build/vendor directories are omitted; this is not a secret-scanning guarantee.
2. OpenClaw interprets the untrusted source as data and authors a JSON plan. The owner does not write test code or provide the SHA. The skill calls the client with the revision returned by inspection.
3. `qa-client.mjs start PROJECT_OR_GITHUB_URL SHA /tmp/plan.json` submits the plan. Existing checks are retained; at most four generated files are added. Every generated file maps to explicit requirement IDs. No arbitrary host command is accepted by this API.
4. Test sources are copied into `/work/.obra-qa-tests` in each disposable container. Imports use `../` paths. Dependencies are prepared separately with npm lifecycle scripts disabled. The target revision and test source hashes are recorded.
5. Poll status; timestamped sequence numbers identify repository preparation, planning, test creation, check starts/completions and PDF generation. The skill reports new events in the current conversation when its channel supports interim replies; otherwise it provides a labeled recap. Real-time chat delivery and multiplayer still need a real channel acceptance test.
6. The PDF includes expected behavior, its evidence basis, mapped checks, coverage state and generated source hashes. PDF creation errors are separate from test errors.

Example plan:
```json
{"revision":"FULL_INSPECTED_SHA","requirements":[{"id":"validation","behavior":"Reject invalid input","basis":"README contract and src/validation.mjs"}],"tests":[{"name":"validation","requirements":["validation"],"source":"Node built-in test code with real assertions"}]}
```

Passing generated tests proves only those assertions on that revision. A test can be poorly designed; the model must review test validity. No automatic certification or defect confirmation is claimed. External services, UI flows, omitted source and unsupported environments remain explicit gaps. Registered legacy adapters such as AUTOMACAO continue using their existing specialized checks.

## Acceptance

- `npm test`: source inventory, immutable revision matching, invalid path rejection, mapping, uncovered requirements, API inspection/submission, authentication and legacy behavior.
- `node scripts/deep-demo.mjs`: actual offline Docker execution, intentional failing fixture, corrected fixture, source hashes and coverage gaps.
- `node scripts/demo.mjs`: original isolation/regression/timeout demonstration.

The public image predating this feature is not upgraded by editing source. Rebuild the runtime and restart the bridge to activate this flow locally; cloud installation still requires a per-installation executor.
