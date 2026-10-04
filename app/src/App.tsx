import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Compass, Database, ExternalLink, Globe2, Heart, Info, Layers3, MapPin, Menu, Minus, Plus, Search, ShieldCheck, SlidersHorizontal, Waves, Wind, X } from 'lucide-react';
import { sources, type SourceRecord } from './data/catalog';
import { datasets, type DatasetRecord } from './data/datasets';
import { MapLayers, type OverlayKey, type Plane, type AirReading, type EEAReading, eeaReadingFresh, airQualityBand } from './MapLayers';
import { Seaviolet } from './Seaviolet';
import { Admin } from './Admin';
import { defaultFlags, type Flags } from './adminPolicy';
import KVWorkspace from './KVWorkspace';
import './App.css';

type Panel = 'map' | 'catalog' | 'seaviolet' | 'admin';
type Place = { name: string; detail: string; center: [number, number]; zoom: number };
type AreaSearchRecord = { kind: 'municipality' | 'community'; code: string; name: string; parent?: string; bbox: [number, number, number, number]; population: number | null };
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('el').replace(/ς/g, 'σ').trim();
const shortAreaName = (value: string) => normalizeSearch(value).replace(/^δημοτικη κοινοτητα\s+|^δημοσ\s+/, '');
const places: Place[] = [
  { name: 'Ελλάδα', detail: 'Χώρα', center: [23.8, 38.7], zoom: 5.7 },
  { name: 'Αθήνα', detail: 'Αττική', center: [23.7275, 37.9838], zoom: 10.5 },
  { name: 'Θεσσαλονίκη', detail: 'Κεντρική Μακεδονία', center: [22.9444, 40.6401], zoom: 10.5 },
  { name: 'Πάτρα', detail: 'Δυτική Ελλάδα', center: [21.7351, 38.2466], zoom: 10.5 },
  { name: 'Ηράκλειο', detail: 'Κρήτη', center: [25.1442, 35.3387], zoom: 10.5 },
  { name: 'Ρόδος', detail: 'Νότιο Αιγαίο', center: [28.2278, 36.4356], zoom: 10.5 },
  { name: 'Ιωάννινα', detail: 'Ήπειρος', center: [20.8537, 39.665], zoom: 10.5 },
];
const layerGroups = [
  { title: 'Ξηρά', icon: Layers3, entries: ['Περιφέρειες (2016)', 'Δήμοι (2021)', 'Δημοτικές κοινότητες (2021)', 'Πληθυσμός', 'Επιχειρήσεις', 'Ακίνητα'] },
  { title: 'Θάλασσα', icon: Waves, entries: ['Πλοία / AIS', 'Θαλάσσιες περιοχές', 'Θαλάσσιες ζώνες'] },
  { title: 'Αέρας', icon: Wind, entries: ['Αεροσκάφη', 'Αεροδρόμια'] },
  { title: 'Περιβάλλον', icon: Globe2, entries: ['Καιρός', 'Ποιότητα αέρα', 'Μετρήσεις PM2.5 (σταθμοί)', 'Σεισμοί', 'OpenAQ σταθμοί', 'Sentinel-2 εικόνες'] },
];

function MapView({ mapRef, onSelect, showRegions, showMunicipalities, showCommunities, active, onStatus, onPlane, onAirQuality, onEEA, onRegionSelect, onAreaSelect }: { mapRef: React.MutableRefObject<LeafletMap | null>; onSelect: (point: [number, number]) => void; showRegions: boolean; showMunicipalities: boolean; showCommunities: boolean; active: Record<OverlayKey, boolean>; onStatus: (key: OverlayKey, status: string) => void; onPlane: (plane: Plane & { snapshotTime: number }) => void; onAirQuality: (reading: AirReading) => void; onEEA: (reading: EEAReading | null) => void; onRegionSelect: (name: string) => void; onAreaSelect: (name: string, detail: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { zoomControl: false, minZoom: 4, maxZoom: 17 }).setView([38.7, 23.8], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 17,
    }).addTo(map);
    map.on('click', (event) => onSelect([event.latlng.lng, event.latlng.lat]));
    mapRef.current = map;
    return () => { mapRef.current = null; map.remove(); };
  }, [mapRef, onSelect]);
  useEffect(() => {
    if (!showRegions || !mapRef.current) return;
    const controller = new AbortController();
    const map = mapRef.current;
    let layer: L.GeoJSON | undefined;
    fetch('/data/greek-regions-2016.geojson', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Τα όρια δεν φορτώθηκαν'); return response.json(); })
      .then(data => {
        if (controller.signal.aborted) return;
        layer = L.geoJSON(data, {
          style: { color: '#117f72', weight: 2, opacity: .85, fillColor: '#2ca996', fillOpacity: .11 },
          onEachFeature: (feature, shape) => {
            const name = String(feature.properties?.name_el ?? 'Περιοχή');
            shape.bindTooltip(name, { sticky: true });
            shape.on('click', event => { L.DomEvent.stopPropagation(event); onRegionSelect(name); });
          },
        }).addTo(map);
      })
      .catch(error => { if (error.name !== 'AbortError') console.error('Αποτυχία φόρτωσης ορίων:', error); });
    return () => { controller.abort(); if (layer) map.removeLayer(layer); };
  }, [mapRef, showRegions, onRegionSelect]);
  useEffect(() => {
    if (!mapRef.current || (!showMunicipalities && !showCommunities)) return;
    const map = mapRef.current;
    const controller = new AbortController();
    const canvas = L.canvas({ padding: .3 });
    let municipalityLayer: L.GeoJSON | undefined;
    let communitiesLayer: L.GeoJSON | undefined;
    let communityData: GeoJSON.FeatureCollection | undefined;
    const drawCommunities = () => {
      if (communitiesLayer) { map.removeLayer(communitiesLayer); communitiesLayer = undefined; }
      if (!showCommunities || !communityData || map.getZoom() < 9) return;
      const bounds = map.getBounds().pad(.2);
      communitiesLayer = L.geoJSON(communityData, {
        filter: feature => {
          const box = feature.bbox;
          return !box || bounds.intersects(L.latLngBounds([box[1], box[0]], [box[3], box[2]]));
        },
        style: { renderer: canvas, color: '#df8e3c', weight: 1.2, opacity: .9, fillColor: '#f4ad63', fillOpacity: .07 },
        onEachFeature: (feature, shape) => {
          const props = feature.properties ?? {};
          const name = String(props.LAU_LABEL3 ?? 'Δημοτική κοινότητα');
          shape.bindTooltip(name, { sticky: true });
          shape.on('click', event => {
            L.DomEvent.stopPropagation(event);
            onAreaSelect(name, `${name.startsWith('ΨΕΥΔΟ') ? 'Απογραφική ψευδοκοινότητα' : 'Δημοτική κοινότητα'} · απογραφή 2021 · μόνιμος πληθυσμός ${Number(props.POPULUS ?? 0).toLocaleString('el-GR')}`);
          });
        },
      }).addTo(map);
    };
    if (showMunicipalities) {
      fetch('/data/greek-municipalities-2021.geojson', { signal: controller.signal })
        .then(response => { if (!response.ok) throw new Error('Οι δήμοι δεν φορτώθηκαν'); return response.json(); })
        .then(data => {
          if (controller.signal.aborted) return;
          municipalityLayer = L.geoJSON(data, {
            style: { renderer: canvas, color: '#175d9b', weight: 1.3, opacity: .85, fillColor: '#5badd6', fillOpacity: .04 },
            onEachFeature: (feature, shape) => {
              const props = feature.properties ?? {};
              const name = String(props.NAME_GR ?? 'Δήμος');
              shape.bindTooltip(name, { sticky: true });
              shape.on('click', event => {
                L.DomEvent.stopPropagation(event);
                onAreaSelect(name, `Δήμος · απογραφή 2021 · μόνιμος πληθυσμός ${Number(props.pop21 ?? 0).toLocaleString('el-GR')}`);
              });
            },
          }).addTo(map);
          communitiesLayer?.bringToFront();
        })
        .catch(error => { if (error.name !== 'AbortError') console.error('Αποτυχία φόρτωσης δήμων:', error); });
    }
    let loadingCommunities = false;
    const loadCommunities = () => {
      if (!showCommunities || map.getZoom() < 9 || communityData || loadingCommunities) return;
      loadingCommunities = true;
      fetch('/data/greek-communities-2021.geojson', { signal: controller.signal })
        .then(response => { if (!response.ok) throw new Error('Οι κοινότητες δεν φορτώθηκαν'); return response.json(); })
        .then(data => {
          if (controller.signal.aborted) return;
          communityData = data;
          drawCommunities();
          map.on('moveend', drawCommunities);
        })
        .catch(error => { if (error.name !== 'AbortError') console.error('Αποτυχία φόρτωσης κοινοτήτων:', error); })
        .finally(() => { loadingCommunities = false; });
    };
    if (showCommunities) {
      map.on('zoomend', loadCommunities);
      loadCommunities();
    }
    return () => {
      controller.abort();
      map.off('moveend', drawCommunities);
      map.off('zoomend', loadCommunities);
      if (municipalityLayer) map.removeLayer(municipalityLayer);
      if (communitiesLayer) map.removeLayer(communitiesLayer);
    };
  }, [mapRef, showMunicipalities, showCommunities, onAreaSelect]);
  return <><div ref={container} className="map-canvas" aria-label="Διαδραστικός χάρτης της Ελλάδας" /><MapLayers mapRef={mapRef} active={active} onStatus={onStatus} onArea={onAreaSelect} onPlane={onPlane} onAirQuality={onAirQuality} onEEA={onEEA} /></>;
}

