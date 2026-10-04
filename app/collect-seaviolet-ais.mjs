import WebSocket from 'ws';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';

// Run server-side only. Never expose AISSTREAM_API_KEY to the browser.
const key = process.env.AISSTREAM_API_KEY;
if (!key) {
  console.error('Set AISSTREAM_API_KEY on the server.');
  process.exit(1);
}
const myShipTrackingKey = process.env.MYSHIPTRACKING_API_KEY;
const kplerToken = process.env.KPLER_API_TOKEN;
const openWatersToken = process.env.OPENWATERS_API_TOKEN;
const execFileAsync = promisify(execFile);

const mmsi = 248554000;
const file = resolve(process.env.AIS_POSITION_FILE || new URL('./dist/data/seaviolet-last-position.json', import.meta.url).pathname);
const cache = resolve(process.env.AIS_POSITION_CACHE || '/home/dev/.local/share/kapavita/seaviolet-last-position.json');
let retry = 1000;
let stopped = false;
let socket;
let fallbackTimer;
let lastPosition = null;
let vesselDetails = {};
let saveQueue = Promise.resolve();

const number = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const cleanText = value => typeof value === 'string' && value.trim() ? value.trim().replace(/@+$/g, '').trim() : undefined;

const decodeHtml = value => String(value || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

const vesselFinderReportedAt = value => {
  const text = String(value || '').toLowerCase();
  const match = text.match(/(\d+)\s+(min|hour|day)/);
  if (!match) return new Date().toISOString();
  const amount = Number(match[1]);
  const unit = match[2] === 'min' ? 60_000 : match[2] === 'hour' ? 3_600_000 : 86_400_000;
  return new Date(Date.now() - amount * unit).toISOString();
};

const observedAt = value => {
  if (typeof value !== 'string' || !value.trim()) return new Date().toISOString();

  // AISStream commonly uses: 2026-08-25 10:32:51.34505366 +0000 UTC
  const utc = value.trim().match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d+))? \+0000 UTC$/);
  const normalized = utc
    ? `${utc[1]}T${utc[2]}.${(utc[3] || '').slice(0, 3).padEnd(3, '0')}Z`
    : value;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
};

