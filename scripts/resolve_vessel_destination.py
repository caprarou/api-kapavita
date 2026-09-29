#!/usr/bin/env python3
import re, unicodedata
DESTINATIONS={
 'KAOMBO NORTE':{'name':'KAOMBO NORTE','latitude':-7.2353,'longitude':11.2889,'kind':'offshore_fpsO','confidence':'high'},
 'NEAPOLI':{'name':'Νεάπολη Πελοποννήσου','latitude':36.51,'longitude':23.42,'kind':'port','confidence':'medium'},
 'LIMASSOL':{'name':'Λιμένας Λεμεσού','latitude':34.67,'longitude':33.04,'kind':'port','confidence':'high'},
}
def normalize(value):
 s=unicodedata.normalize('NFKD',str(value)).encode('ascii','ignore').decode().upper()
 return re.sub(r'[^A-Z0-9]+',' ',s).strip()
def resolve(destination):
 key=normalize(destination)
 for alias,data in DESTINATIONS.items():
  if alias in key or key in alias:return {'raw':destination,'normalized':alias,**data}
 return {'raw':destination,'normalized':key or None,'latitude':None,'longitude':None,'kind':'unknown','confidence':'unmatched'}
if __name__=='__main__':
 import sys,json
 print(json.dumps(resolve(' '.join(sys.argv[1:]) or 'KAOMBO NORTE'),ensure_ascii=False))
