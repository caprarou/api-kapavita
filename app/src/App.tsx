import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Compass, Database, ExternalLink, Globe2, Info, Layers3, MapPin, Menu, Minus, Plus, Search, ShieldCheck, SlidersHorizontal, Waves, Wind, X } from 'lucide-react';
import { sources, type SourceRecord } from './data/catalog';
import './App.css';

type Panel = 'map' | 'catalog';
type Place = { name: string; detail: string; center: [number, number]; zoom: number };
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
  { title: 'Ξηρά', icon: Layers3, entries: ['Διοικητικά όρια', 'Πληθυσμός', 'Επιχειρήσεις', 'Ακίνητα'] },
  { title: 'Θάλασσα', icon: Waves, entries: ['Πλοία / AIS', 'Θαλάσσιες ζώνες'] },
  { title: 'Αέρας', icon: Wind, entries: ['Αεροσκάφη', 'Αεροδρόμια'] },
  { title: 'Περιβάλλον', icon: Globe2, entries: ['Καιρός', 'Ποιότητα αέρα'] },
];

function MapView({ mapRef, onSelect }: { mapRef: React.MutableRefObject<MapLibreMap | null>; onSelect: (point: [number, number]) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/positron', center: [23.8, 38.7], zoom: 5.7, minZoom: 4, maxZoom: 17, attributionControl: false });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('click', (event) => onSelect([event.lngLat.lng, event.lngLat.lat]));
    mapRef.current = map;
    return () => { mapRef.current = null; map.remove(); };
  }, [mapRef, onSelect]);
  return <div ref={container} className="map-canvas" aria-label="Διαδραστικός χάρτης της Ελλάδας" />;
}

function SourceCard({ source, onOpen }: { source: SourceRecord; onOpen: (source: SourceRecord) => void }) {
  return <button className="source-card" onClick={() => onOpen(source)}>
    <span className="source-card-icon"><Database size={18} /></span>
    <span className="source-card-body"><strong>{source.name}</strong><small>{source.authority}</small><span>{source.description}</span></span>
    <ArrowRight size={17} className="source-arrow" />
  </button>;
}

