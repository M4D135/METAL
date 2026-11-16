// FInput (src/input.js), the engine input layer: cases E01 to E50 listed in docs/chantier-moteur/modules/entrees.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {METAL_INPUT as M, V1_KEYS, lcg, fakePad, fakeActuator, PAD_IDS} from './finput-fixture.mjs';
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
  // The legacy haptic actuator's pulse() is generic, not the FPS action pulse.
  assert.doesNotMatch(source.replace(/\.pulse\(/g,'.hapticEffect('), /\b(fire\w*|jump|dash|sprint|weapon\w*|shield|melee|pulse|bash|metal)\b/i);
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

// ——— Step 3: settings — normalize (migrate, alt codes, pad table), assign, unbind, keyboard capture ———
const RESERVED = 'Cette touche est réservée au navigateur.';
const plain = x => JSON.parse(json(x)); // main-realm copy of a vm object
const fails = reason => json({ok: false, reason});

test('E15 — Conflit clavier : la touche d’une autre action est refusée, réglages intacts', () => {
  const {F} = load();
  const s = F.defaults(M), before = json(s);
  const r = F.assign(M, s, 'keyboard', 'interact', 'KeyR');
  assert.equal(r.ok, false); assert.equal(r.conflict, 'dash'); assert.equal(r.reason, 'Déjà utilisée : Esquive.');
  assert.equal(json(r), json({ok: false, conflict: 'dash', reason: 'Déjà utilisée : Esquive.'}));
  assert.equal(json(s), before, 'réglages passés intacts');
  // Any code of any other action, the second or third one included.
  assert.equal(json(F.assign(M, s, 'keyboard', 'jump', 'ArrowUp')), json({ok: false, conflict: 'forward', reason: 'Déjà utilisée : Avancer.'}));
  // Computed on normalize(settings): invalid settings are the defaults, and the codes normalize hands out count.
  for (const raw of [undefined, null, 'x', [], {keys: {forward: 'KeyW'}}, {keys: {forward: ['KeyW'], back: ['KeyW']}}])
    assert.equal(F.assign(M, raw, 'keyboard', 'interact', 'KeyR').conflict, 'dash', json(raw));
  const keys = plain(s.keys); delete keys.melee; keys.interact = ['KeyV'];
  const custom = {v: 2, keys}, kept = json(custom);
  assert.equal(json(F.assign(M, custom, 'keyboard', 'pulse', 'KeyB')), json({ok: false, conflict: 'melee', reason: 'Déjà utilisée : Frappe / coup de crosse.'}));
  assert.equal(json(custom), kept, 'réglages passés intacts');
  // The instance: its declaration and its current settings; nothing is applied.
  const inp = F.create(M), was = json(inp.settings);
  assert.equal(json(inp.assign('keyboard', 'interact', 'KeyR')), json(r));
  assert.equal(json(inp.settings), was);
  assert.equal(inp.keyDown('KeyR', 0, false), true); assert.equal(json(inp.frame(DT).pressed), json(['dash']));
});

test('E16 — Affectation clavier : la liste de l’action vaut [code], toutes les autres sont inchangées', () => {
  const {F} = load();
  const s = F.defaults(M), before = json(s);
  const r = F.assign(M, s, 'keyboard', 'interact', 'KeyG');
  assert.equal(json(Object.keys(r)), json(['ok', 'settings'])); assert.equal(r.ok, true);
  assert.equal(json(r.settings.keys.interact), json(['KeyG']));
  assert.equal(json(r.settings), json({...plain(s), keys: {...plain(s.keys), interact: ['KeyG']}}), 'toutes les autres listes inchangées');
  assert.equal(json(s), before, 'réglages passés intacts');
  // A normalized copy: stable under normalize and JSON; the old key is free again.
  assert.equal(json(F.normalize(r.settings, M)), json(r.settings)); assert.equal(json(F.normalize(plain(r.settings), M)), json(r.settings));
  assert.equal(F.assign(M, r.settings, 'keyboard', 'pulse', 'KeyF').ok, true);
  // [code] replaces every code of the action; an action may take back one of its own codes.
  const f = F.assign(M, s, 'keyboard', 'forward', 'KeyI').settings;
  assert.equal(json(f.keys.forward), json(['KeyI'])); assert.equal(F.assign(M, f, 'keyboard', 'jump', 'KeyW').ok, true, 'W libérée');
  assert.equal(json(F.assign(M, s, 'keyboard', 'forward', 'KeyZ').settings.keys.forward), json(['KeyZ']));
  // The pad table and tune come along, normalized.
  const t = F.assign(M, {keys: plain(s.keys), pad: {fire: ['RB']}, tune: {sensitivity: 2, padYaw: 1e9}}, 'keyboard', 'weaponNext', 'KeyN').settings;
  assert.equal(json(t.keys.weaponNext), json(['KeyN'])); assert.equal(json(t.pad.fire), json(['RB'])); assert.equal(t.tune.sensitivity, 2); assert.equal(t.tune.padYaw, 600);
  // New objects at each call.
  r.settings.keys.fire.push('KeyK'); assert.equal(json(F.assign(M, s, 'keyboard', 'interact', 'KeyG').settings.keys.fire), json(['Enter']));
  // The instance proposes; the game applies with configure.
  const inp = F.create(M), was = json(inp.settings), a = inp.assign('keyboard', 'interact', 'KeyG');
  assert.equal(json(a), json(F.assign(M, s, 'keyboard', 'interact', 'KeyG'))); assert.equal(json(inp.settings), was, 'rien n’est appliqué');
  assert.equal(inp.keyDown('KeyG', 0, false), false); inp.keyUp('KeyG', 0);
  assert.equal(json(inp.configure(a.settings)), json(a.settings));
  assert.equal(inp.keyDown('KeyF', 0, false), false); assert.equal(inp.keyDown('KeyG', 0, false), true);
  assert.equal(json(inp.frame(DT).pressed), json(['interact'])); assert.equal(inp.step().interact, true);
  // The next proposal starts from the applied settings.
  assert.equal(inp.assign('keyboard', 'pulse', 'KeyF').ok, true); assert.equal(inp.assign('keyboard', 'pulse', 'KeyG').conflict, 'interact');
});

test('E17 — Touches réservées : Échap, Méta, Ctrl, Alt et F5 sont refusées', () => {
  const {F} = load();
  const s = F.defaults(M), before = json(s), inp = F.create(M);
  for (const code of ['Escape', 'MetaLeft', 'ControlLeft', 'AltLeft', 'F5']) {
    assert.equal(json(F.assign(M, s, 'keyboard', 'fire', code)), fails(RESERVED), code);
    assert.equal(json(inp.assign('keyboard', 'fire', code)), fails(RESERVED), code);
  }
  // Whatever allowKey refuses, before any conflict: other browser keys, wrong case, non-strings.
  for (const code of ['MetaRight', 'AltRight', 'ControlRight', 'F12', 'CapsLock', 'Home', 'keyW', 'Key', 'Digit10', 'Space ', '', undefined, null, 65, ['KeyG']])
    assert.equal(json(F.assign(M, s, 'keyboard', 'fire', code)), fails(RESERVED), String(code));
  assert.equal(json(s), before);
  assert.equal(F.assign(M, s, 'keyboard', 'fire', 'Tab').ok, true, 'Tab acceptée par défaut');
  // The game's allowKey decides: here F5 is accepted and Tab refused.
  const own = {...copyM(), allowKey: code => code === 'F5' || /^(Key[A-Z]|Digit\d|Arrow\w+|Shift\w+|Space|Enter)$/.test(code)};
  assert.equal(json(F.assign(own, F.defaults(own), 'keyboard', 'fire', 'F5').settings.keys.fire), json(['F5']));
  assert.equal(json(F.assign(own, F.defaults(own), 'keyboard', 'fire', 'Tab')), fails(RESERVED));
});

test('E18 — Manette : conflit, boutons réservés ou inconnus, unbind puis assign', () => {
  const {F} = load();
  const s = F.defaults(M), before = json(s);
  assert.equal(json(F.assign(M, s, 'gamepad', 'jump', 'X')), json({ok: false, conflict: 'interact', reason: 'Déjà utilisé : Interagir.'}));
  assert.equal(json(F.assign(M, s, 'gamepad', 'jump', 'Home')), fails('Ce bouton est réservé au système.'));
  assert.equal(json(F.assign(M, s, 'gamepad', 'jump', 'Z9')), fails('Bouton inconnu.'));
  for (const b of ['a', 'KeyA', 'LS', 'RS', 'Select', '', undefined, null, 0, 16]) assert.equal(json(F.assign(M, s, 'gamepad', 'jump', b)), fails('Bouton inconnu.'), String(b));
  // unbind, then the freed button.
  const u = F.unbind(M, s, 'gamepad', 'weaponNext');
  assert.equal(json(Object.keys(u)), json(['ok', 'settings'])); assert.equal(u.ok, true);
  assert.equal(json(u.settings), json({...plain(s), pad: {...plain(s.pad), weaponNext: []}}));
  assert.equal(json(F.assign(M, s, 'gamepad', 'weapon5', 'Y')), json({ok: false, conflict: 'weaponNext', reason: 'Déjà utilisé : Arme suivante.'}));
  const w = F.assign(M, u.settings, 'gamepad', 'weapon5', 'Y');
  assert.equal(w.ok, true); assert.equal(json(w.settings), json({...plain(s), pad: {...plain(s.pad), weaponNext: [], weapon5: ['Y']}}));
  assert.equal(json(s), before, 'réglages passés intacts');
  // Each of the 16 buttons but Home belongs to an action of the table, and can be moved once freed.
  for (const b of F.PAD_BUTTONS.filter(b => b !== 'Home')) {
    const owner = M.actions.find(a => a.pad.includes(b)).id;
    assert.equal(F.assign(M, s, 'gamepad', 'weapon5', b).conflict, owner, b);
    assert.equal(json(F.assign(M, F.unbind(M, s, 'gamepad', owner).settings, 'gamepad', 'weapon5', b).settings.pad.weapon5), json([b]), b);
  }
  // The keyboard and the gamepad tables are separate.
  assert.equal(json(F.assign(M, s, 'keyboard', 'weapon5', 'Y')), fails(RESERVED), 'un bouton n’est pas une touche');
  const k = F.unbind(M, s, 'keyboard', 'jump').settings;
  assert.equal(json(k.keys.jump), '[]'); assert.equal(json(k.pad.jump), json(['A'])); assert.equal(F.assign(M, k, 'keyboard', 'dash', 'Space').ok, true);
  // The instance: unbind, configure, assign, configure.
  const inp = F.create(M), a = inp.unbind('gamepad', 'weaponNext');
  assert.equal(json(a), json(u)); assert.equal(json(inp.settings.pad.weaponNext), json(['Y']), 'rien n’est appliqué');
  assert.equal(inp.assign('gamepad', 'weapon5', 'Y').conflict, 'weaponNext');
  inp.configure(a.settings);
  const b = inp.assign('gamepad', 'weapon5', 'Y'); assert.equal(json(b), json(w));
  inp.configure(b.settings); assert.equal(json(inp.settings), json(w.settings));
  // The next proposal starts from the applied settings, for unbind too.
  assert.equal(json(inp.unbind('gamepad', 'weapon5').settings.pad), json({...plain(w.settings.pad), weapon5: []}));
});

test('E18b — assign et unbind : ordre des contrôles, appareil et action inconnus, déclaration validée', () => {
  const {F} = load();
  const s = F.defaults(M), inp = F.create(M);
  for (const d of ['mouse', 'touch', 'pilot', 'Keyboard', '', undefined, null]) {
    for (const r of [F.assign(M, s, d, 'jump', 'KeyG'), F.unbind(M, s, d, 'jump'), inp.assign(d, 'jump', 'KeyG'), inp.unbind(d, 'jump')])
      assert.equal(json(r), fails('Appareil inconnu.'), String(d));
  }
  for (const id of ['nope', 'toString', 'constructor', 'moveX', '', undefined, 5]) for (const d of ['keyboard', 'gamepad']) {
    const code = d === 'keyboard' ? 'KeyG' : 'A';
    for (const r of [F.assign(M, s, d, id, code), F.unbind(M, s, d, id), inp.assign(d, id, code), inp.unbind(d, id)])
      assert.equal(json(r), fails('Action inconnue.'), d + ' ' + String(id));
  }
  // In this order: device, action, code, conflict.
  assert.equal(F.assign(M, s, 'mouse', 'nope', 'Escape').reason, 'Appareil inconnu.');
  assert.equal(F.assign(M, s, 'keyboard', 'nope', 'Escape').reason, 'Action inconnue.');
  assert.equal(F.assign(M, s, 'gamepad', 'nope', 'Home').reason, 'Action inconnue.');
  assert.equal(F.assign(M, s, 'keyboard', 'interact', 'Escape').reason, RESERVED);
  assert.equal(F.assign(M, s, 'gamepad', 'interact', 'Home').reason, 'Ce bouton est réservé au système.');
  // unbind takes no code; unbinding an unbound action is fine.
  const u = F.unbind(M, F.unbind(M, s, 'keyboard', 'weaponNext').settings, 'keyboard', 'weaponNext');
  assert.equal(u.ok, true); assert.equal(json(u.settings), json(s));
  // An invalid declaration throws, as in create.
  for (const bad of [undefined, {actions: []}, variant(copyM, c => { c.actions[1].keys = ['KeyW']; })]) {
    assert.throws(() => F.assign(bad, s, 'keyboard', 'jump', 'KeyG'), e => String(e.message).startsWith('FInput : '));
    assert.throws(() => F.unbind(bad, s, 'keyboard', 'jump'), e => String(e.message).startsWith('FInput : '));
  }
});

test('E19 — normalize stable : idempotent, stable après un aller-retour JSON, défauts pour une table invalide', () => {
  const {F} = load();
  const D = F.defaults(M), N = raw => F.normalize(raw, M);
  const partA = {v: 2, keys: {fire: ['KeyG'], jump: ['KeyJ'], weapon5: [], ghost: ['KeyK']}, pad: {fire: ['RB'], leftHand: ['RT'], weaponNext: []}, tune: {padYaw: 420, swapSticks: true, padCurve: '2'}};
  const partB = {keys: {forward: ['KeyI', 'KeyW'], interact: ['KeyV']}, pad: {jump: ['B'], melee: []}, tune: {sensitivity: .1, invertY: true}};
  const cases = [undefined, null, 42, 'x', [], {}, {keys: {forward: 'KeyW'}}, {keys: {forward: ['KeyW'], back: ['KeyW']}}, {pad: {jump: ['Home']}}, {tune: {padYaw: 9999}}, plain(D), partA, partB];
  assert.equal(cases.length, 13);
  for (const x of cases) {
    const before = json(x), n = N(x);
    assert.equal(json(x), before, 'argument intact');
    assert.equal(json(N(n)), json(n), 'idempotent : ' + before);
    assert.equal(json(N(JSON.parse(json(n)))), json(n), 'aller-retour JSON : ' + before);
    assert.equal(json(Object.keys(n)), json(['v', 'keys', 'pad', 'tune'])); assert.equal(n.v, 2);
    for (const f of ['keys', 'pad']) {
      assert.equal(json(Object.keys(n[f])), json(IDS), f + ' dans l’ordre de déclaration');
      const codes = Object.values(n[f]).flat(); assert.equal(new Set(codes).size, codes.length, f + ' : aucun code en double');
    }
  }
  // An invalid or duplicate entry sends the whole table of its type back to the defaults; the other table stays.
  for (const x of [{keys: {forward: 'KeyW'}}, {keys: {forward: ['KeyW'], back: ['KeyW']}}, {pad: {jump: ['Home']}}]) assert.equal(json(N(x)), json(D), json(x));
  assert.equal(json(N({keys: {jump: ['KeyJ']}, pad: {jump: ['Home']}}).keys.jump), json(['KeyJ']));
  assert.equal(json(N({keys: {jump: ['Escape']}, pad: {fire: ['A']}}).pad.fire), json(['A']));
  // The pad table is read like the keys: at most 2 buttons, Home excluded, none twice; null is invalid, [] is valid.
  for (const bad of [{jump: 'A'}, {jump: ['A', 'B', 'X']}, {jump: ['A', 'A']}, {jump: ['A'], dash: ['A']}, {jump: ['Z9']}, {jump: [0]}, {jump: ['a']}, {jump: null}, {jump: {}}])
    assert.equal(json(N({pad: bad}).pad), json(D.pad), json(bad));
  const p = N(partA).pad;
  assert.equal(json(p.fire), json(['RB'])); assert.equal(json(p.leftHand), json(['RT'])); assert.equal(json(p.weaponNext), '[]'); assert.equal(json(p.fireLeft), json(['LT']));
  // An absent action takes its default buttons that no entry uses; the gamepad has no alt codes.
  const q = N(partB);
  assert.equal(json(q.pad.jump), json(['B'])); assert.equal(json(q.pad.dash), '[]'); assert.equal(json(q.pad.melee), '[]');
  assert.equal(json(N({pad: {jump: ['RB']}}).pad.leftHand), '[]', 'leftHand a des replis clavier, aucun à la manette');
  assert.equal(json(q.keys.forward), json(['KeyI', 'KeyW'])); assert.equal(json(q.keys.interact), json(['KeyV'])); assert.equal(json(q.keys.melee), json(['KeyB']));
  assert.equal(q.tune.sensitivity, .25); assert.equal(q.tune.invertY, true);
});

test('E20 — Bornes de tune : nombres finis bornés, booléens gardés, le reste aux défauts', () => {
  const {F} = load();
  const N = raw => F.normalize(raw, M).tune;
  const t = N({tune: {padYaw: 9999, padDead: -1, invertY: 'oui', sensitivity: NaN, stickRadius: 10}});
  assert.equal(t.padYaw, 600); assert.equal(t.padDead, 0); assert.equal(t.invertY, false); assert.equal(t.sensitivity, 1); assert.equal(t.stickRadius, 32);
  assert.equal(json(Object.keys(F.TUNE)), json(Object.keys(F.defaults(M).tune)));
  assert.equal(json(Object.keys(t)), json(Object.keys(F.TUNE)));
  for (const [k, [d, lo, hi]] of Object.entries(TUNE_SPEC)) {
    const only = v => N({tune: {[k]: v}})[k];
    if (lo === undefined) {
      assert.equal(only(true), true, k); assert.equal(only(false), false, k);
      for (const v of [1, 0, 'true', 'oui', null, {}, []]) assert.equal(only(v), d, k + ' ' + json(v));
      continue;
    }
    for (const [v, want] of [[lo - 1, lo], [hi + 1, hi], [-1e9, lo], [1e9, hi], [lo, lo], [hi, hi], [(lo + hi) / 2, (lo + hi) / 2]]) assert.equal(only(v), want, k + ' ' + v);
    for (const v of [NaN, Infinity, -Infinity, String(hi), true, null, {}, [hi]]) assert.equal(only(v), d, k + ' ' + String(v));
    assert.ok(!Object.is(only(-0), -0), k + ' : pas de -0');
  }
  // Unknown fields disappear; no tune gives every default.
  assert.equal(json(N({tune: {mystery: 1, PadYaw: 100}})), json(TUNE_DEFAULTS)); assert.equal(json(N({})), json(TUNE_DEFAULTS));
});

test('E21 — Action manquante : codes par défaut libres, sinon premier repli libre (clavier), sinon []', () => {
  const {F} = load();
  const D = F.defaults(M), N = raw => F.normalize(raw, M).keys;
  const keys = plain(D.keys); delete keys.melee; keys.interact = ['KeyV'];
  const n = N({v: 2, keys});
  assert.equal(json(n.melee), json(['KeyB']), 'V est pris, et C, premier repli, par fireLeft');
  assert.equal(json(n.interact), json(['KeyV'])); assert.equal(json(n.fireLeft), json(['KeyC']));
  // One code only, the first free one of the alt list; none free → [].
  assert.equal(json(N({v: 2, keys: {...keys, map: ['KeyB']}}).melee), json(['KeyN']));
  assert.equal(json(N({v: 2, keys: {...keys, map: ['KeyB'], pause: ['KeyN'], pulse: ['KeyH']}}).melee), '[]');
  // The codes given out are used by the next actions, in declaration order.
  const both = plain(D.keys); delete both.weapon4; delete both.weapon5; both.interact = ['Digit4']; both.fire = ['Digit5'];
  const b = N({v: 2, keys: both}); assert.equal(json(b.weapon4), json(['KeyG'])); assert.equal(json(b.weapon5), json(['KeyT']));
  // Default codes still free are kept, in their order, and then no alt code is needed.
  assert.equal(json(N({v: 2, keys: {jump: ['KeyW']}}).forward), json(['KeyZ', 'ArrowUp']));
  assert.equal(json(N({v: 2, keys: {jump: ['KeyW'], back: ['KeyZ'], turnLeft: ['ArrowUp']}}).forward), '[]', 'forward n’a pas de repli');
  // Every alt code taken, or no alt list: [].
  assert.equal(json(N({v: 2, keys: {weapon1: ['KeyG'], fire: ['KeyT'], pulse: ['KeyY'], interact: ['Digit5']}}).weapon5), '[]');
  assert.equal(json(N({v: 2, keys: {map: ['KeyR']}}).dash), '[]');
  // Same answer as FOptions (checks/options.test.mjs:39-52): weapon5 absent and Digit5 taken → KeyG.
  const pistol = plain(D.keys); delete pistol.weapon5; pistol.interact = ['Digit5']; pistol.fire = ['KeyH'];
  assert.equal(json(N({v: 2, keys: pistol}).weapon5), json(['KeyG']));
});

test('E21b — FInput conserve les commandes courantes et historiques normalisées par FOptions', () => {
  const {F, window, ctx} = load();
  vm.runInContext(readFileSync(new URL('../src/options.js', import.meta.url), 'utf8'), ctx);
  const O = window.FOptions;
  const current = {...M, actions:O.actions.map(a=>({...M.actions.find(x=>x.id===a.id),...a,type:M.actions.find(x=>x.id===a.id)?.type||'hold',keys:plain(O.defaults().bindings[a.id]),pad:plain(O.defaults().padBindings[a.id])}))};
  // The host migrates saved preferences through FOptions before configuring FInput.
  const same = (old, why) => {
    const o = plain(O.normalize(plain(old)).bindings), n = plain(F.normalize({v: 2, keys: o}, current).keys);
    for (const id of Object.keys(o)) if (id !== 'dash') assert.equal(json(n[id]), json(o[id]), why + ' : ' + id);
    assert.equal(json(n.dash), json(['KeyR']), why); assert.equal(json(n.jump), json(['Space']), why);
    return n;
  };
  const edit = change => { const old = plain(O.defaults()); change(old.bindings); return old; };
  const melee = same(edit(b => { for (const id of ['view', 'melee', 'fireLeft', 'leftHand', 'weapon4']) delete b[id]; b.interact = ['KeyV']; b.fire = ['KeyC']; }), 'options.test:31');
  assert.equal(json(melee.melee), json(['KeyB'])); assert.equal(F.assign(current, {v: 2, keys: melee}, 'keyboard', 'melee', 'KeyH').ok, true);
  const pistol = same(edit(b => { delete b.weapon5; b.interact = ['Digit5']; b.fire = ['KeyH']; }), 'options.test:40');
  assert.notEqual(json(pistol.weapon5), json(['Digit5'])); assert.equal(F.assign(current, {v: 2, keys: pistol}, 'keyboard', 'weapon5', 'Digit6').ok, true);
  assert.equal(json(same(edit(b => { delete b.weapon5; }), 'options.test:51').weapon5), json(['Digit5']));
  assert.equal(json(same(edit(b => { b.fire = ['KeyW']; }), 'options.test:27').fire), json(['Enter']));
  same(O.defaults(), 'défauts');
  // Same conflicts and texts, same refusals.
  const v1 = F.normalize({v: 1, keys: plain(O.defaults().bindings)}, current);
  for (const [id, code] of [['interact', 'KeyE'], ['fire', 'KeyW'], ['sprint', 'Digit1'], ['pulse', 'KeyF']]) {
    const a = F.assign(current, v1, 'keyboard', id, code), b = O.assign(O.defaults().bindings, id, code);
    assert.equal(a.ok, false); assert.equal(a.conflict, b.conflict, id); assert.equal(a.reason, b.reason, id);
  }
  for (const code of ['Escape', 'MetaLeft', 'ControlLeft']) assert.equal(F.assign(current, v1, 'keyboard', 'fire', code).reason, O.assign(O.defaults().bindings, 'fire', code).reason);
  // Planned difference (FEEL-01, FEEL-09): R is the dodge in v2; options.test.mjs:18 puts interact on R, so it takes another free key at the hookup.
  assert.equal(F.assign(current, v1, 'keyboard', 'interact', 'KeyR').conflict, 'dash'); assert.equal(F.assign(current, v1, 'keyboard', 'interact', 'KeyH').ok, true);
});

test('E22 — Migration v1 → v2 : Espace saute, R esquive ; migrate seulement pour un format plus ancien', () => {
  const {F} = load();
  const D = F.defaults(M), v1 = {v: 1, keys: V1_KEYS}, before = json(v1);
  const n = F.normalize(v1, M);
  assert.equal(json(n.keys), json(D.keys)); assert.equal(json(n.keys.dash), json(['KeyR'])); assert.equal(json(n.keys.jump), json(['Space']));
  assert.equal(json(n), json(D));
  assert.equal(json(v1), before, 'le profil passé reste intact (migrate reçoit une copie)');
  // A counter in a copy of M: migrate runs only when v is below the version or not an integer, with a copy and from.
  const calls = [], C = {...copyM(), migrate(raw, from) { calls.push({raw: json(raw), from}); return M.migrate(raw, from); }};
  const counted = raw => { calls.length = 0; return F.normalize(raw, C); };
  let r = counted({v: 2, keys: V1_KEYS});
  assert.equal(calls.length, 0, 'un profil v2 n’appelle pas migrate');
  assert.equal(json(r.keys.dash), json(['Space'])); assert.equal(json(r.keys.jump), json(['KeyJ']), 'v2 gardé tel quel : le saut prend son repli');
  for (const v of [3, 9]) { counted({v, keys: V1_KEYS}); assert.equal(calls.length, 0, 'v ' + v); }
  for (const [v, from] of [[1, 1], [0, 0], [-3, -3], [undefined, 0], ['1', 0], [1.5, 0], [null, 0], [true, 0]]) {
    r = counted({v, keys: V1_KEYS});
    assert.equal(json(calls.map(c => c.from)), json([from]), 'v ' + String(v)); assert.equal(json(r.keys), json(D.keys), 'v ' + String(v));
  }
  counted({v: 1, keys: V1_KEYS, tune: {padYaw: 500}}); assert.equal(calls[0].raw, json({v: 1, keys: V1_KEYS, tune: {padYaw: 500}}));
  // A migrate that throws, that changes its copy and then throws, or that returns no object: valid settings, without migration.
  const unmigrated = F.normalize({v: 2, keys: V1_KEYS}, M);
  for (const migrate of [() => { throw new Error('test'); }, raw => { raw.keys.dash = ['KeyW']; throw new Error('test'); }, () => undefined, () => null, () => 5, () => 'x', () => [],
    raw => { const o = {...raw}; o.self = o; return o; }]) {
    const c = {...copyM(), migrate}, s = F.normalize({v: 1, keys: V1_KEYS}, c);
    assert.equal(json(s), json(unmigrated), String(migrate)); assert.equal(json(F.normalize(s, c)), json(s));
    assert.equal(json(F.create({...c, settings: {v: 1, keys: V1_KEYS}}).settings), json(unmigrated));
  }
  // A new object returned by migrate replaces the copy, and goes through the same rules.
  const fresh = F.normalize({v: 1}, {...copyM(), migrate: () => ({keys: {jump: ['KeyJ']}, tune: {padYaw: 1e9}})});
  assert.equal(json(fresh.keys.jump), json(['KeyJ'])); assert.equal(fresh.tune.padYaw, 600); assert.equal(fresh.v, 2);
  // As in stored settings, an entry set to undefined is absent.
  const gap = F.normalize({v: 1}, {...copyM(), migrate: () => ({keys: {jump: undefined, dash: ['KeyJ']}})}).keys;
  assert.equal(json(gap.jump), json(['Space'])); assert.equal(json(gap.dash), json(['KeyJ']));
  // Custom v1 tables. R taken: the dodge is left unbound, to rebind; Space still goes to the jump.
  const taken = F.normalize({v: 1, keys: {...V1_KEYS, interact: ['KeyR']}}, M).keys;
  assert.equal(json(taken.dash), '[]'); assert.equal(json(taken.jump), json(['Space'])); assert.equal(json(taken.interact), json(['KeyR']));
  const two = F.normalize({v: 1, keys: {...V1_KEYS, dash: ['Space', 'KeyK']}}, M).keys;
  assert.equal(json(two.dash), json(['KeyK'])); assert.equal(json(two.jump), json(['Space']));
  const moved = F.normalize({v: 1, keys: {...V1_KEYS, dash: ['KeyK'], fire: ['Space']}}, M).keys;
  assert.equal(json(moved.dash), json(['KeyK'])); assert.equal(json(moved.fire), json(['Space'])); assert.equal(json(moved.jump), json(['KeyJ']));
  // create and configure read old settings through migrate too.
  const inp = F.create({...copyM(), settings: {v: 1, keys: V1_KEYS}});
  assert.equal(json(inp.settings), json(D));
  inp.keyDown('Space', 0, false); inp.keyDown('KeyR', 0, false); assert.equal(json(inp.frame(DT).pressed), json(['jump', 'dash']));
  assert.equal(json(inp.configure({v: 1, keys: V1_KEYS})), json(D));
});

test('E23 — Capture clavier : le prochain appui va à frame().captured, jamais au jeu', () => {
  const {F} = load();
  const inp = F.create(M);
  inp.mouseMove(1, 0, 0); assert.equal(inp.device, 'mouse');
  inp.capture('keyboard');
  assert.equal(inp.keyDown('KeyG', 10, false), true); assert.equal(inp.device, 'keyboard');
  let r = one(inp);
  assert.equal(json(r.f.captured), json({device: 'keyboard', code: 'KeyG'})); assert.equal(json(r.f.pressed), '[]');
  assert.equal(inp.frame(DT).captured, null, 'une seule fois');
  // KeyG is not held: given to a held action, configure finds no key down. The capture is over.
  inp.configure(F.assign(M, inp.settings, 'keyboard', 'fire', 'KeyG').settings);
  assert.equal(one(inp).s.fire, false);
  assert.equal(inp.keyDown('KeyG', 20, false), true); assert.equal(one(inp).s.fire, true); inp.keyUp('KeyG', 30); inp.configure();
  // A key of the game is not applied either: no front, no impulse, not held; its keyUp changes nothing.
  inp.capture('keyboard');
  assert.equal(inp.keyDown('KeyR', 40, false), true); assert.equal(inp.keyDown('KeyW', 41, false), true, 'capture finie : KeyW va au jeu');
  r = one(inp); assert.equal(json(r.f.captured), json({device: 'keyboard', code: 'KeyR'})); assert.equal(json(r.f.pressed), json(['forward'])); assert.equal(r.s.dash, false);
  assert.equal(inp.keyUp('KeyR', 50), true); inp.keyUp('KeyW', 50); assert.ok(idle(one(inp).s));
  // A repeat is not a new press: swallowed, as game.js does today.
  inp.capture('keyboard');
  assert.equal(inp.keyDown('Enter', 60, true), true); assert.equal(inp.frame(DT).captured, null);
  assert.equal(inp.keyDown('KeyH', 70, false), true); assert.equal(json(inp.frame(DT).captured), json({device: 'keyboard', code: 'KeyH'}));
  assert.equal(one(inp).s.fire, false, 'Entrée n’a pas été tenue');
  // Any code is captured, but only a code; the game reads the refusal from assign.
  inp.capture('keyboard'); assert.equal(inp.keyDown(undefined, 75, false), true); assert.equal(inp.frame(DT).captured, null);
  inp.keyDown('Escape', 80, false);
  const esc = inp.frame(DT).captured; assert.equal(json(esc), json({device: 'keyboard', code: 'Escape'}));
  assert.equal(inp.assign(esc.device, 'interact', esc.code).reason, RESERVED);
  // capture(null) cancels, and so does an unknown device; capture('gamepad') leaves the keyboard alone.
  for (const d of [null, undefined, 'mouse', 'pilot', 'gamepad']) {
    inp.capture('keyboard'); inp.capture(d);
    assert.equal(inp.keyDown('KeyR', 90, false), true); r = one(inp);
    assert.equal(r.f.captured, null, String(d)); assert.equal(json(r.f.pressed), json(['dash'])); assert.equal(r.s.dash, true);
    inp.keyUp('KeyR', 95);
  }
  inp.capture(null);
  // A new capture, or clear(), drops a result not handed out yet; clear() also ends the capture.
  inp.capture('keyboard'); inp.keyDown('KeyK', 100, false); inp.capture('keyboard');
  assert.equal(inp.frame(DT).captured, null, 'nouvelle capture'); inp.keyDown('KeyL', 110, false); assert.equal(json(inp.frame(DT).captured), json({device: 'keyboard', code: 'KeyL'}));
  inp.capture('keyboard'); inp.keyDown('KeyK', 120, false); inp.clear(); assert.equal(inp.frame(DT).captured, null, 'clear');
  inp.capture('keyboard'); inp.clear();
  assert.equal(inp.keyDown('KeyR', 130, false), true); r = one(inp); assert.equal(json(r.f.pressed), json(['dash'])); assert.equal(r.f.captured, null); inp.keyUp('KeyR', 140);
  // A key held before the capture stays held, and is released normally.
  inp.keyDown('KeyW', 150, false); inp.capture('keyboard'); inp.keyDown('KeyJ', 160, false); r = one(inp);
  assert.equal(r.s.moveY, 1); assert.equal(json(r.f.captured), json({device: 'keyboard', code: 'KeyJ'}));
  inp.keyUp('KeyW', 170); assert.equal(one(inp).s.moveY, 0);
  // The whole flow of the options screen: capture, press, assign, configure, play.
  inp.capture('keyboard'); inp.keyDown('KeyG', 200, false); const got = inp.frame(DT).captured;
  const a = inp.assign(got.device, 'interact', got.code); assert.equal(a.ok, true); inp.configure(a.settings);
  inp.keyUp('KeyG', 210); inp.keyDown('KeyG', 220, false); r = one(inp);
  assert.equal(json(r.f.pressed), json(['interact'])); assert.equal(r.s.interact, true); assert.equal(inp.keyDown('KeyF', 230, false), false);
});

// ——— Step 4: gamepad — reading, fusion, dead zones, curve, boost, triggers, values, run, hot plug, device, capture, swap ———
const DEG = 180 / Math.PI, RAD = Math.PI / 180;
// FEEL-10 yaw at a deflection d of the right stick, first frame: ((d − .12) / .85)^1,7 × 300 °/s.
const yawAt = d => Math.pow(Math.min(1, (d - .12) / .85), 1.7) * 300;
const withTune = (F, tune) => { const inp = F.create(M), s = inp.settings; Object.assign(s.tune, tune); inp.configure(s); return inp; };
const noNegZero = (o, where) => { for (const [k, v] of Object.entries(o)) assert.ok(!Object.is(v, -0), where + ' : ' + k); };

test('E24 — radial : zone morte radiale avec remise à l’échelle', () => {
  const {F} = load();
  assert.equal(json(F.radial(.1, .1, .15, .97)), json([0, 0, 0]));
  let [x, y, n] = F.radial(0, -.55, .15, .97);
  near(n, .487804878, 1e-9, 'n'); assert.equal(x, 0); assert.equal(y, -n);
  [x, y, n] = F.radial(.7, .7, .12, .97);
  assert.equal(n, 1); near(x, .70711, 1e-5, 'x'); near(y, .70711, 1e-5, 'y');
  assert.equal(json(F.radial(3, 4, .12, .97)), json([.6, .8, 1]));
  // The direction is kept and the norm rescaled: n = (m − inner) / (outer − inner), 1 from the outer radius on.
  [x, y, n] = F.radial(-.3, .4, .12, .97); near(n, (.5 - .12) / .85, 1e-15, 'n'); near(x, -.6 * n, 1e-15, 'x'); near(y, .8 * n, 1e-15, 'y');
  assert.equal(F.radial(0, .97, .12, .97)[2], 1); assert.ok(F.radial(0, .96, .12, .97)[2] < 1);
  // On the inner radius or inside: nothing. No -0, no NaN (0/0, non-finite input).
  for (const [a, b, inner] of [[.12, 0, .12], [0, -.12, .12], [0, 0, 0], [-0, -0, 0], [NaN, 0, .12], [0, NaN, .12]]) assert.equal(json(F.radial(a, b, inner, .97)), json([0, 0, 0]), a + ', ' + b);
  for (const r of [F.radial(-0, .5, .12, .97), F.radial(.5, -0, .12, .97), F.radial(-0, -.5, .12, .97)]) noNegZero(r, 'radial');
});

test('E25 — Déplacement à la manette : zone morte .15, course au bout du stick (n ≥ .92)', () => {
  const {F, pads} = load();
  const inp = F.create(M);
  const at = (x, y) => { pads.list = [fakePad({axes: [x, y, 0, 0]})]; return one(inp); };
  let {f, s} = at(0, -.55);
  near(s.moveY, .487805, 1e-6, '(0, -.55)'); assert.equal(s.moveX, 0); assert.equal(s.sprint, false);
  ({f, s} = at(0, -.90)); assert.equal(s.sprint, false, '(0, -.90) : n = 0,9146'); assert.equal(json(f.pressed), '[]');
  ({f, s} = at(0, -.91)); assert.equal(s.sprint, true, '(0, -.91) : n = 0,9268'); assert.equal(json(f.pressed), json(['sprint']));
  ({f, s} = at(0, -1)); assert.equal(s.moveY, 1); assert.equal(s.sprint, true); assert.equal(json(f.pressed), '[]', 'déjà tenue');
  ({f, s} = at(.1, .1)); assert.ok(idle(s), json(s));
  // Back, sideways, diagonal: forward positive, a norm of 1 at most; the run needs the norm, not one axis.
  s = at(0, 1).s; assert.equal(s.moveY, -1); assert.equal(s.moveX, 0);
  s = at(-1, 0).s; assert.equal(s.moveX, -1); assert.equal(s.moveY, 0);
  s = at(1, 1).s; near(s.moveX, Math.SQRT1_2, 1e-15, 'diagonale'); near(s.moveY, -Math.SQRT1_2, 1e-15, 'diagonale'); assert.equal(s.sprint, true);
  // Below the run threshold, Shift still runs; the stick and the keys are OR-ed on the run action.
  at(0, -.5); inp.keyDown('ShiftLeft', 0, false); assert.equal(at(0, -.5).s.sprint, true); inp.keyUp('ShiftLeft', 0);
  assert.equal(at(0, -.5).s.sprint, false);
  // A run seen by one frame only, with no step in it, still reaches the first step (latch, LOOP-06), like a key.
  inp.frame(DT); pads.list = [fakePad({axes: [0, -1, 0, 0]})]; inp.frame(DT); pads.list = [fakePad()]; inp.frame(DT);
  assert.equal(inp.step().sprint, true); assert.equal(inp.step().sprint, false);
  // moveDead is read from the settings.
  const wide = withTune(F, {moveDead: .4}); pads.list = [fakePad({axes: [0, -.55, 0, 0]})];
  near(one(wide).s.moveY, (.55 - .4) / (.97 - .4), 1e-15, 'moveDead .4');
});

test('E26 — Lacet (FEEL-10) : 5,40, 76,34, 156,65 et 300 °/s à 20, 50, 70 et 100 %', () => {
  const {F, pads} = load();
  const rate = d => { const inp = F.create(M); pads.list = [fakePad({axes: [0, 0, d, 0]})]; const s = one(inp).s; assert.equal(s.lookY, 0); return s.lookX / DT * DEG; };
  for (const [d, want, tol] of [[.2, 5.40, .05], [.5, 76.34, .05], [.7, 156.65, .05], [1, 300, 1e-9]]) {
    const r = rate(d);
    near(r, want, tol, 'déflexion ' + d); near(r, yawAt(d), 1e-9, 'formule, déflexion ' + d);
  }
  // The rest of the table of bancs/feel/gamepad-map.mjs, and the dead zone .12.
  for (const [d, want] of [[.35, 32.5], [.85, 231.6], [.95, 288.1]]) near(rate(d), want, .05, 'déflexion ' + d);
  for (const d of [.05, .12]) assert.equal(rate(d), 0, 'zone morte ' + d);
  near(rate(-.5), -yawAt(.5), 1e-9, 'vers la gauche');
  // Fine aim: 0,090° per frame at 20 % (FEEL-10).
  near(rate(.2) / 60, .090, .0005, 'visée fine');
  // padYaw, padDead and padCurve are read from the settings.
  const tuned = withTune(F, {padYaw: 420, padDead: .2, padCurve: 2.2}); pads.list = [fakePad({axes: [0, 0, .5, 0]})];
  near(one(tuned).s.lookX / DT * DEG, Math.pow((.5 - .2) / (.97 - .2), 2.2) * 420, 1e-9, 'réglages');
});

test('E27 — Tangage : +190 °/s × dt vers le haut, opposé avec padInvertY', () => {
  const {F, pads} = load();
  const pitch = (y, tune = {}) => { const inp = withTune(F, tune); pads.list = [fakePad({axes: [0, 0, 0, y]})]; const s = one(inp).s; assert.equal(s.lookX, 0); return s.lookY; };
  near(pitch(-1), 190 * RAD * DT, 1e-12, 'stick vers le haut');
  near(pitch(-1, {padInvertY: true}), -190 * RAD * DT, 1e-12, 'padInvertY');
  near(pitch(1), -190 * RAD * DT, 1e-12, 'stick vers le bas'); near(pitch(1, {padInvertY: true}), 190 * RAD * DT, 1e-12, 'vers le bas, inversé');
  near(pitch(-.5), Math.pow(.38 / .85, 1.7) * 190 * RAD * DT, 1e-12, 'courbe');
  near(pitch(-1, {padPitch: 250}), 250 * RAD * DT, 1e-12, 'padPitch');
  // invertY (mouse and touch) leaves the pad alone; padInvertY leaves the mouse alone.
  near(pitch(-1, {invertY: true}), 190 * RAD * DT, 1e-12, 'invertY');
  const inp = withTune(F, {padInvertY: true}); pads.list = []; inp.mouseMove(0, -10, 0); near(one(inp).s.lookY, 10 * .0022, 1e-15, 'souris');
});

test('E28 — Demi-tour : 58 images de 1/120 s (0,483 s) et 29 de 1/60 s ; 600 ms sans surcroît', () => {
  const {F, pads} = load();
  // Per-frame look of a stick held at (x, y), one frame and one step per image.
  const hold = (dt, frames, tune = {}, axes = [0, 0, 1, 0]) => { const inp = withTune(F, tune); pads.list = [fakePad({axes})]; return Array.from({length: frames}, () => { inp.frame(dt); return inp.step(); }); };
  const reach = (dt, tune) => { let a = 0; return hold(dt, 200, tune).findIndex(s => (a += s.lookX) >= Math.PI) + 1; };
  assert.equal(reach(1 / 120), 58); near(58 / 120, .4833, 5e-5, 'durée');
  assert.equal(reach(1 / 60), 29);
  // Without the boost: 180° / 300 °/s = 0,6 s, i.e. 72 frames of 1/120 s.
  near(hold(1 / 120, 72, {padBoost: 0}).reduce((a, s) => a + s.lookX, 0), Math.PI, 1e-12, 'sans surcroît');
  // Boost: none for 0,18 s (21 frames of 1/120 s), ramp over 0,30 s, +80 % from 0,48 s (frame 58) on.
  const x = hold(1 / 120, 60).map(s => s.lookX), base = 300 * RAD / 120;
  for (let k = 0; k < 21; k++) near(x[k], base, 1e-15, 'image ' + (k + 1));
  near(x[21], base * (1 + .8 * ((22 / 120 - .18) / .3)), 1e-15, 'image 22 : temps compté avant la rampe');
  for (let k = 21; k < 57; k++) assert.ok(x[k + 1] > x[k], 'rampe, image ' + (k + 2));
  near(x[57], base * 1.8, 1e-15, 'image 58'); near(x[59], base * 1.8, 1e-15, 'image 60');
  // The boost applies to the yaw only: on a diagonal, the pitch stays the same at every frame.
  const diag = hold(1 / 120, 60, {}, [0, 0, 1, -1]), y0 = diag[0].lookY;
  assert.ok(diag.every(s => s.lookY === y0)); assert.ok(diag[59].lookX > 1.7 * diag[0].lookX);
  // Below n = .97 (here .9176) the time at full deflection restarts from 0.
  const inp = F.create(M); pads.list = [fakePad({axes: [0, 0, 1, 0]})];
  for (let k = 0; k < 60; k++) one(inp);
  pads.list = [fakePad({axes: [0, 0, .9, 0]})]; near(one(inp).s.lookX, yawAt(.9) * RAD * DT, 1e-15, 'sous .97');
  pads.list = [fakePad({axes: [0, 0, 1, 0]})]; near(one(inp).s.lookX, 300 * RAD * DT, 1e-15, 'surcroît remis à zéro');
  // clear() restarts it too.
  for (let k = 0; k < 60; k++) one(inp);
  inp.clear(); near(one(inp).s.lookX, 300 * RAD * DT, 1e-15, 'surcroît remis à zéro par clear()');
  // padBoost is read from the settings.
  near(hold(1 / 120, 60, {padBoost: 1.5})[59].lookX, base * 2.5, 1e-15, 'padBoost 1,5');
});

test('E29 — Ralentissement sur cible : lookScale .55, sur la visée à la manette seulement', () => {
  const {F, pads} = load();
  pads.list = [fakePad({axes: [0, 0, .5, -.6]})];
  const a = F.create(M), b = F.create(M);
  for (let k = 0; k < 3; k++) {
    a.frame(DT); b.frame(DT, {lookScale: .55});
    const sa = a.step(), sb = b.step();
    for (const key of ['lookX', 'lookY']) assert.ok(sa[key] !== 0 && Math.abs(sb[key] - .55 * sa[key]) <= 1e-12 * Math.abs(sa[key]), key + ' : ' + sb[key] + ' / ' + sa[key]);
  }
  // Boosted yaw too (stick at full deflection for 0,5 s).
  pads.list = [fakePad({axes: [0, 0, 1, 0]})];
  for (let k = 0; k < 30; k++) { a.frame(DT); b.frame(DT, {lookScale: .55}); }
  const sa = a.step().lookX, sb = b.step().lookX; assert.ok(Math.abs(sb - .55 * sa) <= 1e-12 * sa);
  // Mouse and keyboard look are left alone; an invalid lookScale counts as 1.
  pads.list = [];
  a.mouseMove(10, 0, 0); a.keyDown('ArrowRight', 0, false); a.frame(DT, {lookScale: .55}); near(a.step().lookX, 10 * .0022 + 1.9 * DT, 1e-15, 'souris et clavier');
  a.keyUp('ArrowRight', 0);
  pads.list = [fakePad({axes: [0, 0, .5, 0]})];
  for (const ctx of [undefined, null, {}, {lookScale: NaN}, {lookScale: '0.5'}, {lookScale: Infinity}]) {
    const c = F.create(M); c.frame(DT, ctx); near(c.step().lookX, yawAt(.5) * RAD * DT, 1e-15, json(ctx));
  }
  const still = F.create(M); still.frame(DT, {lookScale: 0}); assert.equal(still.step().lookX, 0, 'lookScale 0');
});

test('E30 — Gâchettes : hystérésis .30 / .18, fronts aux images 2 et 6', () => {
  const {F, pads} = load();
  const run = (button, id, values) => {
    const inp = F.create(M), held = [], fronts = [];
    values.forEach((v, i) => { pads.list = [fakePad({press: {[button]: v}})]; const {f, s} = one(inp); held.push(s[id]); if (f.pressed.includes(id)) fronts.push(i + 1); });
    return {held, fronts};
  };
  let r = run('RT', 'fire', [.25, .31, .20, .17, .29, .31]);
  assert.equal(json(r.held), json([false, true, true, false, false, true])); assert.equal(json(r.fronts), json([2, 6]));
  r = run('LT', 'fireLeft', [.25, .31, .20, .17, .29, .31]);
  assert.equal(json(r.held), json([false, true, true, false, false, true])); assert.equal(json(r.fronts), json([2, 6]));
  // The thresholds are strict: .30 does not press, .18 releases.
  r = run('RT', 'fire', [.30, .3001, .18, .1801, .19, .18]);
  assert.equal(json(r.held), json([false, true, false, false, false, false]));
  // pressed does not count for a trigger: only its value (fixture: pressed when value > .5), across all pads.
  const inp = F.create(M);
  pads.list = [fakePad({press: {RT: .2}}), fakePad({index: 1, press: {RT: .35}})]; assert.equal(one(inp).s.fire, true);
  pads.list = [fakePad({press: {RT: .25}}), fakePad({index: 1, press: {RT: 0}})]; assert.equal(one(inp).s.fire, true, 'la plus forte valeur des manettes');
  pads.list = [fakePad({press: {RT: .1}}), fakePad({index: 1, press: {RT: .1}})]; assert.equal(one(inp).s.fire, false);
  const digital = fakePad(); digital.buttons[7] = {pressed: true, touched: true, value: 0}; pads.list = [digital];
  assert.equal(one(inp).s.fire, false, 'pressed sans valeur');
  // A short pull, released before the next frame is read, is not seen (the pad is polled); a pull over one frame is latched.
  pads.list = [fakePad({press: {RT: 1}})]; inp.frame(DT); pads.list = [fakePad()]; inp.frame(DT);
  assert.equal(inp.step().fire, true); assert.equal(inp.step().fire, false);
});

test('E31 — Valeur analogique : RT .5 → 0,473684 ; .04 → 0 ; 1 → 1 ; sa touche → 1', () => {
  const {F, pads} = load();
  const inp = F.create({actions: [{id: 'throttle', type: 'value', keys: ['KeyT'], pad: ['RT']}, {id: 'brake', type: 'value', pad: ['LT', 'A']}, {id: 'h', type: 'hold', pad: ['RB']}]});
  const at = press => { pads.list = [fakePad({press})]; return one(inp).s; };
  near(at({RT: .5}).throttle, .473684, 1e-6, 'RT .5'); near(at({RT: .5}).throttle, .45 / .95, 1e-15, 'RT .5');
  assert.equal(at({RT: .04}).throttle, 0); assert.equal(at({RT: .05}).throttle, 0); assert.equal(at({RT: 1}).throttle, 1);
  near(at({RT: .2}).throttle, .15 / .95, 1e-15, 'sous le seuil du bouton, la valeur compte');
  pads.list = []; inp.keyDown('KeyT', 0, false); assert.equal(one(inp).s.throttle, 1);
  pads.list = [fakePad({press: {RT: .5}})]; assert.equal(one(inp).s.throttle, 1, 'la touche l’emporte'); inp.keyUp('KeyT', 0);
  // Its highest button counts; an ordinary button gives 0 or 1; nothing else reads a value.
  near(at({LT: .6}).brake, .55 / .95, 1e-15, 'LT'); assert.equal(at({LT: .6, A: 1}).brake, 1); assert.equal(at({A: .4}).brake, 0); assert.equal(at({A: .6}).brake, 1);
  assert.equal(at({RB: 1}).h, true); assert.equal(at({RB: 1, RT: 0}).throttle, 0);
  const s = at({}); assert.equal(s.throttle, 0); assert.equal(s.brake, 0); assert.equal(s.h, false);
});

test('E32 — Fusion : déplacement le plus fort, visée sommée avec la souris, plusieurs manettes', () => {
  const {F, pads} = load();
  const inp = F.create(M);
  inp.keyDown('KeyW', 0, false); pads.list = [fakePad({axes: [.55, 0, 0, 0]})];
  let s = one(inp).s; assert.equal(s.moveX, 0); assert.equal(s.moveY, 1);
  inp.keyUp('KeyW', 0); pads.list = [fakePad({axes: [1, 0, 0, 0]})];
  s = one(inp).s; assert.equal(s.moveX, 1); assert.equal(s.moveY, 0); noNegZero(s, 'stick seul');
  pads.list = [fakePad({axes: [0, 0, .5, 0]})]; inp.mouseMove(100, 0, 0);
  s = one(inp).s; near(s.lookX, .22 + 76.33809 * RAD / 60, 1e-6, 'souris + stick'); near(s.lookX, .22 + yawAt(.5) * RAD / 60, 1e-9, 'souris + stick');
  // Keyboard turn and stick add up too; the touch stick (step 7) is a third candidate for the move.
  inp.keyDown('ArrowLeft', 0, false); s = one(inp).s; near(s.lookX, (yawAt(.5) * RAD - 1.9) / 60, 1e-12, 'clavier + stick'); inp.keyUp('ArrowLeft', 0);
  // Equal norms: the keyboard keeps the move (a later candidate needs a strictly greater norm).
  inp.keyDown('KeyD', 0, false); pads.list = [fakePad({axes: [0, -1, 0, 0]})]; s = one(inp).s; assert.equal(s.moveX, 1); assert.equal(s.moveY, 0); inp.keyUp('KeyD', 0);
  // Two pads: per role, the strongest stick (on the second pad for the move, on the first for the aim); buttons OR-ed.
  pads.list = [fakePad({axes: [.3, 0, .6, 0], press: {A: 1}}), fakePad({index: 1, id: PAD_IDS.ps, axes: [0, -.8, .2, 0], press: {B: 1}})];
  let f; ({f, s} = one(inp));
  near(s.moveY, (.8 - .15) / .82, 1e-15, 'stick le plus fort'); assert.equal(s.moveX, 0); near(s.lookX, yawAt(.6) * RAD * DT, 1e-15, 'visée');
  assert.equal(json(f.pressed), json(['jump', 'dash'])); assert.equal(s.jump, true); assert.equal(s.dash, true);
  pads.list = [fakePad({press: {A: 1}}), fakePad({index: 1, id: PAD_IDS.ps, press: {A: 1}})]; ({f, s} = one(inp)); assert.equal(json(f.pressed), '[]');
  pads.list = [fakePad({index: 1, id: PAD_IDS.ps, press: {A: 1}})]; ({f} = one(inp)); assert.equal(json(f.pressed), '[]', 'A reste tenu sur l’autre manette');
  // No -0 from the pad (negative zero axes, opposite directions).
  for (const axes of [[-0, -0, -0, -0], [-1, 0, -1, 0], [0, 1, 0, 1], [-.5, -0, -.5, -0]]) {
    pads.list = [fakePad({axes})]; const r = one(inp); noNegZero(r.s, json(axes)); noNegZero(inp.pendingLook(), json(axes));
  }
});

test('E33 — Branchement à chaud : connected et disconnected une seule fois, null et mapping non standard acceptés', () => {
  const {F, pads} = load();
  const inp = F.create(M), card = {index: 0, id: PAD_IDS.xbox, style: 'xbox', standard: true};
  let f = inp.frame(DT); assert.equal(json([f.connected, f.disconnected, f.pads]), '[[],[],[]]');
  pads.list = [fakePad({press: {RT: 1}})];
  let s; ({f, s} = one(inp));
  assert.equal(json(f.connected), json([card])); assert.equal(json(f.pads), json([card])); assert.equal(json(f.disconnected), '[]'); assert.equal(s.fire, true);
  ({f, s} = one(inp)); assert.equal(json(f.connected), '[]', 'une seule fois'); assert.equal(json(f.pads), json([card])); assert.equal(s.fire, true);
  // The cards handed out are copies.
  f.pads[0].id = 'x'; f.pads[0].index = 9; assert.equal(json(inp.frame(DT).pads), json([card]));
  pads.list = [];
  ({f, s} = one(inp)); assert.equal(json(f.disconnected), json([{index: 0, id: PAD_IDS.xbox}])); assert.equal(json(f.pads), '[]'); assert.equal(s.fire, false);
  ({f, s} = one(inp)); assert.equal(json(f.disconnected), '[]', 'une seule fois'); assert.equal(s.fire, false);
  // Null entries and disconnected pads are skipped; the index of the pad, else its place in the list.
  const loose = fakePad({id: PAD_IDS.other, press: {A: 1}}); delete loose.index;
  pads.list = [null, fakePad({index: 1, id: PAD_IDS.ps}), null, null, loose, {...fakePad({index: 5}), connected: false}, undefined, 'pad', 7];
  ({f, s} = one(inp));
  assert.equal(json(f.connected), json([{index: 1, id: PAD_IDS.ps, style: 'ps', standard: true}, {index: 4, id: PAD_IDS.other, style: 'generic', standard: true}]));
  assert.equal(s.jump, true, 'boutons lus');
  // A non-standard mapping is read by index anyway.
  pads.list = [fakePad({id: PAD_IDS.other, mapping: '', press: {B: 1}, axes: [0, -1, 0, 0]})];
  ({f, s} = one(inp));
  assert.equal(json(f.connected), json([{index: 0, id: PAD_IDS.other, style: 'generic', standard: false}]));
  assert.equal(json(f.disconnected), json([{index: 1, id: PAD_IDS.ps}, {index: 4, id: PAD_IDS.other}]));
  assert.equal(s.dash, true); assert.equal(s.moveY, 1);
  // Key = index + ':' + id: another index, or another id, is another pad. The index is the pad's, not its place in the list.
  pads.list = [fakePad({index: 2, id: PAD_IDS.other, mapping: ''})]; f = inp.frame(DT);
  assert.equal(json([f.connected.map(c => c.index), f.disconnected.map(c => c.index)]), '[[2],[0]]');
  pads.list = [fakePad({index: 2, id: PAD_IDS.ps})]; f = inp.frame(DT);
  assert.equal(json([f.connected.map(c => c.id), f.disconnected.map(c => c.id)]), json([[PAD_IDS.ps], [PAD_IDS.other]]));
  assert.equal(json(f.pads), json([{index: 2, id: PAD_IDS.ps, style: 'ps', standard: true}]));
  // A list-like object (GamepadList), as well as anything getGamepads may give or throw: no pad, no error.
  pads.list = {length: 2, 0: null, 1: fakePad({index: 1})}; assert.equal(json(inp.frame(DT).pads.map(c => c.index)), '[1]');
  for (const bad of [null, undefined, 5, 'ab', {}, true]) { pads.list = bad; assert.equal(json(inp.frame(DT).pads), '[]', String(bad)); }
  const thrower = F.create({...copyM(), getGamepads: () => { throw new Error('test'); }}); assert.equal(json(thrower.frame(DT).pads), '[]');
  // Missing or odd fields count for 0.
  pads.list = [{index: 0, id: 'Bare', connected: true}, {index: 1, id: 'Odd', axes: [NaN, Infinity, '1', null], buttons: [1, null, {value: NaN, pressed: false}, {}]}];
  ({f, s} = one(inp)); assert.equal(f.pads.length, 2); assert.equal(s.jump, true, 'un bouton en nombre'); assert.equal(s.moveX, 0); assert.equal(s.moveY, 0); assert.equal(s.lookX, 0);
  // getGamepads of the declaration replaces navigator.getGamepads, and is read again at each frame.
  let list = [fakePad({press: {B: 1}})];
  const own = F.create({...copyM(), getGamepads: () => list});
  f = own.frame(DT); assert.equal(json(f.pressed), json(['dash'])); assert.equal(own.step().dash, true);
  list = []; assert.equal(own.frame(DT).disconnected.length, 1);
});

test('E33b — navigator.getGamepads est appelé comme une méthode (sinon « Illegal invocation » dans Chrome)', () => {
  const nav = {getGamepads() { if (this !== nav) throw new TypeError('Illegal invocation'); return [fakePad({press: {A: 1}})]; }};
  const window = {navigator: nav}; vm.runInContext(source, vm.createContext({window}));
  const inp = window.FInput.create(M), f = inp.frame(DT);
  assert.equal(f.connected.length, 1); assert.equal(json(f.pressed), json(['jump'])); assert.equal(f.device, 'gamepad');
  // Without navigator, or without getGamepads (old browsers, Node): no pad, no error.
  for (const w of [{}, {navigator: {}}, {navigator: {getGamepads: 5}}]) {
    vm.runInContext(source, vm.createContext({window: w})); const g = w.FInput.create(M).frame(DT);
    assert.equal(json([g.pads, g.connected, g.pressed]), '[[],[],[]]');
  }
});

test('E34 — Front de bouton : A tenu 10 images → un seul saut', () => {
  const {F, pads} = load();
  const inp = F.create(M);
  pads.list = [fakePad({press: {A: 1}})];
  const jumps = [], fronts = [];
  for (let k = 0; k < 10; k++) { const {f, s} = one(inp); jumps.push(s.jump); fronts.push(...f.pressed); }
  assert.equal(json(jumps), json([true, ...Array(9).fill(false)])); assert.equal(json(fronts), json(['jump']));
  // Released, then pressed again: a new jump. Held: pressed, or a value above .5.
  pads.list = [fakePad()]; assert.equal(one(inp).s.jump, false);
  pads.list = [fakePad({press: {A: .6}})]; let {f, s} = one(inp); assert.equal(json(f.pressed), json(['jump'])); assert.equal(s.jump, true);
  pads.list = [fakePad({press: {A: .4}})]; ({f, s} = one(inp)); assert.equal(json(f.pressed), '[]');
  pads.list = [fakePad({press: {A: .5}})]; ({f, s} = one(inp)); assert.equal(json(f.pressed), '[]', '.5 ne suffit pas'); assert.equal(s.jump, false);
  const tap = fakePad(); tap.buttons[0] = {pressed: true, touched: true, value: 0}; pads.list = [tap]; ({f} = one(inp)); assert.equal(json(f.pressed), json(['jump']));
  // Two buttons on one action (settings): one front while either is down.
  const two = inp.settings; two.pad.weaponNext = []; two.pad.pulse = ['LB', 'Y']; inp.configure(two);
  pads.list = [fakePad({press: {LB: 1}})]; ({f} = one(inp)); assert.equal(json(f.pressed), json(['pulse']));
  pads.list = [fakePad({press: {LB: 1, Y: 1}})]; ({f} = one(inp)); assert.equal(json(f.pressed), '[]', 'déjà tenue');
  pads.list = [fakePad({press: {Y: 1}})]; ({f, s} = one(inp)); assert.equal(json(f.pressed), '[]', 'tenue par Y'); assert.equal(s.pulse, false);
  pads.list = [fakePad()]; one(inp); pads.list = [fakePad({press: {Y: 1}})]; ({f} = one(inp)); assert.equal(json(f.pressed), json(['pulse']));
  pads.list = [fakePad()]; one(inp);
  // Several actions in one frame: their fronts in declaration order, impulses and held actions alike.
  pads.list = [fakePad({press: {LB: 1, RB: 1, L3: 1, RT: 1}})]; ({f, s} = one(inp));
  assert.equal(json(f.pressed), json(['fire', 'leftHand', 'sprint', 'pulse'])); assert.equal(s.sprint, true); assert.equal(s.fire, true);
  // The order of the fronts: keyboard and mouse events as they come, then the pad, read by frame().
  inp.keyDown('KeyR', 0, false); pads.list = [fakePad({press: {X: 1}})]; inp.button('fireLeft', true, 0, 'mouse');
  assert.equal(json(inp.frame(DT).pressed), json(['dash', 'fireLeft', 'interact'])); inp.step(); inp.keyUp('KeyR', 0); inp.button('fireLeft', false, 0, 'mouse');
});

test('E34b — configure à la manette : la table pad des réglages, un bouton tenu qui change d’action la tient sans front', () => {
  const {F, pads} = load();
  const inp = F.create(M);
  pads.list = [fakePad({press: {X: 1}})];
  let {f, s} = one(inp); assert.equal(json(f.pressed), json(['interact']));
  const free = inp.unbind('gamepad', 'interact'), moved = F.assign(M, free.settings, 'gamepad', 'fireLeft', 'X');
  assert.equal(moved.ok, true); inp.configure(moved.settings);
  ({f, s} = one(inp)); assert.equal(json(f.pressed), '[]'); assert.equal(s.fireLeft, true); assert.equal(s.interact, false);
  pads.list = [fakePad({press: {LT: 1}})]; ({f, s} = one(inp)); assert.equal(s.fireLeft, false, 'LT n’est plus affectée'); assert.equal(json(f.pressed), '[]');
  pads.list = [fakePad({press: {X: 1}})]; ({f, s} = one(inp)); assert.equal(json(f.pressed), json(['fireLeft']));
  // Losing its button releases a held action, without any edge elsewhere.
  inp.configure(inp.unbind('gamepad', 'fireLeft').settings);
  ({f, s} = one(inp)); assert.equal(s.fireLeft, false); assert.equal(json(f.pressed), '[]');
  // Initial settings of the declaration: RB fires, RT does nothing.
  const c = F.create({...copyM(), settings: {pad: {fire: ['RB']}}});
  pads.list = [fakePad({press: {RT: 1}})]; assert.equal(one(c).s.fire, false);
  pads.list = [fakePad({press: {RB: 1}})]; assert.equal(one(c).s.fire, true);
});

test('E35 — Appareil actif : bouton ou axe au-delà de .3 → manette ; clavier, tactile, souris', () => {
  const {F, pads} = load();
  const inp = F.create(M);
  pads.list = [fakePad({press: {A: 1}})];
  let f = inp.frame(DT); assert.equal(f.device, 'gamepad'); assert.equal(f.deviceChanged, true); assert.equal(inp.device, 'gamepad');
  pads.list = [fakePad()]; f = inp.frame(DT); assert.equal(f.device, 'gamepad'); assert.equal(f.deviceChanged, false);
  inp.keyDown('KeyL', 900, false); assert.equal(inp.device, 'keyboard');
  pads.list = [fakePad({axes: [.2, 0, 0, 0]})]; f = inp.frame(DT); assert.equal(f.device, 'keyboard', 'axe à .2'); assert.equal(f.deviceChanged, true);
  // Steps 4 to 6 of the mission call stickDown (step 7); any touch event sets the same device and time: a touch button here.
  pads.list = [];
  inp.button('fire', true, 1000, 'touch'); assert.equal(inp.device, 'touch');
  inp.mouseMove(1, 0, 1100); assert.equal(inp.device, 'touch');
  inp.mouseMove(1, 0, 1900); assert.equal(inp.device, 'mouse');
  inp.button('fire', false, 1950, 'touch'); inp.mouseMove(1, 0, 3000);
  // Above .3: an axis of either stick, a trigger value, a button value, or pressed alone; .3 is not enough.
  for (const pad of [fakePad({axes: [0, 0, 0, -.31]}), fakePad({axes: [.31, 0, 0, 0]}), fakePad({press: {RT: .31}}), fakePad({press: {Y: .31}}), Object.assign(fakePad(), {buttons: fakePad().buttons.map((b, j) => j === 16 ? {pressed: true, value: 0} : b)})]) {
    inp.keyDown('KeyL', 0, false); pads.list = [pad]; assert.equal(inp.frame(DT).device, 'gamepad', json(pad.axes) + json(pad.buttons.map(b => b.value)));
  }
  for (const pad of [fakePad({axes: [.3, -.3, .3, -.3]}), fakePad({press: {RT: .3, A: .3}}), Object.assign(fakePad(), {axes: [0, 0, 0, 0, .9, -1]})]) {
    inp.keyDown('KeyL', 0, false); pads.list = [pad]; assert.equal(inp.frame(DT).device, 'keyboard', json(pad.axes));
  }
  // A button kept down takes the device back at each frame: the pad is polled, the keyboard comes in between.
  pads.list = [fakePad({press: {A: 1}})]; inp.frame(DT);
  inp.keyDown('KeyL', 0, false); assert.equal(inp.device, 'keyboard'); f = inp.frame(DT); assert.equal(f.device, 'gamepad'); assert.equal(f.deviceChanged, false);
  pads.list = [];
});

test('E36 — Capture manette et clear() : ni front ni impulsion pour l’appui capturé ; l’image après clear() sans front', () => {
  const {F, pads} = load();
  const inp = F.create(M);
  inp.capture('gamepad');
  pads.list = [fakePad({press: {X: 1}})];
  let {f, s} = one(inp);
  assert.equal(json(f.captured), json({device: 'gamepad', code: 'X'})); assert.equal(json(f.pressed), '[]'); assert.equal(s.interact, false);
  ({f, s} = one(inp)); assert.equal(f.captured, null, 'une seule fois'); assert.equal(json(f.pressed), '[]', 'X tenu : pas de front'); assert.equal(s.interact, false);
  pads.list = [fakePad()]; one(inp); pads.list = [fakePad({press: {X: 1}})];
  ({f, s} = one(inp)); assert.equal(json(f.pressed), json(['interact'])); assert.equal(s.interact, true);
  // RT held, then clear(): the next frame has no 'fire' front, but fire is held.
  pads.list = [fakePad({press: {RT: 1}})]; one(inp); inp.clear();
  ({f, s} = one(inp)); assert.ok(!f.pressed.includes('fire'), json(f.pressed)); assert.equal(s.fire, true);
  ({f, s} = one(inp)); assert.equal(json(f.pressed), '[]'); assert.equal(s.fire, true);
  pads.list = [fakePad()]; assert.equal(one(inp).s.fire, false);
  // clear() releases at once; the frame that follows it gives no pad edge at all, even for a button pressed after clear().
  pads.list = [fakePad({press: {RT: 1}, axes: [0, -1, 0, 0]})]; one(inp); inp.clear();
  assert.ok(idle(inp.step()), 'relâché par clear()');
  pads.list = [fakePad({press: {RT: 1, A: 1}, axes: [0, -1, 0, 0]})]; ({f, s} = one(inp));
  assert.equal(json(f.pressed), '[]'); assert.equal(s.fire, true); assert.equal(s.jump, false); assert.equal(s.sprint, true); assert.equal(s.moveY, 1);
  pads.list = [fakePad({press: {RT: 1, B: 1}})]; ({f, s} = one(inp)); assert.equal(json(f.pressed), json(['dash']), 'image suivante : fronts rendus');
  // Keyboard edges are not touched by the quiet frame.
  inp.clear(); inp.keyDown('KeyE', 0, false); ({f, s} = one(inp)); assert.equal(json(f.pressed), json(['pulse']));
  pads.list = []; one(inp); inp.keyUp('KeyE', 0);
  // A button already down is not captured; Home is never captured; the next new button is (LT by its hysteresis).
  pads.list = [fakePad({press: {Y: 1}})]; one(inp); inp.capture('gamepad');
  pads.list = [fakePad({press: {Y: 1, Home: 1}})]; ({f} = one(inp)); assert.equal(f.captured, null); assert.equal(json(f.pressed), '[]');
  pads.list = [fakePad({press: {Y: 1, Home: 1, LT: .31}, axes: [0, -1, 0, 0]})]; ({f, s} = one(inp));
  assert.equal(json(f.captured), json({device: 'gamepad', code: 'LT'})); assert.equal(json(f.pressed), '[]', 'ni course ni tir tenu'); assert.equal(s.fireLeft, true);
  // Several new buttons in one frame: the first of PAD_BUTTONS.
  pads.list = []; one(inp); inp.capture('gamepad'); pads.list = [fakePad({press: {Start: 1, B: 1, Up: 1}})];
  assert.equal(json(inp.frame(DT).captured), json({device: 'gamepad', code: 'B'})); inp.step();
  // The keyboard plays during a pad capture; capture(null), a new capture and clear() drop it.
  pads.list = []; one(inp); inp.capture('gamepad');
  inp.keyDown('KeyR', 0, false); ({f, s} = one(inp)); assert.equal(json(f.pressed), json(['dash'])); assert.equal(f.captured, null); inp.keyUp('KeyR', 0);
  // After capture(null) or capture('keyboard'), X plays again; after clear(), X is held without its front (quiet frame).
  for (const [name, end, front] of [['capture(null)', () => inp.capture(null), true], ['capture(keyboard)', () => inp.capture('keyboard'), true], ['clear()', () => inp.clear(), false]]) {
    inp.capture('gamepad'); end(); pads.list = [fakePad({press: {X: 1}})]; ({f} = one(inp));
    assert.equal(f.captured, null, name); assert.equal(f.pressed.includes('interact'), front, name); pads.list = []; one(inp); inp.capture(null);
  }
  // The pad is only read by frame(): a second request before it still gets the button.
  inp.capture('gamepad'); pads.list = [fakePad({press: {X: 1}})]; inp.capture('gamepad');
  assert.equal(json(inp.frame(DT).captured), json({device: 'gamepad', code: 'X'}));
});

test('E37 — Échange des sticks : le stick gauche tourne la vue, le droit déplace', () => {
  const {F, pads} = load();
  const inp = withTune(F, {swapSticks: true});
  pads.list = [fakePad({axes: [1, 0, 0, -1]})];
  let s = one(inp).s;
  near(s.lookX, 300 * RAD * DT, 1e-12, 'stick gauche → lacet'); assert.equal(s.lookY, 0); assert.equal(s.moveX, 0); assert.equal(s.moveY, 1); assert.equal(s.sprint, true);
  pads.list = [fakePad({axes: [0, -1, 1, 0]})]; s = one(inp).s;
  near(s.lookY, 190 * RAD * DT, 1e-12, 'stick gauche → tangage'); assert.equal(s.moveX, 1); assert.equal(s.moveY, 0);
  // Each role keeps its dead zone: .14 turns the view (padDead .12) on the left stick, and moves nothing without the swap (moveDead .15).
  pads.list = [fakePad({axes: [.14, 0, 0, 0]})]; assert.ok(one(inp).s.lookX > 0);
  const plain = F.create(M); s = one(plain).s; assert.equal(s.moveX, 0); assert.equal(s.lookX, 0);
  // Back to the default by configure; buttons are not swapped.
  inp.configure(F.defaults(M)); pads.list = [fakePad({axes: [1, 0, 0, -1], press: {A: 1}})]; let f; ({f, s} = one(inp));
  assert.equal(s.moveX, 1); near(s.lookY, 190 * RAD * DT, 1e-12, 'défaut'); assert.equal(json(f.pressed), json(['jump', 'sprint']), 'boutons, puis course au bout du stick');
  // A declaration with its sticks on the other sides, or without a pad on one stick.
  const other = F.create({...copyM(), sticks: {move: {...M.sticks.move, pad: 'RS'}, look: {...M.sticks.look, pad: 'LS'}}});
  pads.list = [fakePad({axes: [1, 0, 0, -1]})]; s = one(other).s; assert.ok(s.lookX > 0); assert.equal(s.moveY, 1);
  const none = F.create({...copyM(), sticks: {move: {...M.sticks.move, pad: undefined}, look: M.sticks.look}});
  s = one(none).s; assert.equal(s.moveX, 0); assert.equal(s.moveY, 0); assert.equal(s.sprint, false); assert.equal(s.lookX, 0); near(s.lookY, 190 * RAD * DT, 1e-12, 'stick droit seul');
});

test('E38 — keyName : mêmes noms que FOptions.keyName', () => {
  const {F, window, ctx} = load();
  vm.runInContext(readFileSync(new URL('../src/options.js', import.meta.url), 'utf8'), ctx);
  for (const code of ['KeyW', 'Digit1', 'Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Backspace', 'Tab', 'ControlLeft', 'KeyM'])
    assert.equal(F.keyName(code), window.FOptions.keyName(code), code);
  // own names only: a property of Object.prototype is not a key name
  assert.equal(F.keyName('toString'), 'toString'); assert.equal(F.keyName('constructor'), 'constructor');
});

// ——— Step 5: prompts and rumble — keyLabel, setLayout, label, glyph, guessDevice, rumble ———
// The glyph table of the mission (§4.8), in the order of PAD_BUTTONS.
const GLYPH_SPEC = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Vue', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→', 'Xbox'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS'],
  generic: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', '↑', '↓', '←', '→', 'Home']
};
// French AZERTY: event.key (unshifted) of the Key… codes whose letter differs from QWERTY.
const AZERTY = {KeyQ: 'a', KeyW: 'z', KeyA: 'q', KeyZ: 'w', KeyM: ','};

