import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const s = readFileSync(new URL('./musicvar/src/music.js', import.meta.url), 'utf8'); const win = {}; globalThis.window = win; vm.runInThisContext(s);
const M = win.FMusic; for (const st of [0, 1, 2]) M.getModule(st);
const t = {def: [], vari: []};
for (let i = 0; i < 12; i++) for (const st of [0, 1, 2]) { let a = performance.now(); M.getModule(st, 1000 + i); t.vari.push(performance.now() - a); }
console.log(JSON.stringify({variedModuleBuildMs: {min: +Math.min(...t.vari).toFixed(2), median: +t.vari.sort((a, b) => a - b)[t.vari.length >> 1].toFixed(2), max: +Math.max(...t.vari).toFixed(1)}}));
