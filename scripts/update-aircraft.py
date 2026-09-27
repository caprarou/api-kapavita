#!/usr/bin/env python3
"""Cache a bounded OpenSky snapshot for the public map (every 30 minutes)."""
import json
import os
import pathlib
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / "app" / "dist" / "data" / "aircraft-live.json"
URL = "https://opensky-network.org/api/states/all?lamin=34&lomin=19&lamax=42&lomax=30"
req = urllib.request.Request(URL, headers={"User-Agent": "KapaVita/0.1 (https://api.kapavita.gr)"})
with urllib.request.urlopen(req, timeout=25) as response:
    source = json.load(response)
states = []
for row in source.get("states") or []:
    if len(row) > 13 and isinstance(row[5], (int, float)) and isinstance(row[6], (int, float)):
        states.append({
            "icao24": row[0], "callsign": (row[1] or "").strip(), "originCountry": row[2],
            "longitude": row[5], "latitude": row[6],
            "onGround": row[8], "altitude": row[13], "baroAltitude": row[7],
            "velocity": row[9], "heading": row[10], "verticalRate": row[11], "squawk": row[14], "positionSource": row[16], "lastContact": row[4]
        })
if not isinstance(source.get("time"), int):
    raise ValueError("OpenSky returned no timestamp")
TARGET.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=TARGET.parent, delete=False) as handle:
    json.dump({"source": URL, "time": source["time"], "fetchedAt": int(time.time()), "states": states}, handle, ensure_ascii=False)
    temporary = handle.name
os.chmod(temporary, 0o644)
os.replace(temporary, TARGET)
print("saved", len(states), "aircraft at", TARGET)
