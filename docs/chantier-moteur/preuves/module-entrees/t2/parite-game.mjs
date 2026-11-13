// Module entrées, étape 2 (TACT-09) : FInput contre le VRAI src/game.js, au clavier et à la souris.
// Mêmes événements envoyés aux deux ; à chaque pas de simulation, la structure `input` que game.js passe à
// sim.step doit égaler, champ par champ et au bit près (après normalisation de -0), la sortie de inp.step().
// Puis les deux flux sont rejoués dans une simulation neuve : même empreinte d'état.
// game.js tourne dans le harnais LOOP de l'audit (DOM factice, horloge virtuelle, rien n'est écrit dans le dépôt).
// Le tampon d'intention de tir de 150 ms (lot 01, FOptions.fireBufferMs) reste dans game.js et n'est pas dans
// FInput : il est mis à 0 dans la copie mémoire, pour comparer la part « tenue » du tir, qu'il complète par OU.
//   node docs/chantier-moteur/preuves/module-entrees/t2/parite-game.mjs [racine] [--out fichier.json]
import {readFileSync, writeFileSync} from 'node:fs';
import {createHarness} from '../../../bancs/loop/harness.mjs';
import {stateHash} from '../../../bancs/tact/lib.mjs';
import {METAL_INPUT, lcg} from '../../../../../checks/finput-fixture.mjs';

