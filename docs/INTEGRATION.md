# Integration status

The OpenClaw extension is a skill plus an executable HTTP client, packaged on the official Plow image. It preserves the upstream boot, authority rules and usage reporter. Live OpenClaw skill discovery and tool use were validated on 2026-09-25: an internal gateway turn ran the demo audit and returned the exact assertion and evidence hash. The answer incorrectly speculated about boolean semantics in its suggested next step; evidence interpretation remains under development. Real owner chat delivery has been validated. Multiplayer remains unverified.

The operator starts `node src/bridge.mjs CONFIG.json` with `OBRA_QA_TOKEN_FILE` referencing a private file containing at least 32 random characters. CONFIG contains `projects: { "slug": { "repo": "/absolute/path", "spec": { "image": "sha256:...", "checks": [{ "name": "test", "argv": ["node", "--test"], "timeoutMs": 30000 }] } } }` plus optional port and out.

The bridge binds ONLY loopback. Do not expose it on 0.0.0.0. The operator must explicitly provision a private authenticated route for a container/cloud agent. The local Docker Desktop TLS route is provisioned and verified as described below; no tunnel or public port is created by this project.

The client accepts only an allowlisted project and exact commit SHA. It cannot submit commands, mount paths or image names. One active audit per executor; up to 100 recent jobs in memory. Restart loses job status but preserves run artifacts. It is for a trusted team, not a public multi-user API.

Runtime secrets are not build arguments. Do not bake tokens or target repositories into the agent image. Use OBRA_QA_URL (HTTPS off loopback) and OBRA_QA_TOKEN_FILE mounted privately. These variables are provisioned by compose.local.yml for the local deployment.

## Verified locally

HTTP authentication, project allowlist, exact revision requirement, arbitrary-command rejection, serial execution, and job completion protocol are covered by tests. Docker execution is separately covered by scripts/demo.mjs. Live multiplayer remains a release blocker.

## Local Docker Desktop transport

The bridge now supports HTTPS using an explicit certificate. The container client trusts only the mounted CA file and reaches `https://host.docker.internal:4781`; the host listener remains on 127.0.0.1. This route was verified with Docker Desktop on the development Mac. No public listener or tunnel was opened.

`node scripts/setup-local.mjs` prepares a persistent synthetic Git fixture and local configuration, without printing tokens. Generate a certificate valid for localhost, 127.0.0.1 and host.docker.internal first. Local development certificate expires after seven days; renew before reuse. The compose file mounts only the bridge token and certificate, never the Docker socket. Keep local/ excluded from Git and builds.

Start the bridge with `OBRA_QA_TOKEN_FILE=local/bridge-token node src/bridge.mjs local/bridge.json`. Then, after Plow activation/mint, use `docker compose -f compose.local.yml up -d`. AGENT_ID is deliberately unset until an explicit publication step.

## Implemented update: automatic revision, progress events and PDF

`start PROJECT` now pins committed HEAD on the server. Full SHA remains optional; arbitrary refs are rejected. The runner records timestamped start/completion events per check, visible in job status. README inventory is taken from the pinned commit and marked untrusted; this is not autonomous functional test discovery.

Set `OBRA_QA_PDF_PYTHON` to a Python interpreter with ReportLab installed when starting the bridge. Completed audits generate report.pdf; generation failure is separately reported. Authenticated GET /jobs/ID/report.pdf downloads it; `qa-client.mjs pdf ID` writes it to a private runtime /tmp filename for attachment. No public report URL is exposed. Chat attachment and live progress delivery still need end-to-end verification. Jobs remain memory-only; restart loses retrieval endpoints, while evidence files persist.
