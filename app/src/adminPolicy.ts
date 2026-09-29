export const featureLabels: Record<string,string> = {
 regions:'Περιφέρειες · όρια 2016', municipalities:'Δήμοι · όρια 2021',
 communities:'Δημοτικές κοινότητες · 2021', population:'Πληθυσμός · απογραφή 2021',
 airports:'Αεροδρόμια', aircraft:'Αεροσκάφη · OpenSky',
 marine:'Θαλάσσιες περιοχές', weather:'Καιρός · πρόγνωση',
 airQuality:'Ποιότητα αέρα · εκτίμηση', eeaAir:'Μετρήσεις PM2.5 σταθμών EEA', copernicus:'Copernicus · Sentinel-2 εικόνες', earthquakes:'Σεισμοί · USGS', catalog:'Πηγές δεδομένων',
 seaviolet:'SEAVIOLET · δημόσια προβολή',
};
export type Flags = Record<keyof typeof featureLabels, boolean>;
export const defaultFlags: Flags = Object.fromEntries(Object.keys(featureLabels).map(k=>[k,k!=='seaviolet'])) as Flags;



export const vesselFieldLabels: Record<string,string> = {
 identity:'Ταυτότητα και τύπος πλοίου', technical:'IMO, MMSI, σημαία και διακριτικό', status:'Κατάσταση και γενική περιοχή', destination:'Δηλωμένος προορισμός και ETA', course:'Ταχύτητα και πορεία', clock:'Ώρες και ζώνη ώρας πλοίου', position:'Τελευταίο στίγμα AIS στον χάρτη', route:'Διαδρομή που διανύθηκε και προβλέπεται', stops:'Περάσματα, λιμάνια και στάσεις', source:'Πηγή και χρόνος τελευταίας αναφοράς',
};

export const vesselFilterDefinitions = {
 historyWindow:{label:'Χρονικό εύρος διαδρομής',description:'Πόσο πίσω αναζητά η δημόσια καρτέλα ιστορικά AIS στίγματα.',options:{'24h':'Τελευταίες 24 ώρες','7d':'Τελευταίες 7 ημέρες','30d':'Τελευταίες 30 ημέρες'}},
 routeLayers:{label:'Στρώματα διαδρομής',description:'Ποια τμήματα της διαδρομής μπορεί να εμφανίζει και να κρύβει ο χρήστης.',options:{actual:'Επιβεβαιωμένα AIS',reconstructed:'Θεωρητική ανακατασκευή κενών',projected:'Προβλεπόμενη πορεία',stops:'Περάσματα, λιμάνια και στάσεις'}},
 contextLayers:{label:'Πρόσθετα επίπεδα χάρτη',description:'Ποια βοηθητικά επίπεδα μπορεί να ενεργοποιεί ο χρήστης πάνω από τον χάρτη.',options:{nautical:'Ναυτικά σημεία',security:'Ασφάλεια και κίνδυνοι',greek:'Ελληνικές ονομασίες'}},
} as const;
export type VesselFilterConfig = Record<string,{enabled:boolean;options:string[]}>;
export const defaultVesselFilters: VesselFilterConfig = {
 historyWindow:{enabled:true,options:['24h','7d','30d']},
 routeLayers:{enabled:true,options:['actual','reconstructed','projected','stops']},
 contextLayers:{enabled:true,options:['nautical','security','greek']},
};
