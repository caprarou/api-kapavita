export const featureLabels: Record<string,string> = {
 regions:'Περιφέρειες · όρια 2016', municipalities:'Δήμοι · όρια 2021',
 communities:'Δημοτικές κοινότητες · 2021', population:'Πληθυσμός · απογραφή 2021',
 airports:'Αεροδρόμια', aircraft:'Αεροσκάφη · OpenSky',
 marine:'Θαλάσσιες περιοχές', weather:'Καιρός · πρόγνωση',
 airQuality:'Ποιότητα αέρα · εκτίμηση', catalog:'Πηγές δεδομένων',
 seaviolet:'SEAVIOLET · δημόσια προβολή',
};
export type Flags = Record<keyof typeof featureLabels, boolean>;
export const defaultFlags: Flags = Object.fromEntries(Object.keys(featureLabels).map(k=>[k,k!=='seaviolet'])) as Flags;
