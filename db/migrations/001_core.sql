BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS geo;
CREATE SCHEMA IF NOT EXISTS observations;
CREATE SCHEMA IF NOT EXISTS pipeline;

CREATE TABLE IF NOT EXISTS catalog.sources (
    id text PRIMARY KEY,
    name text NOT NULL,
    authority text,
    category text,
    description text,
    homepage text,
    documentation text,
    coverage text,
    access text,
    pricing text,
    license text,
    commercial_use text,
    update_frequency text,
    geographic_resolution text,
    last_verified date,
    status text NOT NULL,
    raw jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog.datasets (
    id text PRIMARY KEY,
    source_id text NOT NULL REFERENCES catalog.sources(id) ON UPDATE CASCADE,
    name text NOT NULL,
    layer_url text,
    feature_count integer,
    grain text,
    join_rule text,
    join_status text,
    status text NOT NULL,
    notes text,
    provider text,
    format text,
    temporal text,
    reuse text,
    evidence text,
    fields jsonb NOT NULL DEFAULT '[]'::jsonb,
    raw jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS datasets_source_idx ON catalog.datasets(source_id);
CREATE INDEX IF NOT EXISTS datasets_status_idx ON catalog.datasets(status);

CREATE TABLE IF NOT EXISTS pipeline.ingestion_runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id text REFERENCES catalog.datasets(id),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    records_read bigint NOT NULL DEFAULT 0,
    records_written bigint NOT NULL DEFAULT 0,
    source_revision text,
    detail text
);

CREATE INDEX IF NOT EXISTS ingestion_runs_dataset_started_idx
    ON pipeline.ingestion_runs(dataset_id, started_at DESC);

CREATE TABLE IF NOT EXISTS geo.areas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dataset_id text NOT NULL REFERENCES catalog.datasets(id),
    kind text NOT NULL CHECK (kind IN ('country', 'region', 'regional_unit', 'municipality', 'municipal_unit', 'community', 'marine_area')),
    external_id text NOT NULL,
    name text NOT NULL,
    parent_external_id text,
    population integer CHECK (population IS NULL OR population >= 0),
    reference_year smallint,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (dataset_id, external_id)
);

CREATE INDEX IF NOT EXISTS areas_geom_gix ON geo.areas USING gist(geom);
CREATE INDEX IF NOT EXISTS areas_kind_name_idx ON geo.areas(kind, name);
CREATE INDEX IF NOT EXISTS areas_parent_idx ON geo.areas(parent_external_id);

CREATE TABLE IF NOT EXISTS observations.air_stations (
    station_id text PRIMARY KEY,
    dataset_id text NOT NULL REFERENCES catalog.datasets(id),
    name text NOT NULL,
    location geometry(Point, 4326) NOT NULL,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS air_stations_location_gix
    ON observations.air_stations USING gist(location);

CREATE TABLE IF NOT EXISTS observations.air_measurements (
    station_id text NOT NULL REFERENCES observations.air_stations(station_id),
    pollutant text NOT NULL,
    observed_at timestamptz NOT NULL,
    value double precision NOT NULL,
    unit text NOT NULL,
    validity smallint,
    verification smallint,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (station_id, pollutant, observed_at)
);

CREATE INDEX IF NOT EXISTS air_measurements_latest_idx
    ON observations.air_measurements(pollutant, observed_at DESC);

CREATE TABLE IF NOT EXISTS observations.vessels (
    mmsi integer PRIMARY KEY CHECK (mmsi BETWEEN 100000000 AND 999999999),
    imo integer,
    name text,
    callsign text,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS observations.vessel_positions (
    mmsi integer NOT NULL REFERENCES observations.vessels(mmsi),
    observed_at timestamptz NOT NULL,
    source_id text NOT NULL REFERENCES catalog.sources(id),
    location geometry(Point, 4326) NOT NULL,
    speed_knots real,
    course real,
    heading real,
    collection_type text,
    destination text,
    eta timestamptz,
    raw jsonb NOT NULL DEFAULT '{}'::jsonb,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (mmsi, observed_at, source_id)
);

CREATE INDEX IF NOT EXISTS vessel_positions_location_gix
    ON observations.vessel_positions USING gist(location);
CREATE INDEX IF NOT EXISTS vessel_positions_latest_idx
    ON observations.vessel_positions(mmsi, observed_at DESC);

CREATE OR REPLACE VIEW observations.latest_vessel_positions AS
SELECT DISTINCT ON (mmsi)
       mmsi, observed_at, source_id, location, speed_knots, course, heading,
       collection_type, destination, eta, ingested_at
FROM observations.vessel_positions
ORDER BY mmsi, observed_at DESC;

COMMIT;
