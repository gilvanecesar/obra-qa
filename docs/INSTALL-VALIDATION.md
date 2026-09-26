# Separate-container installation validation — 2026-09-25

## Scope and environment

Published runtime: `ghcr.io/gilvanecesar/obra-qa@sha256:e0e98eda021ddb8905bac42400fe0248a48b85787610ed301452fa099c2f52a2`.

A fresh public clone at `ad808870ae65e36cdd2977e08994a353e4eb1578` supplied a new host executor on loopback port 4782, with its own token, TLS certificate and synthetic fixture. The published linux/amd64 image ran in a separate Docker Desktop container on Apple Silicon. Its QA client connected over HTTPS using only the new token and CA mounts. No existing Plow identity or state was reused.

The executor and Python/ReportLab ran on the host, not inside the conversational image. Docker Engine and image cache were shared with the existing installation. This was not a clean-machine or independent cloud installation.

## Observed results

| Check | Result |
|---|---|
| Automated tests in fresh clone | 12/12 passed |
| Published client → separate HTTPS executor | Passed |
| Request without authentication | HTTP 401 |
| Synthetic cross-tenant defect | Assertion failed; overall INCONCLUSIVE under current policy |
| Corrected fixture | PASSED |
| Public repository URL without registration | Syntax and existing test suite passed |
| Source inspection + two-requirement additional plan | Original check and generated-test check passed |
| PDF generation and client download | Four files downloaded; PDF signatures checked |

The public URL target was this repository at `ad808870ae65e36cdd2977e08994a353e4eb1578`. The additional plan was operator-authored, so this run does not prove autonomous model test generation. PDFs were downloaded inside the container, not delivered through iMessage, and were not visually inspected in this test.

## Empty-state boot and remaining gates

The default entrypoint was also started with empty state and networking disabled. It logged `plow-boot: parked: PLOW_API_BASE is required` and stayed running, but the agent was not ready. Container liveness must not be presented as successful onboarding.

A fresh Plow identity, upstream configuration, secure executor provisioning and end-to-end conversation/attachment delivery still need validation. Multiplayer, clean-machine deployment and arbitrary language stacks were not tested. PASSED applies only to executed checks.

Temporary test containers and the separate bridge were stopped afterward. The active installation was preserved.
