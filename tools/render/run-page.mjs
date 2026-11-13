#!/usr/bin/env node
// Runs a bench page (file://) in headless Chrome and writes its result: the generic
// replacement of the audit's run.sh, run2.sh and extract.py (lot 00 / R1b; RCPU-V3,
// RGPU-11, PARA-13). No port, no server, never --allow-file-access-from-files, a throw-away
// profile, macOS and Linux (Spark). Outside npm test. Documentation: tools/render/README.md.
//
//   node tools/render/run-page.mjs <page>[?query][#fragment] [options]     (--help: all options)
//
// Exit code: 0 the page rendered its result, 1 it did not (no marker, empty marker, invalid
// JSON, --wait not met, Chrome failure), 2 usage error, refused flag or page other than file://.
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch, dumpDomDetails, normalizeOptions, pageUrl, chromeArgRefusal, gpuFlags, chromeVersion, ANGLE_ENV, PROFILE_PREFIX} from './chrome.mjs';
import {decodePNG, flipRows, imageSha256, writePNG} from './png.mjs';

export const SCHEMA = 'metal-run-page-v1';
// Markers of the audit's pages, by priority: rgpu/rcpu (rgpu-out), natif and rgpu-verif (vout),
// ciel, stab, para, draw (out). extract.py read rgpu-out, then out.
export const DEFAULT_MARKERS = Object.freeze(['rgpu-out', 'vout', 'out']);
export const DEFAULTS = Object.freeze({window: '1440x932', dpr: 1, timeoutMs: 270000, pollMs: 100});

export const USAGE = `Usage : node tools/render/run-page.mjs <page>[?requête][#fragment] [options]

Lance une page de banc en file:// dans Chrome sans tête et écrit son résultat.
<page> : chemin d'un fichier (suivi au besoin de ?requête et #fragment, comme
'cielv.html#shots,aube') ou URL file://. Toute autre URL est refusée.

Mode
  --mode dump|cdp     dump (défaut) : chrome --dump-dom, pour les pages qui écrivent leur
                      résultat dans un <pre> avant la fin du chargement ; cdp : tube DevTools,
                      pour attendre, appeler la page ou lire des images. --wait, --result,
                      --call, --arg, --arg-file, --image et --console impliquent cdp.
Page
  --query CLÉ=VALEUR  paramètre de requête (répétable ; 'a=1&b=2' accepté), encodé comme
                      URLSearchParams (une virgule devient %2C : la page lit .get())
  --hash FRAGMENT     fragment (#mode,args) ; remplace celui du chemin
  --window LxH        fenêtre en pixels CSS (défaut 1440x932 ; '1440,932' accepté)
  --dpr N             devicePixelRatio (défaut 1)
  --timeout MS        délai total, Chrome compris (défaut 270000, celui des run.sh)
  --budget MS         dump : temps virtuel (--virtual-time-budget)
cdp
  --call EXPR         fonction appelée après le chargement avec les --arg (promesse attendue) :
                      c'est ainsi qu'une page reçoit ses données, jamais par fetch() en file://.
                      Appelée sans this : '(...a) => objet.methode(...a)' pour une méthode
  --arg JSON          argument de --call (répétable, dans l'ordre)
  --arg-file FICHIER  argument de --call lu dans un fichier JSON
  --wait EXPR         attend que l'expression soit vraie, sondée toutes les 100 ms, dans le délai ;
                      une exception compte comme « pas encore » (défaut, sans --result ni --image :
                      le marqueur choisi comme en mode dump n'est plus vide)
  --result EXPR       résultat : valeur JSON de l'expression, ou texte traité comme un marqueur
                      (défaut : texte du marqueur)
  --image ID=EXPR     image RGBA {width, height, data|pixels[, origin]} lue par readPixels ou
                      getImageData ; ID:top-left=EXPR ou ID:bottom-left=EXPR force l'origine
                      (sinon le champ origin de l'objet, sinon bottom-left). SHA-256 des pixels
                      de haut en bas, comme self-check.mjs ; PNG dans --png-dir.
  --console           recopie la console de la page sur la sortie d'erreur
Résultat
  --marker ID         <pre id=ID> lu (défaut : le premier présent de rgpu-out, vout, out ; le
                      dernier <pre> de cet id, comme extract.py) ; l'enveloppe @@JSON@@…@@END@@
                      est retirée
  --text              résultat texte, sans analyse JSON (sinon un JSON valide est exigé)
  --png-dir DIR       écrit les captures data:image/…;base64 de la clé shots (comme extract.py)
                      et les retire du JSON ; écrit aussi les images --image
  --out FICHIER       écrit le résultat (sinon sur la sortie standard), tel que la page l'a rendu
                      quand rien n'est retiré
  --meta FICHIER      compte rendu JSON : Chrome, drapeaux, durée, marqueur, SHA-256, captures
Chrome
  --chrome-path P     exécutable (défaut : CHROME_PATH, puis le Chrome de la plateforme)
  --angle A           moteur ANGLE (défaut : METAL_RENDER_ANGLE, puis metal sous macOS, d3d11 sous
                      Windows, celui de Chrome ailleurs ; none omet le drapeau)
  --chrome-arg FLAG   drapeau Chrome en plus (répétable). Refusés : port ou adresse de débogage,
                      accès aux fichiers, sécurité web, proxy, et les drapeaux du lanceur.

Codes de sortie : 0 résultat rendu ; 1 rien de rendu (marqueur absent ou vide, JSON invalide,
--wait non satisfait, délai, échec de Chrome) ; 2 erreur d'usage, drapeau refusé, page autre que
file:// ou, sous Linux, TMPDIR trop long pour la prise de Chrome (rien n'est lancé).
`;

