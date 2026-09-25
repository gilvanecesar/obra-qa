# Obra QA

An evidence-based QA agent built on OpenClaw and Plow for a trusted software team. Ask it to test a registered project; it pins the committed revision, runs configured checks in isolated Docker containers, records progress and produces evidence and an optional PDF.

**Hackathon prototype, under active development.** Real owner-chat execution has been verified. Automatic test generation from arbitrary repository links, live chat progress notifications, PDF chat delivery and multiplayer verification are still pending. This is not a complete autonomous audit or security certification.

## Architecture

Owner / team chat → Plow → OpenClaw skill → authenticated local QA bridge → isolated Docker runner → evidence / PDF → agent response.

OpenClaw interprets the request and results. The bridge allowlists repositories and checks; the agent cannot supply arbitrary commands, paths or Docker mounts. The runner has no network, host credentials or Docker socket, runs as a non-root user, and applies resource/time limits. The agent itself retains upstream tools: this deployment is for one trusted team, not mutually untrusted tenants.

## Quick start: reproducible synthetic demo

Requirements: Node.js 22+, Git and Docker. No npm dependencies are required.

```sh
npm test
docker build -f runner.Dockerfile -t obra-qa-runner .
node scripts/demo.mjs
```

The demo creates a temporary Git repository with a cross-tenant access defect, runs tests, applies a synthetic fix and reruns them. It also checks read-only root filesystem, absence of inherited credentials/socket, and timeout handling. Evidence is written under `runs/` (excluded from Git).

Nonzero exit codes currently produce `INCONCLUSIVE`, because the runner alone cannot distinguish a failing product assertion from an environment error. The agent must review evidence. `PASSED` covers only configured checks.

## Run the local Plow agent

Follow [local setup](docs/SETUP.md) to provision a private bridge, your own Plow credentials and the image. The synthetic demo needs no customer accounts. The optional AUTOMACAO adapter uses browser doubles and does not send messages; its private target repository is not included.

Example request: “QA, teste o projeto demo e mostre as evidências.”

The client supports `projects`, `start PROJECT [FULL_SHA]`, `status JOB_ID`, and `pdf JOB_ID`. Omitting SHA pins committed HEAD. Status includes timestamped execution events. Repository documentation is marked untrusted and is not considered proof of functionality.

## Validation and limitations

Six automated tests cover result semantics, API authentication, request restrictions, serialized jobs, automatic revision selection and exclusion of uncommitted documentation. The Docker demo exercises real execution. PDF generation requires Python with ReportLab. Jobs are held in memory; evidence survives restarts, but job retrieval endpoints do not.

Remaining work: deeper functional discovery, base/head comparison workflow, PostgreSQL scenarios, complete install packaging, live progress/attachments, multiplayer pilot, public runtime image, Agent Index registration and demo video. Usage reporting is inherited from the base image and requires a registered `AGENT_ID`; no registration is bundled.

See [integration status](docs/INTEGRATION.md) and [third-party components](THIRD_PARTY.md). Original code is licensed under [MIT](LICENSE).