function App() {
  const mapRef = useRef<MapLibreMap | null>(null);
  const [panel, setPanel] = useState<Panel>('map');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(places[0]);
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceRecord | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Ξηρά: true, Θάλασσα: true, Αέρας: true, Περιβάλλον: true });
  const filteredSources = useMemo(() => sources.filter(s => `${s.name} ${s.category} ${s.authority}`.toLocaleLowerCase('el').includes(query.toLocaleLowerCase('el'))), [query]);
  const filteredPlaces = useMemo(() => places.filter(p => `${p.name} ${p.detail}`.toLocaleLowerCase('el').includes(query.toLocaleLowerCase('el'))), [query]);
  const goTo = (place: Place) => { setPanel('map'); setSelectedPlace(place); setSelectedPoint(null); setSearchOpen(false); setQuery(''); setMobileMenu(false); setSelectedSource(null); requestAnimationFrame(() => mapRef.current?.flyTo({ center: place.center, zoom: place.zoom, essential: true, duration: 1100 })); };
  const showSource = (source: SourceRecord) => { setSelectedSource(source); setPanel('catalog'); setSearchOpen(false); setMobileMenu(false); };
  const selectPoint = useCallback((point: [number, number]) => { setSelectedPoint(point); setSelectedPlace(null); setSelectedSource(null); }, [setSelectedPoint, setSelectedPlace, setSelectedSource]);
  const switchPanel = (next: Panel) => { setPanel(next); setSelectedSource(null); setMobileMenu(false); setQuery(''); setSearchOpen(false); requestAnimationFrame(() => mapRef.current?.resize()); };
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
          <div className="sidebar-heading"><span className="eyebrow">ΕΞΕΡΕΥΝΗΣΗ</span><h1>Η Ελλάδα,<br/><em>σε ένα μέρος.</em></h1><p>Εξερεύνησε τον χώρο. Τα θεματικά δεδομένα θα ενεργοποιούνται καθώς επαληθεύονται οι πηγές τους.</p></div>
          <div className="search-wrap"><Search size={19} /><input aria-label="Αναζήτηση περιοχής ή πηγής" placeholder="Αναζήτησε περιοχή ή πηγή..." value={query} onChange={e => { setQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} /><span className="search-shortcut">⌕</span>
            {searchOpen && query && <div className="search-results">{filteredPlaces.map(p => <button key={p.name} onClick={() => goTo(p)}><MapPin size={15}/><span><strong>{p.name}</strong><small>{p.detail}</small></span></button>)}{filteredSources.slice(0, 4).map(s => <button key={s.id} onClick={() => showSource(s)}><Database size={15}/><span><strong>{s.name}</strong><small>Πηγή δεδομένων</small></span></button>)}{!filteredPlaces.length && !filteredSources.length && <div className="no-results">Δεν βρέθηκε αποτέλεσμα στον αρχικό κατάλογο.</div>}</div>}
          </div>
          <div className="sidebar-section-title"><span>ΕΠΙΠΕΔΑ ΧΑΡΤΗ</span><SlidersHorizontal size={15}/></div>
          <div className="base-layer"><span className="layer-symbol"><Compass size={19}/></span><span><strong>Βασικός χάρτης</strong><small>OpenFreeMap · OpenStreetMap</small></span><span className="on-indicator"><Check size={14}/></span></div>
          <div className="layer-list">{layerGroups.map(group => <div className="layer-group" key={group.title}><button className="group-heading" onClick={() => setExpanded({ ...expanded, [group.title]: !expanded[group.title] })} aria-expanded={expanded[group.title]}><group.icon size={16}/><span>{group.title}</span><ChevronDown size={15} className={expanded[group.title] ? '' : 'collapsed'} /></button>{expanded[group.title] && <div className="group-items">{group.entries.map(entry => <div className="layer-item" key={entry}><span className="empty-check"/><span>{entry}</span><small>Σύντομα</small></div>)}</div>}</div>)}</div>
          <div className="sidebar-footer"><Info size={17}/><span>Τα ανενεργά επίπεδα δεν προβάλλουν ακόμη δεδομένα. <button onClick={() => switchPanel('catalog')}>Δες τις πηγές <ArrowRight size={13}/></button></span></div>
        </> : <>
          <div className="sidebar-heading catalog-head"><span className="eyebrow">ΜΗΤΡΩΟ ΠΗΓΩΝ</span><h1>Γνώρισε τα<br/><em>δεδομένα.</em></h1><p>Ένας διαφανής κατάλογος πηγών για την Ελλάδα. Κάθε εγγραφή ξεκινά ως υποψήφια και επαληθεύεται ξεχωριστά.</p></div>
          <div className="catalog-note"><ShieldCheck size={20}/><span><strong>Πρώτα η προέλευση</strong><small>Δεν παρουσιάζουμε μια πηγή ως διαθέσιμο API πριν ελεγχθούν πρόσβαση, άδεια και κάλυψη.</small></span></div>
          <button className="back-map" onClick={() => switchPanel('map')}><ArrowLeft size={17}/> Επιστροφή στον χάρτη</button>
        </>}
      </aside>
      <section className={`main-stage ${panel === 'catalog' ? 'catalog-stage' : ''}`}>
        {panel === 'map' ? <>
          <MapView mapRef={mapRef} onSelect={selectPoint}/>
          <div className="map-top-left"><span className="map-label"><span className="pulse-dot" /> ΧΑΡΤΗΣ ΕΛΛΑΔΑΣ</span></div>
          <div className="map-controls"><button aria-label="Μεγέθυνση" onClick={() => mapRef.current?.zoomIn()}><Plus size={19}/></button><button aria-label="Σμίκρυνση" onClick={() => mapRef.current?.zoomOut()}><Minus size={19}/></button><div className="control-divider"/><button aria-label="Επιστροφή στην Ελλάδα" onClick={() => goTo(places[0])}><Compass size={19}/></button></div>
          <div className="map-info-card"><span className="info-card-icon"><MapPin size={20}/></span><div><span className="eyebrow">ΤΟΠΟΘΕΣΙΑ</span><h2>{selectedPlace?.name ?? 'Επιλεγμένο σημείο'}</h2><p>{selectedPlace?.detail ?? (selectedPoint ? `${selectedPoint[1].toFixed(4)}° Β, ${selectedPoint[0].toFixed(4)}° Α` : 'Ελλάδα')}</p></div><div className="info-separator"/><div className="info-availability"><span className="small-status-dot"/><span>Θεματικά δεδομένα<br/><strong>Δεν έχουν συνδεθεί</strong></span></div></div>
          <div className="map-bottom-note">Βάση χάρτη: OpenFreeMap / OpenStreetMap · Τα θεματικά επίπεδα είναι υπό ανάπτυξη</div>
        </> : <div className="catalog-content"><div className="catalog-title-row"><div><span className="eyebrow">GREECE DATA REGISTRY / 001</span><h2>Κατάλογος πηγών</h2><p>Οι πρώτες πηγές προς έλεγχο. Δεν έχουν συνδεθεί ακόμη ζωντανά δεδομένα.</p></div><span className="count-pill">{sources.length} υποψήφιες πηγές</span></div><div className="catalog-search"><Search size={19}/><input aria-label="Αναζήτηση πηγής" placeholder="Αναζήτησε πηγή ή κατηγορία..." value={query} onChange={e => setQuery(e.target.value)}/></div><div className="catalog-grid">{filteredSources.map(s => <SourceCard key={s.id} source={s} onOpen={showSource}/>)}</div>{!filteredSources.length && <div className="catalog-empty">Δεν βρέθηκε πηγή με αυτόν τον όρο.</div>}<div className="catalog-bottom"><span>Κάθε στοιχείο συμπληρώνεται μόνο όταν επιβεβαιωθεί.</span><span>Πρώτη καταγραφή · {sources.length} εγγραφές</span></div></div>}
      </section>
      {selectedSource && <div className="detail-overlay" onClick={() => setSelectedSource(null)}><aside className="detail-panel" onClick={e => e.stopPropagation()} aria-label="Στοιχεία πηγής"><div className="detail-top"><span className="eyebrow">ΠΡΟΦΙΛ ΠΗΓΗΣ</span><button aria-label="Κλείσιμο" onClick={() => setSelectedSource(null)}><X size={19}/></button></div><span className="detail-icon"><Database size={24}/></span><h2>{selectedSource.name}</h2><p className="detail-authority">{selectedSource.authority}</p><span className="pending-badge">● {selectedSource.status}</span><p className="detail-description">{selectedSource.description}</p><div className="detail-rows"><div><span>Κατηγορία</span><strong>{selectedSource.category}</strong></div><div><span>Κάλυψη</span><strong>{selectedSource.coverage}</strong></div><div><span>Πρόσβαση</span><strong>{selectedSource.access}</strong></div><div><span>Κόστος / όροι</span><strong>{selectedSource.pricing}</strong></div><div><span>Άδεια χρήσης</span><strong>{selectedSource.license ?? 'Προς επαλήθευση'}</strong></div><div><span>Εμπορική χρήση</span><strong>{selectedSource.commercialUse ?? 'Προς επαλήθευση'}</strong></div><div><span>Τελευταίος έλεγχος</span><strong>{selectedSource.lastVerified ?? 'Δεν έχει ελεγχθεί'}</strong></div></div><a className="visit-link" href={selectedSource.homepage} target="_blank" rel="noopener noreferrer">Ιστότοπος πηγής <ExternalLink size={16}/></a><p className="detail-disclaimer">Η καταχώριση δεν βεβαιώνει διαθεσιμότητα API, άδεια χρήσης ή πρόσφατη ενημέρωση.</p></aside></div>}
    </main>
  </div>;
}
export default App;
