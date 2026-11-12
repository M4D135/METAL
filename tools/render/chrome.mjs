// Headless Chrome driven over the DevTools protocol on --remote-debugging-pipe
// (descriptors 3 and 4, NUL-separated JSON): no TCP port, no server, a throw-away
// profile removed on close, on error, on timeout and on SIGINT/SIGTERM/SIGHUP.
// Lot 00 / R1 (RCPU-V3, RGPU-11, PARA-13 point 5). Outside npm test and outside the
// game's size budget. API and limits: tools/render/README.md.
import {spawn, execFileSync} from 'node:child_process';
import {existsSync, mkdtempSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir, constants as osConstants} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {flipRows, imageSha256} from './png.mjs';

export const PROFILE_PREFIX = 'metal-render-';
const PROFILE_NAME = /^metal-render-(\d+)-[A-Za-z0-9]{6}$/;
const GROUP_KILL = process.platform !== 'win32';
const SLOTS = "globalThis[Symbol.for('metal-render-slots')]";
const LOG_LIMIT = 500;

// Flags of the verified prototype (pipe-probe.mjs), plus throttling and sound guards.
export const COMMON_FLAGS = Object.freeze([
  '--headless=new', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-sync',
  '--metrics-recording-only', '--disable-domain-reliability', '--host-resolver-rules=MAP * ~NOTFOUND',
  '--disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--mute-audio',
]);
// Never accepted in extraArgs: ports, file-access or security relaxations, and flags the launcher owns.
const FORBIDDEN_FLAG = /^--(remote-debugging-port|remote-debugging-address|remote-debugging-pipe|remote-allow-origins|allow-file-access-from-files|allow-file-access|disable-web-security|user-data-dir|headless|dump-dom|proxy-server|proxy-pac-url|host-resolver-rules|use-angle|window-size|force-device-scale-factor)(=|$)/;

export function defaultChromePath(env = process.env, platform = process.platform) {
  if (env.CHROME_PATH) return env.CHROME_PATH;
  const candidates = platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : platform === 'win32' ? [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean).map(base => join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidates.find(file => existsSync(file)) || candidates[0];
}

// ANGLE back end: Metal on macOS, Direct3D 11 on Windows (david-pc), Chrome's default elsewhere.
export function defaultAngle(platform = process.platform) {
  return platform === 'darwin' ? 'metal' : platform === 'win32' ? 'd3d11' : null;
}

function parseWindow(value) {
  const pair = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[x,]/i) : value && [value.width, value.height];
  const [width, height] = (pair || []).map(Number);
  if (![width, height].every(n => Number.isSafeInteger(n) && n >= 16 && n <= 16384)) throw new RangeError(`Invalid window size: ${JSON.stringify(value)}`);
  return [width, height];
}

function positive(value, fallback, name) {
  const n = value ?? fallback;
  if (!(Number.isFinite(n) && n > 0)) throw new RangeError(`Invalid ${name}: ${value}`);
  return n;
}

export function normalizeOptions(options = {}) {
  const [width, height] = parseWindow(options.window ?? [800, 600]);
  const dpr = positive(options.dpr, 1, 'dpr');
  if (dpr > 8) throw new RangeError(`Invalid dpr: ${dpr}`);
  const angle = options.angle === undefined ? defaultAngle() : options.angle && options.angle !== 'none' ? options.angle : null;
  if (angle !== null && !/^[a-z0-9-]+$/.test(angle)) throw new RangeError(`Invalid ANGLE back end: ${angle}`);
  const extraArgs = [...(options.extraArgs || [])];
  for (const arg of extraArgs) if (typeof arg !== 'string' || !arg.startsWith('--') || FORBIDDEN_FLAG.test(arg)) throw new Error(`Refused Chrome argument: ${arg}`);
  return {
    chromePath: options.chromePath || defaultChromePath(), angle, width, height, dpr, extraArgs,
    timeoutMs: positive(options.timeoutMs, 60000, 'timeoutMs'),
    launchTimeoutMs: positive(options.launchTimeoutMs, 30000, 'launchTimeoutMs'),
    closeTimeoutMs: positive(options.closeTimeoutMs, 5000, 'closeTimeoutMs'),
    tmpRoot: options.tmpRoot || tmpdir(),
    onConsole: typeof options.onConsole === 'function' ? options.onConsole : null,
  };
}

