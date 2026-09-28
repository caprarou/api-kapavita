#!/usr/bin/env python3
"""Probe published documentation links, separately from dataset access."""
import concurrent.futures
import datetime as dt
import json
import pathlib
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sources = json.loads((ROOT / 'catalog/sources.json').read_text())
def check(source):
    url = source.get('documentation') or source['homepage']
    request = urllib.request.Request(url, headers={'User-Agent': 'KapaVita source audit/1.0 (+https://api.kapavita.gr)'}, method='GET')
    try:
        with urllib.request.urlopen(request, timeout=7) as response:
            return {'sourceId': source['id'], 'url': url, 'httpStatus': response.status, 'result': 'documentation-reachable'}
    except urllib.error.HTTPError as error:
        return {'sourceId': source['id'], 'url': url, 'httpStatus': error.code, 'result': 'restricted-or-unavailable'}
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return {'sourceId': source['id'], 'url': url, 'httpStatus': None, 'result': 'network-inconclusive', 'reason': type(error).__name__}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    rows = sorted(pool.map(check, sources), key=lambda x: x['sourceId'])
out = {'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'method': 'HTTP GET published documentation/homepage; reachability does not verify the API, Greek coverage, licensing, or production suitability.', 'results': rows}
target = ROOT / 'docs/source-link-check.json'
target.write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
for row in rows:
    print(row['sourceId'], row['httpStatus'], row['result'])
print('wrote', target)
