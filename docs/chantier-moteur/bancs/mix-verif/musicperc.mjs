// Vérification MIX-10 : variété réelle par canal du module varié (copie patchée par musicvar.mjs)
import {readFileSync} from 'node:fs'; import vm from 'node:vm'; import {createHash} from 'node:crypto';
const s = readFileSync(new URL('./musicvar/src/music.js', import.meta.url), 'utf8'), B = {}; vm.runInNewContext(s, B);
const hash = b => createHash('sha256').update(b).digest('hex').slice(0, 8);
const bpm = [100, 170, 145];
for (const seed of [undefined, 1, 7, 2026]) for (let stage = 0; stage < 3; stage++) {
  const bytes = B.FMusic.getModule(stage, seed), order = Array.from(bytes.slice(952, 952 + bytes[950])), count = Math.max(...order) + 1;
  const chan = (p, list) => { const out = []; for (let r = 0; r < 64; r++) for (const c of list) for (let k = 0; k < 4; k++) out.push(bytes[1084 + p * 1024 + (r * 4 + c) * 4 + k]); return hash(Uint8Array.from(out)); };
  const res = {};
  for (const [tag, list] of [['ch01', [0, 1]], ['ch2', [2]], ['ch3', [3]], ['ch012', [0, 1, 2]]]) {
    const seq = order.map(p => chan(p, list)); res[tag] = new Set(seq).size;
    if (tag === 'ch012' || tag === 'ch01') { const n = 4, seen = new Map(); let first = null, rep = 0; for (let i = 0; i + n <= seq.length; i++) { const k = seq.slice(i, i + n).join(); if (seen.has(k)) { rep++; if (!first) first = i; } else seen.set(k, i); } res[tag + '_rep4'] = rep + '/' + (seq.length - n + 1) + (first !== null ? ' première à ' + (first * 960 / bpm[stage]).toFixed(0) + ' s' : ''); }
  }
  // part des mesures de batterie changées et des positions avec réponse coupée
  console.log(JSON.stringify({seed: seed ?? 'défaut', stage, positions: order.length, ...res}));
}