export function chromeArgs(o, profileDir) {
  return [...COMMON_FLAGS, `--user-data-dir=${profileDir}`, ...(o.angle ? [`--use-angle=${o.angle}`] : []),
    `--window-size=${o.width},${o.height}`, `--force-device-scale-factor=${o.dpr}`, ...o.extraArgs];
}

// file:// pages only: a path, a file: URL or about:blank. Query parameters are added to the URL.
export function pageUrl(target, query) {
  let url;
  if (target instanceof URL) url = new URL(target.href);
  else if (typeof target === 'string' && /^(file|about):/i.test(target)) url = new URL(target);
  else if (typeof target === 'string' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) {
    const file = resolve(target);
    if (!existsSync(file)) throw new Error(`Page not found: ${file}`);
    url = pathToFileURL(file);
  } else throw new Error(`Only file:// pages are allowed: ${target}`);
  if (url.protocol !== 'file:' && url.href !== 'about:blank') throw new Error(`Only file:// pages are allowed: ${url.href}`);
  if (query) for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  return url.href;
}

function settle(promise, ms) {
  let timer;
  return Promise.race([promise.then(() => true, () => true), new Promise(done => { timer = setTimeout(done, ms, false); })])
    .finally(() => clearTimeout(timer));
}

const delay = ms => new Promise(done => setTimeout(done, ms));

function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

// Profiles left by a Node process that was killed with SIGKILL (nothing can run then).
// Only metal-render-<pid>-XXXXXX folders of the temporary root whose owner process is gone.
export function sweepStaleProfiles(root = tmpdir()) {
  const removed = [];
  let names;
  try { names = readdirSync(root); } catch { return removed; }
  for (const name of names) {
    const match = PROFILE_NAME.exec(name);
    if (!match || Number(match[1]) === process.pid || processAlive(Number(match[1]))) continue;
    const dir = join(root, name);
    try { rmSync(dir, {recursive: true, force: true, maxRetries: 3, retryDelay: 20}); } catch {}
    if (!existsSync(dir)) removed.push(dir);
  }
  return removed;
}

// ---- Cleanup registry: every Chrome still alive or whose profile still exists ----
const live = new Set();
const SIGNALS = process.platform === 'win32' ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM', 'SIGHUP'];
let hooked = false, signalled = 0;

function hook() {
  if (hooked) return;
  hooked = true;
  for (const signal of SIGNALS) process.on(signal, onSignal);
  process.on('exit', onExit);
}

function unhook() {
  if (!hooked || live.size) return;
  hooked = false;
  for (const signal of SIGNALS) process.off(signal, onSignal);
  process.off('exit', onExit);
}

function onExit() {
  for (const proc of [...live]) proc.destroySync('process exit');
}

async function onSignal(signal) {
  if (++signalled > 1) { onExit(); process.exit(128 + (osConstants.signals[signal] || 1)); }
  await Promise.allSettled([...live].map(proc => proc.destroy(`signal ${signal}`)));
  signalled = 0;
  unhook();
  // Default action of the signal when the host program has no handler of its own.
  if (!process.listenerCount(signal)) process.kill(process.pid, signal);
}

class ChromeProcess {
  constructor(o) {
    this.o = o;
    this.profileDir = mkdtempSync(join(o.tmpRoot, `${PROFILE_PREFIX}${process.pid}-`));
    this.stderrTail = '';
    this.exitInfo = null;
    this.reason = null;
    this.closing = null;
    this.destroyed = null;
    this.profileRemoved = false;
    live.add(this);
    hook();
  }

