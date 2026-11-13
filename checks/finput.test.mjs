// FInput (src/input.js), the engine input layer: cases E01 to E50 listed in docs/chantier-moteur/modules/entrees.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {METAL_INPUT as M} from './finput-fixture.mjs';
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

test('E38 — keyName : mêmes noms que FOptions.keyName', () => {
  const {F, window, ctx} = load();
  vm.runInContext(readFileSync(new URL('../src/options.js', import.meta.url), 'utf8'), ctx);
  for (const code of ['KeyW', 'Digit1', 'Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Backspace', 'Tab', 'ControlLeft', 'KeyM'])
    assert.equal(F.keyName(code), window.FOptions.keyName(code), code);
  // own names only: a property of Object.prototype is not a key name
  assert.equal(F.keyName('toString'), 'toString'); assert.equal(F.keyName('constructor'), 'constructor');
});
