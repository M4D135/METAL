// Étape 3 de la voie « boucle » : contrôle par mutants de src/schedule.js (FSchedule).
// Chaque mutant est une erreur plausible, appliquée à une copie jetable du code normatif ; on regarde quels tests
// la tuent : ceux du relais (commit 4b75580, le §6.3 à la lettre) et ceux de checks/fschedule.test.mjs.
// Depuis la racine : node docs/chantier-moteur/preuves/module-boucle/etape-3-mutants.mjs [--relais F] [--work D]
// --relais : fichier de test du relais (par défaut : git show 4b75580:checks/fschedule.test.mjs).
// --work : dossier des copies jetables (par défaut : dossier temporaire du système), vidé à la fin.
// Écrit etape-3-mutants.json à côté de ce fichier. Code 1 si le témoin échoue ou si un mutant survit aux tests.
import {fileURLToPath} from 'node:url';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {spawnSync, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const RELAY = '4b75580';
const norm = readFileSync(path.join(root, 'src/schedule.js'), 'utf8');
const mine = readFileSync(path.join(root, 'checks/fschedule.test.mjs'), 'utf8');
const relay = arg('--relais') ? readFileSync(arg('--relais'), 'utf8')
  : execFileSync('git', ['show', RELAY + ':checks/fschedule.test.mjs'], {cwd: root, encoding: 'utf8'});
const sha = s => createHash('sha256').update(s).digest('hex');

// [id, erreur, [[texte du code normatif, remplacement], …]] ; chaque texte doit apparaître exactement une fois.
const MUTANTS = [
  ['M00', 'témoin, sans mutation', []],
  ['M01', "pump passe une copie de l'enregistrement à run", [['function call(t,arg){try{return t.run(arg,t);}', 'function call(t,arg,o=t){try{return t.run(arg,o);}'], ['r=call(t,t0+left)', 'r=call(t,t0+left,{...t})']]],
  ['M02', 'flush « sim » : premier appel avec Infinity', [['units(t,Number.MAX_SAFE_INTEGER)', 'units(t,i?Number.MAX_SAFE_INTEGER:Infinity)']]],
  ['M03', 'agingFrames par défaut à 10', [['o.agingFrames??30', 'o.agingFrames??10']]],
  ['M04', 'échéance = début + budget entier', [['r=call(t,t0+left)', 'r=call(t,t0+budget)']]],
  ['M05', 'simUnits compté avant la validation', [['const used=call(t,left);t.runs++;', 'const used=call(t,left);t.runs++;stats.simUnits+=used;'], ['stats.simUnits+=used;if(t.done)drop(t);', 'if(t.done)drop(t);']]],
  ['M06', 'argument refusé de pumpSim compté comme erreur', [['if(!Number.isInteger(n)||n<0)throw', 'if(!Number.isInteger(n)||n<0)throw stats.errors++,']]],
  ['M07', 'une exception « sim » vide la file', [['catch(e){drop(t);stats.errors++;throw e;}', "catch(e){drop(t);if(t.lane==='sim')simQ.length=0;stats.errors++;throw e;}"]]],
  ['M08', 'enregistrement sans lastPump initial', [['removed:false,lastPump:0}', 'removed:false}']]],
  ['M09', 'maxSliceMs initial à -Infinity', [['maxSliceMs:0,', 'maxSliceMs:-Infinity,']]],
  ['M10', "count('frame') compte les deux files", [["count:lane=>lane==='frame'?frameQ.length:", "count:lane=>lane==='frame'?frameQ.length+simQ.length:"]]],
  ['M11', "flush « image » lit l'horloge (durée)", [['else{const r=call(t,Infinity);t.runs++;', 'else{const t0=now?now():0,r=call(t,Infinity);t.runs++;t.spentMs+=now?now()-t0:0;']]],
  ['M12', 'pump à budget nul fait vieillir la file', [['if(!(budget>0)||!frameQ.length)return 0;', 'if(!(budget>0)||!frameQ.length){for(const t of frameQ)t.age++;return 0;}']]],
  ['M13', 'les tâches sautées ne vieillissent pas', [['for(const t of list)if(!t.removed&&t.lastPump!==id)t.age++;', '']]],
  ['M14', "pumpSim lit l'horloge", [['let left=n;', 'let left=n;if(now)now();']]],
  ['M15', 'remplacement de clé dans les deux files', [['for(const t of q.slice())if(t.key===task.key)drop(t);', 'for(const t of [...frameQ,...simQ])if(t.key===task.key)drop(t);']]],
  ['M16', 'has ne regarde que la file « image »', [['has:key=>!!find(key)', 'has:key=>frameQ.some(t=>t.key===key)']]],
  ['M17', 'pumpSim offre le total à chaque tâche', [['left-=units(t,left);', 'left-=units(t,n);']]],
  ['M18', 'tâche plus longue que le budget lancée après une autre', [['if(ran&&t.cost>left)', 'if(t.cost>left&&t.cost<=budget&&ran)']]],
  ['M19', 'garde de flush à 1e5 appels', [['for(let i=0;i<1e6;i++)', 'for(let i=0;i<1e5;i++)']]],
];

const work = mkdtempSync(path.join(arg('--work') || os.tmpdir(), 'fschedule-mutants-'));
function run(dir, file) {
  const r = spawnSync(process.execPath, ['--test', file], {cwd: dir, encoding: 'utf8', timeout: 60000});
  const out = (r.stdout || '') + (r.stderr || '');
  const by = [...new Set(out.split('\n').filter(l => /^✖ S\d\d/.test(l)).map(l => l.slice(2, 5)))];
  return {killed: r.status !== 0, by: r.error?.code === 'ETIMEDOUT' ? ['délai'] : by};
}
const rows = [];
try {
  for (const [id, label, edits] of MUTANTS) {
    let src = norm;
    for (const [a, b] of edits) {
      const n = src.split(a).length - 1;
      if (n !== 1) throw new Error(id + ' : texte trouvé ' + n + ' fois : ' + a);
      src = src.replace(a, b);
    }
    const dir = path.join(work, id);
    mkdirSync(path.join(dir, 'src'), {recursive: true}); mkdirSync(path.join(dir, 'checks'), {recursive: true});
    writeFileSync(path.join(dir, 'src/schedule.js'), src);
    writeFileSync(path.join(dir, 'checks/relais.test.mjs'), relay);
    writeFileSync(path.join(dir, 'checks/fschedule.test.mjs'), mine);
    const row = {id, label, relay: run(dir, 'checks/relais.test.mjs'), mb3: run(dir, 'checks/fschedule.test.mjs')};
    rows.push(row);
    const say = r => r.killed ? 'tué (' + r.by.join(', ') + ')' : 'survit';
    console.log(id, label.padEnd(54), '| relais :', say(row.relay).padEnd(20), '| MB-3 :', say(row.mb3));
  }
} finally { rmSync(work, {recursive: true, force: true}); }

const [control, ...mutants] = rows;
const summary = {mutants: mutants.length, relaySurvivors: mutants.filter(r => !r.relay.killed).map(r => r.id),
  mb3Survivors: mutants.filter(r => !r.mb3.killed).map(r => r.id), controlPasses: !control.relay.killed && !control.mb3.killed};
const out = {schema: 'boucle-etape-3-mutants-v1', node: process.version, arch: process.arch, platform: process.platform,
  cpu: os.cpus()[0]?.model, loadavg: os.loadavg(), scheduleSha256: sha(norm), relayCommit: RELAY,
  relayTestSha256: sha(relay), mb3TestSha256: sha(mine), summary, rows};
writeFileSync(new URL('./etape-3-mutants.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('mutants', summary.mutants, '· survivants relais', summary.relaySurvivors.length, '· survivants MB-3', summary.mb3Survivors.length, '· témoin', summary.controlPasses ? 'ok' : 'ÉCHEC');
process.exit(summary.controlPasses && !summary.mb3Survivors.length ? 0 : 1);
