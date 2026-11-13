// Étape 8, passe à part (hors banc) : la pré-synthèse de FAudio par FSchedule, selon le plafond de pump pendant
// l'écran de chargement (plan de raccord, point 12). Même protocole que la variante B de tools/boucle-banc-audio.mjs
// (une tâche « image » par tampon, priorité 6, coût 2), avec pump(4), pump(8) et pump(12) en alternance ;
// 5 répétitions, médianes. Domaine principal, temps CPU du fil. N'écrit rien ; code 1 si le PCM change.
// node docs/chantier-moteur/preuves/module-boucle/etape-8-plafond.mjs  (depuis la racine)
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadRealm} from '../../../../tools/realm-loader.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const FAudio = loadRealm({root, modules: ['music', 'audio'], realm: 'main'}).window.FAudio;
const FSchedule = loadRealm({root, modules: ['schedule'], realm: 'main'}).window.FSchedule;
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const jobs = [];
for (const n of FAudio.effectNames) for (let v = 0; v < (n.startsWith('motor:') ? 1 : 2); v++) jobs.push([n, v]);
const digest = list => { const h = createHash('sha256'); for (const a of list) h.update(new Uint8Array(a.buffer)); return h.digest('hex'); };
const ref = digest(jobs.map(([n, v]) => FAudio.synthesize(n, v, 22050)));   // chauffe et PCM de référence
function scheduled(budget) {
  const S = FSchedule.create({now: cpu}), pcm = [], slices = [];
  jobs.forEach(([n, v], k) => S.add({key: 'pcm:' + n + ':' + v, priority: 6, cost: 2, run() { pcm[k] = FAudio.synthesize(n, v, 22050); }}));
  while (S.count('frame')) slices.push(S.pump(budget));
  return {slices: slices.length, longest: Math.max(...slices), over16_7: slices.filter(x => x > 16.7).length,
    total: slices.reduce((s, x) => s + x, 0), same: digest(pcm) === ref};
}
const BUDGETS = [4, 8, 12], REPS = 5, rows = Object.fromEntries(BUDGETS.map(b => [b, []]));
for (let r = 0; r < REPS; r++) for (const b of r % 2 ? [...BUDGETS].reverse() : BUDGETS) rows[b].push(scheduled(b));
const median = v => [...v].sort((a, b) => a - b)[v.length >> 1];
let ok = true;
console.log('charge ' + os.loadavg().map(x => x.toFixed(2)).join(' / ') + ' ; ' + process.platform + ' ' + process.arch + ', ' + os.cpus()[0].model + ', Node ' + process.version);
for (const b of BUDGETS) {
  const v = rows[b], k = key => v.map(x => x[key]);
  if (!v.every(x => x.same)) ok = false;
  console.log('pump(' + b + ') : ' + Math.min(...k('slices')) + ' à ' + Math.max(...k('slices')) + ' tranches (médiane ' + median(k('slices')) +
    ') ; plus longue ' + median(k('longest')).toFixed(1) + ' ms (' + Math.min(...k('longest')).toFixed(1) + ' à ' + Math.max(...k('longest')).toFixed(1) +
    ') ; au-delà de 16,7 ms : ' + Math.max(...k('over16_7')) + ' au plus ; total ' + median(k('total')).toFixed(1) + ' ms ; PCM ' + (v.every(x => x.same) ? 'identique' : 'DIFFÉRENT'));
}
if (!ok) process.exit(1);
