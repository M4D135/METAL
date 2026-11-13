#!/usr/bin/env node
// Lot 00 / R1b: audit bench pages through the dump-run prototype of the lot 00 lead (R1's
// dumpDom, from a checkout of the code before R1b) and through tools/render/run-page.mjs (dump
// mode), alternated A B B A A B. Times are reported, never compared.
//   node pages-heritees.mjs <avant-root> <pages-dir> <out.json> [--rounds N] [--only t6-run1,runJ,cielv] [--horloge-fixe]
// What is compared: the Chrome command line (R1's, rebuilt from the R1 module, against the one
// run-page recorded), the URL, the extraction (run-page's reader applied to the very DOM that the
// prototype read must give the same text), and every field of the results. The RGPU pages are not
// reproducible from one launch to the next, whatever the launcher: the game stamps a fire press
// with the real clock (firePressAt = performance.now()) and expires it against the synthetic 60 Hz
// clock of the RGPU POST driver (expireFireIntents(now)), so the gameplay depends on how fast the
// frames really ran. A field is therefore classed as: equal in every run; varying between two
// launches of the prototype itself (launch noise, not a launcher difference); or constant under
// the prototype and different under run-page (suspect). Verdict on the fields: equal (no noise,
// no suspect); launch noise (the prototype alone varies: no launcher comparison can be decided
// on such a page, hence --horloge-fixe); different (the prototype is reproducible and run-page
// is not: a failure). A suspect's family (same field, frame index and variant folded) is marked
// when it varies under the prototype alone on a page of the run.
// --horloge-fixe: the RGPU pages are run from a copy (in the work folder, removed at the end)
// whose performance.now() advances by 1 µs per call instead of following the real clock. The
// launch noise must then vanish, and both launchers give the same fields, bit for bit; the
// copy is made only for this comparison (times then mean nothing and are not compared).
// <avant-root>: a checkout of 3ca8016 (git worktree add --detach … 3ca8016).
// <pages-dir>: t6-run1.html (bancs/rcpu-verif/chrome-gen.mjs, cfg rcpu-verif2/cfg1.json), runJ.html
// (bancs/rgpu/gen.mjs, cfg rgpu/cfg/runJ.json), cielv.html (copy of bancs/ciel-verif/cielv.html).
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const RUN_PAGE = join(ROOT, 'tools/render/run-page.mjs');
const {decodePNG, imageSha256} = await import(pathToFileURL(join(ROOT, 'tools/render/png.mjs')).href);
const {extractMarker} = await import(pathToFileURL(RUN_PAGE).href);
const PROFILE = '--user-data-dir=<profil jetable>';
const normalizeArgs = args => args.map(a => a.startsWith('--user-data-dir=') ? PROFILE : a);

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv.splice(i, 2)[1] : fallback; };
const frozen = argv.includes('--horloge-fixe');
if (frozen) argv.splice(argv.indexOf('--horloge-fixe'), 1);
const rounds = Number(option('--rounds', '1')), only = option('--only', frozen ? 't6-run1,runJ' : 't6-run1,runJ,cielv').split(',');
const [avantRoot, pagesDir, outFile] = argv.map(p => resolve(p));
if (!outFile) { console.error('usage: node pages-heritees.mjs <avant-root> <pages-dir> <out.json> [--rounds N] [--only …]'); process.exit(2); }

// Page, window, virtual time budget, timeout: as in the lead's plan (dump-run.mjs arguments).
const PAGES = {
  't6-run1': {file: 't6-run1.html', window: '1440,932', timeout: 400000},
  runJ: {file: 'runJ.html', window: '1440,932', timeout: 400000},
  cielv: {file: 'cielv.html', hash: '#shots', window: '1600,900', timeout: 270000, shots: true},
};

const sha256 = data => createHash('sha256').update(data).digest('hex');
const work = mkdtempSync(join(tmpdir(), 'metal-r1b-pages-'));
const CHARSET = '<meta charset="utf-8">';
const CLOCK = '<script>/* R1b : horloge déterministe, copie de comparaison des lanceurs (hors audit) */(()=>{let t=0;performance.now=()=>(t+=0.001);})();</script>';
// Folder and file of the page actually loaded: the audit page, or its fixed-clock copy.
function pageSource(page) {
  const p = PAGES[page];
  if (!frozen) return {dir: pagesDir, file: p.file};
  const source = readFileSync(join(pagesDir, p.file), 'utf8'), at = source.indexOf(CHARSET);
  if (at < 0) throw new Error(`${p.file}: ${CHARSET} not found`);
  const file = p.file.replace(/\.html$/, '-horloge-fixe.html');
  writeFileSync(join(work, file), source.slice(0, at + CHARSET.length) + CLOCK + source.slice(at + CHARSET.length));
  return {dir: work, file};
}