export class UsageError extends Error {}
export class ResultError extends Error {
  constructor(message, extra = {}) { super(message); Object.assign(this, extra); }
}

const VALUE_OPTIONS = new Set(['--mode', '--query', '--hash', '--window', '--dpr', '--timeout', '--budget', '--call', '--arg', '--arg-file', '--wait',
  '--result', '--image', '--marker', '--png-dir', '--out', '--meta', '--chrome-path', '--angle', '--chrome-arg']);
const FLAG_OPTIONS = new Set(['--text', '--console', '--help']);
const CDP_ONLY = ['call', 'wait', 'result'];
// Why a Chrome flag is refused (codes of chromeArgRefusal in chrome.mjs).
const REFUSAL_FR = {
  port: 'aucun port de débogage : le lanceur parle DevTools par --remote-debugging-pipe',
  'file-access': 'aucun accès aux fichiers pour une page file:// : données par --call et --arg (mode cdp), ou incluses dans la page',
  gpu: `drapeaux GPU fixés par le lanceur : --angle ou ${ANGLE_ENV}`,
  network: 'le réseau reste fermé (--host-resolver-rules="MAP * ~NOTFOUND")',
  owned: 'drapeau géré par le lanceur (--window, --dpr, --mode dump, profil jetable)',
  syntax: 'un drapeau commence par --',
};

function refusal(arg) {
  const r = chromeArgRefusal(arg);
  return r ? REFUSAL_FR[r.code] || r.reason : null;
}

function positiveNumber(text, name, {integer = false} = {}) {
  const n = Number(text);
  if (!(Number.isFinite(n) && n > 0) || (integer && !Number.isSafeInteger(n))) throw new UsageError(`${name} : nombre positif attendu, reçu « ${text} »`);
  return n;
}

