// Module entrées, étape 3 : coût par image avant et après, apparié et alterné dans un même processus,
// domaine principal de Node (pas de node:vm). Même image que t2/cout.mjs : quelques événements (touches, bouton
// de souris, un mouvement), frame(), puis 1 pas, ou 2 une image sur trois. Chauffe de 20 000 images par module,
// puis 10 paires de séries de 100 000 images, dans un ordre alterné. Relève aussi le coût d'un normalize
// (profil v1 migré), appelé au chargement des réglages et à chaque configure, jamais par image.
//   node docs/chantier-moteur/preuves/module-entrees/t3/cout-apparie.mjs <racine avant> <racine après>
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const roots = process.argv.slice(2, 4).map(r => resolve(r));
// A root is named by its commit, plus « arbre de travail » when src/input.js has uncommitted changes.
const label = root => { const git = (...a) => spawnSync('git', ['-C', root, ...a], {encoding: 'utf8'}).stdout.trim(); return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--', 'src/input.js') ? ' + arbre de travail' : ''); };
if (roots.length !== 2) { console.error('usage : node cout-apparie.mjs <racine avant> <racine après>'); process.exit(2); }
const {METAL_INPUT: M, V1_KEYS} = await import(new URL('checks/finput-fixture.mjs', 'file://' + roots[1] + '/').href);
let sink = 0;
const benches = roots.map(root => {
  const w = {navigator: {getGamepads: () => []}}; new Function('window', readFileSync(root + '/src/input.js', 'utf8'))(w);
  const F = w.FInput, inp = F.create(M);
  const frames = (n, i0) => {
    for (let i = i0; i < i0 + n; i++) {
      if (i % 7 === 0) inp.keyDown('KeyW', i, false); if (i % 7 === 3) inp.keyUp('KeyW', i);
      if (i % 11 === 0) inp.keyDown('KeyR', i, false); if (i % 11 === 1) inp.keyUp('KeyR', i);
      if (i % 13 === 0) inp.button('fire', i % 26 === 0, i, 'mouse');
      inp.mouseMove(3, -2, i);
      const f = inp.frame(1 / 60), s = inp.step(); if (i % 3 === 0) inp.step();
      sink += f.pressed.length + s.moveY + s.lookX;
    }
  };
  const normalize = n => { for (let i = 0; i < n; i++) sink += F.normalize({v: 1, keys: V1_KEYS}, M).keys.dash.length; };
  return {frames, normalize, i: 0};
});
const time = f => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t); };
for (const b of benches) { b.frames(20000, 0); b.i = 20000; b.normalize(2000); }
const ns = [[], []], nz = [[], []];
for (let k = 0; k < 10; k++) for (const j of k % 2 ? [1, 0] : [0, 1]) {
  const b = benches[j];
  ns[j].push(time(() => b.frames(100000, b.i)) / 100000); b.i += 100000;
  nz[j].push(time(() => b.normalize(2000)) / 2000);
}
const med = a => { const s = [...a].sort((x, y) => x - y); return (s[4] + s[5]) / 2; };
const r1 = v => +v.toFixed(1);
const out = {tool: 'cout-apparie.mjs', node: process.version, arch: process.arch, platform: process.platform, avant: label(roots[0]), apres: label(roots[1]),
  nsParImage: {avant: ns[0].map(r1), apres: ns[1].map(r1), medianeAvant: r1(med(ns[0])), medianeApres: r1(med(ns[1])), rapportApresSurAvant: +(med(ns[1]) / med(ns[0])).toFixed(3)},
  nsParNormalizeV1: {avant: nz[0].map(r1), apres: nz[1].map(r1), medianeAvant: r1(med(nz[0])), medianeApres: r1(med(nz[1]))}, sink: sink > 0};
console.log(JSON.stringify(out, null, 1));
