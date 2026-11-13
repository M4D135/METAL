// Banc MIX — test de nullité de LOAD-13 : l'ordre et le découpage de la préparation ne changent pas le PCM.
// usage : node load13.mjs <racine METAL>
import {readFileSync} from 'node:fs'; import vm from 'node:vm'; import {createHash} from 'node:crypto';
const root = process.argv[2], h = createHash('sha256'), hx = b => createHash('sha256').update(Buffer.from(b.buffer, b.byteOffset, b.byteLength)).digest('hex');
const load = () => { const c = {window: {}, Math, console, performance}; c.window.setTimeout = (f) => setTimeout(f, 0); vm.createContext(c); for (const n of ['music', 'audio']) vm.runInContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), c); return c.window; };
const A = load(), B = load(), names = A.FAudio.effectNames, jobs = [];
for (const n of names) for (let v = 0; v < (n.startsWith('motor:') ? 1 : 2); v++) jobs.push([n, v]);
const fwd = new Map(), rev = new Map();
for (const [n, v] of jobs) fwd.set(n + v, hx(A.FAudio.synthesize(n, v, 22050)));
for (const [n, v] of jobs.slice().reverse()) rev.set(n + v, hx(B.FAudio.synthesize(n, v, 22050)));   // ordre inverse, une variante par tâche
let diff = 0; for (const [k, x] of fwd) if (rev.get(k) !== x) diff++;
// musique : A construit 0,1,2 par warmup (tranches), B construit 2,1,0 par getModule direct
for (const s of [0, 1, 2]) await A.FMusic.warmup(s);
const m = [0, 1, 2].map(s => hx(A.FMusic.getModule(s))), m2 = [2, 1, 0].map(s => [s, hx(B.FMusic.getModule(s))]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
console.log(JSON.stringify({tamponsEffets: jobs.length, tamponsDifferents: diff, modulesIdentiques: m.every((x, i) => x === m2[i]), differenceDb: diff === 0 && m.every((x, i) => x === m2[i]) ? '-Infinity (bit à bit)' : 'non nul'}));
