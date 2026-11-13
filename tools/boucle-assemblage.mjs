// Assemblage de la voie « boucle » (§7.5 de la mission) : reproduit tools/build.py en JavaScript, sans rien écrire hors
// des preuves (ni dist/index.html, ni SIZE.json). D'abord la liste de modules telle quelle : la base doit redonner
// SIZE.json et dist/index.html. Puis le projet du raccord (§4.13) : 'loop.js','schedule.js' juste après 'options.js'.
// N'écrit que assemblage.json ; code 1 si un critère tombe (une base non reproduite est signalée, sans échec).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = path.join(root, 'docs', 'chantier-moteur', 'preuves', 'module-boucle');
const BUDGET = 1_400_000, SEP = '\n;\n';
const bytesOf = rel => fs.readFileSync(path.join(root, rel));
const sha256 = data => createHash('sha256').update(data).digest('hex');
// Comme Path.read_text() de Python : UTF-8 strict (une séquence invalide arrête tout), BOM gardé, fins de ligne
// universelles (\r\n et \r deviennent \n). Sans \r dans les sources, c'est le texte du fichier, octet pour octet.
const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}), withCR = new Set();
const readText = rel => { const text = decoder.decode(bytesOf(rel)); if (text.includes('\r')) withCR.add(rel); return text.replace(/\r\n?/g, '\n'); };

// 1. Liste des modules de tools/build.py.
const listed = readText('tools/build.py').match(/modules=\[([^\]]*)\]/);
if (!listed) throw new Error('liste modules introuvable dans tools/build.py');
const modules = [...listed[1].matchAll(/'([^']*)'/g)].map(m => m[1]);
const version = JSON.parse(readText('package.json')).version;

// 2 et 3. Code joint par '\n;\n', puis la page : chaque replace de build.py, dans le même ordre, sur toute la page
// (split/join remplace toutes les occurrences et ne lit pas les $, comme le replace de Python).
function assemble(list) {
  const code = list.map(name => readText('src/' + name)).join(SEP);
  const html = readText('src/index.html').split('/*__STYLE__*/').join(readText('src/style.css'))
    .split('/*__CODE__*/').join(code).split('__GAME_VERSION__').join(version);
  return {code, html, data: Buffer.from(html, 'utf8')};
}

