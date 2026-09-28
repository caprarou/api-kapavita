import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Anchor, ArrowRight, Clock3, Heart, MapPin, MessageCircle, Radio, ShieldCheck, Ship, X } from 'lucide-react';
import './Seaviolet.css';

type View = 'family' | 'crew';
type Context = 'Εν πλω' | 'Αγκυροβολημένο' | 'Άφιξη' | 'Αναχώρηση' | 'Νύχτα';
type Greeting = { text: string; area: string; time: Date };
type Position = { mmsi: number; latitude: number; longitude: number; observedAt: string; source: string; speedKnots?: number; destination?: string; eta?: string };
const templates = ['Καλημέρα από…', 'Χαιρετισμούς από…', 'Όλα καλά από…', 'Καλή θάλασσα από…', 'Μια καληνύχτα από…', 'Με τον νου στο σπίτι από…', 'Στέλνω έναν χαιρετισμό από…'];
type Region = { name: string; phrase: string };
const regionGroups: { label: string; entries: Region[] }[] = [
  { label:'Ελλάδα & ανατολική Μεσόγειος', entries:[
    {name:'Αιγαίο',phrase:'το Αιγαίο'}, {name:'Βόρειο Αιγαίο',phrase:'το Βόρειο Αιγαίο'}, {name:'Νότιο Αιγαίο',phrase:'το Νότιο Αιγαίο'},
    {name:'Ιόνιο',phrase:'το Ιόνιο'}, {name:'Μυρτώο πέλαγος',phrase:'το Μυρτώο πέλαγος'}, {name:'Περιοχή της Κρήτης',phrase:'την περιοχή της Κρήτης'},
    {name:'Λιβυκό πέλαγος',phrase:'το Λιβυκό πέλαγος'}, {name:'Κρητικό πέλαγος',phrase:'το Κρητικό πέλαγος'}, {name:'Σαρωνικός κόλπος',phrase:'τον Σαρωνικό κόλπο'},
    {name:'Κορινθιακός κόλπος',phrase:'τον Κορινθιακό κόλπο'}, {name:'Μεσόγειος',phrase:'τη Μεσόγειο'}, {name:'Ανατολική Μεσόγειος',phrase:'την Ανατολική Μεσόγειο'},
    {name:'Περιοχή της Κύπρου',phrase:'την περιοχή της Κύπρου'}, {name:'Μαύρη Θάλασσα',phrase:'τη Μαύρη Θάλασσα'}, {name:'Θάλασσα του Μαρμαρά',phrase:'τη Θάλασσα του Μαρμαρά'},
  ]},
  { label:'Ευρώπη & Ατλαντικός', entries:[
    {name:'Αδριατική Θάλασσα',phrase:'την Αδριατική'}, {name:'Τυρρηνικό πέλαγος',phrase:'το Τυρρηνικό πέλαγος'}, {name:'Αλβοράν',phrase:'το Αλβοράν'},
    {name:'Δυτική Μεσόγειος',phrase:'τη Δυτική Μεσόγειο'}, {name:'Ατλαντικός Ωκεανός',phrase:'τον Ατλαντικό Ωκεανό'},
    {name:'Βόρειος Ατλαντικός',phrase:'τον Βόρειο Ατλαντικό'}, {name:'Νότιος Ατλαντικός',phrase:'τον Νότιο Ατλαντικό'},
    {name:'Βόρεια Θάλασσα',phrase:'τη Βόρεια Θάλασσα'}, {name:'Βαλτική Θάλασσα',phrase:'τη Βαλτική Θάλασσα'}, {name:'Θάλασσα της Νορβηγίας',phrase:'τη Θάλασσα της Νορβηγίας'},
  ]},
  { label:'Αφρική, Ασία & ωκεανοί', entries:[
    {name:'Ερυθρά Θάλασσα',phrase:'την Ερυθρά Θάλασσα'}, {name:'Κόλπος του Άντεν',phrase:'τον Κόλπο του Άντεν'},
    {name:'Αραβική Θάλασσα',phrase:'την Αραβική Θάλασσα'}, {name:'Περσικός Κόλπος',phrase:'τον Περσικό Κόλπο'},
    {name:'Ινδικός Ωκεανός',phrase:'τον Ινδικό Ωκεανό'}, {name:'Ειρηνικός Ωκεανός',phrase:'τον Ειρηνικό Ωκεανό'},
    {name:'Νότια Σινική Θάλασσα',phrase:'τη Νότια Σινική Θάλασσα'}, {name:'Θάλασσα της Καραϊβικής',phrase:'την Καραϊβική Θάλασσα'},
    {name:'Κόλπος του Μεξικού',phrase:'τον Κόλπο του Μεξικού'},
  ]},
  { label:'Στενά, διώρυγες & περάσματα', entries:[
    {name:'Στενά των Δαρδανελλίων',phrase:'τα Στενά των Δαρδανελλίων'}, {name:'Βόσπορος',phrase:'τον Βόσπορο'},
    {name:'Στενά του Γιβραλτάρ',phrase:'τα Στενά του Γιβραλτάρ'}, {name:'Διώρυγα του Σουέζ',phrase:'τη Διώρυγα του Σουέζ'},
    {name:'Στενά Μπαμπ ελ Μαντέμπ',phrase:'τα Στενά Μπαμπ ελ Μαντέμπ'}, {name:'Στενά του Ορμούζ',phrase:'τα Στενά του Ορμούζ'},
    {name:'Στενά της Μαλάκκας',phrase:'τα Στενά της Μαλάκκας'}, {name:'Μάγχη',phrase:'τη Μάγχη'},
    {name:'Στενά του Μεσσήνα',phrase:'τα Στενά του Μεσσήνα'}, {name:'Διώρυγα του Παναμά',phrase:'τη Διώρυγα του Παναμά'},
    {name:'Ακρωτήριο Καλής Ελπίδας',phrase:'το Ακρωτήριο της Καλής Ελπίδας'},
  ]},
  { label:'Γενικά', entries:[{name:'Ανοιχτή θάλασσα',phrase:'την ανοιχτή θάλασσα'}] },
];
const regions = ['Χωρίς κοινοποίηση περιοχής', ...regionGroups.flatMap(group => group.entries.map(item=>item.name))];
const phrases: Record<string,string> = Object.fromEntries(regionGroups.flatMap(group=>group.entries.map(item=>[item.name,item.phrase])));
const recommended: Record<Context,string> = { 'Εν πλω':'Καλή θάλασσα από…', 'Αγκυροβολημένο':'Όλα καλά από…', 'Άφιξη':'Χαιρετισμούς από…', 'Αναχώρηση':'Με τον νου στο σπίτι από…', 'Νύχτα':'Μια καληνύχτα από…' };
const dailySeaNotes = [{title:"Το ημερολόγιο της θάλασσας",text:"Κάθε ταξίδι αρχίζει με μια μικρή αναχώρηση και συνεχίζεται με πολλές διορθώσεις πορείας.",source:"Σημείωμα ναυσιπλοΐας"},{title:"Λιμάνια και άνθρωποι",text:"Η θάλασσα κρατά ζωντανές τις ιστορίες όσων ταξίδεψαν πριν από εμάς.",source:"Ημερήσια γνώση θάλασσας"},{title:"Μικρός ναυτικός όρος",text:"Πλώρη είναι το μπροστινό μέρος του πλοίου, εκεί όπου η πορεία συναντά πρώτη τον ορίζοντα.",source:"Ναυτική ορολογία"}];
const vesselUrl = 'https://www.marinetraffic.com/en/ais/details/ships/shipid:9149760/mmsi:248554000/imo:9790983/vessel:SEAVIOLET';
const dateGreece = (value: Date) => new Intl.DateTimeFormat('el-GR', { timeZone:'Europe/Athens', weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(value);
const clock = (value: Date, offset: number) => new Intl.DateTimeFormat('el-GR', { timeZone:'UTC', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(value.getTime() + offset * 3600000));
const greeceOffset = (now: Date) => {
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Athens', timeZoneName:'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+2';
  return Number(hour.replace('GMT','')) || 0;
};
function seaSuggestion(lat:number, lon:number) {
  // Conservative broad suggestions; narrow straits remain a deliberate crew choice.
  if (lat >= 41.5 && lat <= 47 && lon >= 28 && lon <= 41.5) return 'Μαύρη Θάλασσα';
  if (lat >= 35.4 && lat <= 40.8 && lon >= 23.1 && lon <= 27.8) return 'Αιγαίο';
  if (lat >= 33.8 && lat <= 35.3 && lon >= 22 && lon <= 28) return 'Περιοχή της Κρήτης';
  if (lat >= 36.6 && lat <= 40.4 && lon >= 17 && lon <= 22.1) return 'Ιόνιο';
  if (lat >= 12.5 && lat <= 29 && lon >= 32.5 && lon <= 43.5) return 'Ερυθρά Θάλασσα';
  if (lat >= 12 && lat <= 15.7 && lon >= 43.7 && lon <= 52.7) return 'Κόλπος του Άντεν';
  if (lat >= 24 && lat <= 30 && lon >= 48 && lon <= 56) return 'Περσικός Κόλπος';
  if (lat >= 10 && lat <= 24 && lon >= 54 && lon <= 73) return 'Αραβική Θάλασσα';
  if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 36) return 'Μεσόγειος';
  if (lat >= -45 && lat <= 22 && lon >= 45 && lon <= 105) return 'Ινδικός Ωκεανός';
  if (lat >= -60 && lat <= 70 && lon >= -80 && lon <= 10) return 'Ατλαντικός Ωκεανός';
  return null;
}
function VesselMap({ position }: { position: Position | null }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { zoomControl:true }).setView(position ? [position.latitude,position.longitude] : [35,17], position ? 6 : 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap contributors', maxZoom:18 }).addTo(map);
    if (position) L.marker([position.latitude,position.longitude], { icon: L.divIcon({ className:'ship-map-icon', html:'<span>⛴</span>', iconSize:[34,34], iconAnchor:[17,17] }) }).addTo(map).bindPopup('SEAVIOLET · τελευταίο καταγεγραμμένο στίγμα');
    const controller = new AbortController();
    fetch('/api/v1/vessel/seaviolet/history?hours=168', { signal: controller.signal, cache:'no-store' }).then(r => r.ok ? r.json() : null).then(data => { const points = data?.points?.filter((p: any) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) ?? []; if (points.length > 1) { const line = L.polyline(points.map((p: any) => [p.latitude,p.longitude] as [number,number]), { color:'#147fba', weight:3, opacity:.8 }).addTo(map); map.fitBounds(line.getBounds().pad(.15)); } }).catch(() => {});
    const timer = window.setTimeout(() => map.invalidateSize(), 50);
    return () => { controller.abort(); window.clearTimeout(timer); map.remove(); };
  }, [position]);
  return <div className="sea-map-wrap"><div className="sea-map" ref={element} role="img" aria-label={position ? 'Χάρτης με το τελευταίο καταγεγραμμένο στίγμα του SEAVIOLET' : 'Χάρτης χωρίς επιβεβαιωμένο στίγμα του πλοίου'} />{!position && <div className="sea-map-empty"><MapPin size={21}/><strong>Δεν έχει συνδεθεί στίγμα AIS</strong><span>Ο χάρτης δεν δείχνει θέση πλοίου μέχρι να λάβουμε καταγραφή με ώρα και πηγή.</span></div>}</div>;
}
function ExternalVesselPosition() {
  return <div className="sea-external-position"><MapPin size={25}/><div><strong>Δες τη νεότερη θέση στο VesselFinder</strong><p>Η δική μας ροή AIS δεν έχει λάβει ακόμη στίγμα για το SEAVIOLET. Το VesselFinder διαθέτει ανεξάρτητα δεδομένα για τη θέση, τον προορισμό και την εκτιμώμενη άφιξη· άνοιξέ τα απευθείας στην υπηρεσία του.</p><a href="https://www.vesselfinder.com/vessels/details/9790983" target="_blank" rel="noopener noreferrer">Άνοιξε τη σελίδα του SEAVIOLET στο VesselFinder ↗</a><p className="sea-alternative-source">Δεύτερη ανεξάρτητη πηγή: <a href="https://www.myshiptracking.com/vessels/seaviolet-mmsi-248554000-imo-9790983" target="_blank" rel="noopener noreferrer">MyShipTracking ↗</a>. Έλεγξε την ώρα του στίγματος· μπορεί να είναι παλαιότερο.</p></div></div>;
}
function validPosition(raw: unknown): Position | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string,unknown>;
  const lat = Number(p.latitude), lon = Number(p.longitude), date = new Date(String(p.observedAt));
  if (p.mmsi !== 248554000 || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180 || !Number.isFinite(date.getTime()) || date.getTime()>Date.now()+600000 || typeof p.source !== 'string' || !p.source.trim()) return null;
  return { mmsi:248554000, latitude:lat, longitude:lon, observedAt:date.toISOString(), source:p.source, speedKnots:typeof p.speedKnots==='number' ? p.speedKnots : undefined, destination:typeof p.destination==='string' ? p.destination : undefined, eta:typeof p.eta==='string' ? p.eta : undefined };
}
export function Seaviolet() {
  const [view,setView] = useState<View>('family');
  const [context,setContext] = useState<Context>('Εν πλω');
  const [region,setRegion] = useState(regions[0]);
  const [template,setTemplate] = useState(recommended['Εν πλω']);
  const [custom,setCustom] = useState('');
  const [history,setHistory] = useState<Greeting[]>([]);
  const [notice,setNotice] = useState(false);
  const [position,setPosition] = useState<Position | null>(null);
  const [offset,setOffset] = useState<number | null>(() => { const n = Number(window.localStorage.getItem('liakos-ship-utc-offset')); return window.localStorage.getItem('liakos-ship-utc-offset') !== null && Number.isInteger(n) && n >= -12 && n <= 14 ? n : null; });
  const [now,setNow] = useState(new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    let alive = true;
    const read = async () => { try {
      const response = await fetch('/api/v1/vessel/seaviolet', { cache:'no-store', credentials:'same-origin' });
      if (response.ok && alive) setPosition(validPosition(await response.json()));
    } catch { /* AIS feed is optional; keep last known position in the session. */ } };
    void read(); const t = window.setInterval(() => void read(), 60000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  const suggestion = position ? seaSuggestion(position.latitude,position.longitude) : null;
  const ageHours = position ? (now.getTime()-new Date(position.observedAt).getTime())/3600000 : Infinity;
  const stale = ageHours > 24;
  const safeRegion = phrases[region] ?? '';
  const greetingText = custom.trim() || (safeRegion ? template.replace('…', ' '+safeRegion) : template.replace(' από…','').replace('…',''));
  const chooseContext = (next:Context) => { setContext(next); setTemplate(recommended[next]); setCustom(''); };
  const preview = () => { setHistory(items => [{text:greetingText,area:region,time:new Date()},...items].slice(0,5)); setNotice(true); setView('family'); };
  const shipClock = offset === null ? 'Επίλεξε UTC ζώνη του πλοίου' : clock(now,offset)+' (UTC'+(offset>=0?'+':'')+offset+')';
  const difference = offset === null ? 'Απαιτείται η ζώνη ώρας του πλοίου' : (offset-greeceOffset(now) === 0 ? 'Ίδια ώρα με Ελλάδα' : Math.abs(offset-greeceOffset(now))+' ώρες '+(offset>greeceOffset(now)?'μπροστά':'πίσω')+' από Ελλάδα');
  const vessel = <section className="sea-card sea-vessel"><div className="sea-card-heading"><span className="sea-card-icon"><Ship size={19}/></span><div><span className="sea-eyebrow">ΤΙ ΚΑΝΕΙ ΤΟ ΠΛΟΙΟ</span><h2>SEAVIOLET</h2></div><span className="sea-availability">{position ? (stale ? 'Παλιό στίγμα' : 'Τελευταίο στίγμα') : 'Αναμονή στίγματος AIS'}</span></div>
    <div className="sea-identity">Δεξαμενόπλοιο αργού πετρελαίου · σημαία Μάλτας · κατασκευή 2018 · IMO 9790983 · MMSI 248554000 · διακριτικό 9HA4701</div>
    <div className="sea-vessel-grid"><div><small>Κατάσταση</small><strong>{position ? (stale ? 'Δεν υπάρχει πρόσφατη επιβεβαίωση' : 'Τελευταία καταγραφή AIS') : 'Δεν έχει παραληφθεί στίγμα'}</strong></div><div><small>Γενική περιοχή στίγματος</small><strong>{position ? (suggestion ?? 'Δεν προσδιορίζεται αξιόπιστα') : 'Μη διαθέσιμη'}</strong></div><div><small>Προορισμός</small><strong>{position?.destination || 'Μη διαθέσιμος από τη συνδεδεμένη πηγή'}</strong></div><div><small>Εκτιμώμενη άφιξη</small><strong>{position?.eta || 'Μη διαθέσιμη από τη συνδεδεμένη πηγή'}</strong></div><div><small>Ώρα Ελλάδας τώρα</small><strong>{clock(now,greeceOffset(now))}</strong></div><div><small>Ώρα πλοίου τώρα</small><strong>{shipClock}</strong><small>{difference}</small></div></div>
    <label className="sea-label" htmlFor="sea-timezone">Ζώνη ώρας που ακολουθεί το πλοίο (ορίζεται από το πλήρωμα)</label><select id="sea-timezone" className="sea-input" value={offset ?? ''} onChange={e => { const next = e.target.value; setOffset(next === '' ? null : Number(next)); if (next === '') window.localStorage.removeItem('liakos-ship-utc-offset'); else window.localStorage.setItem('liakos-ship-utc-offset',next); }}><option value="">Δεν έχει επιβεβαιωθεί</option>{Array.from({length:27},(_,i)=>i-12).map(v=><option value={v} key={v}>UTC{v>=0?'+':''}{v}</option>)}</select>
    <h3 className="sea-map-title">{position ? 'Τελευταίο στίγμα από τη δική μας ροή' : 'Εξωτερική ενημέρωση πλοίου'}</h3>{position ? <VesselMap position={position}/> : <ExternalVesselPosition/>}<p className="sea-explain"><Radio size={15}/>{position ? <>Καταγράφηκε {dateGreece(new Date(position.observedAt))} (ώρα Ελλάδας) · πηγή: {position.source}. {stale && 'Το στίγμα είναι παλιό και δεν δείχνει τη σημερινή θέση.'}</> : <>Δεν έχουμε παραλάβει ακόμη έγκυρη αναφορά θέσης AIS για το πλοίο. Η εξωτερική σελίδα του VesselFinder μπορεί να εμφανίζει νεότερα δεδομένα από άλλη πηγή. <a href={vesselUrl} target="_blank" rel="noreferrer">Δες το SEAVIOLET στο MarineTraffic</a> για την τελευταία αναφορά της υπηρεσίας.</>}</p><p className="sea-explain">Η ώρα πλοίου είναι η επιλεγμένη ζώνη του πληρώματος, όχι εκτίμηση από τη θέση. Τα σταθερά χαρακτηριστικά έχουν ελεγχθεί σε μητρώο πλοίων.</p>
  </section>;
  const daily = dailySeaNotes[Math.floor(Date.now()/86400000) % dailySeaNotes.length];
  return <div className="sea-page"><section className="sea-card sea-daily-note"><span className="sea-eyebrow">ΣΗΜΕΡΑ ΣΤΗ ΘΑΛΑΣΣΑ</span><h2>{daily.title}</h2><p>«{daily.text}»</p><small>{daily.source}</small></section>
    <div className="sea-header"><div><span className="sea-kicker">SEAVIOLET · ΟΙΚΟΓΕΝΕΙΑ & ΠΛΗΡΩΜΑ</span><h1>Liakos εν πλω</h1><p>Το SEAVIOLET και ένας προσωπικός χαιρετισμός, στην ίδια συσκευή.</p></div><span className="sea-demo">Τοπική προεπισκόπηση χαιρετισμού</span></div>
    <div className="sea-tabs" role="tablist" aria-label="Προβολή Liakos εν πλω"><button role="tab" aria-selected={view==='family'} className={view==='family'?'selected':''} onClick={()=>setView('family')}><Heart size={17}/> Οικογένεια</button><button role="tab" aria-selected={view==='crew'} className={view==='crew'?'selected':''} onClick={()=>setView('crew')}><Ship size={17}/> Πλήρωμα</button></div>
    {view==='family' ? <div className="sea-layout"><div className="sea-main">
      {notice && <div className="sea-notice" role="status">Ο χαιρετισμός εμφανίστηκε μόνο σε αυτή τη συσκευή. Δεν έγινε αποστολή.<button aria-label="Κλείσιμο ενημέρωσης" onClick={()=>setNotice(false)}><X size={15}/></button></div>}
      {vessel}
      <section className="sea-card sea-message"><div className="sea-card-heading"><span className="sea-card-icon sea-heart"><Heart size={19}/></span><div><span className="sea-eyebrow">ΜΑΣ ΕΣΤΕΙΛΕ ΧΑΙΡΕΤΙΣΜΟ</span><h2>Μια κουβέντα από το πλήρωμα</h2></div></div>
      {history.length ? <><p className="sea-greeting">«{history[0].text}»</p><div className="sea-greeting-meta"><Clock3 size={14}/> {dateGreece(history[0].time)} · ώρα Ελλάδας · {history[0].area}</div></> : <div className="sea-empty"><MessageCircle size={26}/><strong>Δεν υπάρχει προσωπικός χαιρετισμός.</strong><span>Δοκίμασε την πλευρά του πληρώματος στην ίδια συσκευή. Η ώρα του χαιρετισμού είναι ξεχωριστή από την ώρα του τελευταίου στίγματος.</span></div>}</section>
      <div className="sea-history"><h3>Ιστορικό χαιρετισμών στην προεπισκόπηση</h3>{history.length ? history.map((item,index)=><div key={index}><span>«{item.text}»</span><small>{dateGreece(item.time)} · ώρα Ελλάδας</small></div>) : <p>Δεν υπάρχουν ακόμη χαιρετισμοί.</p>}</div>
    </div><aside className="sea-side"><div className="sea-side-card"><MapPin size={21}/><h3>Πραγματική θέση πλοίου</h3><p>Η ένδειξη προέρχεται μόνο από το AIS και δείχνει το τελευταίο στίγμα, την ώρα λήψης και την πορεία όταν υπάρχουν διαθέσιμα δεδομένα.</p></div><div className="sea-side-card"><ShieldCheck size={21}/><h3>Τοπικός χαιρετισμός</h3><p>Η οικογένεια και το πλήρωμα εναλλάσσονται στον ίδιο browser. Το μήνυμα μένει τοπικά και δεν αποστέλλεται στον server.</p></div><button className="sea-switch" onClick={()=>setView('crew')}>Πλευρά πληρώματος <ArrowRight size={16}/></button></aside></div>
    : <div className="sea-layout"><div className="sea-main"><section className="sea-card sea-compose"><div className="sea-card-heading"><span className="sea-card-icon sea-heart"><Heart size={19}/></span><div><span className="sea-eyebrow">ΕΝΑ ΑΓΓΙΓΜΑ</span><h2>Στείλε ένα σημάδι ότι είσαι καλά</h2></div></div><p className="sea-compose-intro">Επίλεξε μια σύντομη φράση ή γράψε τη δική σου. Εδώ βλέπεις το αποτέλεσμα στην ίδια συσκευή.</p>
      <span className="sea-label">Περίσταση</span><div className="sea-choice">{(Object.keys(recommended) as Context[]).map(item=><button key={item} className={context===item?'chosen':''} onClick={()=>chooseContext(item)}>{item}</button>)}</div>
      <label className="sea-label" htmlFor="sea-region">Περιοχή που θέλεις να αναφέρεις στον χαιρετισμό</label><select id="sea-region" className="sea-input" value={region} onChange={e=>setRegion(e.target.value)}><option value={regions[0]}>{regions[0]}</option>{regionGroups.map(group=><optgroup key={group.label} label={group.label}>{group.entries.map(item=><option value={item.name} key={item.name}>{item.name}</option>)}</optgroup>)}</select>
      <p className="sea-only-preview">{suggestion && !stale ? <>Πρόταση από το τελευταίο στίγμα πλοίου: <button className="sea-link-button" onClick={()=>setRegion(suggestion)}>{suggestion}</button>. Επίλεξέ την μόνο αν θέλεις να την αναφέρεις.</> : 'Δεν προτείνεται περιοχή από πρόσφατο στίγμα. Επίλεξε γενική θάλασσα ή χωρίς περιοχή.'}</p>
      <span className="sea-label">Έτοιμος χαιρετισμός <small>· Πρόταση: {recommended[context]}</small></span><div className="sea-phrases">{templates.map(item=><button key={item} className={template===item&&!custom?'chosen':''} onClick={()=>{setTemplate(item);setCustom('');}}>{item}</button>)}</div>
      <label className="sea-label" htmlFor="sea-custom">Ή γράψε κάτι δικό σου (προαιρετικό)</label><textarea id="sea-custom" className="sea-input" rows={2} maxLength={180} placeholder="Μέχρι δύο σύντομες γραμμές…" value={custom} onChange={e=>setCustom(e.target.value)}/>
      <div className="sea-preview"><small>Πώς θα το δει η οικογένεια</small><strong>«{greetingText}»</strong><span>{region} · {dateGreece(now)} (ώρα Ελλάδας)</span></div><button className="sea-primary" onClick={preview}><Heart size={17}/> Δες το στην οικογενειακή προβολή</button><p className="sea-only-preview">Η προεπισκόπηση υπάρχει μόνο σε αυτή τη συνεδρία browser. Δεν γίνεται πραγματική αποστολή.</p>
    </section>{vessel}</div><aside className="sea-side"><div className="sea-side-card"><ShieldCheck size={21}/><h3>Ο χαιρετισμός δεν είναι AIS</h3><p>Η επιλογή θάλασσας περιγράφει το μήνυμα, όχι την επαληθευμένη θέση του πλοίου. Ο χάρτης κρατά τη δική του πηγή και ώρα.</p></div><div className="sea-side-card"><Anchor size={21}/><h3>Ακριβής ώρα πλοίου</h3><p>Το πλήρωμα μπορεί να επιλέξει τη ζώνη UTC που ακολουθεί στο πλοίο. Η επιλογή αποθηκεύεται μόνο σε αυτή τη συσκευή.</p></div></aside></div>}
  </div>;
}



