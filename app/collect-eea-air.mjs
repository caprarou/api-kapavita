import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parquetReadObjects } from 'hyparquet';
import { unzipSync } from 'fflate';

const api = 'https://eeadmz1-downloads-api-appservice.azurewebsites.net/ParquetFile';
const stationsApi = 'https://air.discomap.eea.europa.eu/arcgis/rest/services/AirQuality/AirQualityDownloadServiceEUMonitoringStations/MapServer/0/query';
const output = process.env.KAPAVITA_EEA_CACHE || '/home/dev/.local/share/kapavita/eea-stations.json';
const now = new Date();
const start = new Date(now.getTime() - 72 * 60 * 60 * 1000);
const payload = {
  countries: ['GR'], cities: [], pollutants: ['PM2.5'], dataset: 1,
  dateTimeStart: start.toISOString(), dateTimeEnd: now.toISOString(),
  aggregationType: 'hour', source: 'KapaVita', compress: true,
};
const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(80000) });
if (!response.ok || !response.headers.get('content-type')?.includes('zip')) throw new Error('EEA HTTP ' + response.status);
const archive = new Uint8Array(await response.arrayBuffer());
if (archive.byteLength > 4_000_000) throw new Error('EEA archive too large');
const entries = Object.entries(unzipSync(archive)).filter(([name]) => name.endsWith('.parquet'));
if (!entries.length || entries.length > 50) throw new Error('Unexpected EEA file count: ' + entries.length);
const latest = new Map();
let invalidPoints = 0;
for (const [filename, bytes] of entries) {
  if (bytes.byteLength > 1_000_000) throw new Error('Unexpected EEA file size: ' + filename);
  const file = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const rows = await parquetReadObjects({ file });
  let valid = false;
  for (const row of rows) {
    if (row.AggType !== 'hour' || row.Pollutant !== 6001 || row.Unit !== 'ug.m-3') continue;
    if (![1, 2, 3].includes(row.Validity) || !Number.isFinite(row.Value) || row.Value < 0) continue;
    const observedAt = row.End instanceof Date ? row.End : new Date(row.End);
    if (!Number.isFinite(observedAt.getTime()) || observedAt > now || observedAt < start) continue;
    const match = /^GR\/SPO-(GR[0-9]{4}A)_/.exec(String(row.Samplingpoint));
    if (!match) continue;
    valid = true;
    const previous = latest.get(match[1]);
    if (!previous || observedAt > new Date(previous.observedAt)) {
      latest.set(match[1], { stationId: match[1], value: Number(row.Value), observedAt: observedAt.toISOString(), validity: row.Validity, verification: row.Verification });
    }
  }
  if (!valid) invalidPoints++;
}
if (!latest.size) throw new Error('No valid Greek PM2.5 observations; keeping last cache');
const codes = [...latest.keys()];
const where = `CountryCode='GR' AND AirQualityStationEoICode IN (${codes.map(code => `'${code}'`).join(',')})`;
const params = new URLSearchParams({ f: 'geojson', where, outFields: 'AirQualityStationEoICode,AQStationName,CountryCode', returnGeometry: 'true', outSR: '4326' });
const stationResponse = await fetch(stationsApi + '?' + params, { signal: AbortSignal.timeout(25000) });
if (!stationResponse.ok) throw new Error('Station metadata HTTP ' + stationResponse.status);
const stationData = await stationResponse.json();
if (!Array.isArray(stationData.features)) throw new Error('Station metadata unavailable');
const readings = [];
for (const feature of stationData.features) {
  const code = feature.properties?.AirQualityStationEoICode;
  const reading = latest.get(code);
  const [longitude, latitude] = feature.geometry?.coordinates || [];
  if (!reading || !Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < 18 || longitude > 30 || latitude < 34 || latitude > 42) continue;
  readings.push({ ...reading, name: String(feature.properties?.AQStationName || code).slice(0, 100), longitude, latitude, unit: 'µg/m³' });
}
if (!readings.length) throw new Error('No matched station geometry; keeping last cache');
readings.sort((a, b) => a.stationId.localeCompare(b.stationId));
const data = { source: 'EEA E2a', pollutant: 'PM2.5', collectedAt: now.toISOString(), totalPoints: entries.length, invalidPoints, readings };
await mkdir(dirname(output), { recursive: true, mode: 0o700 });
const temporary = `${output}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify(data), { mode: 0o600 });
await rename(temporary, output);
console.log('EEA PM2.5:', readings.length, 'mapped points;', invalidPoints, 'without valid observations;', output);
