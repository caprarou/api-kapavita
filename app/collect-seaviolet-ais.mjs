import WebSocket from 'ws';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Run server-side only. Never expose AISSTREAM_API_KEY to the browser.
const key = process.env.AISSTREAM_API_KEY;
if (!key) {
  console.error('Set AISSTREAM_API_KEY on the server.');
  process.exit(1);
}

const mmsi = 248554000;
const file = resolve(process.env.AIS_POSITION_FILE || new URL('./dist/data/seaviolet-last-position.json', import.meta.url).pathname);
const cache = resolve(process.env.AIS_POSITION_CACHE || '/home/dev/.local/share/kapavita/seaviolet-last-position.json');
let retry = 1000;
let stopped = false;
let socket;
let lastPosition = null;
let vesselDetails = {};
let saveQueue = Promise.resolve();

const number = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const cleanText = value => typeof value === 'string' && value.trim() ? value.trim().replace(/@+$/g, '').trim() : undefined;

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

function save(position) {
  lastPosition = position;
  saveQueue = saveQueue.catch(() => {}).then(() => writePosition(position));
  return saveQueue;
}

async function restore() {
  try {
    const saved = JSON.parse(await readFile(cache, 'utf8'));
    if (saved?.mmsi === mmsi) {
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
    // Keep the stream small, but accept every AIS message type for this vessel.
    // Some useful packets expose their position only through MetaData.
    FiltersShipMMSI: [String(mmsi)],
  })));

  socket.on('message', async raw => {
    try {
      const event = JSON.parse(raw.toString());
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

      // Position reports carry coordinates in the decoded payload. AISStream also
      // publishes normalized coordinates in MetaData for other vessel messages.
      const latitude = number(report.Latitude) ?? number(event.MetaData?.latitude);
      const longitude = number(report.Longitude) ?? number(event.MetaData?.longitude);
      const hasPosition = latitude !== null && longitude !== null
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
        && !(latitude === 0 && longitude === 0);

      if (!hasPosition) {
        if (lastPosition && Object.keys(freshDetails).length) {
          await save({ ...lastPosition, ...vesselDetails });
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

      await save(position);
      console.log('Received SEAVIOLET position', position.observedAt, event.MessageType);
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
  socket?.close();
}

process.on('SIGTERM', stop);
process.on('SIGINT', stop);

await restore();
connect();
