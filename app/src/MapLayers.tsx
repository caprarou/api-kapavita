import { useEffect } from 'react';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';

export type OverlayKey = 'population' | 'airports' | 'aircraft' | 'marine' | 'weather' | 'airQuality' | 'eeaAir' | 'earthquakes' | 'openaq' | 'copernicus';
type Props = {
  mapRef: React.MutableRefObject<LeafletMap | null>;
  active: Record<OverlayKey, boolean>;
  onArea: (name: string, detail: string) => void;
  onPlane: (plane: Plane & { snapshotTime: number }) => void;
  onAirQuality: (reading: AirReading) => void;
  onEEA: (reading: EEAReading | null) => void;
  onStatus: (key: OverlayKey, status: string) => void;
};
type Airport = { name: string; ident: string; iata: string; lat: number; lon: number; municipality: string };
export type AirReading = { city: string; time: string; aqi: number; pm25: number | null; pm10: number | null };
export type EEAReading = { stationId: string; name: string; latitude: number; longitude: number; value: number; observedAt: string; unit: string; validity: number; verification: number };
export const eeaReadingFresh = (reading: EEAReading, now = Date.now()) => { const age = now - Date.parse(reading.observedAt); return reading.unit === 'µg/m³' && [1, 2, 3].includes(reading.validity) && Number.isFinite(reading.value) && reading.value >= 0 && Number.isFinite(reading.latitude) && Number.isFinite(reading.longitude) && reading.latitude >= 34 && reading.latitude <= 42 && reading.longitude >= 18 && reading.longitude <= 30 && Number.isFinite(age) && age >= 0 && age <= 24 * 3600_000; };
export const airQualityBand = (value: number) => value <= 20 ? { name: 'Καλή', color: '#267d65', message: 'Η ποιότητα του αέρα είναι καλή για τις συνήθεις υπαίθριες δραστηριότητες.' } : value <= 40 ? { name: 'Ικανοποιητική', color: '#459a69', message: 'Οι περισσότεροι μπορούν να συνεχίσουν κανονικά τις δραστηριότητές τους.' } : value <= 60 ? { name: 'Μέτρια', color: '#ae832a', message: 'Αν έχεις αναπνευστική ευαισθησία, λάβε υπόψη σου την ποιότητα του αέρα πριν από έντονη άσκηση έξω.' } : value <= 80 ? { name: 'Κακή', color: '#c56c33', message: 'Αν είσαι ευαίσθητος στην ατμοσφαιρική ρύπανση, περιόρισε την έντονη άσκηση έξω.' } : value <= 100 ? { name: 'Πολύ κακή', color: '#ad4c63', message: 'Προτίμησε δραστηριότητες σε εσωτερικό χώρο, ιδίως αν ανήκεις σε ευαίσθητη ομάδα.' } : { name: 'Εξαιρετικά κακή', color: '#713c82', message: 'Περιόρισε τις υπαίθριες δραστηριότητες και ακολούθησε τις τοπικές οδηγίες.' };
export type Plane = { icao24: string; callsign: string; originCountry: string; latitude: number; longitude: number; lastContact: number; altitude: number | null; onGround: boolean; baroAltitude: number | null; velocity: number | null; heading: number | null; verticalRate: number | null; squawk: string | null; positionSource: number | null };
const cities = [
  { name: 'Αθήνα', lat: 37.9838, lon: 23.7275 }, { name: 'Θεσσαλονίκη', lat: 40.6401, lon: 22.9444 },
  { name: 'Πάτρα', lat: 38.2466, lon: 21.7351 }, { name: 'Ηράκλειο', lat: 35.3387, lon: 25.1442 },
  { name: 'Λάρισα', lat: 39.6369, lon: 22.4176 }, { name: 'Ιωάννινα', lat: 39.665, lon: 20.8537 },
  { name: 'Ρόδος', lat: 36.4356, lon: 28.2278 },
  { name: 'Αλεξανδρούπολη', lat: 40.8499, lon: 25.8764 }, { name: 'Καβάλα', lat: 40.9396, lon: 24.4069 },
  { name: 'Δράμα', lat: 41.1528, lon: 24.1473 }, { name: 'Σέρρες', lat: 41.085, lon: 23.5476 },
  { name: 'Κοζάνη', lat: 40.2993, lon: 21.7898 }, { name: 'Φλώρινα', lat: 40.782, lon: 21.4098 },
  { name: 'Καστοριά', lat: 40.5217, lon: 21.2634 }, { name: 'Τρίκαλα', lat: 39.5549, lon: 21.7684 },
  { name: 'Καρδίτσα', lat: 39.3648, lon: 21.9219 }, { name: 'Βόλος', lat: 39.3692, lon: 22.9477 },
  { name: 'Λαμία', lat: 38.8995, lon: 22.4335 }, { name: 'Χαλκίδα', lat: 38.4635, lon: 23.6028 },
  { name: 'Αγρίνιο', lat: 38.6214, lon: 21.4078 }, { name: 'Άρτα', lat: 39.1601, lon: 20.9856 },
  { name: 'Πρέβεζα', lat: 38.9562, lon: 20.7505 }, { name: 'Κέρκυρα', lat: 39.6244, lon: 19.9202 },
  { name: 'Ζάκυνθος', lat: 37.7802, lon: 20.8956 }, { name: 'Πύργος', lat: 37.6751, lon: 21.441 },
  { name: 'Καλαμάτα', lat: 37.0391, lon: 22.1126 }, { name: 'Σπάρτη', lat: 37.0745, lon: 22.4301 },
  { name: 'Τρίπολη', lat: 37.5096, lon: 22.3788 }, { name: 'Ναύπλιο', lat: 37.5686, lon: 22.8069 },
  { name: 'Χανιά', lat: 35.5112, lon: 24.0292 }, { name: 'Ρέθυμνο', lat: 35.3655, lon: 24.4823 },
  { name: 'Άγιος Νικόλαος', lat: 35.1911, lon: 25.7152 }, { name: 'Μυτιλήνη', lat: 39.1077, lon: 26.5553 },
  { name: 'Χίος', lat: 38.3687, lon: 26.1372 }, { name: 'Σάμος', lat: 37.7543, lon: 26.977 },
  { name: 'Κως', lat: 36.8929, lon: 27.2877 }, { name: 'Σύρος', lat: 37.4415, lon: 24.9192 },
];
const fmt = (value: number) => value.toLocaleString('el-GR');
const checkedFetch = async (url: string, signal: AbortSignal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
};
const planeIcon = (heading: number | null, greek: boolean) => L.divIcon({ className: 'aircraft-icon', iconSize: [30, 30], iconAnchor: [15, 15], html: '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" style="transform:rotate(' + (Number.isFinite(heading) ? heading : 0) + 'deg)"><path d="M15 2 C16.4 2 17 4 17 6 L17 12 L27 17 L27 20 L17 17 L17 24 L20 26 L20 28 L15 26 L10 28 L10 26 L13 24 L13 17 L3 20 L3 17 L13 12 L13 6 C13 4 13.6 2 15 2Z" fill="' + (greek ? '#2678c9' : '#e78136') + '" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>' });
const circle = (point: [number, number], color: string, radius = 6) =>
  L.circleMarker(point, { radius, color: '#ffffff', weight: 1.5, fillColor: color, fillOpacity: .92 });
