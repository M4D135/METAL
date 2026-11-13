#!/usr/bin/env node
// Self-check of the render tools (lot 00 / R1): PNG, image comparison, headless Chrome.
// Outside npm test: `npm run render-check` or `node tools/render/self-check.mjs`.
//   --out FILE        also write the JSON report to FILE (it is always printed on stdout)
//   --png-dir DIR     write the probe renders and the one-pixel difference map as PNG
//   --compare FILE    report of an earlier run: every pixel fingerprint must be identical
//   --chrome-path P   Chrome executable (default: CHROME_PATH, then the platform's Chrome)
//   --angle A         ANGLE back end (default: METAL_RENDER_ANGLE, then metal on macOS, d3d11 on
//                     Windows, Chrome's own default elsewhere; none = flag omitted). Under Linux
//                     --use-gl=angle goes with --use-angle.
//   --no-chrome       PNG and comparison checks only
//   --hold MODE       internal: child process of the signal and crash checks
// Exit code 0 when every check passes, 1 otherwise. A short summary goes to stderr.
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import zlib from 'node:zlib';
import {launch, withChrome, dumpDom, processTree, processAlive, internetSockets, commandLine, defaultChromePath, normalizeOptions, gpuFlags, PROFILE_PREFIX} from './chrome.mjs';
import {encodePNG, decodePNG, writePNG, flipRows, imageSha256, cloneImage, crc32} from './png.mjs';
import {diffImages, diffImage} from './image-diff.mjs';

const SELF = fileURLToPath(import.meta.url);
export const PROBE = join(dirname(SELF), 'pages', 'probe.html');
// Verified prototype (pipe-probe.mjs + page.html of the lot 00 preparation): raw readPixels bytes.
const PROTOTYPE = {seed: 1.5, sourceSha256: '1eb2798a7b431f38f04bd2ff0614ba692a3a2a893a42be448e2057a015f86ffe',
  renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)', product: 'Chrome/157.0.8103.39'};
const SCENES = [
  {id: 'legacy-1.5', scene: 'legacy', params: {seed: 1.5}, origin: 'bottom-left'},
  {id: 'legacy-2.5', scene: 'legacy', params: {seed: 2.5}, origin: 'bottom-left'},
  {id: 'scene3d', scene: 'scene3d', params: {}, origin: 'bottom-left'},
  {id: 'scene3d-wide', scene: 'scene3d', params: {width: 640, height: 360, seed: 11, eye: [-18, 6, 14], target: [2, 2, -3], fov: 70}, origin: 'bottom-left'},
  {id: 'canvas2d', scene: 'canvas2d', params: {}, origin: 'top-left'},
];
const sceneExpression = s => `probe.render(${JSON.stringify(s.scene)}, ${JSON.stringify(s.params)})`;
const delay = ms => new Promise(done => setTimeout(done, ms));
const ownProfiles = () => { try { return readdirSync(tmpdir()).filter(name => name.startsWith(`${PROFILE_PREFIX}${process.pid}-`)); } catch { return []; } };

function parseArgs(argv) {
  const out = {chrome: true};
  const keys = {'--out': 'out', '--png-dir': 'pngDir', '--compare': 'compare', '--chrome-path': 'chromePath', '--angle': 'angle', '--hold': 'hold'};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--no-chrome') { out.chrome = false; continue; }
    const key = keys[argv[i]];
    if (!key || i + 1 >= argv.length) throw new Error(`Unknown or incomplete option: ${argv[i]}`);
    out[key] = argv[++i];
  }
  return out;
}

const checks = [];
function check(name, ok, detail) {
  checks.push(detail === undefined ? {name, ok: !!ok} : {name, ok: !!ok, detail});
  if (!ok) process.stderr.write(`ÉCHEC ${name}${detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 2000)}\n`);
  return !!ok;
}
async function guarded(name, fn) {
  try { return await fn(); } catch (error) { check(name, false, String(error && error.stack || error)); return undefined; }
}

async function waitGone(pid, ms = 3000) {
  for (const end = Date.now() + ms; Date.now() < end; await delay(50)) if (!processAlive(pid) && !processTree(pid).length) return true;
  return !processAlive(pid) && !processTree(pid).length;
}

