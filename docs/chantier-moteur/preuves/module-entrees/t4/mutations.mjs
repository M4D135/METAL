// Module entrées, étape 4 : contre-épreuve des tests de la manette. Chaque mutation du code de l'étape 4 dans
// src/input.js (radial, lecture, fusion, gâchettes, valeurs, course, visée, branchement à chaud, appareil actif, capture,
// clear, configure, échange des sticks) doit faire échouer node --test checks/finput.test.mjs ; le module intact passe tout.
// Les cinq mutations des étapes 2 et 3 dont l'ancre a bougé (t3/mutations.mjs : résultat de la capture jamais rendu,
// clear qui garde la capture ; t3/mutations-etape2.mjs : clear qui garde le regard, les verrous ou les doigts) sont
// rejouées ici avec leur nouvelle ancre. Le dépôt n'est jamais modifié : tout est copié dans <dossier>.
//   node docs/chantier-moteur/preuves/module-entrees/t4/mutations.mjs <dossier de travail, hors du dépôt> [racine]
import {readFileSync, writeFileSync, mkdirSync, cpSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const work = process.argv[2], repo = process.argv[3] || new URL('../../../../../', import.meta.url).pathname;
if (!work) { console.error('usage : node mutations.mjs <dossier de travail, hors du dépôt> [racine]'); process.exit(2); }
const src = readFileSync(repo + '/src/input.js', 'utf8');
mkdirSync(work + '/src', {recursive: true}); mkdirSync(work + '/checks', {recursive: true});
for (const f of ['finput.test.mjs', 'finput-fixture.mjs']) cpSync(repo + '/checks/' + f, work + '/checks/' + f);
cpSync(repo + '/src/options.js', work + '/src/options.js');
const HOLD = 'hold=n>K.boostAt?hold+dt:0;\n        const e=hold>K.boostAfter?Math.min(1,(hold-K.boostAfter)/K.boostRamp):0;';
// [nom, texte d'origine (présent une seule fois), texte muté]
const M = [
  ['radial : pas de remise à l’échelle', 'n=Math.min(1,(m-inner)/(outer-inner))', 'n=Math.min(1,m)'],
  ['radial : norme non bornée à 1', 'n=Math.min(1,(m-inner)/(outer-inner))', 'n=(m-inner)/(outer-inner)'],
  ['radial : direction perdue', '[x/m*n||0,y/m*n||0,n]', '[x*n||0,y*n||0,n]'],
  ['radial : -0 gardé', '[x/m*n||0,y/m*n||0,n]', '[x/m*n,y/m*n,n]'],
  ['padStyle : PlayStation lue comme Xbox', "test(id)?'ps':", "test(id)?'xbox':"],
  ['getGamepads détaché de navigator', 'G.navigator.getGamepads()', '(0,G.navigator.getGamepads)()'],
  ['getGamepads de la déclaration ignoré', 'C.getGamepads?C.getGamepads():G.navigator', 'G.navigator'],
  ['lecture hors du try', 'try{L=Array.from((C.getGamepads?C.getGamepads():G.navigator.getGamepads())||[]);}catch(e){}', 'L=Array.from(C.getGamepads?C.getGamepads():G.navigator.getGamepads());'],
  ['entrée qui n’est pas un objet acceptée', "if(!p||typeof p!=='object'||p.connected===false)", 'if(!p||p.connected===false)'],
  ['manette connected === false lue', "typeof p!=='object'||p.connected===false)", "typeof p!=='object')"],
  ['clé sans l’id', "key=index+':'+id", 'key=String(index)'],
  ['index : place dans la liste', 'index=p.index??i', 'index=i'],
  ['index : sans repli sur la place', 'index=p.index??i', 'index=p.index'],
  ['bouton en nombre ignoré', 'v=fin(q.value??q)', 'v=fin(q.value)'],
  ['bouton : pressed ignoré', 'else b[j]=b[j]||d||v>.5;', 'else b[j]=b[j]||v>.5;'],
  ['bouton : seuil .5 inclus', 'else b[j]=b[j]||d||v>.5;', 'else b[j]=b[j]||d||v>=.5;'],
  ['gâchettes lues comme des boutons', 'if(j===6||j===7)tv[j-6]', 'if(false)tv[j-6]'],
  ['gâchettes : dernière manette au lieu du maximum', 'tv[j-6]=Math.max(tv[j-6],v)', 'tv[j-6]=v'],
  ['gâchettes : sans hystérésis', 'trig[j]?tv[j]>K.trigOff:tv[j]>K.trigOn', 'tv[j]>K.trigOn'],
  ['gâchettes : seuils inclus', 'trig[j]?tv[j]>K.trigOff:tv[j]>K.trigOn', 'trig[j]?tv[j]>=K.trigOff:tv[j]>=K.trigOn'],
  ['activité : pressed ignoré', 'act=act||d||v>K.activeAxis;', 'act=act||v>K.activeAxis;'],
  ['activité : toute valeur de bouton', 'act=act||d||v>K.activeAxis;', 'act=act||d||v>0;'],
  ['activité : axe signé', 'act=act||Math.abs(ax(j))>K.activeAxis', 'act=act||ax(j)>K.activeAxis'],
  ['activité : tous les axes', 'for(let j=0;j<4;j++)act=', 'for(let j=0;j<8;j++)act='],
  ['activité : appareil jamais manette', "if(act)dev='gamepad';", ''],
  ['swapSticks ignoré', "s.pad==='LS'!==T.swapSticks?0:2", "s.pad==='LS'?0:2"],
  ['zones mortes échangées entre les rôles', 'mv=r(ms,T.moveDead,mv);lk=r(ls,T.padDead,lk);', 'mv=r(ms,T.padDead,mv);lk=r(ls,T.moveDead,lk);'],
  ['stick : dernière manette au lieu de la plus forte', 'return v[2]>w[2]?v:w;', 'return o<0?w:v;'],
  ['stick : première manette au lieu de la plus forte', 'return v[2]>w[2]?v:w;', 'return w[2]>0?w:v;'],
  ['rôle visée lu sur le stick de déplacement', 'ls=side(look)', 'ls=side(walk)'],
  ['axe non fini gardé', 'ax=j=>fin((p.axes||[])[j])', 'ax=j=>(p.axes||[])[j]'],
  ['branchement : connected à chaque image', 'if(!seen.has(key))con.push(card(o));', 'con.push(card(o));'],
  ['branchement : disconnected jamais rendu', 'dis.push({index:o.index,id:o.id})', '0'],
  ['branchement : manettes vues jamais mises à jour', 'seen=now;', ''],
  ['branchement : fiches partagées avec l’état interne', 'pads:[...now.values()].map(card)', 'pads:[...now.values()]'],
  ['branchement : standard toujours vrai', "standard:p.mapping==='standard'", 'standard:true'],
  ['capture : Home capturé', 'j<16&&b[j]&&!pb[j]', 'b[j]&&!pb[j]'],
  ['capture : bouton déjà tenu capturé', 'j<16&&b[j]&&!pb[j]', 'j<16&&b[j]'],
  ['capture : fronts de l’image gardés', 'cap=null;quiet=true;}', 'cap=null;}'],
  ['capture : jamais finie', 'got={device:cap,code};cap=null;', 'got={device:cap,code};'],
  ['image calme jamais levée', 'pb=b;quiet=false;', 'pb=b;'],
  ['boutons de l’image précédente jamais retenus', 'pb=b;quiet=false;', 'quiet=false;'],
  ['valeur : sans zone morte', 'tv[j-6]>K.valueDead?Math.min(1,(tv[j-6]-K.valueDead)/(1-K.valueDead)):0', 'Math.min(1,tv[j-6])'],
  ['valeur : bouton ordinaire à 0', ':0:+!!b[j];', ':0:0;'],
  ['valeur : premier bouton seulement', 's.gv=s.pi.reduce((m,j)=>Math.max(m,val(j)),0)', 's.gv=s.pi.length?val(s.pi[0]):0'],
  ['actions : manette sans règle des fronts', 's.gv=s.pi.reduce((m,j)=>Math.max(m,val(j)),0);rise(s,was,1);}', 's.gv=s.pi.reduce((m,j)=>Math.max(m,val(j)),0);}'],
  ['actions : image calme ignorée', 'if(!was&&on(s)&&!(pad&&quiet))', 'if(!was&&on(s))'],
  ['déplacement : avant négatif', 'pmy=-mv[1]', 'pmy=mv[1]'],
  ['course : jamais au bout du stick', 's.gr=mv[2]>=K.padRun;', 's.gr=false;'],
  ['course : seuil .90', 's.gr=mv[2]>=K.padRun;', 's.gr=mv[2]>=.9;'],
  ['course : fronts dans l’image calme', 's.gr=mv[2]>=K.padRun;rise(s,was,1);', 's.gr=mv[2]>=K.padRun;rise(s,was);'],
  ['visée : sans courbe', 'c=n>0?Math.pow(n,T.padCurve)/n:0', 'c=n>0?1:0'],
  ['visée : maintien compté après la rampe', HOLD, 'const e=hold>K.boostAfter?Math.min(1,(hold-K.boostAfter)/K.boostRamp):0;hold=n>K.boostAt?hold+dt:0;'],
  ['visée : maintien dès .90', 'hold=n>K.boostAt?', 'hold=n>.9?'],
  ['visée : surcroît aussi au tangage', 'py+=-y*c*T.padPitch*sc', 'py+=-y*c*T.padPitch*(1+T.padBoost*e)*sc'],
  ['visée : surcroît ignoré', '(1+T.padBoost*e)', '1'],
  ['visée : lookScale ignoré', 'px+=x*c*T.padYaw*(1+T.padBoost*e)*sc*', 'px+=x*c*T.padYaw*(1+T.padBoost*e)*'],
  ['visée : lookScale aussi au clavier', 'px+=axis(look.x)*dt*look.rate;', 'px+=axis(look.x)*dt*look.rate*sc;'],
  ['visée : lookScale non fini accepté', 'sc=Number.isFinite(ctx?.lookScale)?ctx.lookScale:1', 'sc=ctx?.lookScale??1'],
  ['tangage : padInvertY ignoré', '(T.padInvertY?-1:1)', '1'],
  ['tangage : invertY de la souris', '(T.padInvertY?-1:1)', '(T.invertY?-1:1)'],
  ['tangage : signe inversé', 'py+=-y*c', 'py+=y*c'],
  ['configure : boutons tenus non repris', 's.g=s.pi.some(j=>pb[j]);}return copy(S);', '}return copy(S);'],
  ['configure : table pad des réglages ignorée', 's.pi=S.pad[s.a.id].map', 's.pi=s.a.pad.map'],
  ['clear : boutons non relâchés', 's.m=s.g=s.gr=s.tr=s.latch=s.edge=false;', 's.m=s.tr=s.latch=s.edge=false;'],
  ['clear : déplacement manette gardé', 'px=py=pmx=pmy=tmx=tmy=hold=0;', 'px=py=tmx=tmy=hold=0;'],
  ['clear : maintien de la visée gardé', 'tmx=tmy=hold=0;', 'tmx=tmy=0;'],
  ['clear : image suivante avec fronts', 'cap=got=null;quiet=true;}', 'cap=got=null;}'],
  // Étapes 2 et 3, ancres déplacées par l'étape 4 (mêmes mutations que t3/mutations.mjs et t3/mutations-etape2.mjs).
  ['étape 3 — capture : résultat jamais rendu', 'pads:[...now.values()].map(card),captured:got};', 'pads:[...now.values()].map(card),captured:null};'],
  ['étape 3 — clear garde la capture', 'cap=got=null;quiet=true;}', 'quiet=true;}'],
  ['étape 2 — clear garde le regard', 'pressed.length=0;px=py=pmx=pmy=tmx=tmy=hold=0;', 'pressed.length=0;pmx=pmy=tmx=tmy=hold=0;'],
  ['étape 2 — clear garde les verrous', 's.m=s.g=s.gr=s.tr=s.latch=s.edge=false;', 's.m=s.g=s.gr=s.tr=s.edge=false;'],
  ['étape 2 — clear garde les doigts', 'clear(){held.clear();for(const s of A){s.k=s.t=s.gv=0;', 'clear(){held.clear();for(const s of A){s.k=s.gv=0;']
];
// The report goes to a file: on macOS a pipe is written asynchronously and the runner may exit before it drains.
// A mutation counts as detected only when the runner ends with status 1 and names at least one failing test.
// Status 1 with no name happened once in a first run of this suite (« activité : tous les axes », detected by E35 on its
// own run and on the next full run): the runner then reports the whole file as one failed test, with no subtest, in
// about 80 ms (1 run in 30 on a loaded Mac, same mutated module each time). Such a run is replayed, twice at most, and
// the row says so.
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