  spawn(args, stdio) {
    this.args = args;
    try { this.child = spawn(this.o.chromePath, args, {stdio, detached: GROUP_KILL, windowsHide: true}); }
    catch (error) { this.destroySync('spawn failed'); throw error; }
    this.pid = this.child.pid;
    this.exited = new Promise(done => {
      this.child.once('exit', (code, signal) => { this.exitInfo = {code, signal}; done(this.exitInfo); });
      // 'on', not 'once': a failed kill (EPERM) emits a later 'error' that must not go uncaught.
      this.child.on('error', error => {
        this.spawnError ??= error;
        if (!this.child.pid && !this.exitInfo) { this.exitInfo = {code: null, signal: null, error: error.message}; done(this.exitInfo); }
      });
    });
    this.streamsClosed = new Promise(done => this.child.once('close', done));
    for (const stream of this.child.stdio) stream?.on('error', () => {});
    const err = this.child.stdio[2];
    if (err) { err.setEncoding('utf8'); err.on('data', text => { this.stderrTail = (this.stderrTail + text).slice(-16384); }); }
  }

  get running() { return !!this.child && !this.exitInfo; }

  killSync() {
    if (!this.pid) return;
    if (GROUP_KILL) try { process.kill(-this.pid, 'SIGKILL'); } catch {}
    if (this.child.exitCode === null && this.child.signalCode === null) try { this.child.kill('SIGKILL'); } catch {}
  }

  removeProfileSync() {
    try { rmSync(this.profileDir, {recursive: true, force: true, maxRetries: 10, retryDelay: 20}); } catch {}
    this.profileRemoved = !existsSync(this.profileDir);
    return this.profileRemoved;
  }

  destroySync(reason) {
    this.reason ??= reason;
    this.killSync();
    this.removeProfileSync();
    live.delete(this);
    unhook();
  }

  // Kills the whole process group, waits for the browser process, removes the profile.
  destroy(reason) {
    return this.destroyed ??= (async () => {
      this.reason ??= reason;
      this.killSync();
      if (this.child) await settle(this.exited, 5000);
      this.killSync(); // helpers of the same process group that outlived the browser process
      if (!this.removeProfileSync()) { await delay(250); this.removeProfileSync(); }
      live.delete(this);
      unhook();
      return {reason: this.reason, exit: this.exitInfo, profileRemoved: this.profileRemoved};
    })();
  }

  // Asks the browser to quit, then destroys it whatever happens.
  shutdown(graceful) {
    if (this.destroyed) return this.destroyed;
    return this.closing ??= (async () => {
      if (this.running) {
        this.reason ??= 'close requested';
        try { await graceful(); } catch {}
        if (!(await settle(this.exited, this.o.closeTimeoutMs))) this.reason = 'close timeout';
      }
      return this.destroy('close requested');
    })();
  }

  exitError(info) {
    const tail = this.reason ? '' : `\n${this.stderrTail.trim().split('\n').slice(-12).join('\n')}`;
    return Object.assign(new Error(`Chrome exited (code ${info.code ?? '-'}, signal ${info.signal ?? '-'})${this.reason ? ` after ${this.reason}` : ''}${tail}`), {code: 'CHROME_EXITED'});
  }
}

// ---- DevTools protocol over the pipe ----
class CdpPipe {
  constructor(input, output, onTimeout) {
    this.input = input;
    this.onTimeout = onTimeout;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Set();
    this.parts = [];
    this.failure = null;
    output.on('data', chunk => this.receive(chunk));
    output.on('error', error => this.fail(error));
    input.on('error', error => this.fail(error));
  }

  // Messages are split on NUL bytes, never inside a UTF-8 sequence: decode complete messages only.
  receive(chunk) {
    let start = 0, at;
    while ((at = chunk.indexOf(0, start)) >= 0) {
      const piece = chunk.subarray(start, at);
      const bytes = this.parts.length ? Buffer.concat([...this.parts, piece]) : piece;
      this.parts = [];
      start = at + 1;
      let message;
      try { message = JSON.parse(bytes.toString('utf8')); } catch { this.fail(new Error('Invalid DevTools message')); return; }
      this.dispatch(message);
    }
    if (start < chunk.length) this.parts.push(chunk.subarray(start));
  }

  dispatch(message) {
    if (message.id !== undefined) {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(Object.assign(new Error(`${entry.method}: ${message.error.message}${message.error.data ? ` (${message.error.data})` : ''}`), {code: 'CDP_ERROR', cdp: message.error}));
      else entry.resolve(message.result);
      return;
    }
    for (const listener of [...this.listeners]) listener(message);
  }