// Les deux expressions de checks/build.test.mjs (actifs externes, code chargé par le réseau), recopiées.
const buildTest = readText('checks/build.test.mjs');
const PATTERNS = [
  ['externalAssets', /<(?:script|img|audio|video|link)\b[^>]*(?:src|href)\s*=\s*["'](?:https?:|\/\/)/i],
  ['networkCode', /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|import\s*\(|@import)/],
];
const verdicts = a => ({
  closingScriptInCode: a.code.toLowerCase().includes('</script'),       // assertion de build.py
  placeholdersLeft: a.html.includes('/*__CODE__*/') || a.html.includes('/*__STYLE__*/'),
  hasFLoop: a.html.includes('FLoop'), hasFSchedule: a.html.includes('FSchedule'),
  patterns: Object.fromEntries(PATTERNS.map(([name, re]) => [name, re.test(a.html)])),
});

// 4. Base : la liste telle quelle.
const size = JSON.parse(readText('SIZE.json')), base = assemble(modules), dist = bytesOf('dist/index.html');
const baseInfo = {
  htmlBytes: base.data.length, sha256: sha256(base.data),
  gzipBytesNode: zlib.gzipSync(base.data, {level: 9}).length,
  sizeJson: {version: size.version, html_bytes: size.html_bytes, sha256: size.sha256, gzip_bytes: size.gzip_bytes},
  reproduced: base.data.length === size.html_bytes && sha256(base.data) === size.sha256,
  equalsDist: base.data.equals(dist),
  sourceBytesMatchSizeJson: JSON.stringify(Object.keys(size.source_bytes)) === JSON.stringify(modules) &&
    modules.every(name => fs.statSync(path.join(root, 'src', name)).size === size.source_bytes[name]),
  versionMatchesSizeJson: version === size.version,
  ...verdicts(base),
};

// 5. Projet : 'loop.js','schedule.js' juste après 'options.js'.
const at = modules.indexOf('options.js');
if (at < 0 || modules.includes('loop.js') || modules.includes('schedule.js')) throw new Error('liste de build.py inattendue : ' + modules.join(', '));
const projected = [...modules.slice(0, at + 1), 'loop.js', 'schedule.js', ...modules.slice(at + 1)];
const proj = assemble(projected);
const loopBytes = fs.statSync(path.join(root, 'src/loop.js')).size, scheduleBytes = fs.statSync(path.join(root, 'src/schedule.js')).size;
const delta = proj.data.length - base.data.length, gzipBytes = zlib.gzipSync(proj.data, {level: 9}).length;
let syntaxOk = true, syntaxError = null;
try { new vm.Script(proj.code, {filename: 'page-projetee.js'}); } catch (e) { syntaxOk = false; syntaxError = String(e); }
const context = vm.createContext({window: {}}), contextKeys = Object.keys(context);
vm.runInContext(readText('src/loop.js') + SEP + readText('src/schedule.js'), context);
const globalsOk = typeof context.window.FLoop?.create === 'function' && typeof context.window.FSchedule?.create === 'function';
const projInfo = {
  modules: projected, loopBytes, scheduleBytes,
  projectedHtmlBytes: proj.data.length, sha256: sha256(proj.data),
  delta, expectedDelta: loopBytes + scheduleBytes + 6, deltaOk: delta === loopBytes + scheduleBytes + 6,
  marginBytes: BUDGET - proj.data.length, underBudget: proj.data.length < BUDGET,
  gzipBytes, gzipDeltaNode: gzipBytes - baseInfo.gzipBytesNode,
  ...verdicts(proj),
  syntaxOk, syntaxError, globalsOk,
  windowKeys: Object.keys(context.window),                 // ce que les deux modules posent sur window
  contextKeysAdded: Object.keys(context).filter(key => !contextKeys.includes(key)),
};
const patternsCopied = PATTERNS.every(([, re]) => buildTest.includes(String(re)));
const checks = {
  baseReproduced: baseInfo.reproduced && baseInfo.equalsDist,
  deltaOk: projInfo.deltaOk, underBudget: projInfo.underBudget,
  noClosingScript: !projInfo.closingScriptInCode,
  noForbiddenPattern: !Object.values(projInfo.patterns).some(Boolean),
  patternsCopiedVerbatim: patternsCopied,
  placeholdersResolved: !projInfo.placeholdersLeft,
  syntaxOk, globalsOk,
  onlyTwoGlobals: JSON.stringify(projInfo.windowKeys) === '["FLoop","FSchedule"]' && !projInfo.contextKeysAdded.length,
  carriageReturns: [...withCR],
};
const report = {
  schema: 'boucle-assemblage-v1',
  node: process.version,
  arch: process.arch,
  platform: process.platform,
  cpu: os.cpus()[0].model,
  loadavg: os.loadavg(),
  budgetBytes: BUDGET,
  version,
  buildModules: modules,
  base: baseInfo,
  project: projInfo,
  checks,
  note: "gzip : zlib de Node, à titre indicatif ; gzip_bytes de SIZE.json vient du zlib de Python et ne se compare pas. Seul l'écart entre base et projet, mesuré avec le même zlib, a un sens.",
};
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, 'assemblage.json'), JSON.stringify(report, null, 2) + '\n');
const n = x => x.toLocaleString('fr-FR');
console.log('base : ' + n(baseInfo.htmlBytes) + ' octets, sha256 ' + baseInfo.sha256.slice(0, 8) + '… ; ' +
  (baseInfo.reproduced ? 'SIZE.json reproduit' : 'ÉCART avec SIZE.json (' + n(size.html_bytes) + ' octets, ' + size.sha256.slice(0, 8) + '…) : sources modifiées sans reconstruction ?') +
  (baseInfo.equalsDist ? ', identique à dist/index.html' : ', DIFFÉRENT de dist/index.html'));
console.log('projet : ' + n(projInfo.projectedHtmlBytes) + ' octets, delta ' + n(delta) + ' = ' + n(loopBytes) + ' + ' + n(scheduleBytes) + ' + 6 : ' + (projInfo.deltaOk ? 'ok' : 'ÉCART') +
  ' ; marge ' + n(projInfo.marginBytes) + ' sous ' + n(BUDGET) + ' ; gzip (Node, indicatif) ' + n(gzipBytes) + ' (' + (projInfo.gzipDeltaNode >= 0 ? '+' : '') + n(projInfo.gzipDeltaNode) + ')');
const ok = checks.deltaOk && checks.underBudget && checks.noClosingScript && checks.noForbiddenPattern && checks.patternsCopiedVerbatim &&
  checks.placeholdersResolved && syntaxOk && globalsOk && checks.onlyTwoGlobals;
console.log('bilan : ' + (ok ? 'ok' : 'ÉCART') + ' — syntaxOk ' + syntaxOk + ', globalsOk ' + globalsOk + ', </script ' + (checks.noClosingScript ? 'absent' : 'PRÉSENT') +
  ', motifs de build.test ' + (checks.noForbiddenPattern ? 'absents' : 'PRÉSENTS') + (patternsCopied ? '' : ' (expressions à recopier : build.test a changé)'));
if (!ok) process.exit(1);
