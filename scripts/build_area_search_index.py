"""Create a compact place search index from the pinned ELSTAT GeoJSON snapshots."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'app/public/data'
municipalities = json.loads((root / 'greek-municipalities-2021.geojson').read_text())['features']
communities = json.loads((root / 'greek-communities-2021.geojson').read_text())['features']
municipal_names = {f['properties']['CODE']: f['properties']['NAME_GR'] for f in municipalities}
records = []
for feature in municipalities:
    props = feature['properties']
    records.append(dict(kind='municipality', code=props['CODE'], name=props['NAME_GR'],
                        bbox=feature['bbox'], population=props['pop21']))
for feature in communities:
    props = feature['properties']
    if props['LAU_LABEL3'].startswith('ΨΕΥΔΟ'):
        continue  # Census-only placeholder, not a named municipal community.
    parent = municipal_names.get(props['KAL2022'][:4])
    if parent is None:
        raise ValueError(f"No municipality for {props['KAL2022']}")
    records.append(dict(kind='community', code=props['KAL2022'], name=props['LAU_LABEL3'],
                        parent=parent, bbox=feature['bbox'], population=props['POPULUS']))
assert len(municipalities) == 333 and len(communities) == 6138
assert len(records) == 333 + 6070
assert len({(r['kind'], r['code']) for r in records}) == len(records)
output = root / 'greek-areas-search-2021.json'
output.write_text(json.dumps(records, ensure_ascii=False, separators=(',', ':')))
print(f'{len(records)} entries, {output.stat().st_size} bytes: {output}')
