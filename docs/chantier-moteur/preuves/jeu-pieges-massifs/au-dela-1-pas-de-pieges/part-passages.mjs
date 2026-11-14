// Part de FPassages dans la génération, mesurée en enrobant les deux points
// d'entrée appelés par world.js. Usage : node part-passages.mjs [racine] [--reps 3]
import { loadRealm } from '../../../../../tools/realm-loader.mjs';

const args = process.argv.slice(2);
const root = args[0] && !args[0].startsWith('--') ? args[0] : '.';
const i = args.indexOf('--reps');
const reps = i < 0 ? 3 : Number(args[i + 1]);
const { window } = loadRealm({ root, modules: ['fmath', 'passages', 'world'] });
const { FWorld, FPassages } = window;

const calls = new Map();
for (const name of ['grid', 'flood', 'reaches', 'cuts', 'nearestFree', 'mandatoryLinks', 'tourLinks']) {
  const original = FPassages[name];
  FPassages[name] = function (...a) {
    const t0 = process.hrtime.bigint();
    try { return original.apply(this, a); } finally {
      const e = calls.get(name) || { n: 0, ns: 0 };
      e.n++; e.ns += Number(process.hrtime.bigint() - t0);
      calls.set(name, e);
    }
  };
}

let worlds = 0, genNs = 0;
for (let pass = 0; pass < reps; pass++) {
  for (const seed of [1, 7, 96, 1234]) for (let stage = 0; stage < 3; stage++) {
    const t0 = process.hrtime.bigint(); FWorld.create(seed, stage); genNs += Number(process.hrtime.bigint() - t0); worlds++;
  }
  for (let w = 0; w < 108; w++) {
    const t0 = process.hrtime.bigint();
    FWorld.create(4000 + w, 0, { variant: 'campaign', width: 44 + (w % 5) * 6, height: 40 + ((w >> 2) % 5) * 6 });
    genNs += Number(process.hrtime.bigint() - t0); worlds++;
  }
}
let sum = 0;
for (const [name, e] of [...calls].sort((a, b) => b[1].ns - a[1].ns)) {
  if (name === 'mandatoryLinks' || name === 'tourLinks') continue;
  sum += e.ns;
  console.log(name.padEnd(14), String(e.n).padStart(6), 'appels', (e.ns / 1e6).toFixed(0).padStart(7), 'ms',
    (100 * e.ns / genNs).toFixed(2).padStart(6), '% de la génération');
}
const direct = (calls.get('mandatoryLinks')?.ns || 0) + (calls.get('tourLinks')?.ns || 0);
console.log('—'.repeat(52));
console.log('génération totale'.padEnd(14), String(worlds).padStart(6), 'mondes', (genNs / 1e6).toFixed(0).padStart(7), 'ms');
console.log('FPassages (hors liens publics)'.padEnd(14), (sum / 1e6).toFixed(0).padStart(13), 'ms', (100 * sum / genNs).toFixed(2).padStart(6), '%');
console.log('liens publics englobants'.padEnd(14), (direct / 1e6).toFixed(0).padStart(13), 'ms', (100 * direct / genNs).toFixed(2).padStart(6), '%');