// Command line -> options. Throws UsageError (exit code 2).
export function parseArgs(argv) {
  const o = {pages: [], query: {}, args: [], images: [], chromeArgs: [], text: false, console: false, help: false};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { o.pages.push(...argv.slice(i + 1)); break; }
    if (!arg.startsWith('--')) { o.pages.push(arg); continue; }
    const eq = arg.indexOf('=');
    const name = eq > 0 ? arg.slice(0, eq) : arg;
    if (FLAG_OPTIONS.has(name)) {
      if (eq > 0) throw new UsageError(`${name} ne prend pas de valeur`);
      o[name.slice(2)] = true;
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) {
      const reason = refusal(arg);
      if (reason) throw new UsageError(`drapeau refusé : ${arg} (${reason})`);
      throw new UsageError(`option inconnue : ${arg} (voir --help ; un drapeau de Chrome passe par --chrome-arg=${arg})`);
    }
    let value;
    if (eq > 0) value = arg.slice(eq + 1);
    else if (i + 1 < argv.length) value = argv[++i];
    else throw new UsageError(`${name} : valeur manquante`);
    switch (name) {
      case '--mode':
        if (value !== 'dump' && value !== 'cdp') throw new UsageError(`--mode : dump ou cdp, reçu « ${value} »`);
        o.mode = value; break;
      case '--query':
        for (const [key, v] of new URLSearchParams(value)) o.query[key] = v;
        break;
      case '--hash': o.hash = value; break;
      case '--window': o.window = value; break;
      case '--dpr': o.dpr = positiveNumber(value, '--dpr'); break;
      case '--timeout': o.timeoutMs = positiveNumber(value, '--timeout', {integer: true}); break;
      case '--budget': o.budgetMs = positiveNumber(value, '--budget', {integer: true}); break;
      case '--call': o.call = value; break;
      case '--arg':
        try { o.args.push(JSON.parse(value)); } catch (error) { throw new UsageError(`--arg : JSON invalide (${error.message})`); }
        break;
      case '--arg-file': {
        let source;
        try { source = readFileSync(value, 'utf8'); } catch (error) { throw new UsageError(`--arg-file : ${error.message}`); }
        try { o.args.push(JSON.parse(source)); } catch (error) { throw new UsageError(`--arg-file ${value} : JSON invalide (${error.message})`); }
        break;
      }
      case '--wait': o.wait = value; break;
      case '--result': o.result = value; break;
      case '--image': {
        const m = /^([A-Za-z0-9_.-]+)(?::(top-left|bottom-left))?=([\s\S]+)$/.exec(value);
        if (!m) throw new UsageError(`--image : ID=EXPR ou ID:top-left=EXPR attendu, reçu « ${value} »`);
        if (o.images.some(image => image.id === m[1])) throw new UsageError(`--image : identifiant en double « ${m[1]} »`);
        o.images.push({id: m[1], origin: m[2] || null, expression: m[3]});
        break;
      }
      case '--marker':
        if (!/^[A-Za-z][\w:.-]*$/.test(value)) throw new UsageError(`--marker : identifiant invalide « ${value} »`);
        o.marker = value; break;
      case '--png-dir': o.pngDir = resolve(value); break;
      case '--out': o.out = resolve(value); break;
      case '--meta': o.meta = resolve(value); break;
      case '--chrome-path': o.chromePath = value; break;
      case '--angle': o.angle = value; break;
      case '--chrome-arg': {
        const reason = refusal(value);
        if (reason) throw new UsageError(`drapeau refusé : ${value} (${reason})`);
        o.chromeArgs.push(value);
        break;
      }
    }
  }
  if (o.help) return o;
  if (o.pages.length !== 1) throw new UsageError(o.pages.length ? `une seule page attendue, reçu : ${o.pages.join(' ')}` : 'page manquante (voir --help)');
  o.page = o.pages[0];
  const cdpOptions = CDP_ONLY.filter(key => o[key] !== undefined).map(key => `--${key}`)
    .concat(o.args.length ? ['--arg/--arg-file'] : [], o.images.length ? ['--image'] : [], o.console ? ['--console'] : []);
  if (o.args.length && o.call === undefined) throw new UsageError('--arg et --arg-file vont avec --call');
  if (!o.mode) o.mode = cdpOptions.length ? 'cdp' : 'dump';
  if (o.mode === 'dump' && cdpOptions.length) throw new UsageError(`${cdpOptions.join(', ')} : mode cdp seulement (retirer --mode dump)`);
  if (o.mode === 'cdp' && o.budgetMs !== undefined) throw new UsageError('--budget : mode dump seulement (temps virtuel de --dump-dom)');
  if (o.text && o.pngDir && !o.images.length) throw new UsageError('--png-dir lit la clé shots d\'un résultat JSON : incompatible avec --text');
  o.window ??= DEFAULTS.window;
  o.dpr ??= DEFAULTS.dpr;
  o.timeoutMs ??= DEFAULTS.timeoutMs;
  // Page and Chrome options are checked before anything is launched.
  try {
    o.url = pageUrl(o.page, o.query, o.hash);
    o.chrome = normalizeOptions({chromePath: o.chromePath, angle: o.angle, window: o.window, dpr: o.dpr, extraArgs: o.chromeArgs, timeoutMs: o.timeoutMs});
  } catch (error) {
    if (error.code === 'PAGE_NOT_FOUND') throw new UsageError(`page introuvable : ${resolve(o.page)}`);
    if (error.code === 'NOT_FILE_URL') throw new UsageError(`seules les pages file:// sont acceptées, sans serveur ni réseau : ${o.page}`);
    throw new UsageError(error.message);
  }
  return o;
}

