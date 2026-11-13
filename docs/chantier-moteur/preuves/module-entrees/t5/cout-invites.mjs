// Module entrées, étape 5 : coût des nouveaux appels, après seulement (ils n'existent pas avant), domaine principal de
// Node (pas de node:vm). Un tour : label() des 23 actions de METAL sur les quatre appareils (92 appels, clavier AZERTY
// appris et une manette PlayStation active), puis 92 appels de rumble() avec une horloge qui avance de 25 ms (un sur
// deux passe le limiteur de 40 ms) vers un actionneur qui ne fait rien. Chauffe de 2 000 tours, puis 10 séries de
// 20 000 tours ; médianes en ns par appel.
//   node docs/chantier-moteur/preuves/module-entrees/t5/cout-invites.mjs [racine]
import {readFileSync} from 'node:fs';
const root = process.argv[2] || new URL('../../../../../', import.meta.url).pathname;
const {METAL_INPUT: M, fakePad, PAD_IDS} = await import('file://' + root + '/checks/finput-fixture.mjs');
const actuator = {n: 0, playEffect() { this.n++; return {catch() {}}; }};
const pad = fakePad({id: PAD_IDS.ps, press: {A: 1}, actuator}), w = {navigator: {getGamepads: () => [pad]}};
new Function('window', readFileSync(root + '/src/input.js', 'utf8'))(w);
const inp = w.FInput.create(M), ids = M.actions.map(a => a.id), devices = ['keyboard', 'mouse', 'touch', 'gamepad'];
for (const [c, k] of [['KeyW', 'z'], ['KeyZ', 'w'], ['KeyA', 'q'], ['KeyQ', 'a'], ['KeyM', ',']]) { inp.keyDown(c, 0, false, k); inp.keyUp(c); }
inp.frame(1 / 60);
let sink = 0, t = 0;
const labels = () => { for (const d of devices) for (const id of ids) sink += inp.label(id, d).length; };
const rumbles = () => { for (let i = 0; i < 92; i++) { t += 25; sink += inp.rumble(.5, .3, 80, t) ? 1 : 0; } };
const time = (f, n) => { const s = process.hrtime.bigint(); for (let i = 0; i < n; i++) f(); return Number(process.hrtime.bigint() - s) / (n * 92); };
time(labels, 2000); time(rumbles, 2000);
const L = [], R = [];
for (let k = 0; k < 10; k++) { if (k % 2) { R.push(time(rumbles, 20000)); L.push(time(labels, 20000)); } else { L.push(time(labels, 20000)); R.push(time(rumbles, 20000)); } }
const med = a => { const s = [...a].sort((x, y) => x - y); return +((s[4] + s[5]) / 2).toFixed(1); };
console.log(JSON.stringify({tool: 'cout-invites.mjs', node: process.version, arch: process.arch, platform: process.platform,
  labelNsParAppel: {mediane: med(L), series: L.map(v => +v.toFixed(1))}, rumbleNsParAppel: {mediane: med(R), series: R.map(v => +v.toFixed(1))},
  appelsActionneur: actuator.n, sink: sink > 0}, null, 1));