const symbol = (glyph: string, color: string, label: string) => L.divIcon({ className: 'thematic-symbol', iconSize: [34, 34], iconAnchor: [17, 17], html: '<span style="background:' + color + '" title="' + label.replace(/"/g, '&quot;') + '">' + glyph + '</span>' });

export function MapLayers({ mapRef, active, onArea, onPlane, onAirQuality, onEEA, onStatus }: Props) {
  useEffect(() => {
    if (!active.population || !mapRef.current) return;
    const map = mapRef.current; const controller = new AbortController(); let layer: L.GeoJSON | undefined;
    const canvas = L.canvas({ padding: .3 });
    onStatus('population', 'Φόρτωση απογραφής 2021…');
    const bounds = map.getBounds().pad(.15);
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',');
    checkedFetch('/api/v1/geo/areas?dataset=elstat-municipalities&bbox=' + encodeURIComponent(bbox), controller.signal).then(data => {
      if (controller.signal.aborted) return;
      layer = L.geoJSON(data, {
        style: feature => {
          const pop = Number(feature?.properties?.pop21 || 0);
          const fillColor = pop < 10000 ? '#d9f2de' : pop < 30000 ? '#7fcea7' : pop < 100000 ? '#2c997f' : '#156258';
          return { renderer: canvas, color: '#42786e', weight: .85, fillColor, fillOpacity: .66 };
        },
        onEachFeature: (feature, shape) => {
          const name = String(feature.properties?.NAME_GR ?? 'Δήμος');
          const pop = Number(feature.properties?.pop21 ?? 0);
          shape.bindTooltip(name + ' · ' + fmt(pop) + ' κάτοικοι', { sticky: true });
          shape.on('click', event => { L.DomEvent.stopPropagation(event); onArea(name, 'Μόνιμος πληθυσμός απογραφής 2021: ' + fmt(pop) + ' κάτοικοι · ΕΛΣΤΑΤ'); });
        },
      }).addTo(map);
      onStatus('population', '333 δήμοι · απογραφή 2021');
    }).catch(error => { if (!controller.signal.aborted) onStatus('population', 'Αδυναμία φόρτωσης δεδομένων'); console.error(error); });
    return () => { controller.abort(); if (layer) map.removeLayer(layer); };
  }, [mapRef, active.population, onArea, onStatus]);

  useEffect(() => {
    if (!active.airports || !mapRef.current) return;
    const map = mapRef.current; const controller = new AbortController(); const layer = L.layerGroup().addTo(map);
    onStatus('airports', 'Φόρτωση αεροδρομίων…');
    checkedFetch('/data/greek-airports.json', controller.signal).then((data: { airports: Airport[] }) => {
      if (controller.signal.aborted) return;
      for (const airport of data.airports) {
        circle([airport.lat, airport.lon], '#8054a6', 6).bindTooltip(airport.name)
          .on('click', event => { L.DomEvent.stopPropagation(event); onArea(airport.name, 'Αεροδρόμιο · ' + (airport.iata || airport.ident) + ' · OurAirports'); }).addTo(layer);
      }
      onStatus('airports', fmt(data.airports.length) + ' αεροδρόμια με προγραμματισμένες πτήσεις · OurAirports');
    }).catch(error => { if (!controller.signal.aborted) onStatus('airports', 'Αδυναμία φόρτωσης αεροδρομίων'); console.error(error); });
    return () => { controller.abort(); map.removeLayer(layer); };
  }, [mapRef, active.airports, onArea, onStatus]);

  useEffect(() => {
    if (!active.aircraft || !mapRef.current) return;
    const map = mapRef.current; const controller = new AbortController(); const layer = L.layerGroup().addTo(map);
    onStatus('aircraft', 'Φόρτωση στιγμιότυπου πτήσεων…');
    checkedFetch('/data/aircraft-live.json?refresh=' + Math.floor(Date.now() / 1800000), controller.signal)
      .then((data: { fetchedAt: number; time: number; states: Plane[] }) => {
        if (controller.signal.aborted) return;
        const age = Math.max(0, Math.round((Date.now() / 1000 - data.fetchedAt) / 60));
        for (const plane of data.states) {
          if (!Number.isFinite(plane.latitude) || !Number.isFinite(plane.longitude)) continue;
          L.marker([plane.latitude, plane.longitude], { icon: planeIcon(plane.heading, plane.originCountry === 'Greece'), zIndexOffset: plane.originCountry === 'Greece' ? 10000 : 0 })
            .bindTooltip((plane.callsign || plane.icao24) + ' · Πάτησε για πλήρη καρτέλα')
            .on('click', event => { L.DomEvent.stopPropagation(event); onPlane({ ...plane, snapshotTime: data.time }); }).addTo(layer);
        }
        onStatus('aircraft', fmt(data.states.length) + ' αεροσκάφη · στιγμιότυπο πριν ' + age + ' λεπτά' + (age > 60 ? ' (παλιό)' : ''));
      }).catch(error => { if (!controller.signal.aborted) onStatus('aircraft', 'Δεν υπάρχει διαθέσιμο στιγμιότυπο'); console.error(error); });
    return () => { controller.abort(); map.removeLayer(layer); };
  }, [mapRef, active.aircraft, onPlane, onStatus]);

  useEffect(() => {
    if (!active.marine || !mapRef.current) return;
    const map = mapRef.current; const controller = new AbortController(); let layer: L.GeoJSON | undefined;
    onStatus('marine', 'Φόρτωση θαλάσσιων περιοχών…');
    checkedFetch('/data/greek-sea-areas.geojson', controller.signal).then(data => {
      if (controller.signal.aborted) return;
      layer = L.geoJSON(data, { style: { renderer: L.canvas(), color: '#2784b9', weight: 1.3, fillColor: '#6fb7d8', fillOpacity: .13 }, onEachFeature: (feature, shape) => shape.bindTooltip(String(feature.properties?.name ?? 'Θαλάσσια περιοχή')) }).addTo(map);
      onStatus('marine', 'Ιόνιο και Αιγαίο · IHO / Marine Regions · γεωγραφικές περιοχές');
    }).catch(error => { if (!controller.signal.aborted) onStatus('marine', 'Αδυναμία φόρτωσης γεωμετρίας'); console.error(error); });
    return () => { controller.abort(); if (layer) map.removeLayer(layer); };
  }, [mapRef, active.marine, onStatus]);

  useEffect(() => {
    if (!active.weather || !mapRef.current) return;
    const map = mapRef.current; const controller = new AbortController(); const layer = L.layerGroup().addTo(map);
    onStatus('weather', 'Φόρτωση προγνωστικού μοντέλου…');
    const coords = 'latitude=' + cities.map(c => c.lat).join(',') + '&longitude=' + cities.map(c => c.lon).join(',');
    checkedFetch('https://api.open-meteo.com/v1/forecast?' + coords + '&current=temperature_2m,precipitation,wind_speed_10m&timezone=Europe%2FAthens', controller.signal).then((data: Array<{ current: { time: string; temperature_2m: number; precipitation: number; wind_speed_10m: number } }>) => {
      if (controller.signal.aborted) return;
      for (const [index, city] of cities.entries()) {
        const value = data[index]?.current;
        if (!value || !Number.isFinite(value.temperature_2m)) continue;
        L.marker([city.lat, city.lon], { icon: symbol('☀', '#daa53e', 'Καιρός') }).bindTooltip(city.name + ' · ' + value.temperature_2m + '°C')
          .on('click', event => { L.DomEvent.stopPropagation(event); onArea(city.name, 'Μοντέλο Open-Meteo · ' + value.time.replace('T', ' ') + ' · ' + value.temperature_2m + '°C · βροχή ' + value.precipitation + ' mm · άνεμος ' + value.wind_speed_10m + ' km/h'); }).addTo(layer);
      }
      onStatus('weather', 'Μοντέλο καιρού · ' + layer.getLayers().length + ' ενδεικτικές πόλεις');
    }).catch(error => { if (!controller.signal.aborted) onStatus('weather', 'Η υπηρεσία καιρού δεν αποκρίνεται'); console.error(error); });
    return () => { controller.abort(); map.removeLayer(layer); };
  }, [mapRef, active.weather, onArea, onStatus]);

  useEffect(() => {
    if (!active.airQuality || !mapRef.current) return;
    const map = mapRef.current; const controller = new AbortController(); const layer = L.layerGroup().addTo(map);
    onStatus('airQuality', 'Φόρτωση εκτίμησης ποιότητας αέρα…');
    let pointRequest: AbortController | null = null;
    const handleMapClick = (event: L.LeafletMouseEvent) => {
      pointRequest?.abort();
      pointRequest = new AbortController();
      const { lat, lng } = event.latlng;
      checkedFetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat.toFixed(5) + '&longitude=' + lng.toFixed(5) + '&current=pm2_5,pm10,european_aqi&timezone=Europe%2FAthens', pointRequest.signal)
        .then((data: { current?: { time: string; pm2_5: number; pm10: number; european_aqi: number } }) => {
          const value = data.current;
          if (!value || !Number.isFinite(value.european_aqi)) return;
          onAirQuality({ city: 'Επιλεγμένο σημείο', time: value.time, aqi: value.european_aqi, pm25: Number.isFinite(value.pm2_5) ? value.pm2_5 : null, pm10: Number.isFinite(value.pm10) ? value.pm10 : null });
        }).catch(error => { if (error.name !== 'AbortError') console.error('Ποιότητα αέρα στο επιλεγμένο σημείο:', error); });
    };
    map.on('click', handleMapClick);
    const coords = 'latitude=' + cities.map(c => c.lat).join(',') + '&longitude=' + cities.map(c => c.lon).join(',');
    checkedFetch('https://air-quality-api.open-meteo.com/v1/air-quality?' + coords + '&current=pm2_5,pm10,european_aqi&timezone=Europe%2FAthens', controller.signal).then((data: Array<{ current: { time: string; pm2_5: number; pm10: number; european_aqi: number } }>) => {
      if (controller.signal.aborted) return;
      let visibleCities = 0;
      for (const [index, city] of cities.entries()) {
        const value = data[index]?.current;
        if (!value || !Number.isFinite(value.european_aqi)) continue;
        const band = airQualityBand(value.european_aqi);
        const reading: AirReading = { city: city.name, time: value.time, aqi: value.european_aqi, pm25: Number.isFinite(value.pm2_5) ? value.pm2_5 : null, pm10: Number.isFinite(value.pm10) ? value.pm10 : null };
        const marker = L.marker([city.lat, city.lon], { icon: symbol('♨', band.color, 'Ποιότητα αέρα') }).bindTooltip(city.name + ' · Αέρας: ' + band.name + ' (' + value.european_aqi + ')')
          .on('click', event => { L.DomEvent.stopPropagation(event); onAirQuality(reading); });
        marker.addTo(layer);
        visibleCities++;
      }
      onStatus('airQuality', 'Εκτίμηση μοντέλου σε ' + visibleCities + ' πόλεις · πάτησε κουκκίδα ή τον χάρτη');
    }).catch(error => { if (!controller.signal.aborted) onStatus('airQuality', 'Η υπηρεσία αέρα δεν αποκρίνεται'); console.error(error); });
    return () => { controller.abort(); pointRequest?.abort(); map.off('click', handleMapClick); map.removeLayer(layer); };
  }, [mapRef, active.airQuality, onAirQuality, onStatus]);
  useEffect(() => {
    if (!active.eeaAir || !mapRef.current) return;
    const map = mapRef.current; const layer = L.layerGroup().addTo(map);
    let controller: AbortController | null = null;
    const load = async () => {
      controller?.abort(); const request = new AbortController(); controller = request;
      layer.clearLayers(); onEEA(null);
      try {
        const data = await checkedFetch('/api/v1/air/eea', request.signal) as { readings: EEAReading[]; totalPoints: number; invalidPoints: number; collectedAt: string };
        if (request.signal.aborted) return;
        if (!Array.isArray(data.readings)) throw new Error('Invalid EEA response');
        layer.clearLayers();
        let visible = 0;
        for (const reading of data.readings) {
          if (!eeaReadingFresh(reading)) continue;
          const value = Math.round(reading.value).toLocaleString('el-GR');
          const marker = L.marker([reading.latitude, reading.longitude], {
            icon: L.divIcon({ className: 'eea-station-icon', html: '<span>' + value + '</span>', iconSize: [38, 38], iconAnchor: [19, 19] }),
            zIndexOffset: 1000, title: reading.name + ' - PM2.5', alt: reading.name + ' - PM2.5',
          });
          const tooltip = document.createElement('span');
          tooltip.textContent = reading.name + ' · PM2.5: ' + reading.value.toLocaleString('el-GR') + ' µg/m³ · μέτρηση σταθμού';
          marker.bindTooltip(tooltip).on('click', event => { L.DomEvent.stopPropagation(event); onEEA(reading); }).addTo(layer);
          visible++;
        }
        onStatus('eeaAir', visible ? `${visible} σταθμοί PM2.5 · έγκυρες μετρήσεις έως 24ωρο · EEA` : 'Δεν υπάρχουν μετρήσεις PM2.5 τελευταίου 24ώρου · EEA');
        if (!visible) onEEA(null);
      } catch (error) {
        if (!request.signal.aborted) onStatus('eeaAir', 'Οι μετρήσεις EEA δεν είναι διαθέσιμες');
        if (error instanceof Error && error.name !== 'AbortError') console.error('EEA:', error);
      }
    };
    onStatus('eeaAir', 'Φόρτωση πραγματικών μετρήσεων…');
    void load();
    const interval = window.setInterval(() => { void load(); }, 15 * 60_000);
    return () => { controller?.abort(); window.clearInterval(interval); map.removeLayer(layer); };
  }, [mapRef, active.eeaAir, onEEA, onStatus]);

  useEffect(() => { if (!active.earthquakes || !mapRef.current) return; const map=mapRef.current; const layer=L.layerGroup().addTo(map); const controller=new AbortController(); onStatus('earthquakes','Φόρτωση σεισμών USGS…'); checkedFetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',controller.signal).then((data:any)=>{ for(const item of (data.features||[])){ const c=item.geometry?.coordinates,p=item.properties||{}; if(!c) continue; const mag=Number(p.mag||0); L.marker([c[1],c[0]],{icon:symbol('✦',mag>=5?'#a52f54':mag>=4?'#d16b38':'#c19a36','Σεισμός')}).bindTooltip((p.place||'Σεισμός')+' · M'+mag.toFixed(1)).on('click',(ev:any)=>{L.DomEvent.stopPropagation(ev);onArea(p.place||'Σεισμός','USGS · M'+mag.toFixed(1)+' · βάθος '+Math.round(c[2]||0)+' km · '+new Date(p.time||0).toLocaleString('el-GR')+(p.url?' · '+p.url:''))}).addTo(layer); } onStatus('earthquakes','Σεισμοί τελευταίου 24ώρου · USGS'); }).catch(()=>onStatus('earthquakes','Οι σεισμοί USGS δεν είναι διαθέσιμοι')); return ()=>{controller.abort();map.removeLayer(layer)}; }, [mapRef,active.earthquakes,onArea,onStatus]);

  useEffect(() => { if (!active.openaq || !mapRef.current) return; const map=mapRef.current; const layer=L.layerGroup().addTo(map); const controller=new AbortController(); onStatus('openaq','Φόρτωση OpenAQ…'); checkedFetch('https://api.openaq.org/v3/locations?limit=100&country=GR',controller.signal).then((data:any)=>{let n=0; for(const item of (data.results||[])){const lat=item.coordinates?.latitude,lon=item.coordinates?.longitude;if(!Number.isFinite(lat)||!Number.isFinite(lon))continue; const name=item.name||item.locality||'Σταθμός OpenAQ'; L.marker([lat,lon],{icon:symbol('♨','#3478a8','OpenAQ')}).bindTooltip(name).on('click',(ev:any)=>{L.DomEvent.stopPropagation(ev);onArea(name,'OpenAQ · σταθμός ατμοσφαιρικής ποιότητας · '+(item.city||'Ελλάδα'));}).addTo(layer);n++;} onStatus('openaq',n+' σταθμοί · OpenAQ'); }).catch(()=>onStatus('openaq','Το OpenAQ απαιτεί διαθέσιμο API endpoint ή κλειδί')); return ()=>{controller.abort();map.removeLayer(layer)}; }, [mapRef,active.openaq,onArea,onStatus]);

  useEffect(() => { if (!active.copernicus || !mapRef.current) return; const map=mapRef.current; const layer=L.layerGroup().addTo(map); const controller=new AbortController(); onStatus('copernicus','Φόρτωση Sentinel-2…'); checkedFetch('/api/v1/copernicus/sentinel2',controller.signal).then((data:any)=>{const items=data.features||[]; items.forEach((item:any)=>{const b=item.bbox; const lon=Array.isArray(b)&&b.length>=4?(b[0]+b[2])/2:23.8,lat=Array.isArray(b)&&b.length>=4?(b[1]+b[3])/2:38.5; const cloud=Number(item.cloudCover); L.marker([lat,lon],{icon:symbol('🛰','#315ca8','Sentinel-2')}).bindTooltip('Sentinel-2 · '+(item.datetime||'').slice(0,10)+' · νέφη '+(Number.isFinite(cloud)?cloud.toFixed(1):'—')+'%').bindPopup(item.thumbnailData ? '<img src="data:image/jpeg;base64,'+item.thumbnailData+'" style="width:280px;display:block" alt="Sentinel-2" />' : 'Sentinel-2').on('click',(ev:any)=>{L.DomEvent.stopPropagation(ev);onArea('Sentinel-2','Copernicus · λήψη '+(item.datetime||'').slice(0,10)+' · νεφοκάλυψη '+(Number.isFinite(cloud)?cloud.toFixed(1):'—')+'%');}).addTo(layer)}); onStatus('copernicus',items.length+' διαθέσιμες λήψεις Sentinel-2');}).catch(()=>onStatus('copernicus','Το Sentinel-2 δεν είναι διαθέσιμο')); return ()=>{controller.abort();map.removeLayer(layer)}; }, [mapRef,active.copernicus,onArea,onStatus]);
  return null;
}









