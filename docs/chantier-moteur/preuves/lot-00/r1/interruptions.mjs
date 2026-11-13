// Lot 00 / R1 — interrupts the whole render self-check at several moments, like Ctrl-C in a
// terminal (SIGINT to its process group) or `kill` (SIGTERM to its pid), then looks for leftovers:
// metal-render-* profiles in the temporary folder and processes still using one.
// Run from the repository root: node docs/chantier-moteur/preuves/lot-00/r1/interruptions.mjs [out.json]
import {spawn, execFileSync} from 'node:child_process';
import {readdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

const selfCheck = resolve('tools/render/self-check.mjs');
const delay = ms => new Promise(done => setTimeout(done, ms));
const profiles = () => readdirSync(tmpdir()).filter(name => name.startsWith('metal-render-'));
const users = () => execFileSync('ps', ['-A', '-ww', '-o', 'pid=,command='], {encoding: 'utf8'}).split('\n')
  .filter(line => line.includes('metal-render-') && !line.includes('interruptions.mjs')).map(line => line.trim().slice(0, 160));
const plan = [['SIGINT', 400], ['SIGINT', 1200], ['SIGINT', 2500], ['SIGINT', 3600], ['SIGINT', 4600], ['SIGINT', 5600], ['SIGTERM', 1000], ['SIGTERM', 4000]];
const rows = [];
for (const [signal, afterMs] of plan) {
  const before = profiles();
  const child = spawn(process.execPath, [selfCheck, '--out', '/dev/null'], {stdio: ['ignore', 'ignore', 'pipe'], detached: true});
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', text => { stderr += text; });
  const exited = new Promise(done => child.once('exit', (code, sig) => done({code, signal: sig})));
  await delay(afterMs);
  try { process.kill(signal === 'SIGINT' ? -child.pid : child.pid, signal); } catch {}
  let timer;
  const exit = await Promise.race([exited, new Promise(done => { timer = setTimeout(done, 20000, null); })]).finally(() => clearTimeout(timer));
  await delay(1500);
  const lastLine = stderr.trim().split('\n').pop() || '';
  rows.push({signal, afterMs, exit, profilesBefore: before.length, profilesAfter: profiles(), processesAfter: users(), lastStderrLine: lastLine.slice(0, 200)});
}
const report = {schema: 'metal-render-r1-interruptions-v1', selfCheck, rows, clean: rows.every(r => r.exit && !r.profilesAfter.length && !r.processesAfter.length)};
const text = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], text);
process.stdout.write(text);
process.exitCode = report.clean ? 0 : 1;
