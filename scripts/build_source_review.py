#!/usr/bin/env python3
"""Generate an honest source review from catalog metadata and bounded probes."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sources=json.loads((ROOT/'catalog/sources.json').read_text())
datasets=json.loads((ROOT/'catalog/datasets.json').read_text())
probes={p['sourceId']:p for p in json.loads((ROOT/'docs/source-link-check.json').read_text())['results']}
examples={p['id']:p for p in json.loads((ROOT/'docs/source-example-check.json').read_text())['results']}
lines=['# Έλεγχος πηγών · 28 Σεπτεμβρίου 2026','',
 'Ο κατάλογος περιλαμβάνει **%d πηγές** και **%d σύνολα**. Ο HTTP έλεγχος επισκέφθηκε μόνο τη δημοσιευμένη τεκμηρίωση ή την αρχική σελίδα κάθε πηγής: επιτυχία σημαίνει προσβάσιμη σελίδα, όχι λειτουργικό API, άδεια επαναχρησιμοποίησης ή πλήρη κάλυψη Ελλάδας.'%(len(sources),len(datasets)),
 '',
 'Σε πέντε πηγές εκτελέστηκε επίσης μικρό ανώνυμο ερώτημα ειδικά για Ελλάδα/Αθήνα. Τα πλήρη μηχαναγνώσιμα αποτελέσματα και URLs βρίσκονται στα [source-link-check.json](source-link-check.json) και [source-example-check.json](source-example-check.json).',
 '',
 '| Πηγή | Τεκμηρίωση από VPS | Δοκιμή δεδομένων | Σύνδεση στον ιστότοπο / επόμενο βήμα |',
 '| --- | --- | --- | --- |']
for s in sources:
 id=s['id'];p=probes.get(id,{})
 check=str(p.get('httpStatus') or 'άγνωστο')
 if check=='403': check='403 · ενδεχομένως αποκλεισμός αυτοματισμού'
 elif check=='άγνωστο':check='μη συμπερασματικό / timeout'
 elif check=='200':check='200 · προσβάσιμη σελίδα'
 sample=examples.get(id)
 value='HTTP %d · δείγμα JSON'%(sample['httpStatus']) if sample and sample['result']=='anonymous-example-ok' else 'Δεν έγινε πρόσβαση σε dataset'
 if id=='aisstream':value='Επιβεβαίωση συνδρομής στον server · αναμονή στίγματος'
 active='Συνδεδεμένο επίπεδο' if s['status']=='Ενεργό επίπεδο' else 'Υποψήφιο · '+ ('κλειδί / δικαιώματα' if 'key' in s['access'].lower() or 'λογαριασμό' in s['access'].lower() else 'δοκιμή ελληνικού dataset / άδειας')
 lines.append('| [%s](%s) | %s | %s | %s |'%(s['name'].replace('|','/'),s['documentation'] or s['homepage'],check,value,active))
lines.extend(['','## Πώς συνδυάζονται, όταν επαληθευτούν','',
 '- **Πληθυσμός / γη:** κοινό έτος και γεωμετρία δήμου ΕΛΣΤΑΤ· GHSL σε διαφορετικό μοντέλο πλέγματος, ESA WorldCover ως ποσοστά κάλυψης. Δεν εξισώνονται με επίσημη απογραφή ή τίτλους ιδιοκτησίας.',
 '- **Επιχειρήσεις:** Overture/OSM σημειακές θέσεις χωρικά σε δήμους. Συσχέτιση με ΓΕΜΗ μόνο με πραγματικό σταθερό αναγνωριστικό και έλεγχο ονόματος/διεύθυνσης· αποφυγή αυθαίρετης ταυτοποίησης.',
 '- **Περιβάλλον:** Open-Meteo/CAMS εκτίμηση μοντέλου δίπλα σε EEA πραγματικές μετρήσεις σταθμών με ξεχωριστά timestamps, ποιότητα και μονάδες.',
 '- **Μεταφορές / θάλασσα:** OurAirports ICAO κωδικοί με OpenSky αεροσκάφη όπου ταιριάζουν· AISStream MMSI με πολύγωνα Marine Regions για γενική θαλάσσια περιοχή, με ξεχωριστά δικαιώματα προβολής. EMODnet πυκνότητα είναι ιστορικό σύνολο και όχι ζωντανά πλοία.',
 '- **Γεγονότα / καιρός:** USGS σεισμοί ως σημειακά χρονικά γεγονότα με χωρική ένταξη σε δήμο· ERA5 ιστορική επανανάλυση δίπλα σε πρόγνωση, ποτέ ως τωρινή μετεωρολογική παρατήρηση.',
 '',
 '## Προτεραιότητα επόμενων ελέγχων','',
 '1. ΕΛΣΤΑΤ και GISCO: κοινά κλειδιά/έτη δήμων και κοινοτήτων πριν από ένωση πληθυσμού.',
 '2. EEA σταθμοί και OpenAQ: πραγματικές μετρήσεις, πρόσβαση, μονάδες, συχνότητα και δικαιώματα δημόσιας επανάχρησης.',
 '3. Overture / ΓΕΜΗ: κάλυψη Ελλάδας και εξωτερικά αναγνωριστικά επιχειρήσεων, όχι ένωση μόνο με όνομα.',
 '4. AISStream: λήψη πραγματικού μηνύματος SEAVIOLET, αξιολόγηση κάλυψης και όρων δημόσιας προβολής.',
 '5. ERA5 / WorldCover / GHSL: μικρά ελληνικά αποσπάσματα πριν από θεματικά επίπεδα.',
 ''])
(ROOT/'docs/source-review-2026-09-28.md').write_text('\n'.join(lines))
print('wrote review:',len(sources),'sources;',sum(1 for x in probes.values() if x.get('httpStatus')==200),'documentation pages reachable;',sum(1 for x in examples.values() if x['result']=='anonymous-example-ok'),'API examples passed')
