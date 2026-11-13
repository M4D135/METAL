// Sonde T4 : pilote Chrome sans tête par CDP sur --remote-debugging-pipe (fd 3/4), sans port.
// Pages A (avant) et B (après) jouées en alternance, appariées par répétition.
// node chrome-drive.mjs <A.html> <B.html> <répétitions> <sortie.json> [profil]
import {spawn} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [pageA, pageB, repsArg = '6', out, profileArg] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = profileArg || resolve(out + '.profile');
rmSync(profile, {recursive: true, force: true}); mkdirSync(profile, {recursive: true});
const args = ['--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--use-angle=metal', '--ignore-gpu-blocklist',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-component-update',
  '--disable-sync', '--metrics-recording-only', '--disable-domain-reliability', '--host-resolver-rules=MAP * ~NOTFOUND',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720', '--force-device-scale-factor=1', 'about:blank'];
const child = spawn(CHROME, args, {stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe']});
let stderr = ''; child.stdio[2].on('data', d => { stderr = (stderr + d).slice(-4000); });
const toChrome = child.stdio[3], fromChrome = child.stdio[4];
let seq = 0, buf = '';
const pending = new Map(), listeners = [];
fromChrome.on('data', chunk => {
  buf += chunk.toString('utf8'); let at;
  while ((at = buf.indexOf('\0')) >= 0) {
    const msg = JSON.parse(buf.slice(0, at)); buf = buf.slice(at + 1);
    if (msg.id && pending.has(msg.id)) { const {ok, ko} = pending.get(msg.id); pending.delete(msg.id); msg.error ? ko(new Error(JSON.stringify(msg.error))) : ok(msg.result); }
    else for (const f of listeners.slice()) f(msg);
  }
});
const send = (method, params = {}, sessionId) => new Promise((ok, ko) => { const id = ++seq; pending.set(id, {ok, ko}); toChrome.write(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}) + '\0'); });
const once = (pred, ms = 60000) => new Promise((ok, ko) => { const tm = setTimeout(() => ko(new Error('timeout')), ms); const f = m => { if (pred(m)) { clearTimeout(tm); listeners.splice(listeners.indexOf(f), 1); ok(m); } }; listeners.push(f); });
async function play(page) {
  const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
  const errors = [];
  listeners.push(m => { if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text); });
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setFocusEmulationEnabled', {enabled: true}, sessionId);
  await send('Page.enable', {}, sessionId);
  const loaded = once(m => m.method === 'Page.loadEventFired' && m.sessionId === sessionId);
  await send('Page.navigate', {url: pathToFileURL(resolve(page)).href}, sessionId);
  await loaded;
  const r = await send('Runtime.evaluate', {expression: 'window.__t4run()', awaitPromise: true, returnByValue: true}, sessionId);
  await send('Target.closeTarget', {targetId});
  if (r.exceptionDetails) return {page, error: r.exceptionDetails.exception?.description || r.exceptionDetails.text, errors};
  return {page, ...r.result.value, errors};
}
const runs = [];
try {
  const version = await send('Browser.getVersion');
  for (let rep = 0; rep < +repsArg; rep++) {
    const order = rep % 2 ? [['B', pageB], ['A', pageA]] : [['A', pageA], ['B', pageB]];
    for (const [variant, page] of order) { const t0 = performance.now(); const result = await play(page); runs.push({rep, variant, ms: Math.round(performance.now() - t0), ...result}); process.stderr.write(`${rep} ${variant} ${result.error || (result.cases || []).length + ' prises'}\n`); }
  }
  writeFileSync(out, JSON.stringify({product: version.product, args, reps: +repsArg, runs}, null, 1));
  await send('Browser.close').catch(() => {});
} catch (e) {
  console.error('ERREUR', e.message, stderr.slice(-2000)); child.kill('SIGKILL'); process.exitCode = 1;
} finally {
  await new Promise(r => { if (child.exitCode !== null) r(); else child.once('exit', r); setTimeout(r, 5000); });
  rmSync(profile, {recursive: true, force: true});
}
