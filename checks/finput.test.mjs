// FInput (src/input.js), the engine input layer: cases E01 to E50 listed in docs/chantier-moteur/modules/entrees.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {METAL_INPUT as M, lcg} from './finput-fixture.mjs';
const source = readFileSync(new URL('../src/input.js', import.meta.url), 'utf8');
function load(){ const pads = {list: []};
  const window = {navigator: {getGamepads: () => pads.list}, Event: class {constructor(type, init){this.type = type; this.bubbles = !!(init && init.bubbles);}}};
  const ctx = vm.createContext({window}); vm.runInContext(source, ctx); return {F: window.FInput, window, pads, ctx}; }
// Objects made in the vm realm have other prototypes: compare them as JSON, never with deepEqual.
const json = x => JSON.stringify(x);
// Deep copy of the fixture declaration (JSON drops the migrate function, put back here).
const copyM = () => Object.assign(JSON.parse(json(M)), {migrate: M.migrate});
const variant = (base, edit) => { const c = base(); edit(c); return c; };
function rejects(F, config, why, culprit){
  assert.throws(() => F.create(config), e => {
    assert.ok(e !== null && typeof e === 'object' && e.name === 'Error' && String(e.message).startsWith('FInput : '), why + ' : ' + e);
    if (culprit !== undefined) assert.ok(e.message.includes(culprit), why + ' : « ' + e.message + ' » ne cite pas ' + culprit);
    return true;
  }, why);
}

const STATIC = ['version', 'PAD_BUTTONS', 'TUNE', 'create', 'defaults', 'normalize', 'assign', 'unbind', 'keyName', 'radial', 'padStyle', 'glyph', 'guessDevice', 'focusMove'];
const PAD_SPEC = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'Up', 'Down', 'Left', 'Right', 'Home'];
const TUNE_SPEC = {sensitivity: [1, .25, 3], invertY: [false], padYaw: [300, 60, 600], padPitch: [190, 40, 400], padDead: [.12, 0, .4], moveDead: [.15, 0, .4], padCurve: [1.7, 1, 3], padBoost: [.8, 0, 1.5], padInvertY: [false], padVibration: [1, 0, 1], swapSticks: [false], touchAccel: [1, 0, 1], touchPitch: [1, .5, 1.5], stickRadius: [56, 32, 96]};

test('E01 — Chargement : API statique complète, seul FInput s’ajoute au global', () => {
  const {F, window, ctx} = load();
  assert.ok(F, 'window.FInput');
  assert.equal(F.version, 1);
  for (const name of STATIC) assert.notEqual(F[name], undefined, name);
  for (const name of STATIC.slice(3)) assert.equal(typeof F[name], 'function', name);
  assert.deepEqual(Object.keys(F).filter(k => k !== 'gyro'), STATIC);
  assert.deepEqual(Object.keys(window), ['navigator', 'Event', 'FInput']);
  assert.deepEqual(Object.keys(ctx), ['window']);
  // the constants of the specification, frozen
  assert.equal(json(F.PAD_BUTTONS), json(PAD_SPEC));
  assert.equal(json(F.TUNE), json(TUNE_SPEC));
  assert.ok(Object.isFrozen(F.PAD_BUTTONS) && Object.isFrozen(F.TUNE) && Object.values(F.TUNE).every(v => Object.isFrozen(v)));
  // without window, the module lands on the global object of its realm
  const bare = vm.createContext({}); vm.runInContext(source, bare);
  assert.equal(bare.FInput.version, 1); assert.deepEqual(Object.keys(bare), ['FInput']);
  // main realm, as the measurement tools load it
  const w = {navigator: {getGamepads: () => []}}; new Function('window', source)(w);
  assert.deepEqual(Object.keys(w), ['navigator', 'FInput']); assert.equal(typeof w.FInput.create, 'function');
});