function SourceCard({ source, related, onOpen }: { source: SourceRecord; related: DatasetRecord[]; onOpen: (source: SourceRecord) => void }) {
  const previewFields = [...new Set(related.flatMap(item => item.fields.map(readableField)))].slice(0, 5);
  const isPortal = source.id === 'data-gov-gr' || source.id === 'geodata';
  return <button className="source-card" onClick={() => onOpen(source)} aria-label={`Άνοιξε την πηγή ${source.name} και δες τι δεδομένα δίνει`}>
    <span className="source-card-icon"><Database size={18} /></span>
    <span className="source-card-body">
      <strong>{source.name}</strong><small>{source.authority}</small>
      <span className="source-data-preview"><b>Τι μπορείς να δεις</b>{related.map(item => <span key={item.id}>{item.name}</span>)}</span>
      <span className="source-card-fields"><b>{isPortal ? 'Διαθέσιμες πληροφορίες καταλόγου' : 'Ενδεικτικά στοιχεία'}</b>{previewFields.length ? previewFields.join(' · ') : 'Τα συγκεκριμένα πεδία δεν έχουν επιβεβαιωθεί ακόμη.'}</span>
      <span className="source-card-foot"><span className={source.status === 'Ενεργό επίπεδο' ? 'source-state-active' : 'source-state-pending'}>{source.status === 'Ενεργό επίπεδο' ? 'Στον χάρτη' : 'Υπό έλεγχο'}</span><span>Άνοιξε την καρτέλα για λεπτομέρειες →</span></span>
    </span>
    <ArrowRight size={17} className="source-arrow" />
  </button>;
}

const readableField = (field: string) => {
  const lower = field.toLocaleLowerCase('el');
  if (lower.includes('icao24') || lower.includes('mode-s')) return 'Ταυτότητα αεροσκάφους ICAO24';
  if (lower.includes('mmsi') || lower.includes('ssvid')) return 'Ταυτότητα πλοίου MMSI';
  if (lower.includes('pm2_5') || lower.includes('pm2.5')) return 'Λεπτά σωματίδια PM2.5';
  if (lower.includes('pm10')) return 'Σωματίδια PM10';
  if (lower.includes('aqi')) return 'Δείκτης ποιότητας αέρα';
  if (lower.includes('longitude') || lower === 'lon') return 'Γεωγραφικό μήκος';
  if (lower.includes('latitude') || lower === 'lat') return 'Γεωγραφικό πλάτος';
  if (lower.includes('callsign')) return 'Διακριτικό κλήσης';
  if (lower === 'time' || lower === 'datetime') return 'Περίοδος αναφοράς';
  if (lower.includes('current.time')) return 'Ώρα αναφοράς';
  if (lower.includes('temperature')) return 'Θερμοκρασία';
  if (lower.includes('precipitation')) return 'Βροχόπτωση';
  if (lower.includes('wind_speed')) return 'Ταχύτητα ανέμου';
  if (lower.includes('sog')) return 'Ταχύτητα πλοίου';
  if (lower.includes('cog') || lower.includes('heading')) return 'Πορεία';
  if (lower.includes('population') || lower.includes('pop21')) return 'Πληθυσμός';
  if (lower.includes('iata')) return 'Κωδικός αεροδρομίου IATA';
  if (lower.includes('geometry')) return 'Γεωμετρία στον χάρτη';
  if (lower.includes('shipname')) return 'Όνομα πλοίου';
  if (lower.includes('flag')) return 'Σημαία πλοίου';
  if (lower.includes('shop')) return 'Είδος καταστήματος';
  if (lower.includes('office')) return 'Είδος γραφείου';
  if (lower.includes('amenity')) return 'Είδος δραστηριότητας';
  const exact: Record<string, string> = {
    kal2022: 'Κωδικός κοινότητας', code: 'Διοικητικός κωδικός',
    lau_label3: 'Όνομα κοινότητας', name_gr: 'Ελληνική ονομασία',
    populus: 'Μόνιμος πληθυσμός', pop11: 'Πληθυσμός 2011',
    men21: 'Άνδρες 2021', women21: 'Γυναίκες 2021',
    age0014: 'Ηλικίες 0–14', age1529: 'Ηλικίες 15–29', age3044: 'Ηλικίες 30–44',
    age4559: 'Ηλικίες 45–59', age6074: 'Ηλικίες 60–74', age7500: 'Ηλικίες 75+',
    nuts2: 'Κωδικός περιφέρειας NUTS 2',
    shapeid: 'Κωδικός γεωμετρίας', shapename: 'Όνομα περιοχής', shapetype: 'Είδος περιοχής',
    'id osm': 'Ταυτότητα σημείου OSM', 'addr:* (όπου υπάρχει)': 'Διεύθυνση, αν υπάρχει',
    'sourcecode': 'Κωδικός προέλευσης', 'registryinfo': 'Στοιχεία δημόσιου μητρώου',
    'selfreportedinfo': 'Στοιχεία που δήλωσε το πλοίο',
    imo: 'Διεθνής αριθμός πλοίου IMO', ident: 'Κωδικός αεροδρομίου',
    scheduled_service: 'Ένδειξη προγραμματισμένων πτήσεων',
    municipality: 'Δηλωμένος δήμος', 'mrgid': 'Κωδικός θαλάσσιας περιοχής',
    squawk: 'Κωδικός αναμεταδότη', 'origin_country (συναγόμενο από ICAO24)': 'Χώρα αναμεταδότη',
    'geo_altitude (m)': 'Γεωμετρικό ύψος', 'baro_altitude (m)': 'Βαρομετρικό ύψος',
    'velocity (m/s)': 'Ταχύτητα', 'true_track (°)': 'Κατεύθυνση',
    'vertical_rate (m/s)': 'Άνοδος ή κάθοδος', on_ground: 'Στο έδαφος ή στον αέρα',
    'last_contact (utc)': 'Τελευταία επικοινωνία', 'planned departure/arrival': 'Προγραμματισμένη αναχώρηση και άφιξη',
    'actual departure': 'Πραγματική αναχώρηση', 'estimated arrival': 'Εκτιμώμενη άφιξη',
    'status': 'Κατάσταση πτήσης', 'afm': 'ΑΦΜ', 'uid': 'Κωδικός εγγραφής',
    'org_uid': 'Κωδικός φορέα', 'issuer_afm': 'ΑΦΜ φορέα έκδοσης',
    'issuer_title': 'Επωνυμία φορέα έκδοσης', 'address': 'Διεύθυνση',
    'entered_org_details_at': 'Ημερομηνία καταχώρισης', 'amount': 'Ποσό', 'vat': 'ΦΠΑ',
    'year': 'Έτος', 'date': 'Ημερομηνία', 'value': 'Τιμή μέτρησης',
    'sex': 'Φύλο', 'age': 'Ηλικιακή ομάδα', 'unit': 'Μονάδα μέτρησης',
    'scientificname': 'Επιστημονική ονομασία είδους', 'eventdate': 'Ημερομηνία παρατήρησης',
    'acq_date': 'Ημερομηνία δορυφορικής ανίχνευσης', 'acq_time': 'Ώρα δορυφορικής ανίχνευσης',
    'satellite': 'Δορυφόρος', 'confidence': 'Βαθμός βεβαιότητας',
    'geo (nuts 3)': 'Περιφερειακή ενότητα NUTS 3', 'countryiso3code': 'Κωδικός χώρας',
    'indicator.id': 'Κωδικός δείκτη', 'properties.mag': 'Μέγεθος σεισμού',
    'properties.time': 'Ώρα σεισμού', 'properties.place': 'Περιγραφή τοποθεσίας',
    'geometry.coordinates [lon,lat,depth]': 'Θέση και βάθος σεισμού',
    'key': 'Κωδικός παρατήρησης', 'countrycode': 'Κωδικός χώρας',
    'bbox': 'Πλαίσιο χωρικής κάλυψης', 'assets': 'Αρχεία δορυφορικής σκηνής',
    'name_el (τοπικός εμπλουτισμός)': 'Ελληνική ονομασία (τοπική προσθήκη)',
    'title': 'Επωνυμία', 'id': 'Κωδικός εγγραφής',
  };
  return exact[lower] ?? field;
};

