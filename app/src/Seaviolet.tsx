import { useState } from 'react';
import { Anchor, ArrowRight, Clock3, Heart, LockKeyhole, MapPin, MessageCircle, Radio, ShieldCheck, Ship, X } from 'lucide-react';
import './Seaviolet.css';

type View = 'family' | 'crew';
type Context = 'Εν πλω' | 'Αγκυροβολημένο' | 'Άφιξη' | 'Αναχώρηση' | 'Νύχτα';
type Greeting = { text: string; area: string; time: Date };

const templates = ['Καλημέρα από…', 'Χαιρετισμούς από…', 'Όλα καλά από…', 'Καλή θάλασσα από…', 'Μια καληνύχτα από…', 'Με τον νου στο σπίτι από…', 'Στέλνω έναν χαιρετισμό από…'];
const regions = ['Χωρίς κοινοποίηση περιοχής', 'Αιγαίο', 'Ιόνιο', 'Περιοχή της Κρήτης', 'Μεσόγειος'];
const regionPhrase: Record<string, string> = { Αιγαίο: 'το Αιγαίο', Ιόνιο: 'το Ιόνιο', 'Περιοχή της Κρήτης': 'την περιοχή της Κρήτης', Μεσόγειος: 'τη Μεσόγειο' };
const recommended: Record<Context, string> = {
  'Εν πλω': 'Καλή θάλασσα από…',
  'Αγκυροβολημένο': 'Όλα καλά από…',
  'Άφιξη': 'Χαιρετισμούς από…',
  'Αναχώρηση': 'Με τον νου στο σπίτι από…',
  'Νύχτα': 'Μια καληνύχτα από…',
};

