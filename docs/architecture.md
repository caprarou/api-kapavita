# Architecture and next milestones

> Canonical cross-product decisions live in `docs/KV_MASTER_GUIDE.md`, `docs/PROJECT_MEMORY.md`,
> `docs/FEATURE_STATUS.md`, `docs/ROADMAP.md`, `docs/DECISION_LOG.md`, `docs/integrations.md` and
> `docs/security.md`. This file remains the subsystem contract for the existing Spatial
> Intelligence map and catalog.

## Product direction

The map is the central surface. Region, municipality and marine-area selection must come from
verified geographic datasets. Static, periodic and live layers share an explicit data contract:
source ID, dataset ID, geographic coverage, observed time, ingested time, license, quality state
and update frequency. A source can be listed even if paid or restricted; cost is metadata.

## First-release boundary

The first release is a navigable interface with a candidate registry, not a live intelligence feed.
Null registry fields mean unknown or not yet checked. Do not infer a license or commercial use
permission from an open website. Do not draw placeholder markers as real measurements.
The named-place search is a curated navigation list, not full administrative search.

## Planned server-side access control

Public guest, member, analyst, editor and platform admin are proposed roles, subject to product review.
Store grants for layer, dataset, region, live feed and export actions in PostgreSQL.
Deny by default for restricted data. Enforce every data query in the backend, never only in React.
The interface can begin public without login; authentication will be enabled when required.
Admin override actions should be auditable. Do not expose paid provider credentials to browsers.

## Next implementation sequence

1. Verify official Greek boundary sources and redistribution rights; import into PostGIS.
2. Implement area search and click selection for region, unit, municipality and community.
3. Add source validation workflow and per-dataset provenance, rights and freshness.
4. Add one real, licensed thematic layer end-to-end, then periodic and live adapters.
5. Add server endpoints and permission checks before enabling authentication or exports.
6. Automate build/deployment from GitHub to the VPS with staging checks.

## Hosting

The Vite frontend is a static build. Caddy serves `app/dist` at the main product host
`kapavita.gr`, with `/api/*` reverse-proxied to the Python admin API. The existing
`api.kapavita.gr` surface remains available as a compatibility/rollback host.
Third-party basemap availability is separate from application availability.
