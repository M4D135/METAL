// Part de l'horloge dans pump10Us (banc-couts.json) : même protocole que le banc (10 tâches, 200 000 pump(4)), avec
// performance.now() puis avec une horloge constante, alternés ; et le coût d'une lecture de performance.now().
// Domaine principal (loadRealm). Une série de chauffe, puis 5 ; médianes. N'écrit rien.
// Usage, depuis la racine : node docs/chantier-moteur/preuves/module-boucle/etape-6-pump-horloge.mjs
import {fileURLToPath} from 'node:url';
import {loadRealm} from '../../../../tools/realm-loader.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const {FSchedule} = loadRealm({root, modules: ['schedule'], realm: 'main'}).window;
const N = 2e5, READS = 6.2e6;
function pump(now) {
  const S = FSchedule.create({now});
  for (let k = 0; k < 10; k++) S.add({key: k, priority: k % 3, cost: .001, run() { return false; }});
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) S.pump(4);
  return Number(process.hrtime.bigint() - t0) / N / 1000;
}
function readNs() {
  let s = 0;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < READS; i++) s += performance.now();
  return [Number(process.hrtime.bigint() - t0) / READS, s];
}
const real = [], fixed = [], reads = [];
for (let r = 0; r <= 5; r++) {
  const a = pump(() => performance.now()), b = pump(() => 0), c = readNs()[0];
  if (r) { real.push(a); fixed.push(b); reads.push(c); }
}
const med = v => [...v].sort((x, y) => x - y)[v.length >> 1];
console.log(process.platform + ' ' + process.arch + ' ' + process.version + ' : pump10 ' + med(real).toFixed(3) + ' µs avec performance.now(), ' +
  med(fixed).toFixed(3) + ' µs avec une horloge constante ; performance.now() ' + med(reads).toFixed(1) + ' ns, soit ' +
  (31 * med(reads) / 1000).toFixed(3) + ' µs pour les 31 lectures d\'un pump de 10 tâches');