// ---- Result extraction ----
const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};

// Entities of Chrome's DOM serialiser (&amp; &lt; &gt; &nbsp; in text, &quot; in attributes) and numeric ones.
export function unescapeHtml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Marker of a serialised DOM, as extract.py chose it: the first id of the list that a <pre>
// carries, and of the <pre> elements with that id the last one. {id, text, closed} or null.
// An empty marker is returned as such: the caller decides.
export function extractMarker(html, ids = DEFAULT_MARKERS) {
  for (const id of ids) {
    const open = new RegExp(`<pre\\b[^>]*?\\sid=(?:"${escapeRegExp(id)}"|'${escapeRegExp(id)}')[^>]*>`, 'gi');
    let last = null;
    for (const m of html.matchAll(open)) last = m;
    if (!last) continue;
    const start = last.index + last[0].length, end = html.indexOf('</pre>', start);
    const inner = html.slice(start, end < 0 ? html.length : end).replace(/<[^>]*>/g, '');
    return {id, text: unescapeHtml(inner), closed: end >= 0};
  }
  return null;
}

// @@JSON@@...@@END@@ envelope of the ciel pages (extract.py): the first one, as extract.py did.
export function unwrapEnvelope(text) {
  const start = text.indexOf('@@JSON@@');
  if (start < 0) return {text, envelope: false};
  const end = text.indexOf('@@END@@', start + 8);
  if (end < 0) throw new ResultError('enveloppe @@JSON@@ sans @@END@@ : résultat tronqué');
  return {text: text.slice(start + 8, end), envelope: true};
}

// Text of a marker or of --result -> {kind: 'json'|'text', value, text, envelope}.
export function interpret(text, {raw = false} = {}) {
  const unwrapped = unwrapEnvelope(text);
  if (raw) return {kind: 'text', value: unwrapped.text, text: unwrapped.text, envelope: unwrapped.envelope};
  let value;
  try { value = JSON.parse(unwrapped.text); } catch (error) {
    throw new ResultError(`le résultat n'est pas du JSON (${error.message}) ; --text pour accepter un texte`, {preview: unwrapped.text.slice(0, 300)});
  }
  return {kind: 'json', value, text: unwrapped.text, envelope: unwrapped.envelope};
}

const MIME_EXTENSIONS = {png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', gif: 'gif', bmp: 'bmp'};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function fileNameFor(name, used) {
  let base = String(name).replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, m => '_'.repeat(m.length)) || '_';
  let candidate = base, n = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${base}-${n++}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

// Writes the data:image/...;base64 captures of value.shots to dir and removes them from value.
export function extractShots(value, dir) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !value.shots || typeof value.shots !== 'object') return null;
  mkdirSync(dir, {recursive: true});
  const used = new Set(), shots = [];
  for (const [name, url] of Object.entries(value.shots)) {
    const m = typeof url === 'string' ? /^data:image\/([a-z0-9.+-]+);base64,/i.exec(url) : null;
    const extension = m && MIME_EXTENSIONS[m[1].toLowerCase()];
    if (!extension) { shots.push({name, skipped: typeof url === 'string' ? `not a data:image URL (${url.slice(0, 40)})` : `not a string (${typeof url})`}); continue; }
    const bytes = Buffer.from(url.slice(m[0].length), 'base64');
    const file = join(dir, `${fileNameFor(name, used)}.${extension}`);
    writeFileSync(file, bytes);
    const shot = {name, file, bytes: bytes.length, sha256: sha256(bytes)};
    if (extension === 'png') {
      try { const image = decodePNG(bytes); Object.assign(shot, {width: image.width, height: image.height, pixelsSha256: imageSha256(image)}); }
      catch (error) { shot.decodeError = error.message; }
    }
    shots.push(shot);
  }
  delete value.shots;
  return shots;
}

const ownProfiles = () => { try { return readdirSync(tmpdir()).filter(name => name.startsWith(`${PROFILE_PREFIX}${process.pid}-`)); } catch { return []; } };
const delay = ms => new Promise(done => setTimeout(done, ms));
// The marker that extractMarker() would choose in the serialised DOM: first id of the list
// that a <pre> carries, last <pre> with that id. read: {id, text} or null; else non-empty?
const markerProbe = (ids, read) => `(() => {
  for (const id of ${JSON.stringify(ids)}) {
    const list = Array.prototype.filter.call(document.getElementsByTagName('pre'), el => el.id === id);
    if (!list.length) continue;
    const text = list[list.length - 1].textContent;
    return ${read ? '{id, text}' : 'text.length > 0'};
  }
  return ${read ? 'null' : 'false'};
})()`;