function SourceDetail({ source, related, onClose }: { source: SourceRecord; related: DatasetRecord[]; onClose: () => void }) {
  return <div className="detail-overlay" onClick={onClose}><aside className="detail-panel" onClick={e => e.stopPropagation()} aria-label={'Στοιχεία πηγής ' + source.name}>
    <div className="detail-top"><span className="eyebrow">ΠΡΟΦΙΛ ΠΗΓΗΣ</span><button aria-label="Κλείσιμο" onClick={onClose}><X size={19}/></button></div>
    <span className="detail-icon"><Database size={24}/></span><h2>{source.name}</h2><p className="detail-authority">{source.authority}</p>
    <span className={source.status === 'Ενεργό επίπεδο' ? 'active-badge' : 'pending-badge'}>● {source.status}</span>
    <p className="detail-description">{source.description}</p>
    <section className="source-datasets"><h3>Τι μπορείς να δεις από αυτή την πηγή</h3>
      {related.map(item => <article className="source-dataset" key={item.id}><div className="source-dataset-heading"><strong>{item.name}</strong><span className={item.status === 'Ενεργό επίπεδο' || item.status.startsWith('Ελεγμένο') ? 'dataset-status verified' : 'dataset-status'}>{item.status}</span></div>
        <p>{item.notes}</p><div className="source-field-list"><b>{source.status === 'Ενεργό επίπεδο' || source.status.startsWith('Ελεγμένο') ? 'Πεδία από ελεγμένο δείγμα' : 'Ενδεικτικά στοιχεία / πεδία υπό έλεγχο'}</b><div>{item.fields.length ? item.fields.map(field => <span key={field} title={field}>{readableField(field)}</span>) : <em>Δεν έχει επιβεβαιωθεί κατάλογος πεδίων.</em>}</div></div>
        <dl><div><dt>Για ποια θέση;</dt><dd>{item.grain}</dd></div><div><dt>Πότε;</dt><dd>{item.temporal}</dd></div><div><dt>Πώς συνδέεται;</dt><dd>{item.join}</dd></div></dl>
      </article>)}
    </section>
    <div className="detail-rows"><div><span>Κατηγορία</span><strong>{source.category}</strong></div><div><span>Κάλυψη</span><strong>{source.coverage}</strong></div><div><span>Πρόσβαση</span><strong>{source.access}</strong></div><div><span>Κόστος / όροι</span><strong>{source.pricing}</strong></div><div><span>Άδεια χρήσης</span><strong>{source.license ?? 'Προς επαλήθευση'}</strong></div><div><span>Εμπορική χρήση</span><strong>{source.commercialUse ?? 'Προς επαλήθευση'}</strong></div><div><span>Τελευταίος έλεγχος</span><strong>{source.lastVerified ?? 'Δεν έχει ελεγχθεί'}</strong></div></div>
    <a className="visit-link" href={source.homepage} target="_blank" rel="noopener noreferrer">Ιστότοπος πηγής <ExternalLink size={16}/></a>
    {source.documentation && <a className="documentation-link" href={source.documentation} target="_blank" rel="noopener noreferrer">Επίσημη τεκμηρίωση <ExternalLink size={15}/></a>}
    <p className="detail-disclaimer">Οι ενδείξεις «τεκμηριωμένο» και «υποψήφιο» δεν σημαίνουν ότι υπάρχουν ήδη δεδομένα αυτής της πηγής στον χάρτη. Τα πεδία τους ελέγχονται πριν ενεργοποιηθεί επίπεδο.</p>
  </aside></div>;
}

function DatasetCard({ dataset }: { dataset: DatasetRecord }) {
  return <details className="dataset-card">
    <summary><span className="dataset-main"><strong>{dataset.name}</strong><small>{dataset.provider} · {dataset.grain}{dataset.count != null ? ` · ${dataset.count.toLocaleString('el-GR')} εγγραφές` : ''}</small></span><span className={dataset.status.startsWith('Ελεγμένο') || dataset.status === 'Ενεργό επίπεδο' ? 'dataset-status verified' : 'dataset-status'}>{dataset.status}</span><ChevronDown size={16}/></summary>
    <div className="dataset-detail"><p>{dataset.notes}</p><div className="dataset-fields"><span>Βασικά πεδία</span><div>{dataset.fields.length ? dataset.fields.map(field => <code key={field}>{field}</code>) : <em>Δεν έχει επιβεβαιωθεί σχήμα δεδομένων.</em>}</div></div><div className="dataset-meta"><div><span>Μονάδα</span><strong>{dataset.grain}</strong></div><div><span>Πιθανή σύνδεση</span><strong>{dataset.join}</strong><small>{dataset.joinStatus}</small></div><div><span>Πρόσβαση / χρόνος</span><strong>{dataset.format} · {dataset.temporal}</strong></div><div><span>Άδεια / επανάχρηση</span><strong>{dataset.reuse}</strong></div><div><span>Έλεγχος</span><strong>{dataset.evidence}</strong></div></div><a href={dataset.layer} target="_blank" rel="noopener noreferrer">Πηγή / τεκμηρίωση <ExternalLink size={14}/></a></div>
  </details>;
}

