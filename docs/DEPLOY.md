# Image release and one-click deployment

Verified against the [Agent Index publishing instructions](https://aiworthusing.com/agent-index/publish), [Plow CLI](https://github.com/plow-pbc/plow-agents) and [OpenClaw base](https://github.com/plow-pbc/plow-openclaw-agent) on 2026-09-25.

## Current boundary

The image is the conversational agent, not an all-in-one QA service. The working installation runs the executor on the owner's Mac, outside the credential-bearing agent container. Public cloud installs cannot use that Mac's `host.docker.internal` route.

A public one-click agent must complete private executor onboarding before claiming that it can run tests. The upstream install flow has not yet been verified to provision our custom URL, token file and CA file. Do not request admission as a fully operational one-click QA service until that is solved and tested on a second installation.

| Runtime input | Purpose | Included in public image? |
|---|---|---|
| PLOW_AGENT_TOKEN and upstream Plow configuration | Conversation identity, supplied by Plow | No |
| AGENT_ID | Registered Agent Index slug for reporting | Yes: obra-qa |
| OBRA_QA_URL | Per-installation authenticated HTTPS executor | No |
| OBRA_QA_TOKEN_FILE | Secret file path for that executor | No |
| OBRA_QA_CA_FILE | Optional private CA certificate path | No |
| Project repository and runner image | Registered on executor host | No |

Do not point every install at the developer's private executor. Never mount a Docker socket into the conversational image to bypass onboarding. The bridge deliberately binds to loopback; remote use requires a separately secured and tested private route, not simply changing its listen address.

A separate-container test verified the published QA client against a fresh host executor, including audit execution and PDF download. Empty-state boot still requires Plow configuration. See [the installation record](INSTALL-VALIDATION.md); this does not satisfy the fresh-owner/cloud acceptance gate.

## 1. Validate the source

```sh
npm test
docker build -f runner.Dockerfile -t obra-qa-runner .
node scripts/demo.mjs
```

For phone-based validation, follow [SETUP.md](SETUP.md). Fresh installations generate their own synthetic fixture and revisions. The public image carries an empty revision manifest unless built after local fixture preparation; it does not contain a working demo executor.

## 2. Build the public runtime

The root Dockerfile points to the same pinned image definition as openclaw/Dockerfile. Both the base and runner image use immutable digests.

```sh
plow-agents image build ghcr.io/gilvanecesar/obra-qa:preview
```

Or:

```sh
docker build --platform linux/amd64 -t ghcr.io/gilvanecesar/obra-qa:preview .
```

The image preserves upstream boot/reporting and adds only QA instructions and the bridge client. Credentials, local configuration, runs and Git metadata are excluded from its build context.

## 3. Publish an immutable image reference

Option A: manually run **Publish preview image** under GitHub Actions. It runs tests, builds linux/amd64, pushes a commit-tagged GHCR image and prints its full digest in the run summary. The workflow does not promote an agent, register a listing or enable one-click deployment.

Option B: authenticate Docker to GHCR using the documented registry flow, then:

```sh
plow-agents image push ghcr.io/gilvanecesar/obra-qa:preview
```

Make the package public in GitHub package settings. Verify an anonymous pull of the exact `ghcr.io/gilvanecesar/obra-qa@sha256:...` reference from a clean machine before submitting it. Do not treat a successful authenticated push as proof of public availability.

## 4. Register and verify usage

When the agent is ready for real installations, update the registered `obra-qa` listing (prototype registration confirmed on 2026-09-25):

```sh
plow-agents image set obra-qa --name "Obra QA" \
  --blurb "A QA teammate that runs isolated checks and reports evidence in your team chat." \
  --repo https://github.com/gilvanecesar/obra-qa \
  --link https://github.com/gilvanecesar/obra-qa/blob/main/docs/SETUP.md
```

The image sets `AGENT_ID=obra-qa` for the registered listing. The base supplies usage reporting; verify actual reports reach that listing on a fresh installation. Do not generate artificial traffic or tokens. Registration is not deployment admission.

## 5. Acceptance gate before one-click admission

- [x] Public immutable image can be pulled anonymously with `--platform linux/amd64` (2026-09-25; existing Docker host, not a fresh machine).
- [ ] A second installation boots under a different owner's credentials.
- [ ] That installation can securely provision its own executor and registered project.
- [ ] Missing executor configuration produces clear onboarding instructions.
- [ ] Two real participants complete a trusted-group QA request.
- [ ] Repository text cannot redirect the workflow into unrelated actions.
- [ ] Test results, recorded progress and PDF match actual evidence.
- [x] PDF attachment is received in the owner’s Plow conversation (owner confirmation, 2026-09-25; local installation).
- [x] Agent Index registration and a manually submitted real usage report are verified (2026-09-25).
- [ ] Automatic recurring usage reporting is verified.
- [ ] A video of at least 60 seconds demonstrates the real workflow.

## 6. Organizer handoff

Run `plow-agents profile --show` to obtain the builder UID. Prepare these fields for the [organizers' Discord](https://aiworthusing.com/agent-index/publish):

```text
Agent: Obra QA
Slug: <registered slug>
Builder UID: <uid from profile --show>
Repository: https://github.com/gilvanecesar/obra-qa
Source commit: <release commit>
Public image: ghcr.io/gilvanecesar/obra-qa@sha256:<verified digest>
Demo video: <published video URL>
Executor onboarding: <verified per-installation steps>
Multiplayer evidence: <real two-person test summary>
Request: verify the agent and enable its initial one-click deployment.
```

An administrator enables the first deployment. Do not use an admin-only admission command as the owner. After admission, owners can promote a new immutable image using the official CLI:

```sh
plow-agents image push ghcr.io/gilvanecesar/obra-qa:v2 --promote obra-qa
```

## Submission timing

The [event page](https://luma.com/zhkhsnpa) lists September 28 at 11:59 pm PT as the submission deadline, followed by the September 30 leaderboard snapshot. The entry also requires MIT source, multiplayer, actual usage reporting and a real startup use case. Publishing source alone does not complete submission.
