# KapaVita Spatial Intelligence

The first public preview of a map-centered registry for data about Greece.

## Current release

- Interactive Leaflet map of Greece using OpenStreetMap raster tiles. Raster tiles work without WebGL2.
- Local navigation search for seven named places; this is not a complete geocoder.
- A candidate source registry in `catalog/sources.json`, displayed with explicit unknown fields.
- Layer groups for land, sea, air and environment. An opt-in 2016 regional-boundary layer is active; other thematic layers remain candidates.
- Clicking the map returns geographic coordinates, not verified administrative boundaries or facts.

The map now contains validated ELSTAT administrative boundaries/population, airports, aircraft snapshots, weather and model-based air quality. The source registry contains 36 sources and 43 datasets; see `docs/source-review-2026-09-28.md` for exactly what was checked. The SEAVIOLET AIS collector has a confirmed subscription but no recorded vessel report yet.

A new role-based administration service and dashboard are implemented; **the Caddy route and systemd service require the one-time SSH installation in `docs/admin-control.md`**. Until installation, the login and private vessel view are unavailable. The settings database is SQLite; Docker, PostgreSQL and PostGIS are not installed.

## Run

```sh
cd app
npm ci
npm run dev
npm run build
```

Node.js 22 or newer is recommended. Production serves `app/dist` via Caddy.
The map uses OpenStreetMap tiles with visible attribution. Public tile usage should be reviewed before significant traffic.

## Structure

- `app/`: React, TypeScript and Vite frontend.
- `catalog/sources.json`: machine-readable candidate registry, GitHub source of truth.
- `docs/architecture.md`: access model, provenance rules and next milestones.

Never commit secrets, credentials, paid data, or copied datasets without verified reuse rights.