// The prototype, verbatim apart from its arguments ($C/dump-run.mjs of the lead): R1's dumpDom,
// then the last <pre id="rgpu-out">, else the last <pre id="out">, five entities decoded.
async function dumpRun(page, src) {
  const r1 = await import(pathToFileURL(join(avantRoot, 'tools/render/chrome.mjs')).href);
  const p = PAGES[page], url = pathToFileURL(join(src.dir, src.file)).href + (p.hash || ''); // R1 needs a file: URL for a fragment
  const options = {window: p.window.split(',').map(Number), dpr: 1, timeoutMs: p.timeout};
  const t0 = performance.now();
  const html = await r1.dumpDom(url, options);
  const ms = Math.round(performance.now() - t0);
  let i = html.lastIndexOf('<pre id="rgpu-out">'); if (i < 0) i = html.lastIndexOf('<pre id="out">');
  if (i < 0) throw new Error('no output marker');
  const j = html.indexOf('>', i) + 1, k = html.indexOf('</pre>', j);
  const text = html.slice(j, k).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  // The same DOM through run-page's reader, and R1 dumpDom's command line (chromeArgs + --dump-dom URL).
  const viaRunPage = extractMarker(html);
  return {ms, text, url, args: normalizeArgs([...r1.chromeArgs(r1.normalizeOptions(options), 'x'), '--dump-dom', url]),
    extraction: {marker: viaRunPage?.id ?? null, sameText: viaRunPage?.text === text, htmlBytes: Buffer.byteLength(html)}};
}

function runPage(page, tag, src) {
  const p = PAGES[page], out = join(work, `${page}-${tag}.out`), meta = join(work, `${page}-${tag}.meta.json`);
  // A bare path followed by its fragment: what R1 refused (« Page not found »).
  const args = [RUN_PAGE, join(src.dir, src.file) + (p.hash || ''), '--window', p.window, '--dpr', '1', '--timeout', String(p.timeout), '--out', out, '--meta', meta,
    ...(p.shots ? ['--png-dir', join(work, `${page}-${tag}-png`)] : [])];
  return new Promise((done, fail) => {
    const t0 = performance.now(), child = spawn(process.execPath, args, {stdio: ['ignore', 'ignore', 'pipe']});
    let err = '';
    child.stderr.on('data', chunk => { err += chunk; });
    child.once('close', code => {
      if (code !== 0) { fail(new Error(`run-page ${page}: code ${code}\n${err}`)); return; }
      done({ms: Math.round(performance.now() - t0), text: readFileSync(out, 'utf8'), meta: JSON.parse(readFileSync(meta, 'utf8')), stderr: err.trim()});
    });
  });
}

// ---- Deterministic content of a result ----
const TIME_VARIANT = /^(total|min|cpu)/;
function deterministic(page, value) {
  const v = structuredClone(value);
  if (page === 'cielv') {
    delete v.shots;
    if (v.stats) { delete v.stats.compileMs; delete v.stats.bruit3dMs; }
    delete v.bench;
    return v;
  }
  delete v.game;
  for (const variant of Object.values(v.variants || {})) for (const key of Object.keys(variant)) if (TIME_VARIANT.test(key)) delete variant[key];
  for (const frame of v.perFrame || []) for (const key of ['t', 'm', 'c', 'g', 'mc']) delete frame[key];
  return v;
}

// Leaves of a value: path -> JSON text.
function flatten(value, path = '', out = new Map()) {
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) out.set(path, Array.isArray(value) ? '[]' : '{}');
    for (const key of keys) flatten(value[key], `${path}/${key}`, out);
  } else out.set(path, JSON.stringify(value));
  return out;
}
// Family of a path: frame indices and variant names folded, so that a list stays readable.
const family = path => path.replace(/\/\d+(?=\/|$)/g, '/*').replace(/^\/(variants|diffs)\/[^/]+/, '/$1/*');
const short = text => text === undefined ? '<absent>' : text.length > 60 ? text.slice(0, 57) + '…' : text;
const allSame = list => list.every(v => v === list[0]);

