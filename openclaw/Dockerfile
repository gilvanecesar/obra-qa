# Supply the immutable Plow base reference from the official registry.
ARG PLOW_BASE=public.ecr.aws/e1h7x4a2/plow-cloud-agents:base-7ce757a1745de286dd180c5c5182aca31eba8a75@sha256:6e5e1a11a8c6e2ef6ecaa5e7b429e778a9a3befaf416a09922aaaa4a5b21d647
FROM ${PLOW_BASE}
COPY openclaw/skills/obra-qa /opt/plow/skills/obra-qa
COPY scripts/qa-client.mjs /opt/obra-qa/qa-client.mjs
# Preserve upstream persona/authority rules and reporter. No AGENT_ID until publication.

COPY openclaw/AGENTS.md /opt/plow/prompt/AGENTS.md
COPY openclaw/demo-revisions.json /opt/obra-qa/demo-revisions.json

LABEL org.opencontainers.image.source="https://github.com/gilvanecesar/obra-qa" \
      org.opencontainers.image.title="Obra QA" \
      org.opencontainers.image.licenses="MIT"