  send(method, params = {}, sessionId, timeoutMs) {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const entry = {resolve, reject, method, sessionId, timer: null};
      if (timeoutMs) entry.timer = setTimeout(() => {
        this.pending.delete(id);
        this.onTimeout(Object.assign(new Error(`DevTools timeout: ${method} after ${timeoutMs} ms`), {code: 'TIMEOUT'}), reject);
      }, timeoutMs);
      this.pending.set(id, entry);
      this.input.write(JSON.stringify(sessionId ? {id, method, params, sessionId} : {id, method, params}) + '\0');
    });
  }

  // Resolves with the first event matching predicate; promise.cancel() drops the wait silently.
  waitFor(predicate, {timeoutMs, label = 'event', sessionId} = {}) {
    let cancel = () => {};
    const promise = new Promise((resolve, reject) => {
      if (this.failure) { reject(this.failure); return; }
      let timer = null;
      const done = () => { clearTimeout(timer); this.listeners.delete(listener); };
      const listener = message => {
        if (message.failure) { if (!message.sessionId || message.sessionId === sessionId) { done(); reject(message.failure); } return; }
        let hit = false;
        try { hit = predicate(message); } catch (error) { done(); reject(error); return; }
        if (hit) { done(); resolve(message); }
      };
      if (timeoutMs) timer = setTimeout(() => {
        done();
        this.onTimeout(Object.assign(new Error(`DevTools timeout: ${label} after ${timeoutMs} ms`), {code: 'TIMEOUT'}), reject);
      }, timeoutMs);
      this.listeners.add(listener);
      cancel = () => { done(); resolve(null); };
    });
    promise.cancel = () => cancel();
    return promise;
  }

  failSession(sessionId, error) {
    for (const [id, entry] of this.pending) if (entry.sessionId === sessionId) { this.pending.delete(id); clearTimeout(entry.timer); entry.reject(error); }
    for (const listener of [...this.listeners]) listener({failure: error, sessionId});
  }

  fail(error) {
    if (this.failure) return;
    this.failure = error;
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    this.pending.clear();
    for (const listener of [...this.listeners]) listener({failure: error});
  }
}

function pageException(details, expression) {
  const text = details.exception?.description || details.exception?.value || details.text || 'exception';
  return Object.assign(new Error(`Page exception: ${text}`), {code: 'PAGE_EXCEPTION', details, expression: String(expression).slice(0, 300)});
}

let transferSeq = 0;

class Page {
  constructor(browser, targetId, sessionId, url) {
    this.browser = browser;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.url = url;
    this.console = [];
    this.errors = [];
    this.crashed = false;
  }

  send(method, params = {}, timeoutMs) {
    return this.browser.send(method, params, {sessionId: this.sessionId, timeoutMs});
  }

  // Evaluates an expression in the page; promises are awaited. The value comes back as JSON:
  // typed arrays do not, use bytes() or image() for binary data.
  async evaluate(expression, {timeoutMs, awaitPromise = true} = {}) {
    const result = await this.send('Runtime.evaluate', {expression: String(expression), awaitPromise, returnByValue: true}, timeoutMs);
    if (result.exceptionDetails) throw pageException(result.exceptionDetails, expression);
    return result.result.value;
  }

  // Calls a function in the page with JSON arguments: page.call((a, b) => a + b, 1, 2).
  call(fn, ...args) {
    const source = typeof fn === 'function' ? fn.toString() : String(fn);
    return this.evaluate(`(${source})(...${JSON.stringify(args)})`);
  }

