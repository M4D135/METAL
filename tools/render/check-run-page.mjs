#!/usr/bin/env node
// Self-check of run-page.mjs and of the R1b additions to chrome.mjs (lot 00 / R1b): GPU flags
// under Linux, METAL_RENDER_ANGLE, page paths followed by ?query/#fragment, markers, envelope,
// captures, exit codes and cleanup. Outside npm test: `node tools/render/check-run-page.mjs`.
//   --out FILE          also write the JSON report to FILE (it is always printed on stdout)
//   --self-check FILE   report of tools/render/self-check.mjs made on this machine: the probe
//                       images rendered through run-page must carry its fingerprints
//   --chrome-path P     Chrome executable, passed to run-page
//   --angle A           ANGLE back end, passed to run-page (default: METAL_RENDER_ANGLE, then
//                       the platform's)
//   --no-chrome         checks without a browser only
// Exit code 0 when every check passes, 1 otherwise. A short summary goes to stderr.
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import * as chrome from './chrome.mjs';
import * as rp from './run-page.mjs';
import {decodePNG, encodePNG, flipRows, imageSha256} from './png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'pages', 'dump-fixture.html');
const PROBE = join(HERE, 'pages', 'probe.html');
const FIXTURE_TEXT = 'a < b && c > d "quoted" \'single\' é nbsp ✓ &amp;';
// Scenes of self-check.mjs (same parameters, same fingerprints on one machine).
const SCENES = [
  ['legacy-1.5', 'probe.render("legacy", {seed: 1.5})'],
  ['legacy-2.5', 'probe.render("legacy", {seed: 2.5})'],
  ['scene3d', 'probe.render("scene3d", {})'],
  ['scene3d-wide', 'probe.render("scene3d", {"width":640,"height":360,"seed":11,"eye":[-18,6,14],"target":[2,2,-3],"fov":70})'],
  ['canvas2d', 'probe.render("canvas2d", {})'],
];
// chromeArgs() of R1 (be917f8) under macOS: R1b must not change a single flag there.
const R1_DARWIN_ARGS = ['--headless=new', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-sync',
  '--metrics-recording-only', '--disable-domain-reliability', '--host-resolver-rules=MAP * ~NOTFOUND',
  '--disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--mute-audio', '--user-data-dir=/profil', '--use-angle=metal', '--window-size=800,600', '--force-device-scale-factor=1'];

function parseArgs(argv) {
  const out = {chrome: true};
  const keys = {'--out': 'out', '--self-check': 'selfCheck', '--chrome-path': 'chromePath', '--angle': 'angle'};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--no-chrome') { out.chrome = false; continue; }
    const key = keys[argv[i]];
    if (!key || i + 1 >= argv.length) throw new Error(`Unknown or incomplete option: ${argv[i]}`);
    out[key] = argv[++i];
  }
  // Read before any Chrome is launched: a wrong path is a usage error, not a failed check.
  if (out.selfCheck) {
    let fingerprints;
    try { fingerprints = JSON.parse(readFileSync(out.selfCheck, 'utf8')).fingerprints; } catch (error) { throw new Error(`--self-check ${out.selfCheck}: ${error.message}`); }
    if (!fingerprints || typeof fingerprints !== 'object') throw new Error(`--self-check ${out.selfCheck}: no fingerprints (self-check.mjs report expected)`);
    out.selfCheckFingerprints = fingerprints;
  }
  return out;
}

