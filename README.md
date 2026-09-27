# KapaVita Spatial Intelligence

The first public preview of a map-centered registry for data about Greece.

## Current release

- Interactive MapLibre map of Greece using OpenFreeMap's Positron style.
- Local navigation search for seven named places; this is not a complete geocoder.
- A candidate source registry in `catalog/sources.json`, displayed with explicit unknown fields.
- Layer groups for land, sea, air and environment. Only the basemap is active.
- Clicking the map returns geographic coordinates, not verified administrative boundaries or facts.

No live feeds, dataset overlays, account system, PostgreSQL or PostGIS database are active yet.
The candidate entries are leads for verification, not claims of API availability or usage rights.

## Run

```sh
cd app
npm ci
npm run dev
npm run build
```

Node.js 22 or newer is recommended. Production serves `app/dist` via Caddy.
The map style uses OpenFreeMap and OpenStreetMap data; their attribution remains visible on the map.

## Structure

- `app/`: React, TypeScript and Vite frontend.
- `catalog/sources.json`: machine-readable candidate registry, GitHub source of truth.
- `docs/architecture.md`: access model, provenance rules and next milestones.

Never commit secrets, credentials, paid data, or copied datasets without verified reuse rights.