  // Binary transfer: the expression yields an ArrayBuffer or a typed array (bytes), or for
  // image() an object {width, height, data|pixels, ...}. Bytes travel in base64 chunks and
  // are checked against a SHA-256 computed in the page (crypto.subtle, secure in file://).
  async transfer(expression, {image = false, timeoutMs, chunkBytes = 1 << 20, verify = true} = {}) {
    if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1024) throw new RangeError(`Invalid chunkBytes: ${chunkBytes}`);
    const slot = `t${++transferSeq}`;
    const meta = await this.evaluate(`(async () => {
      const value = await (${expression});
      const source = ${image} ? value && (value.data || value.pixels) : value;
      const view = source instanceof ArrayBuffer ? new Uint8Array(source)
        : ArrayBuffer.isView(source) ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength) : null;
      if (!view) throw new TypeError('expected an ArrayBuffer or a typed array${image ? ' in data or pixels' : ''}');
      const slots = ${SLOTS} || (${SLOTS} = new Map());
      slots.set('${slot}', view);
      let sha256 = null;
      if (${!!verify} && globalThis.crypto && crypto.subtle) sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', view)), x => x.toString(16).padStart(2, '0')).join('');
      const meta = {length: view.length, sha256};
      if (${image}) { const {data, pixels, ...extra} = value; Object.assign(meta, {width: value.width, height: value.height, extra}); }
      return meta;
    })()`, {timeoutMs});
    const parts = [];
    try {
      for (let offset = 0; offset < meta.length; offset += chunkBytes) {
        const base64 = await this.evaluate(`(() => {
          const u = ${SLOTS}.get('${slot}').subarray(${offset}, ${offset + chunkBytes});
          if (typeof u.toBase64 === 'function') return u.toBase64();
          let s = '';
          for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
          return btoa(s);
        })()`, {timeoutMs, awaitPromise: false});
        parts.push(Buffer.from(base64, 'base64'));
      }
    } finally {
      if (!this.browser.closed) await this.evaluate(`void ${SLOTS}?.delete('${slot}')`, {awaitPromise: false}).catch(() => {});
    }
    const bytes = Buffer.concat(parts);
    if (bytes.length !== meta.length) throw new Error(`Transfer: ${bytes.length} bytes received, ${meta.length} expected`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (meta.sha256 && meta.sha256 !== sha256) throw new Error('Transfer: SHA-256 differs between the page and Node');
    return {meta, bytes, sha256, verified: !!meta.sha256};
  }

  async bytes(expression, options = {}) {
    return (await this.transfer(expression, {...options, image: false})).bytes;
  }

  // RGBA8 image. origin 'bottom-left' (WebGL readPixels, the default) flips the rows so that
  // the result is top-down like a PNG; 'top-left' (Canvas 2D getImageData) keeps them.
  async image(expression, {origin = 'bottom-left', ...options} = {}) {
    if (origin !== 'bottom-left' && origin !== 'top-left') throw new RangeError(`origin must be bottom-left or top-left: ${origin}`);
    const {meta, bytes, sha256, verified} = await this.transfer(expression, {...options, image: true});
    const {width, height} = meta;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height * 4 !== bytes.length)
      throw new Error(`image: ${bytes.length} bytes for ${width}x${height} RGBA8`);
    const image = {width, height, data: origin === 'bottom-left' ? flipRows(bytes, width, height) : bytes};
    return {...image, origin, sha256: imageSha256(image), sourceSha256: sha256, transferVerified: verified, extra: meta.extra};
  }

  log(kind, entry) {
    const list = kind === 'error' ? this.errors : this.console;
    if (list.length < LOG_LIMIT) list.push(entry);
  }

  async close() {
    this.browser.pages.delete(this);
    if (this.browser.page === this) this.browser.page = null;
    if (!this.browser.closed) await this.browser.send('Target.closeTarget', {targetId: this.targetId});
  }
}

class Browser {
  constructor(proc, cdp, o, version, swept) {
    this.proc = proc;
    this.cdp = cdp;
    this.options = o;
    this.version = version;
    this.sweptProfiles = swept;
    this.pages = new Set();
    this.page = null;
    cdp.listeners.add(message => this.onEvent(message));
  }

  get pid() { return this.proc.pid; }
  get profileDir() { return this.proc.profileDir; }
  get args() { return [...this.proc.args]; }
  get closed() { return !!(this.proc.closing || this.proc.destroyed); }
  get stderr() { return this.proc.stderrTail; }

  // Raw DevTools command. A timeout kills Chrome (its state is then unknown) before rejecting.
  send(method, params = {}, {sessionId, timeoutMs = this.options.timeoutMs} = {}) {
    return this.cdp.send(method, params, sessionId, timeoutMs);
  }

