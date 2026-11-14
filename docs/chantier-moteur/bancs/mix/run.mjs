// Banc MIX — lanceur Linux/CI du banc, équivalent de run.py (qui vise le Chrome du Mac d'audit).
// Meme protocole : la page écrit console.log('MIXCHUNK <base64>') puis 'MIXDONE' sur stderr ;
// Chrome sans interface, page file://, aucun port réseau, aucun serveur, profil écrit à côté de lui.
// usage : node run.mjs <dossier-du-banc> <page[?requete]> [secondes] [sortie.json]
// Lanceur Linux du banc MIX : meme protocole que run.py (MIXCHUNK base64 sur stderr, puis MIXDONE),
// sans port ni reseau. Usage : node mixrun.mjs <dossier-du-banc> <page[?requete]> <secondes> [sortie.json]
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
const [dir, page, secs, out] = process.argv.slice(2);
if (!dir || !page) { console.error('usage : node mixrun.mjs <dossier> <page> [secondes] [sortie]'); process.exit(2); }
const timeout = Number(secs) || 280;
const profile = join(dir, 'chrome-profile-' + (process.env.MIX_PROFILE || String(process.pid)));
const cmd = ['--headless=new', '--disable-background-networking', '--disable-component-update', '--disable-sync',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--metrics-recording-only',
  '--disable-domain-reliability', '--disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions',
  '--no-sandbox', '--disable-dev-shm-usage', '--user-data-dir=' + profile, '--allow-file-access-from-files',
  '--mute-audio', '--enable-logging=stderr', '--log-level=0', '--window-size=800,600',
  'file://' + join(resolve(dir), page)];
const p = spawn('google-chrome', cmd, {stdio: ['ignore', 'ignore', 'pipe']});
const killer = setTimeout(() => p.kill('SIGKILL'), timeout * 1000);
let buf = '', done = false; const errors = [];
p.stderr.setEncoding('utf8');
p.stderr.on('data', chunk => {
  buf += chunk;
  let at;
  while ((at = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, at); buf = buf.slice(at + 1);
    const i = line.indexOf('MIXCHUNK ');
    if (i >= 0) errors.push({c: line.slice(i + 9).split('"')[0].trim()});
    else if (line.includes('MIXDONE')) done = true;
    else if (/CONSOLE/.test(line) && /(Uncaught|MIXERR|rror)/.test(line)) errors.push({e: line.trim()});
  }
  if (done) { clearTimeout(killer); p.kill('SIGTERM'); }
});
p.on('exit', () => {
  clearTimeout(killer);
  const b64 = errors.filter(x => x.c).map(x => x.c).join('');
  const err = errors.filter(x => x.e).map(x => x.e).slice(0, 20).join('\n');
  const text = b64 ? Buffer.from(b64, 'base64').toString('utf8') : '';
  if (out) writeFileSync(out, text); else process.stdout.write(text);
  if (err) console.error(err);
  if (!done) console.error('page non terminee (delai ou erreur)');
  process.exit(done ? 0 : 1);
});