function chromeLaunchOptions(o) {
  return {chromePath: o.chromePath, angle: o.angle, window: o.window, dpr: o.dpr, extraArgs: o.chromeArgs, timeoutMs: o.timeoutMs};
}

async function runDump(o, report) {
  let details;
  try {
    details = await dumpDomDetails(o.page, {...chromeLaunchOptions(o), query: o.query, hash: o.hash, virtualTimeBudgetMs: o.budgetMs});
  } finally {
    report.chrome = {version: chromeVersion(o.chrome.chromePath)};
  }
  Object.assign(report.chrome, {args: details.args.map(a => a.startsWith('--user-data-dir=') ? '--user-data-dir=<profil jetable>' : a)});
  report.close = details.close;
  report.timings.chromeMs = Math.round(details.ms);
  report.domBytes = Buffer.byteLength(details.html);
  const ids = o.marker ? [o.marker] : DEFAULT_MARKERS;
  const found = extractMarker(details.html, ids);
  if (!found) throw new ResultError(`aucun marqueur <pre id="${ids.join('|')}"> dans le DOM (${report.domBytes} octets)`, {preview: details.html.slice(-600)});
  report.marker = {id: found.id, closed: found.closed};
  if (!found.text.length) throw new ResultError(`<pre id="${found.id}"> vide : rien n'était écrit à la fin du chargement (page asynchrone : --budget pour le temps virtuel, ou --mode cdp)`);
  return found.text;
}

async function poll(page, expression, deadline, report, label = `--wait ${expression}`) {
  const started = Date.now();
  let polls = 0, lastError = null;
  for (;;) {
    polls++;
    try {
      if (await page.evaluate(`Promise.resolve(${expression}).then(v => !!v)`, {timeoutMs: Math.max(1, deadline - Date.now())})) break;
      lastError = null;
    } catch (error) {
      if (error.code !== 'PAGE_EXCEPTION') throw error;
      if (/SyntaxError/.test(error.message)) throw new UsageError(`--wait : ${error.message}`);
      lastError = error.message; // not ready yet (e.g. an object the page has not created)
    }
    if (Date.now() + DEFAULTS.pollMs >= deadline) throw new ResultError(`délai dépassé après ${Date.now() - started} ms d'attente : ${label}${lastError ? ` (dernière exception : ${lastError})` : ''}`);
    await delay(DEFAULTS.pollMs);
  }
  report.wait = {expression: label, polls, ms: Date.now() - started};
}

async function runCdp(o, report) {
  const deadline = Date.now() + o.timeoutMs, left = () => Math.max(1, deadline - Date.now());
  const ids = o.marker ? [o.marker] : DEFAULT_MARKERS;
  const source = o.result !== undefined ? 'expression' : o.images.length && !o.marker ? 'images' : 'marker';
  const onConsole = o.console ? entry => process.stderr.write(`[console.${entry.type}] ${entry.text}\n`) : null;
  const browser = await launch({...chromeLaunchOptions(o), onConsole, launchTimeoutMs: Math.min(30000, o.timeoutMs)});
  let page = null;
  try {
    report.chrome = {version: browser.version.product, revision: browser.version.revision, userAgent: browser.version.userAgent,
      args: browser.args.map(a => a.startsWith('--user-data-dir=') ? '--user-data-dir=<profil jetable>' : a)};
    page = await browser.openPage(o.page, {query: o.query, hash: o.hash, timeoutMs: left()});
    report.timings.loadedMs = Math.round(performance.now() - report.started);
    if (o.call !== undefined) {
      await page.evaluate(`(${o.call})(...${JSON.stringify(o.args)})`, {timeoutMs: left()});
      report.call = {expression: o.call, args: o.args.length};
    }
    if (o.wait !== undefined) await poll(page, o.wait, deadline, report);
    else if (source === 'marker') await poll(page, markerProbe(ids, false), deadline, report, `un <pre id="${ids.join('|')}"> non vide`);
    if (o.images.length) {
      report.images = {};
      for (const spec of o.images) {
        const raw = await page.image(spec.expression, {origin: 'top-left', timeoutMs: left()});
        const origin = spec.origin || (raw.extra?.origin === 'top-left' || raw.extra?.origin === 'bottom-left' ? raw.extra.origin : 'bottom-left');
        const image = origin === 'bottom-left' ? {width: raw.width, height: raw.height, data: flipRows(raw.data, raw.width, raw.height)} : {width: raw.width, height: raw.height, data: raw.data};
        const entry = {width: image.width, height: image.height, origin, sha256: imageSha256(image), sourceSha256: raw.sourceSha256, transferVerified: raw.transferVerified};
        if (o.pngDir) entry.png = writePNG(join(o.pngDir, `${spec.id}.png`), image);
        report.images[spec.id] = entry;
      }
    }
    if (source === 'images') return {json: {images: Object.fromEntries(Object.entries(report.images).map(([id, e]) => [id, {width: e.width, height: e.height, origin: e.origin, sha256: e.sha256}]))}};
    if (source === 'expression') {
      const value = await page.evaluate(o.result, {timeoutMs: left()});
      if (value === undefined) throw new ResultError(`--result a rendu undefined : ${o.result}`);
      return typeof value === 'string' ? value : {json: value};
    }
    const found = await page.evaluate(markerProbe(ids, true), {timeoutMs: left()});
    if (!found) throw new ResultError(`aucun marqueur <pre id="${ids.join('|')}"> dans la page`);
    report.marker = {id: found.id, closed: true};
    if (!found.text.length) throw new ResultError(`<pre id="${found.id}"> vide`);
    return found.text;
  } finally {
    if (page) report.page.console = {messages: page.console.length, errors: page.errors.slice(0, 20)};
    report.close = await browser.close();
  }
}

