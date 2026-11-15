// Sonde RESTE-01 : octets alloués par IMAGE COMPLÈTE (simulation + modèles + rendu),
// la scène tournant réellement entre les marqueurs. Pour la part des producteurs seuls,
// voir alloc-models.mjs.
// usage: node tools/proof/lot05/alloc-image.mjs <racine> [images=1200] [monde=camp:6] [executions=5]
//
// Deux mesures, publiées ensemble :
//  1. `koParImageTrace` — le père relance le banc lui-même sous `node --trace-gc` et somme
//     les octets repris par les Scavenge et Mark-Compact entre les marqueurs. C'est LA
//     mesure de l'allocation : elle compte aussi ce que le tas a repris pendant la boucle.
//  2. `koParImage` — différence de `process.memoryUsage().heapUsed` entre deux GC complets.
//     Simple mais aveugle aux scavenges survenus pendant la boucle : son intervalle sur
//     plusieurs exécutions est large, elle n'est publiable qu'en médiane.
// Une seule exécution ne publie rien : le banc exige 3 exécutions et rend la médiane
// avec son intervalle (sortie 2 sinon).
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import v8 from 'node:v8';

const root = resolve(process.argv[2] || '.');
const frames = +(process.argv[3] || 1200), [kind, idx] = (process.argv[4] || 'camp:6').split(':');
const runs = Math.max(1, +(process.argv[5] || 5));
const child = process.argv.includes('--child');
const monde = kind + ':' + idx;

if (!child) {
  const executions = [];
  for (let k = 0; k < runs; k++) {
    const r = spawnSync(process.execPath, ['--trace-gc', import.meta.filename, process.argv[2] || '.', String(frames), monde, String(runs), '--child'], {encoding: 'utf8', maxBuffer: 1 << 28});
    const out = r.stdout || '';
    const trace = r.stdout || '';
    const lignes = trace.split('\n');
    const start = lignes.findIndex(l => l.includes('### START'));
    const end = lignes.findIndex(l => l.includes('### END'));
    let repris = 0, scavenge = 0, major = 0, ms = null;
    for (const l of lignes.slice(Math.max(0, start), end < 0 ? lignes.length : end)) {
      const m = l.match(/(Scavenge|Mark-Compact|Mark-sweep|Minor Mark-Sweep)[^,]*?([\d.]+) \(([\d.]+)\) -> ([\d.]+) \(([\d.]+)\) MB, (?:pooled: [\d.]+ MB, )?([\d.]+) \/ ([\d.]+) ms/);
      if (!m) continue;
      repris += (parseFloat(m[2]) - parseFloat(m[4])) * 1024;
      if (/Scavenge|Minor/.test(m[1])) scavenge++; else major++;
    }
    const fin = lignes.find(l => l.includes('### END')) || '';
    const mms = fin.match(/(\d+) ms/);
    if (mms) ms = +mms[1];
    if (start < 0 || end < 0) { console.error('banc fils sans marqueurs :', out.slice(0, 400), trace.slice(0, 400)); process.exit(1); }
    executions.push({koParImageTrace: +(repris / frames).toFixed(1), scavenge, major, msParImage: ms === null ? null : +(ms / frames).toFixed(3)});
  }
  const q = (v, p) => { const a = v.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; };
  const t = executions.map(e => e.koParImageTrace);
  console.log(JSON.stringify({banc: 'node tools/proof/lot05/alloc-image.mjs <racine> <images> <monde> <executions>',
    monde, images: frames, executions: runs, node: process.version,
    koParImageTrace: +q(t, .5).toFixed(1), intervalleKoParImageTrace: [+Math.min(...t).toFixed(1), +Math.max(...t).toFixed(1)],
    executionsDetail: executions,
    methode: 'octets repris par le ramasse-miettes entre les marqueurs du banc fils (mesure principale) ; '
      + 'la différence de heapUsed entre deux GC complets, publiée par le fils, reste une borne basse '
      + 'aveugle aux scavenges survenus pendant la boucle. Le banc fils déroule frame() complet : '
      + 'simulation, modèles et rendu. Pour les producteurs seuls, voir alloc-models.mjs.',
    fiable: runs >= 3}, null, 1));
  if (runs < 3) process.exitCode = 2;
} else {
  const {makeScene} = await import(pathToFileURL(root + '/tools/proof/render-scene.mjs').href);
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  const S = makeScene(root, {world: [kind, +idx], seed: 96, quality: 'auto', content: false});
  for (let i = 0; i < 150; i++) S.frame(1 / 60, {time: false});
  for (let k = 0; k < 4; k++) gc();
  const avant = process.memoryUsage().heapUsed;
  console.log('### START');
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < frames; i++) S.frame(1 / 60, {time: false});
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log('### END', monde, frames, 'frames', ms.toFixed(0), 'ms');
  const pic = process.memoryUsage().heapUsed;
  for (let k = 0; k < 4; k++) gc();
  const apres = process.memoryUsage().heapUsed;
  console.log(JSON.stringify({monde, images: frames,
    koParImage: +((pic - avant) / 1024 / frames).toFixed(1),
    koParImageVivant: +((apres - avant) / 1024 / frames).toFixed(1),
    koParImageRamasse: +((pic - apres) / 1024 / frames).toFixed(1),
    msParImage: +(ms / frames).toFixed(3)}));
  S.sim.dispose(); S.renderer.dispose();
}
