# KapaVita Spatial Intelligence

The first public preview of a map-centered registry for data about Greece.

## Current release

- Interactive Leaflet map of Greece using OpenStreetMap raster tiles. Raster tiles work without WebGL2.
- Local navigation search for seven named places; this is not a complete geocoder.
- A candidate source registry in `catalog/sources.json`, displayed with explicit unknown fields.
- Layer groups for land, sea, air and environment. An opt-in 2016 regional-boundary layer is active; other thematic layers remain candidates.
- Clicking the map returns geographic coordinates, not verified administrative boundaries or facts.

No live feeds, dataset overlays, account system, PostgreSQL or PostGIS database are active yet.
Most registry entries are leads for verification. The geoBoundaries record documents one locally served, historical map layer; see `docs/regions-layer.md` for provenance and licensing.

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
