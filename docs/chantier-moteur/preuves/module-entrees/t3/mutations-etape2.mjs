// Module entrées, étape 3 : les 38 mutations de l'étape 2 (t2/mutations.mjs), rejouées sur le code de l'étape 3.
// Le code de l'étape 3 a déplacé cinq ancres (fronts vidés et deviceChanged dans frame, clear, défauts de table,
// keyDown) : elles visent ici le même texte d'origine dans sa nouvelle place, pour la même mutation.
// Comme t3/mutations.mjs, le rapport passe par un fichier, et une mutation n'est détectée que si l'exécution
// finit au statut 1 en nommant au moins un test en échec. Le dépôt n'est jamais modifié.
//   node docs/chantier-moteur/preuves/module-entrees/t3/mutations-etape2.mjs <dossier de travail, hors du dépôt> [racine]
import {readFileSync, writeFileSync, mkdirSync, cpSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const work = process.argv[2], repo = process.argv[3] || new URL('../../../../../', import.meta.url).pathname;
if (!work) { console.error('usage : node mutations-etape2.mjs <dossier de travail, hors du dépôt> [racine]'); process.exit(2); }
const src = readFileSync(repo + '/src/input.js', 'utf8');
mkdirSync(work + '/src', {recursive: true}); mkdirSync(work + '/checks', {recursive: true});
for (const f of ['finput.test.mjs', 'finput-fixture.mjs']) cpSync(repo + '/checks/' + f, work + '/checks/' + f);
cpSync(repo + '/src/options.js', work + '/src/options.js');
// [nom, texte d'origine (présent une seule fois), texte muté] ; « (ancre déplacée) » marque les cinq ancres revues.
const M = [
  ['regard souris : produit mouseScale×sensibilité précalculé', 'px+=fin(dx)*C.mouseScale*T.sensitivity', 'px+=fin(dx)*(C.mouseScale*T.sensitivity)'],
  ['regard souris : y non inversé', 'py-=fin(dy)', 'py+=fin(dy)'],
  ['regard souris : invertY ignoré', '*(T.invertY?-1:1)', ''],
  ['regard clavier : rate ignoré', 'axis(look.x)*dt*look.rate', 'axis(look.x)*dt*2'],
  ['tenue sans verrou', "k==='hold'?on(s)||s.latch", "k==='hold'?on(s)"],
  ['impulsion = tenue', "k==='press'?s.latch", "k==='press'?on(s)"],
  ['verrous jamais effacés', 's.latch=false;}', '}'],
  ['regard non consommé par step', 'px=py=0;\n', '\n'],
  ['répétition avec front', 'if(!repeat)rise(s,was)', 'rise(s,was)'],
  ['fronts en double', 'if(!s.edge){s.edge=true;pressed.push(s.a.id);}', 'pressed.push(s.a.id);'],
  ['fronts jamais remis à zéro', 'for(const s of A)s.edge=false;return r;', 'return r;'],
  ['liste des fronts non vidée (ancre déplacée)', 'got=null;pressed.length=0;', 'got=null;'],
  ['clear garde le regard (ancre déplacée)', 'pressed.length=0;px=py=tmx=tmy=0;cap', 'pressed.length=0;tmx=tmy=0;cap'],
  ['clear garde les verrous', 's.m=s.tr=s.latch=s.edge=false;', 's.m=s.tr=s.edge=false;'],
  ['clear garde les touches', 'clear(){held.clear();', 'clear(){'],
  ['clear garde les doigts', 'clear(){held.clear();for(const s of A){s.k=s.t=0;', 'clear(){held.clear();for(const s of A){s.k=0;'],
  ['filtre souris de 800 ms à <=', "if(!(t-touchT<K.compatMs))dev='mouse'", "if(!(t-touchT<=K.compatMs))dev='mouse'"],
  ['filtre souris absent', "if(!(t-touchT<K.compatMs))dev='mouse'", "dev='mouse'"],
  ['doigts négatifs', 's.t=down?s.t+1:Math.max(0,s.t-1)', 's.t=down?s.t+1:s.t-1'],
  ['deviceChanged contre l’appareil initial (ancre déplacée)', 'shown=dev;got', 'got'],
  ['dt non borné', 'Math.min(K.dtMax,Math.max(0,dt))', 'Math.max(0,dt)'],
  ['dt non fini accepté', 'dt=Number.isFinite(dt)?', 'dt=true?'],
  ['deltas non finis acceptés', 'const fin=v=>Number.isFinite(v)?v:0', 'const fin=v=>v'],
  ['configure ne recompte pas les touches', 'if(held.has(c))s.k++;', ''],
  ['keyUp ne relâche pas', 'if(held.delete(code)&&s)s.k--;', 'held.delete(code);'],
  ['table : une entrée invalide garde les autres', 'return null;}', 'continue;}'],
  ['table : défauts sans filtre des codes pris (ancre déplacée)', 'v=a[f].filter(free)', 'v=a[f].slice()'],
  ['table : propriétés héritées lues', 'if(own(t,a.id)){const v', 'if(t[a.id]!==undefined){const v'],
  ['tune : booléen pour un nombre', 'Number.isFinite(v)?Math.min', "typeof v!=='string'&&v===v?Math.min"],
  ['tune : non borné', 'Math.min(hi,Math.max(lo,v))', 'v'],
  ['tune : chaîne acceptée pour un booléen', "typeof v==='boolean'?v:d", 'v===undefined?d:!!v'],
  ['settings sans copie', 'get settings(){return copy(S);}', 'get settings(){return S;}'],
  ['valeur : booléen au lieu de 1', 'Math.max(s.gv,s.k>0||s.m||s.t>0?1:0)', 's.k>0||s.m||s.t>0'],
  ['ordre des sorties : actions avant sticks', 'const o={};', 'const o={};for(const s of A)o[s.a.id]=0;'],
  ['addLook ignore l’appareil', 'if(DEVICES.includes(device))dev=device;', ''],
  ['keyDown sans appareil clavier (ancre déplacée)', "dev='keyboard';\n        if(cap", 'if(cap'],
  ['bouton souris sans appareil', "if(device==='mouse'){s.m=!!down;mouse(t);}", "if(device==='mouse'){s.m=!!down;}"],
  ['bouton tactile sans horodatage', "dev='touch';touchT=t;", "dev='touch';"],
];
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
