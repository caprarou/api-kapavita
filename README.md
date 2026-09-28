# KapaVita Spatial Intelligence

The first public preview of a map-centered registry for data about Greece.

## Current release

- Interactive Leaflet map of Greece using OpenStreetMap raster tiles. Raster tiles work without WebGL2.
- Local navigation search for seven named places; this is not a complete geocoder.
- A candidate source registry in `catalog/sources.json`, displayed with explicit unknown fields.
- Layer groups for land, sea, air and environment, including measured PM2.5 observations from Greek EEA stations.
- Clicking the map returns geographic coordinates, not verified administrative boundaries or facts.

The map now contains validated ELSTAT administrative boundaries/population, airports, aircraft snapshots, weather, model-based air quality and recent valid EEA E2a PM2.5 station measurements. The EEA collector refreshes every three hours and the frontend hides observations older than 24 hours. The source registry contains 36 sources and 43 datasets; see docs/source-review-2026-09-28.md and docs/eea-air-quality-audit-2026-09-28.md for exactly what was checked. The SEAVIOLET AIS collector has a confirmed subscription but no recorded vessel report yet.

The role-based administration service and dashboard are installed on the current VPS. The settings database is SQLite; Docker, PostgreSQL and PostGIS are not installed.

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