function EEAStationCard({ reading, onClose }: { reading: EEAReading; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  const observed = new Date(reading.observedAt);
  const ageHours = Math.max(0, (now - observed.getTime()) / 3600_000);
  return <div className="air-quality-card eea-reading-card" role="region" aria-label="Μέτρηση σταθμού EEA">
    <div className="aircraft-card-header"><span className="eyebrow">ΠΡΑΓΜΑΤΙΚΗ ΜΕΤΡΗΣΗ ΣΤΑΘΜΟΥ · EEA</span><button aria-label="Κλείσιμο μέτρησης σταθμού" onClick={onClose}><X size={16}/></button></div>
    <h2>{reading.name}</h2>
    <div className="eea-reading-value"><strong>{reading.value.toLocaleString('el-GR', { maximumFractionDigits: 1 })}</strong><span>µg/m³ <small>λεπτά σωματίδια PM2.5</small></span></div>
    <p className="eea-reading-time">Ώρα μέτρησης: <strong>{observed.toLocaleString('el-GR', { timeZone: 'Europe/Athens', dateStyle: 'short', timeStyle: 'short' })} (Ελλάδα)</strong><br/>Πριν από περίπου {ageHours.toLocaleString('el-GR', { maximumFractionDigits: 1 })} ώρες.</p>
    <p className="air-quality-source">Κωδικός σταθμού: {reading.stationId} · Σήμανση τιμής: {reading.validity === 1 ? 'έγκυρη' : 'έγκυρη, κάτω από το όριο ανίχνευσης'} · {reading.verification === 1 ? 'επαληθευμένη εγγραφή' : reading.verification === 2 ? 'προκαταρκτικά ελεγμένη' : 'χωρίς επαλήθευση'}.</p>
    <p className="air-quality-source">Μία ωριαία μέτρηση στο συγκεκριμένο σημείο. Δεν είναι μέσος όρος πόλης, δείκτης AQI ή εκτίμηση της έκθεσής σου. Η σειρά E2a μπορεί να ενημερωθεί.</p>
    <a href="https://www.eea.europa.eu/en/datahub/datahubitem-view/778ef9f5-6293-4846-badd-56a29c70880d" target="_blank" rel="noopener noreferrer">Πηγή: Ευρωπαϊκός Οργανισμός Περιβάλλοντος ↗</a>
  </div>;
}

function SpatialApp() {
  const mapRef = useRef<LeafletMap | null>(null);
  const [panel, setPanel] = useState<Panel>(() => { const saved = sessionStorage.getItem('kapavita-panel'); return saved === 'catalog' || saved === 'seaviolet' || saved === 'admin' ? saved : 'map'; });
  const [features, setFeatures] = useState<Flags>(defaultFlags);
  const [seavioletAllowed, setSeavioletAllowed] = useState(false);
  const refreshPolicy = useCallback(() => { void fetch('/api/public', { credentials: 'same-origin', cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Policy unavailable'); return r.json(); }).then(d => { const policy=d.features as Flags; setFeatures(policy); setSeavioletAllowed(Boolean(d.seavioletAllowed)); setPanel(previous => previous === 'seaviolet' && !d.seavioletAllowed || previous === 'catalog' && !policy.catalog ? 'map' : previous); }).catch(() => { setFeatures(defaultFlags); setSeavioletAllowed(false); setPanel(previous => previous === 'seaviolet' ? 'map' : previous); }); }, []);
  useEffect(() => { refreshPolicy(); }, [refreshPolicy]);
  useEffect(() => { void fetch('/api/visit', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({page:panel}), keepalive:true }).catch(()=>{}); }, [panel]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [areaIndex, setAreaIndex] = useState<AreaSearchRecord[] | null>(null);
  const [searchError, setSearchError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/greek-areas-search-2021.json', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Η αναζήτηση δεν φορτώθηκε'); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setAreaIndex(data); })
      .catch(error => { if (error.name !== 'AbortError') setSearchError(true); });
    return () => controller.abort();
  }, []);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(places[0]);
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
  const [selectedPopulation, setSelectedPopulation] = useState<number | null>(null);
  const [selectedAirQuality, setSelectedAirQuality] = useState<AirReading | null>(null);
  const [selectedEEA, setSelectedEEA] = useState<EEAReading | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<(Plane & { snapshotTime: number }) | null>(null);
  const selectAircraft = useCallback((plane: Plane & { snapshotTime: number }) => { setSelectedAircraft(plane); setSelectedAirQuality(null); setSelectedEEA(null); setSelectedPopulation(null); setSelectedPlace(null); setSelectedPoint(null); }, [setSelectedAircraft, setSelectedAirQuality, setSelectedEEA, setSelectedPlace, setSelectedPoint, setSelectedPopulation]);
  const [selectedSource, setSelectedSource] = useState<SourceRecord | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [showMunicipalities, setShowMunicipalities] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Record<OverlayKey, boolean>>({ population: false, airports: false, aircraft: false, marine: false, weather: false, airQuality: false, eeaAir: false, earthquakes: false, openaq: false, copernicus: false });
  const visibleOverlays = Object.fromEntries((Object.keys(activeOverlays) as OverlayKey[]).map(key => [key, activeOverlays[key] && (features[key] ?? true)])) as Record<OverlayKey, boolean>;
  const visibleRegions = showRegions && features.regions;
  const visibleMunicipalities = showMunicipalities && features.municipalities;
  const visibleCommunities = showCommunities && features.communities;
  const [overlayStatuses, setOverlayStatuses] = useState<Partial<Record<OverlayKey, string>>>({});
  const onOverlayStatus = useCallback((key: OverlayKey, status: string) => setOverlayStatuses(previous => previous[key] === status ? previous : { ...previous, [key]: status }), []);
  const overlayNames: Partial<Record<string, OverlayKey>> = { 'Πληθυσμός': 'population', 'Θαλάσσιες περιοχές': 'marine', 'Αεροσκάφη': 'aircraft', 'Αεροδρόμια': 'airports', 'Καιρός': 'weather', 'Ποιότητα αέρα': 'airQuality', 'Μετρήσεις PM2.5 (σταθμοί)': 'eeaAir', 'Σεισμοί': 'earthquakes', 'OpenAQ σταθμοί': 'openaq', 'Sentinel-2 εικόνες': 'copernicus' };
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Ξηρά: true, Θάλασσα: true, Αέρας: true, Περιβάλλον: true });
  const filteredDatasets = useMemo(() => datasets.filter(d => `${d.name} ${d.provider} ${d.grain} ${d.fields.join(' ')}`.toLocaleLowerCase('el').includes(query.toLocaleLowerCase('el'))), [query]);
  const filteredSources = useMemo(() => sources.filter(s => `${s.name} ${s.category} ${s.authority} ${datasets.filter(d => d.sourceId === s.id).map(d => [d.name, d.notes, ...d.fields].join(' ')).join(' ')}`.toLocaleLowerCase('el').includes(query.toLocaleLowerCase('el'))), [query]);
  const filteredPlaces = useMemo(() => places.filter(p => `${p.name} ${p.detail}`.toLocaleLowerCase('el').includes(query.toLocaleLowerCase('el'))), [query]);
  const searchableAreas = useMemo(() => (areaIndex ?? []).map(area => ({ ...area, searchName: normalizeSearch(area.name), shortName: shortAreaName(area.name) })), [areaIndex]);
  const filteredAreas = useMemo(() => {
    const term = normalizeSearch(query);
    if (term.length < 2) return [];
    const rank = (area: typeof searchableAreas[number]) => area.shortName === term ? 0 : area.shortName.startsWith(term) ? 1 : area.searchName.includes(term) ? 2 : area.code.includes(term) ? 3 : 4;
    return searchableAreas.filter(area => rank(area) < 4 && (area.kind === 'municipality' ? features.municipalities : features.communities))
      .sort((a, b) => rank(a) - rank(b) || (a.kind === 'municipality' ? -1 : 1) - (b.kind === 'municipality' ? -1 : 1) || a.name.localeCompare(b.name, 'el'))
      .slice(0, 12);
  }, [query, searchableAreas, features.municipalities, features.communities]);

  const goTo = (place: Place) => { setSelectedEEA(null); setSelectedPopulation(null); setPanel('map'); setSelectedPlace(place); setSelectedPoint(null); setSearchOpen(false); setQuery(''); setMobileMenu(false); setSelectedSource(null); requestAnimationFrame(() => mapRef.current?.flyTo([place.center[1], place.center[0]], place.zoom, { duration: 1.1 })); };
  const goToArea = (area: AreaSearchRecord) => {
    setSelectedEEA(null);
    const bounds = L.latLngBounds([area.bbox[1], area.bbox[0]], [area.bbox[3], area.bbox[2]]);
    const detail = `${area.kind === 'municipality' ? 'Δήμος' : 'Δημοτική κοινότητα'} · απογραφή 2021${area.parent ? ` · ${area.parent}` : ''}${area.population == null ? '' : ` · ${area.population.toLocaleString('el-GR')} κάτοικοι`}`;
    setPanel('map'); setSelectedPopulation(area.population); setSelectedPlace({ name: area.name, detail, center: [bounds.getCenter().lng, bounds.getCenter().lat], zoom: area.kind === 'community' ? 12 : 10 });
    setSelectedPoint(null); setSearchOpen(false); setQuery(''); setMobileMenu(false); setSelectedSource(null);
    if (area.kind === 'municipality') setShowMunicipalities(true);
    else setShowCommunities(true);
    requestAnimationFrame(() => mapRef.current?.fitBounds(bounds, { padding: [36, 36], maxZoom: area.kind === 'community' ? 12 : 11, animate: true }));
  };
  const showSource = (source: SourceRecord) => { if (!features.catalog) return; setSelectedSource(source); setPanel('catalog'); setSearchOpen(false); setMobileMenu(false); };
  const selectAirQuality = useCallback((reading: AirReading) => { setSelectedAirQuality(reading); setSelectedEEA(null); setSelectedAircraft(null); setSelectedPopulation(null); }, [setSelectedAircraft, setSelectedAirQuality, setSelectedEEA, setSelectedPopulation]);
  const selectEEA = useCallback((reading: EEAReading | null) => { setSelectedEEA(reading); if (reading) { setSelectedAirQuality(null); setSelectedAircraft(null); } }, [setSelectedAircraft, setSelectedAirQuality, setSelectedEEA]);
  const selectPoint = useCallback((point: [number, number]) => { setSelectedAircraft(null); setSelectedAirQuality(null); setSelectedEEA(null); setSelectedPopulation(null); setSelectedPoint(point); setSelectedPlace(null); setSelectedSource(null); }, [setSelectedAircraft, setSelectedAirQuality, setSelectedEEA, setSelectedPlace, setSelectedPoint, setSelectedPopulation, setSelectedSource]);
  const selectRegion = useCallback((name: string) => { setSelectedEEA(null); setSelectedPopulation(null); setSelectedPlace({ name, detail: 'Περιφέρεια · όρια 2016', center: [23.8, 38.7], zoom: 6 }); setSelectedPoint(null); }, [setSelectedEEA, setSelectedPlace, setSelectedPoint, setSelectedPopulation]);
  const selectArea = useCallback((name: string, detail: string) => { const population = detail.match(/([\d.]+)\s+κάτοικοι/)?.[1]; setSelectedAircraft(null); setSelectedAirQuality(null); setSelectedEEA(null); setSelectedPopulation(population ? Number(population.replaceAll('.', '')) : null); setSelectedPlace({ name, detail, center: [23.8, 38.7], zoom: 6 }); setSelectedPoint(null); }, [setSelectedAircraft, setSelectedAirQuality, setSelectedEEA, setSelectedPlace, setSelectedPoint, setSelectedPopulation]);
  const switchPanel = (next: Panel) => { sessionStorage.setItem('kapavita-panel', next); if (next === 'seaviolet' && !seavioletAllowed || next === 'catalog' && !features.catalog) return; setPanel(next); setSelectedSource(null); setMobileMenu(false); setQuery(''); setSearchOpen(false); requestAnimationFrame(() => mapRef.current?.invalidateSize()); };
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand" onClick={() => switchPanel('map')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && switchPanel('map')}><span className="brand-mark"><span /></span><span className="brand-name">KAPA<span>VITA</span><small>SPATIAL INTELLIGENCE</small></span></div>
      <nav className="topnav" aria-label="Κύρια πλοήγηση"><button className={panel === 'map' ? 'active' : ''} onClick={() => switchPanel('map')}>Χάρτης</button>{features.catalog && <button className={panel === 'catalog' ? 'active' : ''} onClick={() => switchPanel('catalog')}>Πηγές δεδομένων</button>}{seavioletAllowed && <button className={panel === 'seaviolet' ? 'active' : ''} onClick={() => switchPanel('seaviolet')}>Liakos ἐν πλῷ</button>}<button className={panel === 'admin' ? 'active' : ''} onClick={() => switchPanel('admin')}>Διαχείριση</button></nav>
      <div className="top-actions"><span className="preview-badge"><span className="pulse-dot" /> Πρώτη έκδοση</span><button className="icon-btn mobile-toggle" aria-label="Άνοιγμα μενού" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21} /></button></div>
    </header>
    {mobileMenu && <div className="mobile-nav"><button onClick={() => switchPanel('map')}>Χάρτης</button>{features.catalog && <button onClick={() => switchPanel('catalog')}>Πηγές δεδομένων</button>}{seavioletAllowed && <button onClick={() => switchPanel('seaviolet')}>Liakos ἐν πλῷ</button>}<button onClick={() => switchPanel('admin')}>Διαχείριση</button></div>}
    <main className="workspace">
      <aside className={`sidebar ${panel !== 'map' ? 'catalog-sidebar' : ''}`}>
        {panel === 'map' ? <>
          <div className="sidebar-heading"><span className="eyebrow">ΕΞΕΡΕΥΝΗΣΗ</span><h1>Η Ελλάδα,<br/><em>σε ένα μέρος.</em></h1><p>Εξερεύνησε απογραφή πληθυσμού, αεροδρόμια, αεροσκάφη, καιρό και ποιότητα αέρα. Άνοιξε όποιο επίπεδο θέλεις.</p></div>
          <div className="search-wrap"><Search size={19} /><input aria-label="Αναζήτηση περιοχής ή πηγής" placeholder="Αναζήτησε δήμο, κοινότητα ή πηγή..." value={query} onChange={e => { setQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} /><span className="search-shortcut">⌕</span>
            {searchOpen && query && <div className="search-results">{filteredAreas.map(area => <button key={`${area.kind}-${area.code}`} onClick={() => goToArea(area)}><MapPin size={15}/><span><strong>{area.name}</strong><small>{area.kind === 'municipality' ? 'Δήμος' : 'Κοινότητα'} · {area.parent ?? 'ΕΛΣΤΑΤ 2021'} · {area.code}</small></span></button>)}{!filteredAreas.length && filteredPlaces.map(p => <button key={p.name} onClick={() => goTo(p)}><MapPin size={15}/><span><strong>{p.name}</strong><small>{p.detail}</small></span></button>)}{(features.catalog ? filteredSources.slice(0, 3) : []).map(s => <button key={s.id} onClick={() => showSource(s)}><Database size={15}/><span><strong>{s.name}</strong><small>Πηγή δεδομένων</small></span></button>)}{!filteredAreas.length && !filteredPlaces.length && !filteredSources.length && <div className="no-results" role="status">{searchError ? 'Η αναζήτηση περιοχών δεν φορτώθηκε.' : !areaIndex ? 'Φόρτωση περιοχών...' : 'Δεν βρέθηκε περιοχή ή πηγή.'}</div>}</div>}
          </div>
          <div className="sidebar-section-title"><span>ΕΠΙΠΕΔΑ ΧΑΡΤΗ</span><SlidersHorizontal size={15}/></div>
          <div className="base-layer"><span className="layer-symbol"><Compass size={19}/></span><span><strong>Βασικός χάρτης</strong><small>OpenStreetMap</small></span><span className="on-indicator"><Check size={14}/></span></div>
          <div className="layer-list">{layerGroups.map(group => <div className="layer-group" key={group.title}><button className="group-heading" onClick={() => setExpanded({ ...expanded, [group.title]: !expanded[group.title] })} aria-expanded={expanded[group.title]}><group.icon size={16}/><span>{group.title}</span><ChevronDown size={15} className={expanded[group.title] ? '' : 'collapsed'} /></button>{expanded[group.title] && <div className="group-items">{group.entries.map(entry => {
            const control = entry === 'Περιφέρειες (2016)' ? 'regions' : entry === 'Δήμοι (2021)' ? 'municipalities' : entry === 'Δημοτικές κοινότητες (2021)' ? 'communities' : overlayNames[entry];
            if (control && !features[control]) return null;
            if (entry === 'Περιφέρειες (2016)') return <label className="layer-item available-layer" key={entry}><input type="checkbox" checked={visibleRegions} onChange={event => setShowRegions(event.target.checked)} /><span>{entry}</span><small>gbOpen</small></label>;
            if (entry === 'Δήμοι (2021)') return <label className="layer-item available-layer" key={entry}><input type="checkbox" checked={visibleMunicipalities} onChange={event => setShowMunicipalities(event.target.checked)} /><span>{entry}</span><small>ΕΛΣΤΑΤ</small></label>;
            if (entry === 'Δημοτικές κοινότητες (2021)') return <label className="layer-item available-layer" key={entry}><input type="checkbox" checked={visibleCommunities} onChange={event => setShowCommunities(event.target.checked)} /><span>{entry}</span><small>ΕΛΣΤΑΤ</small></label>;
            const key = overlayNames[entry];
            if (key) return <label className="layer-item available-layer thematic-layer" key={entry} title={overlayStatuses[key] ?? ''}><input type="checkbox" checked={activeOverlays[key]} onChange={event => setActiveOverlays(previous => ({ ...previous, [key]: event.target.checked }))} /><span>{entry}<small>{overlayStatuses[key] ?? ({ population: 'ΕΛΣΤΑΤ · 2021', airports: 'OurAirports', aircraft: 'OpenSky · στιγμιότυπο', marine: 'Marine Regions · Ιόνιο/Αιγαίο', weather: 'Open-Meteo · μοντέλο', airQuality: 'CAMS · 37 πόλεις και κάθε σημείο', eeaAir: 'EEA · ωριαίες μετρήσεις σταθμών', earthquakes: 'USGS · τελευταίο 24ωρο', openaq: 'OpenAQ · σταθμοί αέρα', copernicus: 'Copernicus · Sentinel-2' }[key])}</small></span></label>;
            return <div className="layer-item awaiting-layer" key={entry} title={entry === 'Πλοία / AIS' ? 'Απαιτεί αξιόπιστη άδεια AIS και πρόσβαση σε ροή θέσεων' : entry === 'Θαλάσσιες ζώνες' ? 'Οι δικαιοδοτικές θαλάσσιες ζώνες χρειάζονται έλεγχο επίσημων ορίων και νομικού καθεστώτος' : entry === 'Ακίνητα' ? 'Δεν υπάρχει εδώ δημόσια επαληθευμένη κτηματολογική γεωμετρία ιδιοκτησιών' : 'Απαιτεί επαληθευμένα γεωεντοπισμένα δεδομένα επιχειρήσεων'}><span className="empty-check"/><span>{entry}</span><small>{entry === 'Πλοία / AIS' ? 'Απαιτεί AIS' : 'Σε έλεγχο'}</small></div>;
          })}</div>}</div>)}</div>
          <div className="sidebar-footer"><Info size={17}/><span>Πλοία, επιχειρήσεις, ακίνητα και δικαιοδοτικές ζώνες περιμένουν ελεγμένα δεδομένα. {features.catalog && <button onClick={() => switchPanel('catalog')}>Δες τις πηγές <ArrowRight size={13}/></button>}</span></div>
        </> : panel === 'admin' ? <><div className="sidebar-heading catalog-head"><span className="eyebrow">ΔΙΑΧΕΙΡΙΣΗ</span><h1>Ο έλεγχος,<br/><em>στα χέρια σου.</em></h1><p>Δικαιώματα, δημόσια επίπεδα, υγεία του server και καταγραφή ενεργειών.</p></div><div className="catalog-note"><ShieldCheck size={20}/><span><strong>Έλεγχος από server</strong><small>Οι ρυθμίσεις αποθηκεύονται με αυθεντικοποιημένο λογαριασμό.</small></span></div><button className="back-map" onClick={() => switchPanel('map')}><ArrowLeft size={17}/> Επιστροφή στον χάρτη</button></> : panel === 'seaviolet' ? <>
          <div className="sidebar-heading catalog-head"><span className="eyebrow">SEAVIOLET</span><h1>Η θάλασσα,<br/><em>πιο κοντά.</em></h1><p>Εικόνα πλοίου και προσωπικός χαιρετισμός σε δύο χωριστές ενότητες.</p></div>
          <div className="catalog-note"><Heart size={20}/><span><strong>Προεπισκόπηση ροής</strong><small>Δεν στέλνονται μηνύματα και δεν εμφανίζονται πραγματικά προσωπικά δεδομένα.</small></span></div>
          <button className="back-map" onClick={() => switchPanel('map')}><ArrowLeft size={17}/> Επιστροφή στον χάρτη</button>
        </> : <>
          <div className="sidebar-heading catalog-head"><span className="eyebrow">ΜΗΤΡΩΟ ΠΗΓΩΝ</span><h1>Γνώρισε τα<br/><em>δεδομένα.</em></h1><p>Ελληνικές, ευρωπαϊκές και διεθνείς πηγές με δεδομένα για την Ελλάδα. Κάθε σύνολο ελέγχεται ξεχωριστά.</p></div>
          <div className="catalog-note"><ShieldCheck size={20}/><span><strong>Πρώτα η προέλευση</strong><small>Δεν παρουσιάζουμε μια πηγή ως διαθέσιμο API πριν ελεγχθούν πρόσβαση, άδεια και κάλυψη.</small></span></div>
          <button className="back-map" onClick={() => switchPanel('map')}><ArrowLeft size={17}/> Επιστροφή στον χάρτη</button>
        </>}
      </aside>
      <section className={`main-stage ${panel !== 'map' ? 'catalog-stage' : ''}`}>
        {panel === 'map' ? <>
          {selectedPopulation != null && selectedPlace && <div className="population-float-card"><div className="population-float-icon"><Database size={20}/></div><div className="population-float-heading"><span className="eyebrow">ΜΟΝΙΜΟΣ ΠΛΗΘΥΣΜΟΣ · ΕΛΣΤΑΤ</span><h2>{selectedPlace.name}</h2><p>{selectedPlace.detail.split(' · ').slice(0, 2).join(' · ')}</p></div><div className="population-float-value"><strong>{selectedPopulation.toLocaleString('el-GR')}</strong><span>κάτοικοι</span><small>Απογραφή 2021</small></div></div>}
          {false && selectedPopulation == null && selectedPlace?.name === 'Ελλάδα' && !selectedPoint && <div className="welcome-map-card"><span className="eyebrow">ΣΗΜΕΡΑ ΣΤΗΝ KAPAVITA</span><h2>Δες την Ελλάδα από κοντά.</h2><p>Επίλεξε ένα επίπεδο ή αναζήτησε δήμο και κοινότητα για να δεις τα διαθέσιμα στοιχεία στον χάρτη.</p><div className="welcome-map-highlights"><span><strong>333</strong><small>δήμοι</small></span><span><strong>6.138</strong><small>κοινότητες</small></span><span><strong>AIS</strong><small>ζωντανή ροή</small></span></div></div>}
          <MapView mapRef={mapRef} onSelect={selectPoint} showRegions={visibleRegions && features.regions} showMunicipalities={visibleMunicipalities && features.municipalities} showCommunities={visibleCommunities && features.communities} active={visibleOverlays} onStatus={onOverlayStatus} onPlane={selectAircraft} onAirQuality={selectAirQuality} onEEA={selectEEA} onRegionSelect={selectRegion} onAreaSelect={selectArea}/>
          <div className="map-top-left"><span className="map-label"><span className="pulse-dot" /> ΧΑΡΤΗΣ ΕΛΛΑΔΑΣ</span>{visibleOverlays.aircraft && <span className="aircraft-legend"><b>✈ Μπλε:</b> κωδικός χώρας Ελλάδας · <b>Πορτοκαλί:</b> άλλη χώρα · Δεν δηλώνει εταιρεία</span>}{visibleOverlays.eeaAir && <span className="eea-map-legend"><i/> Μπλε αριθμοί: πραγματικές ωριαίες μετρήσεις PM2.5 σταθμών EEA έως 24 ωρών · όχι δείκτης AQI</span>}{visibleOverlays.airQuality && <div className="air-map-legend" aria-label="Χρώματα ποιότητας αέρα"><strong>ΠΟΙΟΤΗΤΑ ΑΕΡΑ · ΕΚΤΙΜΗΣΗ ΜΟΝΤΕΛΟΥ</strong><div>{['Καλή', 'Ικανοποιητική', 'Μέτρια', 'Κακή', 'Πολύ κακή', 'Εξαιρετικά κακή'].map((label,index) => <span key={label}><i className={`air-swatch air-swatch-${index}`}/>{label}</span>)}</div><small>Ίδιο χρώμα στην κουκκίδα και στην καρτέλα · πάτησε στον χάρτη για οποιοδήποτε σημείο</small></div>}</div>
          {(visibleMunicipalities || visibleCommunities) && <div className="elstat-attribution">Απογραφικά όρια 2021 · <a href="https://lms.statistics.gr/el/geo-serv" target="_blank" rel="noopener noreferrer">ΕΛΣΤΑΤ</a> · όχι αποδεικτικά διοικητικών ορίων{visibleCommunities && <span> · Κοινότητες από ζουμ 9</span>}</div>}
          {visibleRegions && <div className="region-attribution">Όρια 2016 · <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">geoBoundaries</a> · CC BY 4.0</div>}
          <div className="map-controls"><button aria-label="Μεγέθυνση" onClick={() => mapRef.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Σμίκρυνση" onClick={() => mapRef.current?.zoomOut()}><Minus size={19}/></button><div className="control-divider"/><button aria-label="Επιστροφή στην Ελλάδα" onClick={() => goTo(places[0])}><Compass size={19}/></button></div>
          {selectedEEA && visibleOverlays.eeaAir && eeaReadingFresh(selectedEEA) && <EEAStationCard reading={selectedEEA} onClose={() => setSelectedEEA(null)} />}
          {selectedAirQuality && visibleOverlays.airQuality && !selectedAircraft && <div className="air-quality-card" role="region" aria-label="Ποιότητα αέρα"><div className="aircraft-card-header"><span className="eyebrow">ΠΟΙΟΤΗΤΑ ΑΕΡΑ · ΕΚΤΙΜΗΣΗ ΜΟΝΤΕΛΟΥ</span><button aria-label="Κλείσιμο ποιότητας αέρα" onClick={() => setSelectedAirQuality(null)}><X size={16}/></button></div><h2>{selectedAirQuality.city}</h2><div className="air-quality-summary" style={{ borderColor: airQualityBand(selectedAirQuality.aqi).color, backgroundColor: airQualityBand(selectedAirQuality.aqi).color + '13' }}><span className="air-quality-value" style={{ color: airQualityBand(selectedAirQuality.aqi).color }}>{Math.round(selectedAirQuality.aqi)}</span><div><strong style={{ color: airQualityBand(selectedAirQuality.aqi).color }}>{airQualityBand(selectedAirQuality.aqi).name}</strong><small>Ευρωπαϊκός δείκτης ποιότητας αέρα</small></div></div><p className="air-quality-advice">{airQualityBand(selectedAirQuality.aqi).message}</p><div className="air-quality-scale" aria-label="Κλίμακα ποιότητας αέρα"><span>Καλή</span><span>Ικανοποιητική</span><span>Μέτρια</span><span>Κακή</span><span>Πολύ κακή</span><span>Εξαιρετικά κακή</span></div><details className="air-quality-details"><summary>Τι είναι οι αριθμοί;</summary><p><b>Ευρωπαϊκός δείκτης:</b> όσο μικρότερος, τόσο καλύτερα. Η ένδειξη συνοψίζει πέντε ρύπους. <b>PM2.5:</b> πολύ μικρά αιωρούμενα σωματίδια. <b>PM10:</b> μεγαλύτερα εισπνεόμενα σωματίδια.</p><p>PM2.5: {selectedAirQuality.pm25 == null ? '—' : selectedAirQuality.pm25.toLocaleString('el-GR') + ' μg/m³'} · PM10: {selectedAirQuality.pm10 == null ? '—' : selectedAirQuality.pm10.toLocaleString('el-GR') + ' μg/m³'}</p></details><p className="air-quality-source">Τρέχουσα εκτίμηση CAMS μέσω Open-Meteo · {selectedAirQuality.time.replace('T', ' ')} ώρα Ελλάδας. Πρόκειται για εκτίμηση μοντέλου, όχι μέτρηση σταθμού ή προσωπική έκθεση.</p><a href="https://www.eea.europa.eu/en/about/contact-us/faqs/what-do-the-air-quality-index-values-mean" target="_blank" rel="noopener noreferrer">Τι σημαίνει ο δείκτης; ↗</a><a href="https://airindex.eea.europa.eu/AQI/index.html" target="_blank" rel="noopener noreferrer">Δες μετρήσεις σταθμών στον ευρωπαϊκό χάρτη ↗</a></div>}
          {selectedAircraft && visibleOverlays.aircraft && <div className="aircraft-card"><div className="aircraft-card-header"><span className="eyebrow">ΑΕΡΟΣΚΑΦΟΣ · OPENSKY</span><button aria-label="Κλείσιμο καρτέλας αεροσκάφους" onClick={() => setSelectedAircraft(null)}><X size={16}/></button></div><h2>{selectedAircraft.callsign || selectedAircraft.icao24} {selectedAircraft.originCountry === 'Greece' && <span className="greek-aircraft-badge">Κωδικός Ελλάδας</span>}</h2><div className="aircraft-stats"><div><small>Ταυτότητα ICAO24</small><strong>{selectedAircraft.icao24.toUpperCase()}</strong></div><div><small>Κωδικός χώρας</small><strong>{selectedAircraft.originCountry || 'Άγνωστη'}</strong></div><div><small>Ύψος (γεωμετρικό)</small><strong>{selectedAircraft.altitude == null ? '—' : `${Math.round(selectedAircraft.altitude).toLocaleString('el-GR')} m`}</strong></div><div><small>Ταχύτητα εδάφους</small><strong>{selectedAircraft.velocity == null ? '—' : `${Math.round(selectedAircraft.velocity * 3.6).toLocaleString('el-GR')} km/h`}</strong></div><div><small>Πορεία</small><strong>{selectedAircraft.heading == null ? '—' : `${Math.round(selectedAircraft.heading)}°`}</strong></div><div><small>Κατάσταση</small><strong>{selectedAircraft.onGround ? 'Στο έδαφος' : 'Σε πτήση'}</strong></div><div><small>Άνοδος / κάθοδος</small><strong>{selectedAircraft.verticalRate == null ? '—' : `${selectedAircraft.verticalRate.toFixed(1)} m/s`}</strong></div><div><small>Squawk</small><strong>{selectedAircraft.squawk || '—'}</strong></div></div><div className="flight-status-pending"><strong>Δρομολόγιο και ώρες πτήσης</strong><span>Αναχώρηση, εκτιμώμενη άφιξη και καθυστέρηση: δεν παρέχονται από το OpenSky. Θα εμφανιστούν εδώ μετά σύνδεση υπηρεσίας flight status με επιβεβαιωμένη αντιστοίχιση πτήσης. Ο εξωτερικός σύνδεσμος αναζητά με διακριτικό κλήσης· έλεγξε ότι ταιριάζουν ημερομηνία και αεροσκάφος.</span>{selectedAircraft.callsign && <a href={`https://www.flightaware.com/live/flight/${encodeURIComponent(selectedAircraft.callsign.trim().toUpperCase())}`} target="_blank" rel="noopener noreferrer">Άνοιξε το {selectedAircraft.callsign.trim()} στο FlightAware ↗</a>}</div><p>Τελευταία επαφή: {new Date(selectedAircraft.lastContact * 1000).toLocaleString('el-GR', { timeZone: 'Europe/Athens' })} · Στιγμιότυπο: {new Date(selectedAircraft.snapshotTime * 1000).toLocaleString('el-GR', { timeZone: 'Europe/Athens' })}</p><small className="aircraft-card-note">Η χώρα συνάγεται από τον κωδικό αναμεταδότη. Δεν υποδηλώνει αεροπορική εταιρεία ή προορισμό.</small></div>}{(!selectedAircraft || !visibleOverlays.aircraft) && (!selectedAirQuality || !visibleOverlays.airQuality) && (!selectedEEA || !visibleOverlays.eeaAir) && <div className="map-info-card"><span className="info-card-icon"><MapPin size={20}/></span><div><span className="eyebrow">ΤΟΠΟΘΕΣΙΑ</span><h2>{selectedPlace?.name ?? 'Επιλεγμένο σημείο'}</h2><p>{selectedPlace?.detail ?? (selectedPoint ? `${selectedPoint[1].toFixed(4)}° Β, ${selectedPoint[0].toFixed(4)}° Α` : 'Ελλάδα')}</p></div><div className="info-separator"/><div className="info-availability"><span className="small-status-dot"/><span>Θεματικά δεδομένα<br/><strong>{visibleOverlays.population ? 'Πληθυσμός 2021' : visibleMunicipalities || visibleCommunities ? 'Απογραφή 2021' : Object.values(visibleOverlays).some(Boolean) ? 'Ενεργά επίπεδα' : visibleRegions ? '1 ιστορικό επίπεδο' : 'Δεν έχουν συνδεθεί'}</strong></span></div></div>}
          <div className="map-bottom-note">Βάση: OpenStreetMap · Πληθυσμός: ΕΛΣΤΑΤ 2021 · Πτήσεις: OpenSky · Μετεωρολογικά μοντέλα: Open-Meteo/CAMS · Μετρήσεις PM2.5: EEA · Θαλάσσιες περιοχές: Marine Regions / IHO (μη νομικά όρια)</div>
        </> : panel === 'admin' ? <Admin onPolicy={refreshPolicy}/> : panel === 'seaviolet' && seavioletAllowed ? <Seaviolet /> : <div className="catalog-content"><div className="catalog-title-row"><div><span className="eyebrow">GREECE DATA REGISTRY / 001</span><h2>Τι δίνει κάθε πηγή</h2><p>Κάθε σύνολο καταγράφει τα βασικά πεδία του, τη γεωγραφική μονάδα, τον χρόνο αναφοράς, την πρόσβαση και τα πιθανά κλειδιά σύνδεσης. «Ελεγμένο σχήμα» δεν σημαίνει επιβεβαιωμένη άδεια επανάχρησης.</p></div><span className="count-pill">{datasets.length} σύνολα</span></div><div className="catalog-search"><Search size={19}/><input aria-label="Αναζήτηση πηγής" placeholder="Πηγή, σύνολο ή πεδίο (π.χ. CODE)..." value={query} onChange={e => setQuery(e.target.value)}/></div><div className="dataset-intro provider-heading"><strong>Υπηρεσίες και API · {filteredSources.length}</strong><span>Κάθε καρτέλα δείχνει τι δεδομένα μπορείς να δεις. Πάτησέ την για πεδία, χρόνο, γεωγραφική κάλυψη και διαθεσιμότητα στον χάρτη.</span></div><div className="catalog-grid">{filteredSources.map(s => <SourceCard key={s.id} source={s} related={datasets.filter(d => d.sourceId === s.id)} onOpen={showSource}/>)}</div>{!filteredSources.length && <div className="catalog-empty">Δεν βρέθηκε υπηρεσία με αυτόν τον όρο.</div>}<div className="dataset-intro"><strong>Αναλυτικά σύνολα δεδομένων · {filteredDatasets.length}</strong><span>Άνοιξε μια εγγραφή για τα πλήρη πεδία και τον τρόπο σύνδεσης.</span></div><div className="dataset-list">{filteredDatasets.map(d => <DatasetCard key={d.id} dataset={d}/>)}</div>{!filteredDatasets.length && <div className="catalog-empty">Δεν βρέθηκε σύνολο με αυτόν τον όρο.</div>}<div className="catalog-bottom"><span>Οι συνδέσεις μεταξύ διαφορετικών φορέων παραμένουν υποψήφιες μέχρι να ελεγχθούν.</span><span>{datasets.length} σύνολα · {sources.length} πηγές</span></div></div>}
      </section>
      {selectedSource && <SourceDetail source={selectedSource} related={datasets.filter(d => d.sourceId === selectedSource.id)} onClose={() => setSelectedSource(null)}/>}
    </main>
  </div>;
}
export default function App() {
  const mainProductHost = window.location.hostname === 'kapavita.gr' || window.location.hostname === 'www.kapavita.gr';
  return mainProductHost || window.location.pathname === '/kv' || window.location.pathname.startsWith('/kv/') ? <KVWorkspace /> : <SpatialApp />;
}







