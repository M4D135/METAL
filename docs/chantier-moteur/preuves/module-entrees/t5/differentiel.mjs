// Module entrées, étape 5 : le resserrement du source (16 681 → 16 253 octets) garde le comportement des étapes 1 à 4.
// Des sessions tirées d'une graine (lcg du fixture) sont jouées en miroir sur le module d'avant et sur celui d'après, dans
// le domaine principal de Node (new Function, pas node:vm), avec les mêmes manettes simulées. Chaque sortie est comparée
// par une sérialisation exacte : -0, NaN, ±Infinity et undefined sont distingués. Seuls les cinq messages d'erreur
// raccourcis sont rapprochés, par la table RENAMED ; tout autre écart compte.
// Les membres de l'étape 5 (keyLabel, setLayout, label, rumble, glyph, guessDevice) sont hors comparaison. Le 4e argument
// de keyDown (key) est tiré lui aussi, pour montrer qu'il ne change rien d'autre que les libellés.
//   node docs/chantier-moteur/preuves/module-entrees/t5/differentiel.mjs <racine avant> <racine après> [sessions]
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const [ra, rb, nArg] = process.argv.slice(2);
if (!ra || !rb) { console.error('usage : node differentiel.mjs <racine avant> <racine après> [sessions]'); process.exit(2); }
const roots = [resolve(ra), resolve(rb)], N = Number(nArg) || 400, OPS = 300;
const label = root => { const git = (...a) => spawnSync('git', ['-C', root, ...a], {encoding: 'utf8'}).stdout.trim(); return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--', 'src/input.js') ? ' + arbre de travail' : ''); };
const {METAL_INPUT: M, V1_KEYS, fakePad, lcg, PAD_IDS} = await import('file://' + roots[1] + '/checks/finput-fixture.mjs');
const pads = {list: [], mode: 'list'};
const getGamepads = () => { if (pads.mode === 'throw') throw new Error('test'); return pads.mode === 'null' ? null : pads.list; };
const F = roots.map(root => { const w = {navigator: {getGamepads}}; new Function('window', readFileSync(root + '/src/input.js', 'utf8'))(w); return w.FInput; });
const RENAMED = [['allowKey doit être une fonction', 'allowKey invalide'], ['actions doit être un tableau non vide', 'actions invalides'],
  ['identifiant d’action invalide : ', 'id invalide : '], ['identifiant en double : ', 'id en double : '], ['getGamepads doit être une fonction', 'getGamepads invalide']];
const renamed = Object.fromEntries(RENAMED.map(([a]) => [a, 0]));
const fix = m => { for (const [a, b] of RENAMED) if (m.includes(a)) { renamed[a]++; m = m.replace(a, b); } return m; };
const ser = v => JSON.stringify(v, (k, x) => typeof x === 'number' && (!Number.isFinite(x) || Object.is(x, -0)) ? 'nombre:' + (Object.is(x, -0) ? '-0' : x) : x === undefined ? 'undefined' : x) ?? 'undefined';
const run = (f, old) => { try { return ser({ok: f()}); } catch (e) { return ser({erreur: old ? fix(String(e.message)) : String(e.message)}); } };
let comparisons = 0, gaps = 0;
const firstGaps = [];
const same = (where, a, b) => { comparisons++; if (a !== b) { gaps++; if (firstGaps.length < 8) firstGaps.push({where, avant: a.slice(0, 300), apres: b.slice(0, 300)}); } };
const both = (where, f) => same(where, run(() => f(F[0], 0), true), run(() => f(F[1], 1), false));
// inputs built twice from the same seed, so that neither module sees what the other one changed
const twice = (seed, make) => [make(lcg(seed)), make(lcg(seed))];
const pickOf = r => a => a[Math.floor(r() * a.length)];
const CODES = ['KeyW', 'KeyZ', 'KeyA', 'KeyQ', 'KeyS', 'KeyD', 'KeyR', 'KeyE', 'KeyV', 'KeyF', 'KeyM', 'KeyP', 'KeyX', 'KeyC', 'KeyG', 'KeyJ', 'KeyT', 'KeyY', 'KeyB',
  'Space', 'Enter', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Digit1', 'Digit2', 'Digit5', 'Digit9', 'Tab', 'Backspace',
  'ControlLeft', 'Semicolon', 'F5', 'Escape', '', undefined, null, 5];
const KEYS = ['z', 'a', 'Z', 'é', '&', ',', ' ', 'Dead', 'Unidentified', '', undefined, 'ab', '😀', 5];
const IDS = M.actions.map(a => a.id).concat(['inconnu', 'moveX', 'toString', undefined]);
const BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Home', 'Z9', undefined];
const DEVICES = ['keyboard', 'mouse', 'touch', 'gamepad', 'pen', undefined, 5];
const NUMS = [0, .1, .12, .2, .3, .31, .5, .6, .92, .97, 1, -1, -.5, 2, NaN, Infinity, -0];
function rawSettings(r) {
  const pick = pickOf(r), k = r();
  if (k < .06) return pick([null, 5, 'x', [], {v: 'x'}, undefined]);
  if (k < .09) { const c = {v: 2}; c.self = c; return c; }
  if (k < .11) return {v: 2, get keys() { throw new Error('test'); }};
  const s = F[1].defaults(M);
  if (k < .2) { s.v = pick([1, 0, undefined, '1']); s.keys = JSON.parse(JSON.stringify(V1_KEYS)); if (r() < .5) s.keys.dash = pick([['Space'], ['Space', 'KeyR'], ['KeyR'], []]); }
  for (let n = Math.floor(r() * 4); n > 0; n--) {
    const id = pick(IDS), t = r();
    if (t < .35) (s.keys ??= {})[id] = Array.from({length: Math.floor(r() * 4.4)}, () => pick(CODES));
    else if (t < .6) (s.pad ??= {})[id] = Array.from({length: Math.floor(r() * 3.3)}, () => pick(BUTTONS));
    else if (t < .9) (s.tune ??= {})[pick(Object.keys(F[1].defaults(M).tune).concat(['inconnu']))] = r() < .7 ? pick(NUMS) : pick([true, false, 'x', null]);
    else delete s[pick(['keys', 'pad', 'tune', 'v'])];
  }
  if (r() < .05) s.keys = pick([null, 5, [], 'x']);
  if (r() < .05) s.pad = pick([null, 5, [], 'x']);
  return s;
}
function newPad(r) {
  const pick = pickOf(r), p = fakePad({index: pick([0, 1, 2, 3]), id: pick([PAD_IDS.xbox, PAD_IDS.ps, PAD_IDS.other, '']), mapping: pick(['standard', '', 'xinput'])});
  const k = r();
  if (k < .05) delete p.index; else if (k < .1) delete p.id; else if (k < .14) p.buttons = p.buttons.map(b => b.value);
  else if (k < .17) delete p.buttons; else if (k < .2) delete p.axes;
  return p;
}
function movePads(r) {
  const pick = pickOf(r), k = r();
  pads.mode = k < .03 ? 'throw' : k < .05 ? 'null' : 'list';
  if (k > .05 && k < .1) pads.list = [];
  else if (k < .2) pads.list.push(newPad(r));
  else if (k < .25) pads.list.splice(Math.floor(r() * pads.list.length), 1);
  else if (k < .27) pads.list = [null, ...pads.list];
  else if (k < .28) pads.list.push(pick([5, 'x', null, undefined]));
  else if (k < .31) { const p = pick(pads.list); if (p && typeof p === 'object') p.connected = r() < .5; }
  for (const p of pads.list) if (p && typeof p === 'object') {
    if (p.axes) for (let j = 0; j < 4; j++) if (r() < .3) p.axes[j] = r() < .5 ? pick(NUMS) : r() * 2 - 1;
    if (Array.isArray(p.buttons)) for (let j = 0; j < p.buttons.length; j++) if (r() < .08) {
      const v = r() < .6 ? pick([0, .1, .18, .2, .3, .31, .5, .6, 1, NaN]) : r(), b = p.buttons[j];
      if (typeof b === 'object') { b.value = v; b.pressed = r() < .8 ? v > .5 : r() < .5; } else p.buttons[j] = v;
    }
  }
}
// static API (glyph and guessDevice excluded)
const sr = lcg(20261113), spick = pickOf(sr);
for (let i = 0; i < 4000; i++) {
  const c = spick(CODES), x = spick(NUMS), y = sr() * 2 - 1, a = spick(NUMS), b = spick(NUMS);
  both('keyName', f => f.keyName(c));
  both('radial', f => f.radial(x, y, a, b));
  const pid = spick([PAD_IDS.xbox, PAD_IDS.ps, PAD_IDS.other, 'Sony 054c', 'XBOX', '', undefined, 5]);
  both('padStyle', f => f.padStyle(pid));
  const seed = 1000 + i, [s0, s1] = twice(seed, rawSettings), dev = spick(DEVICES), act = spick(IDS), code = dev === 'gamepad' ? spick(BUTTONS) : spick(CODES);
  same('normalize', run(() => F[0].normalize(s0, M), true), run(() => F[1].normalize(s1, M)));
  const [t0, t1] = twice(seed, rawSettings);
  same('assign', run(() => F[0].assign(M, t0, dev, act, code), true), run(() => F[1].assign(M, t1, dev, act, code)));
  const [u0, u1] = twice(seed, rawSettings);
  same('unbind', run(() => F[0].unbind(M, u0, dev, act), true), run(() => F[1].unbind(M, u1, dev, act)));
}
both('defaults', f => f.defaults(M));
both('PAD_BUTTONS', f => f.PAD_BUTTONS);
both('TUNE', f => f.TUNE);
// invalid declarations, one change at a time
const alter = [
  c => null, c => 5, c => [], c => ({...c, allowKey: 5}), c => ({...c, allowKey: x => x === 'KeyW'}), c => ({...c, actions: []}), c => ({...c, actions: 5}),
  c => ({...c, actions: undefined}), c => ({...c, actions: [{}]}), c => ({...c, actions: [{id: '1a', type: 'hold'}]}), c => ({...c, actions: [...c.actions, {...c.actions[0]}]}),
  c => ({...c, actions: [{id: 'a', type: 'tap'}]}), c => ({...c, actions: [{id: 'a', type: 'hold', label: 5}]}), c => ({...c, actions: [{id: 'a', type: 'hold', touch: 5}]}),
  c => ({...c, actions: [{id: 'a', type: 'hold', alt: [5]}]}), c => ({...c, actions: [{id: 'a', type: 'hold', keys: ['KeyA', 'KeyB', 'KeyC', 'KeyD']}]}),
  c => ({...c, actions: [{id: 'a', type: 'hold', keys: ['F5']}]}), c => ({...c, actions: [{id: 'a', type: 'hold', pad: ['Home']}]}),
  c => ({...c, actions: [{id: 'a', type: 'hold', keys: ['KeyA']}, {id: 'b', type: 'hold', keys: ['KeyA']}]}),
  c => ({...c, actions: [{id: 'a', type: 'hold', pad: ['A']}, {id: 'b', type: 'hold', pad: ['A']}]}), c => ({...c, sticks: 5}),
  c => ({...c, sticks: {Move: c.sticks.move}}), c => ({...c, sticks: {move: {type: 'x'}}}), c => ({...c, sticks: {move: c.sticks.move, walk: c.sticks.move}}),
  c => ({...c, sticks: {forward: {type: 'look'}}}), c => ({...c, sticks: {move: {...c.sticks.move, x: ['left']}}}), c => ({...c, sticks: {move: {...c.sticks.move, x: ['jump', 'dash']}}}),
  c => ({...c, sticks: {move: {...c.sticks.move, y: ['left', 'right']}}}), c => ({...c, sticks: {move: {...c.sticks.move, pad: 'XS'}}}),
  c => ({...c, sticks: {move: c.sticks.move, look: {...c.sticks.look, pad: 'LS'}}}), c => ({...c, sticks: {look: {...c.sticks.look, run: 'sprint'}}}),
  c => ({...c, sticks: {move: {...c.sticks.move, run: 'jump'}}}), c => ({...c, sticks: {move: {...c.sticks.move, rate: 2}}}), c => ({...c, sticks: {look: {...c.sticks.look, rate: 0}}}),
  c => ({...c, sticks: {look: {...c.sticks.look, rate: NaN}}}), c => ({...c, version: 0}), c => ({...c, version: 1.5}), c => ({...c, device: 'pen'}),
  c => ({...c, device: 'gamepad'}), c => ({...c, mouseScale: NaN}), c => ({...c, getGamepads: 5}), c => ({...c, migrate: 5}), c => ({...c, settings: {v: 2, keys: {jump: ['KeyW']}}})
];
for (const [i, a] of alter.entries()) for (const name of ['create', 'defaults', 'normalize', 'assign', 'unbind']) {
  const call = f => { const c = a(M); return name === 'create' ? f.create(c).settings : name === 'defaults' ? f.defaults(c) : name === 'normalize' ? f.normalize({}, c) : name === 'assign' ? f.assign(c, {}, 'keyboard', 'jump', 'KeyK') : f.unbind(c, {}, 'gamepad', 'jump'); };
  both('déclaration ' + i + ' ' + name, call);
}
// sessions
const added = Object.keys(F[1].create(M)).filter(k => !(k in F[0].create(M))), removed = Object.keys(F[0].create(M)).filter(k => !(k in F[1].create(M)));
let ops = 0;
const seen = {images: 0, imagesAvecManette: 0, imagesAppareilManette: 0, connexions: 0, deconnexions: 0, capturesClavier: 0, capturesManette: 0, appuis: 0, affectationsReussies: 0, conflits: 0};
const tally = (res, kind) => {
  if (kind === 'frame') { seen.images++; if (res.pads.length) seen.imagesAvecManette++; if (res.device === 'gamepad') seen.imagesAppareilManette++; seen.connexions += res.connected.length; seen.deconnexions += res.disconnected.length; seen.appuis += res.pressed.length; if (res.captured) seen[res.captured.device === 'gamepad' ? 'capturesManette' : 'capturesClavier']++; }
  else if (res && res.ok) seen.affectationsReussies++; else if (res && res.conflict) seen.conflits++;
  return res;
};
for (let n = 0; n < N; n++) {
  const r = lcg(7000 + n), pick = pickOf(r);
  pads.list = []; pads.mode = 'list';
  const cfg = r() < .3 ? {...M, device: pick(['mouse', 'touch', 'gamepad']), mouseScale: pick([.0022, .004])} : M;
  const seed0 = 9000 + n, [c0, c1] = r() < .4 ? twice(seed0, rawSettings).map(s => ({...cfg, settings: s})) : [cfg, cfg];
  const I = [F[0].create(c0), F[1].create(c1)];
  const pair = (where, f) => same(where, run(() => f(I[0]), true), run(() => f(I[1])));
  let t = 0;
  for (let k = 0; k < OPS; k++, ops++) {
    t += r() < .02 ? pick([NaN, -100, 0]) : r() * 40;
    const op = r();
    if (op < .2) { const c = pick(CODES), rep = r() < .2, key = pick(KEYS); pair('keyDown', i => i.keyDown(c, t, rep, key)); }
    else if (op < .32) { const c = pick(CODES); pair('keyUp', i => i.keyUp(c)); }
    else if (op < .42) { const dx = r() < .9 ? r() * 40 - 20 : pick([NaN, Infinity, 'x']), dy = r() * 30 - 15; pair('mouseMove', i => i.mouseMove(dx, dy, t)); }
    else if (op < .52) { const id = pick(IDS), d = r() < .5, dev = pick(DEVICES); pair('button', i => i.button(id, d, t, dev)); }
    else if (op < .55) { const x = pick(NUMS), y = r() - .5, dev = pick(DEVICES); pair('addLook', i => i.addLook(x, y, dev)); }
    else if (op < .57) pair('clear', i => i.clear());
    else if (op < .6) { const s = 5000 + n * OPS + k, raws = twice(s, rawSettings); let j = 0; pair('configure', i => i.configure(raws[j++])); }
    else if (op < .64) {
      const dev = pick(DEVICES), act = pick(IDS), code = dev === 'gamepad' ? pick(BUTTONS) : pick(CODES), un = r() < .3, apply = r() < .6;
      pair(un ? 'unbind' : 'assign', i => { const res = un ? i.unbind(dev, act) : i.assign(dev, act, code); if (apply && res.ok) i.configure(res.settings); return i === I[1] ? tally(res) : res; });
    }
    else if (op < .66) { const dev = pick(DEVICES); pair('capture', i => i.capture(dev)); }
    else if (op < .86) {
      movePads(r);
      const dt = pick([1 / 60, 1 / 60, 1 / 60, 1 / 30, 1 / 144, 0, -1, NaN, .5, undefined]), ctx = pick([undefined, undefined, {lookScale: .5}, {lookScale: NaN}, null, {lookScale: 2}]);
      pair('frame', i => { const res = i.frame(dt, ctx); return i === I[1] ? tally(res, 'frame') : res; });
    }
    else pair('step', i => i.step());
    pair('après chaque appel', i => ({device: i.device, look: i.pendingLook(), settings: i.settings}));
  }
}
const out = {tool: 'differentiel.mjs', node: process.version, arch: process.arch, platform: process.platform, avant: label(roots[0]), apres: label(roots[1]),
  sessions: N, appelsParSession: OPS, appelsJoues: ops, couverture: seen, comparaisons: comparisons, ecarts: gaps, premiersEcarts: firstGaps,
  messagesRapproches: renamed, membresAjoutesALInstance: added, membresRetires: removed,
  exclus: 'keyLabel, setLayout, label et rumble (absents avant) ; glyph et guessDevice (souches vides avant)'};
console.log(JSON.stringify(out, null, 1));
process.exitCode = gaps ? 1 : 0;
