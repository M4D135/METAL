// Module entrées, étape 3 : réponses des réglages avant et après, dans le domaine principal de Node (pas de node:vm).
// Charge src/input.js de chaque racine avec la table METAL de la fixture, et relève ce que rendent assign, unbind,
// normalize (migration v1, replis alt, table pad, idempotence) et la capture clavier.
//   node docs/chantier-moteur/preuves/module-entrees/t3/reglages.mjs <racine avant> <racine après>
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
const roots = process.argv.slice(2, 4).map(r => resolve(r));
// A root is named by its commit, plus « arbre de travail » when src/input.js has uncommitted changes.
const label = root => { const git = (...a) => spawnSync('git', ['-C', root, ...a], {encoding: 'utf8'}).stdout.trim(); return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--', 'src/input.js') ? ' + arbre de travail' : ''); };
if (roots.length !== 2) { console.error('usage : node reglages.mjs <racine avant> <racine après>'); process.exit(2); }
const {METAL_INPUT: M, V1_KEYS} = await import(new URL('checks/finput-fixture.mjs', 'file://' + roots[1] + '/').href);
const safe = f => { try { const v = f(); return v === undefined ? 'undefined' : v; } catch (e) { return 'erreur : ' + e.message; } };
function answers(root) {
  const source = readFileSync(root + '/src/input.js', 'utf8'), w = {navigator: {getGamepads: () => []}};
  new Function('window', source)(w);
  const F = w.FInput, D = F.defaults(M), N = raw => F.normalize(raw, M);
  const without = (edit) => { const k = JSON.parse(JSON.stringify(D.keys)); edit(k); return {v: 2, keys: k}; };
  let calls = 0; const counted = {...M, migrate: (raw, from) => { calls++; return M.migrate(raw, from); }};
  const cases = [undefined, null, 42, 'x', [], {}, {keys: {forward: 'KeyW'}}, {keys: {forward: ['KeyW'], back: ['KeyW']}}, {pad: {jump: ['Home']}}, {tune: {padYaw: 9999}}, D,
    {v: 2, keys: {fire: ['KeyG'], jump: ['KeyJ'], weapon5: []}, pad: {fire: ['RB'], leftHand: ['RT']}}, {keys: {forward: ['KeyI', 'KeyW'], interact: ['KeyV']}, pad: {jump: ['B']}}];
  return {
    octets: Buffer.byteLength(source), gzip9: gzipSync(source, {level: 9}).length,
    'E15 assign clavier interact ← R': safe(() => F.assign(M, D, 'keyboard', 'interact', 'KeyR')),
    'E16 assign clavier interact ← G': safe(() => F.assign(M, D, 'keyboard', 'interact', 'KeyG')?.settings?.keys?.interact),
    'E17 assign clavier fire ← Escape': safe(() => F.assign(M, D, 'keyboard', 'fire', 'Escape')),
    'E18 assign manette jump ← X': safe(() => F.assign(M, D, 'gamepad', 'jump', 'X')),
    'E18 assign manette jump ← Home': safe(() => F.assign(M, D, 'gamepad', 'jump', 'Home')?.reason),
    'E18 assign manette jump ← Z9': safe(() => F.assign(M, D, 'gamepad', 'jump', 'Z9')?.reason),
    'E18 unbind weaponNext puis assign weapon5 ← Y': safe(() => F.assign(M, F.unbind(M, D, 'gamepad', 'weaponNext').settings, 'gamepad', 'weapon5', 'Y')?.settings?.pad?.weapon5),
    'E19 cas idempotents et stables en JSON (sur 13)': safe(() => cases.filter(x => { const n = N(x), j = JSON.stringify(n); return JSON.stringify(N(n)) === j && JSON.stringify(N(JSON.parse(j))) === j; }).length),
    'E19 table pad stockée {fire:[RB]} → pad.fire': safe(() => N({pad: {fire: ['RB']}}).pad.fire),
    'E20 padYaw 9999 → ': safe(() => N({tune: {padYaw: 9999}}).tune.padYaw),
    'E21 melee absente, V pris → melee': safe(() => N(without(k => { delete k.melee; k.interact = ['KeyV']; })).keys.melee),
    'E21 weapon5 absente, Digit5 pris → weapon5': safe(() => N(without(k => { delete k.weapon5; k.interact = ['Digit5']; k.fire = ['KeyH']; })).keys.weapon5),
    'E22 profil v1 → dash, jump': safe(() => { const k = N({v: 1, keys: V1_KEYS}).keys; return {dash: k.dash, jump: k.jump}; }),
    'E22 profil v1 = defaults(M)': safe(() => JSON.stringify(N({v: 1, keys: V1_KEYS})) === JSON.stringify(D)),
    'E22 appels de migrate pour un profil v2 / v1': safe(() => { calls = 0; F.normalize({v: 2, keys: V1_KEYS}, counted); const a = calls; F.normalize({v: 1, keys: V1_KEYS}, counted); return [a, calls - a]; }),
    'E23 capture puis KeyG → frame().captured': safe(() => { const inp = F.create(M); inp.capture('keyboard'); const held = inp.keyDown('KeyG', 0, false); return {keyDown: held, captured: inp.frame(1 / 60).captured}; }),
  };
}
const [avant, apres] = roots.map(answers), rows = Object.keys(apres).map(k => ({mesure: k, avant: avant[k], apres: apres[k]}));
console.log(JSON.stringify({tool: 'reglages.mjs', node: process.version, arch: process.arch, avant: label(roots[0]), apres: label(roots[1]), rows}, null, 1));