const args = process.argv.slice(2), outAt = args.indexOf('--out'), out = outAt >= 0 ? args[outAt + 1] : null;
const root = args.find((a, i) => !a.startsWith('--') && i !== outAt + 1) || new URL('../../../../../', import.meta.url).pathname;
const FIELDS = ['moveX', 'moveY', 'lookX', 'lookY', 'fire', 'fireLeft', 'sprint', 'dash', 'pulse', 'melee', 'interact'];
// Keys of the current game table (FOptions v1: Space dodges): several keys per held action, one per impulse.
const KEYS = ['KeyW', 'KeyZ', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'KeyQ', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Enter', 'KeyC', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'KeyV', 'KeyF'];
const n0 = x => x === 0 ? 0 : x;

async function game(prefs) {
  const rec = [];
  const H = createHarness(root, {search: '', width: 1280, height: 720, dpr: 2, beforeGame(ctx) {
    ctx.FOptions.fireBufferMs = 0;
    const create = ctx.FSimulation.create;
    ctx.FSimulation.create = (...a) => { const sim = create(...a), step = sim.step;
      sim.step = (dt, input) => { if (H.recording) { const r = {dt}; for (const k of [...FIELDS, 'weapon', 'assist']) r[k] = input[k]; rec.push(r); } return step(dt, input); };
      return sim; };
  }});
  await H.startGame();
  Object.assign(H.G.prefs, prefs);
  H.doc.pointerLockElement = H.canvas; // the mouse is captured, as in play
  return {H, rec};
}
function finput() {
  const w = {navigator: {getGamepads: () => []}};
  new Function('window', readFileSync(root + '/src/input.js', 'utf8'))(w);
  return w.FInput;
}

async function session(name, prefs, seed, frames) {
  const {H, rec} = await game(prefs), F = finput(), inp = F.create(METAL_INPUT);
  const p = H.G.prefs, applied = inp.configure({v: 2, keys: JSON.parse(JSON.stringify(p.bindings)), tune: {sensitivity: p.sensitivity, invertY: p.invertY}});
  const r = lcg(seed), down = new Set();
  const clamp = H.ctx.FSimulation.clamp;
  let T = H.now, last = T, mouseButton = null, twoSteps = 0, cut = 0, compared = 0, firstBad = null, shops = 0, repeats = 0;
  const bad = Object.fromEntries(FIELDS.map(k => [k, 0])), trues = Object.fromEntries(FIELDS.slice(4).map(k => [k, 0])), mine = [];
  H.recording = true;
  for (let i = 0; i < frames; i++) {
    const gap = 1000 / 144 + r() * (1000 / 30 - 1000 / 144), t = T + gap * .5;
    H.now = t;
    for (const code of KEYS) if (r() < .06) {
      const isDown = down.has(code);
      H.key(isDown ? 'keyup' : 'keydown', code);
      if (isDown) { down.delete(code); inp.keyUp(code, t); } else { down.add(code); inp.keyDown(code, t, false, ''); }
    }
    // One mouse button at a time: the harness reports buttons:0 on every pointerup.
    if (r() < .08) {
      if (mouseButton === null) { mouseButton = r() < .7 ? 0 : 2; H.mouse.down(mouseButton); inp.button(mouseButton ? 'fireLeft' : 'fire', true, t, 'mouse'); }
      else { H.mouse.up(mouseButton); inp.button(mouseButton ? 'fireLeft' : 'fire', false, t, 'mouse'); mouseButton = null; }
    }
    for (let n = Math.floor(r() * 4); n > 0; n--) {
      const dx = Math.floor(r() * 41) - 20, dy = Math.floor(r() * 41) - 20;
      H.mouse.move(dx, dy); inp.mouseMove(dx, dy, t);
    }
    const before = rec.length; T += gap; H.frame(T);
    const steps = rec.slice(before);
    // The frame dt of game.js, computed as it does; checked against the part it gave to sim.step.
    const dt = clamp(Math.max(0, T - last) / 1000, 0, .12), planned = Math.max(1, Math.ceil(dt * 60 - .06)); last = T;
    if (!steps.length || steps.length > planned || steps[0].dt !== dt / planned) throw new Error(name + ' : image ' + i + ', mode ' + H.G.mode + ', ' + steps.length + ' pas, dt ' + dt);
    if (planned === 2) twoSteps++;
    if (steps.length < planned) cut++; // a mode change (shop) ends the loop of game.js after the current step
    inp.frame(dt);
    for (const g of steps) {
      const s = inp.step(); compared++;
      mine.push({...g, ...Object.fromEntries(FIELDS.map(k => [k, s[k]]))});
      for (const k of FIELDS) {
        if (s[k] === true) trues[k]++; // steps where the held action or the impulse is true
        if (!Object.is(n0(s[k]), n0(g[k]))) { bad[k]++; firstBad ??= {image: i, field: k, finput: s[k], game: g[k]}; }
      }
    }
    // Light god mode after each image (the session measures inputs, not combat); the replays heal at the same points.
    heal(H.G.sim); steps.at(-1).heal = true; mine.at(-1).heal = true;
    // Interact near a terminal opens the shop. setMode() calls clearInput() on the way in and on the way out,
    // which the hookup maps to inp.clear(); the browser's auto-repeat then brings the held keys back, without an edge.
    if (H.G.mode === 'shop') {
      shops++; inp.clear(); H.now = T; H.G.setMode('playing'); last = T; inp.clear(); H.doc.pointerLockElement = H.canvas;
      for (const code of down) { H.key('keydown', code, true); inp.keyDown(code, T, true, ''); repeats++; }
    }
    if (H.G.mode !== 'playing') throw new Error(name + ' : image ' + i + ', mode ' + H.G.mode);
  }
  H.recording = false;
  const numbers = Object.fromEntries(['moveX', 'moveY', 'lookX', 'lookY'].map(k => [k, new Set(mine.map(x => x[k])).size]));
  return {name, prefs: {sensitivity: p.sensitivity, invertY: p.invertY}, bindings: applied.keys, frames, steps: compared, twoStepFrames: twoSteps, framesCutByModeChange: cut,
    mismatches: bad, firstMismatch: firstBad, trueCounts: trues, distinctValues: numbers, shopsOpened: shops, repeatsAfterClear: repeats, shots: H.G.sim.state.shots, hashSession: stateHash(H.G.sim), rec, mine};
}
const heal = sim => { sim.state.player.hp = sim.state.maxHp || 100; };
async function replay(stream) {
  const {H} = await game({});
  for (const r of stream) { H.G.sim.step(r.dt, {...r}); if (r.heal) heal(H.G.sim); }
  return stateHash(H.G.sim);
}

const t0 = process.hrtime.bigint(), report = {tool: 'parite-game.mjs', node: process.version, arch: process.arch, sessions: []};
for (const [name, prefs, seed] of [['sensibilité 1', {sensitivity: 1, invertY: false}, 11], ['sensibilité 1,7 et invertY', {sensitivity: 1.7, invertY: true}, 12]]) {
  const s = await session(name, prefs, seed, 900);
  const hashGame = await replay(s.rec), hashFInput = await replay(s.mine);
  const {rec, mine, ...rest} = s;
  report.sessions.push({...rest, hashReplayGame: hashGame, hashReplayFInput: hashFInput, sameHash: hashGame === hashFInput && hashGame === s.hashSession});
}
report.ok = report.sessions.every(s => s.sameHash && Object.values(s.mismatches).every(v => v === 0));
report.seconds = Number(process.hrtime.bigint() - t0) / 1e9;
const text = JSON.stringify(report, null, 1);
if (out) writeFileSync(out, text + '\n');
console.log(text);
process.exitCode = report.ok ? 0 : 1;
