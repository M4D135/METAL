// Module entrées, étape 3 : contre-épreuve des tests des réglages. Chaque mutation du code de l'étape 3 dans
// src/input.js (normalize, migrate, replis alt, table pad, assign, unbind, capture clavier) doit faire échouer
// node --test checks/finput.test.mjs ; le module intact doit tous les passer.
// Le dépôt n'est jamais modifié : le module, ses tests et src/options.js (lu par E21b et E38) sont copiés dans <dossier>.
//   node docs/chantier-moteur/preuves/module-entrees/t3/mutations.mjs <dossier de travail, hors du dépôt> [racine]
import {readFileSync, writeFileSync, mkdirSync, cpSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const work = process.argv[2], repo = process.argv[3] || new URL('../../../../../', import.meta.url).pathname;
if (!work) { console.error('usage : node mutations.mjs <dossier de travail, hors du dépôt> [racine]'); process.exit(2); }
const src = readFileSync(repo + '/src/input.js', 'utf8');
mkdirSync(work + '/src', {recursive: true}); mkdirSync(work + '/checks', {recursive: true});
for (const f of ['finput.test.mjs', 'finput-fixture.mjs']) cpSync(repo + '/checks/' + f, work + '/checks/' + f);
cpSync(repo + '/src/options.js', work + '/src/options.js');
// The three checks of rebind, in their order: device, action, code.
const L1 = "if(!kb&&device!=='gamepad')return no('Appareil inconnu.');";
const L2 = "if(!C.index.has(action))return no('Action inconnue.');";
const L3 = "if(!none&&!(kb?C.isKey(code):padOk(code)))return no(kb?'Cette touche est réservée au navigateur.':code==='Home'?'Ce bouton est réservé au système.':'Bouton inconnu.');";
const KD = "if(cap==='keyboard'){if(!repeat&&typeof code==='string'){got={device:'keyboard',code};cap=null;}return true;}";
// [nom, texte d'origine (présent une seule fois), texte muté]
const M = [
  ['migrate jamais appelé', 'if(from<C.version&&migrate)try', 'if(false&&migrate)try'],
  ['migrate appelé quel que soit le format', 'if(from<C.version&&migrate)try', 'if(migrate)try'],
  ['migrate appelé pour la version courante', 'from<C.version&&migrate', 'from<=C.version&&migrate'],
  ['from : v non entier pris tel quel', 'const from=Number.isInteger(r.v)?r.v:0', 'const from=Number(r.v)||0'],
  ['migrate travaille sur la copie elle-même', 'migrate(copy(r),from)', 'migrate(r,from)'],
  ['résultat de migrate non recopié', 'const m=copy(migrate(copy(r),from))', 'const m=migrate(copy(r),from)'],
  ['résultat de migrate pris s’il n’est pas un objet', 'if(isObj(m))r=m;', 'r=m||r;'],
  ['migrate hors du try', 'try{const m=copy(migrate(copy(r),from));if(isObj(m))r=m;}catch(e){}', '{const m=copy(migrate(copy(r),from));if(isObj(m))r=m;}'],
  ['table : entrée null lue comme vide', 'if(own(t,a.id)){const v=t[a.id];', 'if(own(t,a.id)){const v=t[a.id]===null?[]:t[a.id];'],
  ['table : clés inconnues gardées', 'const used=new Set(),out={},free', 'const used=new Set(),out=Object.assign({},t),free'],
  ['repli alt ignoré', "if(!v.length&&f==='keys')v=a.alt.filter(free).slice(0,1);", ''],
  ['repli alt aussi à la manette', "if(!v.length&&f==='keys')", 'if(!v.length)'],
  ['repli alt : tous les codes libres', 'a.alt.filter(free).slice(0,1)', 'a.alt.filter(free)'],
  ['repli alt avant les défauts', "v=a[f].filter(free);if(!v.length&&f==='keys')v=a.alt.filter(free).slice(0,1);", "v=f==='keys'?a.alt.filter(free).slice(0,1):[];if(!v.length)v=a[f].filter(free);"],
  ['repli alt dès qu’un code par défaut est pris', "if(!v.length&&f==='keys')", "if(v.length<a[f].length&&f==='keys')"],
  ['codes attribués non ajoutés aux codes utilisés', 'for(const c of v)used.add(c);}', '}'],
  ['table pad stockée ignorée', "s.pad=table(r.pad,C,'pad',2,padOk)||s.pad;", ''],
  ['table pad : trois boutons acceptés', "table(r.pad,C,'pad',2,padOk)", "table(r.pad,C,'pad',3,padOk)"],
  ['table pad : Home accepté', "table(r.pad,C,'pad',2,padOk)", "table(r.pad,C,'pad',2,c=>PAD_BUTTONS.includes(c))"],
  ['ordre des contrôles : action avant appareil', L1 + '\n    ' + L2, L2 + '\n    ' + L1],
  ['ordre des contrôles : code avant action', L2 + '\n    ' + L3, L3 + '\n    ' + L2],
  ['appareil inconnu traité comme la manette', L1, ''],
  ['texte : Home non distingué', "code==='Home'?'Ce bouton est réservé au système.':'Bouton inconnu.'", "'Bouton inconnu.'"],
  ['conflit ignoré', 'if(other)return {ok:false', 'if(false)return {ok:false'],
  ['conflit lu sur les réglages bruts', 's[f][a.id].includes(code)', '((settings&&settings[f]||{})[a.id]||[]).includes(code)'],
  ['conflit avec l’action elle-même', 'a=>a.id!==action&&s[f]', 'a=>s[f]'],
  ['texte : genre de la touche et du bouton confondus', "'Déjà utilisé'+(kb?'e':'')", "'Déjà utilisée'"],
  ['assign modifie son argument', 's[f][action]=none?[]:[code];', 's[f][action]=none?[]:[code];if(isObj(settings)&&isObj(settings[f]))settings[f][action]=s[f][action];'],
  ['assign ajoute au lieu de remplacer', 's[f][action]=none?[]:[code];', 's[f][action]=none?[]:s[f][action].filter(c=>c!==code).concat(code);'],
  ['unbind sans effet', 's[f][action]=none?[]:[code];', 's[f][action]=none?s[f][action]:[code];'],
  ['instance : assign sur les réglages de la déclaration', 'assign:(device,action,code)=>rebind(C,S,', 'assign:(device,action,code)=>rebind(C,C.settings,'],
  ['instance : assign applique le résultat', 'assign:(device,action,code)=>rebind(C,S,device,action,code),', 'assign:(device,action,code)=>{const r=rebind(C,S,device,action,code);if(r.ok)configure(r.settings);return r;},'],
  ['instance : unbind sur les réglages de la déclaration', 'unbind:(device,action)=>rebind(C,S,', 'unbind:(device,action)=>rebind(C,C.settings,'],
  ['capture : la touche va aussi au jeu', KD, "if(cap==='keyboard'&&!repeat&&typeof code==='string'){got={device:'keyboard',code};cap=null;}"],
  ['capture : jamais finie', "got={device:'keyboard',code};cap=null;}", "got={device:'keyboard',code};}"],
  ['capture : répétition capturée', "if(!repeat&&typeof code==='string'){got=", "if(typeof code==='string'){got="],
  ['capture : code qui n’est pas une chaîne capturé', "if(!repeat&&typeof code==='string'){got=", 'if(!repeat){got='],
  ['capture : appareil actif inchangé', "dev='keyboard';\n        " + KD, KD + "\n        dev='keyboard';"],
  ['capture : résultat jamais rendu', 'pads:[],captured:got};', 'pads:[],captured:null};'],
  ['capture : résultat rendu à chaque image', 'shown=dev;got=null;', 'shown=dev;'],
  ['capture : une nouvelle capture garde le résultat en attente', 'device:null;got=null;}', 'device:null;}'],
  ['clear garde la capture', 'px=py=tmx=tmy=0;cap=got=null;}', 'px=py=tmx=tmy=0;}'],
];
// The report goes to a file: on macOS a pipe is written asynchronously and the runner may exit before it drains.
// A mutation counts as detected only when the runner ends with status 1 and names at least one failing test.
const out = work + '/rapport.txt';
const run = () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-reporter-destination=' + out, work + '/checks/finput.test.mjs'], {encoding: 'utf8'});
  return {status: r.status, fails: [...new Set((readFileSync(out, 'utf8').match(/^✖ (E\d+\w?)/gm) || []).map(x => x.slice(2)))]};
};
let caught = 0, missing = 0; const rows = [];
for (const [name, a, b] of M) {
  if (src.split(a).length !== 2) { missing++; rows.push('ANCRE INTROUVABLE — ' + name); continue; }
  writeFileSync(work + '/src/input.js', src.split(a).join(b));
  const r = run(), hit = r.status === 1 && r.fails.length > 0;
  if (hit) caught++;
  rows.push((hit ? 'détectée' : r.status === 0 ? 'NON DÉTECTÉE' : 'INDÉTERMINÉE (statut ' + r.status + ')') + ' — ' + name + (r.fails.length ? ' → ' + r.fails.join(', ') : ''));
}
writeFileSync(work + '/src/input.js', src);
const intact = run().status === 0;
rows.push('module intact : ' + (intact ? 'tous les tests passent' : 'ÉCHEC'));
console.log(rows.join('\n') + '\n' + caught + ' mutations détectées sur ' + M.length);
process.exitCode = intact && !missing && caught === M.length ? 0 : 1;