export function Seaviolet() {
  const [view, setView] = useState<View>('family');
  const [shipName, setShipName] = useState('');
  const [context, setContext] = useState<Context>('Εν πλω');
  const [region, setRegion] = useState(regions[0]);
  const [template, setTemplate] = useState(recommended['Εν πλω']);
  const [custom, setCustom] = useState('');
  const [history, setHistory] = useState<Greeting[]>([]);
  const [notice, setNotice] = useState(false);

  const namedShip = shipName.trim() || 'Πλοίο πληρώματος';
  const safeRegion = regionPhrase[region] ?? '';
  const greetingText = custom.trim() || (safeRegion ? `${template.replace('…', ` ${safeRegion}`)}` : template.replace(' από…', '').replace('…', ''));
  const chooseContext = (next: Context) => { setContext(next); setTemplate(recommended[next]); setCustom(''); };
  const preview = () => {
    setHistory(items => [{ text: greetingText, area: region, time: new Date() }, ...items].slice(0, 5));
    setNotice(true);
    setView('family');
  };

  return <div className="sea-page">
    <div className="sea-header"><div><span className="sea-kicker">SEAVIOLET · FAMILY / CREW</span><h1>Κοντά, ακόμη κι όταν ταξιδεύουμε.</h1><p>Μια καθαρή εικόνα για το πλοίο και ένας προσωπικός χαιρετισμός από τον άνθρωπό σου.</p></div><span className="sea-demo">Προεπισκόπηση · χωρίς πραγματική αποστολή</span></div>
    <div className="sea-tabs" role="tablist" aria-label="Προβολή SEAVIOLET"><button role="tab" aria-selected={view === 'family'} className={view === 'family' ? 'selected' : ''} onClick={() => setView('family')}><Heart size={17}/> Οικογένεια</button><button role="tab" aria-selected={view === 'crew'} className={view === 'crew' ? 'selected' : ''} onClick={() => setView('crew')}><Ship size={17}/> Πλήρωμα</button></div>

    {view === 'family' ? <div className="sea-layout">
      <div className="sea-main">
        {notice && <div className="sea-notice" role="status">Η προεπισκόπηση εμφανίστηκε μόνο σε αυτή τη συσκευή. Δεν στάλθηκε μήνυμα στην οικογένεια.<button aria-label="Κλείσιμο ενημέρωσης" onClick={() => setNotice(false)}><X size={15}/></button></div>}
        <section className="sea-card sea-vessel"><div className="sea-card-heading"><span className="sea-card-icon"><Ship size={19}/></span><div><span className="sea-eyebrow">ΤΙ ΚΑΝΕΙ ΤΟ ΠΛΟΙΟ</span><h2>{namedShip}</h2></div><span className="sea-availability">AIS μη συνδεδεμένο</span></div>
          <div className="sea-vessel-grid"><div><small>Κατάσταση</small><strong>Δεν υπάρχουν δεδομένα πλοίου</strong></div><div><small>Γενική περιοχή</small><strong>Μη διαθέσιμη</strong></div><div><small>Προορισμός</small><strong>Μη διαθέσιμος</strong></div><div><small>Εκτιμώμενη άφιξη</small><strong>Μη διαθέσιμη</strong></div></div>
          <p className="sea-explain"><Radio size={15}/> Η θέση, ο προορισμός και η άφιξη θα φανούν μόνο με κατάλληλη αδειοδοτημένη πηγή και ενεργή πρόσβαση. Καμία προσωπική ενημέρωση δεν υποκαθιστά τα δεδομένα AIS.</p>
        </section>
        <section className="sea-card sea-message"><div className="sea-card-heading"><span className="sea-card-icon sea-heart"><Heart size={19}/></span><div><span className="sea-eyebrow">ΜΑΣ ΕΣΤΕΙΛΕ ΧΑΙΡΕΤΙΣΜΟ</span><h2>Μια κουβέντα από το πλήρωμα</h2></div></div>
          {history.length ? <><p className="sea-greeting">«{history[0].text}»</p><div className="sea-greeting-meta"><Clock3 size={14}/> Προεπισκόπηση: {history[0].time.toLocaleString('el-GR', { timeZone: 'Europe/Athens', dateStyle: 'medium', timeStyle: 'short' })} · {history[0].area}</div></> : <div className="sea-empty"><MessageCircle size={26}/><strong>Δεν υπάρχει προσωπικός χαιρετισμός.</strong><span>Ο χαιρετισμός εμφανίζεται μόνο όταν το μέλος πληρώματος τον στείλει. Η ώρα του είναι ξεχωριστή από την τελευταία θέση του πλοίου.</span></div>}
        </section>
        <div className="sea-history"><h3>Ιστορικό χαιρετισμών</h3>{history.length ? history.map((item,index) => <div key={index}><span>«{item.text}»</span><small>{item.time.toLocaleString('el-GR', { timeZone: 'Europe/Athens', dateStyle: 'medium', timeStyle: 'short' })}</small></div>) : <p>Δεν υπάρχουν ακόμη χαιρετισμοί σε αυτή την προεπισκόπηση.</p>}</div>
      </div>
      <aside className="sea-side"><div className="sea-side-card"><MapPin size={21}/><h3>Θέση με διακριτικότητα</h3><p>Η οικογένεια θα βλέπει γενική περιοχή, εφόσον έχει επιλεγεί η κοινοποίησή της. Ακριβείς συντεταγμένες δεν εμφανίζονται στην προσωπική καρτέλα.</p></div><div className="sea-side-card"><LockKeyhole size={21}/><h3>Μόνο για τους δικούς σου</h3><p>Η πρόσκληση οικογένειας θα απαιτεί ασφαλή σύνδεση, ρητή πρόσβαση και δυνατότητα ανάκλησης. Δεν έχει ενεργοποιηθεί κοινοποίηση σε πραγματικούς λογαριασμούς.</p></div><button className="sea-switch" onClick={() => setView('crew')}>Δοκίμασε την πλευρά του πληρώματος <ArrowRight size={16}/></button></aside>
    </div> : <div className="sea-layout">
      <div className="sea-main"><section className="sea-card sea-compose"><div className="sea-card-heading"><span className="sea-card-icon sea-heart"><Heart size={19}/></span><div><span className="sea-eyebrow">ΕΝΑ ΑΓΓΙΓΜΑ</span><h2>Στείλε ένα σημάδι ότι είσαι καλά</h2></div></div><p className="sea-compose-intro">Επίλεξε μια σύντομη φράση ή γράψε τη δική σου. Εδώ βλέπεις την προεπισκόπηση χωρίς αποστολή.</p>
        <label className="sea-label" htmlFor="sea-ship">Όνομα πλοίου στην προεπισκόπηση</label><input id="sea-ship" className="sea-input" value={shipName} maxLength={60} onChange={e => setShipName(e.target.value)} placeholder="Π.χ. το πλοίο του Νίκου" />
        <span className="sea-label">Περίσταση</span><div className="sea-choice">{(Object.keys(recommended) as Context[]).map(item => <button key={item} className={context === item ? 'chosen' : ''} onClick={() => chooseContext(item)}>{item}</button>)}</div>
        <label className="sea-label" htmlFor="sea-region">Γενική περιοχή που επιλέγεις να κοινοποιήσεις</label><select id="sea-region" className="sea-input" value={region} onChange={e => setRegion(e.target.value)}>{regions.map(item => <option key={item}>{item}</option>)}</select>
        <span className="sea-label">Έτοιμος χαιρετισμός <small>· Πρόταση: {recommended[context]}</small></span><div className="sea-phrases">{templates.map(item => <button key={item} className={template === item && !custom ? 'chosen' : ''} onClick={() => { setTemplate(item); setCustom(''); }}>{item}</button>)}</div>
        <label className="sea-label" htmlFor="sea-custom">Ή γράψε κάτι δικό σου (προαιρετικό)</label><textarea id="sea-custom" className="sea-input" rows={2} maxLength={180} placeholder="Μέχρι δύο σύντομες γραμμές…" value={custom} onChange={e => setCustom(e.target.value)}/>
        <div className="sea-preview"><small>Πώς θα το δει η οικογένεια</small><strong>«{greetingText}»</strong><span>{region}</span></div>
        <button className="sea-primary" onClick={preview}><Heart size={17}/> Δες το στην οικογενειακή προβολή</button><p className="sea-only-preview">Η ενέργεια αλλάζει μόνο την τρέχουσα προεπισκόπηση στον browser. Δεν στέλνει μήνυμα, δεν δημιουργεί λογαριασμό και δεν αποθηκεύει στοιχεία στον server.</p>
      </section></div>
      <aside className="sea-side"><div className="sea-side-card"><ShieldCheck size={21}/><h3>Προσωπική ενημέρωση ≠ AIS</h3><p>Ο χαιρετισμός έχει δική του ώρα. Δεν χρησιμοποιείται για να συμπεράνουμε θέση ή άφιξη του πλοίου.</p></div><div className="sea-side-card"><Anchor size={21}/><h3>Όταν ενεργοποιηθεί</h3><p>Το πραγματικό ένα άγγιγμα θα απαιτεί ταυτοποίηση πληρώματος και σύνδεση της οικογένειας με προσωρινή πρόσκληση. Η κοινοποίηση περιοχής θα παραμένει επιλογή του μέλους.</p></div></aside>
    </div>}
  </div>;
}
