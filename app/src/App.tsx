import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Compass, Database, ExternalLink, Globe2, Info, Layers3, MapPin, Menu, Minus, Plus, Search, ShieldCheck, SlidersHorizontal, Waves, Wind, X } from 'lucide-react';
import { sources, type SourceRecord } from './data/catalog';
import { datasets, type DatasetRecord } from './data/datasets';
import { MapLayers, type OverlayKey, type Plane, type AirReading, airQualityBand } from './MapLayers';
import './App.css';

type Panel = 'map' | 'catalog';
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
  { title: 'Περιβάλλον', icon: Globe2, entries: ['Καιρός', 'Ποιότητα αέρα'] },
];

function MapView({ mapRef, onSelect, showRegions, showMunicipalities, showCommunities, active, onStatus, onPlane, onAirQuality, onRegionSelect, onAreaSelect }: { mapRef: React.MutableRefObject<LeafletMap | null>; onSelect: (point: [number, number]) => void; showRegions: boolean; showMunicipalities: boolean; showCommunities: boolean; active: Record<OverlayKey, boolean>; onStatus: (key: OverlayKey, status: string) => void; onPlane: (plane: Plane & { snapshotTime: number }) => void; onAirQuality: (reading: AirReading) => void; onRegionSelect: (name: string) => void; onAreaSelect: (name: string, detail: string) => void }) {
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
  return <><div ref={container} className="map-canvas" aria-label="Διαδραστικός χάρτης της Ελλάδας" /><MapLayers mapRef={mapRef} active={active} onStatus={onStatus} onArea={onAreaSelect} onPlane={onPlane} onAirQuality={onAirQuality} /></>;
}

function SourceCard({ source, onOpen }: { source: SourceRecord; onOpen: (source: SourceRecord) => void }) {
  return <button className="source-card" onClick={() => onOpen(source)}>
    <span className="source-card-icon"><Database size={18} /></span>
    <span className="source-card-body"><strong>{source.name}</strong><small>{source.authority}</small><span>{source.description}</span></span>
    <ArrowRight size={17} className="source-arrow" />
  </button>;
}

function DatasetCard({ dataset }: { dataset: DatasetRecord }) {
  return <details className="dataset-card">
    <summary><span className="dataset-main"><strong>{dataset.name}</strong><small>{dataset.provider} · {dataset.grain}{dataset.count != null ? ` · ${dataset.count.toLocaleString('el-GR')} εγγραφές` : ''}</small></span><span className={dataset.status === 'Ελεγμένο σχήμα' || dataset.status === 'Ελεγμένο endpoint' || dataset.status === 'Ενεργό επίπεδο' ? 'dataset-status verified' : 'dataset-status'}>{dataset.status}</span><ChevronDown size={16}/></summary>
    <div className="dataset-detail"><p>{dataset.notes}</p><div className="dataset-fields"><span>Βασικά πεδία</span><div>{dataset.fields.length ? dataset.fields.map(field => <code key={field}>{field}</code>) : <em>Δεν έχει επιβεβαιωθεί σχήμα δεδομένων.</em>}</div></div><div className="dataset-meta"><div><span>Μονάδα</span><strong>{dataset.grain}</strong></div><div><span>Πιθανή σύνδεση</span><strong>{dataset.join}</strong><small>{dataset.joinStatus}</small></div><div><span>Πρόσβαση / χρόνος</span><strong>{dataset.format} · {dataset.temporal}</strong></div><div><span>Άδεια / επανάχρηση</span><strong>{dataset.reuse}</strong></div><div><span>Έλεγχος</span><strong>{dataset.evidence}</strong></div></div><a href={dataset.layer} target="_blank" rel="noopener noreferrer">Πηγή / τεκμηρίωση <ExternalLink size={14}/></a></div>
  </details>;
}