function classify(runs) {
  const dump = runs.filter(r => r.kind === 'dump-run'), page = runs.filter(r => r.kind === 'run-page');
  const paths = new Set(runs.flatMap(r => [...r.flat.keys()]));
  const values = (list, path) => list.map(r => r.flat.get(path));
  let equal = 0;
  const noise = [], suspect = [], families = {};
  for (const path of paths) {
    const d = values(dump, path), p = values(page, path);
    if (allSame([...d, ...p])) { equal++; continue; }
    const kind = allSame(d) ? 'suspect' : 'noise', f = families[family(path)] ||= {noise: 0, suspect: 0};
    f[kind]++;
    (kind === 'noise' ? noise : suspect).push({path, dumpRun: d.map(short), runPage: p.map(short)});
  }
  return {paths: paths.size, equalEverywhere: equal, launchNoise: noise.length, suspects: suspect.length,
    families: Object.fromEntries(Object.entries(families).sort(([a], [b]) => a < b ? -1 : 1)),
    launchNoiseExamples: noise.slice(0, 30), suspectList: suspect}; // trimmed once every page is measured
}

function headline(page, value) {
  if (page === 'cielv') return {errors: value.errors, info: value.info, statsKeys: Object.keys(value.stats || {}).length};
  const last = value.samples?.[value.samples.length - 1];
  return {
    errors: value.errors, frames: value.frames, flashFrames: value.scene?.flashFrames, lastSample: last ? {f: last.f, health: last.health, score: last.score} : null,
    variants: Object.fromEntries(Object.entries(value.variants || {}).map(([id, x]) => [id, {draws: x.drawsMedian, instances: x.instancesMedian}])),
    diffs: Object.fromEntries(Object.entries(value.diffs || {}).map(([id, d]) => [id, {psnr: d.psnr, mad: d.mad, gt10: d.gt10}])),
  };
}

function shotsOfEnvelope(text) {
  const start = text.indexOf('@@JSON@@'), end = text.indexOf('@@END@@', start);
  const value = JSON.parse(start >= 0 ? text.slice(start + 8, end) : text);
  const shots = Object.entries(value.shots || {}).map(([name, url]) => {
    const bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    return {name, bytes: bytes.length, sha256: sha256(bytes), pixelsSha256: imageSha256(decodePNG(bytes))};
  });
  return {value, shots};
}

const results = {schema: 'metal-r1b-pages-heritees-v1', date: new Date().toISOString(), node: process.version, platform: `${process.platform} ${process.arch}`,
  avantRoot, clock: frozen ? `copies des pages RGPU, performance.now() remplacé avant tout script : ${CLOCK}` : 'réelle (pages de l\'audit telles quelles)', pages: {}};