const checks = [];
function check(name, ok, detail) {
  checks.push(detail === undefined ? {name, ok: !!ok} : {name, ok: !!ok, detail});
  if (!ok) process.stderr.write(`ÉCHEC ${name}${detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 1500)}\n`);
  return !!ok;
}
async function guarded(name, fn) {
  try { return await fn(); } catch (error) { check(name, false, String(error && error.stack || error)); return undefined; }
}
const throwsWith = (fn, test) => { try { fn(); return false; } catch (error) { return test(error); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- Without a browser ----
function launcherChecks(work) {
  const flags = [
    [chrome.gpuFlags('vulkan', 'linux'), ['--use-gl=angle', '--use-angle=vulkan']],
    [chrome.gpuFlags('swiftshader', 'linux'), ['--use-gl=angle', '--use-angle=swiftshader']],
    [chrome.gpuFlags(null, 'linux'), []],
    [chrome.gpuFlags('metal', 'darwin'), ['--use-angle=metal']],
    [chrome.gpuFlags('d3d11', 'win32'), ['--use-angle=d3d11']],
  ];
  check('gpuFlags.platforms', flags.every(([got, want]) => same(got, want)), flags.map(([got]) => got));
  const env = value => ({[chrome.ANGLE_ENV]: value});
  const angles = [
    [chrome.defaultAngle('darwin', {}), 'metal'], [chrome.defaultAngle('win32', {}), 'd3d11'], [chrome.defaultAngle('linux', {}), null],
    [chrome.defaultAngle('linux', env('vulkan')), 'vulkan'], [chrome.defaultAngle('darwin', env('swiftshader')), 'swiftshader'],
    [chrome.defaultAngle('darwin', env('none')), null], [chrome.defaultAngle('linux', env('')), null], [chrome.defaultAngle('darwin', env('')), 'metal'],
  ];
  check('defaultAngle.env', angles.every(([got, want]) => got === want), angles.map(([got]) => got));
  const o = options => chrome.normalizeOptions({chromePath: '/chrome', ...options});
  const sources = [
    [o({platform: 'linux', env: {}}), null, 'platform'], [o({platform: 'linux', env: env('vulkan')}), 'vulkan', chrome.ANGLE_ENV],
    [o({platform: 'linux', env: env('vulkan'), angle: 'none'}), null, 'option'], [o({platform: 'darwin', env: env('vulkan'), angle: 'metal'}), 'metal', 'option'],
    [o({platform: 'darwin', env: {}}), 'metal', 'platform'],
  ];
  check('normalizeOptions.angleSource', sources.every(([got, angle, source]) => got.angle === angle && got.angleSource === source), sources.map(([got]) => [got.angle, got.angleSource]));
  check('normalizeOptions.badEnvAngle', throwsWith(() => o({platform: 'linux', env: env('Vulkan;rm')}), error => error instanceof RangeError && error.message.includes(chrome.ANGLE_ENV)));
  const darwin = chrome.chromeArgs(o({platform: 'darwin', env: {}}), '/profil');
  check('chromeArgs.darwinUnchangedSinceR1', same(darwin, R1_DARWIN_ARGS), darwin);
  const linux = chrome.chromeArgs(o({platform: 'linux', env: env('vulkan')}), '/profil'), at = linux.indexOf('--use-gl=angle');
  const linuxDefault = chrome.chromeArgs(o({platform: 'linux', env: {}}), '/profil');
  check('chromeArgs.linux', at > 0 && linux[at + 1] === '--use-angle=vulkan' && linux.filter(a => /^--use-(gl|angle)/.test(a)).length === 2
    && !linuxDefault.some(a => /^--use-(gl|angle)/.test(a)) && same(linuxDefault.filter(a => !/^--use-/.test(a)), darwin.filter(a => !/^--use-/.test(a))), {linux, linuxDefault});
  const deep = '/home/x/' + 'd'.repeat(58), fits = '/home/x/' + 'd'.repeat(58 - 1); // 66 and 65 characters
  check('singletonSocketProblem', chrome.singletonSocketProblem('/usr/bin/google-chrome', {TMPDIR: deep + 'e'}, 'linux')?.includes('TMPDIR too long')
    && chrome.singletonSocketProblem('/usr/bin/google-chrome', {TMPDIR: deep}, 'linux') === null
    && chrome.singletonSocketProblem('/usr/bin/google-chrome', {TMPDIR: deep + '/'}, 'linux') === null
    && chrome.singletonSocketProblem('/usr/bin/chromium', {TMPDIR: fits}, 'linux') !== null
    && chrome.singletonSocketProblem('/usr/bin/google-chrome', {}, 'linux') === null
    && chrome.singletonSocketProblem('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', {TMPDIR: deep + 'e'.repeat(40)}, 'darwin') === null);
  check('defaultChromePath.env', chrome.defaultChromePath({CHROME_PATH: '/opt/x/chrome'}, 'linux') === '/opt/x/chrome'
    && chrome.defaultChromePath({}, 'darwin') === '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    && ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].includes(chrome.defaultChromePath({}, 'linux')));

  const refusals = {'--remote-debugging-port=9222': 'port', '--remote-debugging-address=0.0.0.0': 'port', '--remote-allow-origins=*': 'port',
    '--allow-file-access-from-files': 'file-access', '--allow-file-access': 'file-access', '--disable-web-security': 'file-access',
    '--use-gl=egl': 'gpu', '--use-angle=gl': 'gpu', '--proxy-server=x:1': 'network', '--host-resolver-rules=MAP * 127.0.0.1': 'network',
    '--user-data-dir=/x': 'owned', '--headless=old': 'owned', '--window-size=1,1': 'owned', 'nope': 'syntax'};
  const got = Object.fromEntries(Object.keys(refusals).map(arg => [arg, chrome.chromeArgRefusal(arg)?.code ?? null]));
  check('chromeArgRefusal.codes', same(got, refusals) && chrome.chromeArgRefusal('--enable-unsafe-swiftshader') === null && chrome.chromeArgRefusal('--use-angle') !== null, got);
  check('normalizeOptions.refusesFlag', throwsWith(() => o({extraArgs: ['--remote-debugging-port=0']}), error => error.code === 'REFUSED_ARGUMENT' && error.refusal === 'port'));

  // Page URLs: a bare path followed by ?query and #fragment, as the audit's run2.sh pages take them.
  const href = pathToFileURL(FIXTURE).href;
  const urls = [
    [chrome.pageUrl(`${FIXTURE}#shots`), `${href}#shots`],
    [chrome.pageUrl(`${FIXTURE}#mode,a,b`), `${href}#mode,a,b`],
    [chrome.pageUrl(`${FIXTURE}?x=1#m`), `${href}?x=1#m`],
    [chrome.pageUrl(`${FIXTURE}?x=1`, {y: 2}), `${href}?x=1&y=2`],
    [chrome.pageUrl(`${FIXTURE}#a`, null, 'b,c'), `${href}#b,c`],
    [chrome.pageUrl(FIXTURE, null, '#d'), `${href}#d`],
    [chrome.pageUrl(`${href}#e`), `${href}#e`],
    [chrome.pageUrl('about:blank'), 'about:blank'],
  ];
  check('pageUrl.fragment', urls.every(([got, want]) => got === want), urls.map(([got]) => got));
  const hashFile = join(work, 'page#1.html');
  writeFileSync(hashFile, '<!doctype html>');
  check('pageUrl.hashInFileName', chrome.pageUrl(hashFile) === pathToFileURL(hashFile).href && chrome.pageUrl(hashFile).includes('%23'), chrome.pageUrl(hashFile));
  const codes = ['https://example.com/', 'http://127.0.0.1/x.html', 'about:config', `${join(work, 'absent.html')}#x`, `${FIXTURE}x#y`]
    .map(target => { try { chrome.pageUrl(target); return null; } catch (error) { return error.code; } });
  check('pageUrl.refusals', same(codes, ['NOT_FILE_URL', 'NOT_FILE_URL', 'NOT_FILE_URL', 'PAGE_NOT_FOUND', 'PAGE_NOT_FOUND']), codes);

  // Chrome's single-instance folder (killed Chrome): found through the profile, removed only when
  // it holds nothing but Singleton* entries.
  const profile = join(work, 'metal-render-1-abcdef'), single = join(work, 'com.google.Chrome.Ab12Cd'), other = join(work, 'com.google.Chrome.Zz98Yy');
  for (const dir of [profile, single, other]) mkdirSync(dir);
  writeFileSync(join(single, 'SingletonSocket'), '');
  writeFileSync(join(other, 'SingletonSocket'), '');
  writeFileSync(join(other, 'autre-chose'), '');
  symlinkSync(join(single, 'SingletonSocket'), join(profile, 'SingletonSocket'));
  const found = chrome.singletonDir(profile), removed = chrome.removeSingletonDir(found), kept = chrome.removeSingletonDir(other);
  const strange = join(work, 'metal-render-1-ghijkl'), weird = join(work, 'pas-un-dossier-de-chrome');
  mkdirSync(strange); mkdirSync(weird);
  symlinkSync(join(weird, 'SingletonSocket'), join(strange, 'SingletonSocket'));
  check('singletonDir.cleanup', found === single && removed && !existsSync(single) && !kept && existsSync(other)
    && chrome.singletonDir(strange) === null && chrome.singletonDir(join(work, 'absent')) === null && chrome.removeSingletonDir(join(work, 'absent')) === true,
  {found, removed, kept});
}

function runPageChecks(work) {
  const usage = argv => { try { rp.parseArgs(argv); return null; } catch (error) { return error instanceof rp.UsageError ? 'usage' : `other: ${error.message}`; } };
  const page = FIXTURE;
  const refused = [
    ['--allow-file-access-from-files', page], [page, '--chrome-arg=--allow-file-access-from-files'], [page, '--remote-debugging-port=9222'],
    [page, '--chrome-arg', '--remote-debugging-port=0'], [page, '--chrome-arg=--use-gl=egl'], ['https://example.com/'], ['http://localhost/x.html'],
    [], [page, page], [page, '--mode', 'dump', '--wait', '1'], [page, '--mode', 'dump', '--console'], [page, '--wait', '1', '--budget', '10'],
    [page, '--image', 'x'], [page, '--image', 'a=1', '--image', 'a=2'], [page, '--arg', '1'], [page, '--text', '--png-dir', work], [page, '--unknown'],
    [page, '--marker', '1x'], [page, '--mode', 'other'], [page, '--call', 'f', '--arg', '{bad'], [page, '--dpr', '0'], [page, '--timeout', '-1'],
    [page, '--window', '5x5'], [page, '--angle', 'Metal'], [page, '--text=1'], [`${join(work, 'absent.html')}#x`],
  ];
  const results = refused.map(argv => usage(argv));
  check('parseArgs.usageErrors', results.every(r => r === 'usage'), refused.map((argv, i) => [argv.join(' ').replace(HERE, '…'), results[i]]).filter(([, r]) => r !== 'usage'));
  const a = rp.parseArgs([`${page}?x=1#shots,aube`, '--query', 'y=2&z=3']);
  const b = rp.parseArgs([page, '--wait', 'true', '--hash', 'late,5', '--window', '1600,900', '--dpr', '2', '--timeout', '1000']);
  const c = rp.parseArgs([page, '--image', 'i:top-left=probe.render("canvas2d", {})', '--png-dir', work]);
  const href = pathToFileURL(page).href;
  check('parseArgs.defaults', a.mode === 'dump' && a.url === `${href}?x=1&y=2&z=3#shots,aube` && a.chrome.width === 1440 && a.chrome.height === 932 && a.chrome.dpr === 1 && a.timeoutMs === 270000
    && b.mode === 'cdp' && b.url === `${href}#late,5` && b.chrome.width === 1600 && b.chrome.height === 900 && b.chrome.dpr === 2 && b.timeoutMs === 1000
    && c.mode === 'cdp' && c.images[0].id === 'i' && c.images[0].origin === 'top-left' && c.images[0].expression === 'probe.render("canvas2d", {})',
  {a: [a.mode, a.url], b: [b.mode, b.url], c: c.images});
  check('help.exitZero', rp.parseArgs(['--help']).help === true && rp.USAGE.includes('--png-dir') && rp.USAGE.includes('--marker'));

  // Markers: priority rgpu-out, vout, out; last <pre> of the chosen id; entities; data-id is not id.
  const dom = '<html><body><pre id="out">{"o":1}</pre><pre data-id="vout">x</pre><pre class="a" id="vout">{"v":&quot;&amp;&lt;&gt;&nbsp;&#233;&#x2713;"}</pre>'
    + '<pre id="vout">{"v":2,"t":"a &amp;amp; b"}</pre></body></html>';
  const m1 = rp.extractMarker(dom), m2 = rp.extractMarker(dom, ['out']), m3 = rp.extractMarker(dom, ['rgpu-out']), m4 = rp.extractMarker('<pre id="rgpu-out"></pre><pre id="out">1</pre>');
  check('extractMarker.choice', m1?.id === 'vout' && m1.text === '{"v":2,"t":"a &amp; b"}' && m2?.text === '{"o":1}' && m3 === null && m4?.id === 'rgpu-out' && m4.text === '' && m4.closed,
    {m1, m2, m3, m4});
  check('unescapeHtml.entities', rp.unescapeHtml('&quot;&amp;&lt;&gt;&nbsp;&#233;&#x2713;&apos;&amp;amp;&unknown;') === '"&<> é✓\'&amp;&unknown;');
  const e1 = rp.unwrapEnvelope('xx@@JSON@@{"a":1}@@END@@yy'), e2 = rp.unwrapEnvelope('{"a":1}');
  check('unwrapEnvelope', e1.envelope && e1.text === '{"a":1}' && !e2.envelope && e2.text === '{"a":1}'
    && throwsWith(() => rp.unwrapEnvelope('@@JSON@@{"a"'), error => error instanceof rp.ResultError), {e1, e2});
  check('interpret', rp.interpret('@@JSON@@[1]@@END@@').value[0] === 1 && rp.interpret('pas du JSON', {raw: true}).value === 'pas du JSON'
    && throwsWith(() => rp.interpret('pas du JSON'), error => error instanceof rp.ResultError));
  // Captures: written as files, names made safe, removed from the result; other values skipped.
  const png = encodePNG({width: 1, height: 1, data: Buffer.from([10, 20, 30, 255])});
  const value = {keep: 1, shots: {'a/../b': `data:image/png;base64,${png.toString('base64')}`, 'A/../B': `data:image/png;base64,${png.toString('base64')}`, txt: 'data:text/plain;base64,aGk=', n: 3}};
  const dir = join(work, 'shots'), shots = rp.extractShots(value, dir);
  const files = readdirSync(dir).sort();
  // 'A/../B' and 'a/../b' differ only by case: two files, also on a case-insensitive disk.
  check('extractShots', same(Object.keys(value), ['keep']) && shots.length === 4 && same(files, ['A_.._B-2.png', 'a_.._b.png'])
    && shots.filter(s => s.file).every(s => s.width === 1 && s.height === 1 && s.file.startsWith(dir) && /^[0-9a-f]{64}$/.test(s.pixelsSha256))
    && shots.filter(s => s.skipped).length === 2 && rp.extractShots({x: 1}, dir) === null, {files, shots: shots.map(s => ({...s, file: s.file && s.file.slice(dir.length)}))});
}

// ---- With Chrome: run-page as a command, each run in a private temporary folder ----
function runCli(args, {env, timeoutMs = 120000, metaFile} = {}) {
  return new Promise(done => {
    const t0 = performance.now();
    const child = spawn(process.execPath, [rp.RUN_PAGE, ...args, ...(metaFile ? ['--meta', metaFile] : [])], {env, stdio: ['ignore', 'pipe', 'pipe']});
    const out = [], err = [];
    child.stdout.on('data', chunk => out.push(chunk));
    child.stderr.on('data', chunk => err.push(chunk));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      let meta = null;
      if (metaFile && existsSync(metaFile)) try { meta = JSON.parse(readFileSync(metaFile, 'utf8')); } catch {}
      done({code, signal, pid: child.pid, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), meta, ms: Math.round(performance.now() - t0)});
    });
  });
}

