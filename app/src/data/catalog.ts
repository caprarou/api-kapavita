export type SourceRecord = {
  id: string;
  name: string;
  authority: string;
  category: string;
  description: string;
  homepage: string;
  documentation: string | null;
  coverage: string;
  access: string;
  pricing: string;
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