test('E02 — Source propre : ni hasard, ni horloge, ni réseau, aucun nom propre au jeu, 18 000 octets au plus', () => {
  for (const s of ['Math.random', 'performance.now', 'Date.now', 'new Date', 'fetch(', 'XMLHttpRequest', 'WebSocket(', 'import(', '@import', '</script']) assert.ok(!source.includes(s), s);
  assert.doesNotMatch(source, /\b(fire\w*|jump|dash|sprint|weapon\w*|shield|melee|pulse|bash|metal)\b/i);
  const bytes = Buffer.byteLength(source);
  assert.ok(bytes <= 18000, bytes + ' octets');
  // Stricter guards. Time and chance only come in as parameters; no timer of its own.
  assert.doesNotMatch(source, /\b(?:Date|performance|crypto|setTimeout|setInterval|requestAnimationFrame)\b/);
  // What tools/build.py and checks/build.test.mjs refuse in the page, spaces and case included.
  assert.ok(!source.toLowerCase().includes('</script'));
  assert.doesNotMatch(source, /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|import\s*\(|@import)/);
  assert.doesNotMatch(source, /<(?:script|img|audio|video|link)\b[^>]*(?:src|href)\s*=\s*["'](?:https?:|\/\/)/i);
  for (const s of ['__GAME_VERSION__', '/*__CODE__*/', '/*__STYLE__*/']) assert.ok(!source.includes(s), 'marque de build.py : ' + s);
  // A classic script: no module syntax; LF line endings, no BOM.
  assert.doesNotMatch(source, /^\s*(?:import|export)\b/m);
  assert.ok(!source.includes('\r') && source.charCodeAt(0) !== 0xfeff, 'fins de ligne LF, sans BOM');
});

test('E03 — Config invalide : create lève « FInput : … »', () => {
  const {F} = load();
  const before = json(M);
  assert.equal(typeof F.create(M), 'object');
  assert.equal(json(M), before, 'la config du jeu reste intacte');
  rejects(F, variant(copyM, c => c.actions.push({id: 'jump', type: 'press'})), 'id en double', 'jump');
  rejects(F, variant(copyM, c => { c.actions[0].type = 'toggle'; }), 'type inconnu', 'forward');
  rejects(F, variant(copyM, c => { c.sticks.move.x = ['left', 'nope']; }), 'stick qui cite une action inconnue', 'move');
  rejects(F, variant(copyM, c => { c.actions[1].keys = ['KeyS', 'KeyW']; }), 'même code par défaut dans deux actions', 'KeyW');
  rejects(F, variant(copyM, c => { c.sticks.walk = {type: 'move', x: [], y: []}; }), 'deux sticks move', 'walk');
});

// A small declaration: hold a, b, f, g, r; press c; value v.
const small = () => ({actions: [
  {id: 'a', type: 'hold', keys: ['KeyA'], pad: ['A']}, {id: 'b', type: 'hold', keys: ['KeyB']}, {id: 'f', type: 'hold', keys: ['KeyF']},
  {id: 'g', type: 'hold', keys: ['KeyG']}, {id: 'r', type: 'hold'}, {id: 'c', type: 'press'}, {id: 'v', type: 'value', pad: ['RT']}],
  sticks: {move: {type: 'move', x: ['a', 'b'], y: ['f', 'g'], pad: 'LS'}}});

test('E03b — Toutes les règles de la déclaration, sans toucher à la config', () => {
  const {F} = load();
  const good = [
    ['déclaration minimale', () => {}],
    ['libellés', c => { Object.assign(c.actions[0], {label: 'Action A', touch: 'TIR', mouse: 'Clic'}); }],
    ['trois touches et deux boutons', c => { c.actions[0].keys = ['KeyA', 'KeyQ', 'ArrowLeft']; c.actions[0].pad = ['A', 'LB']; }],
    ['repli qui cite la touche d’une autre action', c => { c.actions[5].alt = ['KeyA', 'KeyJ']; }],
    ['sans sticks', c => { delete c.sticks; }],
    ['course et stick de regard', c => { c.sticks.move.run = 'r'; c.sticks.look = {type: 'look', x: [], pad: 'RS', rate: 1.9}; }],
    ['stick sans pad ni axes', c => { c.sticks.look = {type: 'look'}; }],
    ['champs facultatifs', c => { Object.assign(c, {version: 3, device: 'gamepad', mouseScale: .003, getGamepads: () => [], migrate: 'ignoré', settings: {v: 9}}); }],
    ['allowKey du jeu', c => { c.allowKey = code => code === 'Escape' || /^Key/.test(code); c.actions[0].keys = ['Escape']; }]
  ];
  for (const [why, edit] of good) {
    const c = variant(small, edit), before = json(c);
    assert.doesNotThrow(() => F.create(c), why);
    assert.equal(json(c), before, why + ' : config intacte');
  }
  for (const bad of [undefined, null, 42, 'x', [], {}, {actions: []}, {actions: {}}, {actions: 'a'}]) rejects(F, bad, 'config ' + json(bad));
  const bad = [
    ['action qui n’est pas un objet', c => { c.actions.push('x'); }],
    ['action nulle', c => { c.actions.push(null); }],
    ['id vide', c => { c.actions[0].id = ''; }],
    ['id non chaîne', c => { c.actions[0].id = 5; }],
    ['id qui commence par un chiffre', c => { c.actions[0].id = '1a'; }, '1a'],
    ['id avec un tiret', c => { c.actions[0].id = 'a-b'; }, 'a-b'],
    ['id avec un souligné', c => { c.actions[0].id = 'a_b'; }, 'a_b'],
    ['libellé non chaîne', c => { c.actions[0].label = 5; }, 'a'],
    ['touch non chaîne', c => { c.actions[0].touch = 5; }, 'a'],
    ['mouse non chaîne', c => { c.actions[0].mouse = {}; }, 'a'],
    ['quatre touches', c => { c.actions[0].keys = ['KeyA', 'KeyQ', 'KeyW', 'KeyZ']; }, 'a'],
    ['touche réservée au navigateur', c => { c.actions[0].keys = ['Escape']; }, 'a'],
    ['touche de fonction', c => { c.actions[0].keys = ['F5']; }, 'a'],
    ['touche non chaîne', c => { c.actions[0].keys = [65]; }, 'a'],
    ['touches non tableau', c => { c.actions[0].keys = 'KeyA'; }, 'a'],
    ['touche en double dans une action', c => { c.actions[1].keys = ['KeyB', 'KeyB']; }, 'KeyB'],
    ['touche dans deux actions', c => { c.actions[1].keys = ['KeyA']; }, 'KeyA'],
    ['trois boutons', c => { c.actions[1].pad = ['B', 'X', 'Y']; }, 'b'],
    ['bouton Home', c => { c.actions[1].pad = ['Home']; }, 'b'],
    ['bouton inconnu', c => { c.actions[1].pad = ['Z9']; }, 'b'],
    ['bouton en double dans une action', c => { c.actions[1].pad = ['B', 'B']; }, 'B'],
    ['bouton dans deux actions', c => { c.actions[1].pad = ['A']; }, 'A'],
    ['boutons non tableau', c => { c.actions[1].pad = 'B'; }, 'b'],
    ['repli non tableau', c => { c.actions[5].alt = 'KeyJ'; }, 'c'],
    ['repli refusé', c => { c.actions[5].alt = ['Escape']; }, 'c'],
    ['sticks en tableau', c => { c.sticks = []; }],
    ['sticks nul', c => { c.sticks = null; }],
    ['stick qui n’est pas un objet', c => { c.sticks.look = 'x'; }, 'look'],
    ['type de stick inconnu', c => { c.sticks.aim = {type: 'aim'}; }, 'aim'],
    ['deux sticks look', c => { c.sticks.look = {type: 'look'}; c.sticks.view = {type: 'look'}; }, 'view'],
    ['nom de stick en majuscule', c => { c.sticks.Look = {type: 'look'}; }, 'Look'],
    ['nom de stick avec un tiret', c => { c.sticks['lo-ok'] = {type: 'look'}; }, 'lo-ok'],
    ['stick dont <nom>X est une action', c => { c.actions.push({id: 'lookX', type: 'hold'}); c.sticks.look = {type: 'look'}; }, 'look'],
    ['stick dont <nom>Y est une action', c => { c.actions.push({id: 'moveY', type: 'press'}); }, 'move'],
    ['axe à une action', c => { c.sticks.move.x = ['a']; }, 'move'],
    ['axe à trois actions', c => { c.sticks.move.x = ['a', 'b', 'r']; }, 'move'],
    ['axe non tableau', c => { c.sticks.move.x = 'a'; }, 'move'],
    ['axe qui cite une impulsion', c => { c.sticks.move.x = ['a', 'c']; }, 'move'],
    ['axe qui cite une valeur', c => { c.sticks.move.y = ['v', 'g']; }, 'move'],
    ['axe qui cite une action inconnue', c => { c.sticks.move.y = ['f', 'zz']; }, 'move'],
    ['action deux fois dans un axe', c => { c.sticks.move.x = ['a', 'a']; }, 'move'],
    ['action sur les deux axes', c => { c.sticks.move.y = ['b', 'f']; }, 'move'],
    ['pad de stick inconnu', c => { c.sticks.move.pad = 'XS'; }, 'move'],
    ['deux sticks sur LS', c => { c.sticks.look = {type: 'look', pad: 'LS'}; }, 'look'],
    ['run sur une impulsion', c => { c.sticks.move.run = 'c'; }, 'move'],
    ['run inconnu', c => { c.sticks.move.run = 'zz'; }, 'move'],
    ['run sur le stick look', c => { c.sticks.look = {type: 'look', run: 'r'}; }, 'look'],
    ...[0, -1, NaN, Infinity, '2', null].map(rate => ['rate ' + String(rate), c => { c.sticks.look = {type: 'look', rate}; }, 'look']),
    ['rate sur le stick move', c => { c.sticks.move.rate = 2; }, 'move'],
    ...[0, -1, 1.5, '2', null].map(version => ['version ' + String(version), c => { c.version = version; }, 'version']),
    ['appareil inconnu', c => { c.device = 'pilot'; }, 'pilot'],
    ['mouseScale non fini', c => { c.mouseScale = NaN; }, 'mouseScale'],
    ['mouseScale en texte', c => { c.mouseScale = '1'; }, 'mouseScale'],
    ['allowKey non fonction', c => { c.allowKey = 5; }, 'allowKey'],
    ['allowKey du jeu qui refuse une touche déclarée', c => { c.allowKey = code => code !== 'KeyB'; }, 'b'],
    ['getGamepads non fonction', c => { c.getGamepads = 'x'; }, 'getGamepads']
  ];
  for (const [why, edit, culprit] of bad) rejects(F, variant(small, edit), why, culprit);
});

// ——— Step 2: actions, keyboard, mouse, virtual buttons, frame() without gamepad, step(), pendingLook(), clear() ———
const DT = 1 / 60;
const n0 = x => x === 0 ? 0 : x; // -0 → 0, to compare two computations
const near = (a, b, tol, why = '') => assert.ok(Math.abs(a - b) <= tol, why + ' : ' + a + ' ≠ ' + b + ' (tolérance ' + tol + ')');
const IDS = M.actions.map(a => a.id);
const TUNE_DEFAULTS = Object.fromEntries(Object.entries(TUNE_SPEC).map(([name, v]) => [name, v[0]]));
const idle = s => Object.values(s).every(v => v === 0 || v === false);
const one = (inp, dt = DT) => { const f = inp.frame(dt); return {f, s: inp.step()}; };

test('E04 — Défauts METAL : Espace saute, R esquive, V frappe, aucun code en double', () => {
  const {F} = load();
  const before = json(M), d = F.defaults(M), k = d.keys;
  assert.equal(json(M), before, 'la config du jeu reste intacte');
  assert.equal(json(k.jump), json(['Space'])); assert.equal(json(k.dash), json(['KeyR'])); assert.equal(json(k.melee), json(['KeyV']));
  assert.equal(json(k.forward), json(['KeyW', 'KeyZ', 'ArrowUp'])); assert.equal(json(k.left), json(['KeyA', 'KeyQ']));
  const codes = Object.values(k).flat();
  assert.equal(new Set(codes).size, codes.length, 'aucun code utilisé deux fois');
  // Shape: v, keys and pad copied from the declaration in its order, the TUNE defaults; JSON only.
  assert.equal(json(Object.keys(d)), json(['v', 'keys', 'pad', 'tune'])); assert.equal(d.v, 2);
  assert.equal(json(k), json(Object.fromEntries(M.actions.map(a => [a.id, a.keys]))));
  assert.equal(json(d.pad), json(Object.fromEntries(M.actions.map(a => [a.id, a.pad]))));
  assert.equal(json(d.tune), json(TUNE_DEFAULTS));
  assert.equal(json(JSON.parse(json(d))), json(d));
  // A new object at each call, version 1 by default, the declaration checked as by create.
  d.keys.jump.push('KeyJ'); d.tune.padYaw = 1;
  assert.equal(json(F.defaults(M)), json(Object.assign(JSON.parse(json(d)), {keys: {...JSON.parse(json(d.keys)), jump: ['Space']}, tune: TUNE_DEFAULTS})));
  assert.equal(F.defaults({actions: [{id: 'a', type: 'hold'}]}).v, 1);
  for (const bad of [undefined, {actions: []}, variant(copyM, c => { c.actions[1].keys = ['KeyW']; })])
    assert.throws(() => F.defaults(bad), e => String(e.message).startsWith('FInput : '));
});

test('E04b — normalize à l’étape 2 : table des touches gardée entière ou par défaut, réglages bornés', () => {
  const {F} = load();
  const D = F.defaults(M), dk = json(D.keys), N = raw => F.normalize(raw, M);
  for (const raw of [undefined, null, 42, 'x', [], true, {}, {keys: 'KeyW'}, {keys: []}, {toJSON: () => 5}]) assert.equal(json(N(raw)), json(D), json(raw));
  const loop = {}; loop.self = loop; assert.equal(json(N(loop)), json(D), 'objet cyclique');
  // A valid table is kept in declaration order, unknown keys dropped; [] leaves an action unbound.
  const stored = Object.fromEntries(Object.entries({...JSON.parse(dk), fire: ['KeyG'], weapon5: [], ghost: ['KeyK']}).reverse());
  const n = N({v: 2, keys: stored});
  assert.equal(json(Object.keys(n.keys)), json(IDS));
  assert.equal(json(n.keys), json({...JSON.parse(dk), fire: ['KeyG'], weapon5: []}));
  // One invalid entry: the whole table goes back to the defaults.
  for (const bad of [{forward: 'KeyW'}, {forward: ['KeyW'], back: ['KeyW']}, {forward: ['KeyW', 'KeyW']}, {forward: ['KeyW', 'KeyZ', 'ArrowUp', 'KeyI']},
    {fire: ['Escape']}, {fire: ['F5']}, {fire: [13]}, {fire: null}, {fire: {}}, {jump: ['KeyG'], fire: ['KeyG']}])
    assert.equal(json(N({keys: bad}).keys), dk, json(bad));
  // A missing action gets its default codes that no stored entry uses.
  const part = N({keys: {fire: ['KeyZ'], jump: ['KeyW'], sprint: ['ShiftRight']}}).keys;
  assert.equal(json(part.forward), json(['ArrowUp'])); assert.equal(json(part.fire), json(['KeyZ'])); assert.equal(json(part.jump), json(['KeyW']));
  assert.equal(json(part.sprint), json(['ShiftRight'])); assert.equal(json(part.back), json(['KeyS', 'ArrowDown'])); assert.equal(json(part.dash), json(['KeyR']));
  // Entries are own properties: an id named like a property of Object.prototype is still read right.
  const P = {actions: [{id: 'toString', type: 'hold', keys: ['KeyA']}, {id: 'b', type: 'hold', keys: ['KeyB']}]};
  assert.equal(json(F.normalize({keys: {b: ['KeyA']}}, P).keys), json({toString: [], b: ['KeyA']}));
  assert.equal(json(F.normalize({keys: {}}, P).keys), json({toString: ['KeyA'], b: ['KeyB']}));
  // tune: finite numbers bounded, booleans kept, anything else back to its default, unknown fields dropped.
  const t = N({tune: {sensitivity: 9, padYaw: 10, padDead: -1, stickRadius: 10, padCurve: 2.5, padPitch: -0, invertY: true, padInvertY: false, swapSticks: 'oui',
    padBoost: NaN, touchPitch: '1.2', padVibration: Infinity, touchAccel: null, moveDead: true, mystery: 1}}).tune;
  assert.equal(json(t), json({...TUNE_DEFAULTS, sensitivity: 3, padYaw: 60, padDead: 0, stickRadius: 32, padCurve: 2.5, padPitch: 40, invertY: true}));
  assert.ok(Object.values(t).every(v => !Object.is(v, -0)));
  assert.equal(json(N({tune: 'x'}).tune), json(TUNE_DEFAULTS));
  // Output: {v: version, keys, pad, tune}; idempotent, JSON round trip, argument untouched.
  for (const raw of [undefined, {keys: stored}, {keys: {fire: ['KeyZ']}, tune: {sensitivity: 2, invertY: true}}, {v: 9, keys: {forward: 'x'}}, D]) {
    const before = json(raw), a = N(raw);
    assert.equal(json(raw), before, 'argument intact');
    assert.equal(json(Object.keys(a)), json(['v', 'keys', 'pad', 'tune'])); assert.equal(a.v, 2);
    assert.equal(json(N(a)), json(a)); assert.equal(json(N(JSON.parse(json(a)))), json(a));
  }
  assert.throws(() => F.normalize({}, {actions: [{id: 'a', type: 'x'}]}), e => String(e.message).startsWith('FInput : '));
});

test('E05 — AZERTY et QWERTY : chaque touche seule, puis frame et step', () => {
  const {F} = load();
  const inp = F.create(M);
  for (const [code, axis, v] of [['KeyW', 'moveY', 1], ['KeyZ', 'moveY', 1], ['ArrowUp', 'moveY', 1], ['KeyS', 'moveY', -1], ['ArrowDown', 'moveY', -1],
    ['KeyA', 'moveX', -1], ['KeyQ', 'moveX', -1], ['KeyD', 'moveX', 1]]) {
    assert.equal(inp.keyDown(code, 0, false), true, code);
    const {s} = one(inp);
    assert.equal(s[axis], v, code); assert.equal(s[axis === 'moveX' ? 'moveY' : 'moveX'], 0, code);
    assert.equal(inp.keyUp(code, 0), true, code);
    const r = one(inp).s; assert.equal(r.moveX, 0, code); assert.equal(r.moveY, 0, code);
  }
  assert.equal(inp.keyDown('KeyL', 0, false), false);
  const {f, s} = one(inp);
  assert.equal(json(f.pressed), '[]'); assert.ok(idle(s), 'KeyL ne fait rien');
  assert.equal(inp.keyUp('KeyL', 0), false);
  // Several keys: (1, 1) on a diagonal as today (the simulation normalises), opposite keys cancel out.
  inp.keyDown('KeyZ', 0, false); inp.keyDown('KeyD', 0, false);
  let r = one(inp).s; assert.equal(r.moveX, 1); assert.equal(r.moveY, 1);
  inp.keyDown('KeyS', 0, false); inp.keyDown('KeyQ', 0, false);
  r = one(inp).s; assert.equal(r.moveX, 0); assert.equal(r.moveY, 0);
  inp.keyUp('KeyZ', 0); inp.keyUp('KeyD', 0);
  r = one(inp).s; assert.equal(r.moveX, -1); assert.equal(r.moveY, -1);
  inp.keyUp('KeyS', 0); inp.keyUp('KeyQ', 0);
  // Two keys of one action: released with the last one.
  inp.keyDown('KeyW', 0, false); inp.keyDown('KeyZ', 0, false); inp.keyUp('KeyW', 0);
  assert.equal(one(inp).s.moveY, 1); inp.keyUp('KeyZ', 0); assert.equal(one(inp).s.moveY, 0);
  // Every affected code returns true (the game calls preventDefault), the others false.
  for (const a of M.actions) for (const c of a.keys) { assert.equal(inp.keyDown(c, 0, false), true, c); assert.equal(inp.keyUp(c, 0), true, c); }
  for (const c of ['KeyL', 'KeyK', 'Escape', 'F5', 'MetaLeft', 'ControlLeft', 'Digit0', 'Space ', '', undefined, 42, null]) {
    assert.equal(inp.keyDown(c, 0, false), false, String(c)); assert.equal(inp.keyUp(c, 0), false, String(c));
  }
});

// Annex B of the mission: the formula of game.js frame(), mode 'playing', reduced to the keyboard and the mouse.
// keys: Set des codes tenus ; q: impulsions mises en file au keydown non répété, remises à false après le pas ;
// look: {x, y} accumulés par mousemove comme game.js (x += dx*.0022*sens ; y -= dy*.0022*sens*(inv?-1:1)), remis à 0 après le pas.
function reference(bindings, keys, q, look, dt) {
  const held = id => (bindings[id] || []).some(c => keys.has(c));
  return {moveX: Number(held('right')) - Number(held('left')) + 0,
    moveY: Number(held('forward')) - Number(held('back')) - 0,
    lookX: look.x + (Number(held('turnRight')) - Number(held('turnLeft'))) * dt * 1.9, lookY: look.y,
    fire: held('fire'), fireLeft: held('fireLeft'), sprint: held('sprint'),
    dash: q.dash, pulse: q.pulse, melee: q.melee, interact: q.interact};
}
const PARITY_KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Enter', 'KeyC', 'ShiftLeft', 'KeyR', 'KeyE', 'KeyV', 'KeyF'];
const PARITY_FIELDS = ['moveX', 'moveY', 'lookX', 'lookY', 'fire', 'fireLeft', 'sprint', 'dash', 'pulse', 'melee', 'interact'];
// 600 images, seed 7, one step per image; the bindings are those of the instance (inp.settings.keys).
function paritySession(F, tune) {
  const inp = F.create(M);
  if (tune) { const s = inp.settings; Object.assign(s.tune, tune); inp.configure(s); }
  const {keys: bindings, tune: {sensitivity: sens, invertY: inv}} = inp.settings;
  const owner = code => Object.keys(bindings).find(id => bindings[id].includes(code));
  const r = lcg(7), keys = new Set(), q = {dash: false, pulse: false, melee: false, interact: false}, look = {x: 0, y: 0}, out = [];
  for (let i = 0; i < 600; i++) {
    const t = i * 1000 / 60, dt = 1 / 144 + r() * (1 / 30 - 1 / 144), rose = [];
    for (const code of PARITY_KEYS) if (r() < .1) {
      if (keys.has(code)) { keys.delete(code); assert.equal(inp.keyUp(code, t), true); continue; }
      const id = owner(code); keys.add(code); if (id in q) q[id] = true; rose.push(id);
      assert.equal(inp.keyDown(code, t, false), true);
    }
    const moves = Math.floor(r() * 4);
    for (let n = 0; n < moves; n++) {
      const dx = Math.floor(r() * 41) - 20, dy = Math.floor(r() * 41) - 20;
      look.x += dx * .0022 * sens; look.y -= dy * .0022 * sens * (inv ? -1 : 1);
      inp.mouseMove(dx, dy, t);
    }
    const turn = keys.has('ArrowLeft') !== keys.has('ArrowRight');
    const f = inp.frame(dt), s = inp.step(), ref = reference(bindings, keys, q, look, dt);
    out.push({f, s, ref, rose, moves, turn, pending: inp.pendingLook()});
    look.x = look.y = 0; for (const id in q) q[id] = false;
  }
  return out;
}

test('E06 — Parité avec game.js (annexe B) : 600 images, graine 7, égalité au bit près', () => {
  const {F} = load();
  const runs = [['sensibilité 1', null], ['sensibilité 1,7 et invertY', {sensitivity: 1.7, invertY: true}]].map(([name, tune]) => [name, paritySession(F, tune)]);
  for (const [name, frames] of runs) {
    const bad = [];
    frames.forEach(({s, ref}, i) => { for (const k of PARITY_FIELDS) if (!Object.is(n0(s[k]), n0(ref[k]))) bad.push('image ' + i + ', ' + k + ' : ' + s[k] + ' ≠ ' + ref[k]); });
    assert.equal(bad.length, 0, name + ' — ' + bad.slice(0, 6).join(' ; '));
    // The fronts of each image are the actions that went down, in their order of arrival.
    frames.forEach(({f, rose}, i) => assert.equal(json(f.pressed), json(rose), name + ', image ' + i));
    // One step per image consumes the look.
    assert.ok(frames.every(({pending}) => pending.x === 0 && pending.y === 0), name);
    // A sequence that exercises everything: each boolean both true and false, each number several values,
    // and keyboard turning summed with mouse deltas in the same step.
    for (const k of PARITY_FIELDS) {
      const v = frames.map(x => x.s[k]);
      if (typeof v[0] === 'boolean') assert.ok(v.filter(Boolean).length >= 20 && v.filter(x => !x).length >= 20, name + ' : ' + k);
      else assert.ok(new Set(v).size >= 3, name + ' : ' + k);
    }
    assert.ok(frames.filter(x => x.turn && x.moves > 0).length >= 50, name + ' : clavier et souris dans le même pas');
    assert.ok(frames.filter(x => x.rose.length > 1).length >= 50, name + ' : plusieurs fronts dans la même image');
  }
  // The variant applies the sensitivity and the inversion set by configure: same deltas, look y × -1.7.
  const [[, a], [, b]] = runs;
  a.forEach((x, i) => near(b[i].s.lookY, -1.7 * x.s.lookY, 1e-12, 'image ' + i));
  assert.ok(a.some((x, i) => x.s.lookY !== 0 && b[i].s.lookY !== x.s.lookY));
});

test('E07 — Appui court (LOOP-06) : R appuyée et relâchée avant frame', () => {
  const {F} = load();
  const inp = F.create(M);
  inp.keyDown('KeyR', 0, false); inp.keyUp('KeyR', 5);
  assert.equal(json(inp.frame(DT).pressed), json(['dash']));
  assert.equal(inp.step().dash, true); assert.equal(inp.step().dash, false);
  assert.equal(one(inp).s.dash, false);
  // Two short presses before the same image: one front, one impulse.
  inp.keyDown('KeyR', 20, false); inp.keyUp('KeyR', 21); inp.keyDown('KeyR', 22, false); inp.keyUp('KeyR', 23);
  assert.equal(json(inp.frame(DT).pressed), json(['dash']));
  assert.equal(inp.step().dash, true); assert.equal(inp.step().dash, false);
  // A key held over several images: one front, one impulse.
  inp.keyDown('KeyR', 40, false);
  let r = one(inp); assert.equal(json(r.f.pressed), json(['dash'])); assert.equal(r.s.dash, true);
  r = one(inp); assert.equal(json(r.f.pressed), '[]'); assert.equal(r.s.dash, false);
  inp.keyUp('KeyR', 80); r = one(inp); assert.equal(json(r.f.pressed), '[]'); assert.equal(r.s.dash, false);
});

test('E08 — Répétition : la touche ajoutée par repeat est tenue, sans front ni impulsion', () => {
  const {F} = load();
  const inp = F.create(M);
  assert.equal(inp.keyDown('KeyW', 0, true), true);
  let {f, s} = one(inp);
  assert.equal(s.moveY, 1); assert.equal(json(f.pressed), '[]');
  for (const a of M.actions) if (a.type === 'press') assert.equal(s[a.id], false, a.id);
  // A repeated press key is held, but gives no impulse.
  assert.equal(inp.keyDown('KeyR', 0, true), true);
  ({f, s} = one(inp)); assert.equal(json(f.pressed), '[]'); assert.equal(s.dash, false); assert.equal(s.moveY, 1);
  // A key already held: neither a repeat nor another keydown adds a front.
  inp.keyDown('KeyR', 0, true); inp.keyDown('KeyR', 0, false);
  ({f, s} = one(inp)); assert.equal(json(f.pressed), '[]'); assert.equal(s.dash, false);
  // After its keyUp, a real press gives the front again.
  inp.keyUp('KeyR', 0); inp.keyDown('KeyR', 0, false);
  ({f, s} = one(inp)); assert.equal(json(f.pressed), json(['dash'])); assert.equal(s.dash, true);
  inp.keyUp('KeyW', 0); assert.equal(one(inp).s.moveY, 0);
});

test('E09 — Action tenue avec verrou : Entrée appuyée et relâchée dans l’image (LOOP-06)', () => {
  const {F} = load();
  const inp = F.create(M);
  inp.keyDown('Enter', 0, false); inp.keyUp('Enter', 5);
  assert.equal(json(inp.frame(DT).pressed), json(['fire']));
  assert.equal(inp.step().fire, true); assert.equal(inp.step().fire, false);
  // Held: true at both steps of the image, and after.
  inp.keyDown('Enter', 20, false); inp.frame(DT);
  assert.equal(inp.step().fire, true); assert.equal(inp.step().fire, true);
  assert.equal(one(inp).s.fire, true);
  inp.keyUp('Enter', 60); assert.equal(one(inp).s.fire, false);
  // Same rule for a mouse button, a touch button and another held action.
  inp.button('fire', true, 70, 'mouse'); inp.button('fire', false, 75, 'mouse'); inp.frame(DT);
  assert.equal(inp.step().fire, true); assert.equal(inp.step().fire, false);
  inp.button('fireLeft', true, 80, 'touch'); inp.button('fireLeft', false, 85, 'touch'); inp.frame(DT);
  assert.equal(inp.step().fireLeft, true); assert.equal(inp.step().fireLeft, false);
  inp.keyDown('ShiftLeft', 90, false); inp.keyUp('ShiftLeft', 95); inp.frame(DT);
  assert.equal(inp.step().sprint, true); assert.equal(inp.step().sprint, false);
});

test('E10 — Deux pas dans une image : impulsion et regard au premier pas seulement', () => {
  const {F} = load();
  const inp = F.create(M);
  inp.keyDown('KeyW', 0, false); inp.keyDown('KeyE', 0, false); inp.keyDown('ArrowRight', 0, false); inp.mouseMove(10, -4, 0);
  inp.frame(1 / 30);
  const a = inp.step(), b = inp.step(), c = inp.step();
  assert.equal(a.pulse, true); assert.equal(b.pulse, false); assert.equal(c.pulse, false);
  near(a.lookX, 10 * .0022 + 1.9 / 30, 1e-15, 'lookX'); near(a.lookY, 4 * .0022, 1e-15, 'lookY');
  for (const s of [b, c]) { assert.equal(s.lookX, 0); assert.equal(s.lookY, 0); }
  // Held actions stay true at every step of the image (as in game.js).
  for (const s of [a, b, c]) { assert.equal(s.moveY, 1); assert.equal(s.turnRight, true); }
  // The next image turns again, from the keyboard only.
  inp.frame(1 / 60); near(inp.step().lookX, 1.9 / 60, 1e-15, 'image suivante'); assert.equal(inp.step().lookX, 0);
});

test('E11 — Image sans pas : le regard attend dans pendingLook (STAB-06)', () => {
  const {F} = load();
  const inp = F.create(M);
  inp.mouseMove(10, 0); inp.frame(DT); inp.mouseMove(5, 0); inp.frame(DT);
  const p = inp.pendingLook();
  near(p.x, 10 * .0022 + 5 * .0022, 1e-15, 'pendingLook'); assert.equal(p.y, 0);
  assert.notEqual(inp.pendingLook(), p, 'un objet neuf'); near(inp.pendingLook().x, p.x, 0, 'pendingLook ne consomme rien');
  near(inp.step().lookX, 10 * .0022 + 5 * .0022, 1e-15, 'step');
  assert.equal(json(inp.pendingLook()), json({x: 0, y: 0}));
  // The keyboard turn of images without a step waits as well, and so does an impulse.
  inp.keyDown('ArrowLeft', 0, false); inp.keyDown('KeyV', 0, false); inp.frame(DT); assert.equal(json(inp.frame(DT).pressed), '[]');
  near(inp.pendingLook().x, -2 * DT * 1.9, 1e-15, 'deux images de rotation');
  const s = inp.step(); near(s.lookX, -2 * DT * 1.9, 1e-15); assert.equal(s.melee, true);
  assert.equal(inp.step().melee, false); assert.equal(inp.pendingLook().x, 0);
});

test('E12 — clear() : touches relâchées, verrous effacés, regard en attente à 0', () => {
  const {F} = load();
  const inp = F.create(M);
  inp.keyDown('KeyW', 0, false); inp.keyDown('KeyR', 0, false); inp.keyDown('ArrowRight', 0, false);
  inp.button('fire', true, 0, 'mouse'); inp.button('fireLeft', true, 0, 'touch'); inp.button('pulse', true, 0, 'touch');
  inp.mouseMove(10, 10, 0); inp.addLook(.1, .2); inp.frame(DT); inp.keyDown('KeyE', 0, false);
  inp.clear();
  assert.equal(json(inp.pendingLook()), json({x: 0, y: 0}));
  let {f, s} = one(inp);
  assert.equal(json(f.pressed), '[]'); assert.ok(idle(s), json(s));
  assert.equal(inp.device, 'keyboard', 'l’appareil actif reste (dernier événement : KeyE)'); assert.equal(json(inp.settings), json(F.defaults(M)));
  // A key still held comes back through its repeat, without an edge; its keyUp releases it.
  assert.equal(inp.keyDown('KeyW', 0, true), true);
  ({f, s} = one(inp)); assert.equal(s.moveY, 1); assert.equal(json(f.pressed), '[]');
  inp.keyUp('KeyW', 0); assert.equal(inp.keyUp('KeyR', 0), true, 'keyUp d’une touche relâchée par clear');
  ({f, s} = one(inp)); assert.ok(idle(s), json(s));
  // The finger count restarts from 0, and a new press is an ordinary front.
  inp.button('fireLeft', false, 0, 'touch'); inp.button('fireLeft', true, 0, 'touch');
  assert.equal(one(inp).s.fireLeft, true); inp.button('fireLeft', false, 0, 'touch'); assert.equal(one(inp).s.fireLeft, false);
  inp.keyDown('KeyR', 0, false); ({f, s} = one(inp)); assert.equal(json(f.pressed), json(['dash'])); assert.equal(s.dash, true);
});

test('E13 — Pas de -0 : aucune sortie numérique ne vaut -0 (sorties de E06 ; E50 à l’étape 7)', () => {
  const {F} = load();
  const none = (o, where) => { for (const [k, v] of Object.entries(o)) assert.ok(!Object.is(v, -0), where + ' : ' + k); };
  for (const tune of [null, {sensitivity: 1.7, invertY: true}]) {
    paritySession(F, tune).forEach(({f, s, pending}, i) => { none(s, 'step ' + i); none(f, 'frame ' + i); none(pending, 'pendingLook ' + i); });
  }
  // Inputs that could give -0: negative zeros, an inverted zero, exact cancellations.
  for (const invertY of [false, true]) {
    const inp = F.create(M); const s = inp.settings; s.tune.invertY = invertY; inp.configure(s);
    inp.mouseMove(-0, -0, 0); inp.addLook(-0, -0); inp.frame(-0); none(inp.pendingLook(), 'zéros négatifs'); none(inp.step(), 'zéros négatifs');
    inp.mouseMove(5, 5, 0); inp.mouseMove(-5, -5, 0); inp.addLook(-.1, .1); inp.addLook(.1, -.1); inp.frame(DT); none(inp.step(), 'annulation');
    inp.keyDown('ArrowLeft', 0, false); inp.keyDown('ArrowRight', 0, false); inp.keyDown('KeyA', 0, false); inp.keyDown('KeyD', 0, false); inp.frame(DT);
    none(inp.pendingLook(), 'touches opposées'); none(inp.step(), 'touches opposées');
  }
});

test('E14 — Sources virtuelles : boutons de souris et boutons tactiles', () => {
  const {F} = load();
  const inp = F.create(M);
  assert.equal(inp.button('fire', true, 100, 'mouse'), true);
  let {f, s} = one(inp);
  assert.equal(s.fire, true); assert.equal(inp.device, 'mouse'); assert.equal(f.device, 'mouse'); assert.equal(json(f.pressed), json(['fire']));
  assert.equal(inp.button('fire', false, 200, 'mouse'), true); assert.equal(one(inp).s.fire, false);
  // Touch: a finger count; two downs and one up keep it held, the second up releases it.
  inp.button('fire', true, 300, 'touch'); inp.button('fire', true, 310, 'touch'); inp.button('fire', false, 320, 'touch');
  assert.equal(one(inp).s.fire, true); assert.equal(inp.device, 'touch');
  inp.button('fire', false, 330, 'touch'); assert.equal(one(inp).s.fire, false);
  // Never negative: an extra up, then one down holds it.
  inp.button('fire', false, 340, 'touch'); inp.button('fire', true, 350, 'touch'); assert.equal(one(inp).s.fire, true);
  inp.button('fire', false, 360, 'touch'); assert.equal(one(inp).s.fire, false);
  // Another device, or an unknown action: false, and nothing changes.
  for (const d of ['pilot', 'gamepad', 'keyboard', undefined]) assert.equal(inp.button('fire', true, 400, d), false, String(d));
  for (const id of ['nope', undefined, 5, 'toString']) assert.equal(inp.button(id, true, 400, 'mouse'), false, String(id));
  ({f, s} = one(inp)); assert.equal(s.fire, false); assert.equal(json(f.pressed), '[]'); assert.equal(inp.device, 'touch');
  // An impulse on a touch button: one per press.
  inp.button('dash', true, 500, 'touch');
  assert.equal(json(inp.frame(DT).pressed), json(['dash'])); assert.equal(inp.step().dash, true); assert.equal(inp.step().dash, false);
  inp.button('dash', false, 520, 'touch'); assert.equal(one(inp).s.dash, false);
  // Sources are OR-ed: Enter, the mouse and a finger hold the same action; the last release frees it.
  inp.keyDown('Enter', 600, false); inp.button('fire', true, 610, 'mouse'); inp.button('fire', true, 620, 'touch');
  assert.equal(json(inp.frame(DT).pressed), json(['fire'])); assert.equal(inp.step().fire, true);
  inp.keyUp('Enter', 630); assert.equal(one(inp).s.fire, true);
  inp.button('fire', false, 640, 'mouse'); assert.equal(one(inp).s.fire, true);
  inp.button('fire', false, 650, 'touch'); assert.equal(one(inp).s.fire, false);
  // A value action reads 1 from a key, a mouse button or a finger.
  const v = F.create({actions: [{id: 'v', type: 'value', keys: ['KeyV']}, {id: 'h', type: 'hold'}]});
  v.keyDown('KeyV', 0, false); assert.equal(one(v).s.v, 1); v.keyUp('KeyV', 0); assert.equal(one(v).s.v, 0);
  v.button('v', true, 0, 'mouse'); assert.equal(one(v).s.v, 1); v.button('v', false, 0, 'mouse');
  v.button('v', true, 0, 'touch'); assert.equal(one(v).s.v, 1); v.button('v', false, 0, 'touch'); assert.equal(one(v).s.v, 0);
});

test('E14b — frame() et step() : objets neufs, ordre fixe des clés, fronts dans l’ordre d’arrivée, dt borné', () => {
  const {F} = load();
  const inp = F.create(M);
  const s = inp.step();
  assert.equal(json(Object.keys(s)), json(['moveX', 'moveY', 'lookX', 'lookY', ...IDS]));
  assert.ok(['moveX', 'moveY', 'lookX', 'lookY'].every(k => s[k] === 0) && IDS.every(id => s[id] === false));
  const f = inp.frame(DT);
  assert.equal(json(f), json({pressed: [], nav: null, device: 'keyboard', deviceChanged: false, connected: [], disconnected: [], pads: [], captured: null}));
  assert.notEqual(inp.frame(DT), inp.frame(DT)); assert.notEqual(inp.step(), inp.step());
  // Fronts in their order of arrival, each once; changing a result changes nothing inside.
  inp.keyDown('KeyF', 0, false); inp.keyDown('KeyE', 0, false); inp.keyUp('KeyE', 0); inp.keyDown('KeyE', 0, false); inp.keyDown('Enter', 0, false);
  const g = inp.frame(DT); assert.equal(json(g.pressed), json(['interact', 'pulse', 'fire']));
  g.pressed.length = 0; g.pressed.push('pause'); const t = inp.step(); t.pulse = false;
  assert.equal(json(inp.frame(DT).pressed), '[]'); assert.equal(inp.step().interact, false);
  // Declaration order of the sticks gives the order of the outputs; no sticks, actions only.
  const order = F.create({actions: [{id: 'u', type: 'hold', keys: ['KeyU']}, {id: 'd', type: 'hold', keys: ['KeyJ']}, {id: 'p', type: 'press'}],
    sticks: {aim: {type: 'look', y: ['d', 'u'], rate: 2}, walk: {type: 'move'}}});
  assert.equal(json(Object.keys(order.step())), json(['aimX', 'aimY', 'walkX', 'walkY', 'u', 'd', 'p']));
  order.keyDown('KeyU', 0, false); order.frame(.1); const o = order.step();
  near(o.aimY, .2, 1e-15, 'regard vertical au clavier'); assert.equal(o.aimX, 0); assert.equal(o.walkX, 0); assert.equal(o.walkY, 0);
  assert.equal(json(Object.keys(F.create({actions: [{id: 'a', type: 'press'}]}).step())), json(['a']));
  // dt: bounded to [0, .25]; non-finite → 0 (keyboard turn held).
  const turn = F.create(M); turn.keyDown('ArrowRight', 0, false);
  for (const [dt, want] of [[1, .25 * 1.9], [.25, .25 * 1.9], [-1, 0], [NaN, 0], [Infinity, 0], ['1', 0], [undefined, 0]]) {
    turn.frame(dt); assert.equal(turn.step().lookX, want, String(dt));
  }
  // Non-finite mouse deltas are ignored rather than poisoning the view.
  turn.keyUp('ArrowRight', 0); turn.mouseMove(NaN, Infinity, 0); turn.mouseMove('3', undefined, 0); turn.addLook(NaN, -Infinity);
  turn.mouseMove(2, 0, 0); turn.frame(DT); assert.equal(turn.step().lookX, 2 * .0022);
});

test('E14c — Appareil actif sans manette : clavier, souris, tactile, filtre de 800 ms', () => {
  const {F} = load();
  const inp = F.create(M);
  assert.equal(inp.device, 'keyboard');
  let f = inp.frame(DT); assert.equal(f.device, 'keyboard'); assert.equal(f.deviceChanged, false);
  inp.mouseMove(1, 0, 100); assert.equal(inp.device, 'mouse');
  f = inp.frame(DT); assert.equal(f.deviceChanged, true); assert.equal(inp.frame(DT).deviceChanged, false);
  inp.keyUp('KeyW', 110); assert.equal(inp.device, 'mouse', 'keyUp ne change pas l’appareil');
  inp.keyDown('KeyL', 120, false); assert.equal(inp.device, 'keyboard', 'toute touche'); assert.equal(inp.frame(DT).deviceChanged, true);
  inp.keyDown('KeyL', 130, true); inp.mouseMove(0, 0, 140); assert.equal(inp.device, 'mouse'); inp.keyDown('KeyK', 150, true); assert.equal(inp.device, 'keyboard');
  assert.equal(inp.frame(DT).deviceChanged, false, 'revenu au même appareil dans l’image');
  // Mouse events within 800 ms of a touch event are the browser's emulation: the device stays 'touch'.
  inp.button('fire', true, 1000, 'touch'); assert.equal(inp.device, 'touch');
  inp.mouseMove(3, 0, 1100); assert.equal(inp.device, 'touch');
  inp.button('fireLeft', true, 1700, 'mouse'); assert.equal(inp.device, 'touch'); assert.equal(one(inp).s.fireLeft, true, 'le bouton compte quand même');
  inp.button('fireLeft', false, 1750, 'mouse');
  inp.mouseMove(3, 0, 1800); assert.equal(inp.device, 'mouse');
  inp.button('fire', false, 1900, 'touch'); assert.equal(inp.device, 'touch'); inp.button('pulse', true, 2900, 'mouse'); assert.equal(inp.device, 'mouse');
  // addLook: the device given, if known.
  inp.addLook(0, 0, 'gamepad'); assert.equal(inp.device, 'gamepad');
  inp.addLook(0, 0, 'pilot'); inp.addLook(0, 0); assert.equal(inp.device, 'gamepad');
  for (const d of ['keyboard', 'mouse', 'touch', 'gamepad']) assert.equal(F.create({...copyM(), device: d}).device, d);
});

test('E14d — configure et settings : réglages appliqués, touches tenues recomptées sans front', () => {
  const {F} = load();
  const inp = F.create(M);
  const s = inp.settings; s.keys.dash = ['KeyG']; s.keys.fire = ['KeyK'];
  assert.equal(json(inp.settings.keys.dash), json(['KeyR']), 'settings rend une copie');
  assert.equal(inp.keyDown('KeyK', 0, false), false); assert.equal(inp.keyDown('KeyR', 0, false), true);
  assert.equal(json(inp.frame(DT).pressed), json(['dash'])); assert.equal(inp.step().dash, true);
  const applied = inp.configure(s);
  assert.equal(json(applied), json(F.normalize(s, M))); assert.equal(json(inp.settings), json(applied));
  applied.keys.fire = ['KeyL']; assert.equal(json(inp.settings.keys.fire), json(['KeyK']), 'configure rend une copie');
  // KeyK, held before, now holds fire without an edge; KeyR no longer belongs to anything.
  let {f, s: r} = one(inp); assert.equal(json(f.pressed), '[]'); assert.equal(r.fire, true); assert.equal(r.dash, false);
  assert.equal(inp.keyUp('KeyK', 0), true); assert.equal(one(inp).s.fire, false);
  assert.equal(inp.keyUp('KeyR', 0), false); assert.equal(inp.keyDown('KeyR', 0, false), false); assert.equal(inp.keyDown('KeyG', 0, false), true);
  ({f, s: r} = one(inp)); assert.equal(json(f.pressed), json(['dash'])); assert.equal(r.dash, true);
  // Losing its key releases a held action, without any edge elsewhere.
  inp.keyDown('KeyW', 0, false); assert.equal(one(inp).s.moveY, 1);
  inp.configure({keys: {...JSON.parse(json(s.keys)), forward: []}});
  ({f, s: r} = one(inp)); assert.equal(r.moveY, 0); assert.equal(json(f.pressed), '[]'); assert.equal(inp.keyUp('KeyW', 0), false);
  // Sensitivity and inversion read by mouseMove; invalid settings fall back to the defaults.
  inp.configure({tune: {sensitivity: 2, invertY: true}}); inp.mouseMove(10, 10, 0);
  r = one(inp).s; assert.equal(r.lookX, 10 * .0022 * 2); assert.equal(r.lookY, 10 * .0022 * 2);
  assert.equal(json(inp.configure(null)), json(F.defaults(M)));
  assert.equal(inp.configure({tune: {sensitivity: 99}}).tune.sensitivity, 3);
  // Initial settings from the declaration, with its own mouse scale.
  const c = F.create({...copyM(), mouseScale: .003, settings: {keys: {jump: ['KeyB']}, tune: {sensitivity: .5}}});
  assert.equal(json(c.settings.keys.jump), json(['KeyB'])); assert.equal(c.keyDown('Space', 0, false), false);
  c.mouseMove(10, 0, 0); assert.equal(one(c).s.lookX, 10 * .003 * .5);
});

test('E38 — keyName : mêmes noms que FOptions.keyName', () => {
  const {F, window, ctx} = load();
  vm.runInContext(readFileSync(new URL('../src/options.js', import.meta.url), 'utf8'), ctx);
  for (const code of ['KeyW', 'Digit1', 'Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Backspace', 'Tab', 'ControlLeft', 'KeyM'])
    assert.equal(F.keyName(code), window.FOptions.keyName(code), code);
  // own names only: a property of Object.prototype is not a key name
  assert.equal(F.keyName('toString'), 'toString'); assert.equal(F.keyName('constructor'), 'constructor');
});
