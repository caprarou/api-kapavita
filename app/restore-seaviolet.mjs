import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
const source=process.env.AIS_POSITION_CACHE || '/home/dev/.local/share/kapavita/seaviolet-last-position.json';
const target=new URL('./dist/data/seaviolet-last-position.json',import.meta.url).pathname;
try {
  const payload=await readFile(source,'utf8');
  const p=JSON.parse(payload);
  if (p.mmsi!==248554000 || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) || !Number.isFinite(Date.parse(p.observedAt))) throw Error('AIS cache invalid');
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target+'.tmp',payload);
  await rename(target+'.tmp',target);
  console.log('Restored last verified SEAVIOLET AIS position after build');
} catch (error) {
  if (error.code!=='ENOENT') { console.error('AIS cache was not restored:',error.message); process.exitCode=1; }
}