  onEvent(message) {
    if (message.failure) return;
    if (message.method === 'Target.detachedFromTarget') {
      this.cdp.failSession(message.params.sessionId, new Error('Page detached'));
      return;
    }
    const page = message.sessionId && [...this.pages].find(p => p.sessionId === message.sessionId);
    if (!page) return;
    if (message.method === 'Runtime.consoleAPICalled') {
      const text = message.params.args.map(a => a.value !== undefined ? (typeof a.value === 'string' ? a.value : JSON.stringify(a.value)) : a.description ?? a.type).join(' ');
      page.log('console', {type: message.params.type, text});
      this.options.onConsole?.({type: message.params.type, text, url: page.url});
    } else if (message.method === 'Runtime.exceptionThrown') {
      const d = message.params.exceptionDetails;
      page.log('error', d.exception?.description || d.text);
    } else if (message.method === 'Inspector.targetCrashed') {
      page.crashed = true;
      this.cdp.failSession(page.sessionId, new Error(`Page crashed: ${page.url}`));
    }
  }

  // Opens a file:// page in a new target with a viewport of window (CSS pixels) and dpr,
  // and waits for its load event.
  async openPage(target, {query, window: size, dpr = this.options.dpr, timeoutMs = this.options.timeoutMs} = {}) {
    const url = pageUrl(target, query);
    const [width, height] = size ? parseWindow(size) : [this.options.width, this.options.height];
    const {targetId} = await this.send('Target.createTarget', {url: 'about:blank'});
    const {sessionId} = await this.send('Target.attachToTarget', {targetId, flatten: true});
    const page = new Page(this, targetId, sessionId, url);
    this.pages.add(page);
    try {
      for (const domain of ['Page', 'Runtime', 'Inspector']) await page.send(`${domain}.enable`);
      await page.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: dpr, mobile: false, screenWidth: width, screenHeight: height});
      const loaded = this.cdp.waitFor(m => m.method === 'Page.loadEventFired' && m.sessionId === sessionId, {timeoutMs, label: `load of ${url}`, sessionId});
      loaded.catch(() => {}); // still awaited below; never an unhandled rejection if navigate fails first
      const navigation = await page.send('Page.navigate', {url}, timeoutMs);
      if (navigation.errorText) { loaded.cancel(); throw new Error(`Navigation failed (${navigation.errorText}): ${url}`); }
      await loaded;
    } catch (error) {
      if (!this.closed) await page.close().catch(() => {});
      throw error;
    }
    this.page = page;
    return page;
  }

  // Shortcut on the last page opened.
  evaluate(expression, options) {
    if (!this.page) return Promise.reject(new Error('No page: call openPage() first'));
    return this.page.evaluate(expression, options);
  }

  // GPU description from the browser process (devices, driver, feature status).
  async systemInfo() {
    try {
      const info = await this.send('SystemInfo.getInfo', {}, {timeoutMs: 15000});
      const gpu = info.gpu || {};
      return {modelName: info.modelName, modelVersion: info.modelVersion, devices: gpu.devices || [], featureStatus: gpu.featureStatus || {},
        driverBugWorkarounds: (gpu.driverBugWorkarounds || []).length};
    } catch (error) { return {error: error.message}; }
  }

  // Browser process and every process of its group or descendant of it (ps; Unix only).
  processIds() {
    return this.closed ? [] : processTree(this.pid);
  }

  close() {
    return this.proc.shutdown(() => this.cdp.send('Browser.close', {}, undefined, this.options.closeTimeoutMs));
  }
}

