#!/usr/bin/env python3
"""Bounded anonymous example queries. A passing example does not imply deployment rights."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
queries={
 'open-meteo':'https://api.open-meteo.com/v1/forecast?latitude=37.98&longitude=23.72&current=temperature_2m&timezone=Europe%2FAthens',
 'usgs-earthquakes':'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=34&maxlatitude=42&minlongitude=19&maxlongitude=30&limit=1&orderby=time',
 'gbif':'https://api.gbif.org/v1/occurrence/search?country=GR&limit=1',
 'world-bank':'https://api.worldbank.org/v2/country/GRC/indicator/SP.POP.TOTL?format=json&per_page=1',
 'eurostat':'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjan?geo=EL&time=2024&sex=T&age=TOTAL',
}
def probe(item):
 name,url=item
 req=urllib.request.Request(url,headers={'User-Agent':'KapaVita audit contact https://api.kapavita.gr'})
 try:
  with urllib.request.urlopen(req,timeout=10) as response:
   raw=response.read(100000)
   value=json.loads(raw)
   sample = list(value)[:5] if isinstance(value,dict) else [type(x).__name__ for x in value[:2]]
   return {'id':name,'httpStatus':response.status,'json':True,'topLevel':sample,'result':'anonymous-example-ok','url':url}
 except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,OSError,ValueError) as e:
  return {'id':name,'httpStatus':getattr(e,'code',None),'json':False,'result':'inconclusive','reason':type(e).__name__,'url':url}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 results=sorted(pool.map(probe,queries.items()),key=lambda x:x['id'])
target=ROOT/'docs/source-example-check.json'
target.write_text(json.dumps({'checkedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'method':'Anonymous bounded live example; data quality/rights not established.','results':results},ensure_ascii=False,indent=2)+'\n')
for row in results:print(row['id'],row['httpStatus'],row['result'],row.get('topLevel'))
