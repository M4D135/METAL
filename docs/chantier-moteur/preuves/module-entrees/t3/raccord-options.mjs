// Module entrées, étape 3 : essai en mémoire du raccord de src/options.js décrit au §4.2 du document.
// Rien n'est écrit dans le dépôt. Le script recopie src/options.js dans <dossier> en y faisant déléguer la table,
// normalize, assign et keyName à FInput (table METAL de checks/finput-fixture.mjs, prefs.bindings gardé pour le
// clavier, prefs.input = {v, pad, tune} en plus), le place derrière src/input.js comme le ferait tools/build.py,
// puis lance checks/options.test.mjs sur cette copie : une fois tel quel, une fois avec la seule adaptation
// prévue (Interagir sur G au lieu de R, devenu l'esquive en v2, lignes 18 à 21).
//   node docs/chantier-moteur/preuves/module-entrees/t3/raccord-options.mjs <dossier de travail, hors du dépôt> [racine]
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const work = process.argv[2], repo = process.argv[3] || new URL('../../../../../', import.meta.url).pathname;
if (!work) { console.error('usage : node raccord-options.mjs <dossier de travail, hors du dépôt> [racine]'); process.exit(2); }
const {METAL_INPUT: M} = await import(new URL('checks/finput-fixture.mjs', 'file://' + repo + '/').href);
const input = readFileSync(repo + '/src/input.js', 'utf8'), options = readFileSync(repo + '/src/options.js', 'utf8');
// Each edit replaces a text found exactly once in src/options.js.
const once = (text, a, b) => { if (text.split(a).length !== 2) throw new Error('ancre introuvable ou répétée : ' + String(a).slice(0, 60)); return text.split(a).join(b); };
const lineOf = (text, start) => { const i = text.indexOf(start); if (i < 0 || text.indexOf(start, i + 1) >= 0) throw new Error('ligne introuvable : ' + start); return text.slice(i, text.indexOf('\n', i)); };
const declaration = JSON.stringify({...M, migrate: undefined});
let shim = options;
shim = once(shim, lineOf(shim, '  const actions=[['), "  const I=window.FInput,inputConfig=" + declaration + ";inputConfig.migrate=({" + M.migrate.toString() + "}).migrate;\n" +
  "  const actions=inputConfig.actions.map(a=>[a.id,a.label,a.keys]);\n" +
  "  const inputPart=s=>{const t={...s.tune};delete t.sensitivity;delete t.invertY;return {v:s.v,pad:s.pad,tune:t};};");
shim = once(shim, 'bindings:Object.fromEntries(actions.map(([id,,codes])=>[id,codes.slice()]))};}', 'bindings:I.defaults(inputConfig).keys,input:inputPart(I.defaults(inputConfig))};}');
const start = shim.indexOf("    if(v.bindings&&typeof v.bindings==='object'){"), end = shim.indexOf('    return out;\n  }\n  function assign');
if (start < 0 || end < start) throw new Error('bloc des liaisons de normalize introuvable');
shim = shim.slice(0, start) + "    const i=v.input&&typeof v.input==='object'&&!Array.isArray(v.input)?v.input:{},t=i.tune&&typeof i.tune==='object'?i.tune:{};\n" +
  "    const s=I.normalize({v:i.v??1,keys:v.bindings,pad:i.pad,tune:{...t,sensitivity:out.sensitivity,invertY:out.invertY}},inputConfig);\n" +
  "    out.bindings=s.keys;out.input=inputPart(s);\n" + shim.slice(end);
const a0 = shim.indexOf('  function assign(bindings,action,code){'), a1 = shim.indexOf('  function keyName(code)');
if (a0 < 0 || a1 < a0) throw new Error('assign introuvable');
shim = shim.slice(0, a0) + "  function assign(bindings,action,code){\n    const r=I.assign(inputConfig,{v:2,keys:bindings},'keyboard',action,code);\n" +
  "    return r.ok?{ok:true,bindings:r.settings.keys}:{ok:false,reason:r.reason,conflict:r.conflict};\n  }\n" + shim.slice(a1);
shim = once(shim, lineOf(shim, '  function keyName(code)'), '  function keyName(code){return I.keyName(code);}');
mkdirSync(work + '/src', {recursive: true}); mkdirSync(work + '/checks', {recursive: true});
writeFileSync(work + '/src/options.js', input + '\n;\n' + shim);
const test = readFileSync(repo + '/checks/options.test.mjs', 'utf8');
const runs = [['tel quel', test], ['Interagir sur G (lignes 18 à 21)', test.split("'KeyR'").join("'KeyG'")]].map(([name, text]) => {
  writeFileSync(work + '/checks/options.test.mjs', text);
  const out = work + '/rapport.txt', r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-reporter-destination=' + out, work + '/checks/options.test.mjs'], {encoding: 'utf8'});
  const report = readFileSync(out, 'utf8'), count = k => Number((report.match(new RegExp('^ℹ ' + k + ' (\\d+)', 'm')) || [])[1]);
  return {essai: name, statut: r.status, tests: count('tests'), reussis: count('pass'), echecs: count('fail'),
    echoues: [...new Set((report.match(/^✖ .+$/gm) || []).map(l => l.slice(2).replace(/ \([\d.]+ms\)$/, '')))].filter(l => l !== 'failing tests:')};
});
// What the delegated FOptions now answers for a v1 profile kept by today's game (Space on the dodge).
const ctx = {window: {}}, vm = await import('node:vm'); vm.createContext(ctx); vm.runInContext(input + '\n;\n' + shim, ctx);
const O = ctx.window.FOptions, today = vm.createContext({window: {}}); vm.runInContext(options, today);
const v1 = JSON.parse(JSON.stringify(today.window.FOptions.defaults(false))), n = O.normalize(v1, false);
const v2 = O.normalize({...v1, input: {v: 2, tune: {padYaw: 420, sensitivity: 3}}}, false);
const profil = {dash: n.bindings.dash, jump: n.bindings.jump, inputV: n.input.v, sauvegardeRelue: JSON.stringify(O.normalize(JSON.parse(JSON.stringify(n)), false)) === JSON.stringify(n),
  padYawGarde: v2.input.tune.padYaw, sensibiliteHorsDeInput: !('sensitivity' in v2.input.tune) && v2.sensitivity === 1, v2NonMigre: v2.bindings.dash, actions: O.actions.length};
console.log(JSON.stringify({tool: 'raccord-options.mjs', node: process.version, octetsOptionsDelegue: Buffer.byteLength(shim), runs, profilV1: profil}, null, 1));
process.exitCode = runs[1].echecs === 0 && runs[0].echecs === 1 ? 0 : 1;
