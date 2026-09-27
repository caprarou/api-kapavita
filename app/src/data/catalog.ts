export type SourceRecord = {
  id: string;
  name: string;
  authority: string;
  category: 'Δημόσιο' | 'Στατιστική' | 'Γεωχωρικά' | 'Περιβάλλον' | 'Μεταφορές';
  description: string;
  homepage: string;
  documentation: string | null;
  coverage: 'Ελλάδα' | 'Ελλάδα / παγκόσμια';
  access: 'Ανοιχτή πύλη' | 'Άγνωστο';
  pricing: 'Δωρεάν' | 'Προς επαλήθευση';
  license: string | null;
  commercialUse: string | null;
  updateFrequency: string | null;
  geographicResolution: string | null;
  lastVerified: string | null;
  status: 'Υποψήφια πηγή' | 'Ενεργό επίπεδο';
};

// Candidate records only. Verification of endpoints, licenses and availability is pending.
import catalog from '../../../catalog/sources.json';
export const sources = catalog as SourceRecord[];
