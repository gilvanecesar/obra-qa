# Supply the immutable Plow base reference from the official registry.
ARG PLOW_BASE
FROM ${PLOW_BASE}
COPY openclaw/skills/obra-qa /opt/plow/skills/obra-qa
COPY scripts/qa-client.mjs /opt/obra-qa/qa-client.mjs
# Preserve upstream persona/authority rules and reporter. No AGENT_ID until publication.

COPY openclaw/AGENTS.md /opt/plow/prompt/AGENTS.md
COPY openclaw/demo-revisions.json /opt/obra-qa/demo-revisions.json