// ---- PNG and comparison checks, no browser ----
function xorshift(seed) {
  let x = seed | 0 || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x & 255; };
}
function noise(width, height, seed) {
  const next = xorshift(seed), data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i++) data[i] = next();
  return {width, height, data};
}
function gradient(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = x & 255; data[i + 1] = (y * 7) & 255; data[i + 2] = (x * y) & 255; data[i + 3] = 255 - ((x + y) & 63);
  }
  return {width, height, data};
}
function handPng(width, height, colorType, rows, extra = [], {bitDepth = 8, interlace = 0} = {}) {
  const chunk = (type, body) => {
    const head = Buffer.alloc(8), crc = Buffer.alloc(4);
    head.writeUInt32BE(body.length, 0); head.write(type, 4, 'latin1');
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = bitDepth; header[9] = colorType; header[12] = interlace;
  const raw = Buffer.concat(rows.map(row => Buffer.concat([Buffer.from([0]), Buffer.from(row)])));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), ...extra.map(([type, body]) => chunk(type, Buffer.from(body))),
    chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const same = (a, b) => a.width === b.width && a.height === b.height && Buffer.compare(Buffer.from(a.data.buffer, a.data.byteOffset, a.data.byteLength), Buffer.from(b.data.buffer, b.data.byteOffset, b.data.byteLength)) === 0;

function pngChecks() {
  const images = [noise(1, 1, 1), noise(3, 2, 2), noise(17, 9, 3), noise(64, 48, 4), gradient(256, 33)];
  const filters = ['adaptive', 'none', 'sub', 'up', 'average', 'paeth'];
  let roundtrips = 0, failures = [];
  for (const image of images) for (const filter of filters) {
    if (same(decodePNG(encodePNG(image, {filter})), image)) roundtrips++;
    else failures.push(`${image.width}x${image.height}/${filter}`);
  }
  check('png.roundtrip.synthetic', !failures.length, {roundtrips, failures});
  const reference = images[3], png = encodePNG(reference);
  check('png.encode.deterministic', png.equals(encodePNG(reference)));
  check('png.flipRows.involution', same({...reference, data: flipRows(flipRows(reference.data, 64, 48), 64, 48)}, reference));
  const corrupt = Buffer.from(png);
  corrupt[45] ^= 1;
  const throws = (fn, pattern) => { try { fn(); return false; } catch (error) { return pattern.test(error.message); } };
  check('png.decode.rejectsCorruption', throws(() => decodePNG(corrupt), /CRC/) && throws(() => decodePNG(png.subarray(0, png.length - 10)), /truncated|IEND/) && throws(() => decodePNG(Buffer.from('nope')), /signature/));
  const decoded = [
    [decodePNG(handPng(2, 1, 0, [[0, 200]], [['tRNS', [0, 200]]])), [0, 0, 0, 255, 200, 200, 200, 0]],
    [decodePNG(handPng(1, 1, 4, [[90, 128]])), [90, 90, 90, 128]],
    [decodePNG(handPng(2, 1, 2, [[10, 20, 30, 40, 50, 60]], [['tRNS', [0, 40, 0, 50, 0, 60]]])), [10, 20, 30, 255, 40, 50, 60, 0]],
    [decodePNG(handPng(3, 1, 3, [[0, 1, 2]], [['PLTE', [255, 0, 0, 0, 255, 0, 0, 0, 255]], ['tRNS', [255, 128]]])), [255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 255]],
  ];
  check('png.decode.colourTypes', decoded.every(([image, expected]) => Buffer.from(expected).equals(image.data)), {cases: ['grey+tRNS', 'grey+alpha', 'rgb+tRNS', 'palette+tRNS']});
  const deep = handPng(1, 1, 2, [[0, 0, 0, 0, 0, 0]], [], {bitDepth: 16}), interlaced = handPng(1, 1, 2, [[0, 0, 0]], [], {interlace: 1});
  check('png.decode.rejectsUnsupported', throws(() => decodePNG(deep), /bit depth 16/) && throws(() => decodePNG(interlaced), /interlaced/));
}

function diffChecks(a, label, pngDir) {
  const result = {};
  const d0 = diffImages(a, a);
  result.same = {differentPixels: d0.differentPixels, psnrDb: d0.psnrDb, verdict: d0.verdict};
  check(`diff.${label}.same`, d0.identical && d0.differentPixels === 0 && d0.maxChannelDelta === 0 && d0.psnrDb === null && d0.verdict === 'identical', result.same);
  const x = Math.min(a.width - 1, 123), y = Math.min(a.height - 1, 45), i = (y * a.width + x) * 4;
  const b = cloneImage(a);
  b.data[i + 1] ^= 1;
  const d1 = diffImages(a, b);
  result.onePixel = {x, y, differentPixels: d1.differentPixels, maxChannelDelta: d1.maxChannelDelta, bbox: d1.bbox, psnrDb: d1.psnrDb, verdict: d1.verdict};
  check(`diff.${label}.onePixel`, d1.differentPixels === 1 && d1.maxChannelDelta === 1 && d1.alphaDifferentPixels === 0 && d1.bbox.x0 === x && d1.bbox.x1 === x
    && d1.bbox.y0 === y && d1.bbox.y1 === y && d1.first.x === x && d1.first.y === y && d1.verdict === 'visually-identical', result.onePixel);
  const map = diffImage(a, b);
  let marked = 0;
  for (let k = 0; k < map.data.length; k += 4) if (!(map.data[k] === map.data[k + 1] && map.data[k + 1] === map.data[k + 2])) marked++;
  check(`diff.${label}.map`, marked === 1, {marked});
  if (pngDir) result.map = writePNG(join(pngDir, `diff-one-pixel-${label}.png`), map);
  const c = cloneImage(a);
  c.data[i + 3] ^= 1;
  const d2 = diffImages(a, c);
  check(`diff.${label}.alphaOnly`, d2.differentPixels === 1 && d2.alphaDifferentPixels === 1 && d2.verdict === 'different', {verdict: d2.verdict});
  const cropped = {width: a.width - 1, height: a.height, data: Buffer.alloc((a.width - 1) * a.height * 4)};
  check(`diff.${label}.size`, diffImages(a, cropped).comparable === false);
  return result;
}

// ---- Chrome ----
function chromeOptions(args) {
  return {chromePath: args.chromePath, angle: args.angle};
}
function cliOptions(args) {
  return [...(args.chromePath ? ['--chrome-path', args.chromePath] : []), ...(args.angle ? ['--angle', args.angle] : [])];
}

async function chromeRun(index, args, pngDir) {
  const run = {index}, images = {}, t0 = performance.now();
  const browser = await launch(chromeOptions(args));
  Object.assign(run, {pid: browser.pid, profileDir: browser.profileDir, profileExisted: existsSync(browser.profileDir), sweptProfiles: browser.sweptProfiles,
    product: browser.version.product, version: browser.version, args: browser.args});
  let env = null;
  try {
    run.launchMs = performance.now() - t0;
    const page = await browser.openPage(PROBE);
    run.openMs = performance.now() - t0 - run.launchMs;
    env = await page.evaluate('probe.environment()');
    for (const s of SCENES) {
      const first = await page.image(sceneExpression(s), {origin: s.origin}), second = await page.image(sceneExpression(s), {origin: s.origin});
      images[s.id] = {first, second};
      check(`launch${index}.repeat.${s.id}`, first.sha256 === second.sha256 && first.transferVerified && second.transferVerified, {sha256: [first.sha256, second.sha256]});
    }
    run.renderMs = performance.now() - t0 - run.launchMs - run.openMs;
    run.scene3dBlocks = await page.evaluate('probe.timeBlocks({}, {warmup: 30, blocks: 5, frames: 60})');
    run.processes = browser.processIds();
    run.sockets = internetSockets(run.processes);
    check(`launch${index}.noInternetSocket`, !!run.sockets.tool && !run.sockets.error && run.sockets.lines.length === 0, run.sockets);
    run.commandLine = commandLine(browser.pid);
    check(`launch${index}.pipeNotPort`, process.platform === 'win32' || (/--remote-debugging-pipe(\s|$)/.test(run.commandLine) && !/--remote-debugging-port|--remote-debugging-address|--allow-file-access/.test(run.commandLine)
      && run.commandLine.includes(`--user-data-dir=${browser.profileDir}`)), run.commandLine);
    if (index === 1) {
      run.system = await browser.systemInfo();
      // The reduced user agent says x86_64 on any Linux (arm64 Spark included): ask userAgentData.
      run.userAgentData = await page.evaluate(`navigator.userAgentData ? navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platform', 'platformVersion']).then(v => ({architecture: v.architecture, bitness: v.bitness, platform: v.platform, platformVersion: v.platformVersion})) : null`).catch(error => ({error: error.message}));
      const failure = await page.evaluate('undefined.x').then(() => null, error => error);
      check('page.exceptionReported', failure?.code === 'PAGE_EXCEPTION' && /TypeError/.test(failure.message) && (await page.evaluate('1 + 1')) === 2, failure?.message);
      const remote = await browser.openPage('https://example.com/').then(() => null, error => error.message);
      check('page.refusesNetworkUrl', /Only file:\/\//.test(remote || ''), remote);
      const big = await page.bytes('new Uint8Array(3 * 1048576 + 17).map((_, i) => (i * 2654435761) >>> 24)', {chunkBytes: 1 << 20});
      let bigOk = big.length === 3 * 1048576 + 17;
      for (let i = 0; bigOk && i < big.length; i += 4099) bigOk = big[i] === Number((BigInt(i) * 2654435761n) % 4294967296n >> 24n);
      check('page.bytes.chunked', bigOk, {length: big.length});
      // Our encoder -> Chrome's decoder, and Chrome's encoder -> our decoder.
      const scene = images.scene3d.first, ours = encodePNG(scene);
      const viaChrome = await page.image(`probe.decodePng(${JSON.stringify(ours.toString('base64'))})`, {origin: 'top-left'});
      check('png.chromeDecodesOurs', same(viaChrome, scene), {pngBytes: ours.length});
      const chromeImage = await page.image('probe.encodePngWithChrome({})', {origin: 'top-left'});
      const chromePng = Buffer.from(chromeImage.extra.png, 'base64'), decoded = decodePNG(chromePng);
      check('png.oursDecodesChrome', same(decoded, chromeImage), {pngBytes: chromePng.length, colourType: chromePng[25]});
      check('png.roundtrip.scenes', Object.values(images).every(({first}) => same(decodePNG(encodePNG(first)), first)));
      run.console = page.console;
      run.pageErrors = page.errors;
      if (pngDir) run.png = Object.fromEntries(Object.entries(images).map(([id, {first}]) => [id, writePNG(join(pngDir, `${id}.png`), first)]));
    }
  } finally {
    run.close = await browser.close();
    run.totalMs = performance.now() - t0;
    run.profileRemoved = !existsSync(run.profileDir);
    run.processesGone = await waitGone(run.pid);
    check(`launch${index}.cleanup`, run.profileExisted && run.profileRemoved && run.processesGone && run.close.exit?.code === 0, {close: run.close, profileRemoved: run.profileRemoved, processesGone: run.processesGone});
  }
  return {run, env, images};
}

async function holdChild(mode, signal, args) {
  // Same process group as this self-check, so that a real Ctrl-C reaches the child too.
  const child = spawn(process.execPath, [SELF, '--hold', mode, ...cliOptions(args)], {stdio: ['ignore', 'pipe', 'pipe']});
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', text => { stderr += text; });
  const exited = new Promise(done => child.once('exit', (code, sig) => done({code, signal: sig})));
  const line = await new Promise((resolveLine, reject) => {
    const timer = setTimeout(() => reject(new Error('hold child did not report')), 30000);
    child.stdout.on('data', text => {
      stdout += text;
      const at = stdout.indexOf('\n');
      if (at >= 0) { clearTimeout(timer); resolveLine(JSON.parse(stdout.slice(0, at))); }
    });
    exited.then(info => { clearTimeout(timer); reject(new Error(`hold child exited early ${JSON.stringify(info)}: ${stderr}`)); });
  });
  const before = {profileExists: existsSync(line.profileDir), chromeAlive: processAlive(line.chromePid), sockets: internetSockets(processTree(line.chromePid))};
  // Ctrl-C sends SIGINT to every process of the foreground group: the child Node process gets
  // it, Chrome (leader of its own group) does not. Sending it to the child alone is the same.
  if (signal) process.kill(child.pid, signal);
  let timer;
  const exit = await Promise.race([exited, new Promise(done => { timer = setTimeout(done, 20000, null); })]).finally(() => clearTimeout(timer));
  if (!exit) child.kill('SIGKILL');
  const chromeGone = await waitGone(line.chromePid);
  return {mode, signal: signal || null, chromePid: line.chromePid, profileDir: line.profileDir, profileExisted: line.profileExisted, before, exit,
    after: {profileExists: existsSync(line.profileDir), chromeGone}, stderrTail: stderr.trim().split('\n').slice(-3).join('\n')};
}

async function hold(mode, args) {
  setTimeout(() => process.exit(3), 60000).unref(); // never outlive an interrupted self-check
  const browser = await launch(chromeOptions(args));
  const page = await browser.openPage(PROBE);
  await page.evaluate('probe.render("legacy", {seed: 1.5}).width');
  process.stdout.write(JSON.stringify({pid: process.pid, chromePid: browser.pid, profileDir: browser.profileDir, profileExisted: existsSync(browser.profileDir)}) + '\n');
  if (mode === 'crash') setTimeout(() => { throw new Error('erreur non rattrapée volontaire'); }, 300);
  else setInterval(() => {}, 1000);
}

async function cleanupChecks(args) {
  const out = {};
  await guarded('cleanup.error', async () => {
    let seen = null;
    const error = await withChrome(chromeOptions(args), async browser => {
      seen = {pid: browser.pid, profileDir: browser.profileDir, profileExisted: existsSync(browser.profileDir)};
      await browser.openPage(PROBE);
      throw new Error('erreur volontaire');
    }).then(() => null, e => e);
    if (!seen) { check('cleanup.error', false, `launch failed: ${error?.message}`); return; }
    out.error = {...seen, rejected: error?.message, profileRemoved: !existsSync(seen.profileDir), chromeGone: await waitGone(seen.pid)};
    check('cleanup.error', out.error.rejected === 'erreur volontaire' && seen.profileExisted && out.error.profileRemoved && out.error.chromeGone, out.error);
  });
  await guarded('cleanup.timeout', async () => {
    const browser = await launch(chromeOptions(args));
    const info = {pid: browser.pid, profileDir: browser.profileDir, profileExisted: existsSync(browser.profileDir)};
    await browser.openPage(PROBE);
    const t0 = performance.now();
    const error = await browser.evaluate('new Promise(() => {})', {timeoutMs: 500}).then(() => null, e => e);
    out.timeout = {...info, rejected: error?.message, code: error?.code, ms: Math.round(performance.now() - t0), closed: browser.closed,
      profileRemoved: !existsSync(info.profileDir), chromeGone: await waitGone(info.pid)};
    await browser.close();
    check('cleanup.timeout', error?.code === 'TIMEOUT' && info.profileExisted && out.timeout.closed && out.timeout.profileRemoved && out.timeout.chromeGone && out.timeout.ms < 10000, out.timeout);
  });
  await guarded('cleanup.notFound', async () => {
    const before = ownProfiles().length;
    const error = await launch({...chromeOptions(args), chromePath: join(tmpdir(), 'metal-render-absent', 'chrome')}).then(b => b.close().then(() => null), e => e);
    out.notFound = {code: error?.code, message: error?.message, profilesBefore: before, profilesAfter: ownProfiles().length};
    check('cleanup.notFound', error?.code === 'CHROME_NOT_FOUND' && out.notFound.profilesAfter === before, out.notFound);
  });
  await guarded('launch.refusesPortFlag', async () => {
    const error = await launch({...chromeOptions(args), extraArgs: ['--remote-debugging-port=9222']}).then(b => b.close().then(() => null), e => e);
    check('launch.refusesPortFlag', /Refused Chrome argument/.test(error?.message || ''), error?.message);
  });
  if (process.platform !== 'win32') {
    for (const [mode, signal] of [['signal', 'SIGINT'], ['signal', 'SIGTERM'], ['crash', null]]) {
      const name = `cleanup.${signal ? signal.toLowerCase() : 'uncaught'}`;
      await guarded(name, async () => {
        const result = await holdChild(mode, signal, args);
        out[name.slice(8)] = result;
        const exitOk = signal ? result.exit?.signal === signal || result.exit?.code === 128 + (signal === 'SIGINT' ? 2 : 15) : result.exit?.code === 1;
        check(name, result.profileExisted && (signal ? result.before.profileExists && result.before.chromeAlive : true) && (result.before.sockets.lines || []).length === 0
          && exitOk && !result.after.profileExists && result.after.chromeGone, result);
      });
    }
  }
  await guarded('dumpDom', async () => {
    const html = await dumpDom(PROBE, {...chromeOptions(args), query: {dump: 1}, timeoutMs: 60000});
    const match = /<pre id="out">([^<]*)<\/pre>/.exec(html);
    const data = JSON.parse(Buffer.from(match ? match[1] : '', 'base64').toString('utf8'));
    out.dumpDom = {probe: data.probe, error: data.error, images: (data.images || []).map(image => {
      const raw = Buffer.from(image.pixels, 'base64');
      const top = image.origin === 'bottom-left' ? flipRows(raw, image.width, image.height) : raw;
      return {scene: image.scene, width: image.width, height: image.height, sha256: imageSha256({width: image.width, height: image.height, data: top})};
    })};
  });
  return out;
}

function summaryLines(report) {
  const g = report.gpu || {}, t = report.tool, ua = report.environment?.userAgentData;
  const source = {option: '--angle', METAL_RENDER_ANGLE: 'METAL_RENDER_ANGLE', platform: 'défaut de la plateforme'}[t.angleSource] || t.angleSource;
  return [
    `Chrome : ${report.chrome?.product || 'non lancé'} (${t.chromePath}, ANGLE ${t.angle ? `${t.angle}, ${source}` : `par défaut de Chrome, ${source}`})`,
    `Drapeaux GPU : ${t.gpuFlags?.length ? t.gpuFlags.join(' ') : 'aucun'} ; machine ${t.platform} (Node)${ua && ua.architecture ? ` ; navigateur ${ua.architecture} ${ua.bitness} bits (userAgentData)` : ''}`,
    `GPU : ${g.unmaskedRenderer || g.renderer || 'n/d'}`,
    `Extensions WebGL2 : ${report.extensions ? report.extensions.length : 'n/d'}${report.features ? ' ; ' + Object.entries(report.features).map(([k, v]) => `${k}=${v ? 'oui' : 'non'}`).join(', ') : ''}`,
    `performance.now : pas min ${report.performanceNow?.minStepMs ?? 'n/d'} ms, médian ${report.performanceNow?.medianStepMs ?? 'n/d'} ms ; crossOriginIsolated=${report.environment?.crossOriginIsolated}`,
    `OfflineAudioContext=${report.environment?.offlineAudioContext} ; isSecureContext=${report.environment?.secureContext}`,
    ...Object.entries(report.fingerprints || {}).map(([id, f]) => `  ${id} ${f.width}x${f.height} ${f.sha256}`),
    `Contrôles : ${report.summary.passed}/${report.summary.checks}${report.ok ? ' OK' : ' — ÉCHECS : ' + report.summary.failed.join(', ')}`,
  ];
}

async function main(args) {
  const started = performance.now(), pngDir = args.pngDir ? resolve(args.pngDir) : null;
  if (pngDir) mkdirSync(pngDir, {recursive: true});
  const resolved = normalizeOptions(chromeOptions(args));
  const report = {schema: 'metal-render-self-check-v1', date: new Date().toISOString(),
    tool: {node: process.version, platform: `${process.platform} ${process.arch}`, chromePath: args.chromePath || defaultChromePath(), angle: resolved.angle,
      angleSource: resolved.angleSource, gpuFlags: gpuFlags(resolved.angle), probe: PROBE}};
  await guarded('png', () => pngChecks());
  await guarded('diff.synthetic', () => { report.diffSynthetic = diffChecks(gradient(256, 33), 'synthetic'); });
  if (args.chrome) {
    const first = await guarded('launch1', () => chromeRun(1, args, pngDir));
    const second = await guarded('launch2', () => chromeRun(2, args, null));
    if (first) {
      const {env, run, images} = first;
      report.chrome = run.version;
      report.gpu = {vendor: env.webgl2.vendor, renderer: env.webgl2.renderer, unmaskedVendor: env.webgl2.unmaskedVendor, unmaskedRenderer: env.webgl2.unmaskedRenderer,
        version: env.webgl2.version, shadingLanguage: env.webgl2.shadingLanguage, system: run.system};
      report.extensions = env.webgl2.extensions;
      report.features = env.webgl2.features;
      report.limits = env.webgl2.limits;
      report.performanceNow = env.performanceNow;
      report.environment = {userAgent: env.userAgent, userAgentData: run.userAgentData, page: env.page, secureContext: env.secureContext, crossOriginIsolated: env.crossOriginIsolated,
        offlineAudioContext: env.offlineAudioContext, offlineAudioSampleRate: env.offlineAudioSampleRate, sharedArrayBuffer: env.sharedArrayBuffer,
        webgpu: env.webgpu, hardwareConcurrency: env.hardwareConcurrency};
      report.fingerprints = Object.fromEntries(Object.entries(images).map(([id, {first: image}]) => [id, {width: image.width, height: image.height, sha256: image.sha256, sourceSha256: image.sourceSha256}]));
      const applicable = env.webgl2.unmaskedRenderer === PROTOTYPE.renderer && run.product === PROTOTYPE.product;
      report.prototype = {...PROTOTYPE, actualSourceSha256: images['legacy-1.5'].first.sourceSha256, applicable, matches: images['legacy-1.5'].first.sourceSha256 === PROTOTYPE.sourceSha256};
      if (applicable) check('prototype.legacyIdentical', report.prototype.matches, report.prototype);
      check('scenes.distinct', new Set(Object.values(report.fingerprints).map(f => f.sha256)).size === SCENES.length);
      const seeds = diffImages(images['legacy-1.5'].first, images['legacy-2.5'].first);
      check('diff.seedsDiffer', seeds.verdict === 'different' && seeds.psnrDb !== null && seeds.psnrDb < 60, {psnrDb: seeds.psnrDb, differentRatio: seeds.differentRatio});
      report.diffScene = diffChecks(images.scene3d.first, 'scene3d', pngDir);
      report.diffScene.repeat = diffImages(images.scene3d.first, images.scene3d.second).verdict;
      check('diff.scene3d.repeat', report.diffScene.repeat === 'identical');
    }
    if (first && second) for (const s of SCENES) {
      const a = first.images[s.id].first, b = second.images[s.id].first;
      check(`launches.${s.id}`, a.sha256 === b.sha256, {launch1: a.sha256, launch2: b.sha256});
    }
    report.launches = [first?.run, second?.run].filter(Boolean);
    report.cleanup = await guarded('cleanup', () => cleanupChecks(args));
    if (report.cleanup?.dumpDom && report.fingerprints) {
      const byScene = Object.fromEntries(report.cleanup.dumpDom.images.map(image => [image.scene, image.sha256]));
      check('dumpDom.samePixels', !report.cleanup.dumpDom.error && byScene.legacy === report.fingerprints['legacy-1.5'].sha256 && byScene.scene3d === report.fingerprints.scene3d.sha256, report.cleanup.dumpDom);
    }
    check('cleanup.noProfileLeft', ownProfiles().length === 0, ownProfiles());
  }
  if (args.compare) await guarded('compare.previous', () => {
    const previous = JSON.parse(readFileSync(args.compare, 'utf8')), mine = report.fingerprints || {}, theirs = previous.fingerprints || {};
    const ids = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].sort();
    const differences = ids.filter(id => mine[id]?.sha256 !== theirs[id]?.sha256);
    report.comparedWith = {file: resolve(args.compare), date: previous.date, product: previous.chrome?.product, renderer: previous.gpu?.unmaskedRenderer, scenes: ids.length, differences};
    check('compare.previous', ids.length > 0 && !differences.length, report.comparedWith);
  });
  report.checks = checks;
  const failed = checks.filter(c => !c.ok).map(c => c.name);
  report.summary = {checks: checks.length, passed: checks.length - failed.length, failed, seconds: Math.round(performance.now() - started) / 1000};
  report.ok = failed.length === 0;
  const text = JSON.stringify(report, null, 2) + '\n';
  if (args.out) { mkdirSync(dirname(resolve(args.out)), {recursive: true}); writeFileSync(args.out, text); }
  process.stdout.write(text);
  process.stderr.write(summaryLines(report).join('\n') + '\n');
  return report.ok ? 0 : 1;
}

const args = parseArgs(process.argv.slice(2));
if (args.hold) await hold(args.hold, args);
else process.exitCode = await main(args);
