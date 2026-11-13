// Résumé des sondes Chrome T4 (téléportation, repli) : node chrome-resume-teleport.mjs <passage>.json …
import {readFileSync} from 'node:fs';
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? +(s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(2) : null; };
const max = a => a.length ? +Math.max(...a).toFixed(2) : null;
const out = [];
for (const file of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(file, 'utf8')), rows = {};
  for (const v of ['A', 'B']) {
    const runs = j.runs.filter(r => r.variant === v), cases = runs.flatMap(r => r.cases || []).filter(c => !c.error);
    rows[v] = {
      pages: runs.length, prises: cases.length, errors: runs.flatMap(r => (r.cases || []).filter(c => c.error)).length + runs.filter(r => r.error).length,
      chars: [Math.min(...cases.map(c => c.chars)), Math.max(...cases.map(c => c.chars))],
      snapshotAllInFrame: cases.every(c => c.snapshotInFrame), snapshotInFlight: cases.filter(c => c.airborne).length,
      breaches: cases.filter(c => c.blasted?.revisionChanged).length,
      inFrameStringify: cases.reduce((a, c) => a + c.inFrame.stringify, 0), inFrameSetItem: cases.reduce((a, c) => a + c.inFrame.setItem, 0),
      inFrameStringifySetItemMs: {median: median(cases.map(c => c.inFrame.stringifyMs + c.inFrame.setItemMs)), max: max(cases.map(c => c.inFrame.stringifyMs + c.inFrame.setItemMs))},
      deferredWrites: cases.reduce((a, c) => a + c.deferred.setItem, 0), deferredStringifySetItemMs: {median: median(cases.filter(c => c.deferred.setItem).map(c => c.deferred.stringifyMs + c.deferred.setItemMs)), max: max(cases.filter(c => c.deferred.setItem).map(c => c.deferred.stringifyMs + c.deferred.setItemMs))},
      writeDelayMs: {median: median(cases.map(c => c.deferred.delayMs)), max: max(cases.map(c => c.deferred.delayMs))},
      snapshotMs: {median: median(cases.map(c => c.snapshotMs)), max: max(cases.map(c => c.snapshotMs))},
      priseFrameMs: {median: median(cases.map(c => c.priseFrameMs)), max: max(cases.map(c => c.priseFrameMs))},
      priseMinusNeighbourMs: {median: median(cases.map(c => c.priseFrameMs - c.neighbourMedianMs))},
      ordinaryFrameMs: {median: median(runs.map(r => r.ordinaryMedianMs)), p95: median(runs.map(r => r.ordinaryP95Ms))},
      longTasksOverPrise: cases.reduce((a, c) => a + c.longTasksOverPrise, 0), longTasksPerPage: median(runs.map(r => r.longTasks)), longTaskMaxMs: max(runs.map(r => r.longTaskMaxMs)),
      pageErrors: runs.flatMap(r => r.errors || []).length,
    };
  }
  // Appariement : même répétition, A et B (ordre alterné), médiane des prises de chaque page.
  const pairs = [...new Set(j.runs.map(r => r.rep))].map(rep => { const pick = v => median((j.runs.find(r => r.rep === rep && r.variant === v)?.cases || []).map(c => c.priseFrameMs)); return {rep, a: pick('A'), b: pick('B')}; });
  out.push({file, product: j.product, gl: j.runs[0]?.gl, world: j.runs[0]?.world, reps: j.reps, A: rows.A, B: rows.B,
    pairedPriseFrameMs: {pairs: pairs.map(p => [p.a, p.b]), medianDifferenceMs: median(pairs.map(p => p.a - p.b)), medianRatio: median(pairs.map(p => p.b / p.a))}});
}
console.log(JSON.stringify(out, null, 1));