async function chromeChecks(args, work, report) {
  // Short, next to the work folder: under Linux, TMPDIR/com.google.Chrome.XXXXXX/SingletonSocket
  // must fit in 107 characters (singletonSocketProblem).
  const childTmp = report.childTmp = mkdtempSync(join(tmpdir(), 'rp-'));
  try { await runChromeChecks(args, work, report, childTmp); } finally { rmSync(childTmp, {recursive: true, force: true, maxRetries: 3}); }
}

async function runChromeChecks(args, work, report, childTmp) {
  // Profiles go to the child's TMPDIR; under Linux, Chrome's single-instance folder too.
  const env = {...process.env, TMPDIR: childTmp};
  // First, so that a run's own --timeout wins (the last value of an option is kept).
  const common = [...(args.chromePath ? ['--chrome-path', args.chromePath] : []), ...(args.angle ? ['--angle', args.angle] : []), '--timeout', '60000'];
  const runs = report.runs = {};
  let n = 0;
  const run = async (name, argv, options = {}) => {
    const metaFile = join(work, `meta-${++n}.json`);
    const result = await runCli([...common, ...argv], {env, metaFile, ...options});
    runs[name] = {argv: argv.map(a => a.replace(HERE, '<tools/render>').replace(work, '<travail>')), code: result.code, ms: result.ms,
      failure: result.meta?.failure ?? null, cleanup: result.meta?.cleanup ?? null, stderrTail: result.code === 0 ? undefined : result.stderr.trim().split('\n').slice(-3).join('\n')};
    if (result.meta) {
      const pid = result.pid;
      const left = readdirSync(childTmp).filter(name => name.startsWith(`${chrome.PROFILE_PREFIX}${pid}-`));
      const singleton = result.meta.cleanup?.singletonDir;
      check(`${name}.cleanup`, result.meta.cleanup && result.meta.cleanup.profilesLeft.length === 0 && result.meta.cleanup.profileRemoved !== false && !left.length
        && (!singleton || (singleton.removed && !existsSync(singleton.path))), {cleanup: result.meta.cleanup, left});
    }
    return result;
  };
  const fixture = (suffix = '') => `${FIXTURE}${suffix}`;
  const json = text => { try { return JSON.parse(text); } catch { return null; } };

  const sync = await run('dump.sync', [fixture('#sync')]);
  const syncValue = json(sync.stdout);
  check('dump.sync', sync.code === 0 && syncValue?.fixture === 'metal-run-page-fixture-v1' && syncValue.mode === 'sync' && syncValue.text === FIXTURE_TEXT
    && same(syncValue.errors, []) && sync.meta?.marker?.id === 'out' && sync.meta?.result?.envelope === false && Object.keys(syncValue.shots || {}).length === 3,
  {code: sync.code, text: syncValue?.text, marker: sync.meta?.marker});
  // GPU flags actually given to Chrome: those of the platform (or of METAL_RENDER_ANGLE / --angle).
  const expected = chrome.gpuFlags(chrome.normalizeOptions({angle: args.angle, chromePath: args.chromePath}).angle);
  const given = (sync.meta?.chrome?.args || []).filter(a => /^--use-(gl|angle)/.test(a));
  check('dump.gpuFlags', same(given, expected) && same(sync.meta?.tool?.gpuFlags, expected), {given, expected});

  const pngDir = join(work, 'png-dump');
  const envl = await run('dump.envelope', [fixture('?envelope=1#sync,a,b'), '--png-dir', pngDir]);
  const envValue = json(envl.stdout), shots = envl.meta?.shots || [];
  const written = existsSync(pngDir) ? readdirSync(pngDir).sort() : [];
  check('dump.envelope', envl.code === 0 && envl.meta?.result?.envelope === true && same(envValue?.args, ['a', 'b']) && envValue?.query?.envelope === '1' && !('shots' in (envValue || {}))
    && shots.filter(s => s.file).length === 2 && shots.filter(s => s.skipped).length === 1 && written.length === 2 && written.every(name => /^[\w.-]+\.png$/.test(name)),
  {code: envl.code, written, shots: shots.map(s => ({name: s.name, sha256: s.sha256, pixelsSha256: s.pixelsSha256, skipped: s.skipped}))});
  const dumpPixels = Object.fromEntries(shots.filter(s => s.file).map(s => [s.name, s.pixelsSha256]));
  for (const s of shots.filter(s => s.file)) check(`dump.envelope.png.${s.name.replace(/\W+/g, '_')}`, imageSha256(decodePNG(readFileSync(s.file))) === s.pixelsSha256);

  const vout = await run('dump.vout', [fixture('?marker=vout#sync')]);
  const rgpu = await run('dump.rgpuOut', [fixture('?marker=rgpu-out#sync')]);
  const decoy = await run('dump.markerOption', [fixture('?marker=vout#sync'), '--marker', 'out']);
  check('dump.markers', vout.code === 0 && vout.meta?.marker?.id === 'vout' && json(vout.stdout)?.query?.marker === 'vout'
    && rgpu.code === 0 && rgpu.meta?.marker?.id === 'rgpu-out' && decoy.code === 0 && decoy.stdout === '{"decoy":true}',
  {vout: vout.meta?.marker, rgpu: rgpu.meta?.marker, decoy: decoy.stdout.slice(0, 40)});

  const never = await run('dump.never', [fixture('#never')]);
  const text = await run('dump.notJson', [fixture('#text')]);
  const raw = await run('dump.text', [fixture('#text'), '--text']);
  check('dump.exitCodes', never.code === 1 && /vide/.test(never.meta?.failure || '') && text.code === 1 && /JSON/.test(text.meta?.failure || '')
    && raw.code === 0 && raw.stdout === 'texte brut <&> sans JSON', {never: never.meta?.failure, text: text.meta?.failure, raw: raw.stdout});
  const lateDump = await run('dump.late', [fixture('#late,300')]);
  const lateBudget = await run('dump.lateBudget', [fixture('#late,300'), '--budget', '3000']);
  const lateCdp = await run('cdp.late', [fixture('#late,300'), '--mode', 'cdp']);
  check('late.result', lateDump.code === 1 && lateBudget.code === 0 && json(lateBudget.stdout)?.mode === 'late' && lateCdp.code === 0 && json(lateCdp.stdout)?.mode === 'late'
    && lateCdp.meta?.wait?.polls >= 2, {dump: lateDump.code, budget: lateBudget.code, cdp: lateCdp.code, polls: lateCdp.meta?.wait?.polls});
  const thrown = await run('dump.pageError', [fixture('#throw')]);
  check('dump.pageError', thrown.code === 0 && thrown.meta?.result?.pageErrors === 1 && /exception volontaire/.test(json(thrown.stdout)?.errors?.[0] || ''), thrown.meta?.result);

  // cdp: the marker read from the DOM equals the dump, byte for byte (entities decoded right).
  const cdpSync = await run('cdp.sync', [fixture('#sync'), '--mode', 'cdp']);
  check('cdp.sameAsDump', cdpSync.code === 0 && cdpSync.stdout === sync.stdout && cdpSync.meta?.marker?.id === 'out', {cdp: cdpSync.stdout.length, dump: sync.stdout.length});
  const pngCdp = join(work, 'png-cdp');
  const called = await run('cdp.call', [fixture('#never'), '--call', 'fixture.configure', '--arg', '{"k":[1,"é"]}', '--arg', '3', '--result', 'fixture.result()', '--png-dir', pngCdp]);
  const calledValue = json(called.stdout);
  const cdpPixels = Object.fromEntries((called.meta?.shots || []).filter(s => s.file).map(s => [s.name, s.pixelsSha256]));
  check('cdp.callResult', called.code === 0 && same(calledValue?.configured, [{k: [1, 'é']}, 3]) && called.meta?.call?.args === 2 && same(cdpPixels, dumpPixels) && Object.keys(cdpPixels).length === 2,
    {code: called.code, configured: calledValue?.configured, cdpPixels, dumpPixels});
  const canvas = `(() => { const c = document.getElementById('c'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height); return {width: d.width, height: d.height, data: d.data, origin: 'top-left'}; })()`;
  const image = await run('cdp.image', [fixture('#sync'), '--image', `canvas=${canvas}`, '--png-dir', join(work, 'png-image')]);
  const canvasSha = image.meta?.images?.canvas?.sha256;
  check('cdp.imageEqualsChromePng', image.code === 0 && canvasSha === dumpPixels['shot b/../x'] && json(image.stdout)?.images?.canvas?.sha256 === canvasSha
    && existsSync(join(work, 'png-image', 'canvas.png')) && imageSha256(decodePNG(readFileSync(join(work, 'png-image', 'canvas.png')))) === canvasSha, {canvasSha, png: dumpPixels['shot b/../x']});
  const waitTimeout = await run('cdp.waitTimeout', [fixture('#never'), '--wait', 'false', '--timeout', '1500']);
  const hung = await run('cdp.hungPromise', [fixture('#never'), '--wait', 'new Promise(() => {})', '--timeout', '2500']);
  const syntax = await run('cdp.syntaxError', [fixture('#sync'), '--wait', 'syntax error (']);
  const undef = await run('cdp.undefinedResult', [fixture('#sync'), '--result', 'undefined']);
  check('cdp.exitCodes', waitTimeout.code === 1 && /délai dépassé/.test(waitTimeout.meta?.failure || '') && hung.code === 1 && /TIMEOUT/.test(hung.meta?.failure || '')
    && syntax.code === 2 && undef.code === 1, {waitTimeout: waitTimeout.meta?.failure, hung: hung.meta?.failure, hungCleanup: hung.meta?.cleanup, syntax: syntax.code, undef: undef.code});
  report.killedChrome = {singletonDir: hung.meta?.cleanup?.singletonDir ?? null, close: hung.meta?.close ?? null};

  for (const [name, argv] of [['refuse.fileAccess', ['--allow-file-access-from-files', fixture()]], ['refuse.port', [fixture(), '--chrome-arg=--remote-debugging-port=9222']],
    ['refuse.https', ['https://example.com/']], ['refuse.http', ['http://localhost:8000/x.html']]]) {
    const result = await runCli([...common, ...argv], {env});
    runs[name] = {argv: argv.map(a => a.replace(HERE, '<tools/render>')), code: result.code, message: result.stderr.trim()};
    check(name, result.code === 2 && /^run-page : (drapeau refusé|seules les pages file:\/\/)/.test(result.stderr) && !result.stdout, result.stderr.trim());
  }

  // The probe through run-page: images by --image (cdp), --wait and --result; then the dump mode.
  const probe = await run('cdp.probe', [PROBE, '--wait', 'typeof probe === "object" && typeof probe.render === "function"', '--result', 'probe.environment()',
    ...SCENES.flatMap(([id, expression]) => ['--image', `${id}=${expression}`]), '--image', `scene3d-again=${SCENES[2][1]}`]);
  const images = probe.meta?.images || {};
  const fingerprints = Object.fromEntries(SCENES.map(([id]) => [id, images[id]?.sha256]));
  report.probe = {fingerprints, renderer: json(probe.stdout)?.webgl2?.unmaskedRenderer ?? null, wait: probe.meta?.wait};
  check('cdp.probe', probe.code === 0 && SCENES.every(([id]) => /^[0-9a-f]{64}$/.test(images[id]?.sha256 || '')) && new Set(Object.values(fingerprints)).size === SCENES.length
    && images['scene3d-again']?.sha256 === images.scene3d?.sha256 && images.canvas2d?.origin === 'top-left' && images.scene3d?.origin === 'bottom-left'
    && !!json(probe.stdout)?.webgl2, {code: probe.code, failure: probe.meta?.failure, fingerprints});
  const dumped = await run('dump.probe', [`${PROBE}?dump=1`, '--text']);
  let dumpImages = null;
  try {
    dumpImages = Object.fromEntries(JSON.parse(Buffer.from(dumped.stdout, 'base64').toString('utf8')).images.map(image => {
      const raw = Buffer.from(image.pixels, 'base64');
      const data = image.origin === 'bottom-left' ? flipRows(raw, image.width, image.height) : raw;
      return [image.scene, imageSha256({width: image.width, height: image.height, data})];
    }));
  } catch (error) { dumpImages = {error: error.message}; }
  check('dump.probeSamePixels', dumped.code === 0 && dumpImages.legacy === fingerprints['legacy-1.5'] && dumpImages.scene3d === fingerprints.scene3d, {dumpImages, fingerprints});
  if (args.selfCheck) {
    const previous = args.selfCheckFingerprints;
    const differences = SCENES.map(([id]) => id).filter(id => previous[id]?.sha256 !== fingerprints[id]);
    report.comparedWith = {file: resolve(args.selfCheck), differences};
    check('cdp.probe.sameAsSelfCheck', Object.keys(previous).length === SCENES.length && !differences.length, report.comparedWith);
  }
  const left = readdirSync(childTmp);
  report.childTmpLeft = left;
  check('cleanup.childTmpEmpty', left.length === 0, left);
}

