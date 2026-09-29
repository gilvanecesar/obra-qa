# Supply the immutable Plow base reference from the official registry.
ARG PLOW_BASE=public.ecr.aws/e1h7x4a2/plow-cloud-agents:base-771198a9609dcef54d44843e7da5329c17fa51b4@sha256:f1e7c421b97a80f1bd17015f96daceb965f350a241f7edc7e4d856a0e3a6f8f5
FROM ${PLOW_BASE}
ENV AGENT_ID=obra-qa \
    AGENT_NAME="Obra QA" \
    AGENT_BLURB="A QA teammate that runs isolated checks and reports evidence in your team chat."
COPY openclaw/skills/obra-qa /opt/plow/skills/obra-qa
COPY scripts/qa-client.mjs /opt/obra-qa/qa-client.mjs
# Preserve upstream persona/authority rules and reporter.

COPY openclaw/AGENTS.md /opt/plow/prompt/AGENTS.md
COPY openclaw/demo-revisions.json /opt/obra-qa/demo-revisions.json

LABEL org.opencontainers.image.source="https://github.com/gilvanecesar/obra-qa" \
      org.opencontainers.image.title="Obra QA" \
      org.opencontainers.image.licenses="MIT"
