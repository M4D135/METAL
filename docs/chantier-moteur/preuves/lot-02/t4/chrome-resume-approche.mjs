// Résumé de la sonde T4 « approche à pied » : node chrome-resume-approche.mjs approche-<monde>.json …
import {readFileSync} from 'node:fs';
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? +(s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(2) : null; };
const max = a => { const s = a.filter(Number.isFinite); return s.length ? +Math.max(...s).toFixed(2) : null; };
const mm = a => ({median: median(a), max: max(a)});
const out = [];
for (const file of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(file, 'utf8')), rows = {};
  for (const v of ['A', 'B']) {
    const runs = j.runs.filter(r => r.variant === v), cases = runs.flatMap(r => r.cases || []).filter(c => !c.error);
    const own = c => c.snapshotMs + c.inFrame.stringifyMs + c.inFrame.setItemMs;
    rows[v] = {
      pages: runs.length, prises: cases.length, errors: runs.flatMap(r => (r.cases || []).filter(c => c.error)).length + runs.filter(r => r.error).length,
      chars: [Math.min(...cases.map(c => c.chars)), Math.max(...cases.map(c => c.chars))], walkFrames: mm(cases.map(c => c.walkFrames)),
      snapshotAllInFrame: cases.every(c => c.snapshotInFrame), snapshotInFlight: cases.filter(c => c.airborne).length, breaches: cases.filter(c => c.blasted?.revisionChanged).length,
      inFrameStringify: cases.reduce((a, c) => a + c.inFrame.stringify, 0), inFrameSetItem: cases.reduce((a, c) => a + c.inFrame.setItem, 0),
      inFrameStringifySetItemMs: mm(cases.map(c => c.inFrame.stringifyMs + c.inFrame.setItemMs)),
      snapshotMs: mm(cases.map(c => c.snapshotMs)),
      checkpointInFrameMs: mm(cases.map(own)), checkpointInFrameOver5: cases.filter(c => own(c) > 5).length,
      deferredWrites: cases.reduce((a, c) => a + c.deferred.setItem, 0), deferredStringifySetItemMs: mm(cases.filter(c => c.deferred.setItem).map(c => c.deferred.stringifyMs + c.deferred.setItemMs)),
      writeDelayMs: mm(cases.map(c => c.deferred.delayMs)),
      priseFrameMs: mm(cases.map(c => c.priseFrameMs)), priseFramesOver5: cases.filter(c => c.priseFrameMs > 5).length,
      priseParts: {stepMs: median(cases.map(c => c.inFrame.stepMs)), drawMs: median(cases.map(c => c.inFrame.drawMs)), updateWorldMs: median(cases.map(c => c.inFrame.updateWorldMs)), restMs: median(cases.map(c => c.inFrame.restMs))},
      walkFrameMs: {median: median(cases.map(c => c.walkBefore.medianMs)), max: max(cases.map(c => c.walkBefore.maxMs)), stepMs: median(cases.map(c => c.walkBefore.stepMedianMs)), drawMs: median(cases.map(c => c.walkBefore.drawMedianMs)), restMs: median(cases.map(c => c.walkBefore.restMedianMs))},
      priseMinusWalkMs: median(cases.map(c => c.priseFrameMs - c.walkBefore.medianMs)),
      ordinaryFrameMs: {median: median(runs.map(r => r.ordinaryMedianMs)), p95: median(runs.map(r => r.ordinaryP95Ms))},
      longTasksOverPrise: cases.reduce((a, c) => a + c.longTasksOverPrise, 0), longTasksPerPage: median(runs.map(r => r.longTasks)), longTaskMaxMs: max(runs.map(r => r.longTaskMaxMs)),
      pageErrors: runs.flatMap(r => r.errors || []).length,
    };
  }
  // Appariement : même répétition, A et B (ordre alterné), médiane des prises de chaque page.
  const reps = [...new Set(j.runs.map(r => r.rep))];
  const pair = pick => reps.map(rep => { const m = v => median((j.runs.find(r => r.rep === rep && r.variant === v)?.cases || []).filter(c => !c.error).map(pick)); return [m('A'), m('B')]; });
  const paired = pick => { const p = pair(pick); return {pairs: p, medianDifferenceMs: median(p.map(([a, b]) => a - b))}; };
  out.push({file, product: j.product, gl: j.runs[0]?.gl, world: j.runs[0]?.world, reps: j.reps, A: rows.A, B: rows.B,
    pairedPriseFrameMs: paired(c => c.priseFrameMs), pairedCheckpointInFrameMs: paired(c => c.snapshotMs + c.inFrame.stringifyMs + c.inFrame.setItemMs)});
}
console.log(JSON.stringify(out, null, 1));
