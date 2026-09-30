# Local setup (Docker Desktop)

## Quick start — one command

The executor (bridge) is a separate service Obra QA delegates to; the agent never
runs target code itself. To stand the executor up from scratch, on any machine
with Docker, Node and openssl:

```sh
node scripts/executor-up.mjs
```

It generates the token, certificate and fixture, builds the isolated runner image,
prints the `OBRA_QA_URL` / `OBRA_QA_TOKEN_FILE` / `OBRA_QA_CA_FILE` to set in the
agent, and keeps the bridge running on `127.0.0.1:4781`. Re-running it just
restarts the bridge (existing token and config are reused). It replaces the manual
steps below — keep reading only if you want to run them by hand.

## Manual setup

1. Run the README's quick-start build and tests.
2. Prepare the private fixture and bridge configuration:

```sh
node scripts/setup-local.mjs
openssl req -x509 -newkey rsa:2048 -nodes -days 7 \
  -keyout local/bridge.key -out local/bridge.crt \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1'
chmod 600 local/bridge.key
```

The setup script is for a fresh demo installation: it rewrites local/bridge.json. Back up custom project configuration before rerunning it. It generates local fixture revisions for the image. Renew the development certificate after seven days.

3. For PDF output, create a Python virtual environment and install ReportLab:

```sh
python3 -m venv local/venv
local/venv/bin/pip install reportlab==4.4.3
OBRA_QA_TOKEN_FILE=local/bridge-token OBRA_QA_PDF_PYTHON="$PWD/local/venv/bin/python" \
  node src/bridge.mjs local/bridge.json
```

Keep this process running. It binds only 127.0.0.1:4781. This route uses Docker Desktop's host.docker.internal; other hosts require separately validated networking.

4. With the official [plow-agents CLI](https://github.com/plow-pbc/plow-agents), authenticate and mint your own free line credential to `local/plow-credentials`. Do not reuse another agent's credentials. Never commit this directory.
5. Build and run in another terminal:

```sh
docker build --platform linux/amd64 \
  --build-arg PLOW_BASE=public.ecr.aws/e1h7x4a2/plow-cloud-agents:base-771198a9609dcef54d44843e7da5329c17fa51b4@sha256:f1e7c421b97a80f1bd17015f96daceb965f350a241f7edc7e4d856a0e3a6f8f5 \
  -f openclaw/Dockerfile -t obra-qa-agent:local .
docker compose -f compose.local.yml up -d
```

Text your own chosen Plow line. No public port, repository or customer data needs to be exposed. Register Agent Index and configure its AGENT_ID separately when publishing the hackathon installation.
