#!/usr/bin/env python3
"""Synchronize the versioned JSON source registry into PostgreSQL."""
from __future__ import annotations

import csv
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def value(record: dict, key: str) -> str:
    item = record.get(key)
    return "" if item is None else str(item)


def write_csv(path: Path, records: list[dict], columns: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for record in records:
            row = {column: value(record, column) for column in columns}
            row["raw"] = json.dumps(record, ensure_ascii=False, separators=(",", ":"))
            if "fields" in columns:
                row["fields"] = json.dumps(record.get("fields", []), ensure_ascii=False, separators=(",", ":"))
            writer.writerow(row)


def main() -> None:
    sources = json.loads((ROOT / "catalog/sources.json").read_text(encoding="utf-8"))
    datasets = json.loads((ROOT / "catalog/datasets.json").read_text(encoding="utf-8"))
    source_columns = [
        "id", "name", "authority", "category", "description", "homepage", "documentation",
        "coverage", "access", "pricing", "license", "commercialUse", "updateFrequency",
        "geographicResolution", "lastVerified", "status", "raw",
    ]
    dataset_columns = [
        "id", "sourceId", "name", "layer", "count", "grain", "join", "joinStatus",
        "status", "notes", "provider", "format", "temporal", "reuse", "evidence", "fields", "raw",
    ]

    with tempfile.TemporaryDirectory(prefix="kapavita-catalog-") as temporary:
        directory = Path(temporary)
        sources_csv = directory / "sources.csv"
        datasets_csv = directory / "datasets.csv"
        write_csv(sources_csv, sources, source_columns)
        write_csv(datasets_csv, datasets, dataset_columns)
        sql = directory / "sync.sql"
        sql.write_text(f"""
BEGIN;
CREATE TEMP TABLE source_stage ({', '.join(column + ' text' for column in source_columns)});
\\copy source_stage FROM '{sources_csv.as_posix()}' WITH (FORMAT csv, HEADER true)
INSERT INTO catalog.sources
    (id,name,authority,category,description,homepage,documentation,coverage,access,pricing,license,
     commercial_use,update_frequency,geographic_resolution,last_verified,status,raw,updated_at)
SELECT id,name,NULLIF(authority,''),NULLIF(category,''),NULLIF(description,''),NULLIF(homepage,''),
       NULLIF(documentation,''),NULLIF(coverage,''),NULLIF(access,''),NULLIF(pricing,''),NULLIF(license,''),
       NULLIF(commercialUse,''),NULLIF(updateFrequency,''),NULLIF(geographicResolution,''),
       NULLIF(lastVerified,'')::date,status,raw::jsonb,now()
FROM source_stage
ON CONFLICT (id) DO UPDATE SET
    name=EXCLUDED.name, authority=EXCLUDED.authority, category=EXCLUDED.category,
    description=EXCLUDED.description, homepage=EXCLUDED.homepage, documentation=EXCLUDED.documentation,
    coverage=EXCLUDED.coverage, access=EXCLUDED.access, pricing=EXCLUDED.pricing, license=EXCLUDED.license,
    commercial_use=EXCLUDED.commercial_use, update_frequency=EXCLUDED.update_frequency,
    geographic_resolution=EXCLUDED.geographic_resolution, last_verified=EXCLUDED.last_verified,
    status=EXCLUDED.status, raw=EXCLUDED.raw, updated_at=now();

CREATE TEMP TABLE dataset_stage ({', '.join(column + ' text' for column in dataset_columns)});
\\copy dataset_stage FROM '{datasets_csv.as_posix()}' WITH (FORMAT csv, HEADER true)
INSERT INTO catalog.datasets
    (id,source_id,name,layer_url,feature_count,grain,join_rule,join_status,status,notes,provider,format,
     temporal,reuse,evidence,fields,raw,updated_at)
SELECT id,sourceId,name,NULLIF(layer,''),NULLIF(count,'')::integer,NULLIF(grain,''),NULLIF(join,''),
       NULLIF(joinStatus,''),status,NULLIF(notes,''),NULLIF(provider,''),NULLIF(format,''),
       NULLIF(temporal,''),NULLIF(reuse,''),NULLIF(evidence,''),fields::jsonb,raw::jsonb,now()
FROM dataset_stage
ON CONFLICT (id) DO UPDATE SET
    source_id=EXCLUDED.source_id, name=EXCLUDED.name, layer_url=EXCLUDED.layer_url,
    feature_count=EXCLUDED.feature_count, grain=EXCLUDED.grain, join_rule=EXCLUDED.join_rule,
    join_status=EXCLUDED.join_status, status=EXCLUDED.status, notes=EXCLUDED.notes,
    provider=EXCLUDED.provider, format=EXCLUDED.format, temporal=EXCLUDED.temporal,
    reuse=EXCLUDED.reuse, evidence=EXCLUDED.evidence, fields=EXCLUDED.fields,
    raw=EXCLUDED.raw, updated_at=now();
COMMIT;
""", encoding="utf-8")
        subprocess.run(
            ["psql", "--dbname=kapavita", "--set=ON_ERROR_STOP=1", f"--file={sql}"],
            cwd=ROOT,
            check=True,
        )

    print(f"Synchronized {len(sources)} sources and {len(datasets)} datasets.")


if __name__ == "__main__":
    main()
