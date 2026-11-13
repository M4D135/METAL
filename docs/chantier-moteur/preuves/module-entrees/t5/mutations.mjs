// Module entrées, étape 5 : contre-épreuve des tests des invites et des vibrations. Chaque mutation du code de l'étape 5
// dans src/input.js doit faire échouer node --test checks/finput.test.mjs, et le module intact doit tout passer.
// Le code visé : glyphes, guessDevice, libellés appris et table de setLayout, label, dernière manette active, rumble.
// Les trois mutations des étapes 3 et 4 dont l'ancre a bougé au resserrement sont rejouées ici avec leur nouvelle ancre :
// t3/mutations.mjs (capture : appareil actif inchangé), t3/mutations-etape2.mjs (keyDown sans appareil clavier),
// t4/mutations.mjs (activité : appareil jamais manette). Le dépôt n'est jamais modifié : tout est copié dans <dossier>.
//   node docs/chantier-moteur/preuves/module-entrees/t5/mutations.mjs <dossier de travail, hors du dépôt> [racine]
import {readFileSync, writeFileSync, mkdirSync, cpSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const work = process.argv[2], repo = process.argv[3] || new URL('../../../../../', import.meta.url).pathname;
if (!work) { console.error('usage : node mutations.mjs <dossier de travail, hors du dépôt> [racine]'); process.exit(2); }
const src = readFileSync(repo + '/src/input.js', 'utf8');
mkdirSync(work + '/src', {recursive: true}); mkdirSync(work + '/checks', {recursive: true});
for (const f of ['finput.test.mjs', 'finput-fixture.mjs']) cpSync(repo + '/checks/' + f, work + '/checks/' + f);
cpSync(repo + '/src/options.js', work + '/src/options.js');
const LEARN = "if(letter(code)&&typeof key==='string'&&/^[^\\s\\p{C}]$/u.test(key))learnt.set(code,key.toUpperCase());";
const KD = "if(cap==='keyboard'){if(!repeat&&typeof code==='string'){got={device:'keyboard',code};cap=null;}return true;}";
const LOOK = "if(learnt.has(code))return learnt.get(code);", LAY = "const v=lay&&(typeof lay.get==='function'?lay.get(code):lay[code]);if(typeof v==='string'&&v)return [...v].length>1?v:v.toUpperCase();";
const MAG = 'weakMagnitude:clamp(weak,1)*v,strongMagnitude:clamp(strong,1)*v';
const TRY = "try{const r=(gp.get(lp)||gp.values().next().value).vibrationActuator.playEffect('dual-rumble',{startDelay:0,duration:clamp(ms,5000)," + MAG + "});if(typeof r?.catch==='function')r.catch(()=>{});}catch(e){return false;}";
const NOTRY = "const r=(gp.get(lp)||gp.values().next().value).vibrationActuator.playEffect('dual-rumble',{startDelay:0,duration:clamp(ms,5000)," + MAG + "});if(typeof r?.catch==='function')r.catch(()=>{});";
// [nom, texte d'origine (présent une seule fois), texte muté]
const M = [
  ['glyphe Xbox : Vue manquant', "xbox:{Back:'Vue',", 'xbox:{'],
  ['glyphe Xbox : Home', "Home:'Xbox'", "Home:'Guide'"],
  ['glyphe PS : ✕ écrit X', "ps:{A:'✕',", "ps:{A:'X',"],
  ['glyphe PS : Create écrit Share', "Back:'Create'", "Back:'Share'"],
  ['glyphe PS : L2 et R2 échangés', "LT:'L2',RT:'R2'", "LT:'R2',RT:'L2'"],
  ['glyphe PS : △ et □ échangés', "X:'□',Y:'△'", "X:'△',Y:'□'"],
  ['glyph : flèches de NAMES ignorées', 'own(NAMES,a)?NAMES[a]:name', 'name'],
  ['glyph : propriété héritée du style', 'own(g,name)?g[name]', 'g[name]!==undefined?g[name]'],
  ['glyph : style hérité', 'const g=own(GLYPHS,style)?GLYPHS[style]:{}', 'const g=GLYPHS[style]||{}'],
  ['guessDevice : matchMedia détaché', 'const m=q=>win.matchMedia(q).matches', 'const m=q=>(0,win.matchMedia)(q).matches'],
  ['guessDevice : sans (pointer: coarse)', "return m('(pointer: coarse)')||win", 'return win'],
  ['guessDevice : sans (hover: none)', "maxTouchPoints>0&&m('(hover: none)')?", 'maxTouchPoints>0?'],
  ['guessDevice : un point de contact ne suffit pas', "maxTouchPoints>0&&m('(hover: none)')", "maxTouchPoints>1&&m('(hover: none)')"],
  ['guessDevice : hors du try', "{try{const m=q=>win.matchMedia(q).matches;return m('(pointer: coarse)')||win.navigator?.maxTouchPoints>0&&m('(hover: none)')?'touch':'keyboard';}catch(e){return 'keyboard';}}", "{const m=q=>win.matchMedia(q).matches;return m('(pointer: coarse)')||win.navigator?.maxTouchPoints>0&&m('(hover: none)')?'touch':'keyboard';}"],
  ['guessDevice : fenêtre par défaut ignorée', 'function guessDevice(win=G)', 'function guessDevice(win)'],
  ['keyLabel : libellé appris ignoré', LOOK, ''],
  ['keyLabel : table lue avant l’appris', LOOK + LAY, LAY + LOOK],
  ['keyLabel : table sans majuscule', '[...v].length>1?v:v.toUpperCase()', 'v'],
  ['keyLabel : plusieurs caractères mis en majuscules', '[...v].length>1?v:v.toUpperCase()', 'v.toUpperCase()'],
  ['keyLabel : get détaché de la table', 'lay.get(code):lay[code]', '(0,lay.get)(code):lay[code]'],
  ['keyLabel : chaîne vide acceptée', "if(typeof v==='string'&&v)return", "if(typeof v==='string')return"],
  ['keyLabel : valeur non chaîne acceptée', "if(typeof v==='string'&&v)return [...v].length>1?v:v.toUpperCase();", 'if(v)return String(v).toUpperCase();'],
  ['keyLabel : table lue pour tout code', 'const keyLabel=code=>{if(letter(code)){', "const keyLabel=code=>{if(typeof code==='string'){"],
  ['keyDown : espace appris', '/^[^\\s\\p{C}]$/u', '/^[^\\p{C}]$/u'],
  ['keyDown : caractère invisible appris', '/^[^\\s\\p{C}]$/u', '/^\\S$/u'],
  ['keyDown : unité de code au lieu du caractère', '/^[^\\s\\p{C}]$/u', '/^[^\\s\\0-\\x1f]$/'],
  ['keyDown : libellé appris sans majuscule', 'learnt.set(code,key.toUpperCase())', 'learnt.set(code,key)'],
  ['keyDown : rien appris pendant la capture', LEARN + '\n        ' + KD, KD + LEARN],
  ['keyDown : rien appris sur une répétition', 'if(letter(code)&&typeof key', 'if(!repeat&&letter(code)&&typeof key'],
  ['keyDown : dernière touche ne remplace pas', 'learnt.set(code,key.toUpperCase())', 'learnt.has(code)||learnt.set(code,key.toUpperCase())'],
  ['setLayout : toute valeur gardée', 'setLayout(map){lay=isObj(map)?map:null;}', 'setLayout(map){lay=map;}'],
  ['setLayout : sans effacement', 'setLayout(map){lay=isObj(map)?map:null;}', 'setLayout(map){if(isObj(map))lay=map;}'],
  ['label : séparateur', "v.map(f).join(' / ')", "v.map(f).join('/')"],
  ['label : action sans touche', "join(' / '):'—'", "join(' / '):''"],
  ['label : action inconnue', "if(!s)return '?';", "if(!s)return '—';"],
  ['label : style de la manette ignoré', "glyph(n,lp?.style||'generic')", "glyph(n,'generic')"],
  ['label : sans manette, style Xbox', "lp?.style||'generic'", "lp?.style||'xbox'"],
  ['label : tactile sans repli sur le libellé', 'a.touch??a.label', 'a.touch'],
  ['label : souris sans repli sur le clavier', "device==='mouse'&&a.mouse!==undefined?a.mouse", "device==='mouse'?a.mouse"],
  ['label : appareil par défaut clavier', 'label(id,device=dev)', "label(id,device='keyboard')"],
  ['label : touches de la déclaration', 'list(S.keys[id],keyLabel)', 'list(s.a.keys,keyLabel)'],
  ['label : boutons de la déclaration', 'list(S.pad[id],n=>', 'list(s.a.pad,n=>'],
  ['label : appareil inconnu → libellé', ":list(S.keys[id],keyLabel);", ":DEVICES.includes(device)?list(S.keys[id],keyLabel):a.label;"],
  ['dernière manette : jamais remise à null', 'lp=fa||(P.has(lp)?lp:null)', 'lp=fa||lp'],
  ['dernière manette : retenue sans activité', 'lp=fa||(P.has(lp)?lp:null)', 'lp=fa||(P.has(lp)?lp:[...P.keys()][0]||null)'],
  ['dernière manette : place dans la liste', 'if(act&&!(fa&&fa.index<=index))fa=o;', 'if(act&&!fa)fa=o;'],
  ['dernière manette : index le plus haut', 'fa.index<=index', 'fa.index>=index'],
  ['dernière manette : la dernière lue', 'if(act&&!(fa&&fa.index<=index))fa=o;', 'if(act)fa=o;'],
  ['rumble : sans limiteur', 'if(v<=0||t-rt<K.rumbleGap)return false;', 'if(v<=0)return false;'],
  ['rumble : écart de 40 ms refusé', 't-rt<K.rumbleGap', 't-rt<=K.rumbleGap'],
  ['rumble : écart de 50 ms', 'rumbleGap:40', 'rumbleGap:50'],
  ['rumble : padVibration ignoré', MAG, 'weakMagnitude:clamp(weak,1),strongMagnitude:clamp(strong,1)'],
  ['rumble : padVibration 0 accepté', 'if(v<=0||t-rt', 'if(t-rt'],
  ['rumble : moteurs échangés', MAG, 'weakMagnitude:clamp(strong,1)*v,strongMagnitude:clamp(weak,1)*v'],
  ['rumble : ordre des champs', '{startDelay:0,duration:clamp(ms,5000),' + MAG + '}', '{duration:clamp(ms,5000),' + MAG + ',startDelay:0}'],
  ['rumble : durée non bornée', 'duration:clamp(ms,5000)', 'duration:ms'],
  ['rumble : durée bornée à 1000', 'duration:clamp(ms,5000)', 'duration:clamp(ms,1000)'],
  ['rumble : intensité forte non bornée', 'strongMagnitude:clamp(strong,1)*v', 'strongMagnitude:strong*v'],
  ['rumble : intensité faible non bornée', 'weakMagnitude:clamp(weak,1)*v', 'weakMagnitude:weak*v'],
  ['rumble : NaN gardé', 'clamp=(v,hi)=>Math.min(hi,Math.max(0,v))||0', 'clamp=(v,hi)=>Math.min(hi,Math.max(0,v))'],
  ['rumble : valeurs négatives gardées', 'clamp=(v,hi)=>Math.min(hi,Math.max(0,v))||0', 'clamp=(v,hi)=>Math.min(hi,v)||0'],
  ['rumble : limiteur mis à jour avant l’appel', 'if(v<=0||t-rt<K.rumbleGap)return false;', 'if(v<=0||t-rt<K.rumbleGap)return false;rt=t;'],
  ['rumble : limiteur jamais mis à jour', 'rt=t;return true;', 'return true;'],
  ['rumble : rejet de la promesse non traité', "if(typeof r?.catch==='function')r.catch(()=>{});", ''],
  ['rumble : hors du try', TRY, NOTRY],
  ['rumble : toujours la première manette', '(gp.get(lp)||gp.values().next().value)', 'gp.values().next().value'],
  ['rumble : sans repli sur la première manette', '(gp.get(lp)||gp.values().next().value)', 'gp.get(lp)'],
  ['rumble : objets de la première image', 'seen=now;gp=P;', 'seen=now;if(!gp.size)gp=P;'],
  ['rumble : type d’effet', "playEffect('dual-rumble'", "playEffect('trigger-rumble'"],
  ['rumble : délai de départ', 'startDelay:0,duration', 'startDelay:1,duration'],
  ['rumble : limiteur initial à 0 ms', 'lp=null,rt=-Infinity,', 'lp=null,rt=0,'],
  // Étapes 3 et 4, ancres déplacées par l'étape 5 (mêmes mutations que t3/mutations.mjs, t3/mutations-etape2.mjs, t4/mutations.mjs).
  ['étape 3 — capture : appareil actif inchangé', "dev='keyboard';" + LEARN + '\n        ' + KD, LEARN + '\n        ' + KD + "\n        dev='keyboard';"],
  ['étape 2 — keyDown sans appareil clavier', "dev='keyboard';if(letter(code)", 'if(letter(code)'],
  ['étape 4 — activité : appareil jamais manette', "if(fa)dev='gamepad';", '']
];
// Same runner as t4/mutations.mjs: the report goes to a file, and a mutation counts as detected only when the runner ends
// with status 1 and names at least one failing test; a status 1 with no name is replayed, twice at most.
const out = work + '/rapport.txt';
const run = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-reporter-destination=' + out, work + '/checks/finput.test.mjs'], {encoding: 'utf8'});
  return {status: r.status, fails: [...new Set((readFileSync(out, 'utf8').match(/^✖ (E\d+\w?)/gm) || []).map(x => x.slice(2)))]};
};
let caught = 0, missing = 0; const rows = [];
for (const [name, a, b] of M) {
  if (src.split(a).length !== 2) { missing++; rows.push('ANCRE INTROUVABLE — ' + name); continue; }
  writeFileSync(work + '/src/input.js', src.split(a).join(b));
  let r = run(), again = 0;
  while (r.status === 1 && !r.fails.length && again < 2) { again++; r = run(); }
  const hit = r.status === 1 && r.fails.length > 0;
  if (hit) caught++;
  rows.push((hit ? 'détectée' : r.status === 0 ? 'NON DÉTECTÉE' : 'INDÉTERMINÉE (statut ' + r.status + ')') + ' — ' + name + (r.fails.length ? ' → ' + r.fails.join(', ') : '') + (again ? ' (relancée ' + again + ' fois)' : ''));
}
writeFileSync(work + '/src/input.js', src);
const intact = run().status === 0;
rows.push('module intact : ' + (intact ? 'tous les tests passent' : 'ÉCHEC'));
console.log(rows.join('\n') + '\n' + caught + ' mutations détectées sur ' + M.length);
process.exitCode = intact && !missing && caught === M.length ? 0 : 1;
