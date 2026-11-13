// Module entrées, étape 5 : les invites des 23 actions de METAL, avant et après. « Avant », c'est ce qu'affiche le jeu
// aujourd'hui : FOptions.keyName(première touche), en noms QWERTY, quels que soient le clavier et l'appareil.
// « Après », c'est inp.label(id, appareil) du module, sans rien brancher dans le jeu :
//   - clavier QWERTY : aucune touche encore vue ;
//   - clavier AZERTY : chaque touche lettre a été appuyée une fois, avec le key qu'un clavier AZERTY français envoie ;
//   - souris, tactile ;
//   - manette Xbox, PlayStation, générique : le style vient de la dernière manette active.
// Le module et src/options.js sont chargés dans le domaine principal de Node (new Function, pas node:vm).
//   node docs/chantier-moteur/preuves/module-entrees/t5/invites.mjs [racine]
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root = process.argv[2] || new URL('../../../../../', import.meta.url).pathname;
const {METAL_INPUT: M, fakePad, PAD_IDS} = await import('file://' + root + '/checks/finput-fixture.mjs');
const pads = {list: []}, w = {navigator: {getGamepads: () => pads.list}};
new Function('window', readFileSync(root + '/src/input.js', 'utf8') + '\n' + readFileSync(root + '/src/options.js', 'utf8'))(w);
const {FInput: F, FOptions: O} = w;
// key sent by a French AZERTY keyboard for each letter code (the others send their own letter)
const AZERTY = {KeyQ: 'a', KeyW: 'z', KeyA: 'q', KeyZ: 'w', KeyM: ','};
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => 'Key' + c);
const qwerty = F.create(M), azerty = F.create(M);
for (const c of letters) { azerty.keyDown(c, 0, false, AZERTY[c] ?? c.slice(3).toLowerCase()); azerty.keyUp(c); }
for (const d of '1234567890') { azerty.keyDown('Digit' + d, 0, false, '&é"\'(-è_çà'['1234567890'.indexOf(d)]); azerty.keyUp('Digit' + d); }
const padded = style => { const inp = F.create(M); pads.list = [fakePad({id: {xbox: PAD_IDS.xbox, ps: PAD_IDS.ps, generic: PAD_IDS.other}[style], press: {A: 1}})]; inp.frame(1 / 60); pads.list = []; return inp; };
const xbox = padded('xbox'), ps = padded('ps'), generic = padded('generic');
const rows = M.actions.map(a => ({
  id: a.id,
  avant: a.keys.length ? O.keyName(a.keys[0]) : '(aucune touche)',
  clavierQwerty: qwerty.label(a.id, 'keyboard'), clavierAzerty: azerty.label(a.id, 'keyboard'),
  souris: qwerty.label(a.id, 'mouse'), tactile: qwerty.label(a.id, 'touch'),
  xbox: xbox.label(a.id, 'gamepad'), playstation: ps.label(a.id, 'gamepad'), generique: generic.label(a.id, 'gamepad')
}));
const codes = ['KeyW', 'Digit1', 'Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Backspace', 'Tab', 'ControlLeft', 'KeyM'];
const git = (...a) => spawnSync('git', ['-C', root, ...a], {encoding: 'utf8'}).stdout.trim();
const out = {
  tool: 'invites.mjs', node: process.version, module: git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--', 'src/input.js') ? ' + arbre de travail' : ''),
  keyNameIdentique: codes.every(c => F.keyName(c) === O.keyName(c)), codesCompares: codes.length,
  changeesAuClavierAzerty: rows.filter(r => r.clavierAzerty !== r.clavierQwerty).map(r => r.id + ' : ' + r.clavierQwerty + ' → ' + r.clavierAzerty),
  invites: rows
};
console.log(JSON.stringify(out, null, 1));