export async function launch(options = {}) {
  const o = normalizeOptions(options);
  const swept = sweepStaleProfiles(o.tmpRoot);
  const proc = new ChromeProcess(o);
  proc.spawn([...chromeArgs(o, proc.profileDir), '--remote-debugging-pipe', 'about:blank'], ['ignore', 'ignore', 'pipe', 'pipe', 'pipe']);
  const cdp = new CdpPipe(proc.child.stdio[3], proc.child.stdio[4], (error, reject) => { proc.destroy(error.message).finally(() => reject(error)); });
  proc.exited.then(info => cdp.fail(proc.exitError(info)));
  try {
    const version = await cdp.send('Browser.getVersion', {}, undefined, o.launchTimeoutMs);
    return new Browser(proc, cdp, o, version, swept);
  } catch (error) {
    await proc.destroy('launch failed');
    if (proc.spawnError?.code === 'ENOENT') throw Object.assign(new Error(`Chrome not found: ${o.chromePath} (set CHROME_PATH or chromePath)`), {code: 'CHROME_NOT_FOUND'});
    throw Object.assign(new Error(`Chrome launch failed: ${error.message}`), {code: error.code});
  }
}

// launch(), run fn(browser), close in every case. Returns fn's result.
export async function withChrome(options, fn) {
  if (typeof options === 'function') [options, fn] = [{}, options];
  const browser = await launch(options);
  try { return await fn(browser); } finally { await browser.close(); }
}

// For legacy pages that print their result in the DOM: chrome --dump-dom, same flags,
// same throw-away profile and cleanup. Returns the serialised DOM after the load event
// (or after the virtual time budget).
export async function dumpDom(target, options = {}) {
  const o = normalizeOptions(options), url = pageUrl(target, options.query), budget = options.virtualTimeBudgetMs;
  const proc = new ChromeProcess(o), out = [];
  try {
    proc.spawn([...chromeArgs(o, proc.profileDir), ...(budget ? [`--virtual-time-budget=${Math.round(budget)}`] : []), '--dump-dom', url], ['ignore', 'pipe', 'pipe']);
    proc.child.stdout.on('data', chunk => out.push(chunk));
    if (!(await settle(proc.streamsClosed, o.timeoutMs))) throw Object.assign(new Error(`dumpDom timeout after ${o.timeoutMs} ms: ${url}`), {code: 'TIMEOUT'});
    if (proc.spawnError?.code === 'ENOENT') throw Object.assign(new Error(`Chrome not found: ${o.chromePath} (set CHROME_PATH or chromePath)`), {code: 'CHROME_NOT_FOUND'});
    await settle(proc.exited, 2000);
    if (proc.exitInfo?.code !== 0) throw new Error(`Chrome exited with code ${proc.exitInfo?.code}: ${proc.stderrTail.trim().split('\n').slice(-12).join('\n')}`);
    return Buffer.concat(out).toString('utf8');
  } finally {
    await proc.destroy('dump finished');
  }
}

// ---- Process diagnostics (Unix): process tree and Internet sockets ----
export function processTree(rootPid) {
  if (process.platform === 'win32') return processAlive(rootPid) ? [rootPid] : [];
  const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,pgid='], {encoding: 'utf8'}).trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
  const tree = new Set();
  for (const [pid, , pgid] of rows) if (pid === rootPid || pgid === rootPid) tree.add(pid);
  for (let grew = true; grew;) {
    grew = false;
    for (const [pid, ppid] of rows) if (!tree.has(pid) && tree.has(ppid)) { tree.add(pid); grew = true; }
  }
  return [...tree].sort((a, b) => a - b);
}

// lsof -n -P -a -p <pids> -i: Internet sockets (TCP or UDP, listening or not) of these processes.
export function internetSockets(pids) {
  if (!pids.length) return {tool: null, lines: [], pids};
  for (const tool of ['lsof', '/usr/sbin/lsof', '/usr/bin/lsof']) {
    try {
      const out = execFileSync(tool, ['-n', '-P', '-a', '-p', pids.join(','), '-i'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
      return {tool, pids, lines: out.trim().split('\n').filter(Boolean)};
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      if (error.status === 1) return {tool, pids, lines: String(error.stdout || '').trim().split('\n').filter(Boolean)};
      return {tool, pids, error: error.message, lines: []};
    }
  }
  return {tool: null, pids, lines: [], error: 'lsof unavailable'};
}

export function commandLine(pid) {
  if (process.platform === 'win32') return null;
  try { return execFileSync('ps', ['-ww', '-o', 'command=', '-p', String(pid)], {encoding: 'utf8'}).trim(); } catch { return null; }
}

export {processAlive};