function summary(report, o) {
  const lines = [`Page : ${report.page.url} (${report.page.mode}, ${o.chrome.width}x${o.chrome.height}, dpr ${o.chrome.dpr}${o.budgetMs ? `, temps virtuel ${o.budgetMs} ms` : ''}, délai ${o.timeoutMs / 1000} s)`];
  const t = report.tool, source = {option: '--angle', [ANGLE_ENV]: ANGLE_ENV, platform: 'défaut de la plateforme'}[t.angleSource] || t.angleSource;
  lines.push(`Chrome : ${report.chrome?.version || 'n/d'} ; drapeaux GPU : ${t.gpuFlags.length ? t.gpuFlags.join(' ') : 'aucun (défaut de Chrome)'} (${source})`);
  if (report.wait) lines.push(`Attente : ${report.wait.polls} sondage(s), ${report.wait.ms} ms`);
  if (report.result) {
    const r = report.result;
    lines.push(`Résultat : ${report.marker ? `<pre id="${report.marker.id}">` : r.source}${r.envelope ? ', enveloppe @@JSON@@ retirée' : ''} ; ${r.kind === 'json' ? 'JSON' : 'texte'} ${r.bytes} octets${r.keys ? ` ; clés : ${r.keys.slice(0, 12).join(', ')}${r.keys.length > 12 ? '…' : ''}` : ''}`);
    if (r.pageErrors !== undefined) lines.push(`Erreurs signalées par la page : ${r.pageErrors}${r.firstPageError ? ` (première : ${r.firstPageError})` : ''}`);
  }
  if (report.shots) lines.push(`Captures : ${report.shots.filter(s => s.file).length} fichier(s) dans ${o.pngDir}${report.shots.some(s => s.skipped) ? `, ${report.shots.filter(s => s.skipped).length} ignorée(s)` : ''} ; shots retiré du JSON`);
  if (report.images) for (const [id, e] of Object.entries(report.images)) lines.push(`  image ${id} ${e.width}x${e.height} ${e.origin} ${e.sha256}`);
  if (report.page.console?.errors?.length) lines.push(`Exceptions de la page : ${report.page.console.errors.length} (première : ${String(report.page.console.errors[0]).split('\n')[0].slice(0, 200)})`);
  const cleanup = report.cleanup;
  lines.push(`Durée : ${(report.timings.totalMs / 1000).toFixed(1)} s ; profil ${cleanup.profileRemoved && !cleanup.profilesLeft.length ? 'supprimé' : 'RESTANT : ' + cleanup.profilesLeft.join(', ')}${cleanup.singletonDir ? `, dossier ${cleanup.singletonDir.removed ? 'supprimé' : 'RESTANT'} : ${cleanup.singletonDir.path}` : ''}`);
  lines.push(report.ok ? 'OK' : `ÉCHEC (code ${report.exitCode}) : ${report.failure}`);
  return lines;
}

