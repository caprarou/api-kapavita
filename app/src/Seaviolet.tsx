import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Anchor, ArrowRight, Clock3, Heart, MapPin, MessageCircle, Radio, ShieldCheck, Ship, X } from 'lucide-react';
import './Seaviolet.css';

type View = 'family' | 'crew';
type Context = 'Εν πλω' | 'Αγκυροβολημένο' | 'Άφιξη' | 'Αναχώρηση' | 'Νύχτα';
type Greeting = { text: string; area: string; time: Date };
type Position = { mmsi: number; latitude: number; longitude: number; observedAt: string; source: string; speedKnots?: number; destination?: string; eta?: string };
const templates = ['Καλημέρα από…', 'Χαιρετισμούς από…', 'Όλα καλά από…', 'Καλή θάλασσα από…', 'Μια καληνύχτα από…', 'Με τον νου στο σπίτι από…', 'Στέλνω έναν χαιρετισμό από…'];
const regions = ['Χωρίς κοινοποίηση περιοχής', 'Αιγαίο', 'Ιόνιο', 'Περιοχή της Κρήτης', 'Μεσόγειος', 'Ατλαντικός Ωκεανός', 'Μαύρη Θάλασσα', 'Ανοιχτή θάλασσα'];
const phrases: Record<string,string> = { Αιγαίο:'το Αιγαίο', Ιόνιο:'το Ιόνιο', 'Περιοχή της Κρήτης':'την περιοχή της Κρήτης', Μεσόγειος:'τη Μεσόγειο', 'Ατλαντικός Ωκεανός':'τον Ατλαντικό Ωκεανό', 'Μαύρη Θάλασσα':'τη Μαύρη Θάλασσα', 'Ανοιχτή θάλασσα':'την ανοιχτή θάλασσα' };
const recommended: Record<Context,string> = { 'Εν πλω':'Καλή θάλασσα από…', 'Αγκυροβολημένο':'Όλα καλά από…', 'Άφιξη':'Χαιρετισμούς από…', 'Αναχώρηση':'Με τον νου στο σπίτι από…', 'Νύχτα':'Μια καληνύχτα από…' };
const vesselUrl = 'https://www.marinetraffic.com/en/ais/details/ships/shipid:9149760/mmsi:248554000/imo:9790983/vessel:SEAVIOLET';
const dateGreece = (value: Date) => new Intl.DateTimeFormat('el-GR', { timeZone:'Europe/Athens', weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(value);
const clock = (value: Date, offset: number) => new Intl.DateTimeFormat('el-GR', { timeZone:'UTC', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(value.getTime() + offset * 3600000));
const greeceOffset = (now: Date) => {
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Athens', timeZoneName:'shortOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+2';
  return Number(hour.replace('GMT','')) || 0;
};
function seaSuggestion(lat:number, lon:number) {
  if (lat >= 39 && lat <= 47 && lon >= 27 && lon <= 42) return 'Μαύρη Θάλασσα';
  if (lat >= 34 && lat <= 42 && lon >= 23 && lon <= 30) return 'Αιγαίο';
  if (lat >= 33 && lat <= 37 && lon >= 22 && lon <= 29) return 'Περιοχή της Κρήτης';
  if (lat >= 35 && lat <= 41 && lon >= 17 && lon <= 23) return 'Ιόνιο';
  if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 36) return 'Μεσόγειος';
  if (lat >= -60 && lat <= 70 && lon >= -80 && lon <= 10) return 'Ατλαντικός Ωκεανός';
  return null;
}
function VesselMap({ position }: { position: Position | null }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current, { zoomControl:true }).setView(position ? [position.latitude,position.longitude] : [35,17], position ? 6 : 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap contributors', maxZoom:18 }).addTo(map);
    if (position) L.circleMarker([position.latitude,position.longitude], { radius:10, color:'#fff', weight:3, fillColor:'#147fba', fillOpacity:1 }).addTo(map).bindPopup('SEAVIOLET · τελευταίο καταγεγραμμένο στίγμα');
    const timer = window.setTimeout(() => map.invalidateSize(), 50);
    return () => { window.clearTimeout(timer); map.remove(); };
  }, [position]);
  return <div className="sea-map-wrap"><div className="sea-map" ref={element} role="img" aria-label={position ? 'Χάρτης με το τελευταίο καταγεγραμμένο στίγμα του SEAVIOLET' : 'Χάρτης χωρίς επιβεβαιωμένο στίγμα του πλοίου'} />{!position && <div className="sea-map-empty"><MapPin size={21}/><strong>Δεν έχει συνδεθεί στίγμα AIS</strong><span>Ο χάρτης δεν δείχνει θέση πλοίου μέχρι να λάβουμε καταγραφή με ώρα και πηγή.</span></div>}</div>;
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
      const response = await fetch('/data/seaviolet-last-position.json', { cache:'no-store' });
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
  const vessel = <section className="sea-card sea-vessel"><div className="sea-card-heading"><span className="sea-card-icon"><Ship size={19}/></span><div><span className="sea-eyebrow">ΤΙ ΚΑΝΕΙ ΤΟ ΠΛΟΙΟ</span><h2>SEAVIOLET</h2></div><span className="sea-availability">{position ? (stale ? 'Παλιό στίγμα' : 'Τελευταίο στίγμα') : 'AIS μη συνδεδεμένο'}</span></div>
    <div className="sea-identity">Δεξαμενόπλοιο αργού πετρελαίου · σημαία Μάλτας · κατασκευή 2018 · IMO 9790983 · MMSI 248554000 · διακριτικό 9HA4701</div>
    <div className="sea-vessel-grid"><div><small>Κατάσταση</small><strong>{position ? (stale ? 'Δεν υπάρχει πρόσφατη επιβεβαίωση' : 'Τελευταία καταγραφή AIS') : 'Δεν υπάρχει ζωντανή ροή'}</strong></div><div><small>Γενική περιοχή στίγματος</small><strong>{position ? (suggestion ?? 'Δεν προσδιορίζεται αξιόπιστα') : 'Μη διαθέσιμη'}</strong></div><div><small>Προορισμός</small><strong>{position?.destination || 'Μη διαθέσιμος από τη συνδεδεμένη πηγή'}</strong></div><div><small>Εκτιμώμενη άφιξη</small><strong>{position?.eta || 'Μη διαθέσιμη από τη συνδεδεμένη πηγή'}</strong></div><div><small>Ώρα Ελλάδας τώρα</small><strong>{clock(now,greeceOffset(now))}</strong></div><div><small>Ώρα πλοίου τώρα</small><strong>{shipClock}</strong><small>{difference}</small></div></div>
    <label className="sea-label" htmlFor="sea-timezone">Ζώνη ώρας που ακολουθεί το πλοίο (ορίζεται από το πλήρωμα)</label><select id="sea-timezone" className="sea-input" value={offset ?? ''} onChange={e => { const next = e.target.value; setOffset(next === '' ? null : Number(next)); if (next === '') window.localStorage.removeItem('liakos-ship-utc-offset'); else window.localStorage.setItem('liakos-ship-utc-offset',next); }}><option value="">Δεν έχει επιβεβαιωθεί</option>{Array.from({length:27},(_,i)=>i-12).map(v=><option value={v} key={v}>UTC{v>=0?'+':''}{v}</option>)}</select>
    <h3 className="sea-map-title">Τελευταίο στίγμα πλοίου</h3><VesselMap position={position}/><p className="sea-explain"><Radio size={15}/>{position ? <>Καταγράφηκε {dateGreece(new Date(position.observedAt))} (ώρα Ελλάδας) · πηγή: {position.source}. {stale && 'Το στίγμα είναι παλιό και δεν δείχνει τη σημερινή θέση.'}</> : <>Δεν έχει συνδεθεί διαθέσιμη ροή AIS με συντεταγμένες. <a href={vesselUrl} target="_blank" rel="noreferrer">Δες το SEAVIOLET στο MarineTraffic</a> για την τελευταία αναφορά της υπηρεσίας.</>}</p><p className="sea-explain">Η ώρα πλοίου είναι η επιλεγμένη ζώνη του πληρώματος, όχι εκτίμηση από τη θέση. Τα σταθερά χαρακτηριστικά έχουν ελεγχθεί σε μητρώο πλοίων.</p>
  </section>;
  return <div className="sea-page">
    <div className="sea-header"><div><span className="sea-kicker">SEAVIOLET · ΟΙΚΟΓΕΝΕΙΑ & ΠΛΗΡΩΜΑ</span><h1>Liakos εν πλω</h1><p>Το SEAVIOLET και ένας προσωπικός χαιρετισμός, στην ίδια συσκευή.</p></div><span className="sea-demo">Τοπική προεπισκόπηση χαιρετισμού</span></div>
    <div className="sea-tabs" role="tablist" aria-label="Προβολή Liakos εν πλω"><button role="tab" aria-selected={view==='family'} className={view==='family'?'selected':''} onClick={()=>setView('family')}><Heart size={17}/> Οικογένεια</button><button role="tab" aria-selected={view==='crew'} className={view==='crew'?'selected':''} onClick={()=>setView('crew')}><Ship size={17}/> Πλήρωμα</button></div>
    {view==='family' ? <div className="sea-layout"><div className="sea-main">
      {notice && <div className="sea-notice" role="status">Ο χαιρετισμός εμφανίστηκε μόνο σε αυτή τη συσκευή. Δεν έγινε αποστολή.<button aria-label="Κλείσιμο ενημέρωσης" onClick={()=>setNotice(false)}><X size={15}/></button></div>}
      {vessel}
      <section className="sea-card sea-message"><div className="sea-card-heading"><span className="sea-card-icon sea-heart"><Heart size={19}/></span><div><span className="sea-eyebrow">ΜΑΣ ΕΣΤΕΙΛΕ ΧΑΙΡΕΤΙΣΜΟ</span><h2>Μια κουβέντα από το πλήρωμα</h2></div></div>
      {history.length ? <><p className="sea-greeting">«{history[0].text}»</p><div className="sea-greeting-meta"><Clock3 size={14}/> {dateGreece(history[0].time)} · ώρα Ελλάδας · {history[0].area}</div></> : <div className="sea-empty"><MessageCircle size={26}/><strong>Δεν υπάρχει προσωπικός χαιρετισμός.</strong><span>Δοκίμασε την πλευρά του πληρώματος στην ίδια συσκευή. Η ώρα του χαιρετισμού είναι ξεχωριστή από την ώρα του τελευταίου στίγματος.</span></div>}</section>
      <div className="sea-history"><h3>Ιστορικό χαιρετισμών στην προεπισκόπηση</h3>{history.length ? history.map((item,index)=><div key={index}><span>«{item.text}»</span><small>{dateGreece(item.time)} · ώρα Ελλάδας</small></div>) : <p>Δεν υπάρχουν ακόμη χαιρετισμοί.</p>}</div>
    </div><aside className="sea-side"><div className="sea-side-card"><MapPin size={21}/><h3>Δύο διαφορετικές θέσεις</h3><p>Ο χάρτης δείχνει μόνο το τελευταίο επαληθεύσιμο στίγμα του πλοίου. Η περιοχή του χαιρετισμού επιλέγεται ανεξάρτητα, ακόμη και «χωρίς περιοχή».</p></div><div className="sea-side-card"><ShieldCheck size={21}/><h3>Στην ίδια συσκευή</h3><p>Εναλλάσσεις οικογένεια και πλήρωμα στον ίδιο browser. Ο χαιρετισμός δεν αποστέλλεται ούτε αποθηκεύεται στον server.</p></div><button className="sea-switch" onClick={()=>setView('crew')}>Πλευρά πληρώματος <ArrowRight size={16}/></button></aside></div>
    : <div className="sea-layout"><div className="sea-main"><section className="sea-card sea-compose"><div className="sea-card-heading"><span className="sea-card-icon sea-heart"><Heart size={19}/></span><div><span className="sea-eyebrow">ΕΝΑ ΑΓΓΙΓΜΑ</span><h2>Στείλε ένα σημάδι ότι είσαι καλά</h2></div></div><p className="sea-compose-intro">Επίλεξε μια σύντομη φράση ή γράψε τη δική σου. Εδώ βλέπεις το αποτέλεσμα στην ίδια συσκευή.</p>
      <span className="sea-label">Περίσταση</span><div className="sea-choice">{(Object.keys(recommended) as Context[]).map(item=><button key={item} className={context===item?'chosen':''} onClick={()=>chooseContext(item)}>{item}</button>)}</div>
      <label className="sea-label" htmlFor="sea-region">Περιοχή που θέλεις να αναφέρεις στον χαιρετισμό</label><select id="sea-region" className="sea-input" value={region} onChange={e=>setRegion(e.target.value)}>{regions.map(item=><option key={item}>{item}</option>)}</select>
      <p className="sea-only-preview">{suggestion && !stale ? <>Πρόταση από το τελευταίο στίγμα πλοίου: <button className="sea-link-button" onClick={()=>setRegion(suggestion)}>{suggestion}</button>. Επίλεξέ την μόνο αν θέλεις να την αναφέρεις.</> : 'Δεν προτείνεται περιοχή από πρόσφατο στίγμα. Επίλεξε γενική θάλασσα ή χωρίς περιοχή.'}</p>
      <span className="sea-label">Έτοιμος χαιρετισμός <small>· Πρόταση: {recommended[context]}</small></span><div className="sea-phrases">{templates.map(item=><button key={item} className={template===item&&!custom?'chosen':''} onClick={()=>{setTemplate(item);setCustom('');}}>{item}</button>)}</div>
      <label className="sea-label" htmlFor="sea-custom">Ή γράψε κάτι δικό σου (προαιρετικό)</label><textarea id="sea-custom" className="sea-input" rows={2} maxLength={180} placeholder="Μέχρι δύο σύντομες γραμμές…" value={custom} onChange={e=>setCustom(e.target.value)}/>
      <div className="sea-preview"><small>Πώς θα το δει η οικογένεια</small><strong>«{greetingText}»</strong><span>{region} · {dateGreece(now)} (ώρα Ελλάδας)</span></div><button className="sea-primary" onClick={preview}><Heart size={17}/> Δες το στην οικογενειακή προβολή</button><p className="sea-only-preview">Η προεπισκόπηση υπάρχει μόνο σε αυτή τη συνεδρία browser. Δεν γίνεται πραγματική αποστολή.</p>
    </section>{vessel}</div><aside className="sea-side"><div className="sea-side-card"><ShieldCheck size={21}/><h3>Ο χαιρετισμός δεν είναι AIS</h3><p>Η επιλογή θάλασσας περιγράφει το μήνυμα, όχι την επαληθευμένη θέση του πλοίου. Ο χάρτης κρατά τη δική του πηγή και ώρα.</p></div><div className="sea-side-card"><Anchor size={21}/><h3>Ακριβής ώρα πλοίου</h3><p>Το πλήρωμα μπορεί να επιλέξει τη ζώνη UTC που ακολουθεί στο πλοίο. Η επιλογή αποθηκεύεται μόνο σε αυτή τη συσκευή.</p></div></aside></div>}
  </div>;
}