test('E39 — Libellés appris : la touche vue par keyDown (AZERTY), la table de setLayout, sinon keyName ; les chiffres gardent leur nom', () => {
  const {F} = load();
  const inp = F.create(M);
  inp.keyDown('KeyW', 0, false, 'z'); assert.equal(inp.keyLabel('KeyW'), 'Z');
  inp.keyDown('Digit1', 0, false, '&'); assert.equal(inp.keyLabel('Digit1'), '1');
  inp.setLayout(new Map([['KeyQ', 'a'], ['KeyM', ',']]));
  assert.equal(inp.keyLabel('KeyQ'), 'A'); assert.equal(inp.keyLabel('KeyM'), ',');
  assert.equal(inp.label('jump', 'keyboard'), 'Espace'); assert.equal(inp.label('dash', 'keyboard'), 'R');
});

test('E39b — Libellés : un caractère visible, codes Key… seulement, appris avant la table, invite clavier jointe par « / » ou « — »', () => {
  const {F} = load();
  const fresh = () => F.create(M);
  // No key seen and no layout: keyName, i.e. the QWERTY names.
  let inp = fresh();
  assert.equal(json(['KeyW', 'KeyQ', 'KeyM', 'Space', 'ShiftLeft', 'ArrowUp', 'Digit5', 'Enter'].map(c => inp.keyLabel(c))), json(['W', 'Q', 'M', 'Espace', 'Maj G', '↑', '5', 'Entrée']));
  assert.equal(inp.label('forward', 'keyboard'), 'W / Z / ↑'); assert.equal(inp.label('sprint', 'keyboard'), 'Maj G / Maj D'); assert.equal(inp.label('map', 'keyboard'), 'M');
  // An AZERTY session: each key teaches its label when the player presses it, bound or not.
  for (const [code, key] of Object.entries(AZERTY)) inp.keyDown(code, 0, false, key);
  assert.equal(inp.label('forward', 'keyboard'), 'Z / W / ↑'); assert.equal(inp.label('left', 'keyboard'), 'Q / A'); assert.equal(inp.label('map', 'keyboard'), ',');
  // One visible character only: no space, no named key value, nothing empty, no control or format character.
  for (const key of [' ', 'Dead', 'Unidentified', '', 'ab', '\u0000', '\t', '\u00a0', '\u200b', '\ue000', undefined, null, 5, ['e']]) {
    inp = fresh(); inp.keyDown('KeyE', 0, false, key); assert.equal(inp.keyLabel('KeyE'), 'E', 'key ' + json(String(key)));
  }
  // Upper case; one code point, not one UTF-16 unit.
  for (const [key, want] of [['é', 'É'], ['e', 'E'], ['E', 'E'], ['ö', 'Ö'], [',', ','], ['😀', '😀']]) { inp = fresh(); inp.keyDown('KeyE', 0, false, key); assert.equal(inp.keyLabel('KeyE'), want, key); }
  // Key… codes only: digits keep their names (Digit2 is é on AZERTY), other codes too.
  inp = fresh(); inp.keyDown('Digit2', 0, false, 'é'); inp.keyDown('Semicolon', 0, false, 'm'); inp.keyDown('Space', 0, false, 'x');
  assert.equal(json(['Digit2', 'Semicolon', 'Space'].map(c => inp.keyLabel(c))), json(['2', 'Semicolon', 'Espace']));
  // The last key seen wins; what was learnt goes before the layout; learnt on a repeat, and during a capture.
  inp = fresh(); inp.keyDown('KeyW', 0, false, 'z'); inp.keyUp('KeyW', 0); inp.keyDown('KeyW', 0, false, 'w'); assert.equal(inp.keyLabel('KeyW'), 'W');
  inp.setLayout({KeyW: 'z', KeyY: 'z'}); assert.equal(inp.keyLabel('KeyW'), 'W', 'appris d’abord'); assert.equal(inp.keyLabel('KeyY'), 'Z', 'table en objet');
  assert.equal(inp.keyDown('KeyY', 0, true, 'y'), false); assert.equal(inp.keyLabel('KeyY'), 'Y', 'répétition, touche non affectée');
  inp.capture('keyboard'); assert.equal(inp.keyDown('KeyM', 0, false, ','), true); assert.equal(inp.keyLabel('KeyM'), ',', 'capture');
  assert.equal(json(inp.frame(DT).captured), json({device: 'keyboard', code: 'KeyM'}));
  // Layout: map.get(code) when get is a function (KeyboardLayoutMap, Map), called as a method; else map[code].
  // One character is upper-cased, several are kept; anything else, and Digit codes, → keyName.
  inp = fresh(); inp.setLayout(new Map([['KeyA', 'q'], ['KeyB', 'ab'], ['KeyC', ''], ['KeyD', 5], ['Digit1', '&']]));
  assert.equal(json(['KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'Digit1'].map(c => inp.keyLabel(c))), json(['Q', 'ab', 'C', 'D', 'E', '1']));
  const seen = [], layout = {get(code) { seen.push(this === layout); return code === 'KeyQ' ? 'a' : undefined; }};
  inp.setLayout(layout); assert.equal(inp.keyLabel('KeyQ'), 'A'); assert.equal(inp.keyLabel('KeyW'), 'W'); assert.equal(json(seen), '[true,true]');
  // Only a non-array object is a table: a function with get() or an array with a KeyQ property clears it too.
  for (const off of [null, undefined, 5, 'azerty', () => 'a', Object.assign(() => 'a', {get: () => 'a'}), Object.assign(['a'], {KeyQ: 'a'})]) { inp.setLayout(off); assert.equal(inp.keyLabel('KeyQ'), 'Q', String(off)); }
  // Labels belong to the instance; FInput.keyName does not change.
  assert.equal(fresh().keyLabel('KeyW'), 'W'); assert.equal(F.keyName('KeyW'), 'W');
  // Keyboard prompt: the keys of the settings, through keyLabel, joined by ' / '; none → '—'.
  inp = fresh(); assert.equal(inp.label('weaponNext', 'keyboard'), '—');
  inp.configure(inp.unbind('keyboard', 'jump').settings); assert.equal(inp.label('jump', 'keyboard'), '—');
  inp.configure(inp.assign('keyboard', 'jump', 'KeyJ').settings); assert.equal(inp.label('jump', 'keyboard'), 'J');
  inp.keyDown('KeyJ', 0, false, 'j'); assert.equal(inp.label('jump', 'keyboard'), 'J');
  // keyDown still returns whether the code is bound.
  assert.equal(fresh().keyDown('KeyL', 0, false, 'l'), false); assert.equal(fresh().keyDown('KeyW', 0, false, 'z'), true);
});

test('E40 — Glyphes : Xbox, PlayStation, générique ; invites tactile et souris, action non affectée, action inconnue', () => {
  const {F, pads} = load();
  assert.equal(F.padStyle(PAD_IDS.xbox), 'xbox'); assert.equal(F.padStyle(PAD_IDS.ps), 'ps'); assert.equal(F.padStyle(PAD_IDS.other), 'generic');
  const inp = F.create(M);
  pads.list = [fakePad({press: {A: 1}})]; one(inp);
  assert.equal(inp.label('jump', 'gamepad'), 'A');
  pads.list = [fakePad({id: PAD_IDS.ps, press: {A: 1}})]; one(inp);
  assert.equal(inp.label('jump', 'gamepad'), '✕'); assert.equal(inp.label('dash', 'gamepad'), '○');
  assert.equal(inp.label('fire', 'touch'), 'TIR'); assert.equal(inp.label('fire', 'mouse'), 'Clic');
  assert.equal(inp.label('weapon5', 'gamepad'), '—'); assert.equal(inp.label('inconnu'), '?');
});

test('E40b — glyph et dernière manette active : tables complètes, nom ou style inconnus, index le plus bas, remise à null au débranchement', () => {
  const {F, pads} = load();
  for (const [style, want] of Object.entries(GLYPH_SPEC)) assert.equal(json(PAD_SPEC.map(n => F.glyph(n, style))), json(want), style);
  // An unknown name gives the name itself; an unknown style gives the generic glyphs.
  for (const style of ['xbox', 'ps', 'generic', 'steam', undefined, '__proto__', 'toString']) for (const n of ['Z9', 'toString', 'constructor', 'name', 'ArrowUp', 'up', '']) assert.equal(F.glyph(n, style), n, style + ' : ' + n);
  for (const style of ['steam', undefined, null, 'toString', '__proto__', 'XBOX']) assert.equal(json(PAD_SPEC.map(n => F.glyph(n, style))), json(GLYPH_SPEC.generic), String(style));
  // No pad, then a pad never used: generic glyphs.
  const inp = F.create(M);
  assert.equal(inp.label('map', 'gamepad'), 'Back');
  pads.list = [fakePad({id: PAD_IDS.ps})]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Back', 'branchée, jamais active');
  // The style of the last active pad: the active pad of lowest index in the frame, kept while it stays connected.
  const xbox = (press = {}, axes) => fakePad({index: 0, press, axes}), ps = (press = {}, axes) => fakePad({index: 1, id: PAD_IDS.ps, press, axes});
  pads.list = [xbox(), ps({A: 1})]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Create');
  pads.list = [xbox(), ps()]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Create', 'gardée sans activité');
  pads.list = [xbox({B: 1}), ps({B: 1})]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Vue', 'deux actives : index 0');
  pads.list = [ps(), xbox()]; one(inp); pads.list = [ps({X: 1}), xbox({X: 1})]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Vue', 'par index, pas par place');
  pads.list = [xbox(), ps({}, [0, 0, .31, 0])]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Create', 'un axe au-delà de .3');
  pads.list = [xbox(), ps({}, [0, 0, .3, 0])]; one(inp); pads.list = [xbox({}, [.3, 0, 0, 0]), ps()]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Create', '.3 ne suffit pas');
  // Unplugged: back to null, so generic, until a pad is used again (the other one is still connected).
  pads.list = [xbox()]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Back', 'débranchée');
  pads.list = [xbox(), ps()]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Back', 'rebranchée sans appui');
  pads.list = [xbox({Y: 1}), ps()]; one(inp); assert.equal(inp.label('map', 'gamepad'), 'Vue');
  // Buttons of the settings, joined like keys.
  const s = inp.settings; s.pad.weaponNext = []; s.pad.pulse = ['LB', 'Y']; inp.configure(s);
  assert.equal(inp.label('pulse', 'gamepad'), 'LB / Y'); assert.equal(inp.label('weaponNext', 'gamepad'), '—');
  pads.list = [ps({A: 1})]; one(inp); assert.equal(inp.label('pulse', 'gamepad'), 'L1 / △'); assert.equal(inp.label('sprint', 'gamepad'), 'L3'); assert.equal(inp.label('melee', 'gamepad'), 'R3');
  // Touch: its own label, else the action label. Mouse: its own label, else the keyboard prompt.
  assert.equal(inp.label('interact', 'touch'), 'Interagir'); assert.equal(inp.label('jump', 'touch'), 'SAUT'); assert.equal(inp.label('fireLeft', 'touch'), 'TIR G');
  assert.equal(inp.label('weaponNext', 'mouse'), 'Molette'); assert.equal(inp.label('fireLeft', 'mouse'), 'Clic droit'); assert.equal(inp.label('jump', 'mouse'), 'Espace');
  // Default device: the active one (TACT-08).
  const d = F.create(M); pads.list = [];
  assert.equal(d.label('jump'), 'Espace', 'appareil de la déclaration');
  pads.list = [ps({A: 1})]; d.frame(DT); assert.equal(d.label('jump'), '✕');
  d.button('fire', true, 1000, 'touch'); assert.equal(d.label('jump'), 'SAUT'); d.button('fire', false, 1000, 'touch');
  d.mouseMove(1, 0, 1900); assert.equal(d.label('fire'), 'Clic'); assert.equal(d.label('jump'), 'Espace');
  d.keyDown('KeyL', 2000, false, 'l'); assert.equal(d.label('fire'), 'Entrée');
  // Any other device: the keyboard prompt. An unknown action: '?' on every device (own ids only).
  for (const dev of ['pilot', null, 5]) assert.equal(d.label('jump', dev), 'Espace', String(dev));
  for (const dev of ['keyboard', 'mouse', 'touch', 'gamepad', undefined]) for (const id of ['inconnu', 'toString', 'constructor', '', undefined]) assert.equal(d.label(id, dev), '?', dev + ' : ' + id);
});

test('E41 — guessDevice : règle de BITUME (TACT-08), matchMedia appelé comme une méthode, toute erreur → keyboard', () => {
  const {F} = load();
  assert.equal(F.guessDevice({matchMedia: q => ({matches: q === '(pointer: coarse)'})}), 'touch');
  assert.equal(F.guessDevice({matchMedia: q => ({matches: q === '(hover: none)'}), navigator: {maxTouchPoints: 5}}), 'touch');
  assert.equal(F.guessDevice({matchMedia: () => ({matches: false}), navigator: {maxTouchPoints: 10}}), 'keyboard');
  assert.equal(F.guessDevice({matchMedia: q => ({matches: q === '(hover: none)'}), navigator: {maxTouchPoints: 1}}), 'touch', 'un seul point de contact');
  // hover: none counts only with a touch point; exactly these two queries, in this order.
  assert.equal(F.guessDevice({matchMedia: q => ({matches: q === '(hover: none)'}), navigator: {maxTouchPoints: 0}}), 'keyboard');
  assert.equal(F.guessDevice({matchMedia: q => ({matches: q === '(hover: none)'})}), 'keyboard', 'sans navigator');
  const asked = []; F.guessDevice({matchMedia: q => { asked.push(q); return {matches: false}; }, navigator: {maxTouchPoints: 2}});
  assert.equal(json(asked), json(['(pointer: coarse)', '(hover: none)']));
  // A method of the window: detached, it throws « Illegal invocation » in browsers.
  const win = {matchMedia(q) { if (this !== win) throw new TypeError('Illegal invocation'); return {matches: q === '(pointer: coarse)'}; }};
  assert.equal(F.guessDevice(win), 'touch');
  // Any error → 'keyboard', never an exception.
  for (const bad of [null, 5, 'x', {}, {matchMedia: 5}, {matchMedia: () => null}, {matchMedia: () => { throw new Error('test'); }}, {matchMedia: () => ({matches: false}), get navigator() { throw new Error('test'); }}])
    assert.equal(F.guessDevice(bad), 'keyboard', json(String(bad)));
  // Default: the global object of the module (the window of load(), without matchMedia; then a window with one).
  assert.equal(F.guessDevice(), 'keyboard');
  const window = {matchMedia: q => ({matches: q === '(pointer: coarse)'}), navigator: {maxTouchPoints: 0}}; vm.runInContext(source, vm.createContext({window}));
  assert.equal(window.FInput.guessDevice(), 'touch');
});

test('E42 — Vibrations : appel exact, limiteur de 40 ms, intensité .5, sans actionneur, exception, aucun rejet non traité', async () => {
  const {F, pads} = load();
  const act = fakeActuator(), inp = F.create(M);
  pads.list = [fakePad({actuator: act})]; inp.frame(DT);
  assert.equal(inp.rumble(.55, .35, 140, 1000), true);
  assert.equal(json(act.calls), json([{type: 'dual-rumble', startDelay: 0, duration: 140, weakMagnitude: .35, strongMagnitude: .55}]));
  assert.equal(inp.rumble(.55, .35, 140, 1020), false); assert.equal(inp.rumble(.55, .35, 140, 1041), true); assert.equal(act.calls.length, 2);
  const tuned = v => { const c = withTune(F, {padVibration: v}); c.frame(DT); return c; };
  assert.equal(tuned(0).rumble(.55, .35, 140, 1000), false); assert.equal(act.calls.length, 2, 'aucun appel à 0');
  assert.equal(tuned(.5).rumble(.55, .35, 140, 1000), true);
  const half = act.calls[2]; assert.equal(half.strongMagnitude, .275); assert.equal(half.weakMagnitude, .175);
  pads.list = [fakePad()]; assert.equal(tuned(1).rumble(.55, .35, 140, 1000), false, 'sans actionneur');
  const thrower = fakeActuator('throw'); pads.list = [fakePad({actuator: thrower})];
  let r; assert.doesNotThrow(() => { r = tuned(1).rumble(.55, .35, 140, 1000); }); assert.equal(r, false); assert.equal(thrower.calls.length, 1);
  // A rejected promise gets an empty catch: no unhandled rejection after one turn.
  let unhandled = 0; const count = () => { unhandled++; }; process.on('unhandledRejection', count);
  try {
    const rejecting = fakeActuator('reject'); pads.list = [fakePad({actuator: rejecting})];
    assert.equal(tuned(1).rumble(.55, .35, 140, 1000), true); assert.equal(rejecting.calls.length, 1);
    await new Promise(done => setTimeout(done, 0));
    assert.equal(unhandled, 0, 'rejet non traité');
  } finally { process.off('unhandledRejection', count); }
  pads.list = [];
});

test('E42b — rumble : bornes, manette visée, limiteur mis à jour au seul succès, rien avant frame()', () => {
  const {F, pads} = load();
  const act = fakeActuator(), inp = F.create(M), last = () => act.calls[act.calls.length - 1];
  assert.equal(inp.rumble(.5, .5, 100, 0), false, 'aucune manette vue par frame()');
  pads.list = [fakePad({actuator: act})]; inp.frame(DT);
  // ms bounded to [0 ; 5000], intensities to [0 ; 1] then × padVibration; anything else counts for 0.
  let t = 0; const at = (...a) => { t += 100; assert.equal(inp.rumble(...a, t), true, json(a)); return last(); };
  assert.equal(json(at(2, -1, 9000)), json({type: 'dual-rumble', startDelay: 0, duration: 5000, weakMagnitude: 0, strongMagnitude: 1}));
  assert.equal(json(at(-1, 2, -5)), json({type: 'dual-rumble', startDelay: 0, duration: 0, weakMagnitude: 1, strongMagnitude: 0}));
  assert.equal(json(at(NaN, undefined, NaN)), json({type: 'dual-rumble', startDelay: 0, duration: 0, weakMagnitude: 0, strongMagnitude: 0}));
  assert.equal(json(at(Infinity, -Infinity, Infinity)), json({type: 'dual-rumble', startDelay: 0, duration: 5000, weakMagnitude: 0, strongMagnitude: 1}));
  for (const v of Object.values(at(-0, -0, -0))) assert.ok(!Object.is(v, -0));
  // The gap is 40 ms exactly: refused at 39.9, accepted at 40.
  assert.equal(inp.rumble(.5, .5, 50, t + 39.9), false); assert.equal(inp.rumble(.5, .5, 50, t + 40), true); t += 40;
  // padVibration is read at each call, after configure.
  const s = inp.settings; s.tune.padVibration = .25; inp.configure(s); t += 100; inp.rumble(1, .8, 50, t); assert.equal(last().strongMagnitude, .25); assert.equal(last().weakMagnitude, .2);
  s.tune.padVibration = 0; inp.configure(s); const n = act.calls.length; assert.equal(inp.rumble(1, 1, 50, t + 500), false); assert.equal(act.calls.length, n);
  // Target: the last active pad, else the first connected one.
  const a0 = fakeActuator(), a1 = fakeActuator(), two = F.create(M);
  pads.list = [fakePad({index: 0, actuator: a0}), fakePad({index: 1, id: PAD_IDS.ps, actuator: a1})]; two.frame(DT);
  assert.equal(two.rumble(.5, .5, 50, 0), true); assert.equal(json([a0.calls.length, a1.calls.length]), '[1,0]', 'première branchée');
  pads.list = [fakePad({index: 0, actuator: a0}), fakePad({index: 1, id: PAD_IDS.ps, actuator: a1, press: {A: 1}})]; two.frame(DT);
  assert.equal(two.rumble(.5, .5, 50, 100), true); assert.equal(json([a0.calls.length, a1.calls.length]), '[1,1]', 'dernière active');
  pads.list = [fakePad({index: 0, actuator: a0}), fakePad({index: 1, id: PAD_IDS.ps, actuator: a1})]; two.frame(DT);
  assert.equal(two.rumble(.5, .5, 50, 200), true); assert.equal(json([a0.calls.length, a1.calls.length]), '[1,2]', 'gardée sans activité');
  pads.list = [fakePad({index: 0, actuator: a0})]; two.frame(DT);
  assert.equal(two.rumble(.5, .5, 50, 300), true); assert.equal(json([a0.calls.length, a1.calls.length]), '[2,2]', 'débranchée : première branchée');
  // The pad object of the last frame; nothing after it is unplugged.
  const a2 = fakeActuator(); pads.list = [fakePad({index: 0, actuator: a2})]; two.frame(DT);
  assert.equal(two.rumble(.5, .5, 50, 400), true); assert.equal(json([a0.calls.length, a2.calls.length]), '[2,1]');
  pads.list = []; two.frame(DT); assert.equal(two.rumble(.5, .5, 50, 500), false);
  // A refusal (no actuator, playEffect missing or throwing) does not move the time of the last success.
  const c = F.create(M), ok = fakeActuator();
  for (const pad of [fakePad(), {...fakePad(), vibrationActuator: {}}, fakePad({actuator: fakeActuator('throw')})]) {
    pads.list = [pad]; c.frame(DT); assert.equal(c.rumble(.5, .5, 50, 1000), false);
  }
  pads.list = [fakePad({actuator: ok})]; c.frame(DT); assert.equal(c.rumble(.5, .5, 50, 1001), true); assert.equal(ok.calls.length, 1);
  // The limiter belongs to the instance.
  const other = F.create(M); other.frame(DT); assert.equal(other.rumble(.5, .5, 50, 1002), true); assert.equal(ok.calls.length, 2);
  pads.list = [];
});

// Transfer from EMPRISE's suspend/stop contract: clearing input also ends its haptics.
test('FInput.clear arrête les vibrations lancées, même après déconnexion, sans reset répété', () => {
  const {F,pads}=load(), calls=[];
  const actuator={playEffect(type,options){calls.push({type,options});},reset(){calls.push({reset:true});}};
  const input=F.create(M);pads.list=[fakePad({actuator})];input.frame(1/60);
  input.clear();assert.equal(calls.length,0,'aucun effet lancé, aucun reset');
  assert.equal(input.rumble(.7,.4,5000,1000),true);pads.list=[];input.frame(1/60);
  input.clear();assert.equal(calls.length,2);assert.equal(calls[1].reset,true);
  input.clear();assert.equal(calls.length,2,'clear est idempotent côté actionneur');
});
test('FInput.clear utilise un effet nul quand reset est absent', () => {
  const {F,pads}=load(), calls=[];
  const actuator={playEffect(type,options){calls.push({type,...options});}};
  const input=F.create(M);pads.list=[fakePad({actuator})];input.frame(1/60);
  input.rumble(.7,.4,5000,1000);input.clear();
  assert.equal(calls.length,2);assert.equal(json(calls[1]),json({type:'dual-rumble',startDelay:0,duration:1,weakMagnitude:0,strongMagnitude:0}));
});
test('FInput.clear annule chaque actionneur utilisé et tolère refus asynchrones ou exceptions', async () => {
  const {F,pads}=load(), resets=[];
  const a={playEffect(){},reset(){resets.push('a');return Promise.reject(new Error('débranchée'));}};
  const b={playEffect(){},reset(){resets.push('b');throw new Error('indisponible');}};
  const input=F.create(M);pads.list=[fakePad({actuator:a})];input.frame(1/60);input.rumble(.4,.4,5000,1000);
  pads.list=[fakePad({index:1,actuator:b})];input.frame(1/60);input.rumble(.4,.4,5000,1100);
  assert.doesNotThrow(()=>input.clear());await new Promise(resolve=>setImmediate(resolve));
  assert.equal(json(resets),json(['a','b']));input.clear();assert.equal(resets.length,2);
});
