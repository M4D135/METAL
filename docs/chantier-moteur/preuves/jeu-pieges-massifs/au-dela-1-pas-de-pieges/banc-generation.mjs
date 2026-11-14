// Profil de génération seule (108 mondes de campagne + classiques), pour le lot
// « jeu-pieges-massifs ». Lancer avec --cpu-prof, puis résumer avec
// ../../../jeu-bouclier-supprime/au-dela-1-generation/resumer-profil.mjs.
// Usage : node banc-generation.mjs [racine] [--reps 3]
import { readFileSync, readdirSync } from 'node:fs';
import { loadRealm } from '../../../../../tools/realm-loader.mjs';

const args = process.argv.slice(2);
const root = args[0] && !args[0].startsWith('--') ? args[0] : '.';
const i = args.indexOf('--reps');
const reps = i < 0 ? 3 : Number(args[i + 1]);
const { window } = loadRealm({ root, modules: ['fmath', 'passages', 'world'] });
const { FWorld } = window;

let worlds = 0;
for (let pass = 0; pass < reps; pass++) {
  for (const seed of [1, 7, 96, 1234]) for (let stage = 0; stage < 3; stage++) { FWorld.create(seed, stage); worlds++; }
  for (let w = 0; w < 108; w++) { FWorld.create(4000 + w, 0, { variant: 'campaign', width: 44 + (w % 5) * 6, height: 40 + ((w >> 2) % 5) * 6 }); worlds++; }
}
console.log('mondes générés :', worlds, '— passages.js lu :', readFileSync(root + '/src/passages.js', 'utf8').length, 'octets,', readdirSync(root + '/src').length, 'modules src');
