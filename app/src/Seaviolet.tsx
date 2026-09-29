import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Anchor, ArrowRight, Clock3, Heart, MapPin, MessageCircle, Radio, ShieldCheck, Ship, X } from 'lucide-react';
import './Seaviolet.css';

type View = 'family' | 'crew';
type Context = 'Εν πλω' | 'Αγκυροβολημένο' | 'Άφιξη' | 'Αναχώρηση' | 'Νύχτα';
type Greeting = { text: string; area: string; time: Date };
const greetingHistoryKey = 'liakos-greeting-history-v1';
const parseGreetingItems = (items: unknown): Greeting[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const entry = item as Record<string, unknown>;
    return { text: String(entry.text ?? '').slice(0, 180), area: String(entry.area ?? 'Χωρίς περιοχή'), time: new Date(String(entry.time ?? '')) };
  }).filter((item) => item.text.trim() && Number.isFinite(item.time.getTime())).slice(0, 5);
};
const greetingAreaLabel = (area: string) => area && area !== 'Χωρίς κοινοποίηση περιοχής' && area !== 'Χωρίς περιοχή' ? ` · ${area}` : '';
const readGreetingHistory = (): Greeting[] => {
  try {
    const raw = window.localStorage.getItem(greetingHistoryKey);
    return parseGreetingItems(raw ? JSON.parse(raw) : []);
  } catch { return []; }
};
type Position = { mmsi: number; latitude: number; longitude: number; observedAt: string; source: string; speedKnots?: number; course?: number; heading?: number; destination?: string; eta?: string };
type VesselFields = Record<string, boolean>;
const defaultVesselFields: VesselFields = { identity:true, technical:true, status:true, destination:true, course:true, clock:true, position:true, route:true, stops:true, source:true };
const templates = ['Καλημέρα από…', 'Χαιρετισμούς από…', 'Όλα καλά από…', 'Καλή θάλασσα από…', 'Μια καληνύχτα από…', 'Με τον νου στο σπίτι από…', 'Στέλνω έναν χαιρετισμό από…'];
const seaQuotes = [{text:'Στην πλώρη ανοίγει ο ορίζοντας· κράτα ήσυχο το τιμόνι.',author:'Liakos εν πλω',work:'Πρωτότυπη φράση',year:'2026'},{text:'Ο πόντος δεν υπόσχεται δρόμο· ζητά να τον διαβάσεις.',author:'Liakos εν πλω',work:'Πρωτότυπη φράση',year:'2026'},{text:'Όταν πέσει η νύχτα, η γέφυρα μετρά χρόνο, φώτα και σιωπή.',author:'Liakos εν πλω',work:'Πρωτότυπη φράση',year:'2026'},{text:'Το ταξίδι συνεχίζεται με μικρές διορθώσεις και καθαρό βλέμμα.',author:'Ελεύθερη απόδοση σε ύφος Ν. Καββαδία',work:'Δεν είναι αυτούσιο απόσπασμα',year:'2026'},{text:'Η θάλασσα ανοίγει χώρο σε όποιον ξέρει να περιμένει.',author:'Liakos εν πλω',work:'Πρωτότυπη φράση',year:'2026'},{text:'Ἐπὶ οἴνοπα πόντον',author:'Όμηρος',work:'Οδύσσεια',year:'περ. 8ος αι. π.Χ.'}];
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
const dailySeaNotes = [
  {title:'Σήμερα στη θάλασσα',text:'Ο άνεμος, το κύμα και η ορατότητα αλλάζουν συνεχώς· η ήρεμη παρατήρηση κρατά καθαρή την εικόνα του ταξιδιού.',source:'Θαλάσσια παρατήρηση'},
  {title:'Ορίζοντας και καιρός',text:'Η θάλασσα δείχνει νωρίς τις αλλαγές του καιρού: βλέμμα στον ορίζοντα, έλεγχος του κύματος και χρόνος για ασφαλή προσαρμογή.',source:'Ναυτική πρακτική'},
  {title:'Ρυθμός ταξιδιού',text:'Μικρές, έγκαιρες διορθώσεις κρατούν το ταξίδι ομαλό και αφήνουν χώρο για ασφαλείς επιλογές όταν αλλάξουν οι συνθήκες.',source:'Βασικές αρχές πλου'}
];
const dailyLessons = [
  {title:'Σχεδιασμός πλου: από την αξιολόγηση στην παρακολούθηση',steps:['Συγκεντρώστε επίσημους χάρτες, προειδοποιήσεις, καιρό, βάθη και περιορισμούς της περιοχής.','Χαράξτε ασφαλή σκέλη με όρια XTD, εναλλακτικά περάσματα και σαφή σημεία ελέγχου.','Ενημερώστε τη γέφυρα και παρακολουθήστε διαρκώς την πραγματική θέση σε σχέση με το σχέδιο.'],question:'Ποια είναι η σωστή ακολουθία ενός passage plan;',options:['Αξιολόγηση → σχεδιασμός → εκτέλεση → παρακολούθηση','Χάρτης → προορισμός → αυτόματος πλους → άφιξη'],answer:'Η ασφαλής λογική είναι αξιολόγηση, σχεδιασμός, εκτέλεση και συνεχής παρακολούθηση.',hint:'Το σχέδιο δεν τελειώνει όταν χαραχθεί· συνεχίζεται με έλεγχο της πραγματικής πορείας.',source:'Bowditch · MCA OOW syllabus · IMO Model Course 7.03'},
  {title:'Παρατήρηση και διασταύρωση',steps:['Κρατήστε καθαρή εικόνα του ορίζοντα, του καιρού και της κίνησης γύρω από το πλοίο.','Ελέγξτε κάθε σημαντική ένδειξη με δεύτερη ανεξάρτητη παρατήρηση πριν από απόφαση.','Καταγράψτε την αλλαγή και ενημερώστε έγκαιρα την ομάδα της γέφυρας.'],question:'Τι βοηθά περισσότερο όταν μια ένδειξη δεν συμφωνεί με την εικόνα;',options:['Ήρεμη διασταύρωση με δεύτερη παρατήρηση','Να αγνοηθεί μέχρι να αλλάξει μόνη της'],answer:'Η ήρεμη διασταύρωση και η κοινή εικόνα μειώνουν τον κίνδυνο μιας λανθασμένης απόφασης.',hint:'Μια ένδειξη αποκτά αξία όταν συμφωνεί με την παρατήρηση και το συνολικό πλαίσιο.',source:'Bowditch · Bridge Procedures Guide'},
  {title:'ECDIS: ασφάλεια πριν από την ευκολία',steps:['Χρησιμοποιήστε επίσημες και ενημερωμένες ENC και ελέγξτε την κλίμακα του χάρτη.','Ρυθμίστε safety contour, safety depth, ρηχά νερά και όρια απόκλισης από τη διαδρομή.','Ελέγξτε κάθε σκέλος και παρακολουθήστε cross-track error και θέση με ανεξάρτητη διασταύρωση.'],question:'Ποια ρύθμιση βοηθά πρώτα να εντοπιστούν επικίνδυνα ρηχά νερά;',options:['Το safety contour μαζί με το safety depth','Η αλλαγή χρωμάτων του χάρτη'],answer:'Το safety contour και το safety depth συνδέουν την απεικόνιση με τα βυθίσματα ασφαλείας του πλου.',hint:'Οι ρυθμίσεις εμφάνισης δεν αντικαθιστούν τις ρυθμίσεις βάθους και τα όρια ασφαλείας.',source:'Bowditch · IMO ECDIS Model Course 1.27 · MCA OOW syllabus'},
  {title:'ARPA: CPA και TCPA με κρίση',steps:['Το CPA δείχνει την ελάχιστη απόσταση προσέγγισης και το TCPA τον χρόνο μέχρι εκείνο το σημείο.','Περιμένετε σταθερό tracking και ελέγξτε τη σχετική κίνηση του στόχου.','Χρησιμοποιήστε τις ενδείξεις ως βοήθημα· η απόφαση παραμένει ευθύνη της γέφυρας.'],question:'Τι περιγράφουν μαζί CPA και TCPA;',options:['Πόσο κοντά και σε πόσο χρόνο μπορεί να περάσει ο στόχος','Το λιμάνι προορισμού και την ώρα άφιξης'],answer:'Το CPA είναι η προβλεπόμενη ελάχιστη απόσταση και το TCPA ο χρόνος μέχρι αυτήν.',hint:'Οι δείκτες σύγκρουσης αφορούν τη σχετική κίνηση, όχι τον δηλωμένο προορισμό του πλοίου.',source:'IMO Resolution A.482(XII) · ARPA training guidance'},
  {title:'Ομάδα γέφυρας: κοινή εικόνα και διασταύρωση',steps:['Πριν από κρίσιμο σκέλος, συμφωνήστε πορεία, κινδύνους, όρια και εναλλακτικές.','Μοιράστε σαφείς ρόλους και κρατήστε ανοιχτή επικοινωνία στη γέφυρα.','Αμφισβητήστε ήρεμα μια ένδειξη που δεν συμφωνεί με την εικόνα και καταγράψτε την απόφαση.'],question:'Ποια πρακτική μειώνει περισσότερο τον κίνδυνο ενός σφάλματος στη γέφυρα;',options:['Κοινή εικόνα, σαφείς ρόλοι και ανεξάρτητο cross-check','Να ακολουθεί ένας χειριστής όλες τις ενδείξεις χωρίς συζήτηση'],answer:'Η ομαδική εικόνα και το cross-check επιτρέπουν να εντοπιστεί έγκαιρα μια λανθασμένη ένδειξη ή υπόθεση.',hint:'Η αυτοματοποίηση βοηθά, αλλά η ασφαλής ναυσιπλοΐα χρειάζεται επικοινωνία και ανθρώπινη κρίση.',source:'IMO Model Course 1.22 · Bridge Procedures Guide'}
];
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
type NavigationContext = { area: string; description: string; radiusNm: number };
function navigationContext(lat: number, lon: number): NavigationContext {
  if (lat >= 35 && lat <= 39.5 && lon >= -2.5 && lon <= 4.5) return { area: 'Δυτική Μεσόγειος', description: 'Πλέει σε ανοιχτή θάλασσα δυτικά της Αλγερίας', radiusNm: 100 };
  if (lat >= 35.5 && lat <= 41.5 && lon >= 4.5 && lon <= 18) return { area: 'Κεντρική Μεσόγειος', description: 'Πλέει σε ανοιχτή θάλασσα της Κεντρικής Μεσογείου', radiusNm: 100 };
  if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 36) return { area: 'Μεσόγειος', description: 'Πλέει σε ανοιχτά νερά της Μεσογείου', radiusNm: 100 };
  const broad = seaSuggestion(lat, lon) ?? 'Ανοιχτή θάλασσα';
  return { area: broad, description: `Πλέει σε ανοιχτά νερά της περιοχής ${broad}`, radiusNm: 100 };
}
type RoutePoint = [number, number];
const RECENT_FIX_MARKERS = 24;
function routeBearing(a: RoutePoint, b: RoutePoint) {
  const rad = Math.PI / 180;
  const lat1 = a[0] * rad;
  const lat2 = b[0] * rad;
  const dLon = (b[1] - a[1]) * rad;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function addDirectionArrows(map: L.Map, route: RoutePoint[], color: string, maxArrows = 2) {
  if (route.length < 2) return;
  const step = Math.max(1, Math.floor((route.length - 1) / (maxArrows + 1)));
  for (let index = step; index < route.length; index += step) {
    const before = route[index - 1];
    const after = route[index];
    const angle = routeBearing(before, after) - 90;
    L.marker(route[index], {
      icon: L.divIcon({
        className: 'route-direction-icon',
        html: `<span style="color:${color};transform:rotate(${angle}deg)">➤</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      interactive: false,
    }).addTo(map);
  }
}
function nauticalMiles(a: RoutePoint, b: RoutePoint) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const lat1 = a[0] * rad;
  const lat2 = b[0] * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3440.065 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function formatVoyageTime(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} λεπτά`;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes ? `${whole} ώρες ${minutes}′` : `${whole} ώρες`;
}
function nearestRouteIndex(route: RoutePoint[], target: RoutePoint, from: number) {
  let best = from;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = from; i < route.length; i += 1) {
    const distance = nauticalMiles(route[i], target);
    if (distance < bestDistance) { best = i; bestDistance = distance; }
  }
  return best;
}
function addTimedRouteSegments(
  map: L.Map,
  route: RoutePoint[],
  checkpoints: RoutePoint[],
  labels: string[],
  color: string,
  dashArray: string | undefined,
  speedKnots: number,
) {
  if (route.length < 2 || checkpoints.length < 2) return;
  let start = 0;
  for (let i = 0; i < checkpoints.length - 1; i += 1) {
    const end = nearestRouteIndex(route, checkpoints[i + 1], start + 1);
    if (end <= start) continue;
    const segment = route.slice(start, end + 1);
    const distance = segment.slice(1).reduce((sum, point, index) => sum + nauticalMiles(segment[index], point), 0);
    const hours = distance / Math.max(1, speedKnots);
    L.polyline(segment, { color, weight: dashArray ? 3 : 4, opacity: 0.94, dashArray, lineCap: 'round' })
      .addTo(map)
      .bindTooltip(`${labels[i]}<br/><strong>${Math.round(distance)} ν.μ.</strong> · περίπου <strong>${formatVoyageTime(hours)}</strong>`, { sticky: true });
    addDirectionArrows(map, segment, color, 1);
    start = end;
  }
}
function VesselMap({ position, showRoute }: { position: Position | null; showRoute: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const nauticalLayerRef = useRef<L.TileLayer | null>(null);
  const nauticalRadiusRef = useRef<L.Circle | null>(null);
  const suppressAutoFitRef = useRef(false);
  const [nauticalVisible, setNauticalVisible] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const toggleMapExpanded = async () => {
    const wrapper = element.current?.parentElement;
    try {
      if (!document.fullscreenElement && wrapper?.requestFullscreen) {
        await wrapper.requestFullscreen();
        setMapExpanded(true);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setMapExpanded(false);
      } else {
        setMapExpanded((expanded) => !expanded);
      }
    } catch {
      setMapExpanded((expanded) => !expanded);
    }
    if (position) {
      suppressAutoFitRef.current = true;
      window.setTimeout(() => mapRef.current?.setView([position.latitude, position.longitude], 6, { animate: false }), 180);
    }
    window.setTimeout(() => { window.dispatchEvent(new Event('resize')); mapRef.current?.invalidateSize({ animate: false }); }, 160);
    window.setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 520);
  };
  useEffect(() => {
    const onFullscreenChange = () => setMapExpanded(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  useEffect(() => {
    if (!element.current) return;
    const destination: RoutePoint = [-7.2353, 11.2889];
    const map = L.map(element.current, { zoomControl: true }).setView(
      position ? [position.latitude, position.longitude] : [35, 17],
      position ? 6 : 3,
    );
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);
    const actualColor = '#147fba';
    const reconstructedColor = '#bd8a45';
    const projectedColor = '#d39a3b';
    const boundsPoints: RoutePoint[] = [];
    const actualLines: L.Polyline[] = [];
    let userInteracted = false;
    const markUserInteraction = () => { userInteracted = true; };
    map.on('zoomstart movestart dragstart', markUserInteraction);
    const addLine = (points: RoutePoint[], color: string, dashArray: string | undefined, tooltip: string, arrows = false) => {
      if (points.length < 2) return;
      if (!dashArray) {
        L.polyline(points, { color: '#8bd2ed', weight: 17, opacity: 0.46, lineCap: 'round', interactive: false }).addTo(map);
      }
      const line = L.polyline(points, { color, weight: dashArray ? 3 : 8, opacity: dashArray ? 0.82 : 1, dashArray, lineCap: 'round' })
        .addTo(map).bindTooltip(tooltip, { sticky: true });
      if (!dashArray) actualLines.push(line);
      if (arrows) addDirectionArrows(map, points, color, 1);
      boundsPoints.push(...points);
    };
    const addGapMarker = (point: RoutePoint, label: string) => {
      L.circleMarker(point, { radius: 5, color: reconstructedColor, weight: 2, fillColor: '#fffaf1', fillOpacity: 1 })
        .addTo(map).bindTooltip(label, { direction: 'top', offset: [0, -6] });
      boundsPoints.push(point);
    };
    const bearingToDestination = position ? (() => {
      const lat1 = position.latitude * Math.PI / 180;
      const lat2 = destination[0] * Math.PI / 180;
      const dLon = (destination[1] - position.longitude) * Math.PI / 180;
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    })() : 245;
    const vesselIcon = (course: number) => L.divIcon({
      className: 'ship-map-icon',
      html: `<span style="transform:rotate(${course - 90}deg)">➤</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    let vesselMarker: L.Marker | null = null;
    if (position) {
      const initialCourse = position.course ?? position.heading ?? bearingToDestination;
      vesselMarker = L.marker([position.latitude, position.longitude], { icon: vesselIcon(initialCourse) }).addTo(map);
      vesselMarker.bindPopup(`SEAVIOLET · τελευταίο στίγμα · πορεία ${Math.round(initialCourse)}°${position.course != null ? ' · COG AIS' : position.heading != null ? ' · heading AIS' : ' · προσωρινή κατεύθυνση προς προορισμό'}`);
      boundsPoints.push([position.latitude, position.longitude]);
    }
    const anchors: Array<{ point: RoutePoint; label: string }> = [
      { point: [34.67, 33.04], label: 'Λιμένας Λεμεσού · σημείο αναχώρησης' },
      { point: [36.51, 23.42], label: 'Νεάπολη Πελοποννήσου · σημείο αναφοράς' },
    ];
    const anchorMarkers = anchors.map(({ point, label }) => {
      const marker = L.marker(point, {
        icon: L.divIcon({
          className: 'anchor-map-icon',
          html: '<span>⚓</span>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(map).bindTooltip(label, { direction: 'top', offset: [0, -12], permanent: true });
      return { point, label, marker };
    });
    L.marker(destination, {
      icon: L.divIcon({
        className: 'destination-map-icon',
        html: '<span>◆</span>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(map).bindTooltip('KAOMBO NORTE · δηλωμένος προορισμός', { direction: 'top', offset: [0, -12], permanent: true });

    const toRoutePoint = (item: Position): RoutePoint => [item.latitude, item.longitude];
    const safeRoutePoints = (items: unknown): RoutePoint[] => Array.isArray(items)
      ? items.filter((p: any) => Array.isArray(p) && p.length === 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map((p: any) => [Number(p[0]), Number(p[1])] as RoutePoint)
      : [];
    const segmentDistance = (points: RoutePoint[]) => points.slice(1).reduce((sum, point, index) => sum + nauticalMiles(points[index], point), 0);
    const controller = new AbortController();
    const drawTracks = async () => {
      try {
        const historyData = await fetch('/api/v1/vessel/seaviolet/history?hours=168', { signal: controller.signal, cache: 'no-store' }).then(r => r.ok ? r.json() : null);
        const historyPoints: Position[] = (historyData?.points ?? [])
          .map((item: any) => validPosition({ ...item, mmsi: historyData?.mmsi ?? 248554000 }))
          .filter((item: Position | null): item is Position => Boolean(item))
          .sort((a: Position, b: Position) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());
        if (position && !historyPoints.some(item => item.observedAt === position.observedAt)) historyPoints.push(position);
        historyPoints.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());
        if (vesselMarker && position && position.course == null && position.heading == null && historyPoints.length >= 2) {
          const before = historyPoints[historyPoints.length - 2];
          const after = historyPoints[historyPoints.length - 1];
          const movementCourse = routeBearing(toRoutePoint(before), toRoutePoint(after));
          vesselMarker.setIcon(vesselIcon(movementCourse));
          vesselMarker.bindPopup(`SEAVIOLET · τελευταίο στίγμα · πορεία ${Math.round(movementCourse)}° · υπολογισμός από τα δύο τελευταία AIS στίγματα`);
        }
        historyPoints.slice(-RECENT_FIX_MARKERS).forEach(item => {
          L.circleMarker(toRoutePoint(item), { radius: 6.5, color: '#fff', weight: 2.4, fillColor: actualColor, fillOpacity: 1 })
            .addTo(map).bindTooltip(`AIS · ${dateGreece(new Date(item.observedAt))}`, { direction: 'top', offset: [0, -5] });
        });
        const durationText = (from?: string, to?: string) => from && to ? formatVoyageTime(Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 3600000)) : 'δεν υπολογίζεται';
        anchorMarkers.forEach(({ point, label, marker }) => {
          const nearby = historyPoints.filter(item => nauticalMiles(point, toRoutePoint(item)) <= 12);
          if (!nearby.length) {
            marker.bindPopup(`<strong>${label}</strong><br/><span class="sea-map-popup-muted">Δεν υπάρχουν ακόμη αρκετά AIS δεδομένα για να υπολογιστούν άφιξη, αναχώρηση και παραμονή.</span>`);
            return;
          }
          const arrival = nearby[0];
          const departure = nearby.length > 1 ? nearby[nearby.length - 1] : null;
          const duration = durationText(arrival.observedAt, departure?.observedAt);
          const stopped = nearby.some(item => item.speedKnots != null && item.speedKnots <= 1.5) || (departure && (new Date(departure.observedAt).getTime() - new Date(arrival.observedAt).getTime()) >= 30 * 60 * 1000);
          const eventTitle = stopped ? 'Αυτόματη αναγνώριση στάσης' : 'Πέρασμα από την περιοχή';
          marker.bindPopup(`<strong>${label}</strong><br/><span class="sea-map-popup-title">${eventTitle}</span><br/>Άφιξη: <strong>${dateGreece(new Date(arrival.observedAt))}</strong><br/>${departure ? `Αναχώρηση: <strong>${dateGreece(new Date(departure.observedAt))}</strong><br/>Παραμονή: <strong>${duration}</strong>` : 'Αναχώρηση: δεν έχει επιβεβαιωθεί ακόμη'}<br/><small>Υπολογισμός από τα διαθέσιμα AIS στίγματα σε ακτίνα 12 ν.μ.</small>`);
        });
        const departure: RoutePoint = [34.67, 33.04];
        const reconstructed = async (from: RoutePoint, to: RoutePoint, fromLabel: string, toLabel: string, fromTime?: string, toTime?: string) => {
          const params = new URLSearchParams({ fromLatitude: String(from[0]), fromLongitude: String(from[1]), toLatitude: String(to[0]), toLongitude: String(to[1]) });
          const data = await fetch(`/api/v1/vessel/seaviolet/route?${params.toString()}`, { signal: controller.signal, cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
          const route = safeRoutePoints(data?.route);
          if (route.length < 2) return;
          const distance = segmentDistance(route);
          const duration = fromTime && toTime ? formatVoyageTime(Math.max(0, (new Date(toTime).getTime() - new Date(fromTime).getTime()) / 3600000)) : 'μη διαθέσιμος χρόνος';
          addLine(route, reconstructedColor, '7 9', `<strong>Θεωρητική θαλάσσια ανακατασκευή</strong><br/>Χωρίς AIS δεδομένα: ${fromLabel} → ${toLabel}<br/><strong>${Math.round(distance)} ν.μ.</strong> · διάστημα ${duration}`, true);
          addGapMarker(route[0], `Τέλος προηγούμενου γνωστού σημείου · ${fromLabel}`);
          addGapMarker(route[route.length - 1], `Έναρξη επόμενου γνωστού σημείου · ${toLabel}`);
        };
        if (showRoute) {
          const first = historyPoints[0];
          if (first) {
            const firstPoint = toRoutePoint(first);
            if (nauticalMiles(departure, firstPoint) > 8) await reconstructed(departure, firstPoint, 'Λεμεσός', 'πρώτο επιβεβαιωμένο AIS', undefined, first.observedAt);
          }
          for (let i = 1; i < historyPoints.length; i += 1) {
            const before = historyPoints[i - 1];
            const after = historyPoints[i];
            const from = toRoutePoint(before), to = toRoutePoint(after);
            const distance = nauticalMiles(from, to);
            const hours = Math.max(0, (new Date(after.observedAt).getTime() - new Date(before.observedAt).getTime()) / 3600000);
            const actual = hours <= 2 && distance <= 80;
            if (actual) {
              addLine([from, to], actualColor, undefined, `<strong>Επιβεβαιωμένη διαδρομή AIS</strong><br/>${dateGreece(new Date(before.observedAt))} → ${dateGreece(new Date(after.observedAt))}<br/><strong>${Math.round(distance)} ν.μ.</strong> · ${formatVoyageTime(hours)}`, i % 12 === 1);
            } else {
              await reconstructed(from, to, dateGreece(new Date(before.observedAt)), dateGreece(new Date(after.observedAt)), before.observedAt, after.observedAt);
            }
          }
          const current = position ? toRoutePoint(position) : historyPoints.length ? toRoutePoint(historyPoints[historyPoints.length - 1]) : null;
          if (current) {
            const routeData = await fetch(`/api/v1/vessel/seaviolet/route?latitude=${current[0]}&longitude=${current[1]}`, { signal: controller.signal, cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
            const routedProjected = safeRoutePoints(routeData?.projected);
            if (routedProjected.length > 1) {
              const speed = Number(position?.speedKnots);
              const speedKnots = Number.isFinite(speed) && speed > 1 ? speed : 12;
              boundsPoints.push(...routedProjected);
              const projectedCheckpoints: RoutePoint[] = [current, [35.9, -5.5], [20, -14], destination];
              addTimedRouteSegments(map, routedProjected, projectedCheckpoints, ['Τρέχον στίγμα → Γιβραλτάρ', 'Γιβραλτάρ → Ατλαντικός', 'Ατλαντικός → KAOMBO NORTE'], projectedColor, '3 9', speedKnots);
              const last = routedProjected.length - 1;
              const finalDistance = nauticalMiles(routedProjected[last - 1], routedProjected[last]);
              L.polyline([routedProjected[last - 1], routedProjected[last]], { color: projectedColor, weight: 4, opacity: 0.9, dashArray: '3 9', lineCap: 'round' })
                .addTo(map)
                .bindTooltip(`<strong>Προβλεπόμενη πορεία</strong><br/>Προς KAOMBO NORTE · ${Math.round(finalDistance)} ν.μ. · περίπου <strong>${formatVoyageTime(finalDistance / Math.max(1, speedKnots))}</strong>`, { sticky: true });
            }
          }
        }
        actualLines.forEach(line => line.bringToFront());
        if (!userInteracted && !suppressAutoFitRef.current && boundsPoints.length > 1) map.fitBounds(L.latLngBounds(boundsPoints).pad(0.12));
      } catch { /* The map keeps the markers and legend when the route service is unavailable. */ }
    };
    void drawTracks();
    const timer = window.setTimeout(() => map.invalidateSize(), 50);
    return () => { controller.abort(); window.clearTimeout(timer); map.off('zoomstart movestart dragstart', markUserInteraction); map.remove(); mapRef.current = null; nauticalLayerRef.current = null; nauticalRadiusRef.current = null; suppressAutoFitRef.current = false; };
  }, [position, showRoute]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (nauticalLayerRef.current) { map.removeLayer(nauticalLayerRef.current); nauticalLayerRef.current = null; }
    if (nauticalRadiusRef.current) { map.removeLayer(nauticalRadiusRef.current); nauticalRadiusRef.current = null; }
    if (nauticalVisible) {
      nauticalLayerRef.current = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { attribution: '© OpenSeaMap contributors', maxZoom: 18, opacity: 0.88, zIndex: 300 }).addTo(map);
      if (position) {
        const context = navigationContext(position.latitude, position.longitude);
        nauticalRadiusRef.current = L.circle([position.latitude, position.longitude], { radius: context.radiusNm * 1852, color: '#147f72', weight: 1.5, dashArray: '5 7', opacity: 0.6, fillColor: '#147f72', fillOpacity: 0.035, interactive: false }).addTo(map);
      }
    }
  }, [nauticalVisible, position]);
  return <div className={`sea-map-wrap${mapExpanded ? ' is-expanded' : ''}`}><div className="sea-map" ref={element} role="img" aria-label={position ? 'Χάρτης με επιβεβαιωμένη AIS διαδρομή, θεωρητικές ανακατασκευές κενών, προβλεπόμενη πορεία και προαιρετικά ναυτικά σημεία του SEAVIOLET' : 'Χάρτης χωρίς επιβεβαιωμένο στίγμα του πλοίου'} /><div className="sea-map-actions"><button type="button" className="sea-map-expand" onClick={() => void toggleMapExpanded()} aria-pressed={mapExpanded}>{mapExpanded ? '↙ Επαναφορά' : '↗ Πλήρης οθόνη'}</button></div><div className="sea-map-bottom-menu" aria-label="Επίπεδα χάρτη"><div className="sea-map-bottom-heading"><strong>Επίπεδα χάρτη</strong><span>Πρόσθετες πληροφορίες για την περιοχή του πλοίου</span></div><button type="button" className={`sea-map-layer-row${nauticalVisible ? ' active' : ''}`} onClick={() => setNauticalVisible((visible) => !visible)} aria-pressed={nauticalVisible}><span className="sea-nautical-toggle-dot" /><span><strong>Ναυτικά σημεία</strong><small>Φάροι, σημαντήρες, αγκυροβόλια και σημεία ναυσιπλοΐας · ακτίνα {position ? navigationContext(position.latitude, position.longitude).radiusNm : 100} ν.μ.</small></span><em>{nauticalVisible ? 'Ενεργό' : 'Ανενεργό'}</em></button><p>Το μενού μπορεί να εμπλουτιστεί αργότερα με καιρό, προειδοποιήσεις και άλλα επίπεδα δεδομένων.</p></div>{showRoute && <div className="sea-map-legend" aria-label="Υπόμνημα διαδρομής"><div><i className="sea-legend-line actual" /><span><strong>Επιβεβαιωμένο AIS</strong><small>πραγματικά στίγματα</small></span></div><div><i className="sea-legend-line reconstructed" /><span><strong>Θεωρητική ανακατασκευή</strong><small>κενό χωρίς AIS δεδομένα</small></span></div><div><i className="sea-legend-line projected" /><span><strong>Προβλεπόμενη πορεία</strong><small>προς δηλωμένο προορισμό</small></span></div><div><i className="sea-legend-line nautical" /><span><strong>Ναυτικά σημεία</strong><small>προαιρετικό OpenSeaMap επίπεδο</small></span></div></div>}{!position && <div className="sea-map-empty"><MapPin size={21}/><strong>Δεν έχει συνδεθεί στίγμα AIS</strong><span>Ο χάρτης δεν δείχνει θέση πλοίου μέχρι να λάβουμε καταγραφή με ώρα και πηγή.</span></div>}</div>;
}function ExternalVesselPosition() {
  return <div className="sea-external-position"><MapPin size={25}/><div><strong>Δες τη νεότερη θέση στο VesselFinder</strong><p>Η δική μας ροή AIS δεν έχει λάβει ακόμη στίγμα για το SEAVIOLET. Το VesselFinder διαθέτει ανεξάρτητα δεδομένα για τη θέση, τον προορισμό και την εκτιμώμενη άφιξη· άνοιξέ τα απευθείας στην υπηρεσία του.</p><a href="https://www.vesselfinder.com/vessels/details/9790983" target="_blank" rel="noopener noreferrer">Άνοιξε τη σελίδα του SEAVIOLET στο VesselFinder ↗</a><p className="sea-alternative-source">Δεύτερη ανεξάρτητη πηγή: <a href="https://www.myshiptracking.com/vessels/seaviolet-mmsi-248554000-imo-9790983" target="_blank" rel="noopener noreferrer">MyShipTracking ↗</a>. Έλεγξε την ώρα του στίγματος· μπορεί να είναι παλαιότερο.</p></div></div>;
}
function validPosition(raw: unknown): Position | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string,unknown>;
  const lat = Number(p.latitude), lon = Number(p.longitude), date = new Date(String(p.observedAt));
  if (p.mmsi !== 248554000 || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180 || !Number.isFinite(date.getTime()) || date.getTime()>Date.now()+600000 || typeof p.source !== 'string' || !p.source.trim()) return null;
  return { mmsi:248554000, latitude:lat, longitude:lon, observedAt:date.toISOString(), source:p.source, speedKnots:typeof p.speedKnots==='number' ? p.speedKnots : undefined, course:typeof p.course==='number' ? p.course : undefined, heading:typeof p.heading==='number' ? p.heading : undefined, destination:typeof p.destination==='string' ? p.destination : undefined, eta:typeof p.eta==='string' ? p.eta : undefined };
}
export function Seaviolet() {
  const [view,setView] = useState<View>('family');
  const [context,setContext] = useState<Context>('Εν πλω');
  const [region,setRegion] = useState(regions[0]);
  const [template,setTemplate] = useState(recommended['Εν πλω']);
  const [custom,setCustom] = useState('');
  const [quoteChoice,setQuoteChoice] = useState(false);
  const [history,setHistory] = useState<Greeting[]>(readGreetingHistory);
  const [notice,setNotice] = useState(false);
  const [lessonAnswer,setLessonAnswer] = useState<string | null>(null);
  const [position,setPosition] = useState<Position | null>(null);
  const [vesselFields,setVesselFields] = useState<VesselFields>(defaultVesselFields);
  const [offset,setOffset] = useState<number | null>(() => { const n = Number(window.localStorage.getItem('liakos-ship-utc-offset')); return window.localStorage.getItem('liakos-ship-utc-offset') !== null && Number.isInteger(n) && n >= -12 && n <= 14 ? n : null; });
  const [now,setNow] = useState(new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(t); }, []);
  useEffect(() => { try { window.localStorage.setItem(greetingHistoryKey, JSON.stringify(history)); } catch { /* local storage can be unavailable in private browsing */ } }, [history]);
  useEffect(() => {
    let alive = true;
    const loadGreetings = async () => {
      try {
        const response = await fetch('/api/v1/seaviolet/greetings', { cache:'no-store', credentials:'same-origin' });
        if (!response.ok) return;
        const data = await response.json();
        const remote = parseGreetingItems(data?.items);
        if (remote.length) {
          if (alive) setHistory(remote);
          return;
        }
        // Migrate a message created before server persistence was enabled.
        const local = readGreetingHistory();
        for (const item of [...local].reverse()) {
          await fetch('/api/v1/seaviolet/greetings', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            credentials:'same-origin',
            body:JSON.stringify({ text:item.text, area:item.area, time:item.time.toISOString() }),
          });
        }
        if (!local.length) return;
        const migratedResponse = await fetch('/api/v1/seaviolet/greetings', { cache:'no-store', credentials:'same-origin' });
        const migrated = migratedResponse.ok ? await migratedResponse.json() : null;
        if (alive && Array.isArray(migrated?.items)) setHistory(parseGreetingItems(migrated.items));
      } catch { /* keep the local history if the server is temporarily unavailable */ }
    };
    void loadGreetings();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    fetch('/api/public', { cache:'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.vesselFields) setVesselFields((prev) => ({ ...prev, ...d.vesselFields })); }).catch(() => {});
    let alive = true;
    const read = async () => { try {
      const response = await fetch('/api/v1/vessel/seaviolet', { cache:'no-store', credentials:'same-origin' });
      if (response.ok && alive) setPosition(validPosition(await response.json()));
    } catch { /* AIS feed is optional; keep last known position in the session. */ } };
    void read(); const t = window.setInterval(() => void read(), 60000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  const suggestion = position ? seaSuggestion(position.latitude,position.longitude) : null;
  const navContext = position ? navigationContext(position.latitude, position.longitude) : null;
  const ageHours = position ? Math.max(0, (now.getTime()-new Date(position.observedAt).getTime())/3600000) : Infinity;
  const stale = ageHours > 24;
  const ageLabel = Number.isFinite(ageHours) ? (() => { const minutes = Math.max(0, Math.floor(ageHours * 60)); if (minutes < 2) return 'μόλις τώρα'; if (minutes < 60) return `πριν ${minutes} λεπτά`; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return rest ? `πριν ${hours} ώρες και ${rest} λεπτά` : `πριν ${hours} ώρες`; })() : 'δεν έχει ληφθεί ακόμη';
  const exactPositionTime = position ? dateGreece(new Date(position.observedAt)) : null;
  const seaQuote = seaQuotes[Math.floor(Date.now() / (8 * 60 * 60 * 1000)) % seaQuotes.length];
  const safeRegion = phrases[region] ?? '';
  const greetingText = quoteChoice ? seaQuote.text : (custom.trim() || (safeRegion ? template.replace('…', ' '+safeRegion) : template.replace(' από…','').replace('…','')));
  const chooseContext = (next:Context) => { setContext(next); setTemplate(recommended[next]); setCustom(''); setQuoteChoice(false); };
  const preview = () => {
    const item = { text:greetingText, area:region, time:new Date() };
    setHistory(items => [item, ...items].slice(0, 5));
    setNotice(true);
    setView('family');
    void fetch('/api/v1/seaviolet/greetings', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body:JSON.stringify({ text:item.text, area:item.area, time:item.time.toISOString() }),
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (Array.isArray(data?.items)) setHistory(parseGreetingItems(data.items));
    }).catch(() => {});
  };
  const shipClock = offset === null ? 'Επίλεξε UTC ζώνη του πλοίου' : clock(now,offset)+' (UTC'+(offset>=0?'+':'')+offset+')';
  const difference = offset === null ? 'Απαιτείται η ζώνη ώρας του πλοίου' : (offset-greeceOffset(now) === 0 ? 'Ίδια ώρα με Ελλάδα' : Math.abs(offset-greeceOffset(now))+' ώρες '+(offset>greeceOffset(now)?'μπροστά':'πίσω')+' από Ελλάδα');
  const vesselMovement = position ? [
    position.speedKnots != null ? `${position.speedKnots.toFixed(1)} kn` : '',
    position.course != null ? `πορεία ${Math.round(position.course)}°` : '',
  ].filter(Boolean).join(' · ') : '';
  const vesselAction = !position ? 'Αναμονή για επιβεβαιωμένο στίγμα' : stale ? 'Η τελευταία θέση χρειάζεται ανανέωση' : position.speedKnots != null && position.speedKnots < 1 ? 'Σε στάση ή με πολύ χαμηλή ταχύτητα' : 'Πλέει προς';
  const vesselActionDetail = !position ? 'Η καρτέλα θα ενημερωθεί μόλις φτάσει νέα αναφορά από τη συνδεδεμένη ροή AIS.' : stale ? `Το τελευταίο στίγμα λήφθηκε ${ageLabel}.` : vesselMovement || 'Η συνδεδεμένη ροή επιβεβαιώνει τη θέση του πλοίου.';
  const vesselDestination = position?.destination || 'KAOMBO NORTE';
  const vesselDestinationContext = vesselDestination.toUpperCase().includes('KAOMBO') ? 'Αφρική · Αγκόλα · ανοικτά της Λουάντα' : 'Ήπειρος, χώρα και κοντινή πόλη θα εμφανιστούν όταν επιβεβαιωθούν από την πηγή AIS.';
  const vessel = <section className="sea-card sea-vessel"><div className="sea-card-heading"><span className="sea-card-icon"><Ship size={19}/></span><div><span className="sea-eyebrow">ΤΙ ΚΑΝΕΙ ΤΟ ΠΛΟΙΟ</span><h2>SEAVIOLET</h2></div><span className="sea-availability">{position ? `${ageLabel}${stale ? ' · παλιό' : ''}` : 'Αναμονή στίγματος AIS'}</span></div>
    <div className={`sea-vessel-hero ${position && !stale ? 'is-live' : 'is-muted'}`}>
      <div className="sea-vessel-hero-top"><span className="sea-vessel-live"><span className="sea-vessel-status-dot" />{position && !stale ? 'ΖΩΝΤΑΝΗ ΕΙΚΟΝΑ' : position ? 'ΠΑΛΙΑ ΚΑΤΑΓΡΑΦΗ' : 'ΑΝΑΜΟΝΗ AIS'}</span><span className="sea-vessel-age">{position ? ageLabel : 'χωρίς στίγμα'}</span></div>
      <strong>{vesselAction}</strong>
      <div className="sea-vessel-destination"><span>{vesselDestination}</span><small>{vesselDestinationContext}</small></div>
      <p>{vesselActionDetail}</p>
      {navContext && <div className="sea-vessel-area-context"><MapPin size={15}/><span><small>ΘΑΛΑΣΣΙΑ ΠΕΡΙΟΧΗ</small><strong>{navContext.description}</strong><em>{navContext.area} · ενημέρωση από το τελευταίο AIS στίγμα</em></span></div>}
      <div className="sea-vessel-route" aria-label="Διαδρομή ταξιδιού"><span>Λεμεσός</span><ArrowRight size={14}/><span>Νεάπολη</span><ArrowRight size={14}/><span>{vesselDestination}</span></div>
    </div>
    {vesselFields.identity && <div className="sea-identity">Δεξαμενόπλοιο αργού πετρελαίου · σημαία Μάλτας · κατασκευή 2018</div>}
    {vesselFields.technical && <div className="sea-identity">IMO 9790983 · MMSI 248554000 · διακριτικό 9HA4701</div>}
    <div className="sea-vessel-grid">
      {vesselFields.status && <><div><small>Κατάσταση</small><strong>{position ? (stale ? 'Δεν υπάρχει πρόσφατη επιβεβαίωση' : 'Τελευταία καταγραφή AIS') : 'Δεν έχει παραληφθεί στίγμα'}</strong></div><div><small>Γενική περιοχή στίγματος</small><strong>{position ? (suggestion ?? 'Δεν προσδιορίζεται αξιόπιστα') : 'Μη διαθέσιμη'}</strong></div></>}
      {vesselFields.destination && <><div><small>Προορισμός</small><strong>{position?.destination || 'Μη διαθέσιμος από τη συνδεδεμένη πηγή'}</strong></div><div><small>Εκτιμώμενη άφιξη</small><strong>{position?.eta || 'Μη διαθέσιμη από τη συνδεδεμένη πηγή'}</strong></div></>}
      {vesselFields.course && <div><small>Ταχύτητα / πορεία</small><strong>{position?.speedKnots != null ? `${position.speedKnots.toFixed(1)} kn` : 'Δεν παρέχεται'}{position?.course != null ? ` · ${Math.round(position.course)}°` : ''}</strong></div>}
      {vesselFields.clock && <><div><small>Ώρα Ελλάδας τώρα</small><strong>{clock(now,greeceOffset(now))}</strong></div><div><small>Ώρα πλοίου τώρα</small><strong>{shipClock}</strong><small>{difference}</small></div></>}
    </div>
    {vesselFields.clock && <><label className="sea-label" htmlFor="sea-timezone">Ζώνη ώρας που ακολουθεί το πλοίο (ορίζεται από το πλήρωμα)</label><select id="sea-timezone" className="sea-input" value={offset ?? ''} onChange={e => { const next = e.target.value; setOffset(next === '' ? null : Number(next)); if (next === '') window.localStorage.removeItem('liakos-ship-utc-offset'); else window.localStorage.setItem('liakos-ship-utc-offset',next); }}><option value="">Δεν έχει επιβεβαιωθεί</option>{Array.from({length:27},(_,i)=>i-12).map(v=><option value={v} key={v}>UTC{v>=0?'+':''}{v}</option>)}</select></>}
    <div className="sea-literary-quote"><span className="sea-eyebrow">ΛΟΓΙΑ ΤΗΣ ΘΑΛΑΣΣΑΣ</span><p>«{seaQuote.text}»</p><small>{seaQuote.author} · {seaQuote.work} · {seaQuote.year} · αλλάζει κάθε 8 ώρες</small></div>
    {vesselFields.position && <><h3 className="sea-map-title">{position ? `Στίγμα ${ageLabel} · ${exactPositionTime}` : 'Εξωτερική ενημέρωση πλοίου'}</h3>{position ? <VesselMap position={position} showRoute={vesselFields.route !== false}/> : <ExternalVesselPosition/>}</>}
    {vesselFields.stops && <p className="sea-explain">Περάσματα και στάσεις: Λιμένας Λεμεσού → Νεάπολη Πελοποννήσου → δηλωμένος προορισμός KAOMBO NORTE.</p>}
    {vesselFields.source && <p className="sea-explain"><Radio size={15}/>{position ? <>Καταγράφηκε {dateGreece(new Date(position.observedAt))} (ώρα Ελλάδας) · πηγή: {position.source}. {stale && 'Το στίγμα είναι παλιό και δεν δείχνει τη σημερινή θέση.'}</> : <>Δεν έχουμε παραλάβει ακόμη έγκυρη αναφορά θέσης AIS για το πλοίο. Η εξωτερική σελίδα του VesselFinder μπορεί να εμφανίζει νεότερα δεδομένα από άλλη πηγή. <a href={vesselUrl} target="_blank" rel="noreferrer">Δες το SEAVIOLET στο MarineTraffic</a> για την τελευταία αναφορά της υπηρεσίας.</>}</p>}
    {vesselFields.clock && <p className="sea-explain">Η ώρα πλοίου είναι η επιλεγμένη ζώνη του πληρώματος, όχι εκτίμηση από τη θέση. Τα σταθερά χαρακτηριστικά έχουν ελεγχθεί σε μητρώο πλοίων.</p>}
  </section>;
  const athensDate = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Athens', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  const dayIndex = Number(athensDate.replaceAll('-', ''));
  const daily = dailySeaNotes[dayIndex % dailySeaNotes.length];
  const lesson = dailyLessons[dayIndex % dailyLessons.length];
  return <div className="sea-page"><div className="sea-header"><div><span className="sea-kicker">SEAVIOLET · ΟΙΚΟΓΕΝΕΙΑ & ΠΛΗΡΩΜΑ</span><h1>Liakos εν πλω</h1><p>Το SEAVIOLET και ένας προσωπικός χαιρετισμός, στην ίδια συσκευή.</p></div><div className="sea-header-meta"><span className="sea-demo">Προεπισκόπηση χαιρετισμού</span><div className="sea-last-fix" role="status"><Radio size={16}/><div><strong>{position ? `Το τελευταίο στίγμα ήταν ${ageLabel}` : 'Δεν έχει ληφθεί ακόμη έγκυρο στίγμα AIS'}</strong><span>{exactPositionTime ? `Ακριβής ώρα λήψης: ${exactPositionTime} · ${position?.source}` : 'Η ακριβής ώρα θα εμφανιστεί με την πρώτη έγκυρη καταγραφή.'}</span></div></div></div></div>
    <div className="sea-tabs" role="tablist" aria-label="Προβολή Liakos εν πλω"><button role="tab" aria-selected={view==='family'} className={view==='family'?'selected':''} onClick={()=>setView('family')}><Heart size={17}/> Οικογένεια</button><button role="tab" aria-selected={view==='crew'} className={view==='crew'?'selected':''} onClick={()=>setView('crew')}><Ship size={17}/> Πλήρωμα</button></div>
    {view==='family' ? <div className="sea-layout"><div className="sea-main">
      {notice && <div className="sea-notice" role="status">Ο χαιρετισμός αποθηκεύτηκε στον server του Netcup και εμφανίστηκε στην οικογενειακή προβολή.<button aria-label="Κλείσιμο ενημέρωσης" onClick={()=>setNotice(false)}><X size={15}/></button></div>}
      {vessel}
      <section className="sea-card sea-message"><div className="sea-card-heading"><span className="sea-card-icon sea-heart"><Heart size={19}/></span><div><span className="sea-eyebrow">ΜΑΣ ΕΣΤΕΙΛΕ ΧΑΙΡΕΤΙΣΜΟ</span><h2>Μια κουβέντα από τον Λιάκο</h2></div></div>
      {history.length ? <><p className="sea-greeting">«{history[0].text}»</p><div className="sea-greeting-meta"><Clock3 size={14}/> {dateGreece(history[0].time)} · ώρα Ελλάδας{greetingAreaLabel(history[0].area)}</div></> : <div className="sea-empty"><MessageCircle size={26}/><strong>Δεν υπάρχει προσωπικός χαιρετισμός.</strong><span>Δοκίμασε την πλευρά του πληρώματος στην ίδια συσκευή. Η ώρα του χαιρετισμού είναι ξεχωριστή από την ώρα του τελευταίου στίγματος.</span></div>}</section>
      <div className="sea-history"><h3>Ιστορικό χαιρετισμών</h3>{history.length ? history.map((item,index)=><div key={index}><span>«{item.text}»</span><small>{dateGreece(item.time)} · ώρα Ελλάδας{greetingAreaLabel(item.area)}</small></div>) : <p>Δεν υπάρχουν ακόμη αποθηκευμένοι χαιρετισμοί.</p>}</div>
    </div><aside className="sea-side"><div className="sea-side-card"><MapPin size={21}/><h3>Πραγματική θέση πλοίου</h3><p>Η ένδειξη προέρχεται μόνο από το AIS και δείχνει το τελευταίο στίγμα, την ώρα λήψης και την πορεία όταν υπάρχουν διαθέσιμα δεδομένα.</p></div><div className="sea-side-card"><Radio size={21}/><h3>Ζωντανό μήνυμα από τη θάλασσα</h3><p>Η φράση ανανεώνεται κάθε 8 ώρες και μπορεί να επιλεγεί ως μήνυμα για την οικογένεια.</p><button className="sea-link-button" onClick={()=>setView('crew')}>Άνοιξε την επιλογή</button></div><div className="sea-side-card"><ShieldCheck size={21}/><h3>Χαιρετισμός και ιστορικό</h3><p>Η οικογένεια και το πλήρωμα εναλλάσσονται στον ίδιο browser. Τα τελευταία μηνύματα αποθηκεύονται στον server του Netcup.</p></div><button className="sea-switch" onClick={()=>setView('crew')}>Πλευρά πληρώματος <ArrowRight size={16}/></button></aside></div>
    : <div className="sea-layout"><div className="sea-main"><section className="sea-card sea-compose"><div className="sea-card-heading"><span className="sea-card-icon sea-heart"><Heart size={19}/></span><div><span className="sea-eyebrow">ΕΝΑ ΑΓΓΙΓΜΑ</span><h2>Στείλε ένα σημάδι ότι είσαι καλά</h2></div></div><p className="sea-compose-intro">Επίλεξε μια σύντομη φράση ή γράψε τη δική σου. Το μήνυμα αποθηκεύεται στον server του Netcup και εμφανίζεται στην οικογενειακή προβολή.</p>
      <span className="sea-label">Περίσταση</span><div className="sea-choice">{(Object.keys(recommended) as Context[]).map(item=><button key={item} className={context===item?'chosen':''} onClick={()=>chooseContext(item)}>{item}</button>)}</div>
      <label className="sea-label" htmlFor="sea-region">Περιοχή που θέλεις να αναφέρεις στον χαιρετισμό</label><select id="sea-region" className="sea-input" value={region} onChange={e=>setRegion(e.target.value)}><option value={regions[0]}>{regions[0]}</option>{regionGroups.map(group=><optgroup key={group.label} label={group.label}>{group.entries.map(item=><option value={item.name} key={item.name}>{item.name}</option>)}</optgroup>)}</select>
      <p className="sea-only-preview">{suggestion && !stale ? <>Πρόταση από το τελευταίο στίγμα πλοίου: <button className="sea-link-button" onClick={()=>setRegion(suggestion)}>{suggestion}</button>. Επίλεξέ την μόνο αν θέλεις να την αναφέρεις.</> : 'Δεν προτείνεται περιοχή από πρόσφατο στίγμα. Επίλεξε γενική θάλασσα ή χωρίς περιοχή.'}</p>
      <span className="sea-label">Έτοιμος χαιρετισμός <small>· Πρόταση: {recommended[context]}</small></span><div className="sea-phrases">{templates.map(item=><button key={item} className={template===item&&!custom&&!quoteChoice?'chosen':''} onClick={()=>{setTemplate(item);setCustom('');setQuoteChoice(false);}}>{item}</button>)}<button className={quoteChoice?'chosen':''} onClick={()=>{setQuoteChoice(true);setCustom('');}}>«{seaQuote.text}»</button></div><p className="sea-quote-choice-note">Η φράση της θάλασσας αλλάζει κάθε 8 ώρες και μπορεί να σταλεί ως προσωπικό μήνυμα στην οικογενειακή προβολή.</p>
      <label className="sea-label" htmlFor="sea-custom">Ή γράψε κάτι δικό σου (προαιρετικό)</label><textarea id="sea-custom" className="sea-input" rows={2} maxLength={180} placeholder="Μέχρι δύο σύντομες γραμμές…" value={custom} onChange={e=>{setCustom(e.target.value);setQuoteChoice(false);}}/>
      <div className="sea-preview"><small>Πώς θα το δει η οικογένεια</small><strong>«{greetingText}»</strong><span>{region} · {dateGreece(now)} (ώρα Ελλάδας)</span></div><button className="sea-primary" onClick={preview}><Heart size={17}/> Δες το στην οικογενειακή προβολή</button><p className="sea-only-preview">Το μήνυμα αποθηκεύεται στον server του Netcup και παραμένει στο ιστορικό μετά από ανανέωση.</p>
    </section>{vessel}</div><aside className="sea-side"><div className="sea-side-card"><Radio size={21}/><h3>Ζωντανό μήνυμα από τη θάλασσα</h3><p>Η φράση ανανεώνεται αυτόματα κάθε 8 ώρες και μπορεί να σταλεί ως μήνυμα στην οικογενειακή προβολή.</p><button className="sea-link-button" onClick={()=>{setQuoteChoice(true);setCustom('');window.setTimeout(()=>document.getElementById('sea-custom')?.scrollIntoView({behavior:'smooth',block:'center'}),0);}}>Επίλεξε την τρέχουσα φράση</button></div><div className="sea-side-card"><Anchor size={21}/><h3>Ακριβής ώρα πλοίου</h3><p>Το πλήρωμα μπορεί να επιλέξει τη ζώνη UTC που ακολουθεί στο πλοίο. Η επιλογή αποθηκεύεται μόνο σε αυτή τη συσκευή.</p></div></aside></div>}
  <section className="sea-card sea-daily-note"><span className="sea-eyebrow">ΣΗΜΕΡΑ ΣΤΗ ΘΑΛΑΣΣΑ</span><h2>{daily.title}</h2><p>«{daily.text}»</p><small>{daily.source}</small><div className="sea-lesson"><div className="sea-lesson-head"><span className="sea-lesson-badge">ΜΑΘΗΜΑ 3 ΛΕΠΤΩΝ</span><span>Σύντομη άσκηση γέφυρας</span></div><h3>{lesson.title}</h3><ol>{lesson.steps.map(step=><li key={step}>{step}</li>)}</ol><small className="sea-lesson-source">Βάση: {lesson.source}</small><div className="sea-lesson-question"><strong>{lesson.question}</strong><div>{lesson.options.map(option=><button key={option} className={lessonAnswer===option?'chosen':''} onClick={()=>setLessonAnswer(option)}>{option}</button>)}</div>{lessonAnswer && <p>{lessonAnswer===lesson.options[0] ? lesson.answer : lesson.hint}</p>}</div></div></section>
  </div>;
}
