export async function run(argv) {
  let o;
  try { o = parseArgs(argv); } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    process.stderr.write(`run-page : ${error.message}\n`);
    return 2;
  }
  if (o.help) { process.stdout.write(USAGE); return 0; }
  const started = performance.now();
  const report = {schema: SCHEMA, date: new Date().toISOString(), ok: false, exitCode: null, failure: null, started,
    tool: {node: process.version, platform: `${process.platform} ${process.arch}`, chromePath: o.chrome.chromePath, angle: o.chrome.angle,
      angleSource: o.chrome.angleSource, gpuFlags: gpuFlags(o.chrome.angle, o.chrome.platform)},
    page: {target: o.page, url: o.url, mode: o.mode, window: [o.chrome.width, o.chrome.height], dpr: o.chrome.dpr, timeoutMs: o.timeoutMs,
      budgetMs: o.budgetMs ?? null, query: o.query, hash: o.hash ?? null},
    timings: {}};
  let code = 1;
  try {
    const produced = o.mode === 'dump' ? await runDump(o, report) : await runCdp(o, report);
    let outcome;
    if (typeof produced === 'string') outcome = interpret(produced, {raw: o.text});
    else outcome = o.text ? {kind: 'text', value: JSON.stringify(produced.json), text: JSON.stringify(produced.json), envelope: false}
      : {kind: 'json', value: produced.json, text: JSON.stringify(produced.json), envelope: false};
    let text = outcome.text;
    if (o.pngDir && outcome.kind === 'json') {
      report.shots = extractShots(outcome.value, o.pngDir);
      if (report.shots) text = JSON.stringify(outcome.value);
    }
    const value = outcome.kind === 'json' ? outcome.value : null;
    report.result = {source: o.mode === 'dump' || report.marker ? 'marker' : o.result !== undefined ? '--result' : '--image', kind: outcome.kind, envelope: outcome.envelope,
      bytes: Buffer.byteLength(text), sha256: sha256(text)};
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      report.result.keys = Object.keys(value);
      if (Array.isArray(value.errors)) { report.result.pageErrors = value.errors.length; if (value.errors.length) report.result.firstPageError = String(value.errors[0]).slice(0, 300); }
    }
    if (o.out) { mkdirSync(dirname(o.out), {recursive: true}); writeFileSync(o.out, text); }
    else process.stdout.write(text);
    report.ok = true;
    code = 0;
  } catch (error) {
    if (error instanceof UsageError) code = 2;
    else if (['REFUSED_ARGUMENT', 'NOT_FILE_URL', 'PAGE_NOT_FOUND', 'TMPDIR_TOO_LONG'].includes(error.code)) code = 2;
    report.failure = error instanceof ResultError || error instanceof UsageError ? error.message : `${error.code ? error.code + ' : ' : ''}${error.message}`;
    if (error.preview) report.preview = error.preview;
    if (error.details?.close) report.close = error.details.close;
  }
  report.exitCode = code;
  report.timings.totalMs = Math.round(performance.now() - started);
  delete report.started;
  report.cleanup = {profilesLeft: ownProfiles(), profileRemoved: report.close ? !!report.close.profileRemoved : null, singletonDir: report.close?.singletonDir || null};
  if (report.cleanup.profilesLeft.length && code === 0) { code = 1; report.exitCode = 1; report.ok = false; report.failure = `profil jetable restant : ${report.cleanup.profilesLeft.join(', ')}`; }
  if (o.meta) { mkdirSync(dirname(o.meta), {recursive: true}); writeFileSync(o.meta, JSON.stringify(report, null, 2) + '\n'); }
  process.stderr.write(summary(report, o).join('\n') + '\n');
  if (report.preview && !report.ok) process.stderr.write(`Extrait : ${report.preview.replace(/\s+/g, ' ').slice(0, 600)}\n`);
  return code;
}

export const RUN_PAGE = fileURLToPath(import.meta.url);

// Main module, also when reached through a symbolic link (/tmp on macOS): Node gives
// import.meta.url as the real path, process.argv[1] as typed.
const invokedAs = (() => { try { return process.argv[1] && realpathSync(process.argv[1]); } catch { return null; } })();
if (invokedAs && invokedAs === realpathSync(RUN_PAGE)) {
  process.exitCode = await run(process.argv.slice(2));
}
