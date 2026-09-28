#!/usr/bin/env python3
"""Import versioned local GeoJSON snapshots into PostGIS."""
from __future__ import annotations

import json
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app/public/data"
SPECS = (
    {
        "dataset": "geoboundaries-regions", "file": "greek-regions-2016.geojson", "kind": "region", "year": 2016,
        "external": lambda p: p["shapeID"], "name": lambda p: p["name_el"], "parent": lambda p: None, "population": lambda p: None,
    },
    {
        "dataset": "elstat-municipalities", "file": "greek-municipalities-2021.geojson", "kind": "municipality", "year": 2021,
        "external": lambda p: p["CODE"], "name": lambda p: p["NAME_GR"], "parent": lambda p: p["CODE"][:2], "population": lambda p: p.get("pop21"),
    },
    {
        "dataset": "elstat-communities", "file": "greek-communities-2021.geojson", "kind": "community", "year": 2021,
        "external": lambda p: p["KAL2022"], "name": lambda p: p["LAU_LABEL3"], "parent": lambda p: p["KAL2022"][:4], "population": lambda p: p.get("POPULUS"),
    },
    {
        "dataset": "iho-ionian-aegean", "file": "greek-sea-areas.geojson", "kind": "marine_area", "year": None,
        "external": lambda p: p.get("id") or str(p["mrgid"]), "name": lambda p: p["name"], "parent": lambda p: None, "population": lambda p: None,
    },
)
INSERT = """
INSERT INTO geo.areas
    (dataset_id,kind,external_id,name,parent_external_id,population,reference_year,properties,geom,ingested_at)
VALUES
    (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,
     ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s),4326)),3)),now())
"""


def main() -> None:
    total = 0
    with psycopg.connect("dbname=kapavita") as connection:
        for spec in SPECS:
            document = json.loads((DATA / spec["file"]).read_text(encoding="utf-8"))
            rows = []
            for feature in document["features"]:
                properties = feature.get("properties") or {}
                rows.append((
                    spec["dataset"], spec["kind"], str(spec["external"](properties)), str(spec["name"](properties)),
                    spec["parent"](properties), spec["population"](properties), spec["year"],
                    json.dumps(properties, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(feature["geometry"], separators=(",", ":")),
                ))
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM geo.areas WHERE dataset_id=%s", (spec["dataset"],))
                cursor.executemany(INSERT, rows)
                cursor.execute(
                    "INSERT INTO pipeline.ingestion_runs(dataset_id,status,finished_at,records_read,records_written,source_revision,detail) VALUES (%s,'succeeded',now(),%s,%s,%s,%s)",
                    (spec["dataset"], len(rows), len(rows), spec["file"], "Versioned local GeoJSON snapshot"),
                )
            connection.commit()
            total += len(rows)
            print(f"Imported {len(rows)} rows from {spec['file']}.")
    print(f"Imported {total} geographic records into PostGIS.")


if __name__ == "__main__":
    main()