const etaText = eta => {
  if (!eta || typeof eta !== 'object') return undefined;
  const month = number(eta.Month);
  const day = number(eta.Day);
  const hour = number(eta.Hour);
  const minute = number(eta.Minute);
  if (!month || month > 12 || !day || day > 31 || hour === null || hour > 23 || minute === null || minute > 59) return undefined;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC · δηλωμένο μέσω AIS`;
};

async function writePosition(position) {
  const encoded = JSON.stringify(position) + '\n';
  await mkdir(dirname(cache), { recursive: true });
  await writeFile(cache + '.tmp', encoded, { mode: 0o600 });
  await rename(cache + '.tmp', cache);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file + '.tmp', encoded, { mode: 0o644 });
  await rename(file + '.tmp', file);
}

async function saveHistory(position, raw = {}) {
  const q = value => value === null || value === undefined ? 'NULL' : "'" + String(value).replace(/'/g, "''") + "'";
  const rawJson = JSON.stringify(raw).replace(/'/g, "''");
  const sourceId = position.source?.startsWith('Kpler') ? 'kpler' : position.source?.startsWith('MyShipTracking') ? 'myshiptracking' : position.source?.startsWith('VesselFinder') ? 'vesselfinder-api' : position.source?.startsWith('Open Waters AIS') ? 'openwaters' : 'aisstream';
  const sql = `INSERT INTO observations.vessels (mmsi, name, properties, updated_at) VALUES (${position.mmsi}, 'SEAVIOLET', '${rawJson}'::jsonb, now()) ON CONFLICT (mmsi) DO UPDATE SET properties=observations.vessels.properties || EXCLUDED.properties, updated_at=now(); INSERT INTO observations.vessel_positions (mmsi, observed_at, source_id, location, speed_knots, course, heading, destination, raw) VALUES (${position.mmsi}, ${q(position.observedAt)}::timestamptz, ${q(sourceId)}, ST_SetSRID(ST_Point(${position.longitude},${position.latitude}),4326), ${position.speedKnots ?? 'NULL'}, ${position.course ?? 'NULL'}, ${position.heading ?? 'NULL'}, ${q(position.destination)}, '${rawJson}'::jsonb) ON CONFLICT (mmsi, observed_at, source_id) DO NOTHING;`;
  try { await execFileAsync('psql', ['--dbname=kapavita', '--set=ON_ERROR_STOP=1', '--command', sql]); } catch (error) { console.error('AIS history database write failed:', error.message); }
}
function save(position, raw = {}) {
  lastPosition = position;
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await writePosition(position);
    await saveHistory(position, raw);
  });
  return saveQueue;
}

function isNewer(position) {
  if (!lastPosition) return true;
  const candidate = new Date(position.observedAt).getTime();
  const previous = new Date(lastPosition.observedAt).getTime();
  return Number.isFinite(candidate) && (!Number.isFinite(previous) || candidate > previous);
}

async function pollOpenWaters() {
  if (stopped) return;

  try {
    const headers = { Accept: 'application/geo+json, application/json' };
    if (openWatersToken) headers.Authorization = `Bearer ${openWatersToken}`;
    const response = await fetch(`https://ais.openwaters.io/v1/vessels/${mmsi}`, {
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.error('Open Waters request failed:', response.status);
      return;
    }

    const payload = await response.json();
    const properties = payload?.properties;
    const coordinates = payload?.geometry?.coordinates;
    const longitude = number(coordinates?.[0]);
    const latitude = number(coordinates?.[1]);
    if (Number(payload?.id) !== mmsi || latitude === null || longitude === null
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
      console.error('Open Waters returned no valid SEAVIOLET position');
      return;
    }

    const position = {
      mmsi,
      latitude,
      longitude,
      observedAt: observedAt(properties?.seen),
      source: `Open Waters AIS · ${cleanText(properties?.source) || 'community network'}`,
      ...(cleanText(properties?.destination) ? { destination: cleanText(properties.destination) } : {}),
      ...(cleanText(properties?.eta) ? { eta: cleanText(properties.eta) } : {}),
    };
    const speed = number(properties?.sog);
    if (speed !== null && speed >= 0 && speed <= 102.2) position.speedKnots = speed;
    const course = number(properties?.cog);
    if (course !== null && course >= 0 && course <= 360) position.course = course;
    const heading = number(properties?.heading);
    if (heading !== null && heading >= 0 && heading <= 360) position.heading = heading;

    if (isNewer(position)) {
      await save(position, payload);
      console.log('Received SEAVIOLET Open Waters position', position.observedAt);
    }
  } catch (error) {
    console.error('Open Waters request:', error.message);
  }
}

