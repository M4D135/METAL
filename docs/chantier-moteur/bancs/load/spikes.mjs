// Correlates step spikes with destruction revisions, nav refresh and route searches.
// Scenario = bench2 (player advances, fires 6/20 steps, dashes every 240 steps).
// usage: node spikes.mjs <ferroRoot> <spec> [steps=1800] [threshold=8]
import {load, makeWorld, now} from './lib.mjs';
const [root, spec = 'l:0', stepsArg = '1800', thrArg = '8'] = process.argv.slice(2);
const W = load(root);
const world = makeWorld(W, spec);
const sim = W.FSimulation.create(world, {brain: W.FBrain.create({mode: 'cpu'}), armorSystem: true});
const s = sim.state, input = {moveX: 0, moveY: 1, sprint: true, fire: false, lookX: 0, lookY: 0};
const rows = []; let lastRev = s.destructionRevision, revAt = -1e9, doorAt = -1e9;
let maxPending = 0, revisions = 0, doorOpens = 0, totalSearches = 0, totalDeferred = 0;
for (let i = 0; i < +stepsArg; i++) {
  input.moveX = Math.sin(i / 90); input.fire = (i % 20) < 6; input.dash = (i % 240) === 0; s.player.yaw += 0.01;
  const t0 = now(); sim.step(1 / 60, input); const d = now() - t0;
  const names = s.events.map(e => e.name);
  if (s.destructionRevision !== lastRev) { revisions += s.destructionRevision - lastRev; lastRev = s.destructionRevision; revAt = i; }
  if (names.includes('doorOpen')) { doorOpens++; doorAt = i; }
  const a = s.aiStats; maxPending = Math.max(maxPending, a.navPending || 0); totalSearches += a.pathSearches || 0; totalDeferred += a.pathDeferred || 0;
  rows.push({i, d, rev: revAt, door: doorAt, pending: a.navPending || 0, searches: a.pathSearches || 0, deferred: a.pathDeferred || 0, awake: a.awake, ev: [...new Set(names)].filter(n => !['shot', 'hit', 'materialImpact', 'cooled'].includes(n)).join(',')});
  s.events.length = 0;
  if (s.dead) break;
}
const thr = +thrArg, spikes = rows.filter(r => r.d > thr);
const sinceRev = r => r.i - r.rev, sinceDoor = r => r.i - r.door;
const out = {spec, steps: rows.length, revisions, doorOpens, maxPending, totalSearches, totalDeferred,
  avg: +(rows.reduce((n, r) => n + r.d, 0) / rows.length).toFixed(3),
  spikeCount: spikes.length,
  spikesWithin60StepsOfRevisionOrDoor: spikes.filter(r => sinceRev(r) <= 60 || sinceDoor(r) <= 60).length,
  avgPendingSteps: rows.filter(r => r.pending > 0).length,
  // mean step time in the 60 steps after a revision vs the others
  meanAfterRev: +(() => { const a = rows.filter(r => sinceRev(r) >= 0 && sinceRev(r) <= 60); return a.reduce((n, r) => n + r.d, 0) / Math.max(1, a.length); })().toFixed(3),
  meanOther: +(() => { const a = rows.filter(r => !(sinceRev(r) >= 0 && sinceRev(r) <= 60)); return a.reduce((n, r) => n + r.d, 0) / Math.max(1, a.length); })().toFixed(3),
  spikes: spikes.map(r => ({i: r.i, ms: +r.d.toFixed(1), sinceRev: sinceRev(r), sinceDoor: sinceDoor(r), pending: r.pending, searches: r.searches, deferred: r.deferred, awake: r.awake, ev: r.ev}))};
console.log(JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{'));