function App() {
  const mapRef = useRef<LeafletMap | null>(null);
  const [panel, setPanel] = useState<Panel>('map');
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
  const [selectedAirQuality, setSelectedAirQuality] = useState<AirReading | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<(Plane & { snapshotTime: number }) | null>(null);
  const selectAircraft = useCallback((plane: Plane & { snapshotTime: number }) => { setSelectedAircraft(plane); setSelectedAirQuality(null); setSelectedPlace(null); setSelectedPoint(null); }, [setSelectedAircraft, setSelectedAirQuality, setSelectedPlace, setSelectedPoint]);
  const [selectedSource, setSelectedSource] = useState<SourceRecord | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [showMunicipalities, setShowMunicipalities] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Record<OverlayKey, boolean>>({ population: false, airports: false, aircraft: false, marine: false, weather: false, airQuality: false });
  const [overlayStatuses, setOverlayStatuses] = useState<Partial<Record<OverlayKey, string>>>({});
  const onOverlayStatus = useCallback((key: OverlayKey, status: string) => setOverlayStatuses(previous => previous[key] === status ? previous : { ...previous, [key]: status }), []);
  const overlayNames: Partial<Record<string, OverlayKey>> = { 'Πληθυσμός': 'population', 'Θαλάσσιες περιοχές': 'marine', 'Αεροσκάφη': 'aircraft', 'Αεροδρόμια': 'airports', 'Καιρός': 'weather', 'Ποιότητα αέρα': 'airQuality' };
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Ξηρά: true, Θάλασσα: true, Αέρας: true, Περιβάλλον: true });
  const filteredDatasets = useMemo(() => datasets.filter(d => `${d.name} ${d.provider} ${d.grain} ${d.fields.join(' ')}`.toLocaleLowerCase('el').includes(query.toLocaleLowerCase('el'))), [query]);
  const filteredSources = useMemo(() => sources.filter(s => `${s.name} ${s.category} ${s.authority}`.toLocaleLowerCase('el').includes(query.toLocaleLowerCase('el'))), [query]);
  const filteredPlaces = useMemo(() => places.filter(p => `${p.name} ${p.detail}`.toLocaleLowerCase('el').includes(query.toLocaleLowerCase('el'))), [query]);
  const searchableAreas = useMemo(() => (areaIndex ?? []).map(area => ({ ...area, searchName: normalizeSearch(area.name), shortName: shortAreaName(area.name) })), [areaIndex]);
  const filteredAreas = useMemo(() => {
    const term = normalizeSearch(query);
    if (term.length < 2) return [];
    const rank = (area: typeof searchableAreas[number]) => area.shortName === term ? 0 : area.shortName.startsWith(term) ? 1 : area.searchName.includes(term) ? 2 : area.code.includes(term) ? 3 : 4;
    return searchableAreas.filter(area => rank(area) < 4)
      .sort((a, b) => rank(a) - rank(b) || (a.kind === 'municipality' ? -1 : 1) - (b.kind === 'municipality' ? -1 : 1) || a.name.localeCompare(b.name, 'el'))
      .slice(0, 12);
  }, [query, searchableAreas]);

  const goTo = (place: Place) => { setPanel('map'); setSelectedPlace(place); setSelectedPoint(null); setSearchOpen(false); setQuery(''); setMobileMenu(false); setSelectedSource(null); requestAnimationFrame(() => mapRef.current?.flyTo([place.center[1], place.center[0]], place.zoom, { duration: 1.1 })); };
  const goToArea = (area: AreaSearchRecord) => {
    const bounds = L.latLngBounds([area.bbox[1], area.bbox[0]], [area.bbox[3], area.bbox[2]]);
    const detail = `${area.kind === 'municipality' ? 'Δήμος' : 'Δημοτική κοινότητα'} · απογραφή 2021${area.parent ? ` · ${area.parent}` : ''}${area.population == null ? '' : ` · ${area.population.toLocaleString('el-GR')} κάτοικοι`}`;
    setPanel('map'); setSelectedPlace({ name: area.name, detail, center: [bounds.getCenter().lng, bounds.getCenter().lat], zoom: area.kind === 'community' ? 12 : 10 });
    setSelectedPoint(null); setSearchOpen(false); setQuery(''); setMobileMenu(false); setSelectedSource(null);
    if (area.kind === 'municipality') setShowMunicipalities(true);
    else setShowCommunities(true);
    requestAnimationFrame(() => mapRef.current?.fitBounds(bounds, { padding: [36, 36], maxZoom: area.kind === 'community' ? 12 : 11, animate: true }));
  };
  const showSource = (source: SourceRecord) => { setSelectedSource(source); setPanel('catalog'); setSearchOpen(false); setMobileMenu(false); };
  const selectAirQuality = useCallback((reading: AirReading) => { setSelectedAirQuality(reading); setSelectedAircraft(null); }, [setSelectedAircraft, setSelectedAirQuality]);
  const selectPoint = useCallback((point: [number, number]) => { setSelectedAircraft(null); setSelectedAirQuality(null); setSelectedPoint(point); setSelectedPlace(null); setSelectedSource(null); }, [setSelectedAircraft, setSelectedAirQuality, setSelectedPoint, setSelectedPlace, setSelectedSource]);
  const selectRegion = useCallback((name: string) => { setSelectedPlace({ name, detail: 'Περιφέρεια · όρια 2016', center: [23.8, 38.7], zoom: 6 }); setSelectedPoint(null); }, [setSelectedPlace, setSelectedPoint]);
  const selectArea = useCallback((name: string, detail: string) => { setSelectedAircraft(null); setSelectedAirQuality(null); setSelectedPlace({ name, detail, center: [23.8, 38.7], zoom: 6 }); setSelectedPoint(null); }, [setSelectedAircraft, setSelectedAirQuality, setSelectedPlace, setSelectedPoint]);
  const switchPanel = (next: Panel) => { setPanel(next); setSelectedSource(null); setMobileMenu(false); setQuery(''); setSearchOpen(false); requestAnimationFrame(() => mapRef.current?.invalidateSize()); };
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand" onClick={() => switchPanel('map')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && switchPanel('map')}><span className="brand-mark"><span /></span><span className="brand-name">KAPA<span>VITA</span><small>SPATIAL INTELLIGENCE</small></span></div>
      <nav className="topnav" aria-label="Κύρια πλοήγηση"><button className={panel === 'map' ? 'active' : ''} onClick={() => switchPanel('map')}>Χάρτης</button><button className={panel === 'catalog' ? 'active' : ''} onClick={() => switchPanel('catalog')}>Πηγές δεδομένων</button></nav>
      <div className="top-actions"><span className="preview-badge"><span className="pulse-dot" /> Πρώτη έκδοση</span><button className="icon-btn mobile-toggle" aria-label="Άνοιγμα μενού" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21} /></button></div>
    </header>
    {mobileMenu && <div className="mobile-nav"><button onClick={() => switchPanel('map')}>Χάρτης</button><button onClick={() => switchPanel('catalog')}>Πηγές δεδομένων</button></div>}
    <main className="workspace">
      <aside className={`sidebar ${panel === 'catalog' ? 'catalog-sidebar' : ''}`}>
        {panel === 'map' ? <>
          <div className="sidebar-heading"><span className="eyebrow">ΕΞΕΡΕΥΝΗΣΗ</span><h1>Η Ελλάδα,<br/><em>σε ένα μέρος.</em></h1><p>Εξερεύνησε απογραφή πληθυσμού, αεροδρόμια, αεροσκάφη, καιρό και ποιότητα αέρα. Άνοιξε όποιο επίπεδο θέλεις.</p></div>
          <div className="search-wrap"><Search size={19} /><input aria-label="Αναζήτηση περιοχής ή πηγής" placeholder="Αναζήτησε δήμο, κοινότητα ή πηγή..." value={query} onChange={e => { setQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} /><span className="search-shortcut">⌕</span>
            {searchOpen && query && <div className="search-results">{filteredAreas.map(area => <button key={`${area.kind}-${area.code}`} onClick={() => goToArea(area)}><MapPin size={15}/><span><strong>{area.name}</strong><small>{area.kind === 'municipality' ? 'Δήμος' : 'Κοινότητα'} · {area.parent ?? 'ΕΛΣΤΑΤ 2021'} · {area.code}</small></span></button>)}{!filteredAreas.length && filteredPlaces.map(p => <button key={p.name} onClick={() => goTo(p)}><MapPin size={15}/><span><strong>{p.name}</strong><small>{p.detail}</small></span></button>)}{filteredSources.slice(0, 3).map(s => <button key={s.id} onClick={() => showSource(s)}><Database size={15}/><span><strong>{s.name}</strong><small>Πηγή δεδομένων</small></span></button>)}{!filteredAreas.length && !filteredPlaces.length && !filteredSources.length && <div className="no-results" role="status">{searchError ? 'Η αναζήτηση περιοχών δεν φορτώθηκε.' : !areaIndex ? 'Φόρτωση περιοχών...' : 'Δεν βρέθηκε περιοχή ή πηγή.'}</div>}</div>}
          </div>
          <div className="sidebar-section-title"><span>ΕΠΙΠΕΔΑ ΧΑΡΤΗ</span><SlidersHorizontal size={15}/></div>
          <div className="base-layer"><span className="layer-symbol"><Compass size={19}/></span><span><strong>Βασικός χάρτης</strong><small>OpenStreetMap</small></span><span className="on-indicator"><Check size={14}/></span></div>
          <div className="layer-list">{layerGroups.map(group => <div className="layer-group" key={group.title}><button className="group-heading" onClick={() => setExpanded({ ...expanded, [group.title]: !expanded[group.title] })} aria-expanded={expanded[group.title]}><group.icon size={16}/><span>{group.title}</span><ChevronDown size={15} className={expanded[group.title] ? '' : 'collapsed'} /></button>{expanded[group.title] && <div className="group-items">{group.entries.map(entry => {
            if (entry === 'Περιφέρειες (2016)') return <label className="layer-item available-layer" key={entry}><input type="checkbox" checked={showRegions} onChange={event => setShowRegions(event.target.checked)} /><span>{entry}</span><small>gbOpen</small></label>;
            if (entry === 'Δήμοι (2021)') return <label className="layer-item available-layer" key={entry}><input type="checkbox" checked={showMunicipalities} onChange={event => setShowMunicipalities(event.target.checked)} /><span>{entry}</span><small>ΕΛΣΤΑΤ</small></label>;
            if (entry === 'Δημοτικές κοινότητες (2021)') return <label className="layer-item available-layer" key={entry}><input type="checkbox" checked={showCommunities} onChange={event => setShowCommunities(event.target.checked)} /><span>{entry}</span><small>ΕΛΣΤΑΤ</small></label>;
            const key = overlayNames[entry];
            if (key) return <label className="layer-item available-layer thematic-layer" key={entry} title={overlayStatuses[key] ?? ''}><input type="checkbox" checked={activeOverlays[key]} onChange={event => setActiveOverlays(previous => ({ ...previous, [key]: event.target.checked }))} /><span>{entry}<small>{overlayStatuses[key] ?? ({ population: 'ΕΛΣΤΑΤ · 2021', airports: 'OurAirports', aircraft: 'OpenSky · στιγμιότυπο', marine: 'Marine Regions · Ιόνιο/Αιγαίο', weather: 'Open-Meteo · μοντέλο', airQuality: 'CAMS · 37 πόλεις και κάθε σημείο' }[key])}</small></span></label>;
            return <div className="layer-item awaiting-layer" key={entry} title={entry === 'Πλοία / AIS' ? 'Απαιτεί αξιόπιστη άδεια AIS και πρόσβαση σε ροή θέσεων' : entry === 'Θαλάσσιες ζώνες' ? 'Οι δικαιοδοτικές θαλάσσιες ζώνες χρειάζονται έλεγχο επίσημων ορίων και νομικού καθεστώτος' : entry === 'Ακίνητα' ? 'Δεν υπάρχει εδώ δημόσια επαληθευμένη κτηματολογική γεωμετρία ιδιοκτησιών' : 'Απαιτεί επαληθευμένα γεωεντοπισμένα δεδομένα επιχειρήσεων'}><span className="empty-check"/><span>{entry}</span><small>{entry === 'Πλοία / AIS' ? 'Απαιτεί AIS' : 'Σε έλεγχο'}</small></div>;
          })}</div>}</div>)}</div>
          <div className="sidebar-footer"><Info size={17}/><span>Πλοία, επιχειρήσεις, ακίνητα και δικαιοδοτικές ζώνες περιμένουν ελεγμένα δεδομένα. <button onClick={() => switchPanel('catalog')}>Δες τις πηγές <ArrowRight size={13}/></button></span></div>
        </> : <>
          <div className="sidebar-heading catalog-head"><span className="eyebrow">ΜΗΤΡΩΟ ΠΗΓΩΝ</span><h1>Γνώρισε τα<br/><em>δεδομένα.</em></h1><p>Ελληνικές, ευρωπαϊκές και διεθνείς πηγές με δεδομένα για την Ελλάδα. Κάθε σύνολο ελέγχεται ξεχωριστά.</p></div>
          <div className="catalog-note"><ShieldCheck size={20}/><span><strong>Πρώτα η προέλευση</strong><small>Δεν παρουσιάζουμε μια πηγή ως διαθέσιμο API πριν ελεγχθούν πρόσβαση, άδεια και κάλυψη.</small></span></div>
          <button className="back-map" onClick={() => switchPanel('map')}><ArrowLeft size={17}/> Επιστροφή στον χάρτη</button>
        </>}
      </aside>
      <section className={`main-stage ${panel === 'catalog' ? 'catalog-stage' : ''}`}>
        {panel === 'map' ? <>
          <MapView mapRef={mapRef} onSelect={selectPoint} showRegions={showRegions} showMunicipalities={showMunicipalities} showCommunities={showCommunities} active={activeOverlays} onStatus={onOverlayStatus} onPlane={selectAircraft} onAirQuality={selectAirQuality} onRegionSelect={selectRegion} onAreaSelect={selectArea}/>
          <div className="map-top-left"><span className="map-label"><span className="pulse-dot" /> ΧΑΡΤΗΣ ΕΛΛΑΔΑΣ</span>{activeOverlays.aircraft && <span className="aircraft-legend"><b>✈ Μπλε:</b> κωδικός χώρας Ελλάδας · <b>Πορτοκαλί:</b> άλλη χώρα · Δεν δηλώνει εταιρεία</span>}{activeOverlays.airQuality && <div className="air-map-legend" aria-label="Χρώματα ποιότητας αέρα"><strong>ΠΟΙΟΤΗΤΑ ΑΕΡΑ · ΕΚΤΙΜΗΣΗ ΜΟΝΤΕΛΟΥ</strong><div>{['Καλή', 'Ικανοποιητική', 'Μέτρια', 'Κακή', 'Πολύ κακή', 'Εξαιρετικά κακή'].map((label,index) => <span key={label}><i className={`air-swatch air-swatch-${index}`}/>{label}</span>)}</div><small>Ίδιο χρώμα στην κουκκίδα και στην καρτέλα · πάτησε στον χάρτη για οποιοδήποτε σημείο</small></div>}</div>
          {(showMunicipalities || showCommunities) && <div className="elstat-attribution">Απογραφικά όρια 2021 · <a href="https://lms.statistics.gr/el/geo-serv" target="_blank" rel="noopener noreferrer">ΕΛΣΤΑΤ</a> · όχι αποδεικτικά διοικητικών ορίων{showCommunities && <span> · Κοινότητες από ζουμ 9</span>}</div>}
          {showRegions && <div className="region-attribution">Όρια 2016 · <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">geoBoundaries</a> · CC BY 4.0</div>}
          <div className="map-controls"><button aria-label="Μεγέθυνση" onClick={() => mapRef.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Σμίκρυνση" onClick={() => mapRef.current?.zoomOut()}><Minus size={19}/></button><div className="control-divider"/><button aria-label="Επιστροφή στην Ελλάδα" onClick={() => goTo(places[0])}><Compass size={19}/></button></div>
          {selectedAirQuality && activeOverlays.airQuality && !selectedAircraft && <div className="air-quality-card" role="region" aria-label="Ποιότητα αέρα"><div className="aircraft-card-header"><span className="eyebrow">ΠΟΙΟΤΗΤΑ ΑΕΡΑ · ΕΚΤΙΜΗΣΗ ΜΟΝΤΕΛΟΥ</span><button aria-label="Κλείσιμο ποιότητας αέρα" onClick={() => setSelectedAirQuality(null)}><X size={16}/></button></div><h2>{selectedAirQuality.city}</h2><div className="air-quality-summary" style={{ borderColor: airQualityBand(selectedAirQuality.aqi).color, backgroundColor: airQualityBand(selectedAirQuality.aqi).color + '13' }}><span className="air-quality-value" style={{ color: airQualityBand(selectedAirQuality.aqi).color }}>{Math.round(selectedAirQuality.aqi)}</span><div><strong style={{ color: airQualityBand(selectedAirQuality.aqi).color }}>{airQualityBand(selectedAirQuality.aqi).name}</strong><small>Ευρωπαϊκός δείκτης ποιότητας αέρα</small></div></div><p className="air-quality-advice">{airQualityBand(selectedAirQuality.aqi).message}</p><div className="air-quality-scale" aria-label="Κλίμακα ποιότητας αέρα"><span>Καλή</span><span>Ικανοποιητική</span><span>Μέτρια</span><span>Κακή</span><span>Πολύ κακή</span><span>Εξαιρετικά κακή</span></div><details className="air-quality-details"><summary>Τι είναι οι αριθμοί;</summary><p><b>Ευρωπαϊκός δείκτης:</b> όσο μικρότερος, τόσο καλύτερα. Η ένδειξη συνοψίζει πέντε ρύπους. <b>PM2.5:</b> πολύ μικρά αιωρούμενα σωματίδια. <b>PM10:</b> μεγαλύτερα εισπνεόμενα σωματίδια.</p><p>PM2.5: {selectedAirQuality.pm25 == null ? '—' : selectedAirQuality.pm25.toLocaleString('el-GR') + ' μg/m³'} · PM10: {selectedAirQuality.pm10 == null ? '—' : selectedAirQuality.pm10.toLocaleString('el-GR') + ' μg/m³'}</p></details><p className="air-quality-source">Τρέχουσα εκτίμηση CAMS μέσω Open-Meteo · {selectedAirQuality.time.replace('T', ' ')} ώρα Ελλάδας. Πρόκειται για εκτίμηση μοντέλου, όχι μέτρηση σταθμού ή προσωπική έκθεση.</p><a href="https://www.eea.europa.eu/en/about/contact-us/faqs/what-do-the-air-quality-index-values-mean" target="_blank" rel="noopener noreferrer">Τι σημαίνει ο δείκτης; ↗</a><a href="https://airindex.eea.europa.eu/AQI/index.html" target="_blank" rel="noopener noreferrer">Δες μετρήσεις σταθμών στον ευρωπαϊκό χάρτη ↗</a></div>}
          {selectedAircraft && activeOverlays.aircraft && <div className="aircraft-card"><div className="aircraft-card-header"><span className="eyebrow">ΑΕΡΟΣΚΑΦΟΣ · OPENSKY</span><button aria-label="Κλείσιμο καρτέλας αεροσκάφους" onClick={() => setSelectedAircraft(null)}><X size={16}/></button></div><h2>{selectedAircraft.callsign || selectedAircraft.icao24} {selectedAircraft.originCountry === 'Greece' && <span className="greek-aircraft-badge">Κωδικός Ελλάδας</span>}</h2><div className="aircraft-stats"><div><small>Ταυτότητα ICAO24</small><strong>{selectedAircraft.icao24.toUpperCase()}</strong></div><div><small>Κωδικός χώρας</small><strong>{selectedAircraft.originCountry || 'Άγνωστη'}</strong></div><div><small>Ύψος (γεωμετρικό)</small><strong>{selectedAircraft.altitude == null ? '—' : `${Math.round(selectedAircraft.altitude).toLocaleString('el-GR')} m`}</strong></div><div><small>Ταχύτητα εδάφους</small><strong>{selectedAircraft.velocity == null ? '—' : `${Math.round(selectedAircraft.velocity * 3.6).toLocaleString('el-GR')} km/h`}</strong></div><div><small>Πορεία</small><strong>{selectedAircraft.heading == null ? '—' : `${Math.round(selectedAircraft.heading)}°`}</strong></div><div><small>Κατάσταση</small><strong>{selectedAircraft.onGround ? 'Στο έδαφος' : 'Σε πτήση'}</strong></div><div><small>Άνοδος / κάθοδος</small><strong>{selectedAircraft.verticalRate == null ? '—' : `${selectedAircraft.verticalRate.toFixed(1)} m/s`}</strong></div><div><small>Squawk</small><strong>{selectedAircraft.squawk || '—'}</strong></div></div><div className="flight-status-pending"><strong>Δρομολόγιο και ώρες πτήσης</strong><span>Αναχώρηση, εκτιμώμενη άφιξη και καθυστέρηση: δεν παρέχονται από το OpenSky. Θα εμφανιστούν εδώ μετά σύνδεση υπηρεσίας flight status με επιβεβαιωμένη αντιστοίχιση πτήσης.</span>{selectedAircraft.callsign && <a href="https://aerodatabox.com/flights" target="_blank" rel="noopener noreferrer">Αναζήτησε το {selectedAircraft.callsign} στην AeroDataBox ↗</a>}</div><p>Τελευταία επαφή: {new Date(selectedAircraft.lastContact * 1000).toLocaleString('el-GR', { timeZone: 'Europe/Athens' })} · Στιγμιότυπο: {new Date(selectedAircraft.snapshotTime * 1000).toLocaleString('el-GR', { timeZone: 'Europe/Athens' })}</p><small className="aircraft-card-note">Η χώρα συνάγεται από τον κωδικό αναμεταδότη. Δεν υποδηλώνει αεροπορική εταιρεία ή προορισμό.</small></div>}{(!selectedAircraft || !activeOverlays.aircraft) && (!selectedAirQuality || !activeOverlays.airQuality) && <div className="map-info-card"><span className="info-card-icon"><MapPin size={20}/></span><div><span className="eyebrow">ΤΟΠΟΘΕΣΙΑ</span><h2>{selectedPlace?.name ?? 'Επιλεγμένο σημείο'}</h2><p>{selectedPlace?.detail ?? (selectedPoint ? `${selectedPoint[1].toFixed(4)}° Β, ${selectedPoint[0].toFixed(4)}° Α` : 'Ελλάδα')}</p></div><div className="info-separator"/><div className="info-availability"><span className="small-status-dot"/><span>Θεματικά δεδομένα<br/><strong>{activeOverlays.population ? 'Πληθυσμός 2021' : showMunicipalities || showCommunities ? 'Απογραφή 2021' : Object.values(activeOverlays).some(Boolean) ? 'Ενεργά επίπεδα' : showRegions ? '1 ιστορικό επίπεδο' : 'Δεν έχουν συνδεθεί'}</strong></span></div></div>}
          <div className="map-bottom-note">Βάση: OpenStreetMap · Πληθυσμός: ΕΛΣΤΑΤ 2021 · Πτήσεις: OpenSky · Μετεωρολογικά μοντέλα: Open-Meteo/CAMS · Θαλάσσιες περιοχές: Marine Regions / IHO (μη νομικά όρια)</div>
        </> : <div className="catalog-content"><div className="catalog-title-row"><div><span className="eyebrow">GREECE DATA REGISTRY / 001</span><h2>Τι δίνει κάθε πηγή</h2><p>Κάθε σύνολο καταγράφει τα βασικά πεδία του, τη γεωγραφική μονάδα, τον χρόνο αναφοράς, την πρόσβαση και τα πιθανά κλειδιά σύνδεσης. «Ελεγμένο σχήμα» δεν σημαίνει επιβεβαιωμένη άδεια επανάχρησης.</p></div><span className="count-pill">{datasets.length} σύνολα</span></div><div className="catalog-search"><Search size={19}/><input aria-label="Αναζήτηση πηγής" placeholder="Πηγή, σύνολο ή πεδίο (π.χ. CODE)..." value={query} onChange={e => setQuery(e.target.value)}/></div><div className="dataset-intro"><strong>Μητρώο συνόλων</strong><span>Άνοιξε μια εγγραφή για να δεις τα πεδία και πώς μπορεί να συνδεθεί με άλλες.</span></div><div className="dataset-list">{filteredDatasets.map(d => <DatasetCard key={d.id} dataset={d}/>)}</div>{!filteredDatasets.length && <div className="catalog-empty">Δεν βρέθηκε σύνολο με αυτόν τον όρο.</div>}<div className="dataset-intro provider-heading"><strong>Φορείς και πύλες</strong><span>Ελληνικοί, ευρωπαϊκοί και διεθνείς φορείς με κάλυψη στην Ελλάδα.</span></div><div className="catalog-grid">{filteredSources.map(s => <SourceCard key={s.id} source={s} onOpen={showSource}/>)}</div><div className="catalog-bottom"><span>Οι συνδέσεις μεταξύ διαφορετικών φορέων παραμένουν υποψήφιες μέχρι να ελεγχθούν.</span><span>{datasets.length} σύνολα · {sources.length} πηγές</span></div></div>}
      </section>
      {selectedSource && <div className="detail-overlay" onClick={() => setSelectedSource(null)}><aside className="detail-panel" onClick={e => e.stopPropagation()} aria-label="Στοιχεία πηγής"><div className="detail-top"><span className="eyebrow">ΠΡΟΦΙΛ ΠΗΓΗΣ</span><button aria-label="Κλείσιμο" onClick={() => setSelectedSource(null)}><X size={19}/></button></div><span className="detail-icon"><Database size={24}/></span><h2>{selectedSource.name}</h2><p className="detail-authority">{selectedSource.authority}</p><span className={selectedSource.status === 'Ενεργό επίπεδο' ? 'active-badge' : 'pending-badge'}>● {selectedSource.status}</span><p className="detail-description">{selectedSource.description}</p><div className="detail-rows"><div><span>Κατηγορία</span><strong>{selectedSource.category}</strong></div><div><span>Κάλυψη</span><strong>{selectedSource.coverage}</strong></div><div><span>Πρόσβαση</span><strong>{selectedSource.access}</strong></div><div><span>Κόστος / όροι</span><strong>{selectedSource.pricing}</strong></div><div><span>Άδεια χρήσης</span><strong>{selectedSource.license ?? 'Προς επαλήθευση'}</strong></div><div><span>Εμπορική χρήση</span><strong>{selectedSource.commercialUse ?? 'Προς επαλήθευση'}</strong></div><div><span>Τελευταίος έλεγχος</span><strong>{selectedSource.lastVerified ?? 'Δεν έχει ελεγχθεί'}</strong></div></div><a className="visit-link" href={selectedSource.homepage} target="_blank" rel="noopener noreferrer">Ιστότοπος πηγής <ExternalLink size={16}/></a>{selectedSource.documentation && <a className="documentation-link" href={selectedSource.documentation} target="_blank" rel="noopener noreferrer">Επίσημη τεκμηρίωση <ExternalLink size={15}/></a>}<p className="detail-disclaimer">Η καταχώριση δεν βεβαιώνει διαθεσιμότητα API, άδεια χρήσης ή πρόσφατη ενημέρωση.</p></aside></div>}
    </main>
  </div>;
}
export default App;
