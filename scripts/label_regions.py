import json
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "app/public/data/greek-regions-2016.geojson"
names = [
    "Ανατολική Μακεδονία και Θράκη", "Κεντρική Μακεδονία",
    "Δυτική Μακεδονία", "Ήπειρος", "Θεσσαλία", "Στερεά Ελλάδα",
    "Ιόνια Νησιά", "Δυτική Ελλάδα", "Πελοπόννησος", "Αττική",
    "Βόρειο Αιγαίο", "Νότιο Αιγαίο", "Κρήτη", "Άγιο Όρος",
]
data = json.loads(path.read_text())
expected = [
    "Anatolikis Makedonias kai Thr*", "Kentrikis Makedonias",
    "Dytikis Makedonias", "Ipeiroy", "Thessalias", "Stereas Elladas",
    "Ionion Nison", "Dytikis Elladas", "Peloponnisoy", "Attikis",
    "Voreioy Aigaioy", "Notioy Aigaioy", "Kritis", "Agion Oros",
]
assert [f["properties"]["shapeName"] for f in data["features"]] == expected
for feature, name in zip(data["features"], names):
    feature["properties"]["name_el"] = name
path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
