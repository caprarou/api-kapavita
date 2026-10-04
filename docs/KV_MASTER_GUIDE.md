# KV.gr Master Guide

Status: foundation preparation, 2026-10-04

This document is the canonical index for the KV.gr product. It defines which project documents
are authoritative and records the current boundary between the existing KapaVita Spatial
Intelligence application and the planned KV workspace foundation.

## Source-of-truth order

1. The running server state and its verified release/checkpoint are operational truth.
2. `docs/PROJECT_MEMORY.md` records the inspected state and evidence.
3. `docs/FEATURE_STATUS.md` records implemented, verified, partial and pending behavior.
4. `docs/ROADMAP.md` records sequencing and task boundaries.
5. `docs/DECISION_LOG.md` records architectural and reuse decisions.
6. `docs/architecture.md`, `docs/integrations.md` and `docs/security.md` define subsystem contracts.

Older feature notes remain historical context only when they disagree with this set.

## Permanent development rule

**REUSE FIRST -> BUILD SECOND**

Before every significant component or feature:

`SEARCH -> EVALUATE -> REUSE/INTEGRATE -> BUILD ONLY THE KV-SPECIFIC LAYER -> TEST -> DOCUMENT`

The evaluation must cover license, maintenance, security posture, dependencies, compatibility,
upgrade path and lock-in. We prefer a maintained library or protocol integration. We use a whole
project fork only when the boundary, ownership and upgrade cost are explicitly justified.

## Product boundary

KV is a private, multi-user workspace that connects people, companies, places, properties/assets,
vehicles, accounts, devices and documents. Connectors are extension points; an unconfigured or
unverified connector must never fabricate data or imply that access exists.

Foundation scope is the secure product shell, identity and permissions, canonical entity model,
audit/security events, session/device controls, connector contracts and a responsive dashboard
layout engine. Tax, family money, investments, trading, calendar, cameras, Shelly, vehicles,
location, vault, projects, system health, attention/actions and Ask KV remain staged extensions.

## Delivery rule

Every server change must have a verified local Git checkpoint, tests/build evidence, an updated
status record and a rollback path. Production secrets, credentials and connector keys remain
server-side and outside Git. The first task is development/staging only; there is no official
GitHub v1 release in this phase.
