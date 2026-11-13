// Module entrées, étape 2 : coût indicatif de l'instance dans le domaine principal de Node (pas de node:vm).
// Une « image » = quelques événements (touches, bouton de souris, un mouvement), frame(), puis 1 pas, ou 2 une
// image sur trois. Chauffe de 20 000 images, puis 5 séries de 100 000 ; médiane en ns par image.
// Le banc complet, apparié, viendra avec tools/finput-bench.mjs (étape 8).
//   node docs/chantier-moteur/preuves/module-entrees/t2/cout.mjs [racine]
import {readFileSync} from 'node:fs';
const root = process.argv[2] || new URL('../../../../../', import.meta.url).pathname;
const {METAL_INPUT: M} = await import(new URL('checks/finput-fixture.mjs', 'file://' + root + '/').href);
const w = {navigator: {getGamepads: () => []}}; new Function('window', readFileSync(root + '/src/input.js', 'utf8'))(w);
const inp = w.FInput.create(M);
let sink = 0;
function run(n, i0) {
  for (let i = i0; i < i0 + n; i++) {
    if (i % 7 === 0) inp.keyDown('KeyW', i, false); if (i % 7 === 3) inp.keyUp('KeyW', i);
    if (i % 11 === 0) inp.keyDown('KeyR', i, false); if (i % 11 === 1) inp.keyUp('KeyR', i);
    if (i % 13 === 0) inp.button('fire', i % 26 === 0, i, 'mouse');
    inp.mouseMove(3, -2, i);
    const f = inp.frame(1 / 60), s = inp.step(); if (i % 3 === 0) inp.step();
    sink += f.pressed.length + s.moveY + s.lookX;
  }
}
run(20000, 0);
const ns = [];
for (let k = 0; k < 5; k++) { const t = process.hrtime.bigint(); run(100000, 20000 + k * 100000); ns.push(Number(process.hrtime.bigint() - t) / 100000); }
const sorted = [...ns].sort((a, b) => a - b);
console.log(JSON.stringify({tool: 'cout.mjs', node: process.version, arch: process.arch, nsPerFrame: ns.map(v => +v.toFixed(1)), median: +sorted[2].toFixed(1), sink: sink > 0}));