async function main(args) {
  const started = performance.now();
  const work = mkdtempSync(join(tmpdir(), 'metal-run-page-check-'));
  const resolved = chrome.normalizeOptions({chromePath: args.chromePath, angle: args.angle});
  const report = {schema: 'metal-run-page-check-v1', date: new Date().toISOString(),
    tool: {node: process.version, platform: `${process.platform} ${process.arch}`, chromePath: resolved.chromePath, angle: resolved.angle, angleSource: resolved.angleSource,
      gpuFlags: chrome.gpuFlags(resolved.angle), chrome: args.chrome ? chrome.chromeVersion(resolved.chromePath) : null}};
  try {
    await guarded('launcher', () => launcherChecks(work));
    await guarded('runPage', () => runPageChecks(work));
    if (args.chrome) await guarded('chrome', () => chromeChecks(args, work, report));
  } finally {
    rmSync(work, {recursive: true, force: true, maxRetries: 3});
  }
  report.checks = checks;
  const failed = checks.filter(c => !c.ok).map(c => c.name);
  report.summary = {checks: checks.length, passed: checks.length - failed.length, failed, seconds: Math.round(performance.now() - started) / 1000};
  report.ok = failed.length === 0;
  const text = JSON.stringify(report, null, 2) + '\n';
  if (args.out) { mkdirSync(dirname(resolve(args.out)), {recursive: true}); writeFileSync(args.out, text); }
  process.stdout.write(text);
  const t = report.tool, k = report.killedChrome;
  process.stderr.write([
    `Chrome : ${t.chrome || (args.chrome ? 'n/d' : 'non lancé')} ; drapeaux GPU : ${t.gpuFlags.length ? t.gpuFlags.join(' ') : 'aucun (défaut de Chrome)'} (${t.angleSource}) ; ${t.platform}`,
    ...(report.probe ? [`GPU : ${report.probe.renderer || 'n/d'}`, ...Object.entries(report.probe.fingerprints).map(([id, sha]) => `  ${id} ${sha}`)] : []),
    ...(k ? [`Chrome tué sur délai : dossier d'instance ${k.singletonDir ? `${k.singletonDir.removed ? 'supprimé' : 'RESTANT'} (${k.singletonDir.path})` : 'absent'}`] : []),
    `Contrôles : ${report.summary.passed}/${report.summary.checks}${report.ok ? ' OK' : ' — ÉCHECS : ' + failed.join(', ')} (${report.summary.seconds} s)`,
  ].join('\n') + '\n');
  return report.ok ? 0 : 1;
}

let parsed;
try { parsed = parseArgs(process.argv.slice(2)); } catch (error) { process.stderr.write(`check-run-page : ${error.message}\n`); process.exit(2); }
process.exitCode = await main(parsed);
