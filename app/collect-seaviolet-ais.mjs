import WebSocket from 'ws';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Run server-side only. Never expose AISSTREAM_API_KEY to the browser.
const key = process.env.AISSTREAM_API_KEY;
if (!key) { console.error('Set AISSTREAM_API_KEY on the server.'); process.exit(1); }
const file = resolve(process.env.AIS_POSITION_FILE || new URL('./dist/data/seaviolet-last-position.json', import.meta.url).pathname);
const cache = resolve(process.env.AIS_POSITION_CACHE || '/home/dev/.local/share/kapavita/seaviolet-last-position.json');
let retry = 1000;
let stopped = false;
const valid = v => typeof v === 'number' && Number.isFinite(v);
async function save(position) {
  const encoded=JSON.stringify(position)+'\n';
  await mkdir(dirname(cache), { recursive:true });
  await writeFile(cache+'.tmp',encoded,{mode:0o600});
  await rename(cache+'.tmp',cache);
  await mkdir(dirname(file), { recursive:true });
  await writeFile(file+'.tmp',encoded,{mode:0o644});
  await rename(file+'.tmp',file);
}
function connect() {
  if (stopped) return;
  const socket = new WebSocket('wss://stream.aisstream.io/v0/stream', { perMessageDeflate:true });
  socket.on('open', () => socket.send(JSON.stringify({
    APIKey:key, BoundingBoxes:[[[-89.99,-179.99],[89.99,179.99]]],
    FiltersShipMMSI:['248554000'], FilterMessageTypes:['PositionReport'],
  })));
  socket.on('message', async raw => {
    try {
      const event = JSON.parse(raw.toString());
      if (event.MessageType === 'SubscriptionConfirmation') { retry = 1000; console.log('AIS subscription confirmed'); return; }
      if (event.MessageType !== 'PositionReport' || Number(event.MetaData?.MMSI) !== 248554000) return;
      const report = event.Message?.PositionReport;
      const latitude = Number(event.MetaData?.Latitude), longitude = Number(event.MetaData?.Longitude);
      if (report?.Valid === false || !valid(latitude) || !valid(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180 || (latitude===0 && longitude===0)) return;
      const position = { mmsi:248554000, latitude, longitude, observedAt:new Date().toISOString(), source:'AISStream.io · ώρα παραλαβής AIS' };
      if (valid(report?.Sog) && report.Sog <= 102.2) position.speedKnots = report.Sog;
      await save(position);
      console.log('Received SEAVIOLET position',position.observedAt);
    } catch (err) { console.error('AIS message rejected:', err.message); }
  });
  socket.on('error', err => console.error('AIS connection:',err.message));
  socket.on('close', () => { if (!stopped) { const wait=retry+Math.random()*500; retry=Math.min(retry*2,60000); setTimeout(connect,wait); } });
}
process.on('SIGTERM', () => { stopped=true; process.exit(0); });
process.on('SIGINT', () => { stopped=true; process.exit(0); });
connect();