async function pollMyShipTracking() {
  if (!myShipTrackingKey || stopped) return;

  try {
    const response = await fetch(`https://api.myshiptracking.com/api/v2/vessel?mmsi=${mmsi}`, {
      headers: { Authorization: `Bearer ${myShipTrackingKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.error('MyShipTracking request failed:', response.status);
      return;
    }

    const payload = await response.json();
    const vessel = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
    const latitude = number(vessel?.lat);
    const longitude = number(vessel?.lng);
    if (Number(vessel?.mmsi) !== mmsi || latitude === null || longitude === null
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
      console.error('MyShipTracking returned no valid SEAVIOLET position');
      return;
    }

    const position = {
      mmsi,
      latitude,
      longitude,
      observedAt: observedAt(vessel.received),
      source: 'MyShipTracking API · terrestrial AIS',
      ...vesselDetails,
    };
    const speed = number(vessel.speed);
    if (speed !== null && speed >= 0 && speed <= 102.2) position.speedKnots = speed;
    if (isNewer(position)) {
      await save(position, payload);
      console.log('Received SEAVIOLET fallback position', position.observedAt);
    }
  } catch (error) {
    console.error('MyShipTracking request:', error.message);
  }
}

async function pollKpler() {
  if (!kplerToken || stopped) return;

  const query = `query SeavioletPosition {
    vessels(mmsi: [${mmsi}]) {
      nodes {
        staticData { mmsi }
        lastPositionUpdate {
          timestamp latitude longitude speed collectionType
        }
        currentVoyage { destination eta }
      }
    }
  }`;

  try {
    const response = await fetch('https://api.sml.kpler.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kplerToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.error('Kpler request failed:', response.status);
      return;
    }

    const payload = await response.json();
    if (payload?.errors?.length) {
      console.error('Kpler GraphQL request failed:', payload.errors[0]?.message || 'unknown error');
      return;
    }

    const vessel = payload?.data?.vessels?.nodes?.[0];
    const latest = vessel?.lastPositionUpdate;
    const latitude = number(latest?.latitude);
    const longitude = number(latest?.longitude);
    if (Number(vessel?.staticData?.mmsi) !== mmsi || latitude === null || longitude === null
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
      console.error('Kpler returned no valid SEAVIOLET position');
      return;
    }

    const voyage = vessel?.currentVoyage;
    const destination = cleanText(voyage?.destination);
    const eta = cleanText(voyage?.eta);
    if (destination || eta) {
      vesselDetails = {
        ...vesselDetails,
        ...(destination ? { destination } : {}),
        ...(eta ? { eta } : {}),
      };
    }

    const collection = cleanText(latest?.collectionType);
    const position = {
      mmsi,
      latitude,
      longitude,
      observedAt: observedAt(latest.timestamp),
      source: `Kpler Maritime 2.0 · ${collection || 'AIS'}`,
      ...vesselDetails,
    };
    const speed = number(latest.speed);
    if (speed !== null && speed >= 0 && speed <= 102.2) position.speedKnots = speed;
    if (isNewer(position)) {
      await save(position, payload);
      console.log('Received SEAVIOLET Kpler position', position.observedAt);
    }
  } catch (error) {
    console.error('Kpler request:', error.message);
  }
}

async function pollVesselFinder() {
  if (stopped) return;

  try {
    const response = await fetch('https://www.vesselfinder.com/vessels/details/9790983', {
      headers: { 'User-Agent': 'KapaVita AIS collector/1.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.error('VesselFinder request failed:', response.status);
      return;
    }

    const html = await response.text();
    const match = html.match(/<div id="djson"[^>]*data-json='([^']+)'/i);
    if (!match) {
      console.error('VesselFinder returned no position payload');
      return;
    }

    const payload = JSON.parse(decodeHtml(match[1]));
    const latitude = number(payload.ship_lat);
    const longitude = number(payload.ship_lon);
    if (Number(payload.mmsi) !== mmsi || latitude === null || longitude === null
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
      console.error('VesselFinder returned no valid SEAVIOLET position');
      return;
    }

    const destinationMatch = html.match(/en route to\s+<strong>([^<]+)<\/strong>/i);
    const destination = cleanText(destinationMatch?.[1]);
    const reported = cleanText(payload.lrpd);
    const position = {
      mmsi,
      latitude,
      longitude,
      observedAt: vesselFinderReportedAt(reported),
      source: 'VesselFinder AIS' + (reported ? ' / ' + reported : ''),
      ...(destination ? { destination } : {}),
    };
    const speed = number(payload.ship_sog);
    if (speed !== null && speed >= 0 && speed <= 102.2) position.speedKnots = speed;
    const course = number(payload.ship_cog);
    if (course !== null && course >= 0 && course <= 360) position.course = course;

    if (isNewer(position)) {
      await save(position, payload);
      console.log('Received SEAVIOLET VesselFinder position', position.observedAt);
    }
  } catch (error) {
    console.error('VesselFinder request:', error.message);
  }
}

function scheduleFallback() {
  // Open Waters is used only as a personal-use fallback. AISStream remains primary;
  // an older fallback report can never overwrite a newer AISStream position.
  console.log('AIS fallback enabled: Open Waters personal tier');
  void pollOpenWaters();
  fallbackTimer = setInterval(() => void pollOpenWaters(), 5 * 60 * 1000);
}

async function restore() {
  try {
    const saved = JSON.parse(await readFile(cache, 'utf8'));
    const preciseCache = saved?.mmsi === mmsi
      && Number.isFinite(Number(saved.latitude))
      && Number.isFinite(Number(saved.longitude))
      && !(Number.isInteger(Number(saved.latitude)) && Number.isInteger(Number(saved.longitude)));
    if (preciseCache) {
      lastPosition = saved;
      vesselDetails = {
        ...(cleanText(saved.destination) ? { destination: cleanText(saved.destination) } : {}),
        ...(cleanText(saved.eta) ? { eta: cleanText(saved.eta) } : {}),
      };
    }
  } catch {
    // The cache is optional until the first valid AIS message arrives.
  }
}

function detailsFrom(report) {
  if (!report || typeof report !== 'object') return {};
  const destination = cleanText(report.Destination);
  const eta = etaText(report.Eta);
  return {
    ...(destination ? { destination } : {}),
    ...(eta ? { eta } : {}),
  };
}

function connect() {
  if (stopped) return;

  socket = new WebSocket('wss://stream.aisstream.io/v0/stream', { perMessageDeflate: true });

  socket.on('open', () => socket.send(JSON.stringify({
    APIKey: key,
    BoundingBoxes: [[[-90, -180], [90, 180]]],
    // Request decoded position packets explicitly. Without this filter AISStream
    // can confirm the subscription but omit the position-report stream.
    FiltersShipMMSI: [String(mmsi)],
    FilterMessageTypes: [
      'PositionReport',
      'LongRangeAisBroadcastMessage',
      'ExtendedClassBPositionReport',
      'StandardClassBPositionReport',
    ],
  })));

  socket.on('message', async raw => {
    try {
      const event = JSON.parse(raw.toString());
      if (event.error) {
        console.error('AISStream subscription error:', event.error);
        return;
      }
      if (event.MessageType === 'SubscriptionConfirmation') {
        retry = 1000;
        console.log('AIS subscription confirmed');
        return;
      }

      const report = event.Message?.[event.MessageType];
      const eventMmsi = number(event.MetaData?.MMSI) ?? number(report?.UserID);
      if (eventMmsi !== mmsi || !report || report.Valid === false) return;

      const freshDetails = detailsFrom(report);
      if (Object.keys(freshDetails).length) {
        vesselDetails = { ...vesselDetails, ...freshDetails };
      }

      // Position reports carry the precise coordinates in the decoded payload.
      // Metadata coordinates can be rounded to whole degrees, so never use that
      // low-precision fallback as a new AIS fix.
      const reportLatitude = number(report.Latitude);
      const reportLongitude = number(report.Longitude);
      const metadataLatitude = number(event.MetaData?.latitude);
      const metadataLongitude = number(event.MetaData?.longitude);
      const metadataHasPrecision = metadataLatitude !== null && metadataLongitude !== null
        && (!Number.isInteger(metadataLatitude) || !Number.isInteger(metadataLongitude));
      const latitude = reportLatitude ?? (metadataHasPrecision ? metadataLatitude : null);
      const longitude = reportLongitude ?? (metadataHasPrecision ? metadataLongitude : null);
      const hasPosition = latitude !== null && longitude !== null
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
        && !(latitude === 0 && longitude === 0);

      if (!hasPosition) {
        if (lastPosition && Object.keys(freshDetails).length) {
          await save({ ...lastPosition, ...vesselDetails }, event);
        }
        console.log('Received SEAVIOLET AIS message without coordinates:', event.MessageType);
        return;
      }

      const position = {
        mmsi,
        latitude,
        longitude,
        observedAt: observedAt(event.MetaData?.time_utc),
        source: 'AISStream.io · χρόνος αναφοράς AIS',
        ...vesselDetails,
      };
      const speed = number(report.Sog);
      if (speed !== null && speed >= 0 && speed <= 102.2) position.speedKnots = speed;

      if (isNewer(position)) {
        await save(position, event);
        console.log('Received SEAVIOLET position', position.observedAt, event.MessageType);
      } else {
        console.log('Ignored stale SEAVIOLET AIS position', position.observedAt, event.MessageType);
      }
    } catch (error) {
      console.error('AIS message rejected:', error.message);
    }
  });

  socket.on('error', error => console.error('AIS connection:', error.message));
  socket.on('close', () => {
    socket = undefined;
    if (!stopped) {
      const wait = retry + Math.random() * 500;
      retry = Math.min(retry * 2, 60000);
      setTimeout(connect, wait);
    }
  });
}

function stop() {
  stopped = true;
  if (fallbackTimer) clearInterval(fallbackTimer);
  socket?.close();
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

await restore();
scheduleFallback();
connect();

