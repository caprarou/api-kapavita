import records from '../../../catalog/datasets.json';

export type DatasetRecord = {
  id: string; sourceId: string; provider: string; name: string; layer: string;
  count: number | null; grain: string; fields: string[]; join: string;
  joinStatus: string; status: string; format: string; temporal: string;
  reuse: string; evidence: string; notes: string;
};

export const datasets = records as DatasetRecord[];