try {
  for (const page of only) {
    const p = PAGES[page], runs = [];
    if (frozen && p.shots) { process.stderr.write(`${page} : page déjà déterministe, sans copie à horloge fixe\n`); continue; }
    const src = pageSource(page);
    for (let r = 0; r < rounds; r++) for (const kind of r % 2 ? ['run-page', 'dump-run'] : ['dump-run', 'run-page']) {
      const tag = `${kind}-${r}`;
      process.stderr.write(`${page} ${tag}…\n`);
      if (kind === 'dump-run') {
        const {ms, text, url, args, extraction} = await dumpRun(page, src);
        const parsed = p.shots ? shotsOfEnvelope(text) : {value: JSON.parse(text), shots: null};
        runs.push({kind, tag, ms, textBytes: Buffer.byteLength(text), value: parsed.value, shots: parsed.shots, url, args, extraction});
      } else {
        const {ms, text, meta} = await runPage(page, tag, src);
        runs.push({kind, tag, ms, textBytes: Buffer.byteLength(text), value: JSON.parse(text), url: meta.page.url, args: meta.chrome.args, marker: meta.marker,
          envelope: meta.result.envelope, cleanup: meta.cleanup, gpuFlags: meta.tool.gpuFlags, chrome: meta.chrome.version,
          shots: meta.shots ? meta.shots.map(s => ({name: s.name, bytes: s.bytes, sha256: s.sha256, pixelsSha256: s.pixelsSha256})) : null});
      }
      runs[runs.length - 1].flat = flatten(deterministic(page, runs[runs.length - 1].value));
    }
    const entry = results.pages[page] = {file: p.file, hash: p.hash || null, window: p.window, sha256: sha256(readFileSync(join(pagesDir, p.file))),
      loaded: src.file, loadedSha256: sha256(readFileSync(join(src.dir, src.file))),
      chromeArgs: runs[0].args, chromeArgsEqual: runs.every(run => JSON.stringify(run.args) === JSON.stringify(runs[0].args)),
      urlEqual: runs.every(run => run.url === runs[0].url),
      extractionSameOnSameDom: runs.filter(run => run.extraction).every(run => run.extraction.sameText),
      runs: runs.map(run => ({kind: run.kind, tag: run.tag, ms: run.ms, textBytes: run.textBytes, url: run.url, extraction: run.extraction, marker: run.marker,
        envelope: run.envelope, cleanup: run.cleanup, gpuFlags: run.gpuFlags, chrome: run.chrome, headline: headline(page, run.value),
        shots: run.shots && {count: run.shots.length, sha256: Object.fromEntries(run.shots.map(s => [s.name, s.sha256])), pixelsSha256: Object.fromEntries(run.shots.map(s => [s.name, s.pixelsSha256]))}})),
      fields: classify(runs)};
    entry.fieldsEqual = entry.fields.launchNoise === 0 && entry.fields.suspects === 0;
    if (p.shots) {
      const first = JSON.stringify(entry.runs[0].shots);
      entry.shotsEqual = entry.runs.every(run => JSON.stringify(run.shots) === first);
      entry.shotsCount = entry.runs[0].shots.count;
    }
    const f = entry.fields;
    process.stderr.write(`${page}: ligne de commande ${entry.chromeArgsEqual ? 'identique' : 'DIFFÉRENTE'}, URL ${entry.urlEqual ? 'identique' : 'DIFFÉRENTE'}, `
      + `lecture du même DOM ${entry.extractionSameOnSameDom ? 'identique' : 'DIFFÉRENTE'} ; champs : ${f.equalEverywhere}/${f.paths} égaux partout, `
      + `${f.launchNoise} variant d'un lancement du prototype à l'autre, ${f.suspects} suspect(s)${p.shots ? ` ; captures ${entry.shotsEqual ? 'identiques' : 'DIFFÉRENTES'} (${entry.shotsCount})` : ''}`
      + ` ; durées ${entry.runs.map(r => `${r.kind} ${(r.ms / 1000).toFixed(1)} s`).join(', ')}\n`);
  }
} finally {
  rmSync(work, {recursive: true, force: true});
}
// Families that vary between launches of the prototype alone, on any page of the run.
const noisy = new Set(Object.values(results.pages).flatMap(e => Object.entries(e.fields.families).filter(([, c]) => c.noise > 0).map(([name]) => name)));
for (const [page, e] of Object.entries(results.pages)) {
  const f = e.fields;
  f.suspectList = f.suspectList.map(s => ({...s, family: family(s.path), familyVariesUnderPrototype: noisy.has(family(s.path))}));
  f.suspectsOutsideNoisyFamilies = f.suspectList.filter(s => !s.familyVariesUnderPrototype).length;
  f.suspectList = f.suspectList.slice(0, 30);
  e.fieldsVerdict = f.launchNoise === 0 && f.suspects === 0 ? 'égaux' : f.launchNoise > 0 ? 'bruit de lancement' : 'différents';
  process.stderr.write(`${page}: champs ${e.fieldsVerdict} (${f.suspects} suspect(s), dont ${f.suspectsOutsideNoisyFamilies} hors des familles qui varient sous le prototype seul)\n`);
}
results.ok = Object.values(results.pages).every(e => e.chromeArgsEqual && e.urlEqual && e.extractionSameOnSameDom && e.fieldsVerdict !== 'différents' && e.shotsEqual !== false);
results.fieldsEqualEverywhere = Object.values(results.pages).every(e => e.fieldsVerdict === 'égaux');
writeFileSync(outFile, JSON.stringify(results, null, 1) + '\n');
process.exitCode = results.ok ? 0 : 1;
