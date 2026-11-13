// STAB — prototype d'ordonnanceur de tâches à budget par image (FERRO : FSchedule), essayé sur une charge réelle :
// la pré-synthèse des 64 tampons PCM de FAudio (aujourd'hui : lots de 2 effets par minuterie, audio.js:302).
// node sched.mjs <racine METAL>     (domaine principal, temps CPU du fil)
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const root = process.argv[2]; globalThis.window = globalThis;
for (const n of ['music', 'audio']) vm.runInThisContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), {filename: n + '.js'});
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
// ---------- FSchedule (prototype) ----------
// add(task) : task = {lane:'frame'|'sim', priority (0 = urgent), cost (ms estimés), run(deadline) -> true si terminé, sinon rappelé}
// pump(budgetMs, now) : exécute les tâches 'frame' tant que le budget n'est pas dépassé ; une tâche plus longue que le budget
//   restant n'est lancée que si rien n'a encore tourné dans l'image (pas de famine), et son coût mesuré corrige l'estimation.
// pumpSim(units) : file déterministe, budget en UNITÉS DE TRAVAIL (jamais en ms) : même résultat sur toutes les machines.
function createSchedule(now) {
  const q = [], simQ = []; let seq = 0; const stats = {ran: 0, overrunMs: 0, maxSliceMs: 0, skipped: 0};
  const order = (a, b) => a.priority - b.priority || a.seq - b.seq;
  return {stats, get pending() { return q.length; },
    add(task) { const t = {lane: 'frame', priority: 5, cost: 1, age: 0, ...task, seq: seq++}; (t.lane === 'sim' ? simQ : q).push(t); (t.lane === 'sim' ? simQ : q).sort(order); return t; },
    pump(budgetMs) { const start = now(); let used = 0, ran = 0;
      for (let i = 0; i < q.length;) { const t = q[i], left = budgetMs - used;
        if (ran > 0 && t.cost > left) { t.age++; if (t.age > 30) t.priority = Math.max(0, t.priority - 1); stats.skipped++; i++; continue; } // vieillissement : pas de famine
        const a = now(), done = t.run(a + left) !== false, d = now() - a; used = now() - start; ran++; stats.ran++; t.cost = t.cost * .5 + d * .5; stats.maxSliceMs = Math.max(stats.maxSliceMs, d);
        if (done) q.splice(i, 1); else i++; if (used >= budgetMs) break; }
      if (used > budgetMs) stats.overrunMs += used - budgetMs; return used; },
    pumpSim(units) { let left = units; while (simQ.length && left > 0) { const t = simQ[0], used = t.run(left); left -= Math.max(1, used | 0); if (t.done) simQ.shift(); } return units - left; }};
}
// ---------- charge réelle : 64 tampons ----------
const names = FAudio.effectNames, jobs = []; for (const n of names) for (let v = 0; v < (n.startsWith('motor:') ? 1 : 2); v++) jobs.push([n, v]);
for (const [n, v] of jobs) FAudio.synthesize(n, v, 22050); // compilation à chaud des deux variantes mesurées
// A. aujourd'hui : lots de 2 noms (jusqu'à 4 tampons) par tâche
function current() { const slices = []; for (let i = 0; i < names.length; i += 2) { const a = cpu(); for (const n of names.slice(i, i + 2)) for (let v = 0; v < (n.startsWith('motor:') ? 1 : 2); v++) FAudio.synthesize(n, v, 22050); slices.push(cpu() - a); } return slices; }
// B. ordonnanceur : un tampon par tâche, budget par image
function scheduled(budget) { const S = createSchedule(cpu); for (const [n, v] of jobs) S.add({priority: 6, cost: 2, run() { FAudio.synthesize(n, v, 22050); }}); const frames = []; while (S.pending) frames.push(S.pump(budget)); return {frames, stats: S.stats}; }
const st = a => { const s = a.slice().sort((x, y) => x - y); return {n: s.length, total: +s.reduce((x, y) => x + y, 0).toFixed(0), p50: +s[s.length >> 1].toFixed(2), p95: +s[Math.floor(s.length * .95)].toFixed(2), max: +s[s.length - 1].toFixed(2), over4: s.filter(v => v > 4).length, over8: s.filter(v => v > 8).length, over16: s.filter(v => v > 16.7).length}; };
for (let rep = 0; rep < 3; rep++) { const A = current(), B = scheduled(4), C = scheduled(2);
  console.log(JSON.stringify({rep, lotsActuels: st(A), ordonnanceur4ms: st(B.frames), ordonnanceur2ms: st(C.frames), plusLongueTacheMs: +B.stats.maxSliceMs.toFixed(2)})); }
// C. file déterministe : même découpage quelle que soit la machine (budget en unités)
{ const S = createSchedule(cpu); let cells = 40000; const log = []; S.add({lane: 'sim', run(units) { const n = Math.min(units, cells); cells -= n; this.done = cells === 0; return n; }}); let steps = 0; while (cells > 0) { log.push(S.pumpSim(768)); steps++; } console.log(JSON.stringify({fileDeterministe: {unitesParPas: 768, pas: steps, dernier: log.at(-1)}})); }
process.exit(0);
