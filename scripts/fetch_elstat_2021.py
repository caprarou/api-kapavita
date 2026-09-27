"""Refresh 2021 census boundaries from ELSTAT's public ArcGIS feature service."""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = 'https://webgissrv.statistics.gr/server/rest/services/DIAFORA/CENSUS2021/MapServer'
OUTPUT = Path(__file__).resolve().parents[1] / 'app/public/data'
LAYERS = [(2, 'greek-municipalities-2021.geojson', 'OBJECTID,CODE,NAME_GR,pop21', 333, '0.001'),
          (0, 'greek-communities-2021.geojson', 'OBJECTID,KAL2022,LAU_LABEL3,POPULUS', 6138, '0.0003')]
for layer_id, filename, fields, expected, tolerance in LAYERS:
    features = []
    for offset in range(0, expected, 500):
        params = dict(where='1=1', outFields=fields, outSR='4326', f='geojson',
                      resultOffset=offset, resultRecordCount=500, geometryPrecision=5,
                      orderByFields='OBJECTID', maxAllowableOffset=tolerance)
        url = f'{BASE}/{layer_id}/query?' + urllib.parse.urlencode(params)
        for attempt in range(4):
            try:
                with urllib.request.urlopen(url, timeout=120) as response:
                    page = json.load(response)
                if page.get('type') != 'FeatureCollection':
                    raise ValueError(page)
                features.extend(page['features'])
                print(layer_id, offset, len(page['features']), flush=True)
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
    def positions(value):
        if isinstance(value[0], (float, int)):
            yield value
        else:
            for part in value:
                yield from positions(part)
    for feature in features:
        coords = list(positions(feature['geometry']['coordinates']))
        feature['bbox'] = [min(p[0] for p in coords), min(p[1] for p in coords),
                           max(p[0] for p in coords), max(p[1] for p in coords)]
    ids = [f['properties']['OBJECTID'] for f in features]
    assert len(features) == expected and len(set(ids)) == expected, (layer_id, len(ids))
    assert all(f.get('geometry') for f in features), layer_id
    out = OUTPUT / filename
    out.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                              ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(out, out.stat().st_size, flush=True)
