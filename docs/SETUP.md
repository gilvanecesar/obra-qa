# Local setup (Docker Desktop)

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
  --build-arg PLOW_BASE=public.ecr.aws/e1h7x4a2/plow-cloud-agents:base-7ce757a1745de286dd180c5c5182aca31eba8a75@sha256:6e5e1a11a8c6e2ef6ecaa5e7b429e778a9a3befaf416a09922aaaa4a5b21d647 \
  -f openclaw/Dockerfile -t obra-qa-agent:local .
docker compose -f compose.local.yml up -d
```

Text your own chosen Plow line. No public port, repository or customer data needs to be exposed. Register Agent Index and configure its AGENT_ID separately when publishing the hackathon installation.
