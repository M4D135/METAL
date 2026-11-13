// Module entrées, étape 4 : les chiffres de FEEL-10 relevés sur FInput, avant et après, à côté du prototype de l'audit
// (bancs/feel/gamepad-map.mjs). FInput est chargé dans le domaine principal de Node ; la simulation, par le chargeur
// de l'audit (bancs/feel/load.mjs, node:vm) : des valeurs, pas un temps. Rien n'est écrit hors de ce dossier.
//   node docs/chantier-moteur/preuves/module-entrees/t4/manette.mjs <racine avant> <racine après> [sortie.json]
import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const [before, after] = process.argv.slice(2, 4).map(r => r && resolve(r)), outFile = process.argv[4];
if (!before || !after) { console.error('usage : node manette.mjs <racine avant> <racine après> [sortie.json]'); process.exit(2); }
const here = new URL('.', import.meta.url), bancs = new URL('../../../bancs/feel/', here);
const {createPad} = await import(new URL('gamepad-map.mjs', bancs).href);
const {load, flatWorld} = await import(new URL('load.mjs', bancs).href);
const {METAL_INPUT: M, fakePad, lcg} = await import('file://' + after + '/checks/finput-fixture.mjs');
const label = root => { const git = (...a) => spawnSync('git', ['-C', root, ...a], {encoding: 'utf8'}).stdout.trim(); return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--', 'src/input.js') ? ' + arbre de travail' : ''); };
const DEG = 180 / Math.PI, r3 = v => v === null ? null : +v.toFixed(3), r1 = v => v === null ? null : +v.toFixed(1);
const SIM_FIELDS = ['moveX', 'moveY', 'lookX', 'lookY', 'fire', 'fireLeft', 'sprint'];
function measure(root) {
  const w = {navigator: {getGamepads: () => w.pads}}; w.pads = [];
  new Function('window', readFileSync(root + '/src/input.js', 'utf8'))(w);
  const F = w.FInput, make = tune => { const inp = F.create(M); if (tune) { const s = inp.settings; Object.assign(s.tune, tune); inp.configure(s); } return inp; };
  const frame = (inp, pad, dt = 1 / 60, ctx) => { w.pads = pad ? [pad] : []; const f = inp.frame(dt, ctx); return {f, s: inp.step()}; };
  const yaw = (d, ctx) => frame(make(), fakePad({axes: [0, 0, d, 0]}), 1 / 60, ctx).s.lookX * 60 * DEG;
  // Frames until the summed yaw reaches π (to 1e-9 rad: without the boost, 72 frames of 1/120 s land on π up to rounding).
  const turn = (dt, tune) => { const inp = make(tune), pad = fakePad({axes: [0, 0, 1, 0]}); let a = 0; for (let k = 1; k <= 400; k++) { a += frame(inp, pad, dt).s.lookX; if (a >= Math.PI - 1e-9) return k; } return null; };
  const out = {module: label(root), radial: typeof F.radial(0, -.55, .15, .97)};
  out.lacet = [.05, .12, .2, .35, .5, .7, .85, .95, 1].map(d => ({deflexion: d, degParS: r1(yaw(d)), surCible: r1(yaw(d, {lookScale: .55}))}));
  const k120 = turn(1 / 120), k60 = turn(1 / 60), flat = turn(1 / 120, {padBoost: 0});
  out.demiTour = {images120: k120, ms120: k120 && r1(k120 / .12), images60: k60, ms60: k60 && r1(k60 / .06), sansSurcroitMs: flat && r1(flat / .12)};
  out.viseeFine = {degParImage: r3(yaw(.2) / 60)};
  out.tangage = {degParS: r1(frame(make(), fakePad({axes: [0, 0, 0, -1]})).s.lookY * 60 * DEG), inverse: r1(frame(make({padInvertY: true}), fakePad({axes: [0, 0, 0, -1]})).s.lookY * 60 * DEG)};
  const mv = make(), at = y => frame(mv, fakePad({axes: [0, y, 0, 0]})).s;
  out.deplacement = {moveY55: +at(-.55).moveY.toFixed(6), course90: at(-.9).sprint, course91: at(-.91).sprint, moveY100: at(-1).moveY};
  const rt = make(), fire = [], fronts = [];
  [.25, .31, .20, .17, .29, .31].forEach((v, i) => { const {f, s} = frame(rt, fakePad({press: {RT: v}})); fire.push(s.fire); if (f.pressed.includes('fire')) fronts.push(i + 1); });
  out.gachette = {tir: fire, fronts};
  const hp = make(), plug = [frame(hp, null).f, frame(hp, fakePad()).f, frame(hp, fakePad()).f, frame(hp, null).f];
  out.branchement = {connected: plug.map(f => f.connected.length), disconnected: plug.map(f => f.disconnected.length), device: plug[1].device};
  // The real simulation, fed by step(): 2 s with the left stick at 55 %, then 2 s at full with the right stick at 40 %.
  const W = load(root, {modules: ['destruction', 'economy', 'simulation']}), sim = W.FSimulation.create(flatWorld(), {}), drive = make();
  const feed = (axes, n) => { for (let k = 0; k < n; k++) { const s = frame(drive, fakePad({axes})).s; sim.step(1 / 60, Object.fromEntries(SIM_FIELDS.map(f => [f, s[f]]))); } };
  feed([0, -.55, 0, 0], 120); const half = sim.state.locomotion.speed; feed([0, -1, .4, 0], 120);
  out.simulation = {vitesse55: +half.toFixed(2), vitesse100: +sim.state.locomotion.speed.toFixed(2), lacetApres2sA40: r1(sim.state.player.yaw * DEG)};
  return {out, F, make, frame};
}
const A = measure(before), B = measure(after);
// The prototype on the same figures, then a paired session against FInput (600 frames, seed 4, dt in [1/144, 1/30]).
const fake = axes => fakePad({axes}), proto = {lacet: [.05, .12, .2, .35, .5, .7, .85, .95, 1].map(d => ({deflexion: d, degParS: r1(createPad()(fake([0, 0, d, 0]), 1 / 60).yawRate), surCible: r1(createPad()(fake([0, 0, d, 0]), 1 / 60, {onTarget: true}).yawRate)}))};
{ const poll = createPad(); let a = 0, k = 0; while (a < 180 && k < 400) { a += poll(fake([0, 0, 1, 0]), 1 / 120).yawRate / 120; k++; } proto.demiTour = {images120: k, ms120: r1(k / .12)}; }
{ const W = load(after, {modules: ['destruction', 'economy', 'simulation']}), sim = W.FSimulation.create(flatWorld(), {}), poll = createPad();
  for (let i = 0; i < 120; i++) sim.step(1 / 60, poll(fake([0, -.55, 0, 0]), 1 / 60)); const half = sim.state.locomotion.speed;
  for (let i = 0; i < 120; i++) sim.step(1 / 60, poll(fake([0, -1, .4, 0]), 1 / 60));
  proto.simulation = {vitesse55: +half.toFixed(2), vitesse100: +sim.state.locomotion.speed.toFixed(2), lacetApres2sA40: r1(sim.state.player.yaw * DEG)}; }
const paired = (() => {
  const rnd = lcg(4), poll = createPad(), inp = B.make(), n0 = v => v === 0 ? 0 : v;
  let maxRel = 0, maxAbs = 0, boolDiff = 0, numDiff = 0, frames = 0, boosted = 0;
  const axis = () => { const r = rnd(); return r < .15 ? 0 : r < .3 ? Math.sign(rnd() - .5) : rnd() * 2 - 1; };
  for (let i = 0; i < 600; i++) {
    const dt = 1 / 144 + rnd() * (1 / 30 - 1 / 144), axes = [axis(), axis(), i % 120 < 60 ? 1 : axis(), axis()];
    const pad = fakePad({axes, press: {RT: rnd(), LT: rnd() < .5 ? 0 : rnd(), L3: rnd() < .1 ? 1 : 0}});
    const p = poll(pad, dt), s = B.frame(inp, pad, dt).s; frames++;
    if (p.yawRate > 300.5) boosted++;
    for (const k of SIM_FIELDS) {
      if (typeof p[k] === 'boolean') { if (p[k] !== s[k]) boolDiff++; continue; }
      const a = n0(p[k]), b = n0(s[k]), d = Math.abs(a - b);
      if (d > 0) numDiff++; maxAbs = Math.max(maxAbs, d); if (a !== 0) maxRel = Math.max(maxRel, d / Math.abs(a));
    }
  }
  return {images: frames, imagesAvecSurcroit: boosted, champs: SIM_FIELDS, ecartsBooleens: boolDiff, ecartsNumeriques: numDiff, ecartAbsoluMax: maxAbs, ecartRelatifMax: maxRel};
})();
const result = {tool: 'manette.mjs', node: process.version, arch: process.arch, platform: process.platform, avant: A.out, apres: B.out, prototype: proto, appariementPrototype: paired};
const text = JSON.stringify(result, null, 1);
if (outFile) writeFileSync(outFile, text + '\n');
console.log(text);
