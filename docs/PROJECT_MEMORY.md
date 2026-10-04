# KV.gr Project Memory

## Current evidence snapshot

- Date: 2026-10-04, Europe/Athens.
- Canonical repository inspected: `caprarou/kapavita`.
- Inspected repository commit: `ebe681a55194705062dfd5af1a3715f1a9b6441d` on `main`.
- Public apex response: `https://kapavita.gr/` returns the existing Coming Soon page through Caddy.
- Public API response: `https://api.kapavita.gr/` returns the existing KapaVita Spatial Intelligence SPA.
- Server checkout inspection: clean `main` at the same commit, with `kapavita-admin.service` and
  the AIS collector active; the EEA timer is installed and scheduled.
- Server runtime: Debian 13, Python 3.13.5, Node 20.19.2, PostgreSQL 17.11, Caddy on ports 80/443.
- Existing PostgreSQL data is isolated in `catalog`, `geo`, `observations` and `pipeline`; current
  observed counts are catalog sources 40, datasets 48, geo areas 6,487 and vessel positions 599.
- The first KV shell will be exposed at `https://api.kapavita.gr/kv` so the existing root map and
  existing apex Coming Soon site remain reversible and undisturbed during foundation work.
- The repository contains a React 19/Vite frontend, Python standard-library admin API, SQLite
  admin/session/audit state, Caddy configuration and systemd service definitions.
- Existing repository documentation says PostgreSQL/PostGIS is planned for data/catalog storage
  while the current admin service uses SQLite. This must be rechecked on the server before schema work.
- Baseline `npm run build --prefix app` passes locally after the KV foundation changes. The direct
  `maplibre-gl` dependency was upgraded to 6.12.0; the local npm audit now reports zero
  vulnerabilities. The bundle-size warning remains a follow-up optimization, not a release blocker.

## Server access

The live host is confirmed by DNS and existing project records as `89.58.62.202`, with the
authorized deployment account documented as `dev` and project paths under `/home/dev/projects` and
`/home/dev/deployments`. An authorized SSH identity is now available through the local SSH agent.
The private key remains outside the repository and was not transmitted in chat.

## Existing capabilities to preserve

- Python admin API already provides password hashing, secure host-only cookie naming,
  HttpOnly/SameSite session cookies, CSRF checks and audit records.
- Current role names are `admin`, `editor` and `viewer`; KV must replace this with explicit product
  roles and entity grants without silently widening access.
- Existing Caddy and systemd patterns isolate the KapaVita service and should be reused after
  server inspection.
- Existing map/catalog integrations stay intact and are not rewritten as part of the foundation.
